/**
 * @file Integration tests for sex-breastplay:squeeze_breasts_ardently action discovery.
 * @description Validates action availability across face-to-face and actor-behind orientations with uncovered breasts.
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
  SQUEEZE_BREASTS_ARDENTLY_ACTION_ID as ACTION_ID,
  SQUEEZE_BREASTS_ARDENTLY_ACTOR_ID as ACTOR_ID,
  SQUEEZE_BREASTS_ARDENTLY_SCOPE_ID as SCOPE_ID,
  buildSqueezeBreastsArdentlyScenario,
  installSqueezeBreastsArdentlyScopeOverride,
} from '../../../common/mods/sex/squeezeBreastsArdentlyFixtures.js';
import squeezeBreastsArdentlyAction from '../../../../data/mods/sex-breastplay/actions/squeeze_breasts_ardently.action.json';

/**
 * @description Registers the squeeze breasts ardently action for discovery lookups.
 * @param {ModTestFixture} fixture - Active mod test fixture instance.
 * @returns {void}
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([squeezeBreastsArdentlyAction]);
}

describe('sex-breastplay:squeeze_breasts_ardently action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-breastplay',
      ACTION_ID,
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['positioning', 'anatomy'],
      }
    );

    restoreScopeResolver =
      installSqueezeBreastsArdentlyScopeOverride(testFixture);
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
      expect(squeezeBreastsArdentlyAction.id).toBe(ACTION_ID);
      expect(squeezeBreastsArdentlyAction.name).toBe(
        'Squeeze Breasts Ardently'
      );
      expect(squeezeBreastsArdentlyAction.description).toBe(
        "Grip your partner's breasts firmly and squeeze them with fervor."
      );
      expect(squeezeBreastsArdentlyAction.template).toBe(
        "grab {target}'s breasts ardently"
      );
      expect(squeezeBreastsArdentlyAction.prerequisites).toEqual([]);

      expect(squeezeBreastsArdentlyAction.targets.primary.scope).toBe(SCOPE_ID);
      expect(squeezeBreastsArdentlyAction.targets.primary.placeholder).toBe(
        'target'
      );
      expect(squeezeBreastsArdentlyAction.targets.primary.description).toBe(
        'Partner whose breasts are being squeezed ardently'
      );

      expect(squeezeBreastsArdentlyAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(squeezeBreastsArdentlyAction.forbidden_components.actor).toEqual([
        'sex-states:giving_blowjob',
      ]);

      expect(squeezeBreastsArdentlyAction.visual).toEqual({
        backgroundColor: '#7a1d58',
        textColor: '#fde6f2',
        hoverBackgroundColor: '#8d2465',
        hoverTextColor: '#fff2f9',
      });
    });
  });

  describe('Action discoverability constraints', () => {
    it('appears for close partners with exposed breasts facing each other', () => {
      const { entities } = buildSqueezeBreastsArdentlyScenario();
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
      expect(discovered.template).toBe("grab {target}'s breasts ardently");
    });

    it('appears when the target faces away allowing the actor to move behind them', () => {
      const { entities } = buildSqueezeBreastsArdentlyScenario({
        targetFacingAwayFromActor: true,
      });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
    });

    it('does not appear when closeness is missing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildSqueezeBreastsArdentlyScenario({
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
      const { entities } = buildSqueezeBreastsArdentlyScenario({
        includeBreastAnatomy: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery(testFixture);

      const actions = testFixture.discoverActions(ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
      warnSpy.mockRestore();
    });

    it("does not appear when the target's breasts are covered", () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { entities } = buildSqueezeBreastsArdentlyScenario({
        breastsCovered: true,
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
      const { entities } = buildSqueezeBreastsArdentlyScenario({
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
