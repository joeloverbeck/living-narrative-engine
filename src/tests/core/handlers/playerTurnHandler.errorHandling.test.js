/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {makeDeps, makeActor, flush} from './__utils__/playerTurnHandlerTestUtils.js';

describe('PlayerTurnHandler – critical & error paths', () => {
    let deps, handler, actor, turnPromise;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = makeDeps();
        handler = new PlayerTurnHandler(deps);
        actor = makeActor();
        turnPromise = null;
    });

    it('rejects on command-processing critical error', async () => {
        const boom = new Error('boom');
        deps.commandProcessor.processCommand.mockRejectedValue(boom);
        turnPromise = handler.handleTurn(actor);
        await flush();
        const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        const rejectCheck = expect(turnPromise).rejects.toThrow(boom);
        await submit({payload: {command: 'explode'}});
        await rejectCheck;
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('core:turn_ended', expect.anything());
    });

    // …(all the other error-path assertions from the original file, unchanged)…
});