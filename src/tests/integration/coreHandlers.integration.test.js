// src/tests/integration/coreHandlers.integration.test.js

// -----------------------------------------------------------------------------
//  T‑07 | Integration Test – Chained Rule Execution (enemy_damaged ➜ enemy_dead)
// -----------------------------------------------------------------------------
//  Validates that:
//   1. Rule‑A mutates a component and immediately emits a second event.
//   2. Rule‑B reacts to that second event in the same tick (sound stub).
//   3. EventBus.dispatch is observed twice (original + emitted).
// -----------------------------------------------------------------------------

// --- Jest Globals -----------------------------------------------------------
import {describe, beforeEach, afterEach, it, expect, jest} from '@jest/globals';

// --- Core & Logic -----------------------------------------------------------
import EventBus from '../../core/eventBus.js';
import SystemLogicInterpreter from '../../logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../logic/operationInterpreter.js';
import OperationRegistry from '../../logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
import ModifyComponentHandler from '../../logic/operationHandlers/modifyComponentHandler.js';

// -----------------------------------------------------------------------------
//  Minimal in‑memory EntityManager stub – just enough for the handlers we use.
// -----------------------------------------------------------------------------
class SimpleEntityManager {
    constructor() {
        /** @type {Map<string, Map<string, any>>} */
        this._entities = new Map();
    }

    /** Utility used only by the test harness */
    _createEntity(id) {
        if (!this._entities.has(id)) this._entities.set(id, new Map());
    }

    addComponent(entityId, componentType, data) {
        this._createEntity(entityId);
        this._entities.get(entityId).set(componentType, JSON.parse(JSON.stringify(data)));
    }

    getComponentData(entityId, componentType) {
        return this._entities.get(entityId)?.get(componentType);
    }

    hasComponent(entityId, componentType) {
        return this._entities.get(entityId)?.has(componentType) ?? false;
    }

    // Not used but keeps the public surface familiar
    getEntityInstance(id) {
        return {id};
    }
}

// -----------------------------------------------------------------------------
//  Minimal IDataRegistry stub – only the method the interpreter needs.
// -----------------------------------------------------------------------------
class StubDataRegistry {
    /** @param {import('../../data/schemas/rule.schema.json').SystemRule[]} rules */
    constructor(rules) {
        this._rules = rules;
    }

    getAllSystemRules() {
        return this._rules;
    }
}

// -----------------------------------------------------------------------------
//  The Test -------------------------------------------------------------------
// -----------------------------------------------------------------------------

describe('T‑07: enemy_damaged ➜ enemy_dead chained rules', () => {
    // Test doubles & system under test
    /** @type {EventBus} */
    let eventBus;
    /** @type {SimpleEntityManager} */
    let entityManager;
    /** @type {OperationRegistry} */
    let opRegistry;
    /** @type {OperationInterpreter} */
    let opInterpreter;
    /** @type {SystemLogicInterpreter} */
    let interpreter;
    /** @type {JsonLogicEvaluationService} */
    let jsonLogicSvc;
    /** @type {ReturnType<typeof jest.fn>} */
    let playSoundSpy;
    /** @type {ReturnType<typeof jest.spyOn>} */
    let dispatchSpy;
    /** @type {Record<string, jest.Mock>} */
    let logger;

    const ENEMY_ID = 'enemy-1';

    beforeEach(() => {
        // ---- Logger stub --------------------------------------------------------
        logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

        // ---- Core services ------------------------------------------------------
        eventBus = new EventBus();
        entityManager = new SimpleEntityManager();
        opRegistry = new OperationRegistry({logger});
        opInterpreter = new OperationInterpreter({logger, registry: opRegistry});
        jsonLogicSvc = new JsonLogicEvaluationService({logger});

        // ---- Handlers we actually need -----------------------------------------
        // MODIFY_COMPONENT – use the real handler so we truly mutate the component
        const modHandler = new ModifyComponentHandler({entityManager, logger});
        opRegistry.register('MODIFY_COMPONENT', modHandler.execute.bind(modHandler));

        // DISPATCH_EVENT – lightweight inline stub that re‑uses the same EventBus
        opRegistry.register('DISPATCH_EVENT', (params /* , ctx */) => {
            const {eventType, payload = {}} = params ?? {};
            return eventBus.dispatch(eventType, payload);
        });

        // PLAY_SOUND – pure stub so we can assert it fired exactly once
        playSoundSpy = jest.fn();
        opRegistry.register('PLAY_SOUND', playSoundSpy);

        // ---- World setup --------------------------------------------------------
        entityManager.addComponent(ENEMY_ID, 'core:health', {current: 0, max: 10});
        entityManager.addComponent(ENEMY_ID, 'core:status', {dead: false});

        // ---- System rules -------------------------------------------------------
        /** @type {import('../../data/schemas/rule.schema.json').SystemRule} */
        const ruleA = {
            rule_id: 'enemy_die_state',
            event_type: 'game:enemy_damaged',
            condition: {'==': [{var: 'event.payload.targetId'}, ENEMY_ID]},
            actions: [
                {
                    type: 'MODIFY_COMPONENT',
                    parameters: {
                        entity_ref: {entityId: ENEMY_ID},
                        component_type: 'core:status',
                        field: 'dead',
                        mode: 'set',
                        value: true
                    }
                },
                {
                    type: 'DISPATCH_EVENT',
                    parameters: {
                        eventType: 'game:enemy_dead',
                        payload: {id: ENEMY_ID}
                    }
                }
            ]
        };

        /** @type {import('../../data/schemas/rule.schema.json').SystemRule} */
        const ruleB = {
            rule_id: 'enemy_dead_sound',
            event_type: 'game:enemy_dead',
            actions: [
                {
                    type: 'PLAY_SOUND',
                    parameters: {sfx: 'enemy_die'}
                }
            ]
        };

        const dataRegistry = new StubDataRegistry([ruleA, ruleB]);

        // ---- System‑logic interpreter ------------------------------------------
        interpreter = new SystemLogicInterpreter({
            logger,
            eventBus,
            dataRegistry,
            jsonLogicEvaluationService: jsonLogicSvc,
            entityManager,
            operationInterpreter: opInterpreter
        });

        interpreter.initialize();

        // ---- Spies --------------------------------------------------------------
        dispatchSpy = jest.spyOn(eventBus, 'dispatch');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('fires enemy_dead and plays sound after enemy reaches 0 HP', async () => {
        // Act – primary event
        await eventBus.dispatch('game:enemy_damaged', {targetId: ENEMY_ID, damage: 5});

        // 1️⃣ Component mutated ---------------------------------------------------
        const status = entityManager.getComponentData(ENEMY_ID, 'core:status');
        expect(status?.dead).toBe(true);

        // 2️⃣ EventBus.dispatch called twice (original + emitted) -----------------
        expect(dispatchSpy).toHaveBeenCalledTimes(2);
        expect(dispatchSpy).toHaveBeenNthCalledWith(1, 'game:enemy_damaged', expect.any(Object));
        expect(dispatchSpy).toHaveBeenNthCalledWith(2, 'game:enemy_dead', {id: ENEMY_ID});

        // 3️⃣ Rule‑B executed (sound handler) -------------------------------------
        expect(playSoundSpy).toHaveBeenCalledTimes(1);
    });
});
