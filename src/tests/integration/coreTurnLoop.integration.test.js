// src/tests/integration/coreTurnLoop.integration.test.js
// ****** CORRECTED FILE ******

import TurnManager from '../../core/turnManager.js';
import TurnHandlerResolver from '../../core/services/turnHandlerResolver.js';
import PlayerTurnHandler from '../../core/handlers/playerTurnHandler.js';
import AITurnHandler from '../../core/handlers/aiTurnHandler.js';
import CommandProcessor from '../../core/commandProcessor.js';
import InputHandler from '../../core/inputHandler.js'; // InputHandler itself
import {
    PLAYER_COMPONENT_ID,
    ACTOR_COMPONENT_ID
} from '../../types/components.js';
import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

/* ------------------------------------------------- helpers ----- */
const flushPromises = () => new Promise(r => setTimeout(r, 0));
const makeVED = () => { // Mock ValidatedEventDispatcher
    const listeners = Object.create(null);
    const dispatcher = {
        listeners,
        // Keep mocks simple for clarity
        subscribe: jest.fn((evt, fn) => {
            if (!listeners[evt]) listeners[evt] = new Set();
            listeners[evt].add(fn);
        }),
        unsubscribe: jest.fn((evt, fn) => {
            listeners[evt]?.delete(fn);
        }),
        // Mock dispatchValidated to simulate async behavior and call listeners
        dispatchValidated: jest.fn(async (evt, payload) => {
            const subs = listeners[evt];
            if (subs) {
                // Use Promise.all to handle async listeners if any exist
                await Promise.all(Array.from(subs).map(fn => fn({type: evt, payload})));
            }
            return true; // Assume dispatch always "succeeds" in the mock VED itself
        })
    };
    return dispatcher;
};
const makeLogger = () => ['info', 'warn', 'error', 'debug']
    .reduce((l, k) => ({...l, [k]: jest.fn()}), {});
const makeEntity = (id, {isPlayer = false} = {}) => ({
    id,
    hasComponent: jest.fn(cid =>
        cid === ACTOR_COMPONENT_ID || (isPlayer && cid === PLAYER_COMPONENT_ID)
    )
});

