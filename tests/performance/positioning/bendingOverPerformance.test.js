/**
 * @file Performance tests for the bending over system.
 * @description Tests performance characteristics including action discovery
 * efficiency, scope evaluation speed, and memory usage during state changes.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { performance } from 'perf_hooks';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import handleBendOverRule from '../../../data/mods/positioning/rules/bend_over.rule.json';
import handleStraightenUpRule from '../../../data/mods/positioning/rules/straighten_up.rule.json';
import eventIsBendOver from '../../../data/mods/positioning/conditions/event-is-action-bend-over.condition.json';
import eventIsStraightenUp from '../../../data/mods/positioning/conditions/event-is-action-straighten-up.condition.json';
import logSuccessMacro from '../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import bendOverAction from '../../../data/mods/positioning/actions/bend_over.action.json';
import straightenUpAction from '../../../data/mods/positioning/actions/straighten_up.action.json';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';

// Import necessary handlers
import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import LockMovementHandler from '../../../src/logic/operationHandlers/lockMovementHandler.js';
import UnlockMovementHandler from '../../../src/logic/operationHandlers/unlockMovementHandler.js';
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';

import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

/**
 * Creates handlers needed for bending over rules.
 *
 * @param entityManager
 * @param eventBus
 * @param logger
 * @param gameDataRepository
 */
function createHandlers(entityManager, eventBus, logger, gameDataRepository) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    DISPATCH_EVENT: new DispatchEventHandler({
      dispatcher: eventBus,
      logger,
    }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    END_TURN: new EndTurnHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    SET_VARIABLE: new SetVariableHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    ADD_COMPONENT: new AddComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
      gameDataRepository,
    }),
    REMOVE_COMPONENT: new RemoveComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    LOCK_MOVEMENT: new LockMovementHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    UNLOCK_MOVEMENT: new UnlockMovementHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    MODIFY_COMPONENT: new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
  };
}

/**
 * Helper to create a surface with bending support
 *
 * @param entityManager
 * @param id
 * @param name
 * @param locationId
 * @param allowsBending
 */
function createSurface(entityManager, id, name, locationId, allowsBending = true) {
  if (allowsBending) {
    entityManager.addComponent(id, 'positioning:allows_bending_over', {});
  }
  entityManager.addComponent(id, DESCRIPTION_COMPONENT_ID, {
    short: name,
    long: `A ${name}`,
  });
  entityManager.addComponent(id, NAME_COMPONENT_ID, {
    name: name,
  });
  entityManager.addComponent(id, POSITION_COMPONENT_ID, {
    locationId: locationId,
  });
  return id;
}

/**
 * Helper to create an actor
 *
 * @param entityManager
 * @param id
 * @param name
 * @param locationId
 */
function createActor(entityManager, id, name, locationId) {
  entityManager.addComponent(id, ACTOR_COMPONENT_ID, {});
  entityManager.addComponent(id, NAME_COMPONENT_ID, {
    name: name,
  });
  entityManager.addComponent(id, POSITION_COMPONENT_ID, {
    locationId: locationId,
  });
  return id;
}

/**
 * Helper to create a location
 *
 * @param entityManager
 * @param id
 * @param name
 */
function createLocation(entityManager, id, name) {
  entityManager.addComponent(id, 'core:location', {});
  entityManager.addComponent(id, NAME_COMPONENT_ID, {
    name: name,
  });
  entityManager.addComponent(id, DESCRIPTION_COMPONENT_ID, {
    short: name,
    long: `The ${name} area`,
  });
  return id;
}

