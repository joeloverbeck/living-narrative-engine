/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {makeDeps} from './__utils__/playerTurnHandlerTestUtils.js';

describe('PlayerTurnHandler – constructor & dependency validation', () => {
    let deps;

    beforeEach(() => {
        jest.clearAllMocks();
        deps = makeDeps();
    });

    it('stores deps & subscribes to command:submit via VED', () => {
        const handler = new PlayerTurnHandler(deps);
        expect(deps.validatedEventDispatcher.subscribe)
            .toHaveBeenCalledWith('command:submit', expect.any(Function));
        expect(deps.validatedEventDispatcher.getSavedCommandSubmitListener())
            .toEqual(expect.any(Function));
        expect(deps.eventBus.subscribe).not.toHaveBeenCalled();
        handler.destroy();
    });

    it('throws if logger is missing', () => {
        const minimal = makeDeps();
        delete minimal.logger;
        expect(() => new PlayerTurnHandler({...minimal, logger: null}))
            .toThrow(/logger dependency/i);
    });
    it('throws if actionDiscoverySystem is missing', () => {
        const minimal = makeDeps();
        delete minimal.actionDiscoverySystem;
        expect(() => new PlayerTurnHandler(minimal)).toThrow(/actionDiscoverySystem/i);
    });
    it('throws if validatedEventDispatcher is missing', () => {
        const minimal = makeDeps();
        delete minimal.validatedEventDispatcher;
        expect(() => new PlayerTurnHandler(minimal)).toThrow(/validatedEventDispatcher/i);
    });
    it('throws if commandProcessor is missing', () => {
        const minimal = makeDeps();
        delete minimal.commandProcessor;
        expect(() => new PlayerTurnHandler(minimal)).toThrow(/commandProcessor/i);
    });
    it('throws if worldContext is missing', () => {
        const minimal = makeDeps();
        delete minimal.worldContext;
        expect(() => new PlayerTurnHandler(minimal)).toThrow(/worldContext/i);
    });
    it('throws if entityManager is missing', () => {
        const minimal = makeDeps();
        delete minimal.entityManager;
        expect(() => new PlayerTurnHandler(minimal)).toThrow(/entityManager/i);
    });
    it('throws if gameDataRepository is missing', () => {
        const minimal = makeDeps();
        delete minimal.gameDataRepository;
        expect(() => new PlayerTurnHandler(minimal)).toThrow(/gameDataRepository/i);
    });
});