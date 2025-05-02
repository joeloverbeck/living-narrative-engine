// src/tests/core/handlers/aiTurnHandler.initialization.test.js

/* eslint-env jest */

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import AITurnHandler from '../../../core/handlers/aiTurnHandler.js';
import Entity from '../../../entities/entity.js';

/**
 * Helper that creates a fresh mock-dependency bundle.
 * Individual tests can freely mutate/overwrite any mock before
 * instantiating AITurnHandler.
 */
const createMockDeps = () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    commandProcessor: {
        processCommand: jest.fn().mockResolvedValue({
            success: true,
            message: 'Wait successful',
            turnEnded: true,
            error: null,
            internalError: null,
            actionResult: {type: 'wait', status: 'completed'}
        }),
    },
    validatedEventDispatcher: {
        dispatchValidated: jest.fn().mockResolvedValue(undefined),
    },
    worldContext: { // Mock worldContext is included here
        getLocationOfEntity: jest.fn().mockResolvedValue({id: 'ai-loc-1'}),
    },
    actionDiscoverySystem: {
        getValidActions: jest.fn().mockResolvedValue([]),
    },
});

const createMockActor = (id = 'ai-actor-1') => new Entity(id);

describe('AITurnHandler', () => {
    let mockDeps;
    let mockActor;
    let handler;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDeps = createMockDeps();
        mockActor = createMockActor();
        handler = new AITurnHandler(mockDeps);
    });

    /* ------------------------------------------------------------------ *
     * Constructor tests
     * ------------------------------------------------------------------ */
    describe('Constructor', () => {
        // Tests specifically for worldContext dependency:
        it('should throw an error if worldContext is missing', () => { //
            const deps = createMockDeps();
            delete deps.worldContext; // Remove the dependency
            expect(() => new AITurnHandler(deps)).toThrow(/worldContext instance/); //
        });

        it('should throw an error if worldContext is invalid (missing method)', () => { //
            const deps = createMockDeps();
            deps.worldContext = {}; // Provide an invalid object
            expect(() => new AITurnHandler(deps)).toThrow(/worldContext instance/); //
            // This specifically tests the 'getLocationOfEntity' check:
            deps.worldContext = {someOtherMethod: jest.fn()};
            expect(() => new AITurnHandler(deps)).toThrow(/worldContext instance/); //
        });

        it('should store valid dependencies and log initialization', () => { //
            // This test implicitly passes if worldContext is provided correctly
            expect(() => handler).not.toThrow(); //
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.'); //
        });

    });

    /* ------------------------------------------------------------------ *
     * handleTurn happy-path tests
     * ------------------------------------------------------------------ */
    describe('handleTurn Method', () => {

        it('calls worldContext.getLocationOfEntity', async () => { //
            await handler.handleTurn(mockActor);
            expect(mockDeps.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id); //
        });
    });
});