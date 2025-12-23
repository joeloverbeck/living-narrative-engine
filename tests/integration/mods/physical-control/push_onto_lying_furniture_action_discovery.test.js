/**
 * @file Integration tests for physical-control:push_onto_lying_furniture action discovery.
 * @description Ensures the push onto furniture action only appears when both actor and furniture requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { validateActionExecution } from '../../../common/mods/actionExecutionValidator.js';
import pushOntoFurnitureAction from '../../../../data/mods/physical-control/actions/push_onto_lying_furniture.action.json';

const ACTION_ID = 'physical-control:push_onto_lying_furniture';
const ACTOR_ID = 'test:actor';
const TARGET_ID = 'test:target';
const FURNITURE_ID = 'test:furniture';

/**
 * Builds a baseline scenario for testing and hydrates the fixture.
 *
 * @param {ModTestFixture} fixture - Active test fixture.
 * @param {object} [options] - Scenario configuration.
 * @param {boolean} [options.includeCloseness] - Whether actors start close together.
 * @param {boolean} [options.includeFurniture] - Whether to include any lying furniture.
 * @param {boolean} [options.furnitureAllowsLying] - Whether the primary furniture permits lying.
 * @param {string} [options.furnitureLocation] - Location identifier for the furniture.
 * @param {object} [options.actorComponents] - Additional actor components.
 * @param {object} [options.targetComponents] - Additional target components.
 * @param {Array<object>} [options.extraFurniture] - Additional furniture entity definitions.
 */
function setupScenario(
  fixture,
  {
    includeCloseness = true,
    includeFurniture = true,
    furnitureAllowsLying = true,
    furnitureLocation = 'room1',
    actorComponents = {},
    targetComponents = {},
    extraFurniture = [],
  } = {}
) {
  const room = ModEntityScenarios.createRoom('room1', 'Test Room');

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Rhea')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor();

  const targetBuilder = new ModEntityBuilder(TARGET_ID)
    .withName('Noah')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor();

  if (includeCloseness) {
    actorBuilder.closeToEntity(TARGET_ID);
    targetBuilder.closeToEntity(ACTOR_ID);
  }

  Object.entries(actorComponents).forEach(([componentId, value]) => {
    actorBuilder.withComponent(componentId, value);
  });

  Object.entries(targetComponents).forEach(([componentId, value]) => {
    targetBuilder.withComponent(componentId, value);
  });

  const entities = [room, actorBuilder.build(), targetBuilder.build()];

  if (includeFurniture) {
    const furnitureBuilder = new ModEntityBuilder(FURNITURE_ID)
      .withName('Steel Table')
      .atLocation(furnitureLocation)
      .withLocationComponent(furnitureLocation);

    if (furnitureAllowsLying) {
      furnitureBuilder.withComponent('lying:allows_lying_on', {});
    }

    entities.push(furnitureBuilder.build());

    extraFurniture.forEach((definition, index) => {
      const id = definition.id || `${FURNITURE_ID}-${index + 2}`;
      const builder = new ModEntityBuilder(id)
        .withName(definition.name || `Furniture ${index + 2}`)
        .atLocation(definition.locationId || furnitureLocation)
        .withLocationComponent(definition.locationId || furnitureLocation);

      if (definition.allowsLying !== false) {
        builder.withComponent('lying:allows_lying_on', {});
      }

      entities.push(builder.build());
    });
  }

  fixture.reset(entities);
}

