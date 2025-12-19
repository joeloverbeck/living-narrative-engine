import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityFilteringSystem from '../../../src/anatomy/services/filtering/activityFilteringSystem.js';
import ActivityConditionValidator from '../../../src/anatomy/services/validation/activityConditionValidator.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { registerActivityComponents } from './activityNaturalLanguageTestUtils.js';

describe('ActivityFilteringSystem integration coverage', () => {
  let testBed;
  let entityManager;
  let logger;
  let filteringSystem;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerActivityComponents(testBed);

    entityManager = testBed.entityManager;
    logger = testBed.logger;

    const conditionValidator = new ActivityConditionValidator({ logger });
    const jsonLogicEvaluationService = new JsonLogicEvaluationService({
      logger,
    });

    filteringSystem = new ActivityFilteringSystem({
      logger,
      conditionValidator,
      jsonLogicEvaluationService,
      entityManager,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('returns an empty array when activities input is invalid', async () => {
    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'actor_invalid_input',
    });

    const result = filteringSystem.filterByConditions(null, actor);

    expect(result).toEqual([]);
  });

  it('respects metadata opt-out when no conditions are provided', async () => {
    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'actor_metadata_opt_out',
    });

    const activity = {
      id: 'activity_hidden',
      visible: true,
      metadata: {
        shouldDescribeInActivity: false,
      },
    };

    const result = filteringSystem.filterByConditions([activity], actor);

    expect(result).toEqual([]);
  });

  it('keeps activities when property, component, and custom logic conditions are satisfied', async () => {
    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'actor_conditions_pass',
    });
    const partner = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'partner_conditions_pass',
    });

    await entityManager.addComponent(actor.id, 'personal-space-states:closeness', {
      partners: [partner.id],
    });
    await entityManager.addComponent(actor.id, 'core:gender', {
      value: 'nonbinary',
    });
    await entityManager.addComponent(partner.id, 'core:gender', {
      value: 'female',
    });

    const activity = {
      id: 'activity_visible',
      visible: true,
      sourceData: {
        priority: 80,
        category: 'intimate',
      },
      metadata: {
        shouldDescribeInActivity: true,
      },
      conditions: {
        showOnlyIfProperty: { property: 'category', equals: 'intimate' },
        requiredComponents: ['personal-space-states:closeness'],
        forbiddenComponents: ['test:activity_kneeling'],
        customLogic: {
          and: [
            { '==': [{ var: 'activity.priority' }, 80] },
            { '==': [{ var: 'target.id' }, partner.id] },
          ],
        },
      },
      targetEntityId: partner.id,
    };

    const result = filteringSystem.filterByConditions([activity], actor);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('activity_visible');
  });

  it('filters out activities when a forbidden component is present', async () => {
    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'actor_forbidden_component',
    });

    await entityManager.addComponent(actor.id, 'test:activity_kneeling', {
      entityId: actor.id,
    });

    const activity = {
      id: 'activity_blocked',
      visible: true,
      metadata: {
        shouldDescribeInActivity: true,
      },
      conditions: {
        forbiddenComponents: ['test:activity_kneeling'],
      },
    };

    const result = filteringSystem.filterByConditions([activity], actor);

    expect(result).toEqual([]);
  });

  it('filters out activities when custom logic evaluates to false', async () => {
    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'actor_custom_logic_false',
    });

    await entityManager.addComponent(actor.id, 'core:gender', {
      value: 'male',
    });

    const activity = {
      id: 'activity_logic_false',
      visible: true,
      sourceData: {
        priority: 42,
      },
      metadata: {
        shouldDescribeInActivity: true,
      },
      conditions: {
        customLogic: {
          '==': [{ var: 'activity.priority' }, 99],
        },
      },
    };

    const result = filteringSystem.filterByConditions([activity], actor);

    expect(result).toEqual([]);
  });

  it('fails open when custom logic evaluation throws and target entity resolution fails', async () => {
    class ThrowingJsonLogicService extends JsonLogicEvaluationService {
      evaluate() {
        throw new Error('json-logic failure');
      }
    }

    const throwingService = new ThrowingJsonLogicService({ logger });
    const conditionValidator = new ActivityConditionValidator({ logger });

    const failOpenFilteringSystem = new ActivityFilteringSystem({
      logger,
      conditionValidator,
      jsonLogicEvaluationService: throwingService,
      entityManager,
    });

    logger.warn.mockClear();

    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'actor_fail_open',
    });

    const activity = {
      id: 'activity_fail_open',
      visible: true,
      sourceData: {
        priority: 70,
      },
      metadata: {
        shouldDescribeInActivity: true,
      },
      conditions: {
        customLogic: {
          '==': [{ var: 'activity.priority' }, 70],
        },
      },
      targetEntityId: 123,
    };

    const result = failOpenFilteringSystem.filterByConditions(
      [activity],
      actor
    );

    expect(result).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to evaluate custom logic',
      expect.any(Error)
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to resolve target entity '123' for activity conditions",
      expect.any(Error)
    );
  });

  it('recovers from metadata access errors when evaluating activity visibility', async () => {
    const actor = await entityManager.createEntityInstance('core:actor', {
      instanceId: 'actor_metadata_error',
    });

    const baseActivity = {
      id: 'activity_broken_metadata',
      visible: true,
    };

    const activity = new Proxy(baseActivity, {
      get(target, prop, receiver) {
        if (prop === 'metadata') {
          throw new Error('metadata retrieval failed');
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    logger.warn.mockClear();

    const result = filteringSystem.filterByConditions([activity], actor);

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to evaluate activity visibility for activity metadata',
      expect.any(Error)
    );
  });
});
