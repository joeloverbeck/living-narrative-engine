// src/tests/core/handlers/playerTurnHandler.turnInitiation.test.js

/* eslint-env jest */

// Import afterEach from @jest/globals
import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {makeDeps, makeActor, flush} from './__utils__/playerTurnHandlerTestUtils.js';

describe('PlayerTurnHandler – turn initiation & first prompt', () => {
    let deps, handler, actor, turnPromise;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = makeDeps();
        handler = new PlayerTurnHandler(deps);
        actor = makeActor();
        turnPromise = null; // Initialize turnPromise
    });

    // --- ADDED Standard afterEach Hook for Cleanup ---
    afterEach(async () => {
        if (handler) {
            handler.destroy();
            // Handle potential rejection from destroy() if turnPromise was left pending
            if (turnPromise) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 0)); // Allow microtasks
                    await turnPromise;
                } catch (e) {
                    // Ignore the expected "destroyed during turn" error during cleanup
                    if (e && e.message !== 'PlayerTurnHandler destroyed during turn.' && !e.message?.includes('already settled')) {
                        console.warn("afterEach caught unexpected error from turnPromise:", e);
                    }
                }
            }
        }
        handler = null;
        turnPromise = null;
    });
    // --- END afterEach Hook ---


    it('discovers actions & dispatches core:player_turn_prompt when a turn starts', async () => {
        // REMOVED try...finally block

        turnPromise = handler.handleTurn(actor); // Assign to suite-level variable
        await flush(); // Allow prompt logic to run

        // Assertions about initial prompt
        expect(deps.worldContext.getLocationOfEntity)
            .toHaveBeenCalledWith(actor.id);
        expect(deps.actionDiscoverySystem.getValidActions)
            .toHaveBeenCalledWith(actor, expect.anything());
        // Check the specific prompt event was dispatched
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('core:player_turn_prompt', expect.objectContaining({
                entityId: actor.id,
                availableActions: expect.any(Array)
            }));

        // Check promise stays pending (before afterEach runs)
        let resolved = false;
        let rejected = false;
        // Use a flag-based check which is less prone to race conditions than awaiting inside the test
        turnPromise.then(() => {
            resolved = true;
        }).catch(() => {
            rejected = true;
        });

        await new Promise(r => setTimeout(r, 5)); // Give promise time to potentially settle (it shouldn't)
        expect(resolved).toBe(false);
        expect(rejected).toBe(false); // Should not have resolved or rejected yet

        // afterEach will now handle cleanup and the expected rejection from destroy()
    });

    it('rejects if getLocationOfEntity fails', async () => {
        const err = new Error('No location');
        deps.worldContext.getLocationOfEntity.mockRejectedValue(err);

        // Assign turnPromise here to allow afterEach cleanup if needed,
        // although handleTurn should reject directly.
        turnPromise = handler.handleTurn(actor);

        // Expect the promise returned by handleTurn to reject
        await expect(turnPromise).rejects.toThrow(err);

        // Check turn_ended was dispatched during the rejection handling inside handleTurn's catch block
        // Need await flush() to ensure microtasks like dispatchValidated complete after rejection
        await flush();
        // Verify turn_ended was dispatched as part of the handler's internal error handling
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('core:turn_ended', expect.objectContaining({entityId: actor.id}));

        // REMOVED handler.destroy(); - afterEach handles it
    });

    it('rejects if getValidActions fails', async () => {
        const err = new Error('Discovery fail');
        deps.actionDiscoverySystem.getValidActions.mockRejectedValue(err);

        turnPromise = handler.handleTurn(actor); // Assign for potential cleanup

        // Expect the promise returned by handleTurn to reject
        await expect(turnPromise).rejects.toThrow(err);

        // Check turn_ended was dispatched as part of the handler's internal error handling
        await flush();
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('core:turn_ended', expect.objectContaining({entityId: actor.id}));


        // REMOVED handler.destroy(); - afterEach handles it
    });

    it('rejects if core:player_turn_prompt dispatch fails', async () => {
        const err = new Error('Dispatch fail');
        deps.validatedEventDispatcher.dispatchValidated
            .mockImplementation(async (evt, payload) => { // Use more specific mock
                if (evt === 'core:player_turn_prompt') {
                    throw err; // Throw only for the prompt event
                }
                // Allow other events like 'core:turn_ended' to potentially pass through
                // This mock implicitly returns undefined if not the prompt event, which is fine for VED typically.
                // If VED expects a boolean, return true here: return true;
            });

        turnPromise = handler.handleTurn(actor); // Assign for potential cleanup

        // Expect the promise returned by handleTurn to reject
        await expect(turnPromise).rejects.toThrow(err);

        // Check turn_ended was dispatched as part of the handler's internal error handling
        await flush();
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('core:turn_ended', expect.objectContaining({entityId: actor.id}));

        // REMOVED handler.destroy(); - afterEach handles it
    });
});