// src/tests/core/handlers/playerTurnHandler.test.js
// --- FILE START (Corrected Test File) ---

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

    const actionDiscoverySystem = {
        getValidActions: jest.fn().mockResolvedValue([{id: 'look'}, {id: 'move'}]), // Return objects with id
    };

    let savedVedListener = null;
    const validatedEventDispatcher = {
        dispatchValidated: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn((evt, listener) => {
            if (evt === 'command:submit') {
                savedVedListener = listener;
            }
        }),
        unsubscribe: jest.fn(),
        // Helper to retrieve the listener instance stored by the mock subscribe
        getSavedCommandSubmitListener: () => savedVedListener,
    };

    const commandProcessor = {
        processCommand: jest.fn().mockResolvedValue({success: true, turnEnded: true}),
    };

    // ****** START FIX: Rename gameStateManager to worldContext ******
    // This is the dependency the constructor actually requires
    const worldContext = {
        getLocationOfEntity: jest.fn().mockResolvedValue({id: 'loc-1'}),
        // Changed to mockReturnValue as getCurrentLocation might be expected sync in some contexts
        // The constructor check only verifies typeof function, but aligning mock helps elsewhere
        getCurrentLocation: jest.fn().mockReturnValue({id: 'current-loc-for-player'})
    };
    // ****** END FIX ******

    const entityManager = {getEntityInstance: jest.fn().mockReturnValue(new Entity('default-entity'))}; // Provide a default mock entity return

    const gameDataRepository = {getActionDefinition: jest.fn().mockReturnValue({id: 'action-def-look'})}; // Provide default mock return

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
        // gameStateManager, // Removed
        worldContext, // Added
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
        // Create handler FIRST to ensure constructor validation passes with correct deps
        handler = new PlayerTurnHandler(deps);
        actor = makeActor();

        // Clear mocks AFTER handler creation if needed (be careful with constructor calls)
        // jest.clearAllMocks(); // Let's avoid clearing for now to simplify listener management

        // Reset specific mocks that accumulate calls across tests if necessary
        deps.validatedEventDispatcher.dispatchValidated.mockClear();
        deps.commandProcessor.processCommand.mockClear();
        deps.actionDiscoverySystem.getValidActions.mockClear();
        deps.worldContext.getLocationOfEntity.mockClear();
        deps.worldContext.getCurrentLocation.mockClear();
        deps.logger.warn.mockClear(); // Clear warnings for cleaner tests
        deps.logger.error.mockClear(); // Clear errors

        // Re-establish default mock implementations if they were complex and cleared above
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: true});
        deps.actionDiscoverySystem.getValidActions.mockResolvedValue([{id: 'look'}, {id: 'move'}]);
        deps.worldContext.getLocationOfEntity.mockResolvedValue({id: 'loc-1'});
        deps.worldContext.getCurrentLocation.mockReturnValue({id: 'current-loc-for-player'});

        // Find the listener attached by the handler during construction
        // The mock subscribe in makeDeps saves the listener.
        const initialListener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        // Re-attach it to the getter in case something cleared the VED mock itself
        deps.validatedEventDispatcher.getSavedCommandSubmitListener = () => initialListener;

    });

    /* ───────────────────────── constructor ──────────────────────────────── */
    it('stores deps & subscribes to command:submit via VED', () => {
        // Arrange: create fresh deps and handler
        const freshDeps = makeDeps();
        const freshHandler = new PlayerTurnHandler(freshDeps);

        // Assert: Check if subscribe was called during construction
        expect(freshDeps.validatedEventDispatcher.subscribe).toHaveBeenCalledWith(
            'command:submit',
            expect.any(Function),
        );
        // Check if the listener was saved correctly by the mock
        expect(freshDeps.validatedEventDispatcher.getSavedCommandSubmitListener()).toEqual(expect.any(Function));
        // Ensure old eventBus is not used
        expect(freshDeps.eventBus.subscribe).not.toHaveBeenCalled();

        freshHandler.destroy(); // Clean up
    });

    // --- Constructor Dependency Validation Tests ---
    it('throws if logger is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.logger;
        expect(() => new PlayerTurnHandler({...minimalDeps, logger: null}))
            .toThrow(/logger dependency/i); // Match error message more specifically
    });

    it('throws if actionDiscoverySystem is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.actionDiscoverySystem;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/actionDiscoverySystem/i);
    });
    it('throws if validatedEventDispatcher is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.validatedEventDispatcher;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/validatedEventDispatcher/i);
    });
    it('throws if commandProcessor is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.commandProcessor;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/commandProcessor/i);
    });

    // ****** START FIX: Test for worldContext, remove gameStateManager ******
    it('throws if worldContext is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.worldContext;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/worldContext/i);
    });
    // it('throws if gameStateManager is missing', () => { // Removed });
    // ****** END FIX ******

    it('throws if entityManager is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.entityManager;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/entityManager/i);
    });
    it('throws if gameDataRepository is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.gameDataRepository;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/gameDataRepository/i);
    });
    // --- End Constructor Dependency Validation Tests ---


    /* ───────────────────────── turn-initiation ──────────────────────────── */
    it('discovers actions & dispatches core:player_turn_prompt when a turn starts', async () => {
        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow async operations within handleTurn/initiate sequence

        // Check location retrieval
        expect(deps.worldContext.getLocationOfEntity).toHaveBeenCalledWith(actor);
        // const expectedLocation = await deps.worldContext.getLocationOfEntity(); // Use mock return value directly
        const expectedLocation = {id: 'loc-1'}; // From makeDeps mock

        // ****** START FIX: Check context passed to getValidActions ******
        // Check action discovery with the correct context properties
        expect(deps.actionDiscoverySystem.getValidActions).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({
                actingEntity: actor,
                currentLocation: expectedLocation,
                entityManager: deps.entityManager,
                gameDataRepository: deps.gameDataRepository,
                worldContext: deps.worldContext, // Expect worldContext here
                // gameStateManager: deps.gameStateManager, // NOT gameStateManager
                logger: deps.logger
            })
        );
        // ****** END FIX ******

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
        turnPromise.then(() => {
            resolved = true;
        });
        await new Promise(r => setTimeout(r, 5)); // Wait briefly
        expect(resolved).toBe(false);
    });

    /* ───────────────────────── happy path ───────────────────────────────── */
    it('processes a submitted command, resolves turn promise, dispatches core:turn_ended', async () => {
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: true});

        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation (dispatches first prompt)

        // Simulate command submission using the retrieved listener
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function));
        await listener({payload: {command: 'look'}}); // Trigger the command - ensure payload structure matches handler
        // The listener expects { payload: { command: '...' } } or just { command: '...' }

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

    /* ───────────────── command doesn't end turn ─────────────────────────── */
    it('re-dispatches core:player_turn_prompt if command succeeds but does not end turn', async () => {
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: false}); // Command continues turn

        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation (dispatches first prompt)

        // Check initial prompt dispatch
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({entityId: actor.id, availableActions: ['look', 'move']})
        );
        // Use mock.calls.length on the specific mock instance
        const initialDispatchCallCount = deps.validatedEventDispatcher.dispatchValidated.mock.calls.length;


        // Simulate command submission
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        await listener({payload: {command: 'examine self'}}); // Trigger the command
        await flush(); // Allow command processing microtasks and potential re-prompt

        // Check command processor call
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'examine self');

        // Check VED dispatch for the CORE prompt event AGAIN
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(initialDispatchCallCount + 1); // Prompted again
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(
            initialDispatchCallCount + 1, // The call after the initial prompt
            'core:player_turn_prompt',
            expect.objectContaining({entityId: actor.id, availableActions: ['look', 'move']}) // Assuming actions rediscovery returns the same
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
        turnPromise.then(() => {
            resolved = true;
        });
        await new Promise(r => setTimeout(r, 10)); // Wait a short moment
        expect(resolved).toBe(false);
    });

    /* ───────────────────────── no active turn ──────────────────────────── */
    it('ignores command if received when not its turn', async () => {
        // DO NOT call handler.handleTurn(actor)

        // Simulate command submission via VED listener attached during setup
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function)); // Ensure listener exists
        await listener({payload: {command: 'attack'}});
        await flush();

        // Verify processor was not called and a warning was logged
        expect(deps.commandProcessor.processCommand).not.toHaveBeenCalled();
        expect(deps.logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/no player turn is active/i),
        );
    });


    /* ───────────────────────── failure path ─────────────────────────────── */
    it('rejects the turn promise, dispatches core events on processCommand error', async () => {
        const boom = new Error('boom');
        deps.commandProcessor.processCommand.mockRejectedValue(boom); // Simulate failure

        const turnPromise = handler.handleTurn(actor);
        await flush(); // Allow initiation (dispatches first prompt)

        const rejectionCheck = expect(turnPromise).rejects.toThrow(boom); // Set up rejection expectation

        // Simulate command submission
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function));
        await listener({payload: {command: 'explode'}}); // Trigger the command that will fail

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
            expect.objectContaining({entityId: actor.id})
        );
    });

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
        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledWith(
            'command:submit',
            expect.any(Function) // Check a function was passed, specific ref might be tricky
        );

        // Check VED dispatch for the CORE turn ended event (should happen on destroy mid-turn)
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            expect.objectContaining({entityId: actor.id})
        );

        // Internal state check (optional, requires exposing state or more side effects)
        // e.g., expect(handler.#currentActor).toBeNull(); // If we could access private field
    });
});
// --- FILE END ---