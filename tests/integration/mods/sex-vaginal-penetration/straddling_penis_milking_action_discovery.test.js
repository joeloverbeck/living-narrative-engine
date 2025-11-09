/**
 * @file Integration tests for sex-vaginal-penetration:straddling_penis_milking action discovery.
 * @description Verifies target scope resolution, component requirements, and prerequisite gating
 * for the straddling penis milking invitation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  buildStraddlingMilkingScenario,
  installStraddlingMilkingScopeOverrides,
  STRADDLING_MILKING_ACTION_ID,
  STRADDLING_MILKING_ACTOR_ID,
  STRADDLING_MILKING_PRIMARY_ID,
} from '../../../common/mods/sex/straddlingPenisMilkingFixtures.js';
import straddlingMilkingAction from '../../../../data/mods/sex-vaginal-penetration/actions/straddling_penis_milking.action.json';

const ACTION_ID = STRADDLING_MILKING_ACTION_ID;

describe('sex-vaginal-penetration:straddling_penis_milking action discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  /**
   * @description Builds the action index so discovery can surface the test action.
   */
  function configureActionDiscovery() {
    testFixture.testEnv.actionIndex.buildIndex([straddlingMilkingAction]);
  }

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-vaginal-penetration', ACTION_ID);
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
      expect(straddlingMilkingAction.id).toBe(ACTION_ID);
      expect(straddlingMilkingAction.template).toBe("milk {primary}'s penis slowly");
      expect(straddlingMilkingAction.targets.primary.scope).toBe(
        'sex-vaginal-penetration:actors_with_uncovered_penis_facing_each_other_or_target_facing_away'
      );
    });

    it('requires active vaginal penetration posture and forbids seating conflicts', () => {
      expect(straddlingMilkingAction.required_components.actor).toEqual([
        'positioning:closeness',
        'positioning:straddling_waist',
        'positioning:being_fucked_vaginally',
      ]);
      expect(straddlingMilkingAction.forbidden_components.actor).toEqual([
        'positioning:sitting_on',
      ]);
    });

    it('enforces vagina ownership and exposure prerequisites', () => {
      expect(straddlingMilkingAction.prerequisites).toEqual([
        {
          logic: { hasPartOfType: ['actor', 'vagina'] },
          failure_message: 'You need a vagina to perform this action.',
        },
        {
          logic: { not: { isSocketCovered: ['actor', 'vagina'] } },
          failure_message: 'Your vagina must be uncovered to perform this action.',
        },
      ]);
    });
  });

  describe('Action discovery scenarios', () => {
    it('appears when the actor straddles a partner with an uncovered penis', async () => {
      const entities = buildStraddlingMilkingScenario();
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance(
        STRADDLING_MILKING_ACTOR_ID
      );
      const prerequisitesPassed = testFixture.testEnv.prerequisiteService.evaluate(
        straddlingMilkingAction.prerequisites,
        straddlingMilkingAction,
        actorEntity
      );
      expect(prerequisitesPassed).toBe(true);

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
    });

    it('appears when the partner faces away but remains straddled', async () => {
      const entities = buildStraddlingMilkingScenario({ targetFacingAway: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
    });

    it('remains available when penetration state components already exist', async () => {
      const entities = buildStraddlingMilkingScenario({
        actorBeingFucked: true,
        primaryAlreadyFucking: true,
      });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeDefined();
    });

    it('does not appear without closeness', async () => {
      const entities = buildStraddlingMilkingScenario({ includeCloseness: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor is not straddling the partner', async () => {
      const entities = buildStraddlingMilkingScenario({ includeStraddling: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor is sitting on furniture', async () => {
      const entities = buildStraddlingMilkingScenario({ actorSitting: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor vagina is covered', async () => {
      const entities = buildStraddlingMilkingScenario({ coverVagina: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance(
        STRADDLING_MILKING_ACTOR_ID
      );
      const prerequisitesPassed = testFixture.testEnv.prerequisiteService.evaluate(
        straddlingMilkingAction.prerequisites,
        straddlingMilkingAction,
        actorEntity
      );
      expect(prerequisitesPassed).toBe(false);

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor lacks a vagina', async () => {
      const entities = buildStraddlingMilkingScenario({ includeVagina: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actorEntity = testFixture.entityManager.getEntityInstance(
        STRADDLING_MILKING_ACTOR_ID
      );
      const prerequisitesPassed = testFixture.testEnv.prerequisiteService.evaluate(
        straddlingMilkingAction.prerequisites,
        straddlingMilkingAction,
        actorEntity
      );
      expect(prerequisitesPassed).toBe(false);

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the partner penis is covered', async () => {
      const entities = buildStraddlingMilkingScenario({ coverPenis: true });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the partner lacks a penis', async () => {
      const entities = buildStraddlingMilkingScenario({ includePenis: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });

    it('does not appear when the actor lacks the vaginal penetration state', async () => {
      const entities = buildStraddlingMilkingScenario({ actorBeingFucked: false });
      testFixture.reset(entities);
      configureActionDiscovery();

      const actions = await testFixture.discoverActions(STRADDLING_MILKING_ACTOR_ID);
      const discovered = actions.find((action) => action.id === ACTION_ID);

      expect(discovered).toBeUndefined();
    });
  });
});
