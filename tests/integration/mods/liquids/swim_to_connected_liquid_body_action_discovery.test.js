/**
 * @file Integration tests for liquids:swim_to_connected_liquid_body action discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import swimToConnectedLiquidBodyAction from '../../../../data/mods/liquids/actions/swim_to_connected_liquid_body.action.json' assert { type: 'json' };

const ACTION_ID = 'liquids:swim_to_connected_liquid_body';

describe('liquids:swim_to_connected_liquid_body action discovery', () => {
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

  describe('Action structure', () => {
    it('has the expected target and template metadata', () => {
      expect(swimToConnectedLiquidBodyAction.id).toBe(ACTION_ID);
      expect(swimToConnectedLiquidBodyAction.template).toBe(
        'swim to {connectedLocation} via {connectedLiquidBody} ({chance}% chance)'
      );
      expect(swimToConnectedLiquidBodyAction.targets.primary.scope).toBe(
        'liquids:connected_liquid_bodies_for_actor'
      );
      expect(swimToConnectedLiquidBodyAction.targets.primary.placeholder).toBe(
        'connectedLiquidBody'
      );
      expect(swimToConnectedLiquidBodyAction.targets.secondary.scope).toBe(
        'liquids:connected_liquid_body_location'
      );
      expect(swimToConnectedLiquidBodyAction.targets.secondary.contextFrom).toBe(
        'primary'
      );
    });

    it('uses the Blighted Moss visual scheme', () => {
      expect(swimToConnectedLiquidBodyAction.visual).toEqual({
        backgroundColor: '#3aaea3',
        textColor: '#0b1f2a',
        hoverBackgroundColor: '#5ed0c6',
        hoverTextColor: '#0b1f2a',
      });
    });

    it('has chanceBased with fixed_difficulty contest type', () => {
      expect(swimToConnectedLiquidBodyAction.chanceBased.enabled).toBe(true);
      expect(swimToConnectedLiquidBodyAction.chanceBased.contestType).toBe(
        'fixed_difficulty'
      );
      expect(swimToConnectedLiquidBodyAction.chanceBased.fixedDifficulty).toBe(50);
      expect(swimToConnectedLiquidBodyAction.chanceBased.actorSkill.component).toBe(
        'skills:mobility_skill'
      );
    });

    it('requires actor to have liquids-states:in_liquid_body and skills:mobility_skill', () => {
      expect(swimToConnectedLiquidBodyAction.required_components.actor).toEqual([
        'liquids-states:in_liquid_body',
        'skills:mobility_skill',
      ]);
    });

    it('forbids being restrained, restraining, fallen, or submerged', () => {
      expect(swimToConnectedLiquidBodyAction.forbidden_components.actor).toEqual([
        'physical-control-states:being_restrained',
        'physical-control-states:restraining',
        'recovery-states:fallen',
        'liquids-states:submerged',
      ]);
    });
  });

  describe('Scope resolution - connected_liquid_bodies_for_actor', () => {
    it('returns connected liquid bodies for an actor in a liquid body', () => {
      const roomA = ModEntityScenarios.createRoom('room-a', 'Canal Run A');
      const roomB = ModEntityScenarios.createRoom('room-b', 'Canal Run B');

      const liquidBodyA = new ModEntityBuilder('liquids:canal_a')
        .withName('Canal Run A')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_b'],
        })
        .build();

      const liquidBodyB = new ModEntityBuilder('liquids:canal_b')
        .withName('Canal Run B')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_a'],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Swimmer')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actor]);

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor,
          actorEntity: actor,
        }
      );

      const ids = Array.from(result.value || []);
      expect(ids).toContain(liquidBodyB.id);
      expect(ids).not.toContain(liquidBodyA.id); // actor is in this one, not connected TO it
    });

    it('returns empty set when liquid body has no connections', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Isolated Pool');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Isolated Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Swimmer')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBody.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor,
          actorEntity: actor,
        }
      );

      const ids = Array.from(result.value || []);
      expect(ids).toHaveLength(0);
    });

    it('respects connection directionality (one-way connections do not reverse)', () => {
      // Setup: A -> B (unidirectional), B does NOT list A
      const roomA = ModEntityScenarios.createRoom('room-a', 'Source Pool');
      const roomB = ModEntityScenarios.createRoom('room-b', 'Destination Pool');

      const liquidBodyA = new ModEntityBuilder('liquids:source_pool')
        .withName('Source Pool')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:dest_pool'], // A -> B
        })
        .build();

      const liquidBodyB = new ModEntityBuilder('liquids:dest_pool')
        .withName('Destination Pool')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [], // B does NOT list A (no reverse connection)
        })
        .build();

      // Actor in A should see B as target
      const actorInA = new ModEntityBuilder('liquids:actor_a')
        .withName('Swimmer at Source')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actorInA]);

      const resultFromA = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor: actorInA,
          actorEntity: actorInA,
        }
      );

      const idsFromA = Array.from(resultFromA.value || []);
      expect(idsFromA).toContain(liquidBodyB.id);
      expect(idsFromA).not.toContain(liquidBodyA.id);

      // Actor in B should NOT see A as target (directionality respected)
      const actorInB = new ModEntityBuilder('liquids:actor_b')
        .withName('Swimmer at Destination')
        .atLocation(roomB.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyB.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actorInB]);

      const resultFromB = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_bodies_for_actor',
        {
          actor: actorInB,
          actorEntity: actorInB,
        }
      );

      const idsFromB = Array.from(resultFromB.value || []);
      expect(idsFromB).toHaveLength(0); // B has no outbound connections
      expect(idsFromB).not.toContain(liquidBodyA.id); // A -> B doesn't imply B -> A
    });
  });

  describe('Scope resolution - connected_liquid_body_location', () => {
    it('returns the location entity where the target liquid body is positioned', () => {
      // Rooms must have locations:exits component to be discovered by the scope
      const roomA = new ModEntityBuilder('room-a')
        .withName('Flooded Approach')
        .withComponent('locations:exits', [])
        .build();

      const roomB = new ModEntityBuilder('room-b')
        .withName('Canal Run')
        .withComponent('locations:exits', [])
        .build();

      const liquidBodyB = new ModEntityBuilder('liquids:canal_b')
        .withName('Canal Run B')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Swimmer')
        .atLocation(roomA.id)
        .asActor()
        .build();

      fixture.reset([roomA, roomB, liquidBodyB, actor]);

      // Simulate secondary scope context where target is the selected liquid body
      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:connected_liquid_body_location',
        {
          actor,
          actorEntity: actor,
          target: liquidBodyB, // contextFrom: "primary" provides this
        }
      );

      const ids = Array.from(result.value || []);
      expect(ids).toContain(roomB.id);
      expect(ids).not.toContain(roomA.id);
    });
  });

  describe('Action discovery', () => {
    it('is discoverable when actor is in a liquid body with connections', () => {
      // Rooms must have locations:exits component for secondary scope resolution
      const roomA = new ModEntityBuilder('room-a')
        .withName('Canal Run A')
        .withComponent('locations:exits', [])
        .build();

      const roomB = new ModEntityBuilder('room-b')
        .withName('Canal Run B')
        .withComponent('locations:exits', [])
        .build();

      const liquidBodyA = new ModEntityBuilder('liquids:canal_a')
        .withName('Canal Run A')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_b'],
        })
        .build();

      const liquidBodyB = new ModEntityBuilder('liquids:canal_b')
        .withName('Canal Run B')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_a'],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Swimmer')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not discoverable when actor is not in a liquid body', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Dry Ground');

      const liquidBody = new ModEntityBuilder('liquids:canal')
        .withName('Canal')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:other_canal'],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Dry Person')
        .atLocation(room.id)
        .asActor()
        .withComponent('skills:mobility_skill', { value: 50 })
        .build();

      fixture.reset([room, liquidBody, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when actor lacks mobility skill', () => {
      const roomA = ModEntityScenarios.createRoom('room-a', 'Canal Run A');
      const roomB = ModEntityScenarios.createRoom('room-b', 'Canal Run B');

      const liquidBodyA = new ModEntityBuilder('liquids:canal_a')
        .withName('Canal Run A')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_b'],
        })
        .build();

      const liquidBodyB = new ModEntityBuilder('liquids:canal_b')
        .withName('Canal Run B')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_a'],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Unskilled Swimmer')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        // No skills:mobility_skill component
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when liquid body has no connections', () => {
      const room = ModEntityScenarios.createRoom('room-a', 'Isolated Pool');

      const liquidBody = new ModEntityBuilder('liquids:pool')
        .withName('Isolated Pool')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: [],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
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

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when actor is being restrained', () => {
      const roomA = ModEntityScenarios.createRoom('room-a', 'Canal Run A');
      const roomB = ModEntityScenarios.createRoom('room-b', 'Canal Run B');

      const liquidBodyA = new ModEntityBuilder('liquids:canal_a')
        .withName('Canal Run A')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_b'],
        })
        .build();

      const liquidBodyB = new ModEntityBuilder('liquids:canal_b')
        .withName('Canal Run B')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {
          connected_liquid_body_ids: ['liquids:canal_a'],
        })
        .build();

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Restrained Swimmer')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: liquidBodyA.id,
        })
        .withComponent('skills:mobility_skill', { value: 50 })
        .withComponent('physical-control-states:being_restrained', {
          restrainer_id: 'some_entity',
        })
        .build();

      fixture.reset([roomA, roomB, liquidBodyA, liquidBodyB, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
