/**
 * @file Integration tests for the breathing:handle_oxygen_restoration rule.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import RestoreOxygenHandler from '../../../../src/logic/operationHandlers/restoreOxygenHandler.js';
import RemoveComponentHandler from '../../../../src/logic/operationHandlers/removeComponentHandler.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import oxygenRestorationRule from '../../../../data/mods/breathing/rules/handle_oxygen_restoration.rule.json';

const ACTOR_ID = 'test:actor';
const LUNG_ID = 'test:lung';
const ORGAN_COMPONENT = 'breathing-states:respiratory_organ';
const PART_COMPONENT = 'anatomy:part';
const SUBMERGED_COMPONENT = 'liquids-states:submerged';
const HYPOXIC_COMPONENT = 'breathing:hypoxic';
const ANOXIA_COMPONENT = 'breathing:unconscious_anoxia';

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
    RESTORE_OXYGEN: new RestoreOxygenHandler({
      logger,
      entityManager,
      safeEventDispatcher,
      jsonLogicService,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      logger,
      entityManager,
      safeEventDispatcher,
    }),
  };
}

describe('breathing:handle_oxygen_restoration rule integration', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = createRuleTestEnvironment({
      createHandlers,
      rules: [oxygenRestorationRule],
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
            currentOxygen: 1,
            depletionRate: 1,
          },
        },
      },
    ]);
  };

  it('restores oxygen and clears hypoxia/anoxia when not submerged', async () => {
    resetWithOrgan({
      [HYPOXIC_COMPONENT]: { severity: 'mild', turnsInState: 2 },
      [ANOXIA_COMPONENT]: { turnsUnconscious: 1 },
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    const organData = testEnv.entityManager.getComponentData(
      LUNG_ID,
      ORGAN_COMPONENT
    );
    expect(organData.currentOxygen).toBe(3);
    expect(testEnv.entityManager.hasComponent(ACTOR_ID, HYPOXIC_COMPONENT)).toBe(
      false
    );
    expect(testEnv.entityManager.hasComponent(ACTOR_ID, ANOXIA_COMPONENT)).toBe(
      false
    );
  });

  it('does not restore oxygen or clear status while submerged', async () => {
    resetWithOrgan({
      [SUBMERGED_COMPONENT]: {},
      [HYPOXIC_COMPONENT]: { severity: 'moderate', turnsInState: 4 },
      [ANOXIA_COMPONENT]: { turnsUnconscious: 2 },
    });

    await testEnv.eventBus.dispatch('core:turn_ended', {
      entityId: ACTOR_ID,
      success: true,
    });

    const organData = testEnv.entityManager.getComponentData(
      LUNG_ID,
      ORGAN_COMPONENT
    );
    expect(organData.currentOxygen).toBe(1);
    expect(testEnv.entityManager.hasComponent(ACTOR_ID, HYPOXIC_COMPONENT)).toBe(
      true
    );
    expect(testEnv.entityManager.hasComponent(ACTOR_ID, ANOXIA_COMPONENT)).toBe(
      true
    );
  });
});
