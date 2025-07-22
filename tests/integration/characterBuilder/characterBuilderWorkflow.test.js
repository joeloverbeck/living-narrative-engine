/**
 * @file Integration tests for Character Builder complete workflow
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
} from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

/**
 * Integration test for the complete character builder workflow
 * Tests the interaction between all services and components
 */
describe('Character Builder Workflow Integration', () => {
  let characterBuilderService;
  let mockLogger;
  let mockSchemaValidator;
  let mockEventBus;
  let mockDatabase;
  let mockStorageService;
  let mockDirectionGenerator;

  beforeEach(() => {
    // Create logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Create schema validator mock
    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(() => true),
      formatAjvErrors: jest.fn(() => 'Validation error'),
      addSchema: jest.fn(),
    };

    // Create database mock
    mockDatabase = {
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      initialize: jest.fn(),
      close: jest.fn(),
    };

    // Create storage service
    mockStorageService = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator: mockSchemaValidator,
    });

    // Create direction generator mock with realistic behavior
    mockDirectionGenerator = {
      generateDirections: jest.fn(),
      validateResponse: jest.fn(() => true),
      getResponseSchema: jest.fn(() => ({
        type: 'object',
        properties: {
          thematicDirections: {
            type: 'array',
          },
        },
      })),
    };

    // Create character builder service
    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });

    // Mock database initialization to succeed
    mockDatabase.initialize.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Character Creation Workflow', () => {
    beforeEach(async () => {
      // Initialize the character builder service
      await characterBuilderService.initialize();
    });

    test('should successfully create character concept and generate thematic directions', async () => {
      // Arrange
      const conceptText =
        'Elara Nightwhisper, a skilled elven ranger with a mysterious past, known for her exceptional archery skills and her ability to communicate with woodland creatures. She carries an ancient bow passed down through her family. Background: Outlander. Personality: Curious but cautious, fiercely protective of nature.';

      const mockStoredConcept = {
        id: 'concept-elara-123',
        concept: conceptText,
        status: 'draft',
        thematicDirections: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockGeneratedDirections = [
        {
          id: 'direction-1',
          conceptId: 'concept-elara-123',
          title: 'The Last Guardian of Ancient Secrets',
          description:
            'Elara is the sole keeper of ancestral knowledge that could either save or doom the natural world.',
          coreTension:
            'The burden of forbidden knowledge versus the safety of ignorance',
          uniqueTwist:
            "Her family's bow is actually a key to unlocking ancient nature magic",
          narrativePotential:
            'Stories of environmental preservation, ancient mysteries, and the weight of legacy',
          llmMetadata: {
            modelId: 'openrouter-claude-sonnet-4',
            promptTokens: 245,
            responseTokens: 420,
            processingTime: 3200,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'direction-2',
          conceptId: 'concept-elara-123',
          title: 'The Bridge Between Two Worlds',
          description:
            'Her ability to communicate with animals makes her a mediator between civilization and the wild.',
          coreTension: 'Loyalty to nature versus responsibility to society',
          uniqueTwist:
            'The animals she speaks to carry messages from a parallel realm',
          narrativePotential:
            'Tales of diplomacy, environmental conflict, and interdimensional mysteries',
          llmMetadata: {
            modelId: 'openrouter-claude-sonnet-4',
            promptTokens: 245,
            responseTokens: 420,
            processingTime: 3200,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'direction-3',
          conceptId: 'concept-elara-123',
          title: 'The Reluctant Heir to Destiny',
          description:
            'Despite her skills, Elara never wanted the responsibility that comes with her heritage.',
          coreTension: 'Personal freedom versus inherited duty',
          uniqueTwist:
            'Her reluctance is actually protecting her from a dark family curse',
          narrativePotential:
            'Coming-of-age stories with themes of self-acceptance and breaking generational patterns',
          llmMetadata: {
            modelId: 'openrouter-claude-sonnet-4',
            promptTokens: 245,
            responseTokens: 420,
            processingTime: 3200,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup mocks
      mockDatabase.saveCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDatabase.getCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(
        mockGeneratedDirections
      );
      mockDatabase.saveThematicDirections.mockResolvedValue(
        mockGeneratedDirections
      );
      mockDatabase.getThematicDirectionsByConceptId.mockResolvedValue(
        mockGeneratedDirections
      );

      // Act - Step 1: Create character concept
      const createdConcept =
        await characterBuilderService.createCharacterConcept(conceptText);

      // Assert - Step 1
      expect(createdConcept).toEqual(mockStoredConcept);
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: conceptText,
          status: 'draft',
        })
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_CONCEPT_CREATED',
        payload: expect.objectContaining({
          conceptId: mockStoredConcept.id,
          concept: expect.any(String),
          autoSaved: true,
        }),
      });

      // Act - Step 2: Generate thematic directions
      const generatedDirections =
        await characterBuilderService.generateThematicDirections(
          createdConcept.id
        );

      // Assert - Step 2
      expect(generatedDirections).toEqual(mockGeneratedDirections);
      expect(mockDatabase.getCharacterConcept).toHaveBeenCalledWith(
        createdConcept.id
      );
      expect(mockDirectionGenerator.generateDirections).toHaveBeenCalledWith(
        createdConcept.id,
        expect.stringContaining('Elara Nightwhisper'),
        expect.objectContaining({}) // options parameter
      );
      expect(mockDatabase.saveThematicDirections).toHaveBeenCalledWith(
        mockGeneratedDirections
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'THEMATIC_DIRECTIONS_GENERATED',
        payload: expect.objectContaining({
          conceptId: createdConcept.id,
          directionCount: 3,
        }),
      });

      // Act - Step 3: Retrieve stored data
      const retrievedConcept =
        await characterBuilderService.getCharacterConcept(createdConcept.id);
      const retrievedDirections =
        await characterBuilderService.getThematicDirections(createdConcept.id);

      // Assert - Step 3: Verify persistence
      expect(retrievedConcept).toEqual(mockStoredConcept);
      expect(retrievedDirections).toEqual(mockGeneratedDirections);
      expect(retrievedDirections).toHaveLength(3);
      expect(
        retrievedDirections.every((dir) => dir.conceptId === createdConcept.id)
      ).toBe(true);

      // Verify all directions have required fields
      retrievedDirections.forEach((direction) => {
        expect(direction).toHaveProperty('id');
        expect(direction).toHaveProperty('title');
        expect(direction).toHaveProperty('description');
        expect(direction).toHaveProperty('coreTension');
        expect(direction).toHaveProperty('uniqueTwist');
        expect(direction).toHaveProperty('narrativePotential');
        expect(direction).toHaveProperty('llmMetadata');
        expect(direction.llmMetadata).toHaveProperty('modelId');
        expect(direction.llmMetadata).toHaveProperty('processingTime');
      });
    });

    test('should handle workflow with custom LLM configuration', async () => {
      // Arrange
      const conceptText =
        'Thorgar Ironbeard, a dwarven blacksmith with dreams of adventure. Background: Guild Artisan. Personality: Practical but adventurous.';

      const customLlmConfigId = 'custom-character-config';
      const mockStoredConcept = {
        id: 'concept-thorgar-456',
        concept: conceptText,
        status: 'draft',
        thematicDirections: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockGeneratedDirections = [
        {
          id: 'direction-4',
          conceptId: 'concept-thorgar-456',
          title: "The Artisan's Quest",
          description: 'A master craftsman seeking legendary materials',
          coreTension: 'Comfort of the forge versus call of adventure',
          uniqueTwist: 'His crafted items have unexpected magical properties',
          narrativePotential:
            'Adventures in search of rare materials and ancient techniques',
          llmMetadata: {
            modelId: customLlmConfigId,
            promptTokens: 180,
            responseTokens: 320,
            processingTime: 2800,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Setup mocks
      mockDatabase.saveCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDatabase.getCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(
        mockGeneratedDirections
      );
      mockDatabase.saveThematicDirections.mockResolvedValue(
        mockGeneratedDirections
      );

      // Act
      const createdConcept =
        await characterBuilderService.createCharacterConcept(conceptText);
      const generatedDirections =
        await characterBuilderService.generateThematicDirections(
          createdConcept.id,
          { llmConfigId: customLlmConfigId }
        );

      // Assert
      expect(mockDirectionGenerator.generateDirections).toHaveBeenCalledWith(
        createdConcept.id,
        expect.any(String),
        expect.objectContaining({ llmConfigId: customLlmConfigId })
      );
      expect(generatedDirections[0].llmMetadata.modelId).toBe(
        customLlmConfigId
      );
    });

    test('should handle workflow errors gracefully', async () => {
      // Use fake timers to speed up retry delays
      jest.useFakeTimers();

      // Arrange
      const conceptText =
        'Test Character, a test character for error handling.';

      const mockStoredConcept = {
        id: 'concept-error-test',
        concept: conceptText,
        status: 'draft',
        thematicDirections: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Setup mocks - concept creation succeeds, but direction generation fails
      mockDatabase.saveCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDatabase.getCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDirectionGenerator.generateDirections.mockRejectedValue(
        new Error('LLM service temporarily unavailable')
      );

      // Act & Assert
      const createdConcept =
        await characterBuilderService.createCharacterConcept(conceptText);
      expect(createdConcept).toEqual(mockStoredConcept);

      // Use real timers for the promise but immediately run timers
      jest.useRealTimers();
      
      // Mock setTimeout to execute immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn) => {
        fn();
        return 0;
      });

      await expect(
        characterBuilderService.generateThematicDirections(createdConcept.id)
      ).rejects.toThrow('LLM service temporarily unavailable');

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;

      // Verify concept was still created despite direction generation failure
      const retrievedConcept =
        await characterBuilderService.getCharacterConcept(createdConcept.id);
      expect(retrievedConcept).toEqual(mockStoredConcept);
    });

    test('should handle database connection errors', async () => {
      // Arrange
      const conceptText =
        'Test Character, a test character for database error handling.';

      // Setup mock - database operation fails
      mockDatabase.saveCharacterConcept.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Mock setTimeout to execute immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((fn) => {
        fn();
        return 0;
      });

      // Act & Assert
      await expect(
        characterBuilderService.createCharacterConcept(conceptText)
      ).rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create character concept'),
        expect.any(Object)
      );

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });

    test('should handle validation errors in workflow', async () => {
      // Arrange
      const invalidConceptText = ''; // Invalid - empty string

      // Setup mock - validation fails
      mockSchemaValidator.validateAgainstSchema.mockReturnValue(false);
      mockSchemaValidator.formatAjvErrors.mockReturnValue(
        'Name is required and cannot be empty'
      );

      // Act & Assert
      await expect(
        characterBuilderService.createCharacterConcept(invalidConceptText)
      ).rejects.toThrow('concept must be a non-empty string');

      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled();
    });
  });

  describe('Character Concept Management Workflow', () => {
    beforeEach(async () => {
      // Initialize the character builder service
      await characterBuilderService.initialize();
    });

    test('should successfully list and delete character concepts', async () => {
      // Arrange
      const mockConcepts = [
        {
          id: 'concept-1',
          name: 'Hero One',
          description: 'First hero',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'concept-2',
          name: 'Hero Two',
          description: 'Second hero',
          createdAt: new Date().toISOString(),
        },
      ];

      mockDatabase.getAllCharacterConcepts.mockResolvedValue(mockConcepts);
      mockDatabase.deleteCharacterConcept.mockResolvedValue(true);

      // Act - List concepts
      const listedConcepts =
        await characterBuilderService.getAllCharacterConcepts();

      // Assert - List operation
      expect(listedConcepts).toEqual(mockConcepts);
      expect(mockDatabase.getAllCharacterConcepts).toHaveBeenCalled();

      // Act - Delete concept
      const deletionResult =
        await characterBuilderService.deleteCharacterConcept('concept-1');

      // Assert - Delete operation
      expect(deletionResult).toBe(true);
      expect(mockDatabase.deleteCharacterConcept).toHaveBeenCalledWith(
        'concept-1'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_CONCEPT_DELETED',
        payload: expect.objectContaining({
          conceptId: 'concept-1',
        }),
      });
    });

    test('should handle non-existent concept deletion gracefully', async () => {
      // Arrange
      mockDatabase.deleteCharacterConcept.mockResolvedValue(false);

      // Act
      const deletionResult =
        await characterBuilderService.deleteCharacterConcept('non-existent');

      // Assert
      expect(deletionResult).toBe(false);
      expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CHARACTER_CONCEPT_DELETED' })
      );
    });
  });

  describe('Event System Integration', () => {
    beforeEach(async () => {
      // Initialize the character builder service
      await characterBuilderService.initialize();
    });

    test('should dispatch all expected events during complete workflow', async () => {
      // Arrange
      const conceptText =
        'Event Test Character, a character for testing event system integration.';

      const mockStoredConcept = {
        id: 'concept-events-test',
        concept: conceptText,
        status: 'draft',
        thematicDirections: [],
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockGeneratedDirections = [
        {
          id: 'direction-event-test',
          conceptId: 'concept-events-test',
          title: 'Test Direction',
          description: 'A direction for testing events',
          coreTension: 'Test tension',
          uniqueTwist: 'Test twist',
          narrativePotential: 'Test potential',
          llmMetadata: {
            modelId: 'test-model',
            promptTokens: 100,
            responseTokens: 200,
            processingTime: 1000,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockDatabase.saveCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDatabase.getCharacterConcept.mockResolvedValue(mockStoredConcept);
      mockDirectionGenerator.generateDirections.mockResolvedValue(
        mockGeneratedDirections
      );
      mockDatabase.saveThematicDirections.mockResolvedValue(
        mockGeneratedDirections
      );
      mockDatabase.deleteCharacterConcept.mockResolvedValue(true);

      // Act
      const createdConcept =
        await characterBuilderService.createCharacterConcept(conceptText);
      await characterBuilderService.generateThematicDirections(
        createdConcept.id
      );
      await characterBuilderService.deleteCharacterConcept(createdConcept.id);

      // Assert - Verify all expected events were dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_CONCEPT_CREATED',
        payload: expect.objectContaining({
          conceptId: mockStoredConcept.id,
          concept: expect.any(String),
          autoSaved: true,
        }),
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'THEMATIC_DIRECTIONS_GENERATED',
        payload: expect.objectContaining({
          conceptId: mockStoredConcept.id,
          directionCount: 1,
        }),
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'CHARACTER_CONCEPT_DELETED',
        payload: expect.objectContaining({
          conceptId: mockStoredConcept.id,
        }),
      });

      expect(mockEventBus.dispatch).toHaveBeenCalledTimes(3);
    });
  });
});
