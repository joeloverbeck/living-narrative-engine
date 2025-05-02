// src/tests/core/handlers/playerTurnHandler.test.js

/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import Entity from '../../../entities/entity.js';

// helper – yield execution allow micro-tasks to process
const flush = () => new Promise(resolve => setTimeout(resolve, 0));


/* -------------------------------------------------------------------------- */
/* fresh dependency bundle                                                   */
/* -------------------------------------------------------------------------- */
const makeDeps = () => {
    const logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

    // ****** START FIX: Return objects with 'id' property ******
    const actionDiscoverySystem = {
        getValidActions: jest.fn().mockResolvedValue([{ id: 'look' }, { id: 'move' }]), // Return objects with id
    };
    // ****** END FIX ******

    let savedVedListener = null;
    const validatedEventDispatcher = {
        dispatchValidated: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn((evt, listener) => {
            if (evt === 'command:submit') {
                savedVedListener = listener;
            }
        }),
        unsubscribe: jest.fn(),
        getSavedCommandSubmitListener: () => savedVedListener,
    };

    const commandProcessor = {
        processCommand: jest.fn().mockResolvedValue({success: true, turnEnded: true}),
    };

    const gameStateManager = {
        getLocationOfEntity: jest.fn().mockResolvedValue({id: 'loc-1'}),
        getCurrentLocation: jest.fn().mockResolvedValue({ id: 'current-loc-for-player' })
    };

    const entityManager = { getEntityInstance: jest.fn() };

    const gameDataRepository = {getActionDefinition: jest.fn()};

    // NOTE: eventBus mock is unused by PlayerTurnHandler for command:submit
    const eventBus = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
    };

    return {
        logger,
        actionDiscoverySystem,
        validatedEventDispatcher,
        commandProcessor,
        gameStateManager,
        entityManager,
        gameDataRepository,
        eventBus,
    };
};

const makeActor = () => new Entity('player-1');

