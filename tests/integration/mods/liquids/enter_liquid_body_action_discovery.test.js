/**
 * @file Integration tests for liquids:enter_liquid_body action discovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import enterLiquidBodyAction from '../../../../data/mods/liquids/actions/enter_liquid_body.action.json' assert { type: 'json' };
import sitDownAction from '../../../../data/mods/sitting/actions/sit_down.action.json' assert { type: 'json' };

const ACTION_ID = 'liquids:enter_liquid_body';

describe('liquids:enter_liquid_body action discovery', () => {
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

      testEnv.actionIndex.buildIndex([enterLiquidBodyAction]);
    };
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('Action structure', () => {
    it('has the expected target and template metadata', () => {
      expect(enterLiquidBodyAction.id).toBe(ACTION_ID);
      expect(enterLiquidBodyAction.template).toBe('enter the {liquidBody}');
      expect(enterLiquidBodyAction.targets.primary.scope).toBe(
        'liquids:liquid_bodies_at_location'
      );
      expect(enterLiquidBodyAction.targets.primary.placeholder).toBe(
        'liquidBody'
      );
      expect(enterLiquidBodyAction.targets.primary.description).toBe(
        'Liquid body to enter'
      );
    });

    it('uses the Blighted Moss visual scheme', () => {
      expect(enterLiquidBodyAction.visual).toEqual({
        backgroundColor: '#1a1f14',
        textColor: '#d8ffd6',
        hoverBackgroundColor: '#23301c',
        hoverTextColor: '#e8ffe5',
      });
    });

    it('mirrors sit_down forbidden components plus liquids-states:in_liquid_body', () => {
      expect(enterLiquidBodyAction.forbidden_components.actor).toEqual([
        ...sitDownAction.forbidden_components.actor,
        'liquids-states:in_liquid_body',
      ]);
    });
  });

  describe('Scope resolution', () => {
    it('returns liquid bodies at the actor location only', () => {
      const roomA = ModEntityScenarios.createRoom('room-a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room-b', 'Room B');

      const actor = new ModEntityBuilder('liquids:actor')
        .withName('Edda')
        .atLocation(roomA.id)
        .asActor()
        .build();

      const liquidBodyHere = new ModEntityBuilder('liquids:canal_a')
        .withName('Canal Run')
        .atLocation(roomA.id)
        .withComponent('liquids:liquid_body', {})
        .build();

      const liquidBodyElsewhere = new ModEntityBuilder('liquids:canal_b')
        .withName('Canal Run (Far)')
        .atLocation(roomB.id)
        .withComponent('liquids:liquid_body', {})
        .build();

      const nonLiquid = new ModEntityBuilder('liquids:crate')
        .withName('Crate')
        .atLocation(roomA.id)
        .build();

      fixture.reset([roomA, roomB, actor, liquidBodyHere, liquidBodyElsewhere, nonLiquid]);

      const result = fixture.testEnv.unifiedScopeResolver.resolveSync(
        'liquids:liquid_bodies_at_location',
        {
          actor,
          actorEntity: actor,
        }
      );

      const ids = Array.from(result.value || []);
      expect(ids).toContain(liquidBodyHere.id);
      expect(ids).not.toContain(liquidBodyElsewhere.id);
      expect(ids).not.toContain(nonLiquid.id);
    });
  });

  describe('Action discovery', () => {
    it('is discoverable when a liquid body is at the actor location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Canal Edge');
      const actor = new ModEntityBuilder('liquids:actor1')
        .withName('Kara')
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

      expect(ids).toContain(ACTION_ID);
    });

    it('is not discoverable when no liquid body is present', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Dry Walkway');
      const actor = new ModEntityBuilder('liquids:actor2')
        .withName('Rin')
        .atLocation(room.id)
        .asActor()
        .build();

      fixture.reset([room, actor]);
      configureActionDiscovery();

      const availableActions = fixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not discoverable when the actor is already in a liquid body', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Flooded Hall');
      const actor = new ModEntityBuilder('liquids:actor3')
        .withName('Mara')
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

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
