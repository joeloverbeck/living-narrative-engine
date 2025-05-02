/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {makeDeps, makeActor, flush} from './__utils__/playerTurnHandlerTestUtils.js';

describe('PlayerTurnHandler – handleTurn validation', () => {
    let deps, handler, actor, turnPromise;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = makeDeps();
        handler = new PlayerTurnHandler(deps);
        actor = makeActor();
        turnPromise = null;
    });

    it('throws if handleTurn is called with null actor', async () => {
        await expect(handler.handleTurn(null))
            .rejects.toThrow(/Actor must be a valid entity/i);
        handler.destroy();
    });

    it('throws if handleTurn is called with an empty object actor', async () => {
        await expect(handler.handleTurn({}))
            .rejects.toThrow(/Actor must be a valid entity/i);
        handler.destroy();
    });

    it('throws if handleTurn is called with an actor with null ID', async () => {
        await expect(handler.handleTurn({id: null}))
            .rejects.toThrow(/Actor must be a valid entity/i);
        handler.destroy();
    });

    it('throws if handleTurn is called with an actor without an ID', async () => {
        await expect(handler.handleTurn({name: 'No-Id'}))
            .rejects.toThrow(/Actor must be a valid entity/i);
        handler.destroy();
    });

    it('throws if handleTurn is called while another turn is in progress', async () => {
        turnPromise = handler.handleTurn(actor);
        await flush();
        await expect(handler.handleTurn(makeActor('player-2')))
            .rejects.toThrow(/turn for player-1 is already in progress/i);
        handler.destroy();
        await expect(turnPromise).rejects.toThrow();
    });
});