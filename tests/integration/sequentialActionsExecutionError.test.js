// src/tests/integration/sequentialActionsExecutionError.test.js

/**
 * Integration Test — Sub-Ticket 4 (TICKET-12.4)
 * ------------------------------------------------------------
 * Verifies that an action sequence halts when a handler throws:
 *
 *  • Action 1 – LOG  (executes OK)
 *  • Action 2 – FAILING_ACTION (throws)
 *  • Action 3 – MODIFY_COMPONENT (MUST be skipped)
 *
 * Acceptance criteria:
 *  ✓ LOG handler called exactly once with expected params.
 *  ✓ FAILING_ACTION handler called exactly once and throws.
 *  ✓ logger.error records the halting message + error object.
 *  ✓ MODIFY_COMPONENT handler is never invoked.
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
import { SimpleEntityManager } from '../common/entities/index.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

/* ------------------------ The Test --------------------------------------- */

describe('Sequential Action Execution – Error Path', () => {
  let logger;
  let eventBus;
  let entityManager;
  let opRegistry;
  let opInterpreter;
  let jsonLogicSvc;
  let sysInterpreter;

  let logHandlerMock;
  let failingHandlerMock;
  let skippedModifyHandlerMock;

  beforeEach(() => {
    /* Core plumbing */
    logger = createMockLogger();
    eventBus = new EventBus();
    entityManager = new SimpleEntityManager();

    opRegistry = new OperationRegistry({ logger });
    opInterpreter = new OperationInterpreter({
      logger,
      operationRegistry: opRegistry,
    });
    jsonLogicSvc = new JsonLogicEvaluationService({ logger });

    /* Handler registration */
    // LOG — pure mock
    logHandlerMock = jest.fn();
    opRegistry.register('LOG', logHandlerMock);

    // FAILING_ACTION — throws on first call
    failingHandlerMock = jest.fn().mockImplementationOnce(() => {
      throw new Error('Intentional Test Failure');
    });
    opRegistry.register('FAILING_ACTION', failingHandlerMock);

    // MODIFY_COMPONENT — real handler wrapped to spy (should never be hit)
    const realMod = new ModifyComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: { dispatch: jest.fn().mockResolvedValue(true) },
    });
    skippedModifyHandlerMock = jest.fn((p, ctx) =>
      realMod.execute(
        p,
        buildExecContext({ evaluationContext: ctx, entityManager, logger })
      )
    );
    opRegistry.register('MODIFY_COMPONENT', skippedModifyHandlerMock);

    /* Rule under test */
    const testRule = {
      rule_id: 'test-sequential-error',
      event_type: 'Test:ErrorTrigger',
      actions: [
        { type: 'LOG', parameters: { message: 'Action 1: Should Execute' } },
        { type: 'FAILING_ACTION', parameters: {} }, // throws
        {
          type: 'MODIFY_COMPONENT',
          parameters: {
            // must be skipped
            entity_ref: 'actor',
            component_type: 'noop',
            mode: 'set',
            value: {},
          },
        },
      ],
    };
    const rules = [testRule];
    const dataRegistry = createSimpleMockDataRegistry();
    dataRegistry.getAllSystemRules = jest.fn();
    dataRegistry.getAllSystemRules.mockReturnValue(rules);

    /* Mock bodyGraphService */
    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn().mockReturnValue({ found: false })
    };

    /* Interpreter */
    sysInterpreter = new SystemLogicInterpreter({
      logger,
      eventBus,
      dataRegistry,
      jsonLogicEvaluationService: jsonLogicSvc,
      entityManager,
      operationInterpreter: opInterpreter,
      bodyGraphService: mockBodyGraphService,
    });
    sysInterpreter.initialize();
  });

  afterEach(() => jest.resetAllMocks());

  it('halts the sequence after a handler throws and logs the error', async () => {
    await eventBus.dispatch('Test:ErrorTrigger', { actorId: 'actor-1' });

    /* ✔️ Action 1 executed */
    expect(logHandlerMock).toHaveBeenCalledTimes(1);
    expect(logHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Action 1: Should Execute' }),
      expect.any(Object)
    );

    /* ✔️ Action 2 executed & threw */
    expect(failingHandlerMock).toHaveBeenCalledTimes(1);

    /* ✔️ Errors logged with contextual message and propagated */
    expect(logger.error).toHaveBeenCalledTimes(3);

    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        "[Rule 'test-sequential-error' - Action 2/3] CRITICAL error during execution of Operation FAILING_ACTION"
      ),
      expect.objectContaining({ message: 'Intentional Test Failure' })
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        '[Rule test-sequential-error] Error during action sequence:'
      ),
      expect.objectContaining({ message: 'Intentional Test Failure' })
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("rule 'test-sequential-error' threw:"),
      expect.objectContaining({ message: 'Intentional Test Failure' })
    );

    /* ✔️ Action 3 never executed */
    expect(skippedModifyHandlerMock).not.toHaveBeenCalled();
  });
});
