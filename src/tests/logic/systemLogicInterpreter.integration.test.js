// src/tests/logic/systemLogicInterpreter.integration.test.js

// -----------------------------------------------------------------------------
// Jest imports
import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';

// System Under Test
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';

// -----------------------------------------------------------------------------
// *** Core Mock Rule Definitions ***
// -----------------------------------------------------------------------------

// A rule with no condition – should always attempt to execute its (empty) actions.
const rule_no_condition = {
    rule_id: 'RULE_NO_CONDITION',
    event_type: 'test:event_no_condition',
    // Empty actions array satisfies schema but triggers no real work.
    actions: [],
};

// A rule whose condition will be **true** for the mock event below
const rule_cond_true_basic = {
    rule_id: 'RULE_COND_TRUE_BASIC',
    event_type: 'test:event_condition_true',
    condition: {
        '==': [{var: 'event.payload.value'}, true],
    },
    actions: [],
};

// A rule whose condition will be **false** for the matching mock event
const rule_cond_false_basic = {
    rule_id: 'RULE_COND_FALSE_BASIC',
    event_type: 'test:event_condition_false',
    condition: {
        '==': [{var: 'event.payload.value'}, false],
    },
    actions: [],
};

// A rule whose condition depends on actor component data (health == 10)
const rule_cond_actor = {
    rule_id: 'RULE_COND_ACTOR',
    event_type: 'test:event_actor',
    condition: {
        '==': [{var: 'actor.components.core:health.current'}, 10],
    },
    actions: [],
};

// --- START: TICKET-10.5 Definition ---
// Rule whose condition depends on target component data (lockable.isLocked)
const rule_cond_target = {
    rule_id: 'RULE_COND_TARGET',
    event_type: 'test:event_target',
    condition: {var: 'target.components.game:lockable.isLocked'},
    actions: [],
};
// --- END: TICKET-10.5 Definition ---

// --- START: TICKET-10.6 Definition ---
// Rule whose condition accesses event payload data directly
const rule_cond_payload = {
    rule_id: 'RULE_COND_PAYLOAD',
    event_type: 'test:event_payload',
    condition: {">": [{"var": "event.payload.amount"}, 10]},
    actions: [], // Empty actions are fine for checking if execution happens
};
// --- END: TICKET-10.6 Definition ---


// -----------------------------------------------------------------------------
// *** Core Mock Event Definitions ***
// -----------------------------------------------------------------------------
const event_no_condition = {
    type: 'test:event_no_condition',
    payload: {},
};

const event_cond_true = {
    type: 'test:event_condition_true',
    payload: {
        value: true,
        actorId: 'mockActor1',
        targetId: 'mockTarget1',
    },
};

const event_cond_false = {
    type: 'test:event_condition_false',
    payload: {
        value: true, // intentionally mismatches
        actorId: 'mockActor1',
        targetId: 'mockTarget1',
    },
};

const event_actor = {
    type: 'test:event_actor',
    payload: {
        actorId: 'player',
    },
};

// --- START: TICKET-10.5 Definition ---
const event_target = {
    type: 'test:event_target',
    payload: {
        targetId: 'door1',
        actorId: 'player',
    },
};
// --- END: TICKET-10.5 Definition ---

// --- START: TICKET-10.6 Definition ---
const event_payload_pass = {
    type: 'test:event_payload',
    payload: {amount: 15}, // amount > 10 -> condition TRUE
};

const event_payload_fail = {
    type: 'test:event_payload',
    payload: {amount: 5}, // amount <= 10 -> condition FALSE
};
// --- END: TICKET-10.6 Definition ---


