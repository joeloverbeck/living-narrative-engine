/* eslint-env jest */

import {jest} from '@jest/globals';
import Entity from '../../../../entities/entity.js';

// ────────────────────────────────────────────────────────────────────────────
// tiny helper – give the micro-task queue a chance to run
export const flush = () => new Promise(r => setTimeout(r, 0));
// ────────────────────────────────────────────────────────────────────────────

export const makeDeps = () => {
    let savedVedListener = null;

    const logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};

    const actionDiscoverySystem = {
        getValidActions: jest.fn().mockResolvedValue([{id: 'look'}, {id: 'move'}]),
    };

    const validatedEventDispatcher = {
        dispatchValidated: jest.fn().mockResolvedValue(true),
        subscribe: jest.fn((evt, fn) => {
            if (evt === 'core:submit_command') savedVedListener = fn;
        }),
        unsubscribe: jest.fn(),
        getSavedCommandSubmitListener: () => savedVedListener,
    };

    const commandProcessor = {
        processCommand: jest.fn().mockResolvedValue({success: true, turnEnded: true}),
    };

    const worldContext = {
        getLocationOfEntity: jest.fn().mockResolvedValue({id: 'loc-1'}),
        getCurrentLocation: jest.fn().mockReturnValue({id: 'current-loc-for-player'}),
    };

    const entityManager = {
        getEntityInstance: jest.fn().mockReturnValue(new Entity('default-entity')),
    };

    const gameDataRepository = {
        getActionDefinition: jest.fn().mockReturnValue({id: 'action-def-look'}),
    };

    const eventBus = {subscribe: jest.fn(), unsubscribe: jest.fn()};

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

export const makeActor = (id = 'player-1') => new Entity(id);