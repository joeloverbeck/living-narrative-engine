/**
 * @file Integration tests for Character Concepts Manager event validation with mocked storage
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { CharacterConceptsManagerController } from '../../../src/domUI/characterConceptsManagerController.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import { MockThematicDirectionGenerator } from '../../common/mocks/mockThematicDirectionGenerator.js';

describe('Character Concepts Manager - Event Validation with Mocked Storage', () => {
  // Shared infrastructure (initialized once in beforeAll)
  let sharedContainer;
  let sharedEventBus;
  let sharedSchemaValidator;
  let tokens;

  // Per-test instances (recreated in beforeEach for test isolation)
  let logger;
  let validatedDispatcher;
  let builderService;
  let mockStorageService;
  let mockDirectionGenerator;
  let storedConcepts;
  let storedDirections;

  // Test event definitions (reusable configuration)
  const testEventDefinitions = {
    'core:character_concept_created': {
      id: 'core:character_concept_created',
      description: 'Dispatched when a new character concept is created.',
      payloadSchema: {
        type: 'object',
        properties: {
          conceptId: { type: 'string' },
          concept: { type: 'string' },
          autoSaved: { type: 'boolean' },
        },
        required: ['conceptId', 'concept'],
        additionalProperties: true,
      },
    },
    'core:character_concept_deleted': {
      id: 'core:character_concept_deleted',
      description: 'Dispatched when a character concept is deleted.',
      payloadSchema: {
        type: 'object',
        properties: {
          conceptId: { type: 'string' },
        },
        required: ['conceptId'],
        additionalProperties: true,
      },
    },
  };

  const gameDataRepository = {
    getEventDefinition: (eventName) => testEventDefinitions[eventName],
    getAllEventDefinitions: () => Object.values(testEventDefinitions),
  };

  beforeAll(async () => {
    // Bootstrap once for all tests - this is the expensive operation
    const bootstrapper = new CommonBootstrapper();
    const bootstrapResult = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      skipModLoading: true,
    });

    // Import tokens once
    const tokensModule = await import(
      '../../../src/dependencyInjection/tokens.js'
    );
    tokens = tokensModule.tokens;

    // Get shared infrastructure from bootstrapped container
    sharedContainer = bootstrapResult.container;
    sharedEventBus = sharedContainer.resolve(tokens.IEventBus);
    sharedSchemaValidator = sharedContainer.resolve(tokens.ISchemaValidator);

    // Load the schemas into the schema validator once (they persist across tests)
    for (const [eventName, definition] of Object.entries(
      testEventDefinitions
    )) {
      if (definition.payloadSchema) {
        const schemaId = `${eventName}#payload`;
        await sharedSchemaValidator.addSchema(definition.payloadSchema, schemaId);
      }
    }
  });

  beforeEach(() => {
    // Create fresh instances for each test to ensure isolation
    logger = new ConsoleLogger({ prefix: 'EventTest' });

    // Reset storage state
    storedConcepts = new Map();
    storedDirections = new Map();

    // Create fresh mock storage service
    mockStorageService = {
      initialize: jest.fn(async () => {}),
      storeCharacterConcept: jest.fn(async (concept) => {
        storedConcepts.set(concept.id, concept);
        return concept;
      }),
      deleteCharacterConcept: jest.fn(async (conceptId) => {
        return storedConcepts.delete(conceptId);
      }),
      getCharacterConcept: jest.fn(async (conceptId) => {
        return storedConcepts.get(conceptId) || null;
      }),
      listCharacterConcepts: jest.fn(async () => {
        return Array.from(storedConcepts.values());
      }),
      getAllCharacterConcepts: jest.fn(async () => {
        return Array.from(storedConcepts.values());
      }),
      storeThematicDirections: jest.fn(async (conceptId, directions) => {
        storedDirections.set(conceptId, directions);
        return directions;
      }),
      getThematicDirections: jest.fn(async (conceptId) => {
        return storedDirections.get(conceptId) || [];
      }),
      close: jest.fn(),
    };

    // Create fresh validated dispatcher with shared infrastructure
    validatedDispatcher = new ValidatedEventDispatcher({
      logger,
      eventBus: sharedEventBus,
      gameDataRepository,
      schemaValidator: sharedSchemaValidator,
    });

    // Create safe dispatcher that wraps the validated dispatcher
    const safeDispatcher = new SafeEventDispatcher({
      logger,
      validatedEventDispatcher: validatedDispatcher,
    });

    // Create fresh mock direction generator
    mockDirectionGenerator = new MockThematicDirectionGenerator();

    // Initialize builder service with fresh mocks
    builderService = new CharacterBuilderService({
      logger,
      eventBus: safeDispatcher,
      storageService: mockStorageService,
      directionGenerator: mockDirectionGenerator,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Dispatching', () => {
    it('should dispatch character_concept_created event when creating a concept', async () => {
      // Arrange
      let capturedEvent = null;
      sharedEventBus.subscribe('core:character_concept_created', (event) => {
        capturedEvent = event;
      });

      // Act
      const result = await builderService.createCharacterConcept(
        'Test concept with enough characters'
      );

      // Assert - Event is captured synchronously during the await above
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe('core:character_concept_created');
      expect(capturedEvent.payload).toMatchObject({
        conceptId: result.id,
        concept: 'Test concept with enough characters',
        autoSaved: true,
      });
    });

    it('should dispatch character_concept_deleted event when deleting a concept', async () => {
      // Arrange
      const result = await builderService.createCharacterConcept(
        'Character concept to be deleted later'
      );

      let capturedEvent = null;
      sharedEventBus.subscribe('core:character_concept_deleted', (event) => {
        capturedEvent = event;
      });

      // Act
      await builderService.deleteCharacterConcept(result.id);

      // Assert - Event is captured synchronously during the await above
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe('core:character_concept_deleted');
      expect(capturedEvent.payload).toMatchObject({
        conceptId: result.id,
      });
    });

    it('should validate event payloads against schemas', async () => {
      // Arrange
      const invalidPayloads = [
        { conceptId: 'test' }, // Missing required 'concept' field
        { concept: 'test' }, // Missing required 'conceptId' field
      ];

      // Act & Assert
      for (const payload of invalidPayloads) {
        const result = await validatedDispatcher.dispatch(
          'core:character_concept_created',
          payload
        );
        expect(result).toBe(false); // Should return false for invalid payloads
      }

      // Valid payload should return true
      const validResult = await validatedDispatcher.dispatch(
        'core:character_concept_created',
        {
          conceptId: 'test-id',
          concept: 'Valid concept text',
        }
      );
      expect(validResult).toBe(true);
    });

    it('should handle concurrent event dispatches', async () => {
      // Arrange
      const events = [];
      sharedEventBus.subscribe('core:character_concept_created', (event) => {
        events.push(event);
      });

      // Enable batch mode to increase recursion limits for concurrent operations
      // This prevents the global recursion limit from blocking events
      sharedEventBus.setBatchMode(true, {
        context: 'concurrent-event-test',
        maxGlobalRecursion: 30, // Increase from default 10 to handle 5 concurrent events
        maxRecursionDepth: 10,
      });

      try {
        // Act - Create multiple concepts concurrently
        const promises = Array.from({ length: 5 }, (_, i) =>
          builderService.createCharacterConcept(
            `Concept number ${i} with enough characters`
          )
        );

        await Promise.all(promises);

        // Assert - Events are captured synchronously during the await above
        expect(events).toHaveLength(5);
        events.forEach((event) => {
          expect(event.payload.concept).toMatch(/Concept number \d/);
        });
      } finally {
        // Always disable batch mode after test to restore normal operation
        sharedEventBus.setBatchMode(false);
      }
    });
  });

  describe('Event Flow Integration', () => {
    it('should propagate events through the dispatcher hierarchy', async () => {
      // Arrange
      let dispatcherEvent = null;
      let busEvent = null;

      // Listen at bus level
      sharedEventBus.subscribe('core:character_concept_created', (event) => {
        busEvent = event;
      });

      // Also check that dispatcher validates before forwarding
      const dispatchSpy = jest.spyOn(validatedDispatcher, 'dispatch');

      // Act
      const result = await builderService.createCharacterConcept(
        'Cross-service test with enough characters'
      );

      // Assert - Event is captured synchronously during the await above
      expect(busEvent).toBeTruthy();
      expect(busEvent.payload).toMatchObject({
        conceptId: result.id,
        concept: 'Cross-service test with enough characters',
      });

      // Verify dispatcher was called
      expect(dispatchSpy).toHaveBeenCalledWith(
        'core:character_concept_created',
        expect.objectContaining({
          conceptId: result.id,
          concept: 'Cross-service test with enough characters',
        }),
        {} // The third parameter is the options object
      );
    });
  });
});
