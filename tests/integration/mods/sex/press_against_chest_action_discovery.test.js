/**
 * @file Integration tests for sex-breastplay:press_against_chest action discovery.
 * @description Validates action availability for close, front-facing partners where the actor has breasts.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  PRESS_AGAINST_CHEST_ACTION_ID as ACTION_ID,
  PRESS_AGAINST_CHEST_ACTOR_ID as ACTOR_ID,
  PRESS_AGAINST_CHEST_SCOPE_ID as SCOPE_ID,
  buildPressAgainstChestScenario,
} from '../../../common/mods/sex/pressAgainstChestFixtures.js';
import pressAgainstChestAction from '../../../../data/mods/sex-breastplay/actions/press_against_chest.action.json';

/**
 * @description Registers the press against chest action for discovery lookups.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pressAgainstChestAction]);
}

describe('sex-breastplay:press_against_chest action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-breastplay',
      ACTION_ID,
      null,
      null,
      { autoRegisterScopes: true, scopeCategories: ['positioning', 'anatomy'] }
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  describe('Action definition alignment', () => {
    it('matches the expected action structure and presentation', () => {
      expect(pressAgainstChestAction.id).toBe(ACTION_ID);
      expect(pressAgainstChestAction.name).toBe('Press Against Chest');
      expect(pressAgainstChestAction.description).toBe(
        "Press yourself against the target's chest, letting your breasts meet them head-on."
      );
      expect(pressAgainstChestAction.template).toBe(
        "press yourself against {target}'s chest"
      );
      expect(pressAgainstChestAction.prerequisites).toEqual([
        {
          logic: { hasPartOfType: ['actor', 'breast'] },
          failure_message: 'You need breasts to perform this action.',
        },
      ]);

      expect(pressAgainstChestAction.targets.primary.scope).toBe(SCOPE_ID);
      expect(pressAgainstChestAction.targets.primary.placeholder).toBe(
        'target'
      );
      expect(pressAgainstChestAction.targets.primary.description).toBe(
        'Partner facing you up close'
      );

      expect(pressAgainstChestAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);

      expect(pressAgainstChestAction.visual).toEqual({
        backgroundColor: '#7a1d58',
        textColor: '#fde6f2',
        hoverBackgroundColor: '#8d2465',
        hoverTextColor: '#fff2f9',
      });
    });
  });

  describe('Action discoverability constraints', () => {
    it('appears for close, front-facing partners when the actor has breasts', () => {
      const { entities } = buildPressAgainstChestScenario();
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
      expect(discovered.template).toBe(
        "press yourself against {target}'s chest"
      );
    });

    it('does not appear when closeness is missing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildPressAgainstChestScenario({
        includeCloseness: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('does not appear when the actor lacks breast anatomy', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildPressAgainstChestScenario({
        actorHasBreasts: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('does not appear when the partners are not facing each other', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildPressAgainstChestScenario({
        actorFacingAwayFromTarget: true,
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
