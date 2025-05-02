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

    // worldContext dependency
    const worldContext = {
        // --- MODIFICATION START (Task 5 - Adjust mock signature) ---
        // Mock expects entity ID (string) now
        getLocationOfEntity: jest.fn().mockResolvedValue({id: 'loc-1'}),
        // --- MODIFICATION END (Task 5 - Adjust mock signature) ---
        getCurrentLocation: jest.fn().mockReturnValue({id: 'current-loc-for-player'})
    };

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
        worldContext,
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

        // Reset specific mocks that accumulate calls across tests if necessary
        deps.validatedEventDispatcher.dispatchValidated.mockClear();
        deps.commandProcessor.processCommand.mockClear();
        deps.actionDiscoverySystem.getValidActions.mockClear();
        deps.worldContext.getLocationOfEntity.mockClear(); // Clear specific mock
        deps.worldContext.getCurrentLocation.mockClear();
        deps.logger.warn.mockClear();
        deps.logger.error.mockClear();

        // Re-establish default mock implementations
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: true});
        deps.actionDiscoverySystem.getValidActions.mockResolvedValue([{id: 'look'}, {id: 'move'}]);
        // --- MODIFICATION START (Task 5 - Ensure mock resets correctly) ---
        deps.worldContext.getLocationOfEntity.mockResolvedValue({id: 'loc-1'});
        // --- MODIFICATION END (Task 5 - Ensure mock resets correctly) ---
        deps.worldContext.getCurrentLocation.mockReturnValue({id: 'current-loc-for-player'});

        // Re-attach listener getter
        const initialListener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        deps.validatedEventDispatcher.getSavedCommandSubmitListener = () => initialListener;
    });

    /* ───────────────────────── constructor ──────────────────────────────── */
    it('stores deps & subscribes to command:submit via VED', () => {
        const freshDeps = makeDeps();
        const freshHandler = new PlayerTurnHandler(freshDeps);
        expect(freshDeps.validatedEventDispatcher.subscribe).toHaveBeenCalledWith('command:submit', expect.any(Function));
        expect(freshDeps.validatedEventDispatcher.getSavedCommandSubmitListener()).toEqual(expect.any(Function));
        expect(freshDeps.eventBus.subscribe).not.toHaveBeenCalled();
        freshHandler.destroy();
    });

    // --- Constructor Dependency Validation Tests ---
    it('throws if logger is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.logger;
        expect(() => new PlayerTurnHandler({...minimalDeps, logger: null})).toThrow(/logger dependency/i);
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
    it('throws if worldContext is missing', () => {
        const minimalDeps = makeDeps();
        delete minimalDeps.worldContext;
        expect(() => new PlayerTurnHandler(minimalDeps)).toThrow(/worldContext/i);
    });
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
        await flush();

        // --- MODIFICATION START (Task 5 - Expect actor.id) ---
        // Check location retrieval with actor ID
        expect(deps.worldContext.getLocationOfEntity).toHaveBeenCalledWith(actor.id);
        // --- MODIFICATION END (Task 5 - Expect actor.id) ---

        const expectedLocation = {id: 'loc-1'}; // From makeDeps mock

        // Check action discovery with the correct context properties
        expect(deps.actionDiscoverySystem.getValidActions).toHaveBeenCalledWith(
            actor,
            expect.objectContaining({
                actingEntity: actor,
                currentLocation: expectedLocation,
                entityManager: deps.entityManager,
                gameDataRepository: deps.gameDataRepository,
                worldContext: deps.worldContext,
                logger: deps.logger
            })
        );

        // Check dispatch for the CORE prompt event
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: actor.id,
                availableActions: ['look', 'move'],
            })
        );

        // Ensure UI events are NOT dispatched
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:update_available_actions', expect.anything());
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.anything());

        // Turn promise should not resolve here yet
        let resolved = false;
        turnPromise.then(() => {
            resolved = true;
        });
        await new Promise(r => setTimeout(r, 5));
        expect(resolved).toBe(false);
    });

    /* ───────────────────────── happy path ───────────────────────────────── */
    it('processes a submitted command, resolves turn promise, dispatches core:turn_ended', async () => {
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: true});

        const turnPromise = handler.handleTurn(actor);
        await flush();

        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function));
        await listener({payload: {command: 'look'}});

        await expect(turnPromise).resolves.toBeUndefined();

        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'look');

        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended', expect.objectContaining({entityId: actor.id})
        );

        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.anything());
    });

    /* ───────────────── command doesn't end turn ─────────────────────────── */
    it('re-dispatches core:player_turn_prompt if command succeeds but does not end turn', async () => {
        deps.commandProcessor.processCommand.mockResolvedValue({success: true, turnEnded: false});

        const turnPromise = handler.handleTurn(actor);
        await flush();

        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({entityId: actor.id, availableActions: ['look', 'move']})
        );
        const initialDispatchCallCount = deps.validatedEventDispatcher.dispatchValidated.mock.calls.length;

        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        await listener({payload: {command: 'examine self'}});
        await flush();

        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'examine self');

        // --- MODIFICATION START (Task 5 - Check worldContext mock call on re-prompt) ---
        // Ensure location is fetched again with ID on re-prompt
        expect(deps.worldContext.getLocationOfEntity).toHaveBeenCalledTimes(2); // Initial + Re-prompt
        expect(deps.worldContext.getLocationOfEntity).toHaveBeenNthCalledWith(2, actor.id);
        // --- MODIFICATION END (Task 5 - Check worldContext mock call on re-prompt) ---

        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(initialDispatchCallCount + 1);
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(
            initialDispatchCallCount + 1,
            'core:player_turn_prompt',
            expect.objectContaining({entityId: actor.id, availableActions: ['look', 'move']})
        );

        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.anything());
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:enable_input', expect.anything());

        let resolved = false;
        turnPromise.then(() => {
            resolved = true;
        });
        await new Promise(r => setTimeout(r, 10));
        expect(resolved).toBe(false);
    });

    /* ───────────────────────── no active turn ──────────────────────────── */
    it('ignores command if received when not its turn', async () => {
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function));
        await listener({payload: {command: 'attack'}});
        await flush();

        expect(deps.commandProcessor.processCommand).not.toHaveBeenCalled();
        expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/no player turn is active/i));
    });


    /* ───────────────────────── failure path ─────────────────────────────── */
    it('rejects the turn promise, dispatches core events on processCommand error', async () => {
        const boom = new Error('boom');
        deps.commandProcessor.processCommand.mockRejectedValue(boom);

        const turnPromise = handler.handleTurn(actor);
        await flush();

        const rejectionCheck = expect(turnPromise).rejects.toThrow(boom);

        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(listener).toEqual(expect.any(Function));
        await listener({payload: {command: 'explode'}});

        await rejectionCheck;

        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:disable_input', expect.anything());
        expect(deps.validatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.anything());

        expect(deps.logger.error).toHaveBeenCalledWith(
            expect.stringMatching(/CRITICAL error during command processing/i),
            boom
        );

        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:system_error_occurred',
            expect.objectContaining({
                message: expect.stringContaining(`processing command for ${actor.id}`),
                type: 'error',
                details: boom.message
            })
        );

        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            expect.objectContaining({entityId: actor.id})
        );
    });

    /* ───────────────────────── cleanup ──────────────────────────────────── */
    it('unsubscribes & resets state on destroy()', () => {
        const expectedListener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(expectedListener).toEqual(expect.any(Function));

        handler.destroy();

        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledWith('command:submit', expectedListener);
        expect(deps.eventBus.unsubscribe).not.toHaveBeenCalled();

        const currentCallCount = deps.validatedEventDispatcher.unsubscribe.mock.calls.length;
        handler.destroy();
        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledTimes(currentCallCount);
    });

    it('cleans up, rejects promise, dispatches core:turn_ended if destroyed mid-turn', async () => {
        const turnPromise = handler.handleTurn(actor);
        await flush();

        const rejectionCheck = expect(turnPromise).rejects.toThrow(/destroyed during turn/i);

        handler.destroy();

        await rejectionCheck;

        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledWith('command:submit', expect.any(Function));

        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            expect.objectContaining({entityId: actor.id})
        );
    });
});
// --- FILE END ---