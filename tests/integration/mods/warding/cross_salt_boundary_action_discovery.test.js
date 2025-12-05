/**
 * @file Integration tests for warding:cross_salt_boundary action discovery.
 * @description Ensures the cross salt boundary action is available only when appropriate conditions are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModActionTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import crossSaltBoundaryAction from '../../../../data/mods/warding/actions/cross_salt_boundary.action.json';

const ACTION_ID = 'warding:cross_salt_boundary';

describe('warding:cross_salt_boundary action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = new ModActionTestFixture('warding', ACTION_ID, null, null);
    await testFixture.initialize();

    // Build index with our action
    testFixture.testEnv.actionIndex.buildIndex([crossSaltBoundaryAction]);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  const setupScenario = (actorComponents = {}) => {
    const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

    const actorBuilder = new ModEntityBuilder('test:actor')
      .withName('Corrupted Entity')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('warding:corrupted', {})
      .withComponent('warding:warded_by_salt', {});

    // Apply additional components or remove defaults
    Object.entries(actorComponents).forEach(([key, value]) => {
      if (value === null) {
        // Skip - will delete after build
      } else {
        actorBuilder.withComponent(key, value);
      }
    });

    const actor = actorBuilder.build();

    // Remove components marked for deletion
    Object.entries(actorComponents).forEach(([key, value]) => {
      if (value === null) {
        delete actor.components[key];
      }
    });

    testFixture.reset([room, actor]);
    return { actor };
  };

  describe('Action structure', () => {
    it('uses "none" target scope (self-targeting)', () => {
      expect(crossSaltBoundaryAction.targets).toBe('none');
    });

    it('requires actor to have corrupted component', () => {
      expect(crossSaltBoundaryAction.required_components.actor).toContain(
        'warding:corrupted'
      );
    });

    it('requires actor to have warded_by_salt component', () => {
      expect(crossSaltBoundaryAction.required_components.actor).toContain(
        'warding:warded_by_salt'
      );
    });

    it('forbids actor to be in positioning states that prevent action', () => {
      expect(crossSaltBoundaryAction.forbidden_components.actor).toContain(
        'positioning:fallen'
      );
      expect(crossSaltBoundaryAction.forbidden_components.actor).toContain(
        'positioning:hugging'
      );
      expect(crossSaltBoundaryAction.forbidden_components.actor).toContain(
        'positioning:being_restrained'
      );
    });

    it('has Cool Grey Modern visual scheme', () => {
      expect(crossSaltBoundaryAction.visual.backgroundColor).toBe('#424242');
      expect(crossSaltBoundaryAction.visual.textColor).toBe('#fafafa');
    });

    it('is not chance-based (deterministic action)', () => {
      expect(crossSaltBoundaryAction.chanceBased).toBeUndefined();
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available when actor has both corrupted and warded_by_salt', () => {
      const { actor } = setupScenario();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when actor lacks warding:corrupted', () => {
      const { actor } = setupScenario({
        'warding:corrupted': null, // Remove corrupted component
      });

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor lacks warding:warded_by_salt', () => {
      const { actor } = setupScenario({
        'warding:warded_by_salt': null, // Remove warded_by_salt component
      });

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor lacks both required components', () => {
      const { actor } = setupScenario({
        'warding:corrupted': null,
        'warding:warded_by_salt': null,
      });

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor has forbidden positioning:fallen component', () => {
      const { actor } = setupScenario({
        'positioning:fallen': {},
      });

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor has forbidden positioning:being_restrained component', () => {
      const { actor } = setupScenario({
        'positioning:being_restrained': { restrainer_id: 'some_entity' },
      });

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when actor has forbidden positioning:hugging component', () => {
      const { actor } = setupScenario({
        'positioning:hugging': { target_id: 'some_entity' },
      });

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });
});
