/**
 * @file Integration tests for sex-breastplay:lick_breasts action discovery.
 * @description Validates action availability for close partners with exposed breasts and forbidden state handling.
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
  LICK_BREASTS_ACTION_ID as ACTION_ID,
  NUZZLE_BARE_BREASTS_ACTOR_ID as ACTOR_ID,
  NUZZLE_BARE_BREASTS_SCOPE_ID as SCOPE_ID,
  buildNuzzleBareBreastsScenario,
  installBareBreastsScopeOverride,
} from '../../../common/mods/sex/nuzzleBareBreastsFixtures.js';
import lickBreastsAction from '../../../../data/mods/sex-breastplay/actions/lick_breasts.action.json';

/**
 * @description Registers the lick breasts action for discovery lookups.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([lickBreastsAction]);
}

describe('sex-breastplay:lick_breasts action discovery', () => {
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

    restoreScopeResolver = installBareBreastsScopeOverride(testFixture);
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

  describe('Action definition alignment', () => {
    it('matches the expected action structure and presentation', () => {
      expect(lickBreastsAction.id).toBe(ACTION_ID);
      expect(lickBreastsAction.name).toBe('Lick Breasts');
      expect(lickBreastsAction.description).toBe(
        "Lick your partner's exposed breasts, savoring their warmth and softness."
      );
      expect(lickBreastsAction.template).toBe("lick {target}'s breasts");
      expect(lickBreastsAction.prerequisites).toEqual([]);

      expect(lickBreastsAction.targets.primary.scope).toBe(SCOPE_ID);
      expect(lickBreastsAction.targets.primary.placeholder).toBe('target');
      expect(lickBreastsAction.targets.primary.description).toBe(
        "Partner whose breasts you're licking"
      );

      expect(lickBreastsAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(lickBreastsAction.forbidden_components.actor).toEqual([
        'positioning:giving_blowjob',
        'positioning:bending_over',
      ]);

      expect(lickBreastsAction.visual).toEqual({
        backgroundColor: '#7a1d58',
        textColor: '#fde6f2',
        hoverBackgroundColor: '#8d2465',
        hoverTextColor: '#fff2f9',
      });
    });
  });

  describe('Action discoverability constraints', () => {
    it('appears for close partners with exposed breasts', () => {
      const { entities } = buildNuzzleBareBreastsScenario();
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
      expect(discovered.template).toBe("lick {target}'s breasts");
    });

    it('does not appear when closeness is missing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildNuzzleBareBreastsScenario({
        includeCloseness: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('does not appear when the target lacks breast anatomy', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildNuzzleBareBreastsScenario({
        includeBreastAnatomy: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('does not appear when the actor is giving a blowjob', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildNuzzleBareBreastsScenario({
        actorGivingBlowjob: true,
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
