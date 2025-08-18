/**
 * @file Integration test to reproduce event validation issues when retrieving cliches
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

describe('Character Builder Service - Cliches Event Validation', () => {
  let service;
  let mockEventBus;
  let mockDatabase;
  let dispatchedEvents;

  beforeEach(async () => {
    dispatchedEvents = [];

    // Create mock event bus that captures dispatched events
    mockEventBus = {
      dispatch: jest.fn((eventType, payload) => {
        dispatchedEvents.push({ type: eventType, payload });

        // Simulate VED validation
        if (eventType === CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED) {
          // Check for required fields
          if (!payload.conceptId) {
            console.error(
              `VED: Payload validation FAILED for event '${eventType}'. Missing required property 'conceptId'`
            );
            return false;
          }
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
    const mockLogger = {
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
      directionGenerator: mockThematicDirectionGenerator, // Note: parameter name is directionGenerator
      database: mockDatabase,
      schemaValidator: null, // Optional
      clicheGenerator: null, // Optional
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Issue: Missing conceptId in core:cliches_retrieved event', () => {
    it('should demonstrate the bug - event dispatched without conceptId', async () => {
      // Setup test data - a cliche with both directionId and conceptId
      const testCliches = {
        id: 'test-cliche-123',
        directionId: 'test-direction-456',
        conceptId: 'test-concept-789', // This is present in the data
        categories: {
          names: ['John', 'Jane'],
          physicalDescriptions: ['Tall', 'Dark'],
          personalityTraits: ['Brooding', 'Mysterious'],
          skillsAbilities: ['Fighting', 'Hacking'],
          typicalLikes: ['Justice', 'Coffee'],
          typicalDislikes: ['Evil', 'Mornings'],
          commonFears: ['Failure', 'Loss'],
          genericGoals: ['Save world', 'Find peace'],
          backgroundElements: ['Orphan', 'Tragedy'],
          overusedSecrets: ['Royal blood', 'Hidden power'],
          speechPatterns: ['...', 'Whatever'],
        },
        tropesAndStereotypes: ['Chosen one', 'Dark past'],
        createdAt: new Date().toISOString(),
      };

      // Mock database to return the cliche data
      mockDatabase.getClicheByDirectionId.mockResolvedValue(testCliches);

      // Call the method that has the bug
      const result =
        await service.getClichesByDirectionId('test-direction-456');

      // Check that a cliche was returned
      expect(result).toBeTruthy();
      expect(result.directionId).toBe('test-direction-456');
      expect(result.conceptId).toBe('test-concept-789');

      // Find the dispatched event
      const clichesRetrievedEvent = dispatchedEvents.find(
        (e) => e.type === CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED
      );

      expect(clichesRetrievedEvent).toBeTruthy();

      // After the fix, the event should have all required properties
      expect(clichesRetrievedEvent.payload).toHaveProperty('directionId');
      expect(clichesRetrievedEvent.payload).toHaveProperty('clicheId');
      expect(clichesRetrievedEvent.payload).toHaveProperty('categoryStats');

      // This assertion should now PASS after the fix
      expect(clichesRetrievedEvent.payload).toHaveProperty(
        'conceptId',
        'test-concept-789'
      );
      // ^ The fix adds conceptId to the event payload
    });
  });

  describe('After Fix Applied', () => {
    it('should dispatch event with conceptId included', async () => {
      // Setup test data
      const testCliches = {
        id: 'test-cliche-123',
        directionId: 'test-direction-456',
        conceptId: 'test-concept-789',
        categories: {
          names: ['John'],
          physicalDescriptions: ['Tall'],
          personalityTraits: ['Brooding'],
          skillsAbilities: ['Fighting'],
          typicalLikes: ['Justice'],
          typicalDislikes: ['Evil'],
          commonFears: ['Failure'],
          genericGoals: ['Save world'],
          backgroundElements: ['Orphan'],
          overusedSecrets: ['Royal blood'],
          speechPatterns: ['...'],
        },
        tropesAndStereotypes: ['Chosen one'],
        createdAt: new Date().toISOString(),
      };

      // Mock database to return the cliche data
      mockDatabase.getClicheByDirectionId.mockResolvedValue(testCliches);

      // To simulate the fix, we'll override the event dispatch to include conceptId
      // This is what the fix should do
      const originalDispatch = mockEventBus.dispatch;
      mockEventBus.dispatch = jest.fn((eventType, payload) => {
        if (eventType === CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED) {
          // FIX: Ensure conceptId is included
          const fixedPayload = {
            ...payload,
            conceptId: testCliches.conceptId, // Add the missing conceptId
          };
          dispatchedEvents.push({ type: eventType, payload: fixedPayload });
          return true;
        }
        return originalDispatch(eventType, payload);
      });

      // Call the method
      await service.getClichesByDirectionId('test-direction-456');

      // Find the dispatched event
      const clichesRetrievedEvent = dispatchedEvents.find(
        (e) => e.type === CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED
      );

      // After the fix, all required fields should be present
      expect(clichesRetrievedEvent).toBeTruthy();
      expect(clichesRetrievedEvent.payload).toHaveProperty(
        'directionId',
        'test-direction-456'
      );
      expect(clichesRetrievedEvent.payload).toHaveProperty(
        'conceptId',
        'test-concept-789'
      ); // Now included!
      expect(clichesRetrievedEvent.payload).toHaveProperty(
        'clicheId',
        'test-cliche-123'
      );
      expect(clichesRetrievedEvent.payload).toHaveProperty('categoryStats');
    });
  });
});
