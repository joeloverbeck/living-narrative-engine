/**
 * @file Backwards compatibility integration tests for tag removal
 * @description Tests system handling of legacy data with tags and mixed scenarios
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import NotesService from '../../../src/ai/notesService.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import fs from 'fs';
import path from 'path';

describe('Backwards Compatibility Integration Tests', () => {
  let promptContentProvider;
  let promptDataFormatter;
  let notesService;
  let validator;
  let mockLogger;
  let notesSchema;

  const createMockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const createMockServices = () => ({
    promptStaticContentService: {
      getCoreTaskDescriptionText: () => 'core-task',
      getCharacterPortrayalGuidelines: () => 'portrayal',
      getNc21ContentPolicyText: () => 'content-policy',
      getFinalLlmInstructionText: () => 'final-instructions',
    },
    perceptionLogFormatter: {
      format: (logArray) =>
        logArray.map((entry) => ({ content: entry.descriptionText || '' })),
    },
    gameStateValidationService: {
      validate: () => ({ isValid: true, errorContent: null }),
    },
    actionCategorizationService: {
      extractNamespace: jest.fn(
        (actionId) => actionId.split(':')[0] || 'unknown'
      ),
      shouldUseGrouping: jest.fn(() => false),
      groupActionsByNamespace: jest.fn(() => new Map()),
      getSortedNamespaces: jest.fn(() => []),
      formatNamespaceDisplayName: jest.fn((namespace) =>
        namespace.toUpperCase()
      ),
    },
  });

  beforeEach(async () => {
    mockLogger = createMockLogger();
    const mockServices = createMockServices();

    promptContentProvider = new AIPromptContentProvider({
      logger: mockLogger,
      ...mockServices,
    });

    promptDataFormatter = new PromptDataFormatter({ logger: mockLogger });
    notesService = new NotesService();

    // Setup schema validation
    validator = new AjvSchemaValidator({ logger: mockLogger });
    const schemaPath = path.join(
      process.cwd(),
      'data/mods/core/components/notes.component.json'
    );
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    notesSchema = JSON.parse(schemaContent);
    await validator.addSchema(notesSchema.dataSchema, 'core:notes');
  });

  describe('Legacy Save Data Handling', () => {
    test('should handle legacy save data containing notes with tags gracefully', async () => {
      // Simulate legacy save data with tags
      const legacySaveData = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                {
                  text: 'Legacy note with tags from old save',
                  subject: 'Old Character',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'legacy game session',
                  tags: ['legacy', 'important', 'character'], // These should be filtered
                  timestamp: '2023-12-01T10:00:00Z',
                },
                {
                  text: 'Another legacy note with different tags',
                  subject: 'Old Location',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  tags: ['exploration', 'discovery'], // These should be filtered
                  timestamp: '2023-12-01T11:00:00Z',
                },
                {
                  text: 'Legacy note without tags',
                  subject: 'Neutral Subject',
                  subjectType: SUBJECT_TYPES.EVENT,
                  timestamp: '2023-12-01T12:00:00Z',
                },
              ],
            },
          },
        },
        actorPromptData: { name: 'Legacy Character' },
        currentUserInput: 'Test legacy compatibility',
        perceptionLog: [],
        currentLocation: {
          name: 'Legacy Location',
          description: 'A location from an old save',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      // Process legacy data through current system
      const promptData = await promptContentProvider.getPromptData(
        legacySaveData,
        mockLogger
      );

      // Verify all notes are processed correctly
      expect(promptData.notesArray).toHaveLength(3);

      // Verify tags are filtered out during processing
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });

      // Verify content is preserved
      expect(promptData.notesArray[0].text).toBe(
        'Legacy note with tags from old save'
      );
      expect(promptData.notesArray[0].subject).toBe('Old Character');
      expect(promptData.notesArray[1].text).toBe(
        'Another legacy note with different tags'
      );
      expect(promptData.notesArray[2].text).toBe('Legacy note without tags');

      // Format the data and verify it works properly
      const formattedData = promptDataFormatter.formatPromptData(promptData);
      expect(formattedData.notesContent).toContain(
        'Legacy note with tags from old save'
      );
      expect(formattedData.notesContent).toContain(
        'Another legacy note with different tags'
      );
      expect(formattedData.notesContent).toContain('Legacy note without tags');

      // Verify no tag content appears in formatted output
      expect(formattedData.notesContent).not.toContain(
        '[legacy, important, character]'
      );
      expect(formattedData.notesContent).not.toContain(
        '[exploration, discovery]'
      );
    });

    test('should handle corrupted legacy data with malformed tag structures', async () => {
      const corruptedLegacyData = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                // Normal legacy note
                {
                  text: 'Normal legacy note',
                  subject: 'Normal Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  tags: ['normal', 'tag'],
                },
                // Corrupted tag structures that should be handled gracefully
                {
                  text: 'Note with malformed tags',
                  subject: 'Corrupted Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  tags: null, // Null tags
                },
                {
                  text: 'Note with invalid tags',
                  subject: 'Invalid Subject',
                  subjectType: SUBJECT_TYPES.EVENT,
                  tags: 'string-instead-of-array', // Invalid tag format
                },
                {
                  text: 'Note with nested tag objects',
                  subject: 'Nested Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  tags: [{ nested: 'object' }, { another: 'object' }], // Invalid nested objects
                },
              ],
            },
          },
        },
        actorPromptData: { name: 'Test Character' },
        currentUserInput: '',
        perceptionLog: [],
        currentLocation: {
          name: 'Test Location',
          description: 'A test location',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      // Should not throw errors despite corrupted data
      const promptData = await promptContentProvider.getPromptData(
        corruptedLegacyData,
        mockLogger
      );

      // Verify all notes are processed
      expect(promptData.notesArray).toHaveLength(4);

      // Verify no tags remain in processed notes
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });

      // Verify text content is preserved despite tag corruption
      expect(promptData.notesArray[0].text).toBe('Normal legacy note');
      expect(promptData.notesArray[1].text).toBe('Note with malformed tags');
      expect(promptData.notesArray[2].text).toBe('Note with invalid tags');
      expect(promptData.notesArray[3].text).toBe(
        'Note with nested tag objects'
      );

      // Verify formatting works correctly
      const formattedData = promptDataFormatter.formatPromptData(promptData);
      expect(formattedData.notesContent.length).toBeGreaterThan(0);
    });

    test('should handle mixed legacy and current save data gracefully', async () => {
      const mixedSaveData = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                // Legacy note with tags
                {
                  text: 'Legacy note from old save',
                  subject: 'Legacy Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'old session',
                  tags: ['legacy', 'old'],
                  timestamp: '2023-01-01T10:00:00Z',
                },
                // Current note without tags
                {
                  text: 'Current note without tags',
                  subject: 'Current Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'current session',
                  timestamp: '2024-01-01T10:00:00Z',
                },
                // Minimal legacy note (just text)
                {
                  text: 'Minimal legacy note',
                },
                // Structured current note
                {
                  text: 'Fully structured current note',
                  subject: 'Structured Subject',
                  subjectType: SUBJECT_TYPES.EVENT,
                  context: 'structured context',
                  timestamp: '2024-01-01T11:00:00Z',
                },
              ],
            },
          },
        },
        actorPromptData: { name: 'Mixed Character' },
        currentUserInput: 'Mixed compatibility test',
        perceptionLog: [],
        currentLocation: {
          name: 'Mixed Location',
          description: 'A location with mixed data',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      const promptData = await promptContentProvider.getPromptData(
        mixedSaveData,
        mockLogger
      );

      // Verify all notes processed
      expect(promptData.notesArray).toHaveLength(4);

      // Verify no tags in any processed notes
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });

      // Format and verify mixed content works
      const formattedData = promptDataFormatter.formatPromptData(promptData);
      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );

      // Verify all content types are properly handled
      expect(groupedContent).toContain('Legacy note from old save');
      expect(groupedContent).toContain('Current note without tags');
      expect(groupedContent).toContain('Minimal legacy note');
      expect(groupedContent).toContain('Fully structured current note');

      // Verify proper grouping despite mixed formats
      expect(groupedContent).toContain('## Entities');
      expect(groupedContent).toContain('## Events');
      expect(groupedContent).toContain('## Other');
    });
  });

  describe('Migration Scenario Testing', () => {
    test('should handle progressive migration from tagged to tag-free notes', async () => {
      // Simulate a save file during migration where some notes have been processed
      const partialMigrationData = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                // Old format with tags (not yet migrated)
                {
                  text: 'Old format note with tags',
                  subject: 'Unmigrated Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  tags: ['unmigrated', 'old'],
                  timestamp: '2023-01-01T10:00:00Z',
                },
                // New format without tags (already migrated)
                {
                  text: 'New format note without tags',
                  subject: 'Migrated Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'migrated context',
                  timestamp: '2024-01-01T10:00:00Z',
                },
                // Hybrid note (partially migrated - has both old and new fields)
                {
                  text: 'Hybrid note with mixed fields',
                  subject: 'Hybrid Subject',
                  subjectType: SUBJECT_TYPES.EVENT,
                  context: 'hybrid context',
                  tags: ['hybrid'], // Should be ignored
                  timestamp: '2024-01-01T11:00:00Z',
                },
              ],
            },
          },
        },
        actorPromptData: { name: 'Migration Character' },
        currentUserInput: 'Migration test',
        perceptionLog: [],
        currentLocation: {
          name: 'Migration Location',
          description: 'A location during migration',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      const promptData = await promptContentProvider.getPromptData(
        partialMigrationData,
        mockLogger
      );

      // Verify all notes are processed uniformly
      expect(promptData.notesArray).toHaveLength(3);

      // Verify consistent tag removal regardless of original format
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });

      // Verify all expected content is present
      expect(
        promptData.notesArray.some((note) =>
          note.text.includes('Old format note')
        )
      ).toBe(true);
      expect(
        promptData.notesArray.some((note) =>
          note.text.includes('New format note')
        )
      ).toBe(true);
      expect(
        promptData.notesArray.some((note) => note.text.includes('Hybrid note'))
      ).toBe(true);

      // Verify formatting works consistently
      const formattedData = promptDataFormatter.formatPromptData(promptData);
      expect(formattedData.notesContent).toContain('Old format note with tags');
      expect(formattedData.notesContent).toContain(
        'New format note without tags'
      );
      expect(formattedData.notesContent).toContain(
        'Hybrid note with mixed fields'
      );
    });

    test('should maintain note ordering and timestamps during compatibility processing', async () => {
      const timestampedLegacyData = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                {
                  text: 'First note',
                  subject: 'Subject A',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  tags: ['first'],
                  timestamp: '2023-01-01T09:00:00Z',
                },
                {
                  text: 'Second note',
                  subject: 'Subject B',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  tags: ['second'],
                  timestamp: '2023-01-01T10:00:00Z',
                },
                {
                  text: 'Third note',
                  subject: 'Subject C',
                  subjectType: SUBJECT_TYPES.EVENT,
                  tags: ['third'],
                  timestamp: '2023-01-01T11:00:00Z',
                },
              ],
            },
          },
        },
        actorPromptData: { name: 'Timestamp Character' },
        currentUserInput: '',
        perceptionLog: [],
        currentLocation: {
          name: 'Timestamp Location',
          description: 'A location for timestamp testing',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      const promptData = await promptContentProvider.getPromptData(
        timestampedLegacyData,
        mockLogger
      );

      // Verify timestamp preservation
      expect(promptData.notesArray[0].timestamp).toBe('2023-01-01T09:00:00Z');
      expect(promptData.notesArray[1].timestamp).toBe('2023-01-01T10:00:00Z');
      expect(promptData.notesArray[2].timestamp).toBe('2023-01-01T11:00:00Z');

      // Verify order is maintained
      expect(promptData.notesArray[0].text).toBe('First note');
      expect(promptData.notesArray[1].text).toBe('Second note');
      expect(promptData.notesArray[2].text).toBe('Third note');

      // Verify no tags preserved
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });
    });
  });

  describe('Schema Validation Compatibility', () => {
    test('should validate processed legacy notes against current schema', async () => {
      const legacyNotesComponent = {
        notes: [
          {
            text: 'Legacy note for validation',
            subject: 'Validation Subject',
            subjectType: SUBJECT_TYPES.ENTITY,
            context: 'validation context',
            tags: ['should', 'be', 'removed'], // Will be filtered
            timestamp: '2023-01-01T10:00:00Z',
          },
        ],
      };

      // Process through notes service (which filters tags)
      const processedComponent = notesService.addNotes(
        { notes: [] },
        legacyNotesComponent.notes
      );

      // Validate processed component against current schema
      const validationResult = validator.validate(
        'core:notes',
        processedComponent.component
      );

      expect(validationResult.isValid).toBe(true);
      if (validationResult.errors) {
        expect(validationResult.errors).toEqual([]);
      }

      // Verify tags were filtered out
      expect(processedComponent.component.notes[0]).not.toHaveProperty('tags');
    });

    test('should handle schema evolution gracefully with legacy data', async () => {
      // Simulate notes with extra fields that might exist in legacy saves
      const legacyWithExtraFields = {
        notes: [
          {
            text: 'Note with extra legacy fields',
            subject: 'Extra Subject',
            subjectType: SUBJECT_TYPES.ENTITY,
            context: 'extra context',
            tags: ['extra'], // Will be filtered
            timestamp: '2023-01-01T10:00:00Z',
            // Legacy fields that should be filtered
            priority: 'high',
            color: '#ff0000',
            metadata: { extra: 'data' },
          },
        ],
      };

      // Process through notes service
      const result = notesService.addNotes(
        { notes: [] },
        legacyWithExtraFields.notes
      );

      // Should pass validation despite extra fields being filtered
      const validationResult = validator.validate(
        'core:notes',
        result.component
      );

      expect(validationResult.isValid).toBe(true);

      // Verify only expected fields remain
      const processedNote = result.component.notes[0];
      expect(processedNote.text).toBe('Note with extra legacy fields');
      expect(processedNote.subject).toBe('Extra Subject');
      expect(processedNote.subjectType).toBe(SUBJECT_TYPES.ENTITY);
      expect(processedNote.context).toBe('extra context');
      expect(processedNote.timestamp).toBe('2023-01-01T10:00:00Z');

      // Verify extra fields are filtered
      expect(processedNote).not.toHaveProperty('tags');
      expect(processedNote).not.toHaveProperty('priority');
      expect(processedNote).not.toHaveProperty('color');
      expect(processedNote).not.toHaveProperty('metadata');
    });
  });

  describe('Performance with Legacy Data', () => {
    test('should maintain performance when processing large legacy datasets', async () => {
      // Create large legacy dataset
      const largeLegacyData = Array.from({ length: 200 }, (_, i) => ({
        text: `Legacy note ${i + 1} with detailed content`,
        subject: `Legacy Subject ${i + 1}`,
        subjectType:
          Object.values(SUBJECT_TYPES)[i % Object.values(SUBJECT_TYPES).length],
        context: `legacy context ${i + 1}`,
        tags: [`tag${i + 1}`, `category${(i % 5) + 1}`, `type${(i % 3) + 1}`],
        timestamp: new Date(2023, 0, 1, i % 24).toISOString(),
      }));

      const gameState = {
        actorState: {
          components: {
            'core:notes': {
              notes: largeLegacyData,
            },
          },
        },
        actorPromptData: { name: 'Legacy Character' },
        currentUserInput: '',
        perceptionLog: [],
        currentLocation: {
          name: 'Legacy Location',
          description: 'A location with legacy data',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      // Measure processing time
      const startTime = Date.now();
      const promptData = await promptContentProvider.getPromptData(
        gameState,
        mockLogger
      );
      const formattedData = promptDataFormatter.formatPromptData(promptData);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Verify performance is acceptable
      expect(processingTime).toBeLessThan(500); // Under 500ms for 200 legacy notes
      expect(promptData.notesArray).toHaveLength(200);

      // Verify all tags filtered from legacy data
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });

      // Verify content integrity
      expect(formattedData.notesContent.length).toBeGreaterThan(0);

      console.log(`Legacy Data Performance (200 notes): ${processingTime}ms`);
    });
  });
});
