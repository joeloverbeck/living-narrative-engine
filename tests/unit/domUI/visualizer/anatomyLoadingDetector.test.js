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
import AnatomyVisualizerTestBed from '../../../common/anatomy/anatomyVisualizerTestBed.js';

// Cache the module to avoid repeated require() calls
let AnatomyLoadingDetector;

describe('AnatomyLoadingDetector - Anatomy Detection', () => {
  let anatomyLoadingDetector;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();
    
    // Load module once and cache it
    if (!AnatomyLoadingDetector) {
      AnatomyLoadingDetector = require('../../../../src/domUI/visualizer/AnatomyLoadingDetector.js').AnatomyLoadingDetector;
    }

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

  describe('Anatomy Detection', () => {
    // Parameterized tests for anatomy validation scenarios
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
        name: 'should reject anatomy with invalid root type',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { root: null, parts: { 'test:part1': 'entity1' } },
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

        testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

        const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId);

        expect(result).toBe(expected);
        expect(testBed.mockEntityManager.getEntityInstance).toHaveBeenCalledWith(entityId);
        expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
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

      const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId);

      expect(result).toBe(true);
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        `Checking anatomy readiness for entity ${entityId}:`,
        {
          hasBodyComponent: true,
          bodyStructure: JSON.stringify(bodyComponent, null, 2),
        }
      );
      expect(testBed.mockLogger.debug).toHaveBeenCalledWith(
        `Entity ${entityId} anatomy ready: true`
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
      const mockUnsubscribe = testBed.mockEventDispatcher.subscribe.mock.results[0].value;
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Timeout and Retry Logic', () => {
    it('should use configurable timeout for anatomy detection', async () => {
      await testBed.withFakeTimers(async () => {
        const entityId = 'test:entity:123';
        const mockEntity = {
          getComponentData: jest
            .fn()
            .mockReturnValueOnce(null) // First call - not ready
            .mockReturnValueOnce({
              recipeId: 'test:recipe',
              body: {
                root: 'test:root:123',
                parts: { 'test:part1': 'entity1' },
              },
            }), // Second call - ready
        };

        testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

        const promise = anatomyLoadingDetector.waitForAnatomyReady(entityId, {
          timeout: 1000,
          retryInterval: 50,
        });

        // Fast-forward time to trigger retry
        testBed.advanceTime(100);
        
        const result = await promise;
        expect(result).toBe(true);
        expect(mockEntity.getComponentData).toHaveBeenCalledTimes(2);
      });
    });

    it('should timeout if anatomy is never ready', async () => {
      await testBed.withFakeTimers(async () => {
        const entityId = 'test:entity:123';
        const mockEntity = {
          getComponentData: jest.fn().mockReturnValue(null), // Always not ready
        };

        testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

        const promise = anatomyLoadingDetector.waitForAnatomyReady(entityId, {
          timeout: 100,
          retryInterval: 20,
        });

        // Fast-forward past timeout
        testBed.advanceTime(150);
        
        const result = await promise;
        expect(result).toBe(false);
        expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Timeout waiting for anatomy'),
          expect.any(Object)
        );
      });
    });

    it('should use exponential backoff for retries', async () => {
      await testBed.withFakeTimers(async () => {
        const entityId = 'test:entity:123';
        const mockEntity = {
          getComponentData: jest
            .fn()
            .mockReturnValueOnce(null)
            .mockReturnValueOnce(null)
            .mockReturnValueOnce({
              recipeId: 'test:recipe',
              body: {
                root: 'test:root:123',
                parts: { 'test:part1': 'entity1' },
              },
            }),
        };

        testBed.mockEntityManager.getEntityInstance.mockResolvedValue(mockEntity);

        const promise = anatomyLoadingDetector.waitForAnatomyReady(entityId, {
          timeout: 1000,
          retryInterval: 50,
          useExponentialBackoff: true,
        });

        // Fast-forward through retries
        testBed.advanceTime(200);
        
        const result = await promise;
        expect(result).toBe(true);
        expect(mockEntity.getComponentData).toHaveBeenCalledTimes(3);
      });
    });
  });
});

describe('AnatomyLoadingDetector - Comprehensive Integration', () => {
  let anatomyLoadingDetector;
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyVisualizerTestBed();
    
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
  });

  describe('Complete Workflow Integration', () => {
    it('should provide complete entity creation and anatomy detection workflow', async () => {
      const entityId = 'test:entity:123';
      const mockEntity = testBed.createMockEntityWithAnatomy({ entityId });

      // First call fails (entity doesn't exist), subsequent calls succeed
      testBed.mockEntityManager.getEntityInstance
        .mockRejectedValueOnce(new Error('Entity not found'))
        .mockResolvedValue(mockEntity);

      const triggerEvent = testBed.setupEventSubscription(entityId);

      // Start waiting for entity and anatomy
      const promise = anatomyLoadingDetector.waitForEntityWithAnatomy(entityId);

      // Give a moment for the subscription to be set up
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger the entity creation event
      triggerEvent();

      const result = await promise;

      expect(result).toBe(true);
      expect(testBed.mockEventDispatcher.subscribe).toHaveBeenCalledWith(
        ENTITY_CREATED_ID,
        expect.any(Function)
      );
      expect(testBed.mockEntityManager.getEntityInstance).toHaveBeenCalledWith(entityId);
      expect(mockEntity.getComponentData).toHaveBeenCalledWith('anatomy:body');
    });

    it('should handle workflow failure gracefully', async () => {
      const entityId = 'test:entity:123';
      const triggerEvent = testBed.setupEventSubscription(entityId);

      // Make entity manager fail on all calls
      testBed.mockEntityManager.getEntityInstance.mockRejectedValue(
        new Error('Entity fetch failed')
      );

      // Start waiting for entity and anatomy
      const promise = anatomyLoadingDetector.waitForEntityWithAnatomy(entityId);

      // Give a moment for the subscription to be set up
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger the entity creation event
      triggerEvent();

      const result = await promise;

      expect(result).toBe(false);
      expect(testBed.mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should dispose event subscriptions on cleanup', () => {
      const mockUnsubscribe1 = jest.fn();
      const mockUnsubscribe2 = jest.fn();

      testBed.mockEventDispatcher.subscribe
        .mockReturnValueOnce(mockUnsubscribe1)
        .mockReturnValueOnce(mockUnsubscribe2);

      // Create some subscriptions
      anatomyLoadingDetector.waitForEntityCreation('entity1', () => {});
      anatomyLoadingDetector.waitForEntityCreation('entity2', () => {});

      anatomyLoadingDetector.dispose();

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).toHaveBeenCalled();
    });

    it('should prevent operations after disposal', () => {
      anatomyLoadingDetector.dispose();

      expect(() => {
        anatomyLoadingDetector.waitForEntityCreation('entity1', () => {});
      }).toThrow('AnatomyLoadingDetector has been disposed');
    });
  });
});
