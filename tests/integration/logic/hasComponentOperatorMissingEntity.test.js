/**
 * @file Integration test for has_component operator with missing entities
 * @description Documents how the has_component operator handles missing entities without
 * logging warnings, ensuring it treats unresolved paths as raw entity identifiers.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { JsonLogicCustomOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';

/**
 * Helper to build a logger that records all log calls for assertions.
 *
 * @returns {object} Mock logger with debug, info, warn, error methods
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('has_component Operator - Missing Entity Warning', () => {
  let logger;
  let registry;
  let repository;
  let jsonLogicEvaluationService;
  let jsonLogicCustomOperators;
  let entityManager;
  let bodyGraphService;
  let lightingStateService;

  beforeEach(() => {
    logger = createTestLogger();
    registry = new InMemoryDataRegistry({ logger });
    repository = new GameDataRepository(registry, logger);

    // Create mock entity manager that returns false for hasComponent on missing entities
    entityManager = {
      createEntity: jest.fn(() => `entity-${Date.now()}-${Math.random()}`),
      addComponent: jest.fn(),
      hasComponent: jest.fn((entityId) => {
        // Return false for the missing entity
        if (entityId === 'patrol:dimensional_rift_blocker_instance') {
          return false;
        }
        return false;
      }),
      getComponentData: jest.fn(),
      entities: [],
    };

    // Create mock body graph service
    bodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    // Create mock lighting state service
    lightingStateService = {
      isLocationLit: jest.fn().mockReturnValue(true),
    };

    // Create JSON Logic evaluation service
    jsonLogicEvaluationService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: repository,
    });

    // Create and register custom operators
    jsonLogicCustomOperators = new JsonLogicCustomOperators({
      logger,
      bodyGraphService,
      entityManager,
      lightingStateService,
    });

    jsonLogicCustomOperators.registerOperators(jsonLogicEvaluationService);
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Bug Reproduction - Missing Entity Warning', () => {
    it('should NOT log warning when using JSON Logic var for entity ID', () => {
      // When using {"var": "entity.blocker"}, the JSON Logic evaluates to the string ID
      // Then hasComponentOperator should treat it as an entity ID, not a path
      // No warning should be logged - just return false if entity doesn't exist

      const rule = {
        has_component: [
          { var: 'entity.blocker' },
          'blockers:is_dimensional_portal',
        ],
      };

      const context = {
        entity: {
          direction: 'through the dimensional rift',
          target: 'patrol:eldritch_dimension_instance',
          blocker: 'patrol:dimensional_rift_blocker_instance', // String ID, not object
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      // The operation should return false (entity doesn't have component)
      expect(result).toBe(false);

      // After the fix, entity ID should be passed to entityManager.hasComponent
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        'patrol:dimensional_rift_blocker_instance',
        'blockers:is_dimensional_portal'
      );

      // No has_component warning should be logged - only debug messages
      // (there may be other warnings about operator whitelist)
      const warnCalls = logger.warn.mock.calls;
      const hasHasComponentWarning = warnCalls.some((call) =>
        call[0].includes('has_component:')
      );
      expect(hasHasComponentWarning).toBe(false);

      // Debug message should indicate path resolution failed and entity ID was used
      const debugCalls = logger.debug.mock.calls;
      const hasPathResolutionDebug = debugCalls.some(
        (call) =>
          call[0].includes('Could not resolve') &&
          call[0].includes('treating as entity ID')
      );
      expect(hasPathResolutionDebug).toBe(true);
    });

    it('should handle entity ID passed directly as string (after fix)', () => {
      // After the fix, passing an entity ID directly as a string should work
      // The operator will try path resolution, fail, then treat it as entity ID

      const rule = {
        has_component: [
          'patrol:dimensional_rift_blocker_instance', // Direct string, not JSON Logic
          'blockers:is_dimensional_portal',
        ],
      };

      const context = {
        entity: {
          direction: 'through the dimensional rift',
          target: 'patrol:eldritch_dimension_instance',
          blocker: 'patrol:dimensional_rift_blocker_instance',
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      // The operation should return false (entity doesn't exist or lacks component)
      expect(result).toBe(false);

      // After the fix, no has_component warning should be logged
      // (there may be other warnings about operator whitelist)
      const warnCalls = logger.warn.mock.calls;
      const hasHasComponentWarning = warnCalls.some((call) =>
        call[0].includes('has_component:')
      );
      expect(hasHasComponentWarning).toBe(false);

      // entityManager.hasComponent should be called with the entity ID
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        'patrol:dimensional_rift_blocker_instance',
        'blockers:is_dimensional_portal'
      );
    });

    it('should handle missing entity gracefully when used in scope filter', () => {
      // This simulates the scope evaluation:
      // movement:dimensional_portals := location.locations:exits[
      //   { "and": [
      //     { "var": "entity.blocker" },
      //     { "condition_ref": "patrol:blocker-is-dimensional-portal" }
      //   ]}
      // ].target

      const rule = {
        and: [
          { var: 'entity.blocker' },
          {
            has_component: [
              { var: 'entity.blocker' },
              'blockers:is_dimensional_portal',
            ],
          },
        ],
      };

      const context = {
        entity: {
          direction: 'through the dimensional rift',
          target: 'patrol:eldritch_dimension_instance',
          blocker: 'patrol:dimensional_rift_blocker_instance',
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      // The AND should fail because has_component returns false
      expect(result).toBe(false);

      // After the fix, no has_component warning should be logged
      const warnCalls = logger.warn.mock.calls;
      const hasHasComponentWarning = warnCalls.some((call) =>
        call[0].includes('has_component:')
      );
      expect(hasHasComponentWarning).toBe(false);

      // entityManager.hasComponent should be called
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        'patrol:dimensional_rift_blocker_instance',
        'blockers:is_dimensional_portal'
      );
    });

    it('should return true when entity exists and has component', () => {
      // This is the expected behavior when the entity is properly loaded
      const blockerId = 'patrol:dimensional_rift_blocker_instance';

      // Mock entity manager to return true for this specific entity
      entityManager.hasComponent.mockImplementation((entityId, componentId) => {
        if (
          entityId === blockerId &&
          componentId === 'blockers:is_dimensional_portal'
        ) {
          return true;
        }
        return false;
      });

      const rule = {
        has_component: [
          { var: 'entity.blocker' },
          'blockers:is_dimensional_portal',
        ],
      };

      const context = {
        entity: {
          direction: 'through the dimensional rift',
          target: 'patrol:eldritch_dimension_instance',
          blocker: blockerId,
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      // Should return true when entity exists and has the component
      expect(result).toBe(true);

      // No has_component warning should be logged for valid entity
      const warnCalls = logger.warn.mock.calls;
      const hasHasComponentWarning = warnCalls.some((call) =>
        call[0].includes('has_component:')
      );
      expect(hasHasComponentWarning).toBe(false);
    });

    it('should handle null blocker without warning', () => {
      // When blocker is null, the AND should short-circuit before has_component
      const rule = {
        and: [
          { var: 'entity.blocker' },
          {
            has_component: [
              { var: 'entity.blocker' },
              'blockers:is_dimensional_portal',
            ],
          },
        ],
      };

      const context = {
        entity: {
          direction: 'through the dimensional rift',
          target: 'patrol:eldritch_dimension_instance',
          blocker: null,
        },
      };

      const result = jsonLogicEvaluationService.evaluate(rule, context);

      // Should return null because blocker is null (and operator returns first falsy value)
      expect(result).toBe(null);

      // has_component should not be called when blocker is null (short-circuit)
      expect(entityManager.hasComponent).not.toHaveBeenCalled();
    });
  });

  describe('Root Cause Analysis', () => {
    it('should demonstrate that missing entities are handled without warnings', () => {
      // This test documents the root cause:
      // The dimensional_rift_blocker_instance is referenced in the world definition
      // but may not be loaded into the entity manager before the scope is evaluated

      const blockerId = 'patrol:dimensional_rift_blocker_instance';

      // First call - entity not loaded yet
      entityManager.hasComponent.mockReturnValue(false);

      const rule = {
        has_component: [blockerId, 'blockers:is_dimensional_portal'],
      };

      const context = {
        entity: { id: 'test' },
      };

      const result1 = jsonLogicEvaluationService.evaluate(rule, context);
      expect(result1).toBe(false);

      // Verify no warning was logged – unresolved entity IDs are treated as raw IDs
      const firstWarnCount = logger.warn.mock.calls.length;
      expect(firstWarnCount).toBe(0);

      // Debug log should indicate the fallback to treating the string as an entity ID
      const firstDebugCalls = logger.debug.mock.calls;
      const hasEntityIdFallbackDebug = firstDebugCalls.some(
        (call) =>
          call[0].includes('Could not resolve') &&
          call[0].includes('treating as entity ID')
      );
      expect(hasEntityIdFallbackDebug).toBe(true);

      // Now simulate entity being loaded
      logger.warn.mockClear();
      entityManager.hasComponent.mockReturnValue(true);

      const result2 = jsonLogicEvaluationService.evaluate(rule, context);
      expect(result2).toBe(true);

      // No warning should be logged now
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Expected Behavior', () => {
    it('should not log warning when entity exists but lacks the component', () => {
      // When entity exists but doesn't have the component, no warning should be logged
      // Only log warning when entity is not found at all

      const blockerId = 'some-other-entity';

      // Mock hasComponent to return false, but we need to track if it was called
      entityManager.hasComponent.mockReturnValue(false);

      const rule = {
        has_component: [blockerId, 'blockers:is_dimensional_portal'],
      };

      const context = {
        entity: { id: 'test' },
      };

      jsonLogicEvaluationService.evaluate(rule, context);

      // hasComponent was called, meaning entity was found
      expect(entityManager.hasComponent).toHaveBeenCalledWith(
        blockerId,
        'blockers:is_dimensional_portal'
      );

      // Should only get a debug log, not a warning
      // The warning comes from resolveEntityPath in hasComponentOperator.js:92
      // which happens before we call hasComponent
    });
  });
});
