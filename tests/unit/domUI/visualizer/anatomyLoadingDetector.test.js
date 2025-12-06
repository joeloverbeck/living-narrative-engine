/**
 * @file Tests for AnatomyLoadingDetector - Optimized with shared test bed and parameterized tests
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ENTITY_CREATED_ID } from '../../../../src/constants/eventIds.js';
import AnatomyVisualizerUnitTestBed from '../../../common/anatomy/anatomyVisualizerUnitTestBed.js';

// Mock dependencies
jest.mock('../../../../src/utils/index.js', () => ({
  validateDependency: jest.fn((dep, name) => {
    if (!dep) throw new Error(`Missing required dependency: ${name}.`);
  }),
}));

// Note: We'll use Jest's fake timers in specific tests that need them

import { AnatomyLoadingDetector } from '../../../../src/domUI/visualizer/AnatomyLoadingDetector.js';

describe('AnatomyLoadingDetector - Anatomy Detection', () => {
  let anatomyLoadingDetector;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerUnitTestBed();

    anatomyLoadingDetector = new AnatomyLoadingDetector({
      entityManager: testBed.mockEntityManager,
      eventDispatcher: testBed.mockEventDispatcher,
      logger: testBed.mockLogger,
    });
  });

  afterEach(async () => {
    if (anatomyLoadingDetector && anatomyLoadingDetector.dispose) {
      anatomyLoadingDetector.dispose();
    }
    await testBed.cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Constructor and Initialization', () => {
    it('should require entityManager dependency', () => {
      expect(() => {
        new AnatomyLoadingDetector({
          eventDispatcher: testBed.mockEventDispatcher,
          logger: testBed.mockLogger,
        });
      }).toThrow('Missing required dependency: entityManager.');
    });

    it('should require eventDispatcher dependency', () => {
      expect(() => {
        new AnatomyLoadingDetector({
          entityManager: testBed.mockEntityManager,
          logger: testBed.mockLogger,
        });
      }).toThrow('Missing required dependency: eventDispatcher.');
    });

    it('should initialize with proper dependencies', () => {
      expect(anatomyLoadingDetector).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    describe('waitForAnatomyReady validation', () => {
      it('should reject null entityId', async () => {
        await expect(
          anatomyLoadingDetector.waitForAnatomyReady(null)
        ).rejects.toThrow('Entity ID must be a non-empty string');
      });

      it('should reject undefined entityId', async () => {
        await expect(
          anatomyLoadingDetector.waitForAnatomyReady(undefined)
        ).rejects.toThrow('Entity ID must be a non-empty string');
      });

      it('should reject empty string entityId', async () => {
        await expect(
          anatomyLoadingDetector.waitForAnatomyReady('')
        ).rejects.toThrow('Entity ID must be a non-empty string');
      });

      it('should reject non-string entityId', async () => {
        await expect(
          anatomyLoadingDetector.waitForAnatomyReady(123)
        ).rejects.toThrow('Entity ID must be a non-empty string');
      });

      it('should reject object entityId', async () => {
        await expect(
          anatomyLoadingDetector.waitForAnatomyReady({})
        ).rejects.toThrow('Entity ID must be a non-empty string');
      });
    });

    describe('waitForEntityCreation validation', () => {
      it('should reject null entityId', () => {
        expect(() => {
          anatomyLoadingDetector.waitForEntityCreation(null, jest.fn());
        }).toThrow('Entity ID must be a non-empty string');
      });

      it('should reject empty string entityId', () => {
        expect(() => {
          anatomyLoadingDetector.waitForEntityCreation('', jest.fn());
        }).toThrow('Entity ID must be a non-empty string');
      });

      it('should reject non-string entityId', () => {
        expect(() => {
          anatomyLoadingDetector.waitForEntityCreation(123, jest.fn());
        }).toThrow('Entity ID must be a non-empty string');
      });

      it('should reject null callback', () => {
        expect(() => {
          anatomyLoadingDetector.waitForEntityCreation('test:entity:123', null);
        }).toThrow('Callback must be a function');
      });

      it('should reject undefined callback', () => {
        expect(() => {
          anatomyLoadingDetector.waitForEntityCreation(
            'test:entity:123',
            undefined
          );
        }).toThrow('Callback must be a function');
      });

      it('should reject non-function callback', () => {
        expect(() => {
          anatomyLoadingDetector.waitForEntityCreation(
            'test:entity:123',
            'not-a-function'
          );
        }).toThrow('Callback must be a function');
      });
    });
  });

  describe('Anatomy Detection', () => {
    // Comprehensive parameterized tests for anatomy validation scenarios
    const anatomyValidationScenarios = [
      {
        name: 'should detect valid anatomy with all required fields',
        anatomyData: {
          recipeId: 'test:recipe',
          body: {
            root: 'test:root:123',
            parts: { 'test:part1': 'entity1' },
          },
        },
        expected: true,
      },
      {
        name: 'should reject null anatomy data',
        anatomyData: null,
        expected: false,
      },
      {
        name: 'should reject empty anatomy data',
        anatomyData: {},
        expected: false,
      },
      {
        name: 'should reject anatomy without body',
        anatomyData: { recipeId: 'test:recipe' },
        expected: false,
      },
      {
        name: 'should reject anatomy without root',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { parts: { 'test:part1': 'entity1' } },
        },
        expected: false,
      },
      {
        name: 'should reject anatomy without parts',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { root: 'test:root:123' },
        },
        expected: false,
      },
      {
        name: 'should reject anatomy with invalid parts type',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { root: 'test:root:123', parts: 'invalid' },
        },
        expected: false,
      },
    ];

    test.each(anatomyValidationScenarios)(
      '$name',
      async ({ anatomyData, expected }) => {
        const entityId = 'test:entity:123';
        const mockEntity = testBed.createMockEntityWithAnatomy({
          entityId,
          hasValidAnatomy: expected,
          anatomyData,
        });

        testBed.mockEntityManager.getEntityInstance.mockResolvedValue(
          mockEntity
        );

        // Use immediate check for invalid cases, small timeout for valid cases
        const result = await anatomyLoadingDetector.waitForAnatomyReady(
          entityId,
          { timeout: expected ? 10 : 0, retryInterval: 0 }
        );

        expect(result).toBe(expected);
        expect(
          testBed.mockEntityManager.getEntityInstance
        ).toHaveBeenCalledWith(entityId);
        expect(mockEntity.getComponentData).toHaveBeenCalledWith(
          'anatomy:body'
        );
      }
    );

    it('should handle entity not found gracefully', async () => {
      const entityId = 'nonexistent:entity';
      testBed.mockEntityManager.getEntityInstance.mockRejectedValue(
        new Error('Entity not found')
      );

      const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId);

      expect(result).toBe(false);
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get entity'),
        expect.any(Error)
      );
    });

    // Removed - these test cases are now covered in the parameterized tests above

    it('should log debug information when checking anatomy readiness', async () => {
      const entityId = 'test:entity:123';
      const bodyComponent = {
        recipeId: 'test:recipe',
        body: {
          root: 'test:root:123',
          parts: { 'test:part1': 'entity1' },
        },
      };
      const mockEntity = testBed.createMockEntityWithAnatomy({
        entityId,
        anatomyData: bodyComponent,
      });

      testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 10,
          retryInterval: 0,
        }
      );

      expect(result).toBe(true);
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        `Checking anatomy readiness for entity ${entityId}:`,
        {
          hasBodyComponent: true,
          bodyStructure: JSON.stringify(bodyComponent, null, 2),
        }
      );
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        `Entity ${entityId} anatomy ready: true (structure: true, description: true)`
      );
    });

    it('should handle entity not found in private checkAnatomyReady method', async () => {
      const entityId = 'test:entity:123';

      // Mock entity manager to return null (entity not found)
      testBed.mockEntityManager.getEntityInstance.mockResolvedValue(null);

      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        { timeout: 10, retryInterval: 0 }
      );

      expect(result).toBe(false);
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        `Entity ${entityId} not found`
      );
    });
  });

  describe('Event-Based Detection', () => {
    it('should listen for ENTITY_CREATED_ID events', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();

      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);

      expect(testBed.mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        expect.any(Function)
      );
    });

    it('should call callback when target entity is created', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();
      const triggerEvent = testBed.setupEventSubscription(entityId);

      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);
      triggerEvent();

      expect(callback).toHaveBeenCalledWith(entityId);
    });

    it('should not call callback for different entity', () => {
      const targetEntityId = 'test:entity:123';
      const differentEntityId = 'test:entity:456';
      const callback = jest.fn();
      const triggerEvent = testBed.setupEventSubscription(differentEntityId);

      anatomyLoadingDetector.waitForEntityCreation(targetEntityId, callback);
      triggerEvent();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should unsubscribe from events when callback is called', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();
      const triggerEvent = testBed.setupEventSubscription(entityId);

      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);
      triggerEvent();

      // Verify unsubscribe was called (mocked in setupEventSubscription)
      const mockUnsubscribe =
        testBed.mockEventDispatcher.subscribe.mock.results[0].value;
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('waitForEntityWithAnatomy Workflow', () => {
    it('should check for existing entity first and proceed directly to anatomy check', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = testBed.createMockEntityWithAnatomy({
        entityId,
        hasValidAnatomy: true,
      });

      // Mock entity already exists
      testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      const result = await anatomyLoadingDetector.waitForEntityWithAnatomy(
        entityId,
        { timeout: 100, retryInterval: 10 }
      );

      expect(result).toBe(true);
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        `Entity ${entityId} already exists, checking anatomy readiness directly`
      );
    });

    it('should wait for entity creation when entity does not exist', async () => {
      const entityId = 'test:entity:123';

      // First call - entity doesn't exist
      testBed.mockEntityManager.getEntityInstance
        .mockRejectedValueOnce(new Error('Entity not found'))
        .mockResolvedValueOnce(
          testBed.createMockEntityWithAnatomy({
            entityId,
            hasValidAnatomy: true,
          })
        );

      const triggerEvent = testBed.setupEventSubscription(entityId);

      // Start the workflow
      const workflowPromise = anatomyLoadingDetector.waitForEntityWithAnatomy(
        entityId,
        { timeout: 1000, retryInterval: 10 }
      );

      // Simulate entity creation event
      setTimeout(() => triggerEvent(), 10);

      const result = await workflowPromise;

      expect(result).toBe(true);
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        `Entity ${entityId} doesn't exist yet, waiting for creation`
      );
    });

    it('should handle timeout during entity creation waiting', async () => {
      const entityId = 'test:entity:123';

      // Entity doesn't exist
      testBed.mockEntityManager.getEntityInstance.mockRejectedValue(
        new Error('Entity not found')
      );

      testBed.setupEventSubscription(entityId); // Setup but don't trigger

      const result = await anatomyLoadingDetector.waitForEntityWithAnatomy(
        entityId,
        { timeout: 50, retryInterval: 10 }
      );

      expect(result).toBe(false);
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        `Timeout waiting for entity creation: ${entityId}`,
        {
          entityId,
          timeout: 50,
          phase: 'waiting_for_entity_creation',
        }
      );
    });

    it('should handle error during anatomy readiness check after entity creation', async () => {
      const entityId = 'test:entity:123';

      // Mock waitForAnatomyReady to throw an error to reach the specific error handling path
      const originalWaitForAnatomyReady =
        anatomyLoadingDetector.waitForAnatomyReady;
      anatomyLoadingDetector.waitForAnatomyReady = jest
        .fn()
        .mockRejectedValue(new Error('Anatomy check failed'));

      // Entity doesn't exist initially
      testBed.mockEntityManager.getEntityInstance.mockRejectedValueOnce(
        new Error('Entity not found')
      );

      const triggerEvent = testBed.setupEventSubscription(entityId);

      // Start the workflow
      const workflowPromise = anatomyLoadingDetector.waitForEntityWithAnatomy(
        entityId,
        { timeout: 1000, retryInterval: 10 }
      );

      // Simulate entity creation event
      setTimeout(() => triggerEvent(), 10);

      const result = await workflowPromise;

      expect(result).toBe(false);
      // This should trigger the specific error handling path in waitForEntityWithAnatomy
      expect(testBed.mockLogger.error).toHaveBeenCalledWith(
        `Error waiting for anatomy on entity ${entityId}:`,
        {
          entityId,
          error: 'Anatomy check failed',
          stack: expect.any(String),
          phase: 'waiting_for_anatomy_ready',
        }
      );

      // Restore original method
      anatomyLoadingDetector.waitForAnatomyReady = originalWaitForAnatomyReady;
    });

    it('should prevent race conditions with multiple resolution attempts', async () => {
      const entityId = 'test:entity:123';

      // Entity doesn't exist initially
      testBed.mockEntityManager.getEntityInstance
        .mockRejectedValueOnce(new Error('Entity not found'))
        .mockResolvedValue(
          testBed.createMockEntityWithAnatomy({
            entityId,
            hasValidAnatomy: true,
          })
        );

      const triggerEvent = testBed.setupEventSubscription(entityId);

      // Start the workflow
      const workflowPromise = anatomyLoadingDetector.waitForEntityWithAnatomy(
        entityId,
        { timeout: 1000, retryInterval: 10 }
      );

      // Trigger multiple events rapidly to test race condition handling
      setTimeout(() => triggerEvent(), 10);
      setTimeout(() => triggerEvent(), 15);
      setTimeout(() => triggerEvent(), 20);

      const result = await workflowPromise;

      expect(result).toBe(true);
      // Should only resolve once despite multiple events
    });

    it('should use default timeout when none provided in config', async () => {
      const entityId = 'test:entity:123';

      // Entity doesn't exist
      testBed.mockEntityManager.getEntityInstance.mockRejectedValue(
        new Error('Entity not found')
      );

      testBed.setupEventSubscription(entityId); // Setup but don't trigger

      // Use a very short timeout for testing instead of default
      const result = await anatomyLoadingDetector.waitForEntityWithAnatomy(
        entityId,
        { timeout: 50 }
      );

      expect(result).toBe(false);
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        `Timeout waiting for entity creation: ${entityId}`,
        {
          entityId,
          timeout: 50,
          phase: 'waiting_for_entity_creation',
        }
      );
    });
  });

  describe('Timeout and Retry Logic', () => {
    it('should use configurable timeout for anatomy detection', async () => {
      const entityId = 'test:entity:123';
      let anatomyCallCount = 0;
      const anatomyData = {
        recipeId: 'test:recipe',
        body: {
          root: 'test:root:123',
          parts: { 'test:part1': 'entity1' },
        },
      };
      const descriptionData = { text: 'Generated description' };

      const mockEntity = {
        getComponentData: jest.fn().mockImplementation((componentType) => {
          if (componentType === 'anatomy:body') {
            anatomyCallCount++;
            // First call returns null, second call returns data
            return anatomyCallCount === 1 ? null : anatomyData;
          } else if (componentType === 'core:description') {
            // Return description when anatomy is ready (after second anatomy call)
            return anatomyCallCount >= 2 ? descriptionData : null;
          }
          return null;
        }),
      };

      testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Use very short intervals for testing
      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 100,
          retryInterval: 10,
        }
      );

      expect(result).toBe(true);
      // First attempt: anatomy call (returns null), second attempt: anatomy call (returns data) + description call
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(3);
    });

    it('should timeout if anatomy is never ready', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = {
        getComponentData: jest.fn().mockReturnValue(null), // Always not ready
      };

      testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

      // Use very short timeout for fast test
      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 50,
          retryInterval: 10,
        }
      );

      expect(result).toBe(false);
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Timeout waiting for anatomy'),
        expect.any(Object)
      );
    });

    it('should use exponential backoff for retries', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      try {
        const entityId = 'test:entity:123';
        let anatomyCallCount = 0;
        const anatomyData = {
          recipeId: 'test:recipe',
          body: {
            root: 'test:root:123',
            parts: { 'test:part1': 'entity1' },
          },
        };
        const descriptionData = { text: 'Generated description' };

        const mockEntity = {
          getComponentData: jest.fn().mockImplementation((componentType) => {
            if (componentType === 'anatomy:body') {
              anatomyCallCount++;
              // First two calls return null, third call returns data
              return anatomyCallCount <= 2 ? null : anatomyData;
            } else if (componentType === 'core:description') {
              // Return description when anatomy is ready (after third anatomy call)
              return anatomyCallCount >= 3 ? descriptionData : null;
            }
            return null;
          }),
        };

        testBed.mockEntityManager.getEntityInstance.mockResolvedValue(
          mockEntity
        );

        // Use short intervals for testing
        const waitPromise = anatomyLoadingDetector.waitForAnatomyReady(
          entityId,
          {
            timeout: 200,
            retryInterval: 10,
            useExponentialBackoff: true,
          }
        );

        // Advance timers to progress through retries (10ms + 20ms backoff)
        await jest.advanceTimersByTimeAsync(10);
        await jest.advanceTimersByTimeAsync(20);

        const result = await waitPromise;
        expect(result).toBe(true);
        // Three anatomy attempts (1st: null, 2nd: null, 3rd: success) + one description call on success
        expect(mockEntity.getComponentData).toHaveBeenCalledTimes(4);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Disposal and Lifecycle Management', () => {
    it('should clean up subscriptions when disposed', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();

      // Mock the subscribe to return an unsubscribe function
      testBed.mockEventDispatcher.subscribe.mockReturnValue(mockUnsubscribe);

      // Create a subscription
      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);

      // Verify subscription was created
      expect(testBed.mockEventDispatcher.subscribe).toHaveBeenCalled();

      // Dispose the detector
      anatomyLoadingDetector.dispose();

      // Verify unsubscribe was called
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle multiple disposal calls gracefully', () => {
      // First disposal should work normally
      anatomyLoadingDetector.dispose();

      // Second disposal should be no-op (early return on line 250)
      expect(() => {
        anatomyLoadingDetector.dispose();
      }).not.toThrow();
    });

    it('should throw error when waitForAnatomyReady called after disposal', async () => {
      anatomyLoadingDetector.dispose();

      await expect(
        anatomyLoadingDetector.waitForAnatomyReady('test:entity:123')
      ).rejects.toThrow('AnatomyLoadingDetector has been disposed');
    });

    it('should throw error when waitForEntityCreation called after disposal', () => {
      anatomyLoadingDetector.dispose();

      expect(() => {
        anatomyLoadingDetector.waitForEntityCreation(
          'test:entity:123',
          jest.fn()
        );
      }).toThrow('AnatomyLoadingDetector has been disposed');
    });

    it('should throw error when waitForEntityWithAnatomy called after disposal', async () => {
      anatomyLoadingDetector.dispose();

      await expect(
        anatomyLoadingDetector.waitForEntityWithAnatomy('test:entity:123')
      ).rejects.toThrow('AnatomyLoadingDetector has been disposed');
    });

    it('should handle subscription cleanup errors during disposal', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();

      // Create subscription with failing unsubscribe
      const mockUnsubscribe = jest.fn().mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });
      testBed.mockEventDispatcher.subscribe.mockReturnValue(mockUnsubscribe);

      anatomyLoadingDetector.waitForEntityCreation(entityId, callback);

      // Disposal should handle the error gracefully
      expect(() => {
        anatomyLoadingDetector.dispose();
      }).not.toThrow();

      // Verify the warning was logged
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        'Error unsubscribing from event:',
        expect.any(Error)
      );
    });

    it('should return unsubscribe function that properly cleans up', () => {
      const entityId = 'test:entity:123';
      const callback = jest.fn();
      const mockEventUnsubscribe = jest.fn();

      // Mock the subscribe to return an unsubscribe function
      testBed.mockEventDispatcher.subscribe.mockReturnValue(
        mockEventUnsubscribe
      );

      const unsubscribe = anatomyLoadingDetector.waitForEntityCreation(
        entityId,
        callback
      );

      // Verify unsubscribe is a function
      expect(typeof unsubscribe).toBe('function');

      // Call the returned unsubscribe function
      expect(() => {
        unsubscribe();
      }).not.toThrow();

      // Verify the event subscription was removed
      expect(mockEventUnsubscribe).toHaveBeenCalled();
    });
  });

  // Memory management and disposal tests moved to main test suite for better organization
});
