/*  src/tests/integration/coreTurnLoop.integration.test.js  */

import TurnManager from '../../core/turnManager.js';
import TurnHandlerResolver from '../../core/services/turnHandlerResolver.js';
import PlayerTurnHandler from '../../core/handlers/playerTurnHandler.js';
import AITurnHandler from '../../core/handlers/aiTurnHandler.js';
import CommandProcessor from '../../core/commandProcessor.js';
import InputHandler from '../../core/inputHandler.js';
import {
    PLAYER_COMPONENT_ID,
    ACTOR_COMPONENT_ID
} from '../../types/components.js';
import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

/* ------------------------------------------------- helpers ----- */
const flushPromises = () => new Promise(r => setTimeout(r, 0));
const makeVED = () => {
    const listeners = Object.create(null);
    return {
        listeners,
        subscribe: jest.fn((evt, fn) => {
            if (!listeners[evt]) listeners[evt] = new Set();
            listeners[evt].add(fn);
        }),
        unsubscribe: jest.fn((evt, fn) => listeners[evt]?.delete(fn)),
        dispatchValidated: jest.fn(async (evt, payload) => {
            const subs = listeners[evt];
            if (!subs) return;
            for (const fn of subs) await fn({type: evt, payload});
        })
    };
};
const makeLogger = () => ['info', 'warn', 'error', 'debug']
    .reduce((l, k) => ({...l, [k]: jest.fn()}), {});
const makeEntity = (id, {isPlayer = false} = {}) => ({
    id,
    hasComponent: cid =>
        cid === ACTOR_COMPONENT_ID || (isPlayer && cid === PLAYER_COMPONENT_ID)
});

/* ------------------------------------------------- suite -------- */
describe('Integration – Core Turn Loop', () => {
    let logger, ved, entityManager, worldContext, actionDiscoverySystem;
    let gameDataRepository, commandParser, actionExecutor, commandProcessor;
    let playerTurnHandler, aiTurnHandler, resolver, turnOrderService, tm;
    let player, ai;
    let inputElem, inputHandler;

    beforeEach(() => {
        logger = makeLogger();
        ved = makeVED();

        entityManager = {
            activeEntities: new Map(),
            getEntityInstance: jest.fn(id => entityManager.activeEntities.get(id)),
            addComponent: jest.fn()
        };
        worldContext = {
            getLocationOfEntity: jest.fn(() => ({id: 'loc-1'})),
            getCurrentLocation: jest.fn(() => ({id: 'loc-1'}))
        };
        gameDataRepository = {getActionDefinition: jest.fn(() => ({id: 'wait'}))};
        actionDiscoverySystem = {getValidActions: jest.fn(async () => [])};

        commandParser = {parse: jest.fn(cmd => ({actionId: cmd.trim(), error: null}))};
        actionExecutor = {executeAction: jest.fn(async () => ({success: true, endsTurn: true, messages: []}))};

        commandProcessor = new CommandProcessor({
            commandParser, actionExecutor, logger,
            validatedEventDispatcher: ved, worldContext, entityManager, gameDataRepository
        });
        jest.spyOn(commandProcessor, 'processCommand');

        player = makeEntity('player-1', {isPlayer: true});
        ai = makeEntity('ai-1');
        entityManager.activeEntities.set(player.id, player);
        entityManager.activeEntities.set(ai.id, ai);

        playerTurnHandler = new PlayerTurnHandler({
            logger, actionDiscoverySystem, validatedEventDispatcher: ved,
            commandProcessor, worldContext, entityManager, gameDataRepository
        });
        aiTurnHandler = new AITurnHandler({
            logger, commandProcessor, validatedEventDispatcher: ved, worldContext
        });
        jest.spyOn(playerTurnHandler, 'handleTurn');
        jest.spyOn(aiTurnHandler, 'handleTurn');

        resolver = new TurnHandlerResolver({logger, playerTurnHandler, aiTurnHandler});
        jest.spyOn(resolver, 'resolveHandler');

        turnOrderService = (() => {
            const s = {};
            s.queue = [];
            s.isEmpty = jest.fn(async () => s.queue.length === 0);
            s.getNextEntity = jest.fn(async () => s.queue.shift());
            s.startNewRound = jest.fn(async actors => {
                s.queue = [...actors];
            });
            s.clearCurrentRound = jest.fn(async () => {
                s.queue.length = 0;
            });
            return s;
        })();

        tm = new TurnManager({
            turnOrderService, entityManager, logger, dispatcher: ved, turnHandlerResolver: resolver
        });
        jest.spyOn(tm, 'advanceTurn');

        inputElem = document.createElement('input');
        const eventBus = {dispatch: jest.fn()};
        inputHandler = new InputHandler(
            inputElem, cmd => ved.dispatchValidated('command:submit', {command: cmd}), eventBus
        );
    });

    afterEach(async () => {
        await tm.stop();
        jest.clearAllMocks();
    });

    /* --------------------------- player flow ---------------------- */
    test('simulates a full player turn', async () => {
        turnOrderService.queue.push(player);
        const start = tm.start();
        await flushPromises();

        expect(ved.dispatchValidated)
            .toHaveBeenCalledWith('core:player_turn_prompt', expect.any(Object));

        inputHandler.enable();
        inputElem.value = 'wait';
        inputElem.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
        await flushPromises();

        expect(
            ved.dispatchValidated.mock.calls.some(c => c[0] === 'command:submit')
        ).toBe(true);
        expect(commandProcessor.processCommand)
            .toHaveBeenCalledWith(player, 'wait');

        /* Only the initial call is guaranteed on the happy path               */
        expect(tm.advanceTurn).toHaveBeenCalledTimes(1);

        await tm.stop();
        await start;
    });

    /* ------------------------------- AI flow ---------------------- */
    test('simulates a full AI turn', async () => {
        turnOrderService.queue.push(ai);
        const start = tm.start();
        await flushPromises();

        expect(resolver.resolveHandler).toHaveBeenCalledWith(ai);
        expect(aiTurnHandler.handleTurn).toHaveBeenCalledWith(ai);
        expect(commandProcessor.processCommand).toHaveBeenCalledWith(ai, 'wait');

        /* idem: single guaranteed call                                       */
        expect(tm.advanceTurn).toHaveBeenCalledTimes(1);

        await tm.stop();
        await start;
    });

    /* --------------------------- error path ----------------------- */
    test('recovers gracefully when CommandProcessor rejects', async () => {
        commandProcessor.processCommand.mockImplementationOnce(async () => {
            throw new Error('forced-failure');
        });

        turnOrderService.queue.push(player);
        const start = tm.start();
        await flushPromises();

        inputHandler.enable();
        inputElem.value = 'wait';
        inputElem.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
        await flushPromises();

        expect(
            ved.dispatchValidated.mock.calls.some(c => c[0] === 'core:system_error_occurred')
        ).toBe(true);

        /* At least 2 calls: initial + recovery attempt (could be more)        */
        expect(tm.advanceTurn.mock.calls.length).toBeGreaterThanOrEqual(2);

        await tm.stop();
        // no need to await the original `start` promise in this test
    });
});