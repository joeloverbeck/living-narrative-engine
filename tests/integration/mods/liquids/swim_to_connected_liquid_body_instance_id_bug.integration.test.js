/**
 * @file Integration tests for the swim_to_connected_liquid_body action discovery
 * specifically targeting the instance ID vs definition ID bug.
 * Bug: When connected_liquid_body_ids in entity definitions use definition IDs
 * instead of instance IDs, the scope resolution fails because at runtime,
 * entities are registered with their instanceId, not their definitionId.
 * @see data/mods/dredgers/entities/definitions/canal_run_segment_a_liquid_body.entity.json
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import swimToConnectedLiquidBodyAction from '../../../../data/mods/liquids/actions/swim_to_connected_liquid_body.action.json' assert { type: 'json' };

const ACTION_ID = 'liquids:swim_to_connected_liquid_body';

describe('swim_to_connected_liquid_body instance ID bug', () => {
  let fixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    fixture = new ModActionTestFixture('liquids', ACTION_ID, null, null);
    await fixture.initialize();

    configureActionDiscovery = () => {
      const { testEnv } = fixture;
      if (!testEnv) {
        return;
      }
      testEnv.actionIndex.buildIndex([swimToConnectedLiquidBodyAction]);
    };
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('Instance ID vs Definition ID in connected_liquid_body_ids', () => {
    it('should FAIL discovery when connected_liquid_body_ids uses definition IDs (bug reproduction)', () => {
      // This test reproduces the original bug where definition IDs were used
      // instead of instance IDs, causing scope resolution to fail.

      // Setup rooms with locations:exits component required by secondary scope
      const roomA = new ModEntityBuilder('dredgers:access_point_segment_a')
        .withName('Access Point Segment A')
        .withComponent('locations:exits', [])
        .build();

      const roomB = new ModEntityBuilder('dredgers:segment_b')
        .withName('Segment B')
        .withComponent('locations:exits', [])
        .build();

      // Simulate the broken pattern: definition ID in connected_liquid_body_ids
      // Note: The actual entity ID is 'dredgers:canal_run_segment_a_liquid_body_instance'
      // but connected_liquid_body_ids uses 'dredgers:canal_run_segment_b_liquid_body' (definition)
      const liquidBodyA = new ModEntityBuilder(
        'dredgers:canal_run_segment_a_liquid_body_instance'
      )
        .withName('Canal Run (Segment A)')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          // BUG: Using definition ID instead of instance ID
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_b_liquid_body',
          ],
        })
        .build();

      const liquidBodyB = new ModEntityBuilder(
        'dredgers:canal_run_segment_b_liquid_body_instance'
      )
        .withName('Canal Run (Segment B)')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      // Actor in liquid body A with mobility skill
      const actor = new ModEntityBuilder('dredgers:saffi_two_tides_instance')
        .withName('Saffi Two-Tides')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id, // Uses instance ID correctly
        })
        .withComponent('skills:mobility_skill', { value: 88 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actor]);
      configureActionDiscovery();

      // Verify scope resolution fails with definition IDs
      const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor,
          actorEntity: actor,
        }
      );

      const connectedIds = Array.from(scopeResult.value || []);

      // The scope should return EMPTY because:
      // - It looks for entities with ID 'dredgers:canal_run_segment_b_liquid_body'
      // - But the actual entity has ID 'dredgers:canal_run_segment_b_liquid_body_instance'
      expect(connectedIds).toHaveLength(0);

      // Therefore, the action should NOT be discovered
      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const actionIds = availableActions.map((action) => action.id);
      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should SUCCEED discovery when connected_liquid_body_ids uses instance IDs (fix verification)', () => {
      // This test verifies the fix: using instance IDs in connected_liquid_body_ids

      const roomA = new ModEntityBuilder('dredgers:access_point_segment_a')
        .withName('Access Point Segment A')
        .withComponent('locations:exits', [])
        .build();

      const roomB = new ModEntityBuilder('dredgers:segment_b')
        .withName('Segment B')
        .withComponent('locations:exits', [])
        .build();

      // FIXED: Using instance ID in connected_liquid_body_ids
      const liquidBodyA = new ModEntityBuilder(
        'dredgers:canal_run_segment_a_liquid_body_instance'
      )
        .withName('Canal Run (Segment A)')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          // FIX: Using instance ID
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_b_liquid_body_instance',
          ],
        })
        .build();

      const liquidBodyB = new ModEntityBuilder(
        'dredgers:canal_run_segment_b_liquid_body_instance'
      )
        .withName('Canal Run (Segment B)')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('dredgers:saffi_two_tides_instance')
        .withName('Saffi Two-Tides')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        .withComponent('skills:mobility_skill', { value: 88 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actor]);
      configureActionDiscovery();

      // Verify scope resolution SUCCEEDS with instance IDs
      const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor,
          actorEntity: actor,
        }
      );

      const connectedIds = Array.from(scopeResult.value || []);
      expect(connectedIds).toContain(liquidBodyB.id);
      expect(connectedIds).toHaveLength(1);

      // Therefore, the action SHOULD be discovered
      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const actionIds = availableActions.map((action) => action.id);
      expect(actionIds).toContain(ACTION_ID);
    });

    it('should support bidirectional connections with instance IDs', () => {
      // Tests bidirectional swimming between A <-> B

      const roomA = new ModEntityBuilder('dredgers:access_point_segment_a')
        .withName('Access Point Segment A')
        .withComponent('locations:exits', [])
        .build();

      const roomB = new ModEntityBuilder('dredgers:segment_b')
        .withName('Segment B')
        .withComponent('locations:exits', [])
        .build();

      // A -> B connection
      const liquidBodyA = new ModEntityBuilder(
        'dredgers:canal_run_segment_a_liquid_body_instance'
      )
        .withName('Canal Run (Segment A)')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_b_liquid_body_instance',
          ],
        })
        .build();

      // B -> A connection (bidirectional)
      const liquidBodyB = new ModEntityBuilder(
        'dredgers:canal_run_segment_b_liquid_body_instance'
      )
        .withName('Canal Run (Segment B)')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_a_liquid_body_instance',
          ],
        })
        .build();

      // Actor in liquid body A
      const actorInA = new ModEntityBuilder('dredgers:saffi_instance')
        .withName('Saffi in A')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        .withComponent('skills:mobility_skill', { value: 88 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actorInA]);
      configureActionDiscovery();

      // Test A -> B direction
      const scopeResultFromA = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor: actorInA,
          actorEntity: actorInA,
        }
      );

      const connectedFromA = Array.from(scopeResultFromA.value || []);
      expect(connectedFromA).toContain(liquidBodyB.id);
      expect(connectedFromA).not.toContain(liquidBodyA.id);

      // Now test B -> A direction with actor in B
      const actorInB = new ModEntityBuilder('dredgers:other_swimmer_instance')
        .withName('Swimmer in B')
        .atLocation(roomB.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyB.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actorInB]);
      configureActionDiscovery();

      const scopeResultFromB = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor: actorInB,
          actorEntity: actorInB,
        }
      );

      const connectedFromB = Array.from(scopeResultFromB.value || []);
      expect(connectedFromB).toContain(liquidBodyA.id);
      expect(connectedFromB).not.toContain(liquidBodyB.id);
    });

    it('should handle multi-segment canal network with instance IDs', () => {
      // Tests a more complex network: A -> B -> C (like the dredgers canal)

      const roomA = new ModEntityBuilder('dredgers:access_point_segment_a')
        .withName('Access Point Segment A')
        .withComponent('locations:exits', [])
        .build();

      const roomB = new ModEntityBuilder('dredgers:segment_b')
        .withName('Segment B')
        .withComponent('locations:exits', [])
        .build();

      const roomC = new ModEntityBuilder('dredgers:segment_c')
        .withName('Segment C')
        .withComponent('locations:exits', [])
        .build();

      // A -> B only
      const liquidBodyA = new ModEntityBuilder(
        'dredgers:canal_run_segment_a_liquid_body_instance'
      )
        .withName('Canal Run (Segment A)')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_b_liquid_body_instance',
          ],
        })
        .build();

      // B -> A and B -> C
      const liquidBodyB = new ModEntityBuilder(
        'dredgers:canal_run_segment_b_liquid_body_instance'
      )
        .withName('Canal Run (Segment B)')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_a_liquid_body_instance',
            'dredgers:canal_run_segment_c_liquid_body_instance',
          ],
        })
        .build();

      // C -> B only
      const liquidBodyC = new ModEntityBuilder(
        'dredgers:canal_run_segment_c_liquid_body_instance'
      )
        .withName('Canal Run (Segment C)')
        .atLocation(roomC.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_b_liquid_body_instance',
          ],
        })
        .build();

      // Actor in segment B (middle of the network)
      const actor = new ModEntityBuilder('dredgers:saffi_instance')
        .withName('Saffi in Middle')
        .atLocation(roomB.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyB.id,
        })
        .withComponent('skills:mobility_skill', { value: 88 })
        .build();

      fixture.reset([
        roomA,
        roomB,
        roomC,
        liquidBodyA,
        liquidBodyB,
        liquidBodyC,
        actor,
      ]);
      configureActionDiscovery();

      // Actor in B should see A and C as targets
      const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor,
          actorEntity: actor,
        }
      );

      const connectedIds = Array.from(scopeResult.value || []);
      expect(connectedIds).toContain(liquidBodyA.id);
      expect(connectedIds).toContain(liquidBodyC.id);
      expect(connectedIds).not.toContain(liquidBodyB.id);
      expect(connectedIds).toHaveLength(2);

      // Action should be discovered
      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const actionIds = availableActions.map((action) => action.id);
      expect(actionIds).toContain(ACTION_ID);
    });
  });

  describe('Secondary scope resolution with instance IDs', () => {
    it('should resolve location for connected liquid body', () => {
      // Verifies the secondary scope (connected_liquid_body_location) works
      // when the primary scope correctly returns instance IDs

      const roomA = new ModEntityBuilder('dredgers:access_point_segment_a')
        .withName('Access Point Segment A')
        .withComponent('locations:exits', [])
        .build();

      const roomB = new ModEntityBuilder('dredgers:segment_b')
        .withName('Segment B')
        .withComponent('locations:exits', [])
        .build();

      const liquidBodyA = new ModEntityBuilder(
        'dredgers:canal_run_segment_a_liquid_body_instance'
      )
        .withName('Canal Run (Segment A)')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [
            'dredgers:canal_run_segment_b_liquid_body_instance',
          ],
        })
        .build();

      const liquidBodyB = new ModEntityBuilder(
        'dredgers:canal_run_segment_b_liquid_body_instance'
      )
        .withName('Canal Run (Segment B)')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('dredgers:saffi_instance')
        .withName('Saffi')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        .withComponent('skills:mobility_skill', { value: 88 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actor]);

      // Simulate secondary scope with liquidBodyB as target
      const locationResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_body_location',
        {
          actor,
          actorEntity: actor,
          target: liquidBodyB, // This comes from primary scope's contextFrom
        }
      );

      const locationIds = Array.from(locationResult.value || []);
      expect(locationIds).toContain(roomB.id);
      expect(locationIds).not.toContain(roomA.id);
    });
  });

  describe('Edge cases', () => {
    it('should return empty when actor in_liquid_body references non-existent liquid body', () => {
      const room = new ModEntityBuilder('dredgers:some_room')
        .withName('Some Room')
        .withComponent('locations:exits', [])
        .build();

      // Actor references a liquid body that doesn't exist
      const actor = new ModEntityBuilder('dredgers:lost_swimmer')
        .withName('Lost Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: 'dredgers:nonexistent_liquid_body_instance',
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, actor]);
      configureActionDiscovery();

      const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor,
          actorEntity: actor,
        }
      );

      const connectedIds = Array.from(scopeResult.value || []);
      expect(connectedIds).toHaveLength(0);

      // Action should NOT be discovered
      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const actionIds = availableActions.map((action) => action.id);
      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should return empty when connected_liquid_body_ids references non-existent entities', () => {
      const room = new ModEntityBuilder('dredgers:some_room')
        .withName('Some Room')
        .withComponent('locations:exits', [])
        .build();

      // Liquid body references connections that don't exist
      const liquidBody = new ModEntityBuilder(
        'dredgers:isolated_liquid_body_instance'
      )
        .withName('Isolated Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [
            'dredgers:ghost_liquid_body_instance', // Doesn't exist
          ],
        })
        .build();

      const actor = new ModEntityBuilder('dredgers:swimmer')
        .withName('Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor,
          actorEntity: actor,
        }
      );

      const connectedIds = Array.from(scopeResult.value || []);
      expect(connectedIds).toHaveLength(0);

      // Action should NOT be discovered (no valid targets)
      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const actionIds = availableActions.map((action) => action.id);
      expect(actionIds).not.toContain(ACTION_ID);
    });
  });
});