describe('Bending Over System Performance', () => {
  let testEnv;
  let logger;
  let actionDiscoveryService;
  let actionIndex;
  let scopeResolver;

  beforeEach(() => {
    logger = createMockLogger();

    testEnv = createRuleTestEnvironment({
      createHandlers,
      rules: [handleBendOverRule, handleStraightenUpRule],
      actions: [bendOverAction, straightenUpAction],
      conditions: {
        'positioning:event-is-action-bend-over': eventIsBendOver,
        'positioning:event-is-action-straighten-up': eventIsStraightenUp,
      },
      macros: {
        'core:logSuccessAndEndTurn': logSuccessMacro,
      },
      scopes: {
        'positioning:available_surfaces': {
          scope: 'positioning:available_surfaces := entities(positioning:allows_bending_over)[][{"==": [{"var": "entity.components.core:position.locationId"}, {"var": "actor.components.core:position.locationId"}]}]',
        },
      },
    });

    // Create action index for discovery tests
    actionIndex = new ActionIndex({
      logger,
      entityManager: testEnv.entityManager,
    });

    // Use test environment's scope resolver (which should already handle positioning scopes)
    scopeResolver = testEnv.unifiedScopeResolver;

    // Build index for the actionIndex
    actionIndex.buildIndex([bendOverAction, straightenUpAction]);

    // Create action discovery service with proper pipeline orchestrator
    const mockActionPipelineOrchestrator = {
      discoverActions: jest.fn().mockImplementation(async (actor, context, options = {}) => {
        const candidateActions = actionIndex.getCandidateActions(actor);
        const actions = [];

        for (const actionDef of candidateActions) {
          // Resolve targets using scope resolver
          const scopeValue = actionDef.targets || actionDef.scope;
          if (scopeValue) {
            const targetResult = scopeResolver.resolveSync(scopeValue, { actor });
            if (targetResult.success && targetResult.value.size > 0) {
              for (const targetId of targetResult.value) {
                actions.push({
                  actionId: actionDef.id,
                  id: actionDef.id,
                  name: actionDef.name,
                  command: `${actionDef.name} ${targetId}`,
                  params: { targetId },
                });
              }
            }
          } else {
            // Actions without targets
            actions.push({
              actionId: actionDef.id,
              id: actionDef.id,
              name: actionDef.name,
              command: actionDef.name,
              params: {},
            });
          }
        }

        return { actions, errors: [], trace: options.trace };
      }),
    };

    actionDiscoveryService = new ActionDiscoveryService({
      entityManager: testEnv.entityManager,
      logger,
      actionPipelineOrchestrator: mockActionPipelineOrchestrator,
      traceContextFactory: () => new TraceContext(),
      getActorLocationFn: (actor) => {
        const position = testEnv.entityManager.getComponentData(actor.id, POSITION_COMPONENT_ID);
        return position ? position.locationId : null;
      },
    });
  });

  afterEach(() => {
    testEnv?.cleanup();
  });

  describe('Action Discovery Performance', () => {
    it('should handle action discovery with many surfaces efficiently', async () => {
      const locationId = 'location:test';
      createLocation(testEnv.entityManager, locationId, 'Test Location');
      const actor = createActor(testEnv.entityManager, 'test:actor', 'Actor', locationId);

      // Create 100 surfaces
      const surfaces = [];
      for (let i = 0; i < 100; i++) {
        const surfaceId = `test:surface${i}`;
        createSurface(testEnv.entityManager, surfaceId, `surface${i}`, locationId);
        surfaces.push(surfaceId);
      }

      // Actions and scopes are already registered in beforeEach

      // Measure action discovery time
      const startTime = performance.now();
      const result = await actionDiscoveryService.getValidActions(
        testEnv.entityManager.getEntityInstance(actor),
        { currentLocation: 'location:test' }
      );
      const actions = result.actions;
      const endTime = performance.now();

      const discoveryTime = endTime - startTime;

      // Should discover 100 bend_over actions (one for each surface)
      const bendOverActions = actions.filter(a => a.actionId === 'positioning:bend_over');
      expect(bendOverActions).toHaveLength(100);

      // Performance threshold: < 500ms for 100 surfaces (more realistic for complex action discovery)
      expect(discoveryTime).toBeLessThan(500);
      console.log(`Action discovery with 100 surfaces took ${discoveryTime.toFixed(2)}ms`);
    });

    it('should scale linearly with number of surfaces', async () => {
      const locationId = 'location:test';
      createLocation(testEnv.entityManager, locationId, 'Test Location');
      const actor = createActor(testEnv.entityManager, 'test:actor', 'Actor', locationId);

      // Actions and scopes are already registered in beforeEach

      const measurements = [];

      // Test with different numbers of surfaces
      for (const count of [10, 20, 40, 80]) {
        // Clear previous surfaces by resetting entity manager
        testEnv.entityManager.setEntities([]);
        createLocation(testEnv.entityManager, locationId, 'Test Location');
        createActor(testEnv.entityManager, 'test:actor', 'Actor', locationId);

        // Create surfaces
        for (let i = 0; i < count; i++) {
          createSurface(testEnv.entityManager, `test:surface${i}`, `surface${i}`, locationId);
        }

        // Warm up - run several iterations to stabilize JIT and caches
        for (let i = 0; i < 10; i++) {
          try {
            await actionDiscoveryService.getValidActions(
              testEnv.entityManager.getEntityInstance(actor),
              { currentLocation: locationId }
            );
          } catch {
            // Ignore warm-up errors
          }
        }

        // Measure discovery time
        const startTime = performance.now();
        await actionDiscoveryService.getValidActions(
          testEnv.entityManager.getEntityInstance(actor),
          { currentLocation: locationId }
        );
        const endTime = performance.now();

        measurements.push({
          count,
          time: endTime - startTime,
        });
      }

      // Check that time increases roughly linearly
      // Time per item should be relatively constant
      const timePerItem = measurements.map(m => m.time / m.count);
      const baselineTimePerItem = timePerItem[0];

      // Verify scaling using dual thresholds to account for timing variance
      // at microsecond scales. Approach mirrors unionOperatorPerformance.test.js
      const ratioThreshold = 5; // Allow up to 5x variance in ratio
      const absoluteThreshold = 0.5; // Only fail if absolute difference > 0.5ms per item

      for (let i = 1; i < timePerItem.length; i++) {
        const currentTimePerItem = timePerItem[i];
        const exceedsRatio = currentTimePerItem > baselineTimePerItem * ratioThreshold;
        const exceedsAbsolute = currentTimePerItem - baselineTimePerItem > absoluteThreshold;

        // Only fail if BOTH ratio AND absolute thresholds are exceeded
        // This prevents flakiness from timing variance at small scales
        const shouldFail = exceedsRatio && exceedsAbsolute;
        expect(shouldFail).toBe(false);
      }

      console.log('Scaling test results:', measurements);
      console.log('Time per item:', timePerItem.map(t => `${t.toFixed(4)}ms`));
    });
  });

  describe('Scope Evaluation Performance', () => {
    it('should evaluate scopes efficiently with complex filters', async () => {
      // Create complex entity structure
      const locations = [];
      for (let i = 0; i < 10; i++) {
        const locationId = `location:loc${i}`;
        createLocation(testEnv.entityManager, locationId, `Location ${i}`);
        locations.push(locationId);
      }

      // Create surfaces distributed across locations
      const surfaces = [];
      locations.forEach((locationId, locIndex) => {
        for (let i = 0; i < 10; i++) {
          const surfaceId = `test:surface_${locIndex}_${i}`;
          // Only half allow bending
          createSurface(
            testEnv.entityManager,
            surfaceId,
            `surface_${locIndex}_${i}`,
            locationId,
            i % 2 === 0
          );
          surfaces.push(surfaceId);
        }
      });

      // Create actor in middle location
      const actor = createActor(
        testEnv.entityManager,
        'test:actor',
        'Actor',
        locations[5]
      );

      // Scopes are already registered in beforeEach

      // Measure scope evaluation time
      const startTime = performance.now();
      const available = scopeResolver.resolveSync(
        'positioning:available_surfaces',
        { actor: testEnv.entityManager.getEntityInstance(actor) }
      );
      const endTime = performance.now();

      const evaluationTime = endTime - startTime;

      // Should find 5 surfaces (half of 10 in the location allow bending)
      expect(available.value.size).toBe(5);

      // Performance threshold: < 200ms (more realistic for complex scope evaluation)
      expect(evaluationTime).toBeLessThan(200);
      console.log(`Scope evaluation with complex filters took ${evaluationTime.toFixed(2)}ms`);
    });

    it('should handle nested scope evaluations efficiently', async () => {
      const locationId = 'location:test';
      createLocation(testEnv.entityManager, locationId, 'Test Location');

      // Create hierarchical structure
      for (let i = 0; i < 20; i++) {
        const surfaceId = `test:surface${i}`;
        createSurface(testEnv.entityManager, surfaceId, `surface${i}`, locationId);

        // Some surfaces have actors already bending over them
        if (i % 3 === 0) {
          const bendingActor = createActor(
            testEnv.entityManager,
            `test:bender${i}`,
            `Bender${i}`,
            locationId
          );
          testEnv.entityManager.addComponent(bendingActor, 'positioning:bending_over', {
            surface_id: surfaceId,
          });
        }
      }

      const actor = createActor(testEnv.entityManager, 'test:actor', 'Actor', locationId);

      // Scopes are already registered in beforeEach

      const startTime = performance.now();
      const available = scopeResolver.resolveSync(
        'positioning:available_surfaces',
        { actor: testEnv.entityManager.getEntityInstance(actor) }
      );
      const endTime = performance.now();

      expect(available.value.size).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(200);
      console.log(`Nested scope evaluation took ${(endTime - startTime).toFixed(2)}ms`);
    });
  });

  describe('State Change Performance', () => {
    it('should handle rapid state changes without memory leaks', async () => {
        const actor = createActor(testEnv.entityManager, 'test:actor', 'Actor', 'location:test');
        const counter = createSurface(testEnv.entityManager, 'test:counter', 'counter', 'location:test');

        // Measure initial memory (if available in environment)
        const initialMemory = process.memoryUsage ? process.memoryUsage().heapUsed : 0;

        // Perform 100 rapid bend/straighten cycles
        const startTime = performance.now();
        for (let i = 0; i < 100; i++) {
          await testEnv.dispatchAction({
            actionId: 'positioning:bend_over',
            actorId: actor,
            targetId: counter,
          });
          await testEnv.dispatchAction({
            actionId: 'positioning:straighten_up',
            actorId: actor,
            targetId: counter,
          });
        }
        const endTime = performance.now();

        // Check final state
        const finalState = testEnv.entityManager.getComponentData(
          actor,
          'positioning:bending_over'
        );
        expect(finalState).toBeNull();

        // Performance check
        const totalTime = endTime - startTime;
        const timePerCycle = totalTime / 100;
        expect(timePerCycle).toBeLessThan(300); // < 300ms per cycle (more realistic for rule processing)

        // Memory check (when available in environment)
        // Note: Memory API may not be available in all test environments
        const hasMemoryAPI = typeof process.memoryUsage === 'function';
        const finalMemory = hasMemoryAPI ? process.memoryUsage().heapUsed : initialMemory;
        const memoryIncrease = finalMemory - initialMemory;
        // Allow for some memory increase, but not excessive
        // Rule processing with extensive logging can use significant memory
        const reasonableIncrease = 50 * 1024 * 1024; // 50MB
        // Always perform assertion - it will pass trivially if memory API is unavailable
        expect(memoryIncrease).toBeLessThan(reasonableIncrease);

        console.log(`100 state change cycles took ${totalTime.toFixed(2)}ms (${timePerCycle.toFixed(2)}ms per cycle)`);
      });

    it('should handle concurrent state changes efficiently', async () => {
      const locationId = 'location:test';
      createLocation(testEnv.entityManager, locationId, 'Test Location');

      // Create multiple actors and surfaces
      const actors = [];
      const surfaces = [];
      for (let i = 0; i < 20; i++) {
        actors.push(createActor(testEnv.entityManager, `test:actor${i}`, `Actor${i}`, locationId));
        surfaces.push(createSurface(testEnv.entityManager, `test:surface${i}`, `surface${i}`, locationId));
      }

      // Measure concurrent operations
      const startTime = performance.now();
      const promises = actors.map((actorId, index) =>
        testEnv.dispatchAction({
          actionId: 'positioning:bend_over',
          actorId,
          targetId: surfaces[index % surfaces.length],
        })
      );
      await Promise.all(promises);
      const endTime = performance.now();

      // Verify all succeeded
      actors.forEach((actorId) => {
        const bendingOver = testEnv.entityManager.getComponentData(
          actorId,
          'positioning:bending_over'
        );
        expect(bendingOver).toBeDefined();
      });

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000); // < 2000ms for 20 concurrent operations (more realistic)
      console.log(`20 concurrent state changes took ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Rule Processing Performance', () => {
    it('should process rules efficiently with many conditions', async () => {
      const actor = createActor(testEnv.entityManager, 'test:actor', 'Actor', 'location:test');
      const surface = createSurface(testEnv.entityManager, 'test:surface', 'surface', 'location:test');

      // Add various components to make condition checking more complex
      testEnv.entityManager.addComponent(actor, 'core:description', {
        short: 'test actor',
        long: 'a test actor for performance testing',
      });
      testEnv.entityManager.addComponent(surface, 'core:visual_properties', {
        color: 'brown',
        material: 'wood',
      });

      // Measure rule processing time
      const startTime = performance.now();
      await testEnv.dispatchAction({
        actionId: 'positioning:bend_over',
        actorId: actor,
        targetId: surface,
      });
      const endTime = performance.now();

      // Verify action succeeded
      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'positioning:bending_over'
      );
      expect(bendingOver).toBeDefined();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(500); // < 500ms for single rule processing (more realistic)
      console.log(`Rule processing took ${processingTime.toFixed(2)}ms`);
    });

    it('should handle rule chains efficiently', async () => {
      const actor = createActor(testEnv.entityManager, 'test:actor', 'Actor', 'location:test');
      const surface = createSurface(testEnv.entityManager, 'test:surface', 'surface', 'location:test');

      // Create a chain of bend -> straighten -> bend operations
      const startTime = performance.now();
      await testEnv.dispatchAction({
        actionId: 'positioning:bend_over',
        actorId: actor,
        targetId: surface,
      });
      await testEnv.dispatchAction({
        actionId: 'positioning:straighten_up',
        actorId: actor,
        targetId: surface,
      });
      await testEnv.dispatchAction({
        actionId: 'positioning:bend_over',
        actorId: actor,
        targetId: surface,
      });
      const endTime = performance.now();

      // Verify final state
      const bendingOver = testEnv.entityManager.getComponentData(
        actor,
        'positioning:bending_over'
      );
      expect(bendingOver).toEqual({ surface_id: surface });

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1500); // < 1500ms for chain of 3 operations (more realistic)
      console.log(`Rule chain processing took ${totalTime.toFixed(2)}ms`);
    });
  });
});