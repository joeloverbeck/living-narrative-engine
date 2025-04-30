// src/tests/integration/sequentialActionExecutionError.integration.test.js
/* eslint-disable max-lines */
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

import EventBus from '../../core/eventBus.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import ModifyComponentHandler from '../../logic/operationHandlers/modifyComponentHandler.js';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from '@jest/globals';

/* ---------- Simple stubs & helpers --------------------------------------- */

class SimpleEntityManager {
    constructor() {
        this.entities = new Map();
    }

    addComponent(id, type, data) {
        if (!this.entities.has(id)) this.entities.set(id, new Map());
        this.entities.get(id).set(type, data);
    }

    getComponentData(id, type) {
        return this.entities.get(id)?.get(type);
    }

    hasComponent(id, type) {
        return this.entities.get(id)?.has(type) ?? false;
    }

    getEntityInstance(id) {
        return {id};
    }
}

class StubDataRegistry {
    constructor(rules) {
        this._rules = rules;
    }

    getAllSystemRules() {
        return this._rules;
    }
}

const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

function buildExecCtx({evaluationContext, entityManager, logger}) {
    return {evaluationContext, entityManager, logger};
}

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

        opRegistry = new OperationRegistry({logger});
        opInterpreter = new OperationInterpreter({logger, operationRegistry: opRegistry});
        jsonLogicSvc = new JsonLogicEvaluationService({logger});

        /* Handler registration */
        // LOG — pure mock
        logHandlerMock = jest.fn();
        opRegistry.register('LOG', logHandlerMock);

        // FAILING_ACTION — throws on first call
        failingHandlerMock = jest
            .fn()
            .mockImplementationOnce(() => {
                throw new Error('Intentional Test Failure');
            });
        opRegistry.register('FAILING_ACTION', failingHandlerMock);

        // MODIFY_COMPONENT — real handler wrapped to spy (should never be hit)
        const realMod = new ModifyComponentHandler({entityManager, logger});
        skippedModifyHandlerMock = jest.fn((p, ctx) =>
            realMod.execute(p, buildExecCtx({evaluationContext: ctx, entityManager, logger}))
        );
        opRegistry.register('MODIFY_COMPONENT', skippedModifyHandlerMock);

        /* Rule under test */
        const testRule = {
            rule_id: 'test-sequential-error',
            event_type: 'Test:ErrorTrigger',
            actions: [
                {type: 'LOG', parameters: {message: 'Action 1: Should Execute'}},
                {type: 'FAILING_ACTION', parameters: {}},          // throws
                {
                    type: 'MODIFY_COMPONENT', parameters: {            // must be skipped
                        entity_ref: 'actor',
                        component_type: 'noop',
                        mode: 'set',
                        value: {}
                    }
                },
            ],
        };
        const dataRegistry = new StubDataRegistry([testRule]);

        /* Interpreter */
        sysInterpreter = new SystemLogicInterpreter({
            logger,
            eventBus,
            dataRegistry,
            jsonLogicEvaluationService: jsonLogicSvc,
            entityManager,
            operationInterpreter: opInterpreter,
        });
        sysInterpreter.initialize();
    });

    afterEach(() => jest.resetAllMocks());

    it('halts the sequence after a handler throws and logs the error', async () => {
        await eventBus.dispatch('Test:ErrorTrigger', {actorId: 'actor-1'});

        /* ✔️ Action 1 executed */
        expect(logHandlerMock).toHaveBeenCalledTimes(1);
        expect(logHandlerMock).toHaveBeenCalledWith(
            expect.objectContaining({message: 'Action 1: Should Execute'}),
            expect.any(Object),
        );

        /* ✔️ Action 2 executed & threw */
        expect(failingHandlerMock).toHaveBeenCalledTimes(1);

        /* ✔️ Error logged with contextual message + error object */
        expect(logger.error).toHaveBeenCalledTimes(2);

        // --- FIX: Update the expected string to include the 'Rule' context ---
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining("[Rule 'test-sequential-error' - Action 2/3] CRITICAL error during execution of Operation FAILING_ACTION"), // Adjusted expectation
            expect.objectContaining({message: 'Intentional Test Failure'}),
        );
        // --- END FIX ---

        /* ✔️ Action 3 never executed */
        expect(skippedModifyHandlerMock).not.toHaveBeenCalled();
    });
});