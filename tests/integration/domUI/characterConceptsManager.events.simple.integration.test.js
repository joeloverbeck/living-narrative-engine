/**
 * @file Simplified integration tests for Character Concepts Manager event dispatching
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import { MockThematicDirectionGenerator } from '../../common/mocks/mockThematicDirectionGenerator.js';
import { testEventDefinitions } from '../../common/testEventDefinitions.js';

describe('Character Concepts Manager - Simplified Event Integration', () => {
  let builderService;
  let storageService;
  let eventBus;
  let validatedDispatcher;
  let safeDispatcher;
  let logger;
  let mockDirectionGenerator;

  beforeEach(async () => {
    // Initialize core services
    logger = new ConsoleLogger({ prefix: 'EventTest' });
    eventBus = new EventBus({ logger });
    
    // Create a mock game data repository that returns our test event definitions
    const mockGameDataRepository = {
      getEventDefinition: (eventName) => testEventDefinitions[eventName],
      getAllEventDefinitions: () => Object.values(testEventDefinitions),
    };
    
    // Create schema validator
    const schemaValidator = new AjvSchemaValidator({ logger });
    
    // Create validated dispatcher with mock dependencies
    validatedDispatcher = new ValidatedEventDispatcher({
      logger,
      eventBus,
      gameDataRepository: mockGameDataRepository,
      schemaValidator,
    });
    
    // Create safe dispatcher that wraps the validated dispatcher
    safeDispatcher = new SafeEventDispatcher({ 
      logger, 
      validatedEventDispatcher: validatedDispatcher 
    });

    // Initialize services
    storageService = new CharacterStorageService({ logger });
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
    if (storageService?.database) {
      await storageService.clearAllData();
    }
  });

  describe('Event Dispatching', () => {
    it('should dispatch character_concept_created event when creating a concept', async () => {
      // Arrange
      let capturedEvent = null;
      eventBus.on('thematic:character_concept_created', (event) => {
        capturedEvent = event;
      });

      // Act
      const result = await builderService.createCharacterConcept('Test concept');

      // Assert
      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent.type).toBe('thematic:character_concept_created');
      expect(capturedEvent.payload).toMatchObject({
        conceptId: result.id,
        concept: 'Test concept',
        autoSaved: true,
      });
    });

    it('should dispatch character_concept_deleted event when deleting a concept', async () => {
      // Arrange
      const result = await builderService.createCharacterConcept('To delete');
      
      let capturedEvent = null;
      eventBus.on('thematic:character_concept_deleted', (event) => {
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
    });

    it('should validate event payloads against schemas', async () => {
      // Arrange
      const invalidPayloads = [
        { conceptId: 'test' }, // Missing required 'concept' field
        { concept: 'test' }, // Missing required 'conceptId' field
      ];

      // Act & Assert
      invalidPayloads.forEach((payload) => {
        expect(() => {
          validatedDispatcher.dispatch('thematic:character_concept_created', payload);
        }).rejects.toThrow();
      });
    });

    it('should handle concurrent event dispatches', async () => {
      // Arrange
      const events = [];
      eventBus.on('thematic:character_concept_created', (event) => {
        events.push(event);
      });

      // Act - Create multiple concepts concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        builderService.createCharacterConcept(`Concept ${i}`)
      );
      
      await Promise.all(promises);

      // Assert
      expect(events).toHaveLength(5);
      events.forEach((event) => {
        expect(event.payload.concept).toMatch(/Concept \d/);
      });
    });
  });
});