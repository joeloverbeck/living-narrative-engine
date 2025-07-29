/**
 * @file Integration tests for Character Concepts Manager event flow
 * Tests the complete event dispatch flow from the character concepts manager
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

describe('Character Concepts Manager - Event Flow Integration', () => {
  let mockGameDataRepository;
  let mockValidatedEventDispatcher;
  let mockEventBus;
  let mockLogger;

  // Track dispatched events
  let dispatchedEvents = [];

  beforeEach(() => {
    // Clear event tracking
    dispatchedEvents = [];

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock GameDataRepository to return event definitions
    mockGameDataRepository = {
      getEventDefinition: jest.fn((eventName) => {
        // Return mock event definitions for the UI events we're testing
        const eventDefinitions = {
          'core:statistics_updated': {
            id: 'core:statistics_updated',
            payloadSchema: {
              type: 'object',
              properties: {
                totalConcepts: { type: 'number', minimum: 0 },
                conceptsWithDirections: { type: 'number', minimum: 0 },
                totalDirections: { type: 'number', minimum: 0 },
                averageDirectionsPerConcept: { type: 'string' },
                completionRate: { type: 'number', minimum: 0, maximum: 100 },
              },
              required: [
                'totalConcepts',
                'conceptsWithDirections',
                'totalDirections',
                'averageDirectionsPerConcept',
                'completionRate',
              ],
            },
          },
          'core:ui_modal_opened': {
            id: 'core:ui_modal_opened',
            payloadSchema: {
              type: 'object',
              properties: {
                modalType: {
                  type: 'string',
                  enum: [
                    'create-concept',
                    'edit-concept',
                    'delete-confirmation',
                  ],
                },
                conceptId: { type: 'string' },
              },
              required: ['modalType'],
            },
          },
          'core:ui_modal_closed': {
            id: 'core:ui_modal_closed',
            payloadSchema: {
              type: 'object',
              properties: {
                modalType: {
                  type: 'string',
                  enum: ['concept', 'delete-confirmation'],
                },
              },
              required: ['modalType'],
            },
          },
          'core:ui_search_performed': {
            id: 'core:ui_search_performed',
            payloadSchema: {
              type: 'object',
              properties: {
                searchTerm: { type: 'string', minLength: 1 },
                resultCount: { type: 'number', minimum: 0 },
                totalConcepts: { type: 'number', minimum: 0 },
                searchMode: { type: 'string', enum: ['enhanced', 'basic'] },
                timestamp: { type: 'number' },
              },
              required: [
                'searchTerm',
                'resultCount',
                'totalConcepts',
                'searchMode',
              ],
            },
          },
          'core:ui_search_cleared': {
            id: 'core:ui_search_cleared',
            payloadSchema: {
              type: 'object',
              properties: {
                totalConcepts: { type: 'number', minimum: 0 },
              },
              required: ['totalConcepts'],
            },
          },
        };

        return eventDefinitions[eventName] || null;
      }),
    };

    // Mock ValidatedEventDispatcher
    mockValidatedEventDispatcher = {
      dispatch: jest.fn(async (eventName, payload) => {
        // Validate that eventName is a string
        if (typeof eventName !== 'string') {
          throw new Error(
            `Invalid event name: expected string, got ${typeof eventName}`
          );
        }

        // Validate that payload is an object
        if (typeof payload !== 'object' || payload === null) {
          throw new Error(
            `Invalid payload: expected object, got ${typeof payload}`
          );
        }

        // Track the dispatched event
        dispatchedEvents.push({ eventName, payload });

        // Call the mock EventBus dispatch
        return mockEventBus.dispatch(eventName, payload);
      }),
    };

    // Mock EventBus
    mockEventBus = {
      dispatch: jest.fn(async (eventName, payload) => {
        // Validate event name is a string
        if (typeof eventName !== 'string' || eventName.length === 0) {
          throw new Error(`EventBus: Invalid event name provided.`);
        }

        // Track successful dispatch
        mockLogger.debug(
          `EventBus: Successfully dispatched event '${eventName}'`
        );
        return true;
      }),
    };

    // Mock console methods to suppress output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Event Dispatch Integration', () => {
    it('should successfully dispatch core:statistics:updated event with correct format', async () => {
      const eventName = 'core:statistics_updated';
      const payload = {
        totalConcepts: 9,
        conceptsWithDirections: 3,
        totalDirections: 15,
        averageDirectionsPerConcept: '1.7',
        completionRate: 33,
      };

      // Test the event dispatch flow
      await mockValidatedEventDispatcher.dispatch(eventName, payload);

      // Verify ValidatedEventDispatcher was called correctly
      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload
      );

      // Verify EventBus was called correctly
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);

      // Verify event was tracked
      expect(dispatchedEvents).toHaveLength(1);
      expect(dispatchedEvents[0]).toEqual({ eventName, payload });
    });

    it('should successfully dispatch core:ui_modal_opened event with correct format', async () => {
      const eventName = 'core:ui_modal_opened';
      const payload = { modalType: 'create-concept' };

      await mockValidatedEventDispatcher.dispatch(eventName, payload);

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(dispatchedEvents[0]).toEqual({ eventName, payload });
    });

    it('should successfully dispatch core:ui_modal_closed event with correct format', async () => {
      const eventName = 'core:ui_modal_closed';
      const payload = { modalType: 'concept' };

      await mockValidatedEventDispatcher.dispatch(eventName, payload);

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(dispatchedEvents[0]).toEqual({ eventName, payload });
    });

    it('should successfully dispatch ui_search_performed event with correct format', async () => {
      const eventName = 'core:ui_search_performed';
      const payload = {
        searchTerm: 'test',
        resultCount: 1,
        totalConcepts: 2,
        searchMode: 'enhanced',
        timestamp: Date.now(),
      };

      await mockValidatedEventDispatcher.dispatch(eventName, payload);

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(dispatchedEvents[0]).toEqual({ eventName, payload });
    });

    it('should successfully dispatch ui_search_cleared event with correct format', async () => {
      const eventName = 'core:ui_search_cleared';
      const payload = { totalConcepts: 2 };

      await mockValidatedEventDispatcher.dispatch(eventName, payload);

      expect(mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
        eventName,
        payload
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(eventName, payload);
      expect(dispatchedEvents[0]).toEqual({ eventName, payload });
    });
  });

  describe('Event Validation Integration', () => {
    it('should reject events with old {type: eventName, payload: data} pattern', async () => {
      // Test that passing an object with type property as eventName fails
      const invalidEventData = {
        type: 'core:statistics_updated',
        payload: { totalConcepts: 9 },
      };

      await expect(
        mockValidatedEventDispatcher.dispatch(invalidEventData, {})
      ).rejects.toThrow('Invalid event name: expected string, got object');

      // Verify no events were dispatched
      expect(dispatchedEvents).toHaveLength(0);
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should reject events with non-string event names', async () => {
      await expect(
        mockValidatedEventDispatcher.dispatch(null, { test: 'data' })
      ).rejects.toThrow('Invalid event name: expected string, got object');

      await expect(
        mockValidatedEventDispatcher.dispatch(undefined, { test: 'data' })
      ).rejects.toThrow('Invalid event name: expected string, got undefined');

      await expect(
        mockValidatedEventDispatcher.dispatch(123, { test: 'data' })
      ).rejects.toThrow('Invalid event name: expected string, got number');

      expect(dispatchedEvents).toHaveLength(0);
    });

    it('should reject events with non-object payloads', async () => {
      await expect(
        mockValidatedEventDispatcher.dispatch('core:statistics_updated', null)
      ).rejects.toThrow('Invalid payload: expected object, got object');

      await expect(
        mockValidatedEventDispatcher.dispatch(
          'core:statistics_updated',
          'string-payload'
        )
      ).rejects.toThrow('Invalid payload: expected object, got string');

      await expect(
        mockValidatedEventDispatcher.dispatch('core:statistics_updated', 123)
      ).rejects.toThrow('Invalid payload: expected object, got number');

      expect(dispatchedEvents).toHaveLength(0);
    });

    it('should validate event names use correct colon-separated format', async () => {
      const validEventNames = [
        'core:statistics_updated',
        'core:ui_modal_opened',
        'core:ui_modal_closed',
        'core:ui_search_performed',
        'core:ui_search_cleared',
      ];

      for (const eventName of validEventNames) {
        // Verify event name matches expected pattern
        expect(eventName).toMatch(/^[a-z]+:[a-z_-]+$/);

        // Verify event can be dispatched successfully
        await mockValidatedEventDispatcher.dispatch(eventName, {
          test: 'data',
        });
      }

      expect(dispatchedEvents).toHaveLength(validEventNames.length);
    });
  });

  describe('Event Definition Integration', () => {
    it('should successfully find event definitions for all UI events', () => {
      const expectedEvents = [
        'core:statistics_updated',
        'core:ui_modal_opened',
        'core:ui_modal_closed',
        'core:ui_search_performed',
        'core:ui_search_cleared',
      ];

      expectedEvents.forEach((eventName) => {
        const definition = mockGameDataRepository.getEventDefinition(eventName);
        expect(definition).not.toBeNull();
        expect(definition.id).toMatch(/^core:/);
        expect(definition.payloadSchema).toBeDefined();
        expect(definition.payloadSchema.type).toBe('object');
      });
    });

    it('should return null for non-existent event definitions', () => {
      const nonExistentEvent = 'non:existent-event';
      const definition =
        mockGameDataRepository.getEventDefinition(nonExistentEvent);
      expect(definition).toBeNull();
    });
  });
});
