/**
 * @file Integration tests for the sex-breastplay:latch_and_drink_milk action discovery.
 * @description Verifies the nursing card appears only when closeness, facing, and lactation requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildLatchAndDrinkMilkScenario,
  LATCH_AND_DRINK_MILK_ACTION_ID as ACTION_ID,
  LATCH_AND_DRINK_MILK_ACTOR_ID as ACTOR_ID,
  LATCH_AND_DRINK_MILK_SCOPE_ID as SCOPE_ID,
  installLatchAndDrinkMilkScopeOverride,
} from '../../../common/mods/sex/latchAndDrinkMilkFixtures.js';
import latchAndDrinkMilkAction from '../../../../data/mods/sex-breastplay/actions/latch_and_drink_milk.action.json';

/**
 * @description Registers the latch and drink milk action with the discovery index.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([latchAndDrinkMilkAction]);
}

describe('sex-breastplay:latch_and_drink_milk action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-breastplay',
      ACTION_ID,
      null,
      null,
      { autoRegisterScopes: true, scopeCategories: ['positioning', 'anatomy'] }
    );

    testFixture.suppressHints();
    restoreScopeResolver = installLatchAndDrinkMilkScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }

    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  describe('action metadata', () => {
    it('matches the expected structure', () => {
      expect(latchAndDrinkMilkAction.id).toBe(ACTION_ID);
      expect(latchAndDrinkMilkAction.name).toBe('Latch and Drink Milk');
      expect(latchAndDrinkMilkAction.description).toBe(
        'Seal your lips around the target\'s nipple and draw down their milk in slow, greedy pulls.'
      );
      expect(latchAndDrinkMilkAction.template).toBe("nurse at {target}'s breast");
      expect(latchAndDrinkMilkAction.prerequisites).toEqual([]);

      expect(latchAndDrinkMilkAction.targets.primary.scope).toBe(SCOPE_ID);
      expect(latchAndDrinkMilkAction.targets.primary.placeholder).toBe('target');
      expect(latchAndDrinkMilkAction.targets.primary.description).toBe(
        "Partner whose milk you're nursing"
      );

      expect(latchAndDrinkMilkAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(latchAndDrinkMilkAction.required_components.target).toEqual([
        'sex-breastplay:is_lactating',
      ]);
      expect(latchAndDrinkMilkAction.forbidden_components.actor).toEqual([
        'positioning:giving_blowjob',
      ]);

      expect(latchAndDrinkMilkAction.visual).toEqual({
        backgroundColor: '#7a1d58',
        textColor: '#fde6f2',
        hoverBackgroundColor: '#8d2465',
        hoverTextColor: '#fff2f9',
      });
    });
  });

  describe('discovery gates', () => {
    it('appears for close, facing partners when the target is lactating', () => {
      const { entities } = buildLatchAndDrinkMilkScenario();
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
      expect(discovered.template).toBe("nurse at {target}'s breast");
    });

    it('does not appear when the partners are not in closeness', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildLatchAndDrinkMilkScenario({ includeCloseness: false });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('does not appear when the target is not lactating', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildLatchAndDrinkMilkScenario({ targetLactating: false });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('does not appear when the actor is giving a blowjob', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildLatchAndDrinkMilkScenario({ actorGivingBlowjob: true });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('does not appear when the target is facing away from the actor', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildLatchAndDrinkMilkScenario({
        targetFacingAwayFromActor: true,
      });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });
  });
});
