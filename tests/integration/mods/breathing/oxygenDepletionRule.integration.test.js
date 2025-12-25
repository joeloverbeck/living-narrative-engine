/**
 * @file Integration tests for the breathing:handle_oxygen_depletion rule.
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import DepleteOxygenHandler from '../../../../src/logic/operationHandlers/depleteOxygenHandler.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import oxygenDepletionRule from '../../../../data/mods/breathing/rules/handle_oxygen_depletion.rule.json';

const ACTOR_ID = 'test:actor';
const LUNG_ID = 'test:lung';
const ORGAN_COMPONENT = 'breathing-states:respiratory_organ';
const PART_COMPONENT = 'anatomy:part';
const SUBMERGED_COMPONENT = 'liquids-states:submerged';

function createHandlers(entityManager, eventBus, logger, dataRegistry) {
  const safeEventDispatcher = {
    dispatch: (eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    },
  };

  const jsonLogicService = new JsonLogicEvaluationService({
    logger,
    gameDataRepository: dataRegistry,
  });

  return {
    DEPLETE_OXYGEN: new DepleteOxygenHandler({
      logger,
      entityManager,
      safeEventDispatcher,
      jsonLogicService,
    }),
  };
}

describe('breathing:handle_oxygen_depletion rule integration', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      createHandlers,
      rules: [oxygenDepletionRule],
    });
  });

  afterEach(() => {
    testEnv?.cleanup();
  });

  const resetWithOrgan = (actorComponents = {}) => {
    testEnv.reset([
      {
        id: ACTOR_ID,
        components: actorComponents,
      },
      {
        id: LUNG_ID,
        components: {
          [PART_COMPONENT]: { subType: 'lung', ownerEntityId: ACTOR_ID },
          [ORGAN_COMPONENT]: {
            respirationType: 'pulmonary',
            oxygenCapacity: 3,
            currentOxygen: 3,
            depletionRate: 1,
          },
        },
      },
    ]);
  };

  it('depletes oxygen each turn while submerged', async () => {
    resetWithOrgan({
      [SUBMERGED_COMPONENT]: {},
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    let organData = testEnv.entityManager.getComponentData(
      LUNG_ID,
      ORGAN_COMPONENT
    );
    expect(organData.currentOxygen).toBe(2);

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    organData = testEnv.entityManager.getComponentData(
      LUNG_ID,
      ORGAN_COMPONENT
    );
    expect(organData.currentOxygen).toBe(1);
  });

  it('does not deplete oxygen when not submerged', async () => {
    resetWithOrgan();

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    const organData = testEnv.entityManager.getComponentData(
      LUNG_ID,
      ORGAN_COMPONENT
    );
    expect(organData.currentOxygen).toBe(3);
  });
});