/* ------------------------------------------------- suite -------- */
describe('Integration – Core Turn Loop', () => {
    // Declare types using JSDoc for better clarity
    /** @type {ReturnType<typeof makeLogger>} */ let logger;
    /** @type {ReturnType<typeof makeVED>} */ let ved;
    /** @type {{activeEntities: Map<string, ReturnType<typeof makeEntity>>, getEntityInstance: jest.Mock, addComponent: jest.Mock}} */ let entityManager;
    /** @type {{getLocationOfEntity: jest.Mock, getCurrentLocation: jest.Mock}} */ let worldContext;
    /** @type {{getValidActions: jest.Mock}} */ let actionDiscoverySystem;
    /** @type {{getActionDefinition: jest.Mock}} */ let gameDataRepository;
    /** @type {{parse: jest.Mock}} */ let commandParser;
    /** @type {{executeAction: jest.Mock}} */ let actionExecutor;
    /** @type {CommandProcessor} */ let commandProcessor;
    /** @type {PlayerTurnHandler} */ let playerTurnHandler;
    /** @type {AITurnHandler} */ let aiTurnHandler;
    /** @type {TurnHandlerResolver} */ let resolver;
    /** @type {{queue: Array<ReturnType<typeof makeEntity>>, isEmpty: jest.Mock, getNextEntity: jest.Mock, startNewRound: jest.Mock, clearCurrentRound: jest.Mock}} */ let turnOrderService;
    /** @type {TurnManager} */ let tm;
    /** @type {ReturnType<typeof makeEntity>} */ let player;
    /** @type {ReturnType<typeof makeEntity>} */ let ai;
    /** @type {HTMLInputElement} */ let inputElem;
    /** @type {InputHandler} */ let inputHandler;
    /** @type {jest.SpyInstance} */ let inputHandlerEnableSpy; // Spy on instance method

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
        // Mock actionDiscoverySystem to return an empty array by default
        actionDiscoverySystem = {getValidActions: jest.fn(async () => [])};

        commandParser = {parse: jest.fn(cmd => ({actionId: cmd.trim(), error: null}))};
        // Mock actionExecutor to resolve successfully by default
        actionExecutor = {executeAction: jest.fn(async () => ({success: true, endsTurn: true, messages: []}))};

        commandProcessor = new CommandProcessor({
            commandParser, actionExecutor, logger,
            validatedEventDispatcher: ved,
            worldContext, entityManager, gameDataRepository
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
            logger, commandProcessor, validatedEventDispatcher: ved,
            worldContext, actionDiscoverySystem // Provide ADS to AI handler too
        });
        // Spy on the handleTurn methods
        jest.spyOn(playerTurnHandler, 'handleTurn');
        jest.spyOn(aiTurnHandler, 'handleTurn');

        resolver = new TurnHandlerResolver({logger, playerTurnHandler, aiTurnHandler});
        jest.spyOn(resolver, 'resolveHandler');

        turnOrderService = (() => {
            const s = {queue: []}; // Use concrete array
            s.isEmpty = jest.fn(async () => s.queue.length === 0);
            s.getNextEntity = jest.fn(async () => s.queue.shift()); // Mutates queue
            s.startNewRound = jest.fn(async actors => {
                s.queue = [...actors];
            });
            s.clearCurrentRound = jest.fn(async () => {
                s.queue.length = 0;
            });
            return s;
        })();

        tm = new TurnManager({
            turnOrderService, entityManager, logger,
            dispatcher: ved,
            turnHandlerResolver: resolver
        });
        jest.spyOn(tm, 'advanceTurn');

        inputElem = document.createElement('input');
        inputHandler = new InputHandler(
            inputElem,
            cmd => ved.dispatchValidated('core:submit_command', {command: cmd}),
            ved
        );
        // Spy on the enable method *after* instance creation
        inputHandlerEnableSpy = jest.spyOn(inputHandler, 'enable');

    });

    afterEach(async () => {
        await tm.stop();
        // Restore spies if created on instances (like inputHandler.enable)
        inputHandlerEnableSpy?.mockRestore();
        jest.clearAllMocks(); // Clears call counts etc. for mocks created with jest.fn()
    });

    /* --------------------------- player flow ---------------------- */
    test('simulates a full player turn', async () => {
        turnOrderService.queue.push(player);
        const startPromise = tm.start();
        await flushPromises();

        // *** CORRECTION 1: Expect entityId in payload ***
        expect(ved.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({entityId: player.id, availableActions: []}) // Check entityId and actions
        );

        await ved.dispatchValidated('textUI:enable_input', {});
        await flushPromises();

        // Use the spy created in beforeEach
        expect(inputHandlerEnableSpy).toHaveBeenCalledTimes(1);

        inputElem.value = 'wait';
        inputElem.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
        await flushPromises();

        expect(ved.dispatchValidated).toHaveBeenCalledWith(
            'core:submit_command',
            {command: 'wait'}
        );
        expect(commandProcessor.processCommand).toHaveBeenCalledWith(player, 'wait');
        // *** CORRECTION 2 (Implicit): Check actionExecutor call signature correctly ***
        expect(actionExecutor.executeAction).toHaveBeenCalledWith('wait', expect.objectContaining({actingEntity: player}));

        expect(tm.advanceTurn).toHaveBeenCalled();

        await tm.stop();
        await startPromise;
    });

    /* ------------------------------- AI flow ---------------------- */
    test('simulates a full AI turn', async () => {
        turnOrderService.queue.push(ai);
        const startPromise = tm.start();
        await flushPromises();

        expect(resolver.resolveHandler).toHaveBeenCalledWith(ai);
        expect(aiTurnHandler.handleTurn).toHaveBeenCalledWith(ai);
        expect(commandProcessor.processCommand).toHaveBeenCalledWith(ai, 'wait');

        // *** CORRECTION 2: Check actionExecutor call signature ***
        expect(actionExecutor.executeAction).toHaveBeenCalledWith(
            'wait', // Action ID is the first argument
            expect.objectContaining({actingEntity: ai}) // Context object is second, check relevant part
        );

        expect(tm.advanceTurn).toHaveBeenCalled();

        await tm.stop();
        await startPromise;
    });

    /* --------------------------- error path ----------------------- */
    test('recovers gracefully when CommandProcessor rejects', async () => {
        const processingError = new Error('forced-failure');
        // Make CommandProcessor reject when called
        commandProcessor.processCommand.mockRejectedValueOnce(processingError);

        turnOrderService.queue.push(player);
        const startPromise = tm.start(); // Start turn manager
        await flushPromises(); // Allow initial turn processing (prompt dispatch)

        // Check initial player prompt dispatch (using corrected assertion)
        expect(ved.dispatchValidated).toHaveBeenCalledWith('core:player_turn_prompt', expect.objectContaining({entityId: player.id}));

        // Simulate enabling input
        await ved.dispatchValidated('textUI:enable_input', {});
        await flushPromises();

        // Simulate player entering the command that causes failure
        inputElem.value = 'fail_command';
        inputElem.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
        await flushPromises(); // Allow command submission and processing attempt

        // Check command was submitted
        expect(ved.dispatchValidated).toHaveBeenCalledWith('core:submit_command', {command: 'fail_command'});
        // Check CommandProcessor was called (and subsequently rejected)
        expect(commandProcessor.processCommand).toHaveBeenCalledWith(player, 'fail_command');

        // *** CORRECTION 3: Check the actual system error event payload ***
        expect(ved.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                type: 'error',
                // Check that the details contain the original error's message
                details: expect.stringContaining(processingError.message),
                // Check the user-facing message (might be generic)
                message: expect.stringContaining(`processing command or re-prompting for ${player.id}`)
            })
        );

        // Check logger was called with the error object
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error during command processing or re-prompt'), processingError);

        // Check TurnManager attempted recovery by advancing turn
        // It's called once initially, and again in the handler's catch block
        expect(tm.advanceTurn.mock.calls.length).toBeGreaterThanOrEqual(2);

        await tm.stop();
        // startPromise might reject due to the error propagating, don't necessarily await it here.
    });
});