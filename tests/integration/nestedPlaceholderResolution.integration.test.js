/**
 * @file Regression test – verifies that placeholders inside THEN/ELSE/ACTIONS
 * arrays are resolved *after* earlier steps mutate `context`.
 *
 * Scenario mirrors the `{context.nowIso}` warning that appeared in Dismiss.
 * @see tests/integration/nestedPlaceholderResolution.integration.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';

const TEST_TIMESTAMP = '2099-01-01T00:00:00.000Z';

/* ---------- Simple stubs ---------- */
class SimpleEventBus {
  constructor() {
    this.listeners = [];
  }

  subscribe(ev, fn) {
    this.listeners.push(fn);
  }

  dispatch(type, payload) {
    this.listeners.forEach((l) => l({ type, payload }));
    return Promise.resolve();
  }
}

class SimpleEntityManager {
  getComponentData() {
    return { locationId: 'loc-1' };
  }

  getEntityInstance(id) {
    return { id, components: {} };
  }

  hasComponent() {
    /* This regression test doesn’t care about component presence,
   it just needs the API to exist and return a boolean. */
    return false;
  }
}

/* ---------------------------------- */

describe('nested placeholder resolution', () => {
  let logger, events, eventBus, opRegistry, opInterpreter, interpreter;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    events = [];
    eventBus = new SimpleEventBus();

    opRegistry = new OperationRegistry({ logger });
    opInterpreter = new OperationInterpreter({
      logger,
      operationRegistry: opRegistry,
    });

    // -- handlers -----------------------------------------------------------
    opRegistry.register('GET_TIMESTAMP', (p, ctx) => {
      ctx.evaluationContext.context[p.result_variable] = TEST_TIMESTAMP;
    });
    opRegistry.register('DISPATCH_EVENT', (p) => {
      events.push(p);
    });
    opRegistry.register('IF_CO_LOCATED', (p, ctx) => {
      p.then_actions.forEach((a) => opInterpreter.execute(a, ctx));
    });

    const rule = {
      rule_id: 'regression-nowIso',
      event_type: 'TEST_EVENT',
      actions: [
        {
          type: 'IF_CO_LOCATED',
          parameters: {
            entity_ref_a: 'actor',
            entity_ref_b: 'actor',
            then_actions: [
              {
                type: 'GET_TIMESTAMP',
                parameters: { result_variable: 'nowIso' },
              },
              {
                type: 'DISPATCH_EVENT',
                parameters: {
                  eventType: 'emitted',
                  payload: { ts: '{context.nowIso}' }, // <-- must resolve *after* GET_TIMESTAMP
                },
              },
            ],
          },
        },
      ],
    };

    const dataRegistry = { getAllSystemRules: () => [rule] };

    interpreter = new SystemLogicInterpreter({
      logger,
      eventBus,
      dataRegistry,
      jsonLogicEvaluationService: new JsonLogicEvaluationService({ logger }),
      entityManager: new SimpleEntityManager(),
      operationInterpreter: opInterpreter,
    });
    interpreter.initialize();
  });

  it('fills {context.nowIso} after GET_TIMESTAMP sets it', async () => {
    await eventBus.dispatch('TEST_EVENT', { actorId: 'a-1', targetId: 'a-1' });

    expect(events).toHaveLength(1);
    expect(events[0].payload.ts).toBe(TEST_TIMESTAMP);

    // No “could not be resolved” warnings
    const warnMsgs = logger.warn.mock.calls.map((c) => c[0]).join('\n');
    expect(warnMsgs).not.toMatch(/could not be resolved/);
  });
});
