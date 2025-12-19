/**
 * @file Integration tests for discovering sex-physical-control:guide_hand_to_clothed_crotch.
 * @description Validates availability gates for guiding a partner's hand to a clothed crotch bulge.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import {
  GUIDE_HAND_TO_CLOTHED_CROTCH_ACTION_ID as ACTION_ID,
  GUIDE_HAND_TO_CLOTHED_CROTCH_ACTOR_ID as ACTOR_ID,
  buildGuideHandToClothedCrotchScenario,
} from '../../../common/mods/sex-physical-control/guideHandToClothedCrotchFixtures.js';
import guideHandAction from '../../../../data/mods/sex-physical-control/actions/guide_hand_to_clothed_crotch.action.json';

/**
 * Registers the guide hand to clothed crotch action with the discovery index.
 *
 * @param {ModTestFixture} fixture - Active mod test fixture.
 */
function registerGuideHandAction(fixture) {
  fixture.testEnv.actionIndex.buildIndex([guideHandAction]);
}

function entityHasHands(entityId, fixture) {
  const entity = fixture.entityManager.getEntityInstance(entityId);
  if (!entity) {
    return false;
  }

  const bodyRoot =
    entity.components?.['anatomy:body']?.body?.root ||
    entity.components?.['anatomy:body']?.root;
  if (!bodyRoot) {
    return false;
  }

  const queue = [bodyRoot];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const partId = queue.shift();
    const partEntity = fixture.entityManager.getEntityInstance(partId);
    const part = partEntity?.components?.['anatomy:part'];
    const subType = part?.subType;

    if (typeof subType === 'string' && subType.toLowerCase().includes('hand')) {
      return true;
    }

    const children = Array.isArray(part?.children) ? part.children : [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    }
  }

  return false;
}

/**
 * Installs a scope override for positioning:close_actors_facing_each_other_or_behind_target_with_hands.
 * Mirrors the production kneeling exclusions while leveraging the simplified test anatomy fixtures.
 *
 * @param {ModTestFixture} fixture - Active mod test fixture.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installCloseActorsFacingOrBehindOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (
      scopeName ===
      'positioning:close_actors_facing_each_other_or_behind_target_with_hands'
    ) {
      const actorId = context?.actor?.id;

      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);

      if (!actor) {
        return { success: true, value: new Set() };
      }

      if (!entityHasHands(actorId, fixture)) {
        return { success: true, value: new Set() };
      }

      const closenessPartners =
        actor.components?.['personal-space-states:closeness']?.partners || [];

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      const actorKneelingBefore =
        actor.components?.['positioning:kneeling_before']?.entityId || null;
      const actorFacingAway =
        actor.components?.['positioning:facing_away']?.facing_away_from || [];

      const validPartners = closenessPartners.filter((partnerId) => {
        if (!partnerId) {
          return false;
        }

        if (actorKneelingBefore === partnerId) {
          return false;
        }

        const partner = fixture.entityManager.getEntityInstance(partnerId);

        if (!partner) {
          return false;
        }

        const partnerKneelingBefore =
          partner.components?.['positioning:kneeling_before']?.entityId || null;

        if (partnerKneelingBefore === actorId) {
          return false;
        }

        const partnerFacingAway =
          partner.components?.['positioning:facing_away']?.facing_away_from ||
          [];

        const facingEachOther =
          !actorFacingAway.includes(partnerId) &&
          !partnerFacingAway.includes(actorId);
        const actorBehind = partnerFacingAway.includes(actorId);

        if (!(facingEachOther || actorBehind)) {
          return false;
        }

        return entityHasHands(partnerId, fixture);
      });

      return { success: true, value: new Set(validPartners) };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

describe('sex-physical-control:guide_hand_to_clothed_crotch discovery', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-physical-control',
      ACTION_ID
    );

    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
    restoreScopeResolver =
      installCloseActorsFacingOrBehindOverride(testFixture);
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

  it('surfaces when the actor is close, clothed, and eligible', async () => {
    const { entities } = buildGuideHandToClothedCrotchScenario();
    testFixture.reset(entities);
    registerGuideHandAction(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.template).toBe(
      "guide {primary}'s hand to the bulge of your crotch"
    );
  });

  it('is absent when the actor lacks a penis', async () => {
    const { entities } = buildGuideHandToClothedCrotchScenario({
      includeActorPenis: false,
    });
    testFixture.reset(entities);
    registerGuideHandAction(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it("is absent when the actor's penis is uncovered", async () => {
    const { entities } = buildGuideHandToClothedCrotchScenario({
      coverActorPenis: false,
    });
    testFixture.reset(entities);
    registerGuideHandAction(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('is absent without positioning closeness', async () => {
    const { entities } = buildGuideHandToClothedCrotchScenario({
      includeCloseness: false,
    });
    testFixture.reset(entities);
    registerGuideHandAction(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('is absent when the primary target lacks hands', async () => {
    const { entities } = buildGuideHandToClothedCrotchScenario({
      includeHandAnatomy: false,
    });
    testFixture.reset(entities);
    registerGuideHandAction(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('is absent when the actor is already receiving a blowjob', async () => {
    const { entities } = buildGuideHandToClothedCrotchScenario({
      includeReceivingBlowjob: true,
    });
    testFixture.reset(entities);
    registerGuideHandAction(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('is absent when the shared scope is blocked by kneeling posture', async () => {
    const { entities } = buildGuideHandToClothedCrotchScenario({
      includeKneelingConflict: true,
    });
    testFixture.reset(entities);
    registerGuideHandAction(testFixture);

    const actions = await testFixture.discoverActions(ACTOR_ID);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
