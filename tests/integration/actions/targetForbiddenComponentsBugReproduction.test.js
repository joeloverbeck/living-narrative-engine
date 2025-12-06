/**
 * @file Integration test reproducing the forbidden_components bug
 * @description This test reproduces the exact bug where a character with
 * receiving_blowjob component can perform actions on someone with giving_blowjob
 * component, even though the action has giving_blowjob in forbidden_components.target
 *
 * BUG: kiss_cheek.action.json has:
 * {
 *   "forbidden_components": {
 *     "actor": ["kissing:kissing", "positioning:giving_blowjob"],
 *     "target": ["positioning:giving_blowjob"]
 *   }
 * }
 *
 * EXPECTED: Actor with receiving_blowjob should NOT be able to kiss someone with giving_blowjob
 * ACTUAL: Action is incorrectly allowed
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import kissCheekAction from '../../../data/mods/kissing/actions/kiss_cheek.action.json';

const ACTION_ID = 'kissing:kiss_cheek';

describe('Forbidden Components Bug Reproduction - giving_blowjob on target', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('kissing', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('BUG: Character receiving blowjob should NOT be able to kiss person giving blowjob', () => {
    it('should FAIL when target has giving_blowjob component (but currently PASSES incorrectly)', async () => {
      // Setup: Create three actors
      // - Actor (receiving blowjob from TargetGiving)
      // - TargetGiving (giving blowjob to Actor)
      // - TargetThird (normal, no blowjob components)

      const actor = new ModEntityBuilder('actor1')
        .withName('Receiving')
        .atLocation('room1')
        .asActor()
        .build();

      const targetGiving = new ModEntityBuilder('target1')
        .withName('Giving')
        .atLocation('room1')
        .asActor()
        .build();

      const targetThird = new ModEntityBuilder('target2')
        .withName('Normal')
        .atLocation('room1')
        .asActor()
        .build();

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Actor is receiving blowjob from TargetGiving
      actor.components['positioning:receiving_blowjob'] = {
        giving_entity_id: targetGiving.id,
        consented: true,
      };

      // TargetGiving is giving blowjob to Actor
      targetGiving.components['positioning:giving_blowjob'] = {
        receiving_entity_id: actor.id,
        initiated: true,
        consented: true,
      };

      // Set up closeness for all actors
      actor.components['positioning:closeness'] = {
        partners: [targetGiving.id, targetThird.id],
      };
      targetGiving.components['positioning:closeness'] = {
        partners: [actor.id, targetThird.id],
      };
      targetThird.components['positioning:closeness'] = {
        partners: [actor.id, targetGiving.id],
      };

      testFixture.reset([room, actor, targetGiving, targetThird]);

      // Configure action discovery
      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([kissCheekAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'kissing:close_actors_facing_each_other') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }
          const actorEntity = testEnv.entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }
          const closeness =
            actorEntity.components?.['positioning:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }
          return { success: true, value: new Set(closeness) };
        }
        return originalResolve(scopeName, context);
      };

      // BUG REPRODUCTION: Actor should NOT be able to kiss TargetGiving
      // because TargetGiving has giving_blowjob component
      // and kiss_cheek.action.json has "target": ["positioning:giving_blowjob"] in forbidden_components

      // With the fix applied, execution should be rejected
      await expect(async () => {
        await testFixture.executeAction(actor.id, targetGiving.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });

    it('should PASS when target does NOT have giving_blowjob component', async () => {
      const actor = new ModEntityBuilder('actor1')
        .withName('Receiving')
        .atLocation('room1')
        .asActor()
        .build();

      const targetGiving = new ModEntityBuilder('target1')
        .withName('Giving')
        .atLocation('room1')
        .asActor()
        .build();

      const targetThird = new ModEntityBuilder('target2')
        .withName('Normal')
        .atLocation('room1')
        .asActor()
        .build();

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Actor is receiving blowjob from TargetGiving
      actor.components['positioning:receiving_blowjob'] = {
        giving_entity_id: targetGiving.id,
        consented: true,
      };

      // TargetGiving is giving blowjob to Actor
      targetGiving.components['positioning:giving_blowjob'] = {
        receiving_entity_id: actor.id,
        initiated: true,
        consented: true,
      };

      // Set up closeness
      actor.components['positioning:closeness'] = {
        partners: [targetGiving.id, targetThird.id],
      };
      targetGiving.components['positioning:closeness'] = {
        partners: [actor.id, targetThird.id],
      };
      targetThird.components['positioning:closeness'] = {
        partners: [actor.id, targetGiving.id],
      };

      testFixture.reset([room, actor, targetGiving, targetThird]);

      // Configure action discovery
      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([kissCheekAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'kissing:close_actors_facing_each_other') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }
          const actorEntity = testEnv.entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }
          const closeness =
            actorEntity.components?.['positioning:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }
          return { success: true, value: new Set(closeness) };
        }
        return originalResolve(scopeName, context);
      };

      // Actor should be able to kiss TargetThird (no giving_blowjob component)
      await expect(
        testFixture.executeAction(actor.id, targetThird.id)
      ).resolves.not.toThrow();
    });
  });

  describe('Verification: Actor with giving_blowjob cannot initiate kiss', () => {
    it('should correctly REJECT when actor has giving_blowjob component', async () => {
      const actor = new ModEntityBuilder('actor1')
        .withName('Giving')
        .atLocation('room1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Receiving')
        .atLocation('room1')
        .asActor()
        .build();

      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      // Actor is giving blowjob to Target
      actor.components['positioning:giving_blowjob'] = {
        receiving_entity_id: target.id,
        initiated: true,
        consented: true,
      };

      // Target is receiving blowjob from Actor
      target.components['positioning:receiving_blowjob'] = {
        giving_entity_id: actor.id,
        consented: true,
      };

      // Set up closeness
      actor.components['positioning:closeness'] = {
        partners: [target.id],
      };
      target.components['positioning:closeness'] = {
        partners: [actor.id],
      };

      testFixture.reset([room, actor, target]);

      // Configure action discovery
      const { testEnv } = testFixture;
      testEnv.actionIndex.buildIndex([kissCheekAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve = scopeResolver.resolveSync.bind(scopeResolver);
      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'kissing:close_actors_facing_each_other') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }
          const actorEntity = testEnv.entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }
          const closeness =
            actorEntity.components?.['positioning:closeness']?.partners;
          if (!Array.isArray(closeness) || closeness.length === 0) {
            return { success: true, value: new Set() };
          }
          return { success: true, value: new Set(closeness) };
        }
        return originalResolve(scopeName, context);
      };

      // Actor with giving_blowjob should not be able to initiate kiss
      await expect(async () => {
        await testFixture.executeAction(actor.id, target.id);
      }).rejects.toThrow(/forbidden component.*positioning:giving_blowjob/i);
    });
  });
});
