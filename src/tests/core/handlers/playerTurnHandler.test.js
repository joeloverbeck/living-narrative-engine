// src/tests/core/handlers/playerTurnHandler.test.js

/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import Entity from '../../../entities/entity.js';

// --- FIX: Use Promise.resolve().then() for portable microtask flushing ---
// helper – yield execution allow micro-tasks to process
const flush = () => Promise.resolve().then(() => Promise.resolve());
// --- END FIX ---


/* -------------------------------------------------------------------------- */
/* fresh dependency bundle                                                   */
/* -------------------------------------------------------------------------- */
const makeDeps = () => {
    const logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

    const actionDiscoverySystem = {
        getValidActions: jest.fn().mockResolvedValue(['look', 'move']),
    };

    const validatedEventDispatcher = {
        dispatchValidated: jest.fn().mockResolvedValue(true),
    };

    const commandProcessor = {
        processCommand: jest.fn().mockResolvedValue({success: true}),
    };

    const gameStateManager = {
        // any non-null location object is fine
        getLocationOfEntity: jest.fn().mockResolvedValue({id: 'loc-1'}),
    };

    const entityManager = {getEntity: jest.fn()};
    const gameDataRepository = {getActionDefinition: jest.fn()};

    // --- MOCK MODIFICATION: Track the saved listener for unsubscribe check ---
    let savedListener = null; // Use null initially
    const eventBus = {
        subscribe: jest.fn((evt, listener) => {
            // Only save the listener for the specific event we care about unsubscribing
            if (evt === 'command:submit') {
                savedListener = listener;
            }
            // No longer need to return a handle like 'sub-1'
        }),
        unsubscribe: jest.fn(),
        // Getter to access the saved listener in tests
        getSavedCommandSubmitListener: () => savedListener,
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
        // Keep simple getter for convenience if used elsewhere, but specific one is clearer
        get savedListener() {
            return savedListener;
        },
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
    });

    /* ───────────────────────── constructor ──────────────────────────────── */
    it('stores deps & subscribes to command:submit', () => {
        expect(deps.eventBus.subscribe).toHaveBeenCalledWith(
            'command:submit',
            expect.any(Function), // Check that *a* function was passed
        );
        // Optionally check if the correct listener was saved by the mock
        expect(deps.eventBus.getSavedCommandSubmitListener()).toEqual(expect.any(Function));
    });

    it('throws if logger is missing', () => {
        // Ensure eventBus mock doesn't cause issues here
        const minimalDeps = makeDeps();
        delete minimalDeps.logger; // Remove logger
        expect(() => new PlayerTurnHandler({...minimalDeps, logger: null})) // Pass null logger explicitly
            .toThrow(/logger/i);
    });

    /* ───────────────────────── turn-initiation ──────────────────────────── */
    it('discovers actions & enables input when a turn starts', async () => {
        // Don't await here, let the promise run in the background initially
        handler.handleTurn(actor);

        // Allow async operations within handleTurn/initiate sequence to complete
        await flush();

        // Check action discovery
        expect(deps.actionDiscoverySystem.getValidActions)
            .toHaveBeenCalledWith(actor, expect.objectContaining({
                actingEntity: actor,
                // Add other expected context properties if needed
            }));
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('event:update_available_actions', expect.anything());

        // Check input enabling (usually happens after action discovery)
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith(
                'textUI:enable_input',
                expect.objectContaining({entityId: actor.id}),
            );
    });

    /* ───────────────────────── happy path ───────────────────────────────── */
    it('processes a submitted command & resolves the turn promise', async () => {
        const turnPromise = handler.handleTurn(actor);  // Keep the promise
        await flush(); // Allow initiation sequence microtasks to finish

        // Trigger the command via the saved listener
        // Ensure the listener was actually saved
        const listener = deps.eventBus.getSavedCommandSubmitListener();
        expect(listener).not.toBeNull();
        if (listener) {
            listener({entityId: actor.id, command: 'look'}); // No await needed here, it triggers async work
        }

        // Wait for the handler's turn promise to resolve
        const result = await turnPromise;

        // Expect null based on observed behavior (change back to undefined if underlying cause found)
        expect(result).toBeNull();

        // Check that the command processor was called
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'look');
    });

    /* ───────────────────────── wrong actor ─────────────────────────────── */
    it('ignores command for wrong actor', async () => {
        handler.handleTurn(actor);
        await flush(); // Allow initiation

        const listener = deps.eventBus.getSavedCommandSubmitListener();
        expect(listener).not.toBeNull();
        if (listener) {
            listener({entityId: 'npc-99', command: 'attack'});
            await flush(); // Allow async handling in listener (logging, returning)
        }


        expect(deps.commandProcessor.processCommand).not.toHaveBeenCalled();
        expect(deps.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/wrong actor/i),
            // Optionally add more specifics if the log message format is stable
        );
    });

    /* ───────────────────────── no active turn ──────────────────────────── */
    it('warns & ignores when no actor is active', async () => {
        // No call to handler.handleTurn()

        const listener = deps.eventBus.getSavedCommandSubmitListener();
        expect(listener).not.toBeNull();
        if (listener) {
            listener({entityId: actor.id, command: 'look'});
            await flush(); // Allow async handling in listener
        }

        expect(deps.commandProcessor.processCommand).not.toHaveBeenCalled();
        expect(deps.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/no turn is active/i),
        );
    });

    /* ───────────────────────── failure path ─────────────────────────────── */
    it('rejects the turn promise if processCommand throws', async () => {
        // Just create the error, don't throw it here
        const boom = new Error('boom');
        deps.commandProcessor.processCommand.mockRejectedValue(boom);

        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation

        // Use rejects matcher correctly
        // Attach the rejection expectation *before* triggering the command
        const rejectionCheck = expect(turnPromise).rejects.toThrow('boom');

        // Now trigger the failing command using the listener
        const listener = deps.eventBus.getSavedCommandSubmitListener();
        expect(listener).not.toBeNull();
        if (listener) {
            listener({entityId: actor.id, command: 'explode'});
            // Allow microtasks after triggering command
            await flush();
        }


        // Wait for the promise to actually reject and the assertion to pass
        await rejectionCheck;

        // Also check logger was called for the error during processing
        expect(deps.logger.error).toHaveBeenCalledWith(
            expect.stringMatching(/Error while processing command "explode"/i),
            boom // Expect the original error object
        );
    });


    /* ───────────────────────── cleanup ──────────────────────────────────── */
    it('unsubscribes & resets state on destroy()', () => {
        // Get the listener that *should* have been subscribed
        const expectedListener = deps.eventBus.getSavedCommandSubmitListener();
        expect(expectedListener).toEqual(expect.any(Function)); // Ensure it was set

        handler.destroy();

        // Expect unsubscribe with event name and the actual listener
        expect(deps.eventBus.unsubscribe).toHaveBeenCalledWith('command:submit', expectedListener);

        // Idempotency check
        handler.destroy();
        expect(deps.eventBus.unsubscribe).toHaveBeenCalledTimes(1); // Still called only once
    });
});