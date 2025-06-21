// src/tests/integration/sequentialActionExecution.integration.test.js
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-param-description */
/* eslint-disable jsdoc/require-param-type */

/**
 * Integration Test — Sub‑Ticket 3 (TICKET‑12.3)
 * ------------------------------------------------------------
 * Validates that a SystemRule containing multiple actions is
 * executed sequentially *in order* and that every action’s
 * side‑effects take place.
 *
 *  • Action 1 – MODIFY_COMPONENT
 *  • Action 2 – LOG
 *  • Action 3 – DISPATCH_EVENT
 *
 * Acceptance criteria:
 *  ✓ Each handler is invoked exactly once.
 *  ✓ Handlers are invoked in the declared order.
 *  ✓ EntityManager reflects the component mutation.
 *  ✓ Log handler receives expected parameters.
 *  ✓ EventBus dispatches the completion event.
 *
 * NOTE:  Import paths assume the test file lives in
 *        src/tests/integration/ relative to /src/.  Adjust if
 *        your project structure differs.
 */

import EventBus from '../../src/events/eventBus.js';
import OperationRegistry from '../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../src/logic/operationInterpreter.js';
import JsonLogicEvaluationService from '../../src/logic/jsonLogicEvaluationService.js';
import SystemLogicInterpreter from '../../src/logic/systemLogicInterpreter.js';
import ModifyComponentHandler from '../../src/logic/operationHandlers/modifyComponentHandler.js';
import {
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../common/mockFactories.js';
import { buildExecContext } from '../common/entities/index.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

/** ---------- Simple stubs & helpers ------------------------------------------------ */

/**
 * Bare‑bones in‑memory EntityManager satisfying the subset of the public API
 * required by ModifyComponentHandler *and* SystemLogicInterpreter’s
 * context‑assembly helpers.
 */
class SimpleEntityManager {
  constructor() {
    /** @type {Map<string, Map<string, any>>} */
    this.entities = new Map();
  }

  addComponent(entityId, componentType, data) {
    if (!this.entities.has(entityId)) this.entities.set(entityId, new Map());
    this.entities.get(entityId).set(componentType, data);
  }

  getComponentData(entityId, componentType) {
    return this.entities.get(entityId)?.get(componentType);
  }

  hasComponent(entityId, componentType) {
    return this.entities.get(entityId)?.has(componentType) ?? false;
  }

  /**
   * Minimal stub for contextAssembler’s getEntityInstance()
   *
   * @param entityId
   */
  getEntityInstance(entityId) {
    return { id: entityId };
  }
}
/** Jest‑friendly logger stub capturing calls for optional debugging. */

describe('Sequential Action Execution – Success Path', () => {
  /** @type {*} */
  let logger;
  /** @type {EventBus} */
  let eventBus;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {OperationRegistry} */
  let opRegistry;
  /** @type {OperationInterpreter} */
  let opInterpreter;
  /** @type {JsonLogicEvaluationService} */
  let jsonLogicSvc;
  /** @type {SystemLogicInterpreter} */
  let sysInterpreter;

  /** Handler spies we need to assert on */
  let modifyHandlerSpy;
  let logHandlerMock;
  let dispatchHandlerMock;
  let dispatchSpy; // spy on EventBus.dispatch for side‑effect assertion

  beforeEach(() => {
    // ─── Core plumbing ────────────────────────────────────────────────
    logger = createMockLogger();
    eventBus = new EventBus();
    entityManager = new SimpleEntityManager();

    opRegistry = new OperationRegistry({ logger });
    opInterpreter = new OperationInterpreter({
      logger,
      operationRegistry: opRegistry,
    });
    jsonLogicSvc = new JsonLogicEvaluationService({ logger });

    // ─── Handler registration ─────────────────────────────────────────
    // 1. MODIFY_COMPONENT – wrap the real handler so we can spy on invocation.
    const realModifyHandler = new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: { dispatch: jest.fn().mockResolvedValue(true) },
    });

    modifyHandlerSpy = jest.fn((params, rawEvalCtx) => {
      const execCtx = buildExecContext({
        evaluationContext: rawEvalCtx,
        entityManager,
        logger,
      });
      realModifyHandler.execute(params, execCtx);
    });
    opRegistry.register('MODIFY_COMPONENT', modifyHandlerSpy);

    // 2. LOG – pure mock so we can inspect parameters.
    logHandlerMock = jest.fn();
    opRegistry.register('LOG', logHandlerMock);

    // 3. DISPATCH_EVENT – calls through to EventBus.dispatch (which we also spy on)
    dispatchHandlerMock = jest.fn((params) =>
      eventBus.dispatch(params.eventType, params.payload)
    );
    opRegistry.register('DISPATCH_EVENT', dispatchHandlerMock);
    dispatchSpy = jest.spyOn(eventBus, 'dispatch');

    // ─── Rule setup ───────────────────────────────────────────────────
    const testRule = {
      rule_id: 'test-sequential-success',
      event_type: 'Test:SequenceTrigger',
      actions: [
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            entity_ref: 'actor',
            component_type: 'testState',
            field: 'step1_complete',
            mode: 'set',
            value: true,
          },
        },
        {
          type: 'LOG',
          parameters: {
            level: 'info',
            message: 'Step 2 Logged',
          },
        },
        {
          type: 'DISPATCH_EVENT',
          parameters: {
            eventType: 'Test:SequenceComplete',
            payload: { actorId: '{actor.id}' },
          },
        },
      ],
    };
    const rules = [testRule];
    const dataRegistry = createSimpleMockDataRegistry();
    dataRegistry.getAllSystemRules = jest.fn();
    dataRegistry.getAllSystemRules.mockReturnValue(rules);

    sysInterpreter = new SystemLogicInterpreter({
      logger,
      eventBus,
      dataRegistry,
      jsonLogicEvaluationService: jsonLogicSvc,
      entityManager,
      operationInterpreter: opInterpreter,
    });
    sysInterpreter.initialize();

    // ─── World state ──────────────────────────────────────────────────
    entityManager.addComponent('test-actor-id', 'testState', {
      step1_complete: false,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('executes all actions in order and applies each side‑effect', async () => {
    // ─ Act ─
    await eventBus.dispatch('Test:SequenceTrigger', {
      actorId: 'test-actor-id',
    });

    // ─ Assert – side‑effects ─────────────────────────────────────────
    expect(
      entityManager.getComponentData('test-actor-id', 'testState')
        .step1_complete
    ).toBe(true);

    expect(logHandlerMock).toHaveBeenCalledTimes(1);
    const [logParams] = logHandlerMock.mock.calls[0];
    expect(logParams).toEqual(
      expect.objectContaining({ level: 'info', message: 'Step 2 Logged' })
    );

    expect(dispatchSpy).toHaveBeenCalledWith('Test:SequenceComplete', {
      actorId: 'test-actor-id',
    });

    // ─ Assert – invocation order ─────────────────────────────────────
    const modifyOrder = modifyHandlerSpy.mock.invocationCallOrder[0];
    const logOrder = logHandlerMock.mock.invocationCallOrder[0];
    const dispatchOrder = dispatchHandlerMock.mock.invocationCallOrder[0];

    expect(modifyOrder).toBeLessThan(logOrder);
    expect(logOrder).toBeLessThan(dispatchOrder);
  });
});
