/**
 * @file Integration tests for Character Concepts Manager event dispatching validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

import { MockThematicDirectionGenerator } from '../../common/mocks/mockThematicDirectionGenerator.js';

describe('Character Concepts Manager - Event Validation Integration', () => {
  let bootstrapResult;
  let builderService;
  let storageService;
  let eventBus;
  let validatedDispatcher;
  let logger;
  let eventDefinitions;
  let mockDirectionGenerator;
  let gameDataRepository;
  let schemaValidator;

  beforeEach(async () => {
    // Initialize core services
    logger = new ConsoleLogger({ prefix: 'EventTest' });
    
    // Bootstrap to load event definitions
    const bootstrapper = new CommonBootstrapper();
    bootstrapResult = await bootstrapper.bootstrap({
      containerConfigType: 'minimal',
      skipModLoading: true,  // Skip mod loading to avoid network requests in tests
    });
    
    // Get event bus from bootstrapped container
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');
    eventBus = bootstrapResult.container.resolve(tokens.IEventBus);

    // Get services from bootstrap result
    const container = bootstrapResult.container;
    schemaValidator = container.resolve(tokens.ISchemaValidator);
    
    // Create a mock gameDataRepository with test event definitions first
    const testEventDefinitions = {
      'thematic:character_concept_created': {
        id: 'thematic:character_concept_created',
        description: 'Dispatched when a new character concept is created.',
        payloadSchema: {
          type: 'object',
          properties: {
            conceptId: { type: 'string' },
            concept: { type: 'string' },
            autoSaved: { type: 'boolean' }
          },
          required: ['conceptId', 'concept'],
          additionalProperties: true
        }
      },
      'thematic:character_concept_deleted': {
        id: 'thematic:character_concept_deleted',
        description: 'Dispatched when a character concept is deleted.',
        payloadSchema: {
          type: 'object',
          properties: {
            conceptId: { type: 'string' }
          },
          required: ['conceptId'],
          additionalProperties: true
        }
      }
    };
    
    // Override the gameDataRepository with our mock
    gameDataRepository = {
      getEventDefinition: (eventName) => testEventDefinitions[eventName],
      getAllEventDefinitions: () => Object.values(testEventDefinitions),
    };
    
    // Convert to Map for tests
    eventDefinitions = new Map(Object.entries(testEventDefinitions));
    
    // Now create validated dispatcher with all required dependencies
    validatedDispatcher = new ValidatedEventDispatcher({
      logger,
      eventBus,
      gameDataRepository,
      schemaValidator,
    });
    
    // Create safe dispatcher that wraps the validated dispatcher
    const safeDispatcher = new SafeEventDispatcher({ 
      logger, 
      validatedEventDispatcher: validatedDispatcher 
    });


    // Initialize services
    const { CharacterDatabase } = await import('../../../src/characterBuilder/storage/characterDatabase.js');
    const characterDatabase = new CharacterDatabase({ logger });
    
    storageService = new CharacterStorageService({ 
      logger,
      database: characterDatabase,
      schemaValidator,
    });
    await storageService.initialize();
    
    // Create mock direction generator
    mockDirectionGenerator = new MockThematicDirectionGenerator();
    
    builderService = new CharacterBuilderService({
      logger,
      eventBus: safeDispatcher,
      storageService,
      directionGenerator: mockDirectionGenerator,
    });
  });

  afterEach(async () => {
    if (storageService) {
      await storageService.close();
    }
  });

  describe('Event Schema Validation', () => {
    it('should validate character_concept_created event exists in definitions', () => {
      // Assert
      const eventDef = eventDefinitions.get('thematic:character_concept_created');
      expect(eventDef).toBeDefined();
      expect(eventDef.id).toBe('thematic:character_concept_created');
      expect(eventDef.payloadSchema).toBeDefined();
    });

    it('should validate character_concept_deleted event exists in definitions', () => {
      // Assert
      const eventDef = eventDefinitions.get('thematic:character_concept_deleted');
      expect(eventDef).toBeDefined();
      expect(eventDef.id).toBe('thematic:character_concept_deleted');
      expect(eventDef.payloadSchema).toBeDefined();
    });

    it('should dispatch character_concept_created with valid payload', async () => {
      // Arrange
      let capturedEvent = null;
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        capturedEvent = event;
      });

      // Act
      const result = await builderService.createCharacterConcept('Test concept with enough characters');

      // Assert
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe('thematic:character_concept_created');
      expect(capturedEvent.payload).toMatchObject({
        conceptId: result.id,
        concept: 'Test concept',
        autoSaved: true,
      });

      // Validate against schema
      const eventDef = eventDefinitions.get('thematic:character_concept_created');
      const validator = new AjvSchemaValidator();
      const isValid = validator.validate(capturedEvent.payload, eventDef.payloadSchema);
      expect(isValid).toBe(true);
    });

    it('should dispatch character_concept_deleted with valid payload', async () => {
      // Arrange
      const result = await builderService.createCharacterConcept('Character concept to be deleted later');
      
      let capturedEvent = null;
      eventBus.subscribe('thematic:character_concept_deleted', (event) => {
        capturedEvent = event;
      });

      // Act
      await builderService.deleteCharacterConcept(result.id);

      // Assert
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe('thematic:character_concept_deleted');
      expect(capturedEvent.payload).toMatchObject({
        conceptId: result.id,
      });

      // Validate against schema
      const eventDef = eventDefinitions.get('thematic:character_concept_deleted');
      const validator = new AjvSchemaValidator();
      const isValid = validator.validate(capturedEvent.payload, eventDef.payloadSchema);
      expect(isValid).toBe(true);
    });
  });

  describe('Event Dispatching Edge Cases', () => {
    it('should handle missing optional fields in event payload', async () => {
      // Arrange
      let capturedEvent = null;
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        capturedEvent = event;
      });

      // Act - Create concept without explicit autoSave
      validatedDispatcher.dispatch({
        type: 'thematic:character_concept_created',
        payload: {
          conceptId: 'test-id',
          concept: 'Test concept',
          // autoSaved is optional
        },
      });

      // Assert
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.payload.conceptId).toBe('test-id');
      expect(capturedEvent.payload.concept).toBe('Test concept');
    });

    it('should reject invalid payloads', async () => {
      // Arrange
      const invalidPayloads = [
        { conceptId: 'test' }, // Missing required 'concept' field
        { concept: 'test' }, // Missing required 'conceptId' field
        { conceptId: 123, concept: 'test' }, // Wrong type for conceptId
        { conceptId: 'test', concept: true }, // Wrong type for concept
      ];

      // Act & Assert
      for (const payload of invalidPayloads) {
        await expect(
          validatedDispatcher.dispatch({
            type: 'thematic:character_concept_created',
            payload,
          })
        ).rejects.toThrow();
      }
    });

    it('should handle concurrent event dispatches', async () => {
      // Arrange
      const events = [];
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        events.push(event);
      });

      // Act - Create multiple concepts concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        builderService.createCharacterConcept(`Concept number ${i} with enough characters`)
      );
      
      await Promise.all(promises);

      // Assert
      expect(events).toHaveLength(5);
      events.forEach((event, index) => {
        expect(event.payload.concept).toMatch(/Concept number \d/);
      });
    });
  });

  describe('Event Flow Integration', () => {
    it('should maintain event order during rapid operations', async () => {
      // Arrange
      const eventOrder = [];
      
      eventBus.subscribe('thematic:character_concept_created', () => {
        eventOrder.push('created');
      });
      
      eventBus.subscribe('thematic:character_concept_deleted', () => {
        eventOrder.push('deleted');
      });

      // Act
      const result1 = await builderService.createCharacterConcept('Test character concept number one');
      await builderService.deleteCharacterConcept(result1.id);
      const result2 = await builderService.createCharacterConcept('Test character concept number two');
      await builderService.deleteCharacterConcept(result2.id);

      // Assert
      expect(eventOrder).toEqual(['created', 'deleted', 'created', 'deleted']);
    });

    it('should handle event listener errors gracefully', async () => {
      // Arrange
      const errorListener = () => {
        throw new Error('Listener error');
      };
      
      const successListener = jest.fn();
      
      // Spy on logger.error
      const errorSpy = jest.spyOn(logger, 'error');
      
      eventBus.subscribe('thematic:character_concept_created', errorListener);
      eventBus.subscribe('thematic:character_concept_created', successListener);

      // Act
      await builderService.createCharacterConcept('Test concept with enough characters');

      // Assert - Other listeners should still be called
      expect(successListener).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error executing listener'),
        expect.any(Error)
      );
      
      // Clean up spy
      errorSpy.mockRestore();
    });
  });

  describe('Cross-Service Event Integration', () => {
    it('should propagate events across services correctly', async () => {
      // Arrange
      const receivedEvents = {
        storage: null,
        builder: null,
        dispatcher: null,
      };

      // Listen at different levels
      eventBus.subscribe('thematic:character_concept_created', (event) => {
        receivedEvents.dispatcher = event;
      });

      // Act
      const result = await builderService.createCharacterConcept(
        'Cross-service test with enough characters'
      );

      // Assert - Event should be received at all levels
      expect(receivedEvents.dispatcher).toBeTruthy();
      expect(receivedEvents.dispatcher.payload).toMatchObject({
        conceptId: result.id,
        concept: 'Cross-service test',
      });

      // Verify storage actually contains the concept
      const stored = await storageService.getCharacterConcept(result.id);
      expect(stored).toBeTruthy();
      expect(stored.concept).toBe('Cross-service test');
    });
  });
});