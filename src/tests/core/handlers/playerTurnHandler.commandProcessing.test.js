// src/tests/core/handlers/playerTurnHandler.commandProcessing.test.js

/* eslint-env jest */

// Import afterEach from @jest/globals (assuming it's needed, keep if present)
import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {makeDeps, makeActor, flush} from './__utils__/playerTurnHandlerTestUtils.js';

describe('PlayerTurnHandler – command processing & happy paths', () => {
    let deps, handler, actor, turnPromise;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = makeDeps();
        handler = new PlayerTurnHandler(deps);
        actor = makeActor();
        turnPromise = null;
    });

    // Keep afterEach if it was added previously for cleanup consistency
    afterEach(async () => {
        if (handler) {
            handler.destroy();
            if (turnPromise) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    await turnPromise;
                } catch (e) {
                    if (e && e.message !== 'PlayerTurnHandler destroyed during turn.' && !e.message?.includes('already settled')) {
                        console.warn("afterEach caught unexpected error from turnPromise:", e);
                    }
                }
            }
        }
        handler = null;
        turnPromise = null;
    });


    it('resolves on a successful command that ends the turn', async () => {
        turnPromise = handler.handleTurn(actor);
        await flush();
        const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        await submit({payload: {command: 'look'}});
        await expect(turnPromise).resolves.toBeUndefined();
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'look');
    });

    it('…success:false turnEnded:true still resolves', async () => {
        deps.commandProcessor.processCommand.mockResolvedValue({success: false, turnEnded: true});
        turnPromise = handler.handleTurn(actor);
        await flush();
        const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        await submit({payload: {command: 'fail_end'}});
        await expect(turnPromise).resolves.toBeUndefined();
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, 'fail_end');
    });

    const rePromptCase = (label, resultObj, cmd) =>
        it(`re-prompts (${label})`, async () => {
            deps.commandProcessor.processCommand.mockResolvedValue(resultObj);
            turnPromise = handler.handleTurn(actor);
            await flush(); // Initial prompt
            deps.validatedEventDispatcher.dispatchValidated.mockClear(); // Clear initial prompt call
            const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
            await submit({payload: {command: cmd}});
            await flush(); // Allow command processing and re-prompt logic

            expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(actor, cmd);
            expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:player_turn_prompt',
                expect.objectContaining({entityId: actor.id})
            );
            expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Only the re-prompt

            let resolved = false, rejected = false;
            turnPromise.then(() => {
                resolved = true;
            }).catch(() => {
                rejected = true;
            });
            await new Promise(r => setTimeout(r, 5));
            expect(resolved).toBe(false);
            expect(rejected).toBe(false);
        });

    rePromptCase('success:true turnEnded:false', {success: true, turnEnded: false}, 'examine self');
    rePromptCase('success:false turnEnded:false', {success: false, turnEnded: false}, 'fail_continue');

    it('empty / whitespace commands cause a re-prompt without processing', async () => {
        turnPromise = handler.handleTurn(actor);
        await flush(); // Initial prompt
        deps.validatedEventDispatcher.dispatchValidated.mockClear();
        deps.commandProcessor.processCommand.mockClear();
        const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        await submit({payload: {command: ''}});
        await flush();
        await submit({payload: {command: '   '}});
        await flush();

        expect(deps.commandProcessor.processCommand).not.toHaveBeenCalled();
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({entityId: actor.id})
        );
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);

        let resolved = false, rejected = false;
        turnPromise.then(() => {
            resolved = true;
        }).catch(() => {
            rejected = true;
        });
        await new Promise(r => setTimeout(r, 5));
        expect(resolved).toBe(false);
        expect(rejected).toBe(false);
    });

    it('ignores command if no turn active', async () => {
        const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        expect(submit).toBeDefined();
        await submit({payload: {command: 'attack'}});
        await flush();
        expect(deps.commandProcessor.processCommand).not.toHaveBeenCalled();
        expect(deps.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/no player turn is active/i));
    });

    // Renamed test for clarity
    it('processes commands sequentially when one causes a re-prompt', async () => {
        // Mock command processor
        deps.commandProcessor.processCommand
            .mockResolvedValueOnce({success: true, turnEnded: false})  // First command -> re-prompt
            .mockResolvedValueOnce({success: true, turnEnded: true});   // Second command -> end turn

        turnPromise = handler.handleTurn(actor);
        await flush(); // Initial prompt

        deps.validatedEventDispatcher.dispatchValidated.mockClear(); // Clear initial prompt call

        const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();

        // --- Submit and process first command ---
        await submit({payload: {command: 'first'}});
        // Wait for the command processing AND the subsequent re-prompt dispatch to occur
        await flush(); // Give microtasks a chance to run (processing + prompt dispatch)
        // --- End first command ---

        // Assertions after first command:
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledTimes(1);
        expect(deps.commandProcessor.processCommand).toHaveBeenNthCalledWith(1, actor, 'first');
        // Check that the re-prompt happened *after* mockClear
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({entityId: actor.id})
        );
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // Only the re-prompt call so far

        // --- Submit second command ---
        await submit({payload: {command: 'second'}});
        // Wait for the overall turn promise to resolve (which happens after this second command)
        await expect(turnPromise).resolves.toBeUndefined();
        // Optional flush after turn resolves, before final assertions on dispatched events
        await flush();
        // --- End second command ---


        // Final Assertions:
        expect(deps.commandProcessor.processCommand).toHaveBeenCalledTimes(2); // Both commands processed
        expect(deps.commandProcessor.processCommand).toHaveBeenNthCalledWith(2, actor, 'second');

        // Check dispatch calls *after* mockClear:
        // Re-check prompt was called (it should still be in the mock history)
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({entityId: actor.id})
        );
        const promptCalls = deps.validatedEventDispatcher.dispatchValidated.mock.calls.filter(
            call => call[0] === 'core:player_turn_prompt'
        );
        expect(promptCalls.length).toBe(1); // Still expect only one re-prompt

        // Check Turn ended was called once (after the second command)
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            expect.objectContaining({entityId: actor.id})
        );
        const turnEndedCalls = deps.validatedEventDispatcher.dispatchValidated.mock.calls.filter(
            call => call[0] === 'core:turn_ended'
        );
        expect(turnEndedCalls.length).toBe(1); // Expect one turn_ended call

        // Overall dispatch calls after mockClear should be 2 (1 prompt + 1 turn_ended)
        expect(deps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledTimes(2);
    });
});