/**
 * @file Unit tests for HasComponentOperator
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { HasComponentOperator } from '../../../../src/logic/operators/hasComponentOperator.js';
import {
  clearPlanningStateDiagnostics,
  getPlanningStateDiagnostics,
} from '../../../../src/goap/planner/planningStateDiagnostics.js';

describe('HasComponentOperator', () => {
  let testBed;
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('entityManager', [
      'hasComponent',
      'getComponentData',
    ]);
    clearPlanningStateDiagnostics();

    operator = new HasComponentOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    clearPlanningStateDiagnostics();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(operator).toBeDefined();
    });

    it('should throw error if entityManager is missing', () => {
      expect(() => {
        new HasComponentOperator({ logger: mockLogger });
      }).toThrow('HasComponentOperator: Missing required dependencies');
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new HasComponentOperator({ entityManager: mockEntityManager });
      }).toThrow('HasComponentOperator: Missing required dependencies');
    });
  });

  describe('evaluate', () => {
    it('should return true when entity has the specified component', () => {
      const entity = { id: 'entity-1' };
      const context = { entity };

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('entity-1', 'movement:is_dimensional_portal');
    });

    it('should return false when entity does not have the specified component', () => {
      const entity = { id: 'entity-1' };
      const context = { entity };

      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('entity-1', 'movement:is_dimensional_portal');
    });

    it('should resolve nested entity paths like entity.blocker', () => {
      const blocker = { id: 'blocker-1' };
      const entity = { blocker };
      const context = { entity };

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['entity.blocker', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('blocker-1', 'movement:is_dimensional_portal');
    });

    it('should return false when entity path resolves to null', () => {
      const context = { entity: null };

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when entity path resolves to undefined', () => {
      const context = {};

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when entity has no id', () => {
      const entity = { name: 'test' };
      const context = { entity };
      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should handle entity as string ID', () => {
      const context = { entityId: 'entity-1' };

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['entityId', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('entity-1', 'movement:is_dimensional_portal');
    });

    it('should return false with invalid parameters', () => {
      const result = operator.evaluate(null, {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when parameters array is empty', () => {
      const result = operator.evaluate([], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should return false when only one parameter is provided', () => {
      const result = operator.evaluate(['entity'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log errors and return false on exceptions', () => {
      const entity = { id: 'entity-1' };
      const context = { entity };

      mockEntityManager.hasComponent.mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle JSON Logic expressions in entityPath parameter', () => {
      const blocker = { id: 'blocker-1' };
      const context = { entity: { blocker } };

      mockEntityManager.hasComponent.mockReturnValue(true);

      // Pass a JSON Logic expression as the first parameter
      const result = operator.evaluate([{ var: 'entity.blocker' }, 'movement:is_dimensional_portal'], context);

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith('blocker-1', 'movement:is_dimensional_portal');
    });

    it('should accept entity objects directly without additional resolution', () => {
      const directEntity = { id: 'direct-entity-id' };

      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate([directEntity, 'movement:is_dimensional_portal'], {});

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'direct-entity-id',
        'movement:is_dimensional_portal'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Received entity object directly')
      );
    });

    it('should treat unresolved strings as entity IDs when they are not context paths', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = operator.evaluate(['orphan-entity-id', 'movement:is_dimensional_portal'], {});

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'orphan-entity-id',
        'movement:is_dimensional_portal'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('treating as entity ID')
      );
    });

    it('should return false and warn when entityPath is of an invalid type', () => {
      const result = operator.evaluate([123, 'movement:is_dimensional_portal'], {});

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityPath type')
      );
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    it('should return false and warn when componentId is empty', () => {
      const context = { entity: { id: 'entity-1' } };

      const result = operator.evaluate(['entity', '   '], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid componentId')
      );
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    it('should warn and return false when resolved entity ID is invalid', () => {
      const context = { entity: { id: '   ' } };

      const result = operator.evaluate(['entity', 'movement:is_dimensional_portal'], context);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entity ID at path entity')
      );
    });

    describe('planning state awareness', () => {
      it('should short-circuit to planning state hash when component entry exists', () => {
        const context = {
          state: {
            'entity-1:core:armed': { equipped: true },
          },
        };

        const result = operator.evaluate(['entity-1', 'core:armed'], context);

        expect(result).toBe(true);
        expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
      });

      it('should return false from planning state when entry exists but is falsy without hitting entity manager', () => {
        const context = {
          state: {
            'entity-1:core:armed': null,
          },
        };

        const result = operator.evaluate(['entity-1', 'core:armed'], context);

        expect(result).toBe(false);
        expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
      });

      it('should treat missing planning state entries as absent without hitting entity manager', () => {
        const context = {
          state: {},
        };

        const result = operator.evaluate(['entity-1', 'core:armed'], context);

        expect(result).toBe(false);
        expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
      });

      it('logs structured planning-state unknown diagnostics and records telemetry counters on misses', () => {
        const context = {
          state: {
            actor: { id: 'actor-telemetry' },
          },
        };

        expect(operator.evaluate(['entity-telemetry', 'core:armed'], context)).toBe(false);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'has_component:planning_state_unknown',
          expect.objectContaining({
            entityId: 'entity-telemetry',
            componentId: 'core:armed',
            actorId: 'actor-telemetry',
          })
        );

        const diagnostics = getPlanningStateDiagnostics('actor-telemetry');
        expect(diagnostics.telemetry).toEqual(
          expect.objectContaining({
            totalLookups: 1,
            unknownStatuses: 1,
            fallbacks: 0,
            cacheHits: 0,
          })
        );
        expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
      });
    });
  });
});
