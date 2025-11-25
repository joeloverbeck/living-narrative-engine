/**
 * @file Integration tests for notes formatting pipeline
 * @description Tests end-to-end notes processing from AIPromptContentProvider through PromptDataFormatter
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { AIPromptContentProvider } from '../../../src/prompting/AIPromptContentProvider.js';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';

describe('Notes Formatting Integration', () => {
  let promptContentProvider;
  let promptDataFormatter;
  let mockLogger;

  // Test setup helpers
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
      shouldUseGrouping: jest.fn(() => false), // Default to flat formatting
      groupActionsByNamespace: jest.fn(() => new Map()),
      getSortedNamespaces: jest.fn(() => []),
      formatNamespaceDisplayName: jest.fn((namespace) =>
        namespace.toUpperCase()
      ),
    },
  });

  beforeEach(() => {
    mockLogger = createMockLogger();
    const mockServices = createMockServices();

    const characterDataXmlBuilder = {
      buildCharacterDataXml: jest.fn(() => '<character_data>Mock XML</character_data>'),
    };

    const modActionMetadataProvider = {
      getMetadataForMod: jest.fn(() => null),
    };

    promptContentProvider = new AIPromptContentProvider({
      logger: mockLogger,
      ...mockServices,
      characterDataXmlBuilder,
      modActionMetadataProvider,
    });

    promptDataFormatter = new PromptDataFormatter({ logger: mockLogger });
  });

  describe('End-to-End Notes Processing Pipeline', () => {
    test('should process structured notes through complete pipeline with grouping', async () => {
      // Setup: Create game state with structured notes
      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                {
                  text: 'John seems nervous about the council meeting',
                  subject: 'John',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'tavern conversation',
                  tags: ['emotion', 'politics'],
                  timestamp: '2024-01-01T10:00:00Z',
                },
                {
                  text: 'Always carries that strange medallion',
                  subject: 'John',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'morning observation',
                  tags: ['mystery', 'artifact'],
                  timestamp: '2024-01-01T11:00:00Z',
                },
                {
                  text: 'Guards doubled at the north gate',
                  subject: 'The North Gate',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'morning patrol',
                  tags: ['security', 'observation'],
                  timestamp: '2024-01-01T09:00:00Z',
                },
                {
                  text: 'Strange symbols carved into the gate stones',
                  subject: 'The North Gate',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'evening inspection',
                  tags: ['mystery', 'magic'],
                  timestamp: '2024-01-01T20:00:00Z',
                },
                {
                  text: 'Merchant caravan three days overdue',
                  subject: 'The Missing Shipment',
                  subjectType: SUBJECT_TYPES.EVENT,
                  context: 'marketplace rumors',
                  tags: ['commerce', 'concern'],
                  timestamp: '2024-01-01T15:00:00Z',
                },
              ],
            },
          },
        },
        actorPromptData: { name: 'Test Character' },
        currentUserInput: 'Test input',
        perceptionLog: [],
        currentLocation: {
          name: 'Test Location',
          description: 'A test location',
          exits: [],
          characters: [],
        },
        availableActions: [],
      };

      // Step 1: Extract notes through AIPromptContentProvider
      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      expect(promptData.notesArray).toHaveLength(5);
      expect(promptData.notesArray[0]).toEqual({
        text: 'John seems nervous about the council meeting',
        subject: 'John',
        subjectType: SUBJECT_TYPES.ENTITY,
        context: 'tavern conversation',
        // tags are intentionally excluded from the prompt pipeline
        timestamp: '2024-01-01T10:00:00Z',
      });

      // Explicitly verify no tags property exists in any extracted note
      promptData.notesArray.forEach((note) => {
        expect(note).not.toHaveProperty('tags');
      });

      // Step 2: Format notes with grouping through PromptDataFormatter
      const formattedPromptData = promptDataFormatter.formatPromptData({
        ...promptData,
        // Override to test with grouping enabled
      });

      // Test new default behavior - should be grouped format by default
      expect(formattedPromptData.notesContent).toContain(
        '- John seems nervous about the council meeting'
      );
      expect(formattedPromptData.notesContent).toContain('## Entities');

      // Step 3: Test grouped formatting explicitly
      const groupedNotesContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );

      expect(groupedNotesContent).toContain('## Entities');
      expect(groupedNotesContent).toContain('### John');
      expect(groupedNotesContent).toContain('### The North Gate');
      expect(groupedNotesContent).toContain('## Events');
      expect(groupedNotesContent).toContain('### The Missing Shipment');

      // Verify content and formatting (tags no longer displayed)
      expect(groupedNotesContent).toContain(
        '- John seems nervous about the council meeting (tavern conversation)'
      );
      expect(groupedNotesContent).toContain(
        '- Always carries that strange medallion (morning observation)'
      );
      expect(groupedNotesContent).toContain(
        '- Guards doubled at the north gate (morning patrol)'
      );

      // Step 4: Test complete notes section with grouping
      const groupedNotesSection = promptDataFormatter.formatNotesSection(
        promptData.notesArray,
        { groupBySubject: true }
      );

      expect(groupedNotesSection).toMatch(/^<notes>\n[\s\S]*\n<\/notes>$/);
      expect(groupedNotesSection).toContain('## Entities');
    });

    test('should handle mixed legacy and structured notes gracefully', async () => {
      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                // Legacy note (just text)
                { text: 'Simple legacy note' },
                // Structured note
                {
                  text: 'Structured note with context',
                  subject: 'Test Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'test context',
                },
                // Partially structured note
                {
                  text: 'Note with subject only',
                  subject: 'Another Subject',
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

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      expect(promptData.notesArray).toHaveLength(3);

      // Test that extraction preserves all fields correctly
      expect(promptData.notesArray[0]).toEqual({ text: 'Simple legacy note' });
      expect(promptData.notesArray[1]).toEqual({
        text: 'Structured note with context',
        subject: 'Test Subject',
        subjectType: SUBJECT_TYPES.ENTITY,
        context: 'test context',
      });
      expect(promptData.notesArray[2]).toEqual({
        text: 'Note with subject only',
        subject: 'Another Subject',
      });

      // Test grouped formatting handles mixed formats
      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );

      expect(groupedContent).toContain('## Entities');
      expect(groupedContent).toContain('## Other');
      expect(groupedContent).toContain('### Test Subject');
      expect(groupedContent).toContain('### Another Subject');
      expect(groupedContent).toContain('### General'); // For legacy note
    });

    test('should handle empty notes gracefully in complete pipeline', async () => {
      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: [],
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

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      expect(promptData.notesArray).toEqual([]);

      const formattedPromptData =
        promptDataFormatter.formatPromptData(promptData);
      expect(formattedPromptData.notesContent).toBe('');
      expect(formattedPromptData.notesSection).toBe('');

      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );
      expect(groupedContent).toBe('');
    });

    test('should handle missing notes component gracefully', async () => {
      const gameStateDto = {
        actorState: {
          components: {
            // No 'core:notes' component
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

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      expect(promptData.notesArray).toEqual([]);

      const groupedContent = promptDataFormatter.formatNotes(
        promptData.notesArray,
        { groupBySubject: true }
      );
      expect(groupedContent).toBe('');
    });
  });

  describe('Template Substitution Integration', () => {
    test('should properly format notes for template substitution', async () => {
      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                {
                  text: 'Test note for template',
                  subject: 'Template Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'template context',
                  tags: ['template', 'test'],
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

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      const formattedPromptData =
        promptDataFormatter.formatPromptData(promptData);

      // Verify default is now grouped format
      expect(formattedPromptData.notesContent).toContain('## Entities');
      expect(formattedPromptData.notesContent).toContain(
        '### Template Subject'
      );
      expect(formattedPromptData.notesContent).toContain(
        '- Test note for template (template context)'
      );
      expect(formattedPromptData.notesSection).toContain(
        '<notes>\n## Entities\n### Template Subject\n- Test note for template (template context)\n</notes>'
      );

      // Test that grouped section formatting can be applied
      const groupedNotesSection = promptDataFormatter.formatNotesSection(
        promptData.notesArray,
        { groupBySubject: true }
      );

      expect(groupedNotesSection).toContain('<notes>');
      expect(groupedNotesSection).toContain('## Entities');
      expect(groupedNotesSection).toContain('### Template Subject');
      expect(groupedNotesSection).toContain(
        '- Test note for template (template context)'
      );
      expect(groupedNotesSection).toContain('</notes>');
    });
  });

  describe('Formatted Notes Display - New Subject Types', () => {
    test('should display comprehensive note set with new types in correct order', () => {
      const comprehensiveNotes = [
        {
          subject: 'Bobby',
          subjectType: SUBJECT_TYPES.ENTITY,
          text: 'In coma',
          context: 'brother',
        },
        {
          subject: 'Hospital',
          subjectType: SUBJECT_TYPES.ENTITY,
          text: 'Third floor',
          context: 'place',
        },
        {
          subject: 'Council vote',
          subjectType: SUBJECT_TYPES.EVENT,
          text: 'Declared war',
          context: 'yesterday',
        },
        {
          subject: 'Escape plan',
          subjectType: SUBJECT_TYPES.PLAN,
          text: 'Flee at dawn',
          context: 'tomorrow',
        },
        {
          subject: 'Deadline',
          subjectType: SUBJECT_TYPES.EVENT,
          text: '3 days left',
          context: 'urgency',
        },
        {
          subject: 'My crisis',
          subjectType: SUBJECT_TYPES.STATE,
          text: 'Existential dread',
          context: 'mental state',
        },
        {
          subject: 'Reality theory',
          subjectType: SUBJECT_TYPES.KNOWLEDGE,
          text: 'Time is non-linear',
          context: 'hypothesis',
        },
        {
          subject: 'Wizard pattern',
          subjectType: SUBJECT_TYPES.KNOWLEDGE,
          text: 'Taps staff 3 times',
          context: 'noticed behavior',
        },
        {
          subject: "Jon's knowledge",
          subjectType: SUBJECT_TYPES.KNOWLEDGE,
          text: 'Knows my secret',
          context: 'epistemic',
        },
      ];

      const formatted = promptDataFormatter.formatGroupedNotes(
        comprehensiveNotes,
        { showContext: true }
      );

      // Verify new taxonomy categories (6 types: entity, event, plan, knowledge, state, other)
      const categories = [
        'Entities',      // Bobby, Hospital
        'Events',        // Council vote, Deadline
        'Plans',         // Escape plan
        'Knowledge',     // Reality theory, Wizard pattern, Jon's knowledge
        'States',        // My crisis
      ];

      // Verify all categories are present
      categories.forEach((category) => {
        expect(formatted).toContain(`## ${category}`);
      });

      // Verify category order
      for (let i = 0; i < categories.length - 1; i++) {
        const currentIndex = formatted.indexOf(`## ${categories[i]}`);
        const nextIndex = formatted.indexOf(`## ${categories[i + 1]}`);
        expect(currentIndex).toBeLessThan(nextIndex);
      }
    });
  });

  describe('Configuration and Options Integration', () => {
    test('should respect formatting options throughout pipeline', async () => {
      const gameStateDto = {
        actorState: {
          components: {
            'core:notes': {
              notes: [
                {
                  text: 'Note with options test',
                  subject: 'Options Subject',
                  subjectType: SUBJECT_TYPES.ENTITY,
                  context: 'options context',
                  tags: ['option1', 'option2'],
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

      const promptData = await promptContentProvider.getPromptData(
        gameStateDto,
        mockLogger
      );

      // Test different option combinations
      const optionsTestCases = [
        {
          options: {
            groupBySubject: true,
            showContext: false,
          },
          expectedContent: '- Note with options test',
          expectedNotToContain: ['(options context)'],
        },
        {
          options: { groupBySubject: true, showContext: true },
          expectedContent: '- Note with options test (options context)',
          expectedNotToContain: [],
        },
        {
          options: { groupBySubject: true, showContext: false },
          expectedContent: '- Note with options test',
          expectedNotToContain: ['(options context)'],
        },
      ];

      optionsTestCases.forEach(
        ({ options, expectedContent, expectedNotToContain }) => {
          const result = promptDataFormatter.formatNotes(
            promptData.notesArray,
            options
          );

          expect(result).toContain(expectedContent);
          expectedNotToContain.forEach((notExpected) => {
            expect(result).not.toContain(notExpected);
          });
        }
      );
    });
  });
});
