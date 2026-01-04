/**
 * @file Integration tests for the facing_away filtering in striking action scopes.
 * @description Ensures the striking scopes (actors_in_location_not_facing_away and
 * actors_in_location_not_attacked_and_not_facing_away) correctly filter out targets
 * that the actor is facing away from. This tests the unidirectional facing check
 * where only the actor's perspective matters.
 *
 * NOTE: This test file demonstrates the migration from legacy manual mocking patterns
 * to the new mockScope() and registerCondition() APIs. See docs/testing/test-infrastructure-migration.md
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import punchTargetAction from '../../../../data/mods/striking/actions/punch_target.action.json' assert { type: 'json' };
import suckerPunchTargetAction from '../../../../data/mods/striking/actions/sucker_punch_target.action.json' assert { type: 'json' };

const PUNCH_ACTION_ID = 'striking:punch_target';
const SUCKER_PUNCH_ACTION_ID = 'striking:sucker_punch_target';
const ROOM_ID = 'room1';

describe('striking scopes facing_away filtering', () => {
  let fixture;

  /**
   * Creates a mock arm body part entity that satisfies the striking:actor_arm_body_parts scope.
   * This arm has the required damage-types:damage_capabilities component.
   *
   * @param {string} actorId - The actor who owns this arm
   * @returns {object} Entity definition for the arm
   */
  const createArmBodyPart = (actorId) => ({
    id: `${actorId}_left_arm`,
    components: {
      'core:name': { text: 'Left Arm' },
      'anatomy:part': {
        subType: 'humanoid_arm',
        slot: 'left_arm',
        ownerEntityId: actorId,
      },
      'damage-types:damage_capabilities': {
        entries: [{ name: 'blunt', amount: 5 }],
      },
    },
  });

  /**
   * Configures scope resolution for striking actions.
   * Sets up the actors_in_location_not_facing_away scope.
   */
  const configureScopes = async () => {
    const { testEnv } = fixture;
    if (!testEnv) {
      return;
    }

    // Register positioning scopes as base dependency
    ScopeResolverHelpers.registerPositioningScopes(testEnv);

    // Register the striking scopes with their condition dependencies
    await ScopeResolverHelpers.registerCustomScope(
      testEnv,
      'striking',
      'actors_in_location_not_facing_away'
    );

    // Mock the striking:actor-has-arm prerequisite to always pass
    // Using new registerCondition() API - see docs/testing/test-infrastructure-migration.md
    fixture.registerCondition('striking:actor-has-arm', {
      id: 'striking:actor-has-arm',
      description: 'Mocked condition for test - always passes',
      logic: { '==': [true, true] },
    });

    // Mock the anatomy:actor-has-free-grabbing-appendage prerequisite
    fixture.registerCondition('anatomy:actor-has-free-grabbing-appendage', {
      id: 'anatomy:actor-has-free-grabbing-appendage',
      description: 'Mocked condition for test - always passes',
      logic: { '==': [true, true] },
    });
  };

  /**
   * Configures the combined scope for sucker_punch testing.
   */
  const configureSuckerPunchScope = async () => {
    const { testEnv } = fixture;
    if (!testEnv) {
      return;
    }

    ScopeResolverHelpers.registerPositioningScopes(testEnv);

    // Register the combined scope
    await ScopeResolverHelpers.registerCustomScope(
      testEnv,
      'striking',
      'actors_in_location_not_attacked_and_not_facing_away'
    );

    // Mock prerequisites using new registerCondition() API
    fixture.registerCondition('striking:actor-has-arm', {
      id: 'striking:actor-has-arm',
      description: 'Mocked condition for test - always passes',
      logic: { '==': [true, true] },
    });
    fixture.registerCondition('anatomy:actor-has-free-grabbing-appendage', {
      id: 'anatomy:actor-has-free-grabbing-appendage',
      description: 'Mocked condition for test - always passes',
      logic: { '==': [true, true] },
    });
  };

  /**
   * Configures the action index and scope resolver to mock the primary arm scope.
   * This allows us to test the secondary scope filtering without needing
   * full anatomy/body part setup.
   *
   * @param {object} action - The action definition to register
   * @param {string} actorId - The actor ID whose arm scope should be mocked
   */
  const configureActionWithMockedArmScope = (action, actorId) => {
    const { testEnv } = fixture;
    if (!testEnv) return;

    // Register the action
    testEnv.actionIndex.buildIndex([action]);

    // Mock the arm scope to return the actor's arm
    // Using new mockScope() API - see docs/testing/test-infrastructure-migration.md
    const armEntityId = `${actorId}_left_arm`;
    fixture.mockScope('striking:actor_arm_body_parts', new Set([armEntityId]));
  };

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('striking', PUNCH_ACTION_ID);
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('actors_in_location_not_facing_away scope (punch_target)', () => {
    it('should NOT discover punch action when actor is facing away from target', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['target1'],
        })
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      // Action should NOT be available because actor is facing away from target
      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).not.toContain(PUNCH_ACTION_ID);
    });

    it('should discover punch action when actor is NOT facing away from target', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(PUNCH_ACTION_ID);
    });

    it('should still discover punch action when target is facing away from actor (unidirectional)', async () => {
      // Only the actor's perspective matters - target facing away should NOT block
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['actor1'], // Target is facing away from actor
        })
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      // Action SHOULD be available - you can punch someone's back
      expect(actionIds).toContain(PUNCH_ACTION_ID);
    });

    it('should filter only the specific target actor is facing away from', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['bobby1'], // Only facing away from Bobby
        })
        .build();

      const arm = createArmBodyPart('actor1');

      const bobby = new ModEntityBuilder('bobby1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      const charlie = new ModEntityBuilder('charlie1')
        .withName('Charlie')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, bobby, charlie]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const punchAction = actions.find((a) => a.id === PUNCH_ACTION_ID);

      // Action should be available (at least Charlie is a valid target)
      expect(punchAction).toBeDefined();
    });

    it('should discover punch action when facing_away_from array is empty', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: [], // Empty array
        })
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(PUNCH_ACTION_ID);
    });

    it('should discover punch action when facing away from unrelated entity', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['unrelated_entity'],
        })
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(PUNCH_ACTION_ID);
    });
  });

  describe('actors_in_location_not_attacked_and_not_facing_away scope (sucker_punch)', () => {
    it('should NOT discover sucker_punch when actor is facing away', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['target1'],
        })
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureSuckerPunchScope();
      configureActionWithMockedArmScope(suckerPunchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).not.toContain(SUCKER_PUNCH_ACTION_ID);
    });

    it('should NOT discover sucker_punch when already attacked by actor', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('attack-states:attacked_by', {
          attackers: ['actor1'],
        })
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureSuckerPunchScope();
      configureActionWithMockedArmScope(suckerPunchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).not.toContain(SUCKER_PUNCH_ACTION_ID);
    });

    it('should discover sucker_punch when neither facing away nor attacked', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureSuckerPunchScope();
      configureActionWithMockedArmScope(suckerPunchTargetAction, 'actor1');

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((a) => a.id);

      expect(actionIds).toContain(SUCKER_PUNCH_ACTION_ID);
    });
  });

  describe('Workflow: turn_your_back then scope resolution', () => {
    it('should block punch after simulating turn_your_back', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      // Step 1: Verify action IS available initially
      let actions = fixture.testEnv.getAvailableActions('actor1');
      let actionIds = actions.map((a) => a.id);
      expect(actionIds).toContain(PUNCH_ACTION_ID);

      // Step 2: Simulate turn_your_back by adding facing_away component
      fixture.entityManager.addComponent('actor1', 'facing-states:facing_away', {
        facing_away_from: ['target1'],
      });

      // Step 3: Verify action is NO LONGER available
      actions = fixture.testEnv.getAvailableActions('actor1');
      actionIds = actions.map((a) => a.id);
      expect(actionIds).not.toContain(PUNCH_ACTION_ID);
    });

    it('should unblock punch after simulating turn_around_to_face', async () => {
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['target1'],
        })
        .build();

      const arm = createArmBodyPart('actor1');

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .asActor()
        .build();

      fixture.reset([room, actor, arm, target]);
      await configureScopes();
      configureActionWithMockedArmScope(punchTargetAction, 'actor1');

      // Step 1: Verify action is blocked initially
      let actions = fixture.testEnv.getAvailableActions('actor1');
      let actionIds = actions.map((a) => a.id);
      expect(actionIds).not.toContain(PUNCH_ACTION_ID);

      // Step 2: Simulate turn_around_to_face by removing facing_away component
      fixture.entityManager.removeComponent('actor1', 'facing-states:facing_away');

      // Step 3: Verify action IS now available
      actions = fixture.testEnv.getAvailableActions('actor1');
      actionIds = actions.map((a) => a.id);
      expect(actionIds).toContain(PUNCH_ACTION_ID);
    });
  });
});
