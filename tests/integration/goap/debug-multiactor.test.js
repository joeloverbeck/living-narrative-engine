import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createGoapTestSetup } from './testFixtures/goapTestSetup.js';
import { createTestGoal } from './testFixtures/testGoalFactory.js';
import { createTestTask } from './testFixtures/testTaskFactory.js';

describe('Debug multiActor', () => {
  let setup;

  beforeEach(async () => {
    setup = await createGoapTestSetup({
      mockRefinement: true,
    });
  });

  afterEach(() => {
    if (setup?.testBed) {
      setup.testBed.cleanup();
    }
  });

  it('should verify basic setup works', async () => {
    console.log('[DEBUG] Test starting');

    const goal = createTestGoal({
      id: 'test:simple',
      relevance: { '==': [true, true] },
      goalState: { has_component: ['actor', 'test:done'] },
    });

    console.log('[DEBUG] Goal created:', goal);
    setup.dataRegistry.register('goals', goal.id, goal);

    const goals = setup.dataRegistry.getAll('goals');
    console.log('[DEBUG] Goals registered:', goals.length);

    const actor = { id: 'test_actor', components: {} };
    setup.entityManager.addEntity(actor);

    console.log('[DEBUG] Actor added');

    const task = createTestTask({
      id: 'test:simple_task',
      cost: 10,
      planningEffects: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entityId: 'actor',
            componentId: 'test:done',
            componentData: {},
          },
        },
      ],
      effects: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entityId: 'actor',
            componentId: 'test:done',
            componentData: {},
          },
        },
      ],
    });

    console.log('[DEBUG] Task created:', task.id);
    console.log('[DEBUG] Task full object:', JSON.stringify(task, null, 2));

    let getCallCount = 0;
    setup.gameDataRepository.get = jest.fn((key) => {
      getCallCount++;
      console.log(
        `[DEBUG] gameDataRepository.get call #${getCallCount} with key:`,
        key
      );
      if (key === 'tasks') {
        const result = {
          test: {
            'test:simple_task': task, // Use full ID as key (with namespace)
          },
        };
        console.log('[DEBUG] Returning tasks object structure:', {
          modIds: Object.keys(result),
          testModTaskIds: Object.keys(result.test),
        });
        console.log(
          '[DEBUG] First task object:',
          result.test['test:simple_task']
        );
        return result;
      }
      console.log('[DEBUG] Returning null for key:', key);
      return null;
    });

    setup.gameDataRepository.getTask = jest.fn((taskId) => {
      console.log(
        '[DEBUG] gameDataRepository.getTask called with taskId:',
        taskId
      );
      return taskId === task.id ? task : null;
    });

    const world = { state: {}, entities: {} };

    // Spy on planner logger to see what's being logged
    const plannerLogger =
      setup.planner['#logger'] ||
      setup.planner._logger ||
      setup.controller['#planner']?.['#logger'];
    if (!plannerLogger) {
      // Try to access through private field reflection
      const plannerInstance = setup.controller['#planner'] || setup.planner;
      const loggerSpy = jest.fn((msg, ...args) =>
        console.log('[PLANNER LOG]', msg, ...args)
      );
      const originalInfo = setup.testBed.createMockLogger().info;
      const originalWarn = setup.testBed.createMockLogger().warn;
      const originalError = setup.testBed.createMockLogger().error;

      // Spy on actual logger methods
      jest.spyOn(console, 'log');
      jest.spyOn(console, 'warn');
      jest.spyOn(console, 'error');
    }

    console.log('[DEBUG] About to call decideTurn');
    console.log('[DEBUG] Actor before decideTurn:', JSON.stringify(actor));
    console.log(
      '[DEBUG] hasEntity check:',
      setup.entityManager.hasEntity(actor.id)
    );
    console.log(
      '[DEBUG] getEntityInstance:',
      setup.entityManager.getEntityInstance(actor.id)
    );

    // Try calling planner directly to bypass controller
    const registeredGoal = setup.dataRegistry.getAll('goals')[0];
    console.log('[DEBUG] Calling planner.plan directly...');
    const directPlanResult = setup.planner.plan(
      actor.id,
      registeredGoal,
      {},
      {}
    );
    console.log('[DEBUG] Direct plan result:', directPlanResult);

    const result = await setup.controller.decideTurn(actor, world);
    console.log('[DEBUG] decideTurn result:', result);

    // Check what was logged
    if (console.log.mock) {
      console.log(
        '[DEBUG] Logger calls:',
        console.log.mock.calls.filter(
          (c) =>
            c[0]?.includes?.('Task library') ||
            c[0]?.includes?.('Actor not found')
        )
      );
    }

    const events = setup.eventBus.getEvents();
    console.log('[DEBUG] Events dispatched:', events.length);
    events.forEach((e) => console.log('[DEBUG] Event:', e.type));

    // Check repository calls
    console.log(
      '[DEBUG] Repository.get call count:',
      setup.gameDataRepository.get.mock.calls.length
    );
    console.log(
      '[DEBUG] Repository.get calls:',
      setup.gameDataRepository.get.mock.calls
    );

    expect(events.length).toBeGreaterThan(0);
  });
});
