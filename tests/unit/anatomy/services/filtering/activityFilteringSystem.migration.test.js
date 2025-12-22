/**
 * @file Migration tests for ActivityFilteringSystem
 * @description Tests migrated from activityDescriptionService.characterization.test.js
 *              to use ActivityFilteringSystem directly instead of through adapter layer.
 *              Part of ACTDESSERREF-010 Phase 3 migration.
 *
 * These tests validate that ActivityFilteringSystem works identically when used
 * directly as when accessed through the ActivityDescriptionService adapter.
 *
 * Original tests: activityDescriptionService.characterization.test.js lines 520-803
 * Migration batch: Batch 1 (17 tests)
 * @see workflows/ACTDESSERREF-010-migrate-test-suite.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActivityFilteringSystem from '../../../../../src/anatomy/services/filtering/activityFilteringSystem.js';
import ActivityConditionValidator from '../../../../../src/anatomy/services/validation/activityConditionValidator.js';

/**
 * Helper: Create standard test entity
 * Matches the structure from activityDescriptionServiceTestHelpers.js
 *
 * @param config
 */
function createStandardEntity(config = {}) {
  const {
    id = 'actor1',
    name = 'Test Actor',
    gender = 'male',
    additionalComponents = new Map(),
  } = config;

  const baseComponents = new Map([
    ['core:name', { text: name }],
    ['core:gender', { value: gender }],
    ['core:actor', {}],
  ]);

  // Merge additional components
  const allComponents = new Map([...baseComponents, ...additionalComponents]);

  return {
    id,
    componentTypeIds: Array.from(allComponents.keys()),
    getAllComponents: () => allComponents,
    getComponentData: function (componentId) {
      return this.getAllComponents().get(componentId);
    },
    hasComponent: function (componentId) {
      return this.getAllComponents().has(componentId);
    },
  };
}

/**
 * Helper: Create mock logger
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 * Helper: Create mock JSON logic evaluation service
 *
 * @param returnValue
 */
function createMockJsonLogic(returnValue = true) {
  return {
    evaluate: jest.fn(() => returnValue),
  };
}

/**
 * Helper: Create mock entity manager
 *
 * @param entityMap
 */
function createMockEntityManager(entityMap = new Map()) {
  return {
    getEntityInstance: jest.fn((id) => entityMap.get(id)),
  };
}

