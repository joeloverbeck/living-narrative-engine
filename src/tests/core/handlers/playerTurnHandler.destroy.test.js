/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {makeDeps, makeActor, flush} from './__utils__/playerTurnHandlerTestUtils.js';

describe('PlayerTurnHandler – destroy & cleanup', () => {
    let deps, handler, actor, turnPromise;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = makeDeps();
        handler = new PlayerTurnHandler(deps);
        actor = makeActor();
        turnPromise = null;
    });

    it('unsubscribes & is idempotent when no turn active', () => {
        const listener = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        handler.destroy();
        if (listener) expect(deps.validatedEventDispatcher.unsubscribe)
            .toHaveBeenCalledWith('command:submit', listener);
        const calls = deps.validatedEventDispatcher.unsubscribe.mock.calls.length;
        handler.destroy();
        expect(deps.validatedEventDispatcher.unsubscribe).toHaveBeenCalledTimes(calls);
    });

    it('rejects promise & dispatches core:turn_ended if destroyed mid-turn', async () => {
        turnPromise = handler.handleTurn(actor);
        await flush();
        const rejectCheck = expect(turnPromise).rejects.toThrow(/destroyed during turn/i);
        handler.destroy();
        await rejectCheck;
        expect(deps.validatedEventDispatcher.dispatchValidated)
            .toHaveBeenCalledWith('core:turn_ended', expect.anything());
    });

    it('handles destroy() during a long running command', async () => {
        deps.commandProcessor.processCommand.mockImplementation(async () => {
            await new Promise(r => setTimeout(r, 20));
            return {success: true, turnEnded: true};
        });
        turnPromise = handler.handleTurn(actor);
        await flush();
        const submit = deps.validatedEventDispatcher.getSavedCommandSubmitListener();
        const listenerPromise = submit({payload: {command: 'long'}});
        await new Promise(r => setTimeout(r, 5));
        const rejectCheck = expect(turnPromise).rejects.toThrow(/destroyed during turn/i);
        handler.destroy();
        await rejectCheck;
        await listenerPromise.catch(() => {
        });
    });
});