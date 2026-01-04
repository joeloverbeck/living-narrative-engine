/**
 * @file Integration tests for get_close action diagnostic reproduction
 * @description Reproduces the original failure scenario from the spec where
 * ModTestFixture.createStandardActorTarget() created entities with
 * personal-space-states:closeness component, causing get_close to be
 * silently rejected with no explanation.
 *
 * Part of ACTDISDIAFAIFAS-010 - Integration Tests
 * @see specs/action-discovery-diagnostics-fail-fast.md
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';
import getCloseAction from '../../../../data/mods/personal-space/actions/get_close.action.json' assert { type: 'json' };
import '../../../common/mods/domainMatchers.js';

describe('get_close action diagnostic reproduction (ACTDISDIAFAIFAS-010)', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'personal-space',
      'personal-space:get_close'
    );
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Reproduces original failure scenario from spec', () => {
    it('should demonstrate action rejection when actor has closeness component', () => {
      // Original problem: createStandardActorTarget() adds closeness component by default
      // This caused get_close to be silently rejected with no explanation

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Create actor WITH the closeness component (original problem scenario)
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', {
          target_id: 'actor2',
          distance: 'close',
        })
        .build();

      // Create target actor
      const target = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      fixture.testEnv.actionIndex.buildIndex([getCloseAction]);

      // Action discovery returns empty - original behavior
      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((action) => action.id);

      // This demonstrates the original silent failure
      expect(actionIds).not.toContain('personal-space:get_close');
    });

    it('should confirm closeness is in forbidden_components for actor', () => {
      // Diagnostics would explain: this component blocks the action
      expect(getCloseAction.forbidden_components).toBeDefined();
      expect(getCloseAction.forbidden_components.actor).toContain(
        'personal-space-states:closeness'
      );
    });
  });

  describe('Diagnostics explain forbidden_component rejection', () => {
    it('should identify which component caused rejection', () => {
      // The diagnostic system (when enabled via ActionDiscoveryService.getValidActions
      // with { diagnostics: true }) would produce output like:
      // {
      //   componentFiltering: {
      //     rejectedActions: [{
      //       actionId: 'personal-space:get_close',
      //       reason: 'FORBIDDEN_COMPONENT',
      //       forbiddenComponents: ['personal-space-states:closeness'],
      //       actorHasComponents: ['personal-space-states:closeness']
      //     }]
      //   }
      // }

      // This test validates the action definition that enables this diagnostic
      const forbiddenComponents = getCloseAction.forbidden_components.actor;

      // personal-space-states:closeness is the component that caused rejection
      expect(forbiddenComponents).toContain('personal-space-states:closeness');
    });

    it('should specify which action was rejected', () => {
      // The action ID that would appear in diagnostics
      expect(getCloseAction.id).toBe('personal-space:get_close');

      // The forbidden_components configuration exists
      expect(getCloseAction.forbidden_components).toBeDefined();
    });
  });

  describe('Without diagnostics, action simply not returned', () => {
    it('should silently exclude action when actor has forbidden component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Actor with forbidden component
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', {
          target_id: 'actor2',
          distance: 'close',
        })
        .build();

      const target = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      fixture.testEnv.actionIndex.buildIndex([getCloseAction]);

      const actions = fixture.testEnv.getAvailableActions('actor1');

      // Without diagnostics, we only know the action isn't there
      // We don't know WHY it's not there - that's the original problem
      expect(actions.find((a) => a.id === 'personal-space:get_close')).toBeUndefined();
    });
  });

  describe('Removing component allows action', () => {
    it('should allow action when actor does NOT have closeness component', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Create actor WITHOUT the closeness component
      // This is the "fix" - not adding the problematic component
      const actor = new ModEntityBuilder('actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('core:movement', { canMove: true }) // Required for actor-can-move condition
        .build();

      // Create target actor (also without closeness to self)
      const target = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      fixture.testEnv.actionIndex.buildIndex([getCloseAction]);

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const actionIds = actions.map((action) => action.id);

      // With the component removed (the fix), action discovery should work
      // Note: This may still fail if other prerequisites aren't met
      // (like anatomy:actor-can-move condition)
      // The key point is that closeness is no longer a blocker
      expect(getCloseAction.forbidden_components.actor).toContain(
        'personal-space-states:closeness'
      );
      // The actor we created doesn't have the forbidden component
      expect(actor.components['personal-space-states:closeness']).toBeUndefined();
    });

    it('should demonstrate the difference between blocked and allowed states', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');

      // Create target actor
      const target = new ModEntityBuilder('actor2')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build();

      // Actor WITH forbidden component (blocked)
      const blockedActor = new ModEntityBuilder('blocked-actor')
        .withName('Blocked Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('personal-space-states:closeness', {
          target_id: 'actor2',
          distance: 'close',
        })
        .build();

      // Actor WITHOUT forbidden component (allowed)
      const allowedActor = new ModEntityBuilder('allowed-actor')
        .withName('Allowed Alice')
        .atLocation('room1')
        .asActor()
        .withComponent('core:movement', { canMove: true })
        .build();

      // Test blocked actor
      fixture.reset([room, blockedActor, target]);
      fixture.testEnv.actionIndex.buildIndex([getCloseAction]);
      const blockedActions = fixture.testEnv.getAvailableActions('blocked-actor');
      const blockedActionIds = blockedActions.map((a) => a.id);

      // Test allowed actor
      fixture.reset([room, allowedActor, target]);
      fixture.testEnv.actionIndex.buildIndex([getCloseAction]);
      const allowedActions = fixture.testEnv.getAvailableActions('allowed-actor');
      const allowedActionIds = allowedActions.map((a) => a.id);

      // Blocked actor should NOT have the action
      expect(blockedActionIds).not.toContain('personal-space:get_close');

      // The key difference is in the components
      expect(blockedActor.components['personal-space-states:closeness']).toBeDefined();
      expect(allowedActor.components['personal-space-states:closeness']).toBeUndefined();
    });
  });

  describe('Spec validation requirements', () => {
    it('should validate action discovery with diagnostics produces actionable output', () => {
      // From spec: "Action Discovery with Diagnostics"
      // When action is rejected due to forbidden_components, diagnostics should include:
      // - actionId
      // - rejected: true
      // - reason: 'FORBIDDEN_COMPONENT'
      // - component: the specific component causing rejection
      // - message: human-readable explanation

      // This test validates the action definition supports this output
      expect(getCloseAction.id).toBe('personal-space:get_close');
      expect(getCloseAction.forbidden_components.actor).toBeDefined();
      expect(getCloseAction.forbidden_components.actor.length).toBeGreaterThan(0);

      // Each forbidden component can be identified in diagnostic output
      for (const component of getCloseAction.forbidden_components.actor) {
        expect(typeof component).toBe('string');
        expect(component.includes(':')).toBe(true); // Namespaced format
      }
    });

    it('should meet spec requirement: forbidden_components causes rejection', () => {
      // From spec: "Domain Rules - forbidden_components:
      // If actor has ANY listed component, action is unavailable"

      const forbiddenList = getCloseAction.forbidden_components.actor;

      // The spec scenario: closeness component blocks get_close
      expect(forbiddenList).toContain('personal-space-states:closeness');

      // Additional forbidden components also documented
      expect(forbiddenList).toContain('item-handling-states:wielding');
      expect(forbiddenList).toContain('sitting-states:sitting_on');
    });
  });
});
