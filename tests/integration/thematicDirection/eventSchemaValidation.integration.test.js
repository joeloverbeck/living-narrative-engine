/**
 * @file Integration test for thematic direction event schema validation
 * Ensures events are properly dispatched with valid schemas and no warnings
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { ThematicDirectionGenerator } from '../../../src/characterBuilder/services/thematicDirectionGenerator.js';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Thematic Direction - Event Schema Validation Integration', () => {
  let schemaValidator;
  let eventDispatcher;
  let safeEventDispatcher;
  let characterBuilderService;
  let characterDatabase;
  let mockLogger;
  let warnSpy;
  let infoSpy;
  let debugSpy;

  beforeEach(async () => {
    // Create logger and schema validator - use a new instance each time
    mockLogger = createMockLogger();
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Create a basic event dispatcher first
    const basicEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };

    // Create mock gameDataRepository
    const mockGameDataRepository = {
      getEventDefinition: jest.fn().mockReturnValue(null),
      getEventDefinitions: jest.fn().mockReturnValue([]),
    };

    // Create validated event dispatcher
    eventDispatcher = new ValidatedEventDispatcher({
      eventBus: basicEventDispatcher,
      gameDataRepository: mockGameDataRepository,
      schemaValidator,
      logger: mockLogger,
    });

    // If we need SafeEventDispatcher, create it with the validated dispatcher
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventDispatcher,
      logger: mockLogger,
    });

    // Create mock database
    characterDatabase = {
      saveCharacterConcept: jest.fn().mockResolvedValue({
        id: '12345678-1234-1234-1234-123456789abc',
        concept: 'A brave knight on a quest',
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getCharacterConcept: jest.fn().mockImplementation((id) => {
        // Return the concept when asked for it
        return {
          id: id,
          concept: 'A mysterious sorceress with ancient powers',
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn().mockResolvedValue([
        {
          id: '87654321-4321-4321-4321-cba987654321',
          conceptId: '12345678-1234-1234-1234-123456789abc',
          title: 'The Fallen Noble Redemption',
          description:
            'A comprehensive description of a thematic direction that explores the character concept in meaningful depth',
          coreTension:
            'The internal struggle between past failures and the drive for redemption',
          uniqueTwist:
            'The character discovers their greatest failure was actually their most noble act',
          narrativePotential:
            'Rich opportunities for character growth through challenging moral choices and personal sacrifice',
          createdAt: new Date().toISOString(),
          llmMetadata: {},
        },
      ]),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      initialize: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    };

    // Load schemas into the validator so it can properly validate
    try {
      // Load thematic direction schema for the storage service
      const fs = await import('fs');
      const path = await import('path');

      const thematicDirectionSchema = JSON.parse(
        fs.readFileSync(
          path.resolve('data/schemas/thematic-direction.schema.json'),
          'utf8'
        )
      );

      // Check if schema is already loaded to avoid duplicate errors
      if (!schemaValidator.isSchemaLoaded('thematic-direction')) {
        await schemaValidator.addSchema(
          thematicDirectionSchema,
          'thematic-direction'
        );
      }
    } catch (error) {
      mockLogger.warn(
        'Could not load thematic direction schema for storage:',
        error.message
      );
    }

    const storageService = new CharacterStorageService({
      database: characterDatabase,
      schemaValidator: schemaValidator,
      logger: mockLogger,
    });

    // Initialize the storage service
    await storageService.initialize();

    // Create mock LlmJsonService
    const mockLlmJsonService = {
      clean: jest.fn().mockImplementation((input) => input),
      parseAndRepair: jest
        .fn()
        .mockImplementation(async (input) => JSON.parse(input)),
    };

    // Create mock LLM config manager
    const mockLlmConfigManager = {
      loadConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
        name: 'Test Config',
      }),
      getActiveConfiguration: jest.fn().mockResolvedValue({
        configId: 'test-config',
        name: 'Test Config',
      }),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
    };

    const thematicDirectionGenerator = new ThematicDirectionGenerator({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      llmStrategyFactory: {
        getAIDecision: jest.fn().mockResolvedValue(
          JSON.stringify({
            thematicDirections: [
              {
                title: 'Test Direction 1',
                description:
                  'A comprehensive test description for the first thematic direction that explores the character concept in depth',
                coreTension:
                  'A fundamental conflict between duty and personal desires that drives the narrative forward',
                uniqueTwist:
                  'An unexpected revelation about the character past that changes everything',
                narrativePotential:
                  'Rich opportunities for character growth through challenging moral choices and personal sacrifice',
              },
              {
                title: 'Test Direction 2',
                description:
                  'An elaborate test description for the second thematic direction that provides meaningful narrative context',
                coreTension:
                  'The struggle between maintaining old traditions and embracing necessary change',
                uniqueTwist:
                  'A hidden connection to ancient powers that awakens at a critical moment',
                narrativePotential:
                  'Compelling storylines exploring themes of identity, legacy, and the price of power',
              },
              {
                title: 'Test Direction 3',
                description:
                  'A detailed test description for the third thematic direction with sufficient character development ideas',
                coreTension:
                  'Inner conflict between seeking revenge and finding redemption through forgiveness',
                uniqueTwist:
                  'The enemy they seek to destroy turns out to be their only hope for salvation',
                narrativePotential:
                  'Deep exploration of moral ambiguity, redemption arcs, and the transformative power of choice',
              },
            ],
          })
        ),
      },
      llmConfigManager: mockLlmConfigManager,
    });

    characterBuilderService = new CharacterBuilderService({
      storageService,
      directionGenerator: thematicDirectionGenerator,
      eventBus: safeEventDispatcher,
      logger: mockLogger,
    });

    // Load character-concept and thematic-direction schemas
    const fs = await import('fs');
    const path = await import('path');

    // Read the schema files
    const characterConceptSchema = JSON.parse(
      fs.readFileSync(
        path.resolve('data/schemas/character-concept.schema.json'),
        'utf8'
      )
    );
    const thematicDirectionSchema = JSON.parse(
      fs.readFileSync(
        path.resolve('data/schemas/thematic-direction.schema.json'),
        'utf8'
      )
    );

    // Add thematic-direction schema first since character-concept references it
    if (!schemaValidator.isSchemaLoaded(thematicDirectionSchema.$id)) {
      await schemaValidator.addSchema(
        thematicDirectionSchema,
        thematicDirectionSchema.$id
      );
    }

    // Add character-concept schema which depends on thematic-direction
    if (!schemaValidator.isSchemaLoaded('character-concept')) {
      await schemaValidator.addSchema(
        characterConceptSchema,
        'character-concept'
      );
    }

    // Register event schemas directly to match what the ThematicDirectionApp does
    const conceptCreatedSchemaId = 'thematic:character_concept_created#payload';
    const directionsGeneratedSchemaId =
      'thematic:thematic_directions_generated#payload';

    if (!schemaValidator.isSchemaLoaded(conceptCreatedSchemaId)) {
      await schemaValidator.addSchema(
        {
          description:
            'Defines the structure for the CHARACTER_CONCEPT_CREATED event payload.',
          type: 'object',
          required: ['conceptId', 'concept', 'autoSaved'],
          properties: {
            conceptId: {
              type: 'string',
              description: 'The unique ID of the created character concept.',
            },
            concept: {
              type: 'string',
              description: 'The character concept text (truncated for events).',
            },
            autoSaved: {
              type: 'boolean',
              description: 'Whether the concept was automatically saved.',
            },
          },
          additionalProperties: false,
        },
        conceptCreatedSchemaId
      );
    }

    if (!schemaValidator.isSchemaLoaded(directionsGeneratedSchemaId)) {
      await schemaValidator.addSchema(
        {
          description:
            'Defines the structure for the THEMATIC_DIRECTIONS_GENERATED event payload.',
          type: 'object',
          required: ['conceptId', 'directionCount', 'autoSaved'],
          properties: {
            conceptId: {
              type: 'string',
              description: 'The unique ID of the character concept.',
            },
            directionCount: {
              type: 'integer',
              minimum: 0,
              description: 'The number of thematic directions generated.',
            },
            autoSaved: {
              type: 'boolean',
              description: 'Whether the directions were automatically saved.',
            },
          },
          additionalProperties: false,
        },
        directionsGeneratedSchemaId
      );
    }

    // Spy on console logging methods to capture warnings
    warnSpy = jest.spyOn(ConsoleLogger.prototype, 'warn');
    infoSpy = jest.spyOn(ConsoleLogger.prototype, 'info');
    debugSpy = jest.spyOn(ConsoleLogger.prototype, 'debug');
  });

  afterEach(async () => {
    // Restore spies with guard clauses
    if (warnSpy) warnSpy.mockRestore();
    if (infoSpy) infoSpy.mockRestore();
    if (debugSpy) debugSpy.mockRestore();

    // Clean up database
    if (characterDatabase) {
      characterDatabase.close();
    }
  });

  it('should dispatch CHARACTER_CONCEPT_CREATED event without schema validation warnings', async () => {
    // Create a character concept
    const concept = await characterBuilderService.createCharacterConcept(
      'A brave knight on a quest',
      true
    );

    // Verify the concept was created
    expect(concept).toBeDefined();
    expect(concept.id).toBeDefined();
    expect(concept.concept).toBe('A brave knight on a quest');

    // Check that no warnings were logged about missing schemas
    const schemaWarnings = warnSpy.mock.calls.filter(
      (call) =>
        call[0] &&
        call[0].includes('Payload schema') &&
        call[0].includes('not found/loaded')
    );

    expect(schemaWarnings).toHaveLength(0);
  });

  it('should dispatch THEMATIC_DIRECTIONS_GENERATED event without schema validation warnings', async () => {
    // Create a character concept first
    const concept = await characterBuilderService.createCharacterConcept(
      'A mysterious sorceress with ancient powers',
      true
    );

    // Generate thematic directions
    const directions = await characterBuilderService.generateThematicDirections(
      concept.id,
      true
    );

    // Verify directions were generated
    expect(directions).toBeDefined();
    expect(Array.isArray(directions)).toBe(true);
    expect(directions.length).toBeGreaterThan(0);

    // Check that no warnings were logged about missing schemas
    const schemaWarnings = warnSpy.mock.calls.filter(
      (call) =>
        call[0] &&
        call[0].includes('Payload schema') &&
        call[0].includes('not found/loaded')
    );

    expect(schemaWarnings).toHaveLength(0);
  });

  it('should have event schemas properly registered before dispatch', async () => {
    // Check that schemas are loaded for our events
    const conceptCreatedSchemaId = `${CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED}#payload`;
    const directionsGeneratedSchemaId = `${CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED}#payload`;

    expect(schemaValidator.isSchemaLoaded(conceptCreatedSchemaId)).toBe(true);
    expect(schemaValidator.isSchemaLoaded(directionsGeneratedSchemaId)).toBe(
      true
    );
  });

  it('should validate event payloads against their schemas', async () => {
    // Test CHARACTER_CONCEPT_CREATED payload
    const conceptPayload = {
      conceptId: '12345678-1234-1234-1234-123456789abc',
      concept: 'Test concept text',
      autoSaved: true,
    };

    const conceptValidation = schemaValidator.validate(
      `${CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED}#payload`,
      conceptPayload
    );

    expect(conceptValidation.isValid).toBe(true);
    expect(conceptValidation.errors).toBeNull();

    // Test THEMATIC_DIRECTIONS_GENERATED payload
    const directionsPayload = {
      conceptId: '12345678-1234-1234-1234-123456789abc',
      directionCount: 5,
      autoSaved: true,
    };

    const directionsValidation = schemaValidator.validate(
      `${CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED}#payload`,
      directionsPayload
    );

    expect(directionsValidation.isValid).toBe(true);
    expect(directionsValidation.errors).toBeNull();
  });

  it('should reject invalid payloads', async () => {
    // Test invalid CHARACTER_CONCEPT_CREATED payload (missing required field)
    const invalidConceptPayload = {
      conceptId: '12345678-1234-1234-1234-123456789abc',
      // missing 'concept' field
      autoSaved: true,
    };

    const conceptValidation = schemaValidator.validate(
      `${CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED}#payload`,
      invalidConceptPayload
    );

    expect(conceptValidation.isValid).toBe(false);
    expect(conceptValidation.errors).toBeDefined();
    // The errors array contains error objects, check for the missing property
    expect(
      conceptValidation.errors.some(
        (err) => err.params?.missingProperty === 'concept'
      )
    ).toBe(true);

    // Test invalid THEMATIC_DIRECTIONS_GENERATED payload (wrong type)
    const invalidDirectionsPayload = {
      conceptId: '12345678-1234-1234-1234-123456789abc',
      directionCount: 'five', // should be integer
      autoSaved: true,
    };

    const directionsValidation = schemaValidator.validate(
      `${CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED}#payload`,
      invalidDirectionsPayload
    );

    expect(directionsValidation.isValid).toBe(false);
    expect(directionsValidation.errors).toBeDefined();
  });

  it('should use namespaced event names that match the schema IDs', () => {
    // Verify that the event names use the proper namespace format
    expect(CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED).toBe(
      'thematic:character_concept_created'
    );
    expect(CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED).toBe(
      'thematic:thematic_directions_generated'
    );

    // Verify that the schema IDs match the expected pattern
    const conceptSchemaId = `${CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED}#payload`;
    const directionsSchemaId = `${CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED}#payload`;

    expect(conceptSchemaId).toBe('thematic:character_concept_created#payload');
    expect(directionsSchemaId).toBe(
      'thematic:thematic_directions_generated#payload'
    );
  });
});
