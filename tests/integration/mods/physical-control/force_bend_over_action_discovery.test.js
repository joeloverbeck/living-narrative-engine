/**
 * @file Integration tests for physical-control:force_bend_over action discovery.
 * @description Validates that the force bend over action only appears when proximity, surface, and component requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { validateActionExecution } from '../../../common/mods/actionExecutionValidator.js';
import forceBendOverAction from '../../../../data/mods/physical-control/actions/force_bend_over.action.json';

const ACTION_ID = 'physical-control:force_bend_over';
const ACTOR_ID = 'test:actor';
const PRIMARY_ID = 'test:primary';
const SURFACE_ID = 'test:surface';

/**
 * Builds a baseline scenario for testing and hydrates the fixture.
 *
 * @param {ModTestFixture} fixture - Active test fixture.
 * @param {object} [options] - Scenario configuration.
 * @param {boolean} [options.includeCloseness] - Whether actors start close together.
 * @param {boolean} [options.includeSurface] - Whether to include any bending-ready surface.
 * @param {boolean} [options.surfaceAllowsBending] - Whether the primary surface permits bending over.
 * @param {string} [options.surfaceLocation] - Location identifier for the surface.
 * @param {object} [options.actorComponents] - Additional actor components.
 * @param {object} [options.primaryComponents] - Additional primary target components.
 * @param {Array<object>} [options.extraSurfaces] - Additional surface entity definitions.
 */
function setupScenario(
  fixture,
  {
    includeCloseness = true,
    includeSurface = true,
    surfaceAllowsBending = true,
    surfaceLocation = 'room1',
    actorComponents = {},
    primaryComponents = {},
    extraSurfaces = [],
  } = {}
) {
  const room = ModEntityScenarios.createRoom('room1', 'Test Room');

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Rhea')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor();

  const primaryBuilder = new ModEntityBuilder(PRIMARY_ID)
    .withName('Noah')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor();

  if (includeCloseness) {
    actorBuilder.closeToEntity(PRIMARY_ID);
    primaryBuilder.closeToEntity(ACTOR_ID);
  }

  Object.entries(actorComponents).forEach(([componentId, value]) => {
    actorBuilder.withComponent(componentId, value);
  });

  Object.entries(primaryComponents).forEach(([componentId, value]) => {
    primaryBuilder.withComponent(componentId, value);
  });

  const entities = [room, actorBuilder.build(), primaryBuilder.build()];

  if (includeSurface) {
    const surfaceBuilder = new ModEntityBuilder(SURFACE_ID)
      .withName('Steel Table')
      .atLocation(surfaceLocation)
      .withLocationComponent(surfaceLocation);

    if (surfaceAllowsBending) {
      surfaceBuilder.withComponent('bending:allows_bending_over', {});
    }

    entities.push(surfaceBuilder.build());

    extraSurfaces.forEach((definition, index) => {
      const id = definition.id || `${SURFACE_ID}-${index + 2}`;
      const builder = new ModEntityBuilder(id)
        .withName(definition.name || `Surface ${index + 2}`)
        .atLocation(definition.locationId || surfaceLocation)
        .withLocationComponent(definition.locationId || surfaceLocation);

      if (definition.allowsBending !== false) {
        builder.withComponent('bending:allows_bending_over', {});
      }

      entities.push(builder.build());
    });
  }

  fixture.reset(entities);
}