describe('physical-control:push_onto_lying_furniture action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('physical-control', ACTION_ID);
    if (testFixture?.testEnv?.actionIndex) {
      testFixture.testEnv.actionIndex.buildIndex([pushOntoFurnitureAction]);
    }
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('defines the expected multi-target action shape', () => {
      expect(pushOntoFurnitureAction).toBeDefined();
      expect(pushOntoFurnitureAction.id).toBe(ACTION_ID);
      expect(pushOntoFurnitureAction.generateCombinations).toBe(true);
      expect(pushOntoFurnitureAction.template).toBe(
        'push {primary} down onto {secondary}'
      );
      expect(pushOntoFurnitureAction.targets.primary.scope).toBe(
        'personal-space:close_actors_facing_each_other_or_behind_target'
      );
      expect(pushOntoFurnitureAction.targets.secondary.scope).toBe(
        'lying:available_lying_furniture'
      );
      expect(pushOntoFurnitureAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(pushOntoFurnitureAction.forbidden_components.actor).toEqual([
        'biting-states:biting_neck',
        'lying-states:lying_on',
        'hugging-states:hugging',
        'hugging-states:being_hugged',
        'physical-control-states:being_restrained',
        'physical-control-states:restraining',
        'recovery-states:fallen',
      ]);
      expect(pushOntoFurnitureAction.forbidden_components.primary).toEqual([
        'lying-states:lying_on',
        'deference-states:kneeling_before',
      ]);
    });
  });

  describe('Action discovery scenarios', () => {
    it('has no validation errors when all requirements are met', () => {
      setupScenario(testFixture);

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: FURNITURE_ID,
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(errors).toHaveLength(0);
    });

    it('returns all lying furniture targets in scope when multiple are present', () => {
      setupScenario(testFixture, {
        extraFurniture: [
          {
            id: 'test:furniture-2',
            name: 'Velvet Chaise',
            locationId: 'room1',
          },
        ],
      });

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: FURNITURE_ID,
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });
      expect(errors).toHaveLength(0);

      const alternateErrors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: 'test:furniture-2',
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });
      expect(alternateErrors).toHaveLength(0);
    });

    it('fails validation when the actor lacks closeness', () => {
      setupScenario(testFixture, { includeCloseness: false });

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: FURNITURE_ID,
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'missing_required_component')
      ).toBe(true);
    });

    it('fails validation when the actor is lying down', () => {
      setupScenario(testFixture, {
        actorComponents: {
          'lying-states:lying_on': { furniture_id: 'test:bed' },
        },
      });

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: FURNITURE_ID,
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'forbidden_component_present')
      ).toBe(true);
    });

    it('fails validation when the actor is hugging the target', () => {
      setupScenario(testFixture, {
        actorComponents: {
          'hugging-states:hugging': {
            embraced_entity_id: TARGET_ID,
            initiated: true,
            consented: true,
          },
        },
        targetComponents: {
          'hugging-states:being_hugged': { hugging_entity_id: ACTOR_ID },
        },
      });

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: FURNITURE_ID,
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'forbidden_component_present')
      ).toBe(true);
    });

    it('fails validation when the actor is being hugged', () => {
      setupScenario(testFixture, {
        actorComponents: {
          'hugging-states:being_hugged': { hugging_entity_id: TARGET_ID },
        },
      });

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: FURNITURE_ID,
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'forbidden_component_present')
      ).toBe(true);
    });

    it('fails validation when the primary target is lying or kneeling', () => {
      setupScenario(testFixture, {
        targetComponents: {
          'lying-states:lying_on': { furniture_id: 'test:bed' },
          'deference-states:kneeling_before': { entity_id: ACTOR_ID },
        },
      });

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: TARGET_ID,
        secondaryTargetId: FURNITURE_ID,
        actionDefinition: pushOntoFurnitureAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'forbidden_component_present')
      ).toBe(true);
    });

    it('returns no furniture targets when none exist', () => {
      setupScenario(testFixture, { includeFurniture: false });

      const actorEntity = testFixture.entityManager.getEntityInstance(ACTOR_ID);
      const furnitureScope =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'lying:available_lying_furniture',
          { actor: actorEntity }
        );

      expect(furnitureScope.success).toBe(true);
      expect(Array.from(furnitureScope.value || [])).toHaveLength(0);
    });

    it('filters furniture located in different rooms', () => {
      setupScenario(testFixture, { furnitureLocation: 'room2' });

      const actorEntity = testFixture.entityManager.getEntityInstance(ACTOR_ID);
      const furnitureScope =
        testFixture.testEnv.unifiedScopeResolver.resolveSync(
          'lying:available_lying_furniture',
          { actor: actorEntity }
        );

      expect(furnitureScope.success).toBe(true);
      expect(Array.from(furnitureScope.value || [])).toHaveLength(0);
    });
  });
});
