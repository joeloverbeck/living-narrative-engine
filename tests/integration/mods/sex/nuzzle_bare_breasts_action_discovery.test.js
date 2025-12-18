/**
 * @file Integration tests for sex-breastplay:nuzzle_bare_breasts action discovery.
 * @description Validates action availability for close partners with exposed breasts and forbidden state handling.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  NUZZLE_BARE_BREASTS_ACTION_ID as ACTION_ID,
  NUZZLE_BARE_BREASTS_ACTOR_ID as ACTOR_ID,
  NUZZLE_BARE_BREASTS_SCOPE_ID as SCOPE_ID,
  buildNuzzleBareBreastsScenario,
  installBareBreastsScopeOverride,
} from '../../../common/mods/sex/nuzzleBareBreastsFixtures.js';
import nuzzleBareBreastsAction from '../../../../data/mods/sex-breastplay/actions/nuzzle_bare_breasts.action.json';

/**
 * @description Registers the nuzzle bare breasts action for discovery lookups.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([nuzzleBareBreastsAction]);
}

describe('sex-breastplay:nuzzle_bare_breasts action discovery', () => {
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
      expect(nuzzleBareBreastsAction.id).toBe(ACTION_ID);
      expect(nuzzleBareBreastsAction.name).toBe('Nuzzle Bare Breasts');
      expect(nuzzleBareBreastsAction.description).toBe(
        "Press your face tenderly against the target's uncovered chest."
      );
      expect(nuzzleBareBreastsAction.template).toBe(
        "nuzzle {target}'s breasts"
      );
      expect(nuzzleBareBreastsAction.prerequisites).toEqual([]);

      expect(nuzzleBareBreastsAction.targets.primary.scope).toBe(SCOPE_ID);
      expect(nuzzleBareBreastsAction.targets.primary.placeholder).toBe(
        'target'
      );
      expect(nuzzleBareBreastsAction.targets.primary.description).toBe(
        "Partner whose bare breasts you're nuzzling"
      );

      expect(nuzzleBareBreastsAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(nuzzleBareBreastsAction.forbidden_components.actor).toEqual([
        'sex-states:giving_blowjob',
        'positioning:bending_over',
      ]);

      expect(nuzzleBareBreastsAction.visual).toEqual({
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
      expect(discovered.template).toBe("nuzzle {target}'s breasts");
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
