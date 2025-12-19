/**
 * @file Integration tests for sex-vaginal-penetration:ride_penis_greedily action discovery.
 * @description Verifies greedy riding action metadata, scope resolution, component requirements,
 * and prerequisite gating while the actor is being vaginally penetrated by a partner.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildRidePenisGreedilyScenario,
  installStraddlingMilkingScopeOverrides,
  RIDE_PENIS_GREEDILY_ACTION_ID,
  STRADDLING_MILKING_ACTOR_ID,
  STRADDLING_MILKING_PRIMARY_ID,
} from '../../../common/mods/sex/straddlingPenisMilkingFixtures.js';
import ridePenisGreedilyAction from '../../../../data/mods/sex-vaginal-penetration/actions/ride_penis_greedily.action.json';

const ACTION_ID = RIDE_PENIS_GREEDILY_ACTION_ID;

describe('sex-vaginal-penetration:ride_penis_greedily action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  /**
   * @description Builds the action index so discovery can surface the greedy riding action.
   */
  function configureActionDiscovery() {
    testFixture.testEnv.actionIndex.buildIndex([ridePenisGreedilyAction]);
  }

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-vaginal-penetration',
      ACTION_ID
    );
    restoreScopeResolver = installStraddlingMilkingScopeOverrides(testFixture);
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

  describe('Action structure validation', () => {
    it('defines metadata and template correctly', () => {
      expect(ridePenisGreedilyAction.id).toBe(ACTION_ID);
      expect(ridePenisGreedilyAction.template).toBe(
        "ride {primary}'s penis greedily"
      );
      expect(ridePenisGreedilyAction.targets.primary.scope).toBe(
        'sex-vaginal-penetration:actors_fucking_me_vaginally'
      );
    });

    it('requires active vaginal penetration posture and forbids seating conflicts', () => {
      expect(ridePenisGreedilyAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
        'sex-states:being_fucked_vaginally',
      ]);
      expect(ridePenisGreedilyAction.forbidden_components.actor).toEqual([
        'sitting-states:sitting_on',
      ]);
    });

    it('enforces vagina ownership and exposure prerequisites', () => {
      expect(ridePenisGreedilyAction.prerequisites).toEqual([
        {
          logic: { hasPartOfType: ['actor', 'vagina'] },
          failure_message: 'You need a vagina to perform this action.',
        },
        {
          logic: { not: { isSocketCovered: ['actor', 'vagina'] } },
          failure_message:
            'Your vagina must be uncovered to perform this action.',
        },
      ]);
    });
  });

  describe('Action discovery scenarios', () => {
    it('appears when the actor is being vaginally penetrated by the partner', async () => {
      const entities = buildRidePenisGreedilyScenario();
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance(
        STRADDLING_MILKING_ACTOR_ID
      );
      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          ridePenisGreedilyAction.prerequisites,
          ridePenisGreedilyAction,
          actorEntity
        );
      expect(prerequisitesPassed).toBe(true);

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
    });

    it('appears when the partner faces away but maintains penetration', async () => {
      const entities = buildRidePenisGreedilyScenario({
        targetFacingAway: true,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
    });

    it('remains available even when the actor is not straddling the partner', async () => {
      const entities = buildRidePenisGreedilyScenario({
        includeStraddling: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
    });

    it('does not appear without closeness', async () => {
      const entities = buildRidePenisGreedilyScenario({
        includeCloseness: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the partner lacks the vaginal fucking state', async () => {
      const entities = buildRidePenisGreedilyScenario({
        primaryAlreadyFucking: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor is sitting on furniture', async () => {
      const entities = buildRidePenisGreedilyScenario({ actorSitting: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor vagina is covered', async () => {
      const entities = buildRidePenisGreedilyScenario({ coverVagina: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance(
        STRADDLING_MILKING_ACTOR_ID
      );
      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          ridePenisGreedilyAction.prerequisites,
          ridePenisGreedilyAction,
          actorEntity
        );
      expect(prerequisitesPassed).toBe(false);

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor lacks a vagina', async () => {
      const entities = buildRidePenisGreedilyScenario({ includeVagina: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance(
        STRADDLING_MILKING_ACTOR_ID
      );
      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          ridePenisGreedilyAction.prerequisites,
          ridePenisGreedilyAction,
          actorEntity
        );
      expect(prerequisitesPassed).toBe(false);

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the partner penis is covered', async () => {
      const entities = buildRidePenisGreedilyScenario({
        coverPenis: true,
        primaryAlreadyFucking: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the partner lacks a penis', async () => {
      const entities = buildRidePenisGreedilyScenario({
        includePenis: false,
        primaryAlreadyFucking: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor lacks the vaginal penetration state', async () => {
      const entities = buildRidePenisGreedilyScenario({
        actorBeingFucked: false,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(
        STRADDLING_MILKING_ACTOR_ID
      );
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });
  });
});
