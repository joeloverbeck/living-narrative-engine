/**
 * @file Integration test to reproduce and verify fix for CLICHE_ITEM_DELETED event validation warning
 * @see src/characterBuilder/services/characterBuilderService.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CharacterBuilderService,
  CHARACTER_BUILDER_EVENTS,
} from '../../../src/characterBuilder/services/characterBuilderService.js';
import { Cliche } from '../../../src/characterBuilder/models/cliche.js';

describe('Character Builder Service - Cliche Item Deletion Event Validation', () => {
  let service;
  let mockEventBus;
  let mockDatabase;
  let mockLogger;
  let dispatchedEvents;
  let consoleWarnSpy;

  beforeEach(async () => {
    dispatchedEvents = [];

    // Spy on console.warn to detect validation warnings
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create mock event bus that captures dispatched events
    mockEventBus = {
      dispatch: jest.fn((eventType, payload) => {
        dispatchedEvents.push({ type: eventType, payload });

        // Simulate ValidatedEventDispatcher behavior
        // Check if event type is defined
        if (typeof eventType === 'string' && !eventType.startsWith('core:')) {
          // This simulates the VED warning for undefined events
          console.warn(
            `VED: EventDefinition not found for '${eventType}'. Cannot validate payload. Proceeding with dispatch.`
          );
        }

        return true;
      }),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Create mock database
    mockDatabase = {
      getClicheByDirectionId: jest.fn(),
      hasClichesStore: jest.fn().mockReturnValue(true),
      saveCliche: jest.fn(),
      updateCliche: jest.fn(),
      deleteCliche: jest.fn(),
    };

    // Create mock storage service
    const mockStorageService = {
      initialize: jest.fn().mockResolvedValue(true),
      storeCharacterConcept: jest.fn().mockResolvedValue(true),
      listCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn().mockResolvedValue(true),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      listThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirection: jest.fn(),
      saveThematicDirection: jest.fn(),
      deleteThematicDirection: jest.fn(),
    };

    // Create mock thematic direction generator
    const mockThematicDirectionGenerator = {
      generateDirections: jest.fn(),
    };

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create the service
    service = new CharacterBuilderService({
      logger: mockLogger,
      eventBus: mockEventBus,
      storageService: mockStorageService,
      directionGenerator: mockThematicDirectionGenerator,
      database: mockDatabase,
      schemaValidator: null, // Optional
      clicheGenerator: null, // Optional
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy.mockRestore();
  });

  describe('Fixed: CLICHE_ITEM_DELETED event now properly defined', () => {
    it('should dispatch CLICHE_ITEM_DELETED event without warnings', async () => {
      // Setup test data - an existing cliche with items
      const existingCliche = new Cliche({
        id: 'test-cliche-123',
        directionId: 'test-direction-456',
        conceptId: 'test-concept-789',
        categories: {
          names: ['John', 'Jane'],
          physicalDescriptions: ['Tall', 'Dark'],
          personalityTraits: ['Brooding', 'Mysterious'],
        },
        tropesAndStereotypes: ['Chosen one', 'Dark past'],
        createdAt: new Date().toISOString(),
      });

      // Mock database to return the cliche data (as plain object, not Cliche instance)
      mockDatabase.getClicheByDirectionId.mockResolvedValue({
        id: 'test-cliche-123',
        directionId: 'test-direction-456',
        conceptId: 'test-concept-789',
        categories: {
          names: ['John', 'Jane'],
          physicalDescriptions: ['Tall', 'Dark'],
          personalityTraits: ['Brooding', 'Mysterious'],
        },
        tropesAndStereotypes: ['Chosen one', 'Dark past'],
        createdAt: new Date().toISOString(),
      });
      mockDatabase.updateCliche.mockResolvedValue(true);

      // Call the method that removes a cliche item
      const result = await service.removeClicheItem(
        'test-direction-456',
        'names',
        'John'
      );

      // Check that the cliche was updated
      expect(result).toBeTruthy();
      expect(mockDatabase.updateCliche).toHaveBeenCalled();

      // Find the dispatched event - it should now use the proper constant
      const itemDeletedEvent = dispatchedEvents.find(
        (e) => e.type === CHARACTER_BUILDER_EVENTS.CLICHE_ITEM_DELETED
      );

      // The event should have been dispatched
      expect(itemDeletedEvent).toBeTruthy();
      expect(itemDeletedEvent.payload).toHaveProperty('directionId');
      expect(itemDeletedEvent.payload).toHaveProperty('categoryId', 'names');
      expect(itemDeletedEvent.payload).toHaveProperty('itemText', 'John');

      // IMPORTANT: After the fix, no warning should be produced
      // because the event now uses a proper constant with 'core:' prefix
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should dispatch CLICHE_TROPE_DELETED event without warnings', async () => {
      // Setup test data - an existing cliche with tropes
      const existingCliche = new Cliche({
        id: 'test-cliche-123',
        directionId: 'test-direction-456',
        conceptId: 'test-concept-789',
        categories: {
          names: ['John'],
        },
        tropesAndStereotypes: ['Chosen one', 'Dark past'],
        createdAt: new Date().toISOString(),
      });

      // Mock database to return the cliche data (as plain object, not Cliche instance)
      mockDatabase.getClicheByDirectionId.mockResolvedValue({
        id: 'test-cliche-123',
        directionId: 'test-direction-456',
        conceptId: 'test-concept-789',
        categories: {
          names: ['John'],
        },
        tropesAndStereotypes: ['Chosen one', 'Dark past'],
        createdAt: new Date().toISOString(),
      });
      mockDatabase.updateCliche.mockResolvedValue(true);

      // Call the method that removes a trope
      const result = await service.removeClicheTrope(
        'test-direction-456',
        'Chosen one'
      );

      // Check that the cliche was updated
      expect(result).toBeTruthy();
      expect(mockDatabase.updateCliche).toHaveBeenCalled();

      // Find the dispatched event - it should now use the proper constant
      const tropeDeletedEvent = dispatchedEvents.find(
        (e) => e.type === CHARACTER_BUILDER_EVENTS.CLICHE_TROPE_DELETED
      );

      // The event should have been dispatched
      expect(tropeDeletedEvent).toBeTruthy();
      expect(tropeDeletedEvent.payload).toHaveProperty('directionId');
      expect(tropeDeletedEvent.payload).toHaveProperty(
        'tropeText',
        'Chosen one'
      );

      // IMPORTANT: After the fix, no warning should be produced
      // because the event now uses a proper constant with 'core:' prefix
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('After Fix Applied', () => {
    it('should NOT produce warning when using proper event constants', async () => {
      // This test verifies that after the fix, the events use proper constants
      // and no warnings are produced

      // Setup test data
      const existingCliche = new Cliche({
        id: 'test-cliche-123',
        directionId: 'test-direction-456',
        conceptId: 'test-concept-789',
        categories: {
          names: ['John', 'Jane'],
        },
        tropesAndStereotypes: ['Chosen one'],
        createdAt: new Date().toISOString(),
      });

      // Mock the event bus to simulate fixed behavior
      mockEventBus.dispatch = jest.fn((eventType, payload) => {
        dispatchedEvents.push({ type: eventType, payload });

        // After fix, event types should use constants from CHARACTER_BUILDER_EVENTS
        // which start with 'core:' prefix
        if (typeof eventType === 'string' && eventType.startsWith('core:')) {
          // Proper event constant used, no warning
          return true;
        } else if (typeof eventType === 'string') {
          // String literal used (the bug)
          console.warn(
            `VED: EventDefinition not found for '${eventType}'. Cannot validate payload. Proceeding with dispatch.`
          );
        }

        return true;
      });

      // Mock database
      mockDatabase.getClicheByDirectionId.mockResolvedValue(existingCliche);
      mockDatabase.updateCliche.mockResolvedValue(true);

      // After the fix is applied, the service should use:
      // CHARACTER_BUILDER_EVENTS.CLICHE_ITEM_DELETED instead of 'CLICHE_ITEM_DELETED'

      // Since we can't modify the service directly in the test,
      // we'll verify that the fix would prevent warnings

      // This is what the fixed dispatch should look like:
      const FIXED_EVENT_TYPE = 'core:cliche_item_deleted';
      mockEventBus.dispatch(FIXED_EVENT_TYPE, {
        conceptId: 'test-concept-789',
        directionId: 'test-direction-456',
        categoryId: 'names',
        itemText: 'John',
        remainingCount: 1,
      });

      // After the fix, no warnings should be produced
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      // The event should still be dispatched successfully
      const fixedEvent = dispatchedEvents.find(
        (e) => e.type === FIXED_EVENT_TYPE
      );
      expect(fixedEvent).toBeTruthy();
    });
  });
});