/* -------------------------------------------------------------------------- */
/* suite                                                                     */
/* -------------------------------------------------------------------------- */
describe('PlayerTurnHandler', () => {
    let deps, handler, actor;

    beforeEach(() => {
        deps = makeDeps();
        handler = new PlayerTurnHandler(deps);
        actor = makeActor();
        // Clear mocks AFTER handler creation to avoid clearing constructor-related mocks if needed
        jest.clearAllMocks();
        // Re-mock subscribe after clearAllMocks because the constructor calls it
        deps.validatedEventDispatcher.subscribe = jest.fn((evt, listener) => {
            if (evt === 'command:submit') {
                deps.validatedEventDispatcher.getSavedCommandSubmitListener = () => listener; // Re-establish getter
            }
        });
        // Call subscribe again manually to simulate constructor behavior after clearAllMocks
        // NOTE: The actual listener function reference from the handler is lost here,
        // but we can retrieve it via the mock getter set above. This is a common pattern
        // when needing to clear mocks called during construction.
        handler = new PlayerTurnHandler(deps); // Re-create handler to re-subscribe
        actor = makeActor(); // Re-create actor
    });

    /* ───────────────────────── constructor ──────────────────────────────── */
    it('stores deps & subscribes to command:submit via VED', () => {
        // Construction happens in beforeEach, re-create here for clarity if needed or rely on beforeEach
        // handler = new PlayerTurnHandler(deps); // If not relying solely on beforeEach
        expect(deps.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
            'command:submit',
            expect.any(Function),
        );
        expect(deps.validatedEventDispatcher.getSavedCommandSubmitListener()).toEqual(expect.any(Function));
        expect(deps.eventBus.subscribe).not.toHaveBeenCalled();
    });

    it('throws if logger is missing', () => {
        const minimalDeps = makeDeps(); delete minimalDeps.logger;
        expect(() => new PlayerTurnHandler({...minimalDeps, logger: null}))
            .toThrow(/logger/i);
    });

    it('throws if actionDiscoverySystem is missing', () => {
        const minimalDeps = makeDeps(); delete minimalDeps.actionDiscoverySystem;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/actionDiscoverySystem/i);
    });
    it('throws if validatedEventDispatcher is missing', () => {
        const minimalDeps = makeDeps(); delete minimalDeps.validatedEventDispatcher;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/validatedEventDispatcher/i);
    });
    it('throws if commandProcessor is missing', () => {
        const minimalDeps = makeDeps(); delete minimalDeps.commandProcessor;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/commandProcessor/i);
    });
    it('throws if gameStateManager is missing', () => {
        const minimalDeps = makeDeps(); delete minimalDeps.gameStateManager;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/gameStateManager/i);
    });
    it('throws if entityManager is missing', () => {
        const minimalDeps = makeDeps(); delete minimalDeps.entityManager;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/entityManager/i);
    });
    it('throws if gameDataRepository is missing', () => {
        const minimalDeps = makeDeps(); delete minimalDeps.gameDataRepository;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/gameDataRepository/i);
    });


    /* ───────────────────────── turn-initiation ──────────────────────────── */
    // ****** START FIX: Test updated for core event ******
    it('discovers actions & dispatches core:player_turn_prompt when a turn starts', async () => {
        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow async operations within handleTurn/initiate sequence

        // Check action discovery
        expect(deps.gameStateManager.getLocationOfEntity).toHaveBeenCalledWith(actor);
        const expectedLocation = await deps.gameStateManager.getLocationOfEntity(); // Get mock value
        expect(deps.actionDiscoverySystem.getValidActions).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({
                actingEntity: actor,
                currentLocation: expectedLocation,
                entityManager: deps.entityManager,
                gameDataRepository: deps.gameDataRepository,
                gameStateManager: deps.gameStateManager,
                logger: deps.logger
            })
        );

        // Check dispatch for the CORE prompt event
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt', // Expect the core event
            expect.objectContaining({
                entityId: actor.id,
                availableActions: ['look', 'move'], // Expect array of IDs based on mock & handler logic
            })
        );

        // Ensure UI events are NOT dispatched by this handler
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'textUI:update_available_actions',
            expect.anything()
        );
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'textUI:enable_input',
            expect.anything()
        );

        // Turn promise should not resolve here yet
        let resolved = false;
        turnPromise.then(() => { resolved = true; });
        await new Promise(r => setTimeout(r, 5)); // Wait briefly
        expect(resolved).toBe(false);
    });
    // ****** END FIX ******

    /* ───────────────────────── happy path ───────────────────────────────── */
    // ****** START FIX: Test updated for core event ******
    it('processes a submitted command, resolves turn promise, dispatches core:turn_ended', async () => {
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: true});

        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation (dispatches first prompt)

        // Clear mocks *after* initiation if only testing command processing calls
        // jest.clearAllMocks(); // Use carefully if constructor/initiation mocks are needed later

        // Simulate command submission
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function));
        await listener({ command: 'look' }); // Trigger the command

        // Wait for the handler's turn promise to resolve
        await expect(turnPromise).resolves.toBeUndefined();

        // Check command processor call
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'look');

        // Check VED dispatch for the CORE turn ended event
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended', expect.objectContaining({entityId: actor.id})
        );

        // Ensure UI events are NOT dispatched
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'textUI:disable_input',
            expect.anything()
        );
    });
    // ****** END FIX ******

    /* ───────────────── command doesn't end turn ─────────────────────────── */
    // ****** START FIX: Test updated for core event ******
    it('re-dispatches core:player_turn_prompt if command succeeds but does not end turn', async () => {
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: false});

        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation (dispatches first prompt)

        // Check initial prompt dispatch
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({ entityId: actor.id, availableActions: ['look', 'move'] })
        );
        const initialDispatchCount = deps.validatedEventDispatcher.dispatchValidated.mock.calls.length;

        // Simulate command submission
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        await listener({ command: 'examine self' }); // Trigger the command
        await flush(); // Allow command processing microtasks and potential re-prompt

        // Check command processor call
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'examine self');

        // Check VED dispatch for the CORE prompt event AGAIN
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(initialDispatchCount + 1); // Prompted again
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(
            initialDispatchCount + 1, // The call after the initial prompt
            'core:player_turn_prompt',
            expect.objectContaining({ entityId: actor.id, availableActions: ['look', 'move'] }) // Assuming actions rediscovery returns the same
        );

        // Ensure UI events are NOT dispatched
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'textUI:disable_input', expect.anything()
        );
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'textUI:enable_input', expect.anything()
        );

        // IMPORTANT: The turn promise should NOT have resolved yet
        let resolved = false;
        turnPromise.then(() => { resolved = true; });
        await new Promise(r => setTimeout(r, 10)); // Wait a short moment
        expect(resolved).toBe(false);
    });
    // ****** END FIX ******

    /* ───────────────────────── no active turn ──────────────────────────── */
    it('ignores command if received when not its turn', async () => {
        // DO NOT call handler.handleTurn(actor)

        // Simulate command submission via VED listener
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        // Need to get the listener from a handler instance, even if turn not started
        const tempHandlerForListener = new PlayerTurnHandler(deps);
        const actualListener = deps.validatedEventDispatcher.getSavedCommandSubmitListener(); // Get listener attached by tempHandler

        expect(actualListener).toEqual(expect.any(Function));
        await actualListener({ command: 'attack' });
        await flush();

        // Verify processor was not called and a warning was logged
        expect(deps.commandProcessor.processCommand).not.toHaveBeenCalled();
        // Logger might be called by the tempHandler, focus on processCommand absence
        // Or check the specific warning message if the logger mock isn't cleared/reused ambiguously
        expect(deps.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/no player turn is active/i),
        );
        tempHandlerForListener.destroy(); // Clean up temp handler
    });


    /* ───────────────────────── failure path ─────────────────────────────── */
    // ****** START FIX: Test updated for core events ******
    it('rejects the turn promise, dispatches core events on processCommand error', async () => {
        const boom = new Error('boom');
        deps.commandProcessor.processCommand.mockRejectedValue(boom);

        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation (dispatches first prompt)

        const rejectionCheck = expect(turnPromise).rejects.toThrow(boom); // Set up rejection expectation

        // Simulate command submission
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function));
        await listener({ command: 'explode' }); // Trigger the command that will fail

        await rejectionCheck; // Wait for the promise to actually reject

        // Ensure UI events NOT dispatched
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'textUI:disable_input', expect.anything()
        );
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith(
            'textUI:display_message', expect.anything()
        );


        // Check logger was called for the CRITICAL error during processing
        expect(deps.logger.error).toHaveBeenCalledWith(
            expect.stringMatching(/CRITICAL error during command processing/i),
            boom
        );

        // Check VED dispatch for the CORE system error event
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                message: expect.stringContaining(`processing command for ${actor.id}`),
                type: 'error',
                details: boom.message // Check if error message is included in details
            })
        );

        // Check VED dispatch for the CORE turn ended event (should still happen on error)
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            expect.objectContaining({ entityId: actor.id })
        );
    });
    // ****** END FIX ******

    /* ───────────────────────── cleanup ──────────────────────────────────── */
    it('unsubscribes & resets state on destroy()', () => {
        const expectedListener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(expectedListener).toEqual(expect.any(Function)); // Ensure it was set

        handler.destroy();

        // Expect VED unsubscribe with event name and the actual listener
        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledWith('command:submit', expectedListener);
        expect(deps.eventBus.unsubscribe).not.toHaveBeenCalled(); // Ensure old bus not used

        // Idempotency check
        const currentCallCount = deps.validatedEventDispatcher.unsubscribe.mock.calls.length;
        handler.destroy(); // Call again
        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledTimes(currentCallCount); // Should not call again
    });

    it('cleans up, rejects promise, dispatches core:turn_ended if destroyed mid-turn', async () => {
        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation (dispatches first prompt)

        // Rejection check
        const rejectionCheck = expect(turnPromise).rejects.toThrow(/destroyed during turn/i);

        // Destroy the handler while the turn is pending
        handler.destroy();

        // Wait for the rejection
        await rejectionCheck;

        // Verify unsubscribe happened
        // Note: getSavedCommandSubmitListener might return null if destroy clears it AFTER unsubscribing
        // It's safer to check that unsubscribe was called with *some* function.
        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledWith(
            'command:submit',
            expect.any(Function) // The specific listener ref might be cleared by destroy
        );

        // Check VED dispatch for the CORE turn ended event (should happen on destroy mid-turn)
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            expect.objectContaining({ entityId: actor.id })
        );

        // Internal state check (optional, requires exposing state or more side effects)
        // e.g., expect(handler.getCurrentActor()).toBeNull(); // If method existed
    });
});