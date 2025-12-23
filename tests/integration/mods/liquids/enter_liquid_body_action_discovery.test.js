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
        backgroundColor: '#3aaea3',
        textColor: '#0b1f2a',
        hoverBackgroundColor: '#5ed0c6',
        hoverTextColor: '#0b1f2a',
      });
    });

    it('mirrors sit_down forbidden components plus liquids-states:in_liquid_body', () => {
      expect(enterLiquidBodyAction.forbidden_components.actor).toEqual([
        ...sitDownAction.forbidden_components.actor,
        'liquids-states:in_liquid_body',
      ]);
    });

    it('has prerequisites for movement capability and lighting', () => {
      expect(enterLiquidBodyAction.prerequisites).toBeDefined();
      expect(enterLiquidBodyAction.prerequisites.length).toBe(2);

      const movementPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'anatomy:actor-can-move'
      );
      const lightingPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      expect(movementPrereq).toBeDefined();
      expect(lightingPrereq).toBeDefined();
    });

    it('has correct failure messages for prerequisites', () => {
      const movementPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.condition_ref === 'anatomy:actor-can-move'
      );
      const lightingPrereq = enterLiquidBodyAction.prerequisites.find(
        (prereq) => prereq.logic?.isActorLocationLit
      );

      expect(movementPrereq.failure_message).toBe(
        'You cannot enter the liquid body without functioning legs.'
      );
      expect(lightingPrereq.failure_message).toBe(
        'It is too dark to see where you are going.'
      );
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
    /**
     * Creates an actor with functioning legs that satisfy the anatomy:actor-can-move condition.
     * The condition uses hasPartWithComponentValue operator to check for body parts
     * with core:movement component where locked=false.
     *
     * @param {string} actorId - Entity ID for the actor
     * @param {string} name - Actor's name
     * @param {string} locationId - Location ID where the actor is
     * @returns {{actor: object, bodyParts: object[]}} Actor entity and body part entities
     */
    const createActorWithFunctioningLegs = (actorId, name, locationId) => {
      const rootPartId = `${actorId}-body-root`;
      const legPartId = `${actorId}-leg`;

      // Create body part entities
      const rootPart = new ModEntityBuilder(rootPartId)
        .asBodyPart({ subType: 'torso', children: [legPartId] })
        .build();

      const legPart = new ModEntityBuilder(legPartId)
        .asBodyPart({ parent: rootPartId, subType: 'leg' })
        .withComponent('core:movement', { locked: false })
        .build();

      // Create actor with body anatomy referencing the parts
      const actorBuilder = new ModEntityBuilder(actorId)
        .withName(name)
        .atLocation(locationId)
        .asActor();

      const actor = actorBuilder.build();

      // Add anatomy:body component with body graph structure
      actor.components['anatomy:body'] = {
        body: {
          root: rootPartId,
          parts: { leg: legPartId },
        },
      };

      return {
        actor,
        bodyParts: [rootPart, legPart],
      };
    };

    it('is discoverable when a liquid body is at the actor location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Canal Edge');
      const { actor, bodyParts } = createActorWithFunctioningLegs(
        'liquids:actor1',
        'Kara',
        room.id
      );
      const liquidBody = new ModEntityBuilder('liquids:canal_edge')
        .withName('Canal Edge')
        .atLocation(room.id)
        .withComponent('liquids:liquid_body', {})
        .build();

      fixture.reset([room, actor, liquidBody, ...bodyParts]);
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
