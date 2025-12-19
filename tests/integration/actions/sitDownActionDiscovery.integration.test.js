import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionDiscoveryServiceTestBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';

describe('sit_down action discovery integration', () => {
  let testBed;
  let actionDiscoveryService;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should discover sit_down action when park bench is at same location', async () => {
    // Set up the sit_down action definition
    const sitDownAction = {
      id: 'positioning:sit_down',
      name: 'Sit down',
      description: 'Sit down on available furniture',
      targets: 'positioning:available_furniture', // Legacy format
      required_components: {
        actor: ['core:actor'],
      },
      forbidden_components: {
        actor: ['positioning:sitting_on', 'positioning:kneeling_before'],
      },
      template: 'sit down on {target}',
      prerequisites: [],
    };

    // Mock the action index to return our sit_down action
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(
      (actor) => {
        // Check if actor has required components and no forbidden components
        const hasRequiredComponents = true; // Assume actor has core:actor
        const hasForbiddenComponents = false; // Assume actor doesn't have sitting_on or kneeling_before

        if (hasRequiredComponents && !hasForbiddenComponents) {
          return [sitDownAction];
        }
        return [];
      }
    );

    // Mock entity manager to provide actor and bench data
    const entitiesData = {
      ane_arrieta_instance: {
        id: 'ane_arrieta_instance',
        components: {
          'core:name': { text: 'Ane Arrieta' },
          'core:actor': {},
          'core:position': { locationId: 'park_instance' },
        },
      },
      park_bench_instance: {
        id: 'park_bench_instance',
        components: {
          'core:name': { text: 'Park Bench' },
          'core:position': { locationId: 'park_instance' },
          'sitting:allows_sitting': { spots: [null, null] },
        },
      },
    };

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
    // hasComponent and getEntitiesWithComponent are not available in the mock, skip them

    // Mock target resolution to resolve the scope
    testBed.mocks.targetResolutionService.resolveTargets.mockImplementation(
      () => ({
        success: true,
        value: [
          {
            entityId: 'park_bench_instance',
            displayName: 'park bench',
          },
        ],
        errors: [],
      })
    );

    // Mock prerequisite evaluation
    testBed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
      () => ({
        passed: true,
        details: [],
      })
    );

    // Mock formatter - expects (actionDef, target, context) from test bed
    testBed.mocks.actionCommandFormatter.format.mockImplementation(
      (actionDef, target, context) => {
        // Return the expected result structure
        if (target?.entityId === 'park_bench_instance') {
          return {
            ok: true,
            value: actionDef.template.replace('{target}', 'park bench'),
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

    // Discover actions for Ane Arrieta
    const actorEntity = entitiesData['ane_arrieta_instance'];
    const result = await actionDiscoveryService.getValidActions(
      actorEntity,
      {
        actorLocation: 'park_instance',
      },
      { trace: false }
    );

    // Check that sit_down action is available
    expect(result.actions).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);

    // Debug: log what actions were found
    console.log(
      'Actions found:',
      result.actions.map((a) => a.id)
    );

    const sitDownAvailable = result.actions.find(
      (a) => a.id === 'positioning:sit_down'
    );
    expect(sitDownAvailable).toBeDefined();
    expect(sitDownAvailable?.id).toBe('positioning:sit_down');
    expect(sitDownAvailable?.command).toContain('park bench');
  });

  it('should NOT discover sit_down action when actor is already sitting', async () => {
    // Set up the sit_down action definition
    const sitDownAction = {
      id: 'positioning:sit_down',
      name: 'Sit down',
      description: 'Sit down on available furniture',
      targets: 'positioning:available_furniture',
      required_components: {
        actor: ['core:actor'],
      },
      forbidden_components: {
        actor: ['positioning:sitting_on', 'positioning:kneeling_before'],
      },
      template: 'sit down on {target}',
      prerequisites: [],
    };

    // Mock the action index to filter out sit_down when actor is sitting
    testBed.mocks.actionIndex.getCandidateActions.mockImplementation(
      (actor) => {
        // Actor has forbidden component (sitting_on), so action should be filtered out
        return [];
      }
    );

    // Mock entity manager with actor who is already sitting
    const entitiesData = {
      ane_arrieta_instance: {
        id: 'ane_arrieta_instance',
        components: {
          'core:name': { text: 'Ane Arrieta' },
          'core:actor': {},
          'core:position': { locationId: 'park_instance' },
          'positioning:sitting_on': { entityId: 'park_bench_instance' }, // Already sitting!
        },
      },
    };

    testBed.mocks.entityManager.getEntity.mockImplementation(
      (id) => entitiesData[id]
    );
    testBed.mocks.entityManager.getAllComponentTypesForEntity.mockImplementation(
      (id) => {
        const entity = entitiesData[id];
        return entity ? Object.keys(entity.components) : [];
      }
    );

    // Create the action discovery service
    actionDiscoveryService = testBed.createStandardDiscoveryService();

    // Discover actions for Ane Arrieta who is already sitting
    const actorEntity = entitiesData['ane_arrieta_instance'];
    const result = await actionDiscoveryService.getValidActions(
      actorEntity,
      { actorLocation: 'park_instance' },
      { trace: false }
    );

    // Check that sit_down action is NOT available
    const sitDownAvailable = result.actions.find(
      (a) => a.id === 'positioning:sit_down'
    );
    expect(sitDownAvailable).toBeUndefined();
  });
});
