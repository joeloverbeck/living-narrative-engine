/**
 * @file Integration tests verifying actions are forbidden when actor is in a liquid body.
 * @description Ensures action discovery blocks specific actions for actors with liquids-states:in_liquid_body.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

import goAction from '../../../../data/mods/movement/actions/go.action.json';
import kneelBeforeAction from '../../../../data/mods/deference/actions/kneel_before.action.json';
import throwSelfToGroundAction from '../../../../data/mods/distress/actions/throw_self_to_ground.action.json';
import placeYourselfBehindAction from '../../../../data/mods/maneuvering/actions/place_yourself_behind.action.json';
import getCloseAction from '../../../../data/mods/personal-space/actions/get_close.action.json';
import restrainTargetAction from '../../../../data/mods/physical-control/actions/restrain_target.action.json';
import slapAction from '../../../../data/mods/violence/actions/slap.action.json';
import suckerPunchAction from '../../../../data/mods/violence/actions/sucker_punch.action.json';

const ACTIONS = [
  { id: 'movement:go', action: goAction },
  { id: 'deference:kneel_before', action: kneelBeforeAction },
  { id: 'distress:throw_self_to_ground', action: throwSelfToGroundAction },
  { id: 'maneuvering:place_yourself_behind', action: placeYourselfBehindAction },
  { id: 'personal-space:get_close', action: getCloseAction },
  { id: 'physical-control:restrain_target', action: restrainTargetAction },
  { id: 'violence:slap', action: slapAction },
  { id: 'violence:sucker_punch', action: suckerPunchAction },
];

describe('actions forbidden when in a liquid body', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'liquids',
      'liquids:enter_liquid_body'
    );
  });

  afterEach(() => {
    if (
      testFixture?.testEnv?.unifiedScopeResolver?.__inLiquidOriginalResolve
    ) {
      testFixture.testEnv.unifiedScopeResolver.resolveSync =
        testFixture.testEnv.unifiedScopeResolver.__inLiquidOriginalResolve;
    }

    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return;
    }

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__inLiquidOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.__inLiquidOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      const { entityManager } = testEnv;

      if (
        scopeName === 'core:actors_in_location' ||
        scopeName === 'facing-states:actors_in_location_facing' ||
        scopeName === 'maneuvering:actors_in_location_not_facing_away_from_actor' ||
        scopeName === 'item-handling-states:actors_in_location_not_wielding'
      ) {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const actorLocation = entityManager.getComponentData(
          actorId,
          'core:position'
        )?.locationId;

        if (!actorLocation) {
          return { success: true, value: new Set() };
        }

        const targets = new Set();
        for (const entityId of entityManager.getEntityIds()) {
          if (entityId === actorId) {
            continue;
          }

          const position = entityManager.getComponentData(
            entityId,
            'core:position'
          );
          const isActor = entityManager.getComponentData(entityId, 'core:actor');

          if (position?.locationId === actorLocation && isActor) {
            targets.add(entityId);
          }
        }

        return { success: true, value: targets };
      }

      if (scopeName === 'movement:clear_directions') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const actorLocation = entityManager.getComponentData(
          actorId,
          'core:position'
        )?.locationId;

        if (!actorLocation) {
          return { success: true, value: new Set() };
        }

        const directions = new Set();
        for (const entityId of entityManager.getEntityIds()) {
          const direction = entityManager.getComponentData(
            entityId,
            'movement:direction'
          );
          if (direction?.source === actorLocation) {
            directions.add(entityId);
          }
        }

        return { success: true, value: directions };
      }

      return originalResolve(scopeName, context);
    };
  };

  const setupScenario = () => {
    const room1 = ModEntityScenarios.createRoom('room1', 'Flooded Room');
    const room2 = ModEntityScenarios.createRoom('room2', 'Dry Room');

    const actorBuilder = new ModEntityBuilder('actor1')
      .withName('Marin')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withGrabbingHands(2);

    const actor = actorBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    actor.components['skills:grappling_skill'] = { value: 12 };
    actor.components['liquids-states:in_liquid_body'] = {
      liquid_body_id: 'liquids:test_body',
    };

    const rootPartId = 'actor1-body-root';
    const legPartId = 'actor1-leg';

    const bodyParts =
      actor.components['anatomy:body']?.body?.parts
        ? { ...actor.components['anatomy:body'].body.parts }
        : {};

    actor.components['anatomy:body'] = {
      body: {
        root: rootPartId,
        parts: { ...bodyParts, leg: legPartId },
      },
    };

    const rootPart = new ModEntityBuilder(rootPartId)
      .asBodyPart({ subType: 'torso', children: [legPartId] })
      .build();

    const legPart = new ModEntityBuilder(legPartId)
      .asBodyPart({ parent: rootPartId, subType: 'leg' })
      .withComponent('core:movement', { locked: false })
      .build();

    const target = new ModEntityBuilder('actor2')
      .withName('Eli')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .build();

    const direction = new ModEntityBuilder('direction1')
      .withName('north')
      .withComponent('movement:direction', {
        source: 'room1',
        destination: 'room2',
        description: 'To the north',
      })
      .build();

    return {
      actor,
      entities: [
        room1,
        room2,
        actor,
        target,
        direction,
        rootPart,
        legPart,
        ...handEntities,
      ],
    };
  };

  describe('Action structure validation', () => {
    it.each(ACTIONS)(
      '$id includes liquids-states:in_liquid_body as forbidden component',
      ({ action }) => {
        expect(action.forbidden_components?.actor).toContain(
          'liquids-states:in_liquid_body'
        );
      }
    );
  });

  describe('Action discovery when in a liquid body', () => {
    it.each(ACTIONS)(
      '$id is not discoverable when actor is in a liquid body',
      ({ id, action }) => {
        const { actor, entities } = setupScenario();

        testFixture.reset(entities);
        configureActionDiscovery();
        testFixture.testEnv.actionIndex.buildIndex([action]);

        const availableActions = testFixture.testEnv.getAvailableActions(
          actor.id
        );
        const ids = availableActions.map((available) => available.id);

        expect(ids).not.toContain(id);
      }
    );
  });
});