describe('physical-control:force_bend_over action discovery', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      ACTION_ID,
      null,
      null,
      { autoRegisterScopes: true }
    );

    if (testFixture?.testEnv?.actionIndex) {
      testFixture.testEnv.actionIndex.buildIndex([forceBendOverAction]);
    }
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('defines the expected multi-target action shape', () => {
      expect(forceBendOverAction).toBeDefined();
      expect(forceBendOverAction.generateCombinations).toBe(true);
      expect(forceBendOverAction.targets).toBeDefined();
      expect(forceBendOverAction.targets.primary.scope).toBe(
        'personal-space:close_actors_facing_each_other_or_behind_target'
      );
      expect(forceBendOverAction.targets.secondary.scope).toBe(
        'bending:available_surfaces'
      );
      expect(forceBendOverAction.required_components.actor).toEqual([
        'personal-space-states:closeness',
      ]);
      expect(forceBendOverAction.forbidden_components.actor).toEqual(
        expect.arrayContaining([
          'positioning:biting_neck',
          'positioning:kneeling_before',
          'positioning:straddling_waist',
          'hugging-states:hugging',
          'hugging-states:being_hugged',
          'sex-states:receiving_blowjob',
          'sex-states:giving_blowjob',
        ])
      );
      expect(forceBendOverAction.forbidden_components.primary).toEqual(
        expect.arrayContaining([
          'positioning:kneeling_before',
          'sitting-states:sitting_on',
          'bending-states:bending_over',
        ])
      );
      expect(forceBendOverAction.template).toBe(
        'bend {primary} over {secondary}'
      );
    });
  });

  describe('Action discovery constraints', () => {
    it('discovers the action when actors are close and a valid surface is present', () => {
      setupScenario(testFixture);

      const availableActions = testFixture.discoverActions(ACTOR_ID);
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).toContain(ACTION_ID);

      const actionEntry = availableActions.find(
        (action) => action.id === ACTION_ID
      );
      expect(actionEntry).toBeDefined();
    });

    it('omits the action when actors are not close to each other', () => {
      setupScenario(testFixture, { includeCloseness: false });

      const availableActions = testFixture.discoverActions(ACTOR_ID);
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: PRIMARY_ID,
        secondaryTargetId: SURFACE_ID,
        actionDefinition: forceBendOverAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'missing_required_component')
      ).toBe(true);
    });

    it('fails validation when the actor has a forbidden component state', () => {
      setupScenario(testFixture, {
        actorComponents: {
          'sex-states:giving_blowjob': {
            receiving_entity_id: PRIMARY_ID,
            initiated: true,
          },
        },
      });

      const availableActions = testFixture.discoverActions(ACTOR_ID);
      const actionIds = availableActions.map((action) => action.id);
      expect(actionIds).not.toContain(ACTION_ID);

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: PRIMARY_ID,
        secondaryTargetId: SURFACE_ID,
        actionDefinition: forceBendOverAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'forbidden_component_present')
      ).toBe(true);
    });

    it('fails validation when the primary target holds forbidden positioning components', () => {
      setupScenario(testFixture, {
        primaryComponents: {
          'positioning:kneeling_before': { entity_id: ACTOR_ID },
          'bending-states:bending_over': { surface_id: 'test:other-surface' },
        },
      });

      const availableActions = testFixture.discoverActions(ACTOR_ID);
      const actionIds = availableActions.map((action) => action.id);
      expect(actionIds).not.toContain(ACTION_ID);

      const errors = validateActionExecution({
        actorId: ACTOR_ID,
        targetId: PRIMARY_ID,
        secondaryTargetId: SURFACE_ID,
        actionDefinition: forceBendOverAction,
        entityManager: testFixture.entityManager,
        actionId: ACTION_ID,
      });

      expect(
        errors.some((error) => error.type === 'forbidden_component_present')
      ).toBe(true);
    });

    it('excludes surfaces that lack the allows_bending_over component', () => {
      setupScenario(testFixture, { surfaceAllowsBending: false });

      const actorEntity = testFixture.entityManager.getEntityInstance(ACTOR_ID);
      const surfaceScope = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'bending:available_surfaces',
        { actor: actorEntity }
      );

      expect(surfaceScope.success).toBe(true);
      expect(Array.from(surfaceScope.value || [])).toHaveLength(0);

      const availableActions = testFixture.discoverActions(ACTOR_ID);
      expect(availableActions.map((action) => action.id)).not.toContain(
        ACTION_ID
      );
    });

    it('filters surfaces that are located in different rooms', () => {
      setupScenario(testFixture, { surfaceLocation: 'room2' });

      const actorEntity = testFixture.entityManager.getEntityInstance(ACTOR_ID);
      const surfaceScope = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'bending:available_surfaces',
        { actor: actorEntity }
      );

      expect(surfaceScope.success).toBe(true);
      expect(Array.from(surfaceScope.value || [])).toHaveLength(0);
    });
  });
});