// -----------------------------------------------------------------------------
// *** Test Suite – Core Mock Setup (TICKET-10.2) ***
// -----------------------------------------------------------------------------
describe('SystemLogicInterpreter – Integration Tests', () => {
    /** @type {SystemLogicInterpreter} */
    let sut;

    /** @type {jest.Mocked<import('../../core/interfaces/coreServices.js').ILogger>} */
    let mockLogger;
    /** @type {jest.Mocked<import('../../core/eventBus.js').default>} */
    let mockEventBus;
    /** @type {jest.Mocked<import('../../core/interfaces/coreServices.js').IDataRegistry>} */
    let mockDataRegistry;
    /** @type {jest.Mocked<import('../../logic/jsonLogicEvaluationService.js').default>} */
    let mockJsonLogicService;
    /** @type {jest.Mocked<import('../../entities/entityManager.js').default>} */
    let mockEntityManager;

    /** @type {jest.SpyInstance<any, any[], any>} */
    let executeActionsSpy;

    // Helper to get the subscribed handler function
    const getSubscribedHandler = () => {
        expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
        const [eventPattern, handler] = mockEventBus.subscribe.mock.calls[0];
        expect(eventPattern).toBe('*');
        expect(typeof handler).toBe('function');
        return handler;
    };

    beforeEach(() => {
        // ILogger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // EventBus
        mockEventBus = {
            subscribe: jest.fn(),
            dispatch: jest.fn(),
            unsubscribe: jest.fn(),
            listenerCount: jest.fn(() => 0),
        };

        // IDataRegistry
        mockDataRegistry = {
            getAllSystemRules: jest
                .fn()
                .mockReturnValue([
                    rule_no_condition,
                    rule_cond_true_basic,
                    rule_cond_false_basic,
                    rule_cond_actor,
                    rule_cond_target,
                    // --- START: TICKET-10.6 Add Rule ---
                    rule_cond_payload,
                    // --- END: TICKET-10.6 Add Rule ---
                ]),
            store: jest.fn(),
            get: jest.fn(),
            getAll: jest.fn(),
            clear: jest.fn(),
            getManifest: jest.fn(),
            setManifest: jest.fn(),
        };

        // JsonLogicEvaluationService
        mockJsonLogicService = {
            evaluate: jest.fn(),
        };

        // EntityManager
        mockEntityManager = {
            getEntityInstance: jest.fn(),
            getComponentData: jest.fn(),
            createEntityInstance: jest.fn(),
            destroyEntityInstance: jest.fn(),
            getEntityComponentData: jest.fn(),
            getAllEntityInstances: jest.fn(),
            hasComponent: jest.fn(),
        };

        // Instantiate SUT
        sut = new SystemLogicInterpreter({
            logger: mockLogger,
            eventBus: mockEventBus,
            dataRegistry: mockDataRegistry,
            jsonLogicEvaluationService: mockJsonLogicService,
            entityManager: mockEntityManager,
        });

        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('SystemLogicInterpreter initialized')
        );

        // Spy on the *public* proxy method but keep its side-effects
        const proto = SystemLogicInterpreter.prototype;
        const realExecuteActions = proto._executeActions;
        executeActionsSpy = jest
            .spyOn(proto, '_executeActions')
            .mockImplementation(function (...args) {
                // forward to the real implementation so debug logs still happen
                return realExecuteActions.apply(this, args);
            });
        // Initialize
        expect(() => sut.initialize()).not.toThrow();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Initialization & Core Setup', () => {
        it('initialise() should cache rules & subscribe without errors', () => {
            expect(mockDataRegistry.getAllSystemRules).toHaveBeenCalledTimes(1);
            expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
            expect(mockEventBus.subscribe).toHaveBeenCalledWith('*', expect.any(Function));
        });

        it('should have a working spy on _executeActions (no calls yet initially)', () => {
            expect(executeActionsSpy).toBeDefined();
            expect(executeActionsSpy).not.toHaveBeenCalled();
        });
    });

    describe('Basic Rule Condition Evaluation (TICKET-10.3)', () => {
        beforeEach(() => {
            executeActionsSpy.mockClear();
            mockJsonLogicService.evaluate.mockClear();
            mockLogger.debug.mockClear();
        });

        it('executes actions when rule has no condition', () => {
            const handler = getSubscribedHandler();
            handler(event_no_condition);

            expect(mockJsonLogicService.evaluate).not.toHaveBeenCalled();
            expect(executeActionsSpy).toHaveBeenCalledTimes(1);
            expect(executeActionsSpy).toHaveBeenCalledWith(
                rule_no_condition.actions,
                expect.any(Object),
                expect.stringContaining(`Rule '${rule_no_condition.rule_id}'`)
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`No actions to execute for scope: Rule '${rule_no_condition.rule_id}'`)
            );
        });

        it('executes actions when rule condition evaluates to true', () => {
            mockJsonLogicService.evaluate.mockReturnValue(true);
            const handler = getSubscribedHandler();
            handler(event_cond_true);

            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_true_basic.condition,
                expect.objectContaining({ // Be more specific about context if needed
                    event: expect.objectContaining({type: event_cond_true.type}),
                    actor: expect.any(Object), // Assuming actorId resolution happens
                    target: expect.any(Object) // Assuming targetId resolution happens
                })
            );
            expect(executeActionsSpy).toHaveBeenCalledTimes(1);
            expect(executeActionsSpy).toHaveBeenCalledWith(
                rule_cond_true_basic.actions,
                expect.any(Object),
                expect.stringContaining(`Rule '${rule_cond_true_basic.rule_id}'`)
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`No actions to execute for scope: Rule '${rule_cond_true_basic.rule_id}'`)
            );
        });

        it('does NOT execute actions when rule condition evaluates to false', () => {
            mockJsonLogicService.evaluate.mockReturnValue(false);
            const handler = getSubscribedHandler();
            handler(event_cond_false);

            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_false_basic.condition,
                expect.objectContaining({event: expect.objectContaining({type: event_cond_false.type})})
            );
            expect(executeActionsSpy).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Root condition for rule '${rule_cond_false_basic.rule_id}' failed. Skipping actions.`
                )
            );
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('No actions to execute for scope:')
            );
        });
    });

    describe('Actor component condition behaviour (TICKET-10.4)', () => {
        beforeEach(() => {
            executeActionsSpy.mockClear();
            mockJsonLogicService.evaluate.mockClear();
            mockLogger.debug.mockClear();
            mockEntityManager.getEntityInstance.mockClear();
            mockEntityManager.getComponentData.mockClear();
        });

        it('executes actions when actor component condition is true', async () => { // Mark async if handler is async
            const mockActorEntity = {
                id: 'player',
                getComponentData: jest.fn((compId) =>
                    compId === 'core:health' ? {current: 10} : null
                ),
            };
            mockEntityManager.getEntityInstance.mockImplementation(
                (id) => (id === 'player' ? mockActorEntity : null)
            );
            // Simulate component data fetching if createJsonLogicContext relies on it before evaluation
            mockEntityManager.getComponentData.mockImplementation((id, compId) =>
                id === 'player' && compId === 'core:health' ? {current: 10} : null
            );
            mockJsonLogicService.evaluate.mockReturnValue(true); // Assume condition is met

            const handler = getSubscribedHandler();
            await handler(event_actor); // await if handler is async

            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_actor.condition,
                expect.objectContaining({
                    actor: expect.objectContaining({id: 'player', components: expect.any(Object)}), // Check proxy exists
                    event: event_actor,
                })
            );
            expect(executeActionsSpy).toHaveBeenCalledTimes(1);
            expect(executeActionsSpy).toHaveBeenCalledWith(
                rule_cond_actor.actions,
                expect.any(Object), // The evaluationContext
                expect.stringContaining(`Rule '${rule_cond_actor.rule_id}'`)
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`No actions to execute for scope: Rule '${rule_cond_actor.rule_id}'`)
            );
        });

        it('skips actions when actor component condition is false', async () => { // Mark async
            const mockActorEntity = { // Actor exists...
                id: 'player',
                getComponentData: jest.fn((compId) =>
                    compId === 'core:health' ? {current: 5} : null // ...but data mismatch
                ),
            };
            mockEntityManager.getEntityInstance.mockImplementation(
                (id) => (id === 'player' ? mockActorEntity : null)
            );
            mockEntityManager.getComponentData.mockImplementation((id, compId) =>
                id === 'player' && compId === 'core:health' ? {current: 5} : null
            );
            mockJsonLogicService.evaluate.mockReturnValue(false); // Condition fails

            const handler = getSubscribedHandler();
            await handler(event_actor); // await

            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_actor.condition,
                expect.objectContaining({
                    actor: expect.objectContaining({id: 'player', components: expect.any(Object)}),
                    event: event_actor,
                })
            );
            expect(executeActionsSpy).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Root condition for rule '${rule_cond_actor.rule_id}' failed. Skipping actions.`
                )
            );
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('No actions to execute for scope:')
            );
        });
    });

    describe('Target component condition behaviour (TICKET-10.5)', () => {
        beforeEach(() => {
            executeActionsSpy.mockClear();
            mockJsonLogicService.evaluate.mockClear();
            mockLogger.debug.mockClear();
            mockEntityManager.getEntityInstance.mockClear();
            mockEntityManager.getComponentData.mockClear();
        });

        it('executes actions when target component condition is true', async () => {
            const targetEntityId = 'door1';
            const targetComponentId = 'game:lockable';
            const targetComponentData = {isLocked: true};

            // ---- actor stub so evaluationContext.actor is populated ----
            const mockActorEntity = {
                id: 'player',
                getComponentData: jest.fn(() => null), // no components needed for this assertion
            };

            const mockTargetEntity = {
                id: targetEntityId,
                getComponentData: jest.fn((compId) =>
                    compId === targetComponentId ? targetComponentData : null
                ),
            };

            mockEntityManager.getEntityInstance.mockImplementation((id) =>
                id === targetEntityId
                    ? mockTargetEntity
                    : id === 'player'
                        ? mockActorEntity
                        : null
            );
            // Simulate component data fetching needed by context assembly
            mockEntityManager.getComponentData.mockImplementation((id, compId) =>
                id === targetEntityId && compId === targetComponentId
                    ? targetComponentData
                    : null
            );

            mockJsonLogicService.evaluate.mockReturnValue(true); // Assume condition passes

            const handler = getSubscribedHandler();
            await handler(event_target);

            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_target.condition,
                expect.objectContaining({
                    target: expect.objectContaining({id: targetEntityId, components: expect.any(Object)}),
                    actor: expect.objectContaining({id: 'player'}),
                    event: event_target,
                })
            );
            expect(executeActionsSpy).toHaveBeenCalledTimes(1);
            expect(executeActionsSpy).toHaveBeenCalledWith(
                rule_cond_target.actions,
                expect.any(Object),
                expect.stringContaining(`Rule '${rule_cond_target.rule_id}'`)
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`No actions to execute for scope: Rule '${rule_cond_target.rule_id}'`)
            );
        });

        it('skips actions when target component condition is false', async () => {
            const targetEntityId = 'door1';
            const targetComponentId = 'game:lockable';
            const targetComponentData = {isLocked: false}; // Condition source is false

            // ---- actor stub ----
            const mockActorEntity = {id: 'player', getComponentData: jest.fn(() => null)};

            const mockTargetEntity = {
                id: targetEntityId,
                getComponentData: jest.fn((compId) =>
                    compId === targetComponentId ? targetComponentData : null
                ),
            };

            mockEntityManager.getEntityInstance.mockImplementation((id) =>
                id === targetEntityId
                    ? mockTargetEntity
                    : id === 'player'
                        ? mockActorEntity
                        : null
            );
            mockEntityManager.getComponentData.mockImplementation((id, compId) =>
                id === targetEntityId && compId === targetComponentId
                    ? targetComponentData
                    : null
            );

            mockJsonLogicService.evaluate.mockReturnValue(false); // Condition fails

            const handler = getSubscribedHandler();
            await handler(event_target);

            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_target.condition,
                expect.objectContaining({
                    target: expect.objectContaining({id: targetEntityId, components: expect.any(Object)}),
                    actor: expect.objectContaining({id: 'player'}),
                    event: event_target,
                })
            );
            expect(executeActionsSpy).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Root condition for rule '${rule_cond_target.rule_id}' failed. Skipping actions.`
                )
            );
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('No actions to execute for scope:')
            );
        });
    });

    // --- START: TICKET-10.6 Test Suite ---
    describe('Event Payload Condition Behaviour (TICKET-10.6)', () => {
        beforeEach(() => {
            // Clear mocks specific to this suite's assertions
            executeActionsSpy.mockClear();
            mockJsonLogicService.evaluate.mockClear();
            mockLogger.debug.mockClear();
            // No entity manager calls expected for direct payload access
            mockEntityManager.getEntityInstance.mockClear();
            mockEntityManager.getComponentData.mockClear();
        });

        it('executes actions when event payload condition is true', async () => {
            // Arrange: Configure mock to return true for the payload condition
            mockJsonLogicService.evaluate.mockReturnValue(true);
            const handler = getSubscribedHandler();

            // Act: Call the handler with the event designed to pass the condition
            await handler(event_payload_pass);

            // Assert
            // 1. jsonLogicService.evaluate was called with the correct condition and context
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_payload.condition, // Ensure the specific rule's condition was used
                expect.objectContaining({ // Verify the context had the correct event
                    event: event_payload_pass,
                    actor: null, // No actorId in event_payload_pass
                    target: null // No targetId in event_payload_pass
                })
            );

            // 2. _executeActions spy WAS called
            expect(executeActionsSpy).toHaveBeenCalledTimes(1);
            expect(executeActionsSpy).toHaveBeenCalledWith(
                rule_cond_payload.actions,
                expect.any(Object), // The context object
                expect.stringContaining(`Rule '${rule_cond_payload.rule_id}'`) // Scope description
            );

            // 3. Optional: Check for the "no actions" log since the actions array is empty
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`No actions to execute for scope: Rule '${rule_cond_payload.rule_id}'`)
            );
        });

        it('skips actions when event payload condition is false', async () => {
            // Arrange: Configure mock to return false for the payload condition
            mockJsonLogicService.evaluate.mockReturnValue(false);
            const handler = getSubscribedHandler();

            // Act: Call the handler with the event designed to fail the condition
            await handler(event_payload_fail);

            // Assert
            // 1. jsonLogicService.evaluate WAS called
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledTimes(1);
            expect(mockJsonLogicService.evaluate).toHaveBeenCalledWith(
                rule_cond_payload.condition,
                expect.objectContaining({
                    event: event_payload_fail,
                    actor: null,
                    target: null
                })
            );

            // 2. _executeActions spy was NOT called
            expect(executeActionsSpy).not.toHaveBeenCalled();

            // 3. Check log message indicates condition failure
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(
                    `Root condition for rule '${rule_cond_payload.rule_id}' failed. Skipping actions.`
                )
            );
            // 4. Ensure the "no actions to execute" log was NOT called
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('No actions to execute for scope:')
            );
        });
    });
    // --- END: TICKET-10.6 Test Suite ---

});
