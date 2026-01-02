/**
 * @file Integration tests for grabbing:grab_neck_target action discovery.
 * @description Ensures the grab neck target action is only discoverable when
 * proximity, appendage, skill, and state requirements are met.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import grabNeckTargetAction from '../../../../data/mods/grabbing/actions/grab_neck_target.action.json';

const ACTION_ID = 'grabbing:grab_neck_target';
const ROOM_ID = 'room1';

describe('grabbing:grab_neck_target action discovery', () => {
  let testFixture;

  const configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return;
    }

    testEnv.actionIndex.buildIndex([grabNeckTargetAction]);
    ScopeResolverHelpers.registerPositioningScopes(testEnv);
  };

  const setupScenario = ({
    actorComponents = {},
    targetComponents = {},
    actorCustomizer = null,
  } = {}) => {
    const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');
    const actorId = 'test:actor';
    const targetId = 'test:target';

    const actorBuilder = new ModEntityBuilder(actorId)
      .withName('Actor')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withComponent('skills:grappling_skill', { value: 10 })
      .withGrabbingHands(1)
      .closeToEntity(targetId);

    const targetBuilder = new ModEntityBuilder(targetId)
      .withName('Target')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .closeToEntity(actorId);

    const actor = actorBuilder.build();
    const target = targetBuilder.build();
    const handEntities = actorBuilder.getHandEntities();

    Object.assign(actor.components, actorComponents);
    Object.assign(target.components, targetComponents);

    if (typeof actorCustomizer === 'function') {
      actorCustomizer({ actor, target, handEntities });
    }

    testFixture.reset([room, actor, target, ...handEntities]);
    return { actor, target, handEntities };
  };

  const getActionIds = (actorId) =>
    testFixture.testEnv
      .getAvailableActions(actorId)
      .map((action) => action.id);

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('grabbing', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('matches the expected grabbing action schema', () => {
      expect(grabNeckTargetAction).toBeDefined();
      expect(grabNeckTargetAction.id).toBe(ACTION_ID);
      expect(grabNeckTargetAction.template).toBe(
        "grab {target}'s neck ({chance}% chance)"
      );
      expect(grabNeckTargetAction.targets).toBe(
        'personal-space-states:close_actors_facing_each_other_or_behind_target'
      );
    });

    it('requires actor closeness + grappling skill and uses the grabbing color palette', () => {
      expect(grabNeckTargetAction.required_components.actor).toEqual(
        expect.arrayContaining([
          'personal-space-states:closeness',
          'skills:grappling_skill',
        ])
      );
      expect(grabNeckTargetAction.visual).toEqual({
        backgroundColor: '#4a4a4a',
        textColor: '#f5f5f5',
        hoverBackgroundColor: '#5a5a5a',
        hoverTextColor: '#ffffff',
      });
    });

    it('has chance-based configuration with opposed contest', () => {
      expect(grabNeckTargetAction.chanceBased).toBeDefined();
      expect(grabNeckTargetAction.chanceBased.enabled).toBe(true);
      expect(grabNeckTargetAction.chanceBased.contestType).toBe('opposed');
      expect(grabNeckTargetAction.chanceBased.actorSkill.component).toBe(
        'skills:grappling_skill'
      );
      expect(grabNeckTargetAction.chanceBased.targetSkill.component).toBe(
        'skills:mobility_skill'
      );
      expect(grabNeckTargetAction.chanceBased.targetSkill.targetRole).toBe(
        'primary'
      );
      expect(grabNeckTargetAction.chanceBased.formula).toBe('ratio');
      expect(grabNeckTargetAction.chanceBased.bounds).toEqual({
        min: 5,
        max: 95,
      });
    });

    it('has prerequisite for free grabbing appendage', () => {
      expect(grabNeckTargetAction.prerequisites).toBeDefined();
      expect(grabNeckTargetAction.prerequisites[0].logic.condition_ref).toBe(
        'anatomy:actor-has-free-grabbing-appendage'
      );
    });

    it('declares forbidden target components for neck_grabbed and dead states', () => {
      expect(grabNeckTargetAction.forbidden_components.target).toEqual(
        expect.arrayContaining(['grabbing-states:neck_grabbed', 'core:dead'])
      );
    });
  });

  describe('Action discovery scenarios', () => {
    it('is available for close actors facing each other', () => {
      const { actor } = setupScenario();
      configureActionDiscovery();

      expect(getActionIds(actor.id)).toContain(ACTION_ID);
    });

    it('is available when the actor stands behind the target', () => {
      const { actor, target } = setupScenario({
        targetComponents: {
          'facing-states:facing_away': {
            facing_away_from: ['test:actor'],
          },
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).toContain(ACTION_ID);
      expect(target.components['facing-states:facing_away'].facing_away_from).toContain(
        actor.id
      );
    });

    it('is not available when actors are not in closeness', () => {
      const { actor } = setupScenario({
        actorCustomizer: ({ actor, target }) => {
          delete actor.components['personal-space-states:closeness'];
          delete target.components['personal-space-states:closeness'];
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });

    it('is not available when the actor faces away from the target', () => {
      const { actor } = setupScenario({
        actorComponents: {
          'facing-states:facing_away': {
            facing_away_from: ['test:target'],
          },
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });

    it('is not available when actor has no free hands', () => {
      const { actor } = setupScenario({
        actorCustomizer: ({ handEntities }) => {
          handEntities.forEach((hand) => {
            if (hand.components?.['anatomy:can_grab']) {
              hand.components['anatomy:can_grab'].locked = true;
            }
          });
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });

    it('is not available when actor lacks grappling skill', () => {
      const { actor } = setupScenario({
        actorCustomizer: ({ actor }) => {
          delete actor.components['skills:grappling_skill'];
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });

    it('is not available when actor is fallen', () => {
      const { actor } = setupScenario({
        actorComponents: { 'recovery-states:fallen': {} },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });

    it('is not available when actor is restraining someone', () => {
      const { actor } = setupScenario({
        actorComponents: {
          'physical-control-states:restraining': {
            target_entity_id: 'test:other',
            initiated: true,
          },
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });

    it('is not available when actor is being restrained', () => {
      const { actor } = setupScenario({
        actorComponents: {
          'physical-control-states:being_restrained': {
            restraining_entity_id: 'test:other',
            consented: false,
          },
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });

    it('is not available when actor is already grabbing neck', () => {
      const { actor } = setupScenario({
        actorComponents: {
          'grabbing-states:grabbing_neck': {
            grabbed_entity_id: 'test:target',
            initiated: true,
          },
        },
      });
      configureActionDiscovery();

      expect(getActionIds(actor.id)).not.toContain(ACTION_ID);
    });
  });

  describe('Chance modifiers', () => {
    it('shows bonus when target is fallen', () => {
      const fallenModifier = grabNeckTargetAction.chanceBased.modifiers.find(
        (modifier) => modifier.tag === 'target downed'
      );

      expect(fallenModifier).toBeDefined();
      expect(fallenModifier.type).toBe('flat');
      expect(fallenModifier.value).toBe(20);
      expect(fallenModifier.targetRole).toBe('primary');
      expect(fallenModifier.condition.logic['!!'][0].var).toBe(
        'entity.primary.components.recovery-states:fallen'
      );
    });

    it('shows bonus when target is restrained', () => {
      const restrainedModifier = grabNeckTargetAction.chanceBased.modifiers.find(
        (modifier) => modifier.tag === 'target restrained'
      );

      expect(restrainedModifier).toBeDefined();
      expect(restrainedModifier.type).toBe('flat');
      expect(restrainedModifier.value).toBe(15);
      expect(restrainedModifier.targetRole).toBe('primary');
      expect(restrainedModifier.condition.logic['!!'][0].var).toBe(
        'entity.primary.components.physical-control-states:being_restrained'
      );
    });
  });
});
