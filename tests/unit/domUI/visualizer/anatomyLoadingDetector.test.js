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

      const result = await anatomyLoadingDetector.waitForAnatomyReady(entityId, {
        timeout: 10,
        retryInterval: 0,
      });

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
      const mockUnsubscribe =
        testBed.mockEventDispatcher.subscribe.mock.results[0].value;
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Timeout and Retry Logic', () => {
    it('should use configurable timeout for anatomy detection', async () => {
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

      // Use very short intervals for testing
      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 100,
          retryInterval: 10,
        }
      );

      expect(result).toBe(true);
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(2);
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

      // Use short intervals for testing
      const result = await anatomyLoadingDetector.waitForAnatomyReady(
        entityId,
        {
          timeout: 200,
          retryInterval: 10,
          useExponentialBackoff: true,
        }
      );

      expect(result).toBe(true);
      expect(mockEntity.getComponentData).toHaveBeenCalledTimes(3);
    });
  });

  // Memory management and disposal tests moved to main test suite for better organization
});
