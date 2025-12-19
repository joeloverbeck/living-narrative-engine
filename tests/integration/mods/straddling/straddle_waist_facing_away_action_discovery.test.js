import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import straddleFacingAwayRule from '../../../../data/mods/straddling/rules/straddle_waist_facing_away.rule.json' assert { type: 'json' };
import eventIsActionStraddleFacingAway from '../../../../data/mods/straddling/conditions/event-is-action-straddle-waist-facing-away.condition.json' assert { type: 'json' };
import straddleFacingAwayAction from '../../../../data/mods/straddling/actions/straddle_waist_facing_away.action.json' assert { type: 'json' };

describe('straddle_waist_facing_away action discovery - Integration Tests', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'straddling',
      'straddling:straddle_waist_facing_away',
      straddleFacingAwayRule,
      eventIsActionStraddleFacingAway
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      // Build the action index with the straddle_waist_facing_away action
      testEnv.actionIndex.buildIndex([straddleFacingAwayAction]);
    };

    /**
     * Test-specific scope resolver for actors_sitting_close.
     *
     * NOTE: ModTestFixture.forAction doesn't load scope definition files (.scope files).
     * This resolver implements the logic from:
     * data/mods/positioning/scopes/actors_sitting_close.scope
     *
     * Scope DSL:
     *   positioning:actors_sitting_close := actor.components.positioning:closeness.partners[][{
     *     "!!": {"var": "entity.components.positioning:sitting_on"}
     *   }]
     *
     * Translation: Filter the actor's closeness partners to only those who have sitting_on component.
     */
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'sitting:actors_sitting_close') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const closeness = actor?.components?.['positioning:closeness'];

        if (!closeness || !Array.isArray(closeness.partners)) {
          return { success: true, value: new Set() };
        }

        // Filter partners who have sitting_on component
        const sittingPartners = closeness.partners.filter((partnerId) => {
          const partner =
            testFixture.entityManager.getEntityInstance(partnerId);
          return !!partner?.components?.['positioning:sitting_on'];
        });

        return { success: true, value: new Set(sittingPartners) };
      }

      // Fall back to original resolution for other scopes
      return originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        context
      );
    };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Valid Discovery Scenarios', () => {
    it('should discover action when actor is close to sitting target', async () => {
      // Setup: Actor close to target who is sitting
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(`\n🎬 DISCOVERED ACTIONS:`);
      console.log(`  Total: ${actions.length}`);
      console.log(
        `  Action IDs:`,
        actions.map((a) => a.id)
      );

      // Assert
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      console.log(
        `\n🔍 straddle_waist_facing_away action:`,
        straddleAction ? 'FOUND ✅' : 'NOT FOUND ❌'
      );
      if (straddleAction) {
        console.log(
          `  Targets:`,
          JSON.stringify(straddleAction.targets, null, 2)
        );
      }

      expect(straddleAction).toBeDefined();
      expect(straddleAction.targets).toBeDefined();
      expect(straddleAction.targets.primary).toBeDefined();
      expect(straddleAction.targets.primary.scope).toBe(
        'sitting:actors_sitting_close'
      );
    });

    it('should discover with multiple close actors, only sitting ones', async () => {
      // Setup: Actor close to both sitting and standing targets
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .closeToEntity('target2')
        .asActor()
        .build();

      // Target 1: Sitting (should be discoverable)
      const target1 = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      // Target 2: Standing (should NOT be discoverable)
      const target2 = new ModEntityBuilder('target2')
        .withName('Charlie')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, target1, target2]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeDefined();
      // The action should be available, but only target1 (sitting) should be in scope
    });
  });

  describe('Invalid Discovery Scenarios', () => {
    it('should NOT discover when target is not sitting', async () => {
      // Setup: Actor close to target who is NOT sitting
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(`\n❌ Testing invalid scenario (target not sitting):`);
      console.log(
        `  Discovered actions:`,
        actions.map((a) => a.id)
      );

      // Assert
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeUndefined();
    });

    it('should NOT discover when actor not in closeness circle', async () => {
      // Setup: Target sitting but actor NOT close
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(`\n❌ Testing invalid scenario (not in closeness circle):`);
      console.log(
        `  Discovered actions:`,
        actions.map((a) => a.id)
      );

      // Assert
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeUndefined();
    });

    it('should NOT discover when target lacks closeness component', async () => {
      // Setup: Target sitting but doesn't have closeness component
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:closeness', {
          partners: ['target1'],
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();
      // Note: target does NOT have closeness component

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(`\n❌ Testing invalid scenario (target lacks closeness):`);
      console.log(
        `  Discovered actions:`,
        actions.map((a) => a.id)
      );

      // Assert
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeUndefined();
    });

    it('should NOT discover when actor is not an actor entity', async () => {
      // Setup: Non-actor trying to straddle
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const nonActor = new ModEntityBuilder('object1')
        .withName('Object')
        .atLocation('room1')
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, nonActor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('object1');

      // Debug output
      console.log(`\n❌ Testing invalid scenario (non-actor entity):`);
      console.log(
        `  Discovered actions:`,
        actions.map((a) => a.id)
      );

      // Assert
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should NOT discover when actor is sitting (straddling requires standing)', async () => {
      // Setup: Both actor and target are sitting
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair1 = new ModEntityBuilder('chair1')
        .withName('Chair 1')
        .atLocation('room1')
        .build();

      const chair2 = new ModEntityBuilder('chair2')
        .withName('Chair 2')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair1, chair2, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(
        `\n❌ Testing edge case (actor sitting - should NOT discover):`
      );
      console.log(
        `  Discovered actions:`,
        actions.map((a) => a.id)
      );

      // Assert - This should NOT be discovered (actor must be standing to straddle)
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeUndefined();
    });

    it('should discover when actor is standing close to sitting target', async () => {
      // Setup: Actor standing, target sitting
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .build();
      // Note: Actor does NOT have sitting_on component (standing)

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(
        `\n✅ Testing valid scenario (actor standing, target sitting):`
      );
      console.log(
        `  Discovered actions:`,
        actions.map((a) => a.id)
      );

      // Assert - This SHOULD be discovered (correct scenario for straddling)
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeDefined();
    });
  });

  describe('Straddling State Prevention', () => {
    it('should NOT discover when actor is already straddling target (after sit-on-lap)', async () => {
      // Setup: Actor already straddling target's waist (simulating after sit_on_lap action)
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .withComponent('positioning:straddling_waist', {
          target_id: 'target1',
          facing_away: true,
        })
        .build();
      // Note: Actor has straddling_waist component (as if sit_on_lap was executed)

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Debug output
      console.log(
        `\n❌ Testing straddling prevention (actor already straddling):`
      );
      console.log(
        `  Discovered actions:`,
        actions.map((a) => a.id)
      );

      // Assert - Should NOT discover because actor already has straddling_waist component
      const straddleAction = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleAction).toBeUndefined();
    });
  });

  describe('Distinction from straddle_waist_facing', () => {
    it('should be a separate action from straddle_waist_facing', async () => {
      // This test verifies that both actions can coexist and are distinguished
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('target1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, target]);
      configureActionDiscovery();

      // Act
      const actions = await testFixture.discoverActions('actor1');

      // Assert - Verify this specific action exists
      const straddleFacingAway = actions.find(
        (a) => a.id === 'straddling:straddle_waist_facing_away'
      );

      expect(straddleFacingAway).toBeDefined();
      expect(straddleFacingAway.id).toBe(
        'straddling:straddle_waist_facing_away'
      );
      expect(straddleFacingAway.name).toBe('Straddle Waist (Facing Away)');
    });
  });
});
