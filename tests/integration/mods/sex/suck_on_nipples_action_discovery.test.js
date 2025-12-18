/**
 * @file Integration tests for sex-breastplay:suck_on_nipples action discovery.
 * @description Ensures the action is available only when intimate breastplay requirements are met.
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
  buildNuzzleBareBreastsScenario as buildSuckOnNipplesScenario,
  installBareBreastsScopeOverride,
  NUZZLE_BARE_BREASTS_ACTOR_ID as BASE_ACTOR_ID,
  NUZZLE_BARE_BREASTS_TARGET_ID as BASE_TARGET_ID,
  NUZZLE_BARE_BREASTS_SCOPE_ID as BASE_SCOPE_ID,
} from '../../../common/mods/sex/nuzzleBareBreastsFixtures.js';
import suckOnNipplesAction from '../../../../data/mods/sex-breastplay/actions/suck_on_nipples.action.json';

const ACTION_ID = 'sex-breastplay:suck_on_nipples';
const ACTOR_ID = BASE_ACTOR_ID;
const SCOPE_ID = BASE_SCOPE_ID;

/**
 * @description Registers the suck on nipples action for discovery lookups.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckOnNipplesAction]);
}

describe('sex-breastplay:suck_on_nipples action discovery', () => {
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
    it('matches the expected structure and presentation', () => {
      expect(suckOnNipplesAction.id).toBe(ACTION_ID);
      expect(suckOnNipplesAction.name).toBe('Suck On Nipples');
      expect(suckOnNipplesAction.description).toBe(
        "Take the target's nipples into your mouth and nurse them hungrily."
      );
      expect(suckOnNipplesAction.template).toBe("suck on {target}'s nipples");
      expect(suckOnNipplesAction.prerequisites).toEqual([]);

      expect(suckOnNipplesAction.targets.primary.scope).toBe(SCOPE_ID);
      expect(suckOnNipplesAction.targets.primary.placeholder).toBe('target');
      expect(suckOnNipplesAction.targets.primary.description).toBe(
        "Partner whose nipples you're sucking"
      );

      expect(suckOnNipplesAction.required_components.actor).toEqual([
        'positioning:closeness',
      ]);
      expect(suckOnNipplesAction.forbidden_components.actor).toEqual([
        'sex-states:giving_blowjob',
        'positioning:bending_over',
      ]);

      expect(suckOnNipplesAction.visual).toEqual({
        backgroundColor: '#7a1d58',
        textColor: '#fde6f2',
        hoverBackgroundColor: '#8d2465',
        hoverTextColor: '#fff2f9',
      });
    });
  });

  describe('Action discoverability constraints', () => {
    it('appears for close partners with exposed breasts', () => {
      const { entities } = buildSuckOnNipplesScenario();
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
      expect(discovered.template).toBe("suck on {target}'s nipples");
    });

    it('does not appear when closeness is missing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildSuckOnNipplesScenario({
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
      const { entities } = buildSuckOnNipplesScenario({
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
      const { entities } = buildSuckOnNipplesScenario({
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