describe('ActivityFilteringSystem - Migrated Tests (Phase 3 Batch 1)', () => {
  let filteringSystem;
  let mockLogger;
  let conditionValidator;
  let mockJsonLogicEvaluationService;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    conditionValidator = new ActivityConditionValidator({ logger: mockLogger });
    mockJsonLogicEvaluationService = createMockJsonLogic(true);
    mockEntityManager = createMockEntityManager();

    filteringSystem = new ActivityFilteringSystem({
      logger: mockLogger,
      conditionValidator,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
    });
  });

  // ------------------------------------------------------------------------
  // Property-based Filtering (2 tests migrated from lines 537-571)
  // ------------------------------------------------------------------------
  describe('Property-based Filtering (showOnlyIfProperty)', () => {
    it('should filter activities based on showOnlyIfProperty conditions', () => {
      const activity = {
        sourceData: { state: 'active' },
        conditions: {
          showOnlyIfProperty: {
            property: 'state',
            equals: 'active',
          },
        },
      };

      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
    });

    it('should hide activities when property does not match', () => {
      const activity = {
        sourceData: { state: 'inactive' },
        conditions: {
          showOnlyIfProperty: {
            property: 'state',
            equals: 'active',
          },
        },
      };

      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(false);
    });
  });

  // ------------------------------------------------------------------------
  // Required Component Checks (3 tests migrated from lines 577-626)
  // ------------------------------------------------------------------------
  describe('Required Component Checks', () => {
    it('should show activities when all required components are present', () => {
      const entity = createStandardEntity({
        id: 'actor1',
        additionalComponents: new Map([
          ['positioning:kneeling', {}],
          ['positioning:facing_target', {}],
        ]),
      });

      const activity = {
        conditions: {
          requiredComponents: [
            'positioning:kneeling',
            'positioning:facing_target',
          ],
        },
      };

      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
    });

    it('should hide activities when required components are missing', () => {
      const entity = createStandardEntity({ id: 'actor1' });

      const activity = {
        conditions: {
          requiredComponents: ['positioning:kneeling'],
        },
      };

      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(false);
    });

    it('should handle empty required components array', () => {
      const entity = createStandardEntity();
      const activity = {
        conditions: {
          requiredComponents: [],
        },
      };

      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  // Forbidden Component Checks (3 tests migrated from lines 632-680)
  // ------------------------------------------------------------------------
  describe('Forbidden Component Checks', () => {
    it('should hide activities when forbidden components are present', () => {
      const entity = createStandardEntity({
        id: 'actor1',
        additionalComponents: new Map([['lying-states:lying_on', {}]]),
      });

      const activity = {
        conditions: {
          forbiddenComponents: ['lying-states:lying_on'],
        },
      };

      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(false);
    });

    it('should show activities when no forbidden components are present', () => {
      const entity = createStandardEntity({ id: 'actor1' });

      const activity = {
        conditions: {
          forbiddenComponents: ['lying-states:lying_on'],
        },
      };

      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
    });

    it('should handle empty forbidden components array', () => {
      const entity = createStandardEntity();
      const activity = {
        conditions: {
          forbiddenComponents: [],
        },
      };

      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  // Custom JSON Logic Conditions (3 tests migrated from lines 686-756)
  // ------------------------------------------------------------------------
  describe('Custom JSON Logic Conditions', () => {
    it('should evaluate custom logic conditions successfully', () => {
      // Create fresh instances with custom JSON logic service
      const customJsonLogic = createMockJsonLogic(true);
      const customFilteringSystem = new ActivityFilteringSystem({
        logger: mockLogger,
        conditionValidator,
        jsonLogicEvaluationService: customJsonLogic,
        entityManager: mockEntityManager,
      });

      const entity = createStandardEntity();
      const activity = {
        conditions: {
          customLogic: { '==': [{ var: 'entity.id' }, 'actor1'] },
        },
      };

      const hooks = customFilteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
      expect(customJsonLogic.evaluate).toHaveBeenCalled();
    });

    it('should fail open on JSON logic evaluation errors', () => {
      // Create filtering system with throwing JSON logic service
      const throwingJsonLogic = {
        evaluate: jest.fn(() => {
          throw new Error('Logic error');
        }),
      };

      const customFilteringSystem = new ActivityFilteringSystem({
        logger: mockLogger,
        conditionValidator,
        jsonLogicEvaluationService: throwingJsonLogic,
        entityManager: mockEntityManager,
      });

      const entity = createStandardEntity();
      const activity = {
        conditions: {
          customLogic: { invalid: 'logic' },
        },
      };

      const hooks = customFilteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true); // Fail open
    });

    it('should build correct logic context with entity and target data', () => {
      const entity = createStandardEntity({ id: 'actor1', name: 'John' });
      const targetEntity = createStandardEntity({
        id: 'target1',
        name: 'Alice',
      });

      const entityMap = new Map([
        ['actor1', entity],
        ['target1', targetEntity],
      ]);

      const customEntityManager = createMockEntityManager(entityMap);
      const customFilteringSystem = new ActivityFilteringSystem({
        logger: mockLogger,
        conditionValidator,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        entityManager: customEntityManager,
      });

      const activity = {
        targetEntityId: 'target1',
        sourceData: { someData: 'value' },
      };

      const hooks = customFilteringSystem.getTestHooks();
      const context = hooks.buildLogicContext(activity, entity);

      expect(context.entity).toBeDefined();
      expect(context.entity.id).toBe('actor1');
      expect(context.target).toBeDefined();
      expect(context.target.id).toBe('target1');
      expect(context.activity).toEqual({ someData: 'value' });
    });
  });

  // ------------------------------------------------------------------------
  // shouldDescribeInActivity Flag (3 tests migrated from lines 762-801)
  // ------------------------------------------------------------------------
  describe('shouldDescribeInActivity Flag', () => {
    it('should hide activities when shouldDescribeInActivity is false', () => {
      const activity = {
        metadata: {
          shouldDescribeInActivity: false,
        },
      };

      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(false);
    });

    it('should show activities when shouldDescribeInActivity is true', () => {
      const activity = {
        metadata: {
          shouldDescribeInActivity: true,
        },
      };

      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
    });

    it('should show activities when shouldDescribeInActivity is undefined', () => {
      const activity = {
        metadata: {},
      };

      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();
      const result = hooks.evaluateActivityVisibility(activity, entity);

      expect(result).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  // Additional Hook Tests (3 tests migrated from lines 1529-1552, 1636)
  // ------------------------------------------------------------------------
  describe('Direct Hook Tests', () => {
    it('should handle empty activities in filtering', () => {
      const entity = createStandardEntity();
      const result = filteringSystem.filterByConditions([], entity);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });

    it('should handle empty required components array', () => {
      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();
      const result = hooks.conditionValidator.hasRequiredComponents(entity, []);

      expect(result).toBe(true);
    });

    it('should handle empty forbidden components array', () => {
      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();
      const result = hooks.conditionValidator.hasForbiddenComponents(
        entity,
        []
      );

      expect(result).toBe(false);
    });

    it('should not throw when building logic context', () => {
      const activity = {
        targetEntityId: 'target1',
        sourceData: { test: 'data' },
      };
      const entity = createStandardEntity();
      const hooks = filteringSystem.getTestHooks();

      expect(() => hooks.buildLogicContext(activity, entity)).not.toThrow();
    });
  });
});
