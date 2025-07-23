/**
 * @file Integration tests for complete character concept save workflow
 * @description Tests the full flow from controller through service to storage
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import GameDataRepository from '../../../src/data/gameDataRepository.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';

describe('Character Concept Save - Integration', () => {
  let dom;
  let logger;
  let eventBus;
  let schemaValidator;
  let database;
  let storageService;
  let builderService;
  let eventsSeen;
  let savedConcepts;

  beforeEach(async () => {
    // Setup JSDOM
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;

    logger = new ConsoleLogger('error'); // Reduce noise in tests

    // Create mocked schema validator
    schemaValidator = {
      addSchema: jest.fn().mockResolvedValue(),
      validateAgainstSchema: jest.fn().mockReturnValue(true),
      formatAjvErrors: jest.fn().mockReturnValue(''),
    };

    // Setup event system with mock repository
    const rawEventBus = new EventBus({ logger });
    const mockRegistry = {
      getEventDefinition: () => null,
      getAllEventDefinitions: () => [],
      getWorldDefinition: () => null,
      getAllWorldDefinitions: () => [],
      getStartingPlayerId: () => 'player',
      getStartingLocationId: () => 'starting_location',
      getActionDefinition: () => null,
      getAllActionDefinitions: () => [],
      getEntityDefinition: () => null,
      getAllEntityDefinitions: () => [],
      getComponentDefinition: () => null,
      getAllComponentDefinitions: () => [],
      getConditionDefinition: () => null,
      getAllConditionDefinitions: () => [],
      getGoalDefinition: () => null,
      getAllGoalDefinitions: () => [],
      getEntityInstanceDefinition: () => null,
      getAllEntityInstanceDefinitions: () => [],
      get: () => undefined,
      getAll: () => ({}),
      clear: () => {},
      store: () => {},
    };

    const gameDataRepository = new GameDataRepository(mockRegistry, logger);
    const validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus: rawEventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    eventBus = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    // Track events
    eventsSeen = [];
    eventBus.subscribe = jest.fn((eventName, callback) => {
      eventsSeen.push({ event: eventName, callback });
    });

    // Create mocked database
    database = {
      initialize: jest.fn().mockResolvedValue(),
      saveCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      close: jest.fn().mockResolvedValue(),
    };

    storageService = new CharacterStorageService({
      logger,
      database,
      schemaValidator,
    });

    // Mock direction generator
    const mockDirectionGenerator = {
      generateDirections: jest.fn().mockImplementation((conceptId) => {
        return Promise.resolve([
          {
            id: 'dir-1',
            conceptId: conceptId,
            theme: 'Adventure',
            description: 'Epic journey into the unknown',
          },
        ]);
      }),
    };

    builderService = new CharacterBuilderService({
      logger,
      storageService,
      directionGenerator: mockDirectionGenerator,
      eventBus,
    });

    // Setup default mock behaviors
    savedConcepts = new Map(); // Store concepts in memory for getCharacterConcept

    database.saveCharacterConcept.mockImplementation((concept) => {
      const savedConcept = {
        ...concept,
        id: concept.id || `concept-${Date.now()}`,
      };
      savedConcepts.set(savedConcept.id, savedConcept);
      return Promise.resolve(savedConcept);
    });

    database.getCharacterConcept.mockImplementation((id) => {
      const concept = savedConcepts.get(id);
      return concept
        ? Promise.resolve(concept)
        : Promise.reject(new Error(`Character concept not found: ${id}`));
    });

    database.saveThematicDirections.mockImplementation((directions) => {
      return Promise.resolve(directions);
    });

    // Initialize services
    await storageService.initialize();
    await builderService.initialize();
  });

  afterEach(() => {
    if (dom) {
      dom.window.close();
    }
    jest.clearAllMocks();
  });

  describe('complete save workflow', () => {
    it('should successfully save a valid character concept', async () => {
      // Arrange
      const concept =
        'A brave warrior seeking redemption in the ancient lands of Valdor';

      // Spy on event dispatch to verify correct format
      const dispatchSpy = jest.spyOn(eventBus, 'dispatch');

      // Act
      const result = await builderService.createCharacterConcept(concept, {
        autoSave: true,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-fA-F-]{36}$/); // UUID format
      expect(result.concept).toBe(concept);
      expect(result.status).toBe('draft');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      // Verify event was dispatched correctly (not as object)
      expect(dispatchSpy).toHaveBeenCalledWith(
        'CHARACTER_CONCEPT_CREATED',
        expect.objectContaining({
          conceptId: result.id,
          concept: concept,
          autoSaved: true,
        })
      );

      // Verify it was NOT called with object format
      expect(dispatchSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          payload: expect.any(Object),
        })
      );
    });

    it('should fail validation for invalid concept', async () => {
      // Arrange
      const shortConcept = 'Too short'; // Less than 10 characters

      // Act & Assert
      await expect(
        builderService.createCharacterConcept(shortConcept, { autoSave: true })
      ).rejects.toThrow(/concept must be at least 10 characters long/);
    });

    it('should handle schema validation correctly with simplified IDs', async () => {
      // Arrange
      const validConcept = 'A mysterious mage with powers beyond comprehension';

      // Spy on the validator to ensure correct schema ID is used
      const validateSpy = jest.spyOn(schemaValidator, 'validateAgainstSchema');

      // Act
      await builderService.createCharacterConcept(validConcept, {
        autoSave: true,
      });

      // Assert
      expect(validateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: validConcept,
        }),
        'character-concept' // Should use simplified ID
      );

      // Should NOT use full URI
      expect(validateSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('schema://')
      );
    });

    it('should handle database storage with retries', async () => {
      // Arrange
      const concept =
        'A character that will test retry logic through temporary failures';

      // Mock database to fail first few times, then succeed
      let callCount = 0;
      database.saveCharacterConcept.mockImplementation(async (data) => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary database error');
        }
        const savedConcept = {
          ...data,
          id: data.id || `concept-${Date.now()}`,
        };
        savedConcepts.set(savedConcept.id, savedConcept);
        return Promise.resolve(savedConcept);
      });

      // Act
      const result = await builderService.createCharacterConcept(concept);

      // Assert
      expect(result).toBeDefined();
      expect(result.concept).toBe(concept);
      expect(database.saveCharacterConcept).toHaveBeenCalledTimes(2); // Retry logic worked
    });

    it('should dispatch error events with correct format when save fails', async () => {
      // Arrange
      const concept = 'A character that will fail to save permanently';

      // Mock database to always fail
      jest
        .spyOn(database, 'saveCharacterConcept')
        .mockRejectedValue(new Error('Permanent database failure'));

      const dispatchSpy = jest.spyOn(eventBus, 'dispatch');

      // Act & Assert
      await expect(
        builderService.createCharacterConcept(concept, { autoSave: true })
      ).rejects.toThrow(/Failed to create character concept/);

      // Verify error event dispatched correctly
      expect(dispatchSpy).toHaveBeenCalledWith(
        'CHARACTER_BUILDER_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.stringContaining('Failed to create character concept'),
          operation: 'createCharacterConcept',
          concept: concept,
          attempts: 3,
        })
      );
    });

    it('should handle complete workflow including thematic directions', async () => {
      // Arrange
      const concept =
        'A noble paladin on a quest to restore peace to the realm';

      // Act - Create concept and generate directions
      const createdConcept =
        await builderService.createCharacterConcept(concept);
      const directions = await builderService.generateThematicDirections(
        createdConcept.id
      );

      // Assert
      expect(createdConcept).toBeDefined();
      expect(directions).toHaveLength(1);
      expect(directions[0]).toMatchObject({
        id: 'dir-1',
        conceptId: createdConcept.id,
        theme: 'Adventure',
        description: 'Epic journey into the unknown',
      });
    });
  });

  describe('event system integration', () => {
    it('should use correct event dispatcher chain', async () => {
      // This test ensures our event dispatcher chain works as expected
      // SafeEventDispatcher -> ValidatedEventDispatcher -> EventBus

      const concept = 'Testing event dispatcher chain integration';
      const dispatchSpy = jest.spyOn(eventBus, 'dispatch');

      await builderService.createCharacterConcept(concept);

      // Event should be dispatched through the chain
      expect(dispatchSpy).toHaveBeenCalled();

      // Should be called with correct signature: dispatch(eventName, payload)
      const [eventName, payload] = dispatchSpy.mock.calls[0];
      expect(typeof eventName).toBe('string');
      expect(typeof payload).toBe('object');
      expect(eventName).toBe('CHARACTER_CONCEPT_CREATED');
    });
  });
});
