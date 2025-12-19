/**
 * @file Integration test for sit_down action availability with positioning mod
 * Tests that actions with positioning:available_furniture scope are properly discovered
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

describe('Sit Down Action Availability', () => {
  let testBed;
  let actionDiscoveryService;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should make sit_down action available when actor and furniture are at same location', async () => {
    // Set up the sit_down action definition matching the actual mod data
    const sitDownAction = {
      id: 'positioning:sit_down',
      name: 'Sit down',
      description: 'Sit down on available furniture',
      targets: 'positioning:available_furniture',
      required_components: {
        actor: [], // No required components for actor
      },
      forbidden_components: {
        actor: ['sitting-states:sitting_on', 'positioning:kneeling_before'],
      },
      template: 'sit down on {target}',
      prerequisites: [],
    };

    // Mock the action index to return our sit_down action plus default actions
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(
      (actor) => {
        const actions = [];

        // Check if actor has forbidden components for sit_down
        const hasForbiddenComponents =
          actor.components?.['sitting-states:sitting_on'] ||
          actor.components?.['positioning:kneeling_before'];

        if (!hasForbiddenComponents) {
          actions.push(sitDownAction);
        }

        // Also add default actions (movement:go and core:look)
        actions.push({
          id: 'movement:go',
          name: 'Go',
          scope: 'actor.location.exits[]',
          prerequisites: [],
          template: 'Go {target}',
        });

        actions.push({
          id: 'core:look',
          name: 'Look',
          scope: 'self',
          prerequisites: [],
          template: 'Look around',
        });

        return actions;
      }
    );

    // Set up entity data
    const entitiesData = {
      'test:actor': {
        id: 'test:actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:position': { location_id: 'test:park' },
          // Note: core:actor component is not required for sit_down action
        },
      },
      'test:park_bench': {
        id: 'test:park_bench',
        components: {
          'core:name': { text: 'Park Bench' },
          'core:position': { location_id: 'test:park' },
          'sitting:allows_sitting': {
            spots: [
              { spot_id: '1', occupied: false },
              { spot_id: '2', occupied: false },
            ],
          },
        },
      },
    };

    // Mock entity manager
    testBed.mocks.entityManager.getEntity.mockImplementation(
      (id) => entitiesData[id]
    );
    testBed.mocks.entityManager.getAllComponentTypesForEntity.mockImplementation(
      (id) => {
        const entity = entitiesData[id];
        return entity ? Object.keys(entity.components) : [];
      }
    );
    testBed.mocks.entityManager.getAllComponents.mockImplementation((id) => {
      const entity = entitiesData[id];
      return entity ? entity.components : {};
    });
    testBed.mocks.entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        const entity = entitiesData[entityId];
        return entity?.components[componentId];
      }
    );

    // Mock target resolution to resolve the positioning:available_furniture scope
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      () => ({
        success: true,
        value: [
          {
            entityId: 'test:park_bench',
            displayName: 'Park Bench',
          },
        ],
        errors: [],
      })
    );

    // Mock prerequisite evaluation (sit_down has no prerequisites)
    testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
      () => true
    );

    // Mock action command formatter
    testBed.mocks.actionCommandFormatter.format.mockImplementation(
      (actionDef, target) => {
        if (target?.entityId === 'test:park_bench') {
          return {
            ok: true,
            value: 'sit down on Park Bench',
          };
        }
        return {
          ok: true,
          value: actionDef.template || 'Unknown action',
        };
      }
    );

    // Create the action discovery service
    actionDiscoveryService = testBed.createStandardDiscoveryService();

    // Discover actions for the actor
    const actorEntity = entitiesData['test:actor'];
    const result = await actionDiscoveryService.getValidActions(
      actorEntity,
      {
        actorLocation: 'test:park',
      },
      { trace: false }
    );

    // Log discovered actions for debugging
    console.log(
      'Discovered actions:',
      result.actions.map((a) => a.id)
    );

    // Verify sit_down is available
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);

    const sitDownAvailable = result.actions.find(
      (a) => a.id === 'positioning:sit_down'
    );
    expect(sitDownAvailable).toBeDefined();
    expect(sitDownAvailable?.id).toBe('positioning:sit_down');
    expect(sitDownAvailable?.command).toBe('sit down on Park Bench');
  });

  it('should NOT make sit_down available when actor is already sitting', async () => {
    // Set up the sit_down action definition
    const sitDownAction = {
      id: 'positioning:sit_down',
      name: 'Sit down',
      description: 'Sit down on available furniture',
      targets: 'positioning:available_furniture',
      required_components: {
        actor: [],
      },
      forbidden_components: {
        actor: ['sitting-states:sitting_on', 'positioning:kneeling_before'],
      },
      template: 'sit down on {target}',
      prerequisites: [],
    };

    // Mock the action index to check forbidden components
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(
      (actor) => {
        const actions = [];

        // Actor is already sitting, so has forbidden component
        const hasForbiddenComponents =
          actor.components?.['sitting-states:sitting_on'] ||
          actor.components?.['positioning:kneeling_before'];

        if (!hasForbiddenComponents) {
          actions.push(sitDownAction);
        }

        // Add default actions (always available)
        actions.push({
          id: 'movement:go',
          name: 'Go',
          scope: 'actor.location.exits[]',
          prerequisites: [],
          template: 'Go {target}',
        });

        actions.push({
          id: 'core:look',
          name: 'Look',
          scope: 'self',
          prerequisites: [],
          template: 'Look around',
        });

        return actions;
      }
    );

    // Set up entity data with actor already sitting
    const entitiesData = {
      'test:actor': {
        id: 'test:actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:position': { location_id: 'test:park' },
          'sitting-states:sitting_on': { entityId: 'test:other_bench' }, // Forbidden component
        },
      },
      'test:park_bench': {
        id: 'test:park_bench',
        components: {
          'core:name': { text: 'Park Bench' },
          'core:position': { location_id: 'test:park' },
          'sitting:allows_sitting': {
            spots: [
              { spot_id: '1', occupied: false },
              { spot_id: '2', occupied: false },
            ],
          },
        },
      },
    };

    // Mock entity manager
    testBed.mocks.entityManager.getEntity.mockImplementation(
      (id) => entitiesData[id]
    );
    testBed.mocks.entityManager.getAllComponents.mockImplementation((id) => {
      const entity = entitiesData[id];
      return entity ? entity.components : {};
    });
    testBed.mocks.entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        const entity = entitiesData[entityId];
        return entity?.components[componentId];
      }
    );

    // Create the action discovery service
    actionDiscoveryService = testBed.createStandardDiscoveryService();

    // Discover actions for the actor
    const actorEntity = entitiesData['test:actor'];
    const result = await actionDiscoveryService.getValidActions(
      actorEntity,
      {
        actorLocation: 'test:park',
      },
      { trace: false }
    );

    // Verify sit_down is NOT available
    const sitDownFound = result.actions.find(
      (a) => a.id === 'positioning:sit_down'
    );
    expect(sitDownFound).toBeUndefined();

    console.log(
      'Actions when already sitting:',
      result.actions.map((a) => a.id)
    );
  });

  it('should NOT make sit_down available when no furniture with allows_sitting is present', async () => {
    // Set up the sit_down action definition
    const sitDownAction = {
      id: 'positioning:sit_down',
      name: 'Sit down',
      description: 'Sit down on available furniture',
      targets: 'positioning:available_furniture',
      required_components: {
        actor: [],
      },
      forbidden_components: {
        actor: ['sitting-states:sitting_on', 'positioning:kneeling_before'],
      },
      template: 'sit down on {target}',
      prerequisites: [],
    };

    // Mock the action index to return sit_down action (actor meets requirements)
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(
      (actor) => {
        const actions = [];

        const hasForbiddenComponents =
          actor.components?.['sitting-states:sitting_on'] ||
          actor.components?.['positioning:kneeling_before'];

        if (!hasForbiddenComponents) {
          actions.push(sitDownAction);
        }

        // Add default actions
        actions.push({
          id: 'movement:go',
          name: 'Go',
          scope: 'actor.location.exits[]',
          prerequisites: [],
          template: 'Go {target}',
        });

        actions.push({
          id: 'core:look',
          name: 'Look',
          scope: 'self',
          prerequisites: [],
          template: 'Look around',
        });

        return actions;
      }
    );

    // Set up entity data with no furniture
    const entitiesData = {
      'test:actor': {
        id: 'test:actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:position': { location_id: 'test:park' },
        },
      },
      // No furniture entities at all
    };

    // Mock entity manager
    testBed.mocks.entityManager.getEntity.mockImplementation(
      (id) => entitiesData[id]
    );
    testBed.mocks.entityManager.getAllComponents.mockImplementation((id) => {
      const entity = entitiesData[id];
      return entity ? entity.components : {};
    });
    testBed.mocks.entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        const entity = entitiesData[entityId];
        return entity?.components[componentId];
      }
    );

    // Mock target resolution to return no targets (no furniture available)
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      () => ({
        success: true,
        value: [], // No valid targets
        errors: [],
      })
    );

    // Create the action discovery service
    actionDiscoveryService = testBed.createStandardDiscoveryService();

    // Discover actions for the actor
    const actorEntity = entitiesData['test:actor'];
    const result = await actionDiscoveryService.getValidActions(
      actorEntity,
      {
        actorLocation: 'test:park',
      },
      { trace: false }
    );

    // Verify sit_down is NOT available (no valid targets)
    const sitDownFound = result.actions.find(
      (a) => a.id === 'positioning:sit_down'
    );
    expect(sitDownFound).toBeUndefined();

    console.log(
      'Actions with no furniture:',
      result.actions.map((a) => a.id)
    );
  });
});
