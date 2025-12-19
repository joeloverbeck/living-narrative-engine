import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import sitOnLapFacingAwayRule from '../../../../data/mods/straddling/rules/handle_sit_on_lap_from_sitting_facing_away.rule.json' assert { type: 'json' };
import eventIsActionSitOnLapFacingAway from '../../../../data/mods/straddling/conditions/event-is-action-sit-on-lap-from-sitting-facing-away.condition.json' assert { type: 'json' };

describe('actors_both_sitting_close scope - Integration Tests', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'straddling',
      'straddling:sit_on_lap_from_sitting_facing_away',
      sitOnLapFacingAwayRule,
      eventIsActionSitOnLapFacingAway
    );

    /**
     * Test-specific scope resolver for actors_both_sitting_close.
     *
     * Scope DSL:
     *   positioning:actors_both_sitting_close := actor.components.positioning:closeness.partners[][{
     *     "and": [
     *       {"!!": {"var": "entity.components.positioning:sitting_on"}},
     *       {"!!": {"var": "actor.components.positioning:sitting_on"}}
     *     ]
     *   }]
     *
     * Translation: Filter the actor's closeness partners to only those where BOTH
     * the actor AND the partner have the sitting_on component.
     */
    const { testEnv } = testFixture;
    const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      if (scopeName === 'sitting:actors_both_sitting_close') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const actor = testFixture.entityManager.getEntityInstance(actorId);
        const closeness = actor?.components?.['positioning:closeness'];

        if (!closeness || !Array.isArray(closeness.partners)) {
          return { success: true, value: new Set() };
        }

        // Filter partners where BOTH actor and partner have sitting_on
        const bothSittingPartners = closeness.partners.filter((partnerId) => {
          const partner =
            testFixture.entityManager.getEntityInstance(partnerId);
          const partnerHasSittingOn =
            !!partner?.components?.['positioning:sitting_on'];
          const actorHasSittingOn =
            !!actor?.components?.['positioning:sitting_on'];
          return partnerHasSittingOn && actorHasSittingOn;
        });

        return { success: true, value: new Set(bothSittingPartners) };
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

  describe('Valid Scenarios', () => {
    it('should return partners where both actor and partner are sitting', () => {
      // Setup: Actor sitting, two close partners (one sitting, one standing)
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
        .closeToEntity('sitting_partner')
        .closeToEntity('standing_partner')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const sittingPartner = new ModEntityBuilder('sitting_partner')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair2',
          spot_index: 0,
        })
        .build();

      const standingPartner = new ModEntityBuilder('standing_partner')
        .withName('Charlie')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .build();

      testFixture.reset([
        room,
        chair1,
        chair2,
        actor,
        sittingPartner,
        standingPartner,
      ]);

      // Execute: Resolve scope
      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:actors_both_sitting_close',
        { actor: { id: 'actor1' } }
      );

      // Assert: Only the sitting partner is returned
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(1);
      expect(result.value.has('sitting_partner')).toBe(true);
      expect(result.value.has('standing_partner')).toBe(false);
    });

    it('should return all sitting close partners when multiple are sitting', () => {
      // Setup: Actor sitting, three close partners all sitting
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const couch = new ModEntityBuilder('couch1')
        .withName('Couch')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('partner1')
        .closeToEntity('partner2')
        .closeToEntity('partner3')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 0,
        })
        .build();

      const partner1 = new ModEntityBuilder('partner1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 1,
        })
        .build();

      const partner2 = new ModEntityBuilder('partner2')
        .withName('Charlie')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 2,
        })
        .build();

      const partner3 = new ModEntityBuilder('partner3')
        .withName('Diana')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'couch1',
          spot_index: 3,
        })
        .build();

      testFixture.reset([room, couch, actor, partner1, partner2, partner3]);

      // Execute: Resolve scope
      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:actors_both_sitting_close',
        { actor: { id: 'actor1' } }
      );

      // Assert: All three sitting partners are returned
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(3);
      expect(result.value.has('partner1')).toBe(true);
      expect(result.value.has('partner2')).toBe(true);
      expect(result.value.has('partner3')).toBe(true);
    });
  });

  describe('Invalid Scenarios', () => {
    it('should return empty set when actor is not sitting', () => {
      // Setup: Actor standing (no sitting_on), close partners sitting
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('partner1')
        .asActor()
        .build();

      const partner1 = new ModEntityBuilder('partner1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor, partner1]);

      // Execute: Resolve scope
      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:actors_both_sitting_close',
        { actor: { id: 'actor1' } }
      );

      // Assert: Empty set because actor is not sitting
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(0);
    });

    it('should return empty set when no partners are sitting', () => {
      // Setup: Actor sitting, close partners all standing
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('partner1')
        .closeToEntity('partner2')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      const partner1 = new ModEntityBuilder('partner1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .build();

      const partner2 = new ModEntityBuilder('partner2')
        .withName('Charlie')
        .atLocation('room1')
        .closeToEntity('actor1')
        .asActor()
        .build();

      testFixture.reset([room, chair, actor, partner1, partner2]);

      // Execute: Resolve scope
      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:actors_both_sitting_close',
        { actor: { id: 'actor1' } }
      );

      // Assert: Empty set because no partners are sitting
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(0);
    });

    it('should return empty set when actor has no closeness partners', () => {
      // Setup: Actor sitting but no closeness partners
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

      const chair = new ModEntityBuilder('chair1')
        .withName('Chair')
        .atLocation('room1')
        .build();

      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('positioning:sitting_on', {
          furniture_id: 'chair1',
          spot_index: 0,
        })
        .build();

      testFixture.reset([room, chair, actor]);

      // Execute: Resolve scope
      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'sitting:actors_both_sitting_close',
        { actor: { id: 'actor1' } }
      );

      // Assert: Empty set because actor has no closeness partners
      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(0);
    });
  });
});
