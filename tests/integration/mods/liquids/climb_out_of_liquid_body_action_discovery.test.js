/**
 * @file Integration tests for liquids:climb_out_of_liquid_body action discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import climbOutOfLiquidBodyAction from '../../../../data/mods/liquids/actions/climb_out_of_liquid_body.action.json' assert { type: 'json' };
import enterLiquidBodyAction from '../../../../data/mods/liquids/actions/enter_liquid_body.action.json' assert { type: 'json' };

const ACTION_ID = 'liquids:climb_out_of_liquid_body';

describe('liquids:climb_out_of_liquid_body action discovery', () => {
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

      testEnv.actionIndex.buildIndex([climbOutOfLiquidBodyAction]);
    };
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('Action structure', () => {
    it('has the expected target, template, and component requirements', () => {
      expect(climbOutOfLiquidBodyAction.id).toBe(ACTION_ID);
      expect(climbOutOfLiquidBodyAction.template).toBe(
        'climb out of the {liquidBody}'
      );
      expect(climbOutOfLiquidBodyAction.targets.primary.scope).toBe(
        'liquids:liquid_body_actor_is_in'
      );
      expect(climbOutOfLiquidBodyAction.targets.primary.placeholder).toBe(
        'liquidBody'
      );
      expect(climbOutOfLiquidBodyAction.targets.primary.description).toBe(
        'Liquid body to climb out of'
      );
      expect(climbOutOfLiquidBodyAction.required_components.actor).toEqual([
        'liquids-states:in_liquid_body',
      ]);
      expect(climbOutOfLiquidBodyAction.forbidden_components.actor).toEqual([]);
    });

    it('uses the same visual scheme as liquids:enter_liquid_body', () => {
      expect(climbOutOfLiquidBodyAction.visual).toEqual(
        enterLiquidBodyAction.visual
      );
    });
  });

  describe('Scope resolution', () => {
    it('returns the liquid body referenced by in_liquid_body only', () => {
      const roomA = ModEntityScenarios.createRoom('room-a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room-b', 'Room B');

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Edda')
        .atLocation(roomA.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: 'liquids:canal_a',
        })
        .build();

      const liquidBodyReferenced = new ModEntityBuilder('liquids:canal_a')
        .withName('Canal Run')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {})
        .build();

      const liquidBodyOther = new ModEntityBuilder('liquids:canal_b')
        .withName('Canal Run (Far)')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {})
        .build();

      const nonLiquid = new ModEntityBuilder('liquids:crate')
        .withName('Crate')
        .atLocation(roomA.id)
        .build();

      fixture.reset([
        roomA,
        roomB,
        actor,
        liquidBodyReferenced,
        liquidBodyOther,
        nonLiquid,
      ]);

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:liquid_body_actor_is_in',
        {
          actor,
          actorEntity: actor,
        }
      );

      const ids = Array.from(result.value || []);
      expect(ids).toEqual([liquidBodyReferenced.id]);
    });
  });

  describe('Action discovery', () => {
    it('is discoverable when the actor is in a liquid body', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Canal Edge');
      const actor = new ModEntityBuilder('liquids:actor1')
        .withName('Kara')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: 'liquids:canal_edge',
        })
        .build();
      const liquidBody = new ModEntityBuilder('liquids:canal_edge')
        .withName('Canal Edge')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {})
        .build();

      fixture.reset([room, actor, liquidBody]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not discoverable when the actor is not in a liquid body', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Dry Walkway');
      const actor = new ModEntityBuilder('liquids:actor2')
        .withName('Rin')
        .atLocation(room.id)
        .asActor()
        .build();
      const liquidBody = new ModEntityBuilder('liquids:canal_edge')
        .withName('Canal Edge')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {})
        .build();

      fixture.reset([room, actor, liquidBody]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when the referenced liquid body is missing', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Flooded Hall');
      const actor = new ModEntityBuilder('liquids:actor3')
        .withName('Mara')
        .atLocation(room.id)
        .asActor()
        .withComponent('liquids-states:in_liquid_body', {
          liquid_body_id: 'liquids:missing_body',
        })
        .build();

      fixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
