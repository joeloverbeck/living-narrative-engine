/**
 * @file Action discovery tests for vampirism:lunge_bite_neck_violently
 * @description Validates action availability for distance vampire attacks (no closeness required)
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import lungeBiteNeckViolentlyAction from '../../../../data/mods/vampirism/actions/lunge_bite_neck_violently.action.json';

const ACTION_ID = 'vampirism:lunge_bite_neck_violently';

describe('vampirism:lunge_bite_neck_violently - Action Discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('vampirism', ACTION_ID);

    // Build action index for discovery
    testFixture.testEnv.actionIndex.buildIndex([lungeBiteNeckViolentlyAction]);

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Register core:actors_in_location scope (not auto-loaded in tests)
    const actorsInLocationResolver = ScopeResolverHelpers.createLocationMatchResolver(
      'core:actors_in_location',
      {
        requireActorComponent: true,
        excludeSelf: true,
      }
    );

    ScopeResolverHelpers._registerResolvers(
      testFixture.testEnv,
      testFixture.testEnv.entityManager,
      { 'core:actors_in_location': actorsInLocationResolver }
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Positive Discovery Cases', () => {
    it('discovers action when vampire and target are in same location without closeness', () => {
      const actor = testFixture.createEntity({
        id: 'vampire1',
        name: 'Vampire',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
          'vampirism:is_vampire': {},
        },
      });

      const target = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
        },
      });

      const room = ModEntityScenarios.createRoom('room1', 'Dark Alley');
      testFixture.reset([room, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('discovers action when vampire and multiple targets are in same location', () => {
      const actor = testFixture.createEntity({
        id: 'vampire1',
        name: 'Predator',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'dark_alley' },
          'vampirism:is_vampire': {},
        },
      });

      const target1 = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim 1',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'dark_alley' },
        },
      });

      const target2 = testFixture.createEntity({
        id: 'victim2',
        name: 'Victim 2',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'dark_alley' },
        },
      });

      const room = ModEntityScenarios.createRoom('dark_alley', 'Dark Alley');
      testFixture.reset([room, actor, target1, target2]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('discovers action even when actors are at opposite ends of location', () => {
      const actor = testFixture.createEntity({
        id: 'vampire1',
        name: 'Vampire',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
          'vampirism:is_vampire': {},
        },
      });

      const target = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
        },
      });

      const room = ModEntityScenarios.createRoom('room1', 'Large Hall');
      testFixture.reset([room, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });
  });

  describe('Negative Discovery Cases', () => {
    it('does not discover when actor is not a vampire', () => {
      const actor = testFixture.createEntity({
        id: 'human1',
        name: 'Human',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
        },
      });

      const target = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
        },
      });

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when vampire actor already has biting_neck component', () => {
      const actor = testFixture.createEntity({
        id: 'vampire1',
        name: 'Vampire',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
          'vampirism:is_vampire': {},
          'positioning:biting_neck': {
            bitten_entity_id: 'other_entity',
            initiated: true,
          },
        },
      });

      const target = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
        },
      });

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when vampire actor has giving_blowjob component', () => {
      const actor = testFixture.createEntity({
        id: 'vampire1',
        name: 'Vampire',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
          'vampirism:is_vampire': {},
          'positioning:giving_blowjob': {
            target_id: 'victim1',
          },
        },
      });

      const target = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
        },
      });

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when target has being_bitten_in_neck component', () => {
      const actor = testFixture.createEntity({
        id: 'vampire1',
        name: 'Vampire',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
          'vampirism:is_vampire': {},
        },
      });

      const target = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room1' },
          'positioning:being_bitten_in_neck': {
            biting_entity_id: 'other_vampire',
          },
        },
      });

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when no other actors in location', () => {
      const actor = testFixture.createEntity({
        id: 'lone_vampire',
        name: 'Lone Vampire',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'empty_room' },
          'vampirism:is_vampire': {},
        },
      });

      const room = ModEntityScenarios.createRoom('empty_room', 'Empty Room');
      testFixture.reset([room, actor]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('does not discover when actors in different locations', () => {
      const actor = testFixture.createEntity({
        id: 'vampire1',
        name: 'Vampire',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room_a' },
          'vampirism:is_vampire': {},
        },
      });

      const target = testFixture.createEntity({
        id: 'victim1',
        name: 'Victim',
        components: {
          'core:actor': {},
          'core:position': { locationId: 'room_b' },
        },
      });

      const roomA = ModEntityScenarios.createRoom('room_a', 'Room A');
      const roomB = ModEntityScenarios.createRoom('room_b', 'Room B');
      testFixture.reset([roomA, roomB, actor, target]);

      const availableActions = testFixture.testEnv.getAvailableActions(actor.id);
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
