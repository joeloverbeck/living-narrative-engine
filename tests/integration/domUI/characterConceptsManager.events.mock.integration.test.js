/**
 * @file Integration tests for Character Concepts Manager event validation with mocked storage
 */

import {
  describe,
  it,
  expect,
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
  let bootstrapResult;
  let eventBus;
  let validatedDispatcher;
  let logger;
  let builderService;
  let mockStorageService;
  let mockDirectionGenerator;

  beforeEach(async () => {
    // Initialize core services
    logger = new ConsoleLogger({ prefix: 'EventTest' });

    // Bootstrap to get container
    const bootstrapper = new CommonBootstrapper();
    bootstrapResult = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      skipModLoading: true,
    });

    // Get event bus from bootstrapped container
    const { tokens } = await import(
      '../../../src/dependencyInjection/tokens.js'
    );
    eventBus = bootstrapResult.container.resolve(tokens.IEventBus);

    // Get services from bootstrap result
    const container = bootstrapResult.container;
    const schemaValidator = container.resolve(tokens.ISchemaValidator);

    // Create a mock gameDataRepository with test event definitions
    const testEventDefinitions = {
      'thematic:character_concept_created': {
        id: 'thematic:character_concept_created',
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
      'thematic:character_concept_deleted': {
        id: 'thematic:character_concept_deleted',
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

    // Load the schemas into the schema validator with the expected IDs
    for (const [eventName, definition] of Object.entries(
      testEventDefinitions
    )) {
      if (definition.payloadSchema) {
        const schemaId = `${eventName}#payload`;
        await schemaValidator.addSchema(definition.payloadSchema, schemaId);
      }
    }

    // Create validated dispatcher with all required dependencies
    validatedDispatcher = new ValidatedEventDispatcher({
      logger,
      eventBus,
      gameDataRepository,
      schemaValidator,
    });

    // Create safe dispatcher that wraps the validated dispatcher
    const safeDispatcher = new SafeEventDispatcher({
      logger,
      validatedEventDispatcher: validatedDispatcher,
    });

    // Create mock storage service
    const storedConcepts = new Map();
    const storedDirections = new Map();
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

    // Create mock direction generator
    mockDirectionGenerator = new MockThematicDirectionGenerator();

    // Initialize builder service
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
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        capturedEvent = event;
      });

      // Act
      const result = await builderService.createCharacterConcept(
        'Test concept with enough characters'
      );

      // Wait for event propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe('thematic:character_concept_created');
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
      eventBus.subscribe('thematic:character_concept_deleted', (event) => {
        capturedEvent = event;
      });

      // Act
      await builderService.deleteCharacterConcept(result.id);

      // Wait for event propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe('thematic:character_concept_deleted');
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
          'thematic:character_concept_created',
          payload
        );
        expect(result).toBe(false); // Should return false for invalid payloads
      }

      // Valid payload should return true
      const validResult = await validatedDispatcher.dispatch(
        'thematic:character_concept_created',
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
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        events.push(event);
      });

      // Act - Create multiple concepts concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        builderService.createCharacterConcept(
          `Concept number ${i} with enough characters`
        )
      );

      await Promise.all(promises);

      // Wait for all events to propagate
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Assert
      expect(events).toHaveLength(5);
      events.forEach((event) => {
        expect(event.payload.concept).toMatch(/Concept number \d/);
      });
    });
  });

  describe('Event Flow Integration', () => {
    it('should propagate events through the dispatcher hierarchy', async () => {
      // Arrange
      let dispatcherEvent = null;
      let busEvent = null;

      // Listen at bus level
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        busEvent = event;
      });

      // Also check that dispatcher validates before forwarding
      const dispatchSpy = jest.spyOn(validatedDispatcher, 'dispatch');

      // Act
      const result = await builderService.createCharacterConcept(
        'Cross-service test with enough characters'
      );

      // Wait for event propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - Event should be received and validated
      expect(busEvent).toBeTruthy();
      expect(busEvent.payload).toMatchObject({
        conceptId: result.id,
        concept: 'Cross-service test with enough characters',
      });

      // Verify dispatcher was called
      expect(dispatchSpy).toHaveBeenCalledWith(
        'thematic:character_concept_created',
        expect.objectContaining({
          conceptId: result.id,
          concept: 'Cross-service test with enough characters',
        }),
        {} // The third parameter is the options object
      );
    });
  });
});
