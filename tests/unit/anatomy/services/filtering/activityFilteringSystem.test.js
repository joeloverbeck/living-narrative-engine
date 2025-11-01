import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActivityFilteringSystem from '../../../../../src/anatomy/services/filtering/activityFilteringSystem.js';
import ActivityConditionValidator from '../../../../../src/anatomy/services/validation/activityConditionValidator.js';

describe('ActivityFilteringSystem', () => {
  let filteringSystem;
  let mockLogger;
  let mockConditionValidator;
  let mockJsonLogicEvaluationService;
  let mockEntityManager;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConditionValidator = {
      isEmptyConditionsObject: jest.fn((conditions) => {
        return !conditions || Object.keys(conditions).length === 0;
      }),
      matchesPropertyCondition: jest.fn(() => true),
      hasRequiredComponents: jest.fn(() => true),
      hasForbiddenComponents: jest.fn(() => false),
      extractEntityData: jest.fn((entity) => ({
        id: entity?.id,
        components: entity?.componentTypeIds || [],
      })),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn(() => true),
    };

    mockEntityManager = {
      getEntityInstance: jest.fn((id) => ({
        id,
        componentTypeIds: ['core:actor'],
      })),
    };

    filteringSystem = new ActivityFilteringSystem({
      logger: mockLogger,
      conditionValidator: mockConditionValidator,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      entityManager: mockEntityManager,
    });
  });

  describe('Constructor', () => {
    it('should accept null logger and create fallback', () => {
      expect(() => new ActivityFilteringSystem({
        logger: null,
        conditionValidator: mockConditionValidator,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        entityManager: mockEntityManager,
      })).not.toThrow();
    });

    it('should validate conditionValidator dependency', () => {
      expect(() => new ActivityFilteringSystem({
        logger: mockLogger,
        conditionValidator: null,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        entityManager: mockEntityManager,
      })).toThrow(/IActivityConditionValidator/);
    });

    it('should validate jsonLogicEvaluationService dependency', () => {
      expect(() => new ActivityFilteringSystem({
        logger: mockLogger,
        conditionValidator: mockConditionValidator,
        jsonLogicEvaluationService: null,
        entityManager: mockEntityManager,
      })).toThrow(/IJsonLogicEvaluationService/);
    });

    it('should validate entityManager dependency', () => {
      expect(() => new ActivityFilteringSystem({
        logger: mockLogger,
        conditionValidator: mockConditionValidator,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        entityManager: null,
      })).toThrow(/IEntityManager/);
    });
  });

  describe('filterByConditions', () => {
    it('should return empty array when activities is null', () => {
      const result = filteringSystem.filterByConditions(null, {});
      expect(result).toEqual([]);
    });

    it('should return empty array when activities is empty array', () => {
      const result = filteringSystem.filterByConditions([], {});
      expect(result).toEqual([]);
    });

    it('should filter out activities with visible=false', () => {
      const activities = [
        { id: '1', visible: true },
        { id: '2', visible: false },
        { id: '3', visible: true },
      ];
      const result = filteringSystem.filterByConditions(activities, {});
      expect(result).toHaveLength(2);
      expect(result.map(a => a.id)).toEqual(['1', '3']);
    });

    it('should handle function-based conditions', () => {
      const mockCondition = jest.fn((entity) => entity.id === 'entity_1');
      const activities = [
        { id: '1', condition: mockCondition },
      ];
      const entity = { id: 'entity_1' };

      const result = filteringSystem.filterByConditions(activities, entity);

      expect(mockCondition).toHaveBeenCalledWith(entity);
      expect(result).toHaveLength(1);
    });

    it('should filter out activities when function condition returns false', () => {
      const activities = [
        { id: '1', condition: () => false },
      ];
      const result = filteringSystem.filterByConditions(activities, {});
      expect(result).toHaveLength(0);
    });

    it('should handle activities with empty conditions object', () => {
      mockConditionValidator.isEmptyConditionsObject.mockReturnValue(true);

      const activities = [
        { id: '1', conditions: {} },
      ];
      const result = filteringSystem.filterByConditions(activities, {});

      expect(result).toHaveLength(1);
    });

    it('should filter out activities with shouldDescribeInActivity=false in metadata', () => {
      mockConditionValidator.isEmptyConditionsObject.mockReturnValue(true);

      const activities = [
        {
          id: '1',
          metadata: { shouldDescribeInActivity: false },
          conditions: {}
        },
      ];
      const result = filteringSystem.filterByConditions(activities, {});

      expect(result).toHaveLength(0);
    });

    it('should handle showOnlyIfProperty condition', () => {
      mockConditionValidator.matchesPropertyCondition.mockReturnValue(false);

      const activities = [
        {
          id: '1',
          conditions: { showOnlyIfProperty: 'someProperty' }
        },
      ];
      const result = filteringSystem.filterByConditions(activities, {});

      expect(mockConditionValidator.matchesPropertyCondition).toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('should handle requiredComponents condition', () => {
      mockConditionValidator.hasRequiredComponents.mockReturnValue(false);

      const activities = [
        {
          id: '1',
          conditions: { requiredComponents: ['positioning:sitting'] }
        },
      ];
      const entity = { id: 'entity_1' };
      const result = filteringSystem.filterByConditions(activities, entity);

      expect(mockConditionValidator.hasRequiredComponents).toHaveBeenCalledWith(
        entity,
        ['positioning:sitting']
      );
      expect(result).toHaveLength(0);
    });

    it('should handle forbiddenComponents condition', () => {
      mockConditionValidator.hasForbiddenComponents.mockReturnValue(true);

      const activities = [
        {
          id: '1',
          conditions: { forbiddenComponents: ['positioning:kneeling'] }
        },
      ];
      const entity = { id: 'entity_1' };
      const result = filteringSystem.filterByConditions(activities, entity);

      expect(mockConditionValidator.hasForbiddenComponents).toHaveBeenCalledWith(
        entity,
        ['positioning:kneeling']
      );
      expect(result).toHaveLength(0);
    });

    it('should handle customLogic condition', () => {
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const activities = [
        {
          id: '1',
          conditions: {
            customLogic: { '==': [{ var: 'entity.id' }, 'entity_1'] }
          }
        },
      ];
      const entity = { id: 'entity_1' };
      const result = filteringSystem.filterByConditions(activities, entity);

      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should filter out when customLogic returns false', () => {
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

      const activities = [
        {
          id: '1',
          conditions: {
            customLogic: { '==': [{ var: 'entity.id' }, 'entity_2'] }
          }
        },
      ];
      const entity = { id: 'entity_1' };
      const result = filteringSystem.filterByConditions(activities, entity);

      expect(result).toHaveLength(0);
    });

    it('should fail open on JSON logic errors (include activity)', () => {
      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw new Error('Invalid JSON logic');
      });

      const activities = [
        {
          id: '1',
          conditions: {
            customLogic: { invalid: 'logic' }
          }
        },
      ];
      const result = filteringSystem.filterByConditions(activities, {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to evaluate custom logic',
        expect.any(Error)
      );
      expect(result).toHaveLength(1); // Fail open
    });

    it('should handle condition evaluation errors gracefully', () => {
      const activities = [
        {
          id: '1',
          condition: () => { throw new Error('Condition error'); }
        },
      ];
      const result = filteringSystem.filterByConditions(activities, {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Condition evaluation failed for activity description entry',
        expect.any(Error)
      );
      expect(result).toHaveLength(0);
    });

    it('should handle activities with targetEntityId in customLogic', () => {
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);
      mockEntityManager.getEntityInstance.mockReturnValue({
        id: 'target_1',
        componentTypeIds: ['core:actor'],
      });

      const activities = [
        {
          id: '1',
          targetEntityId: 'target_1',
          conditions: {
            customLogic: { '==': [{ var: 'target.id' }, 'target_1'] }
          }
        },
      ];
      const entity = { id: 'entity_1' };
      const result = filteringSystem.filterByConditions(activities, entity);

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target_1');
      expect(result).toHaveLength(1);
    });

    it('should handle missing target entity gracefully', () => {
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);
      mockEntityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      const activities = [
        {
          id: '1',
          targetEntityId: 'nonexistent',
          conditions: {
            customLogic: { '!=': [{ var: 'target' }, null] }
          }
        },
      ];
      const entity = { id: 'entity_1' };
      const result = filteringSystem.filterByConditions(activities, entity);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve target entity'),
        expect.any(Error)
      );
      expect(result).toHaveLength(1); // Still processes with null target
    });
  });

  describe('getTestHooks', () => {
    it('should expose evaluateActivityVisibility hook', () => {
      const hooks = filteringSystem.getTestHooks();
      expect(hooks.evaluateActivityVisibility).toBeDefined();
      expect(typeof hooks.evaluateActivityVisibility).toBe('function');
    });

    it('should expose buildLogicContext hook', () => {
      const hooks = filteringSystem.getTestHooks();
      expect(hooks.buildLogicContext).toBeDefined();
      expect(typeof hooks.buildLogicContext).toBe('function');
    });

    it('should allow testing evaluateActivityVisibility directly', () => {
      const hooks = filteringSystem.getTestHooks();
      const activity = { id: '1', visible: true };
      const entity = { id: 'entity_1' };

      const result = hooks.evaluateActivityVisibility(activity, entity);
      expect(result).toBe(true);
    });

    it('should allow testing buildLogicContext directly', () => {
      const hooks = filteringSystem.getTestHooks();
      const activity = {
        id: '1',
        targetEntityId: 'target_1',
        sourceData: { type: 'test' }
      };
      const entity = { id: 'entity_1', componentTypeIds: [] };

      const context = hooks.buildLogicContext(activity, entity);

      expect(context).toHaveProperty('entity');
      expect(context).toHaveProperty('activity');
      expect(context).toHaveProperty('target');
    });
  });

  describe('Integration with ActivityConditionValidator', () => {
    it('should create real condition validator when not provided in tests', () => {
      // This tests the pattern used in ActivityDescriptionService fallback
      const realValidator = new ActivityConditionValidator({
        logger: mockLogger
      });

      const system = new ActivityFilteringSystem({
        logger: mockLogger,
        conditionValidator: realValidator,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        entityManager: mockEntityManager,
      });

      const activities = [{ id: '1', conditions: {} }];
      const result = system.filterByConditions(activities, {});

      expect(result).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle activity with both metadata and activityMetadata', () => {
      const activities = [
        {
          id: '1',
          metadata: { shouldDescribeInActivity: true },
          activityMetadata: { shouldDescribeInActivity: false },
          conditions: {}
        },
      ];

      // Should prefer metadata over activityMetadata
      mockConditionValidator.isEmptyConditionsObject.mockReturnValue(true);
      const result = filteringSystem.filterByConditions(activities, {});

      expect(result).toHaveLength(1);
    });

    it('should handle complex multi-condition activity', () => {
      mockConditionValidator.matchesPropertyCondition.mockReturnValue(true);
      mockConditionValidator.hasRequiredComponents.mockReturnValue(true);
      mockConditionValidator.hasForbiddenComponents.mockReturnValue(false);
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const activities = [
        {
          id: '1',
          conditions: {
            showOnlyIfProperty: 'prop',
            requiredComponents: ['comp1'],
            forbiddenComponents: ['comp2'],
            customLogic: { '==': [1, 1] }
          }
        },
      ];
      const entity = { id: 'entity_1' };
      const result = filteringSystem.filterByConditions(activities, entity);

      expect(result).toHaveLength(1);
    });

    it('should short-circuit on first failing condition', () => {
      mockConditionValidator.matchesPropertyCondition.mockReturnValue(false);

      const activities = [
        {
          id: '1',
          conditions: {
            showOnlyIfProperty: 'missing',
            requiredComponents: ['comp1'],
            customLogic: { '==': [1, 1] }
          }
        },
      ];
      const result = filteringSystem.filterByConditions(activities, {});

      // Should stop at showOnlyIfProperty, not check other conditions
      expect(mockConditionValidator.hasRequiredComponents).not.toHaveBeenCalled();
      expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });
});
