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
    worldContext: {
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
     *  Constructor tests
     * ------------------------------------------------------------------ */
    describe('Constructor', () => {
        it('should throw an error if logger is missing', () => {
            const deps = createMockDeps();
            delete deps.logger;
            expect(() => new AITurnHandler(deps)).toThrow(/logger instance/);
        });

        it('should throw an error if logger is invalid (missing methods)', () => {
            const deps = createMockDeps();
            deps.logger = {debug: jest.fn()};
            expect(() => new AITurnHandler(deps)).toThrow(/logger instance/);
        });

        it('should throw an error if commandProcessor is missing', () => {
            const deps = createMockDeps();
            delete deps.commandProcessor;
            expect(() => new AITurnHandler(deps)).toThrow(/commandProcessor instance/);
        });

        it('should throw an error if commandProcessor is invalid (missing method)', () => {
            const deps = createMockDeps();
            deps.commandProcessor = {};
            expect(() => new AITurnHandler(deps)).toThrow(/commandProcessor instance/);
        });

        it('should throw an error if validatedEventDispatcher is missing', () => {
            const deps = createMockDeps();
            delete deps.validatedEventDispatcher;
            expect(() => new AITurnHandler(deps)).toThrow(/validatedEventDispatcher instance/);
        });

        it('should throw an error if validatedEventDispatcher is invalid (missing method)', () => {
            const deps = createMockDeps();
            deps.validatedEventDispatcher = {};
            expect(() => new AITurnHandler(deps)).toThrow(/validatedEventDispatcher instance/);
        });

        it('should throw an error if worldContext is missing', () => {
            const deps = createMockDeps();
            delete deps.worldContext;
            expect(() => new AITurnHandler(deps)).toThrow(/worldContext instance/);
        });

        it('should throw an error if worldContext is invalid (missing method)', () => {
            const deps = createMockDeps();
            deps.worldContext = {};
            expect(() => new AITurnHandler(deps)).toThrow(/worldContext instance/);
        });

        it('should store valid dependencies and log initialization', () => {
            expect(mockDeps.logger.info).toHaveBeenCalledWith('AITurnHandler initialized.');
        });

        it('should accept an optional actionDiscoverySystem without error', () => {
            expect(() => handler).not.toThrow();
        });

        it('should warn if optional actionDiscoverySystem is invalid', () => {
            const depsWithInvalidADS = createMockDeps();
            depsWithInvalidADS.actionDiscoverySystem = {someOtherMethod: jest.fn()};
            new AITurnHandler(depsWithInvalidADS);    // eslint-disable-line no-new
            expect(depsWithInvalidADS.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('actionDiscoverySystem is invalid')
            );
        });
    });

    /* ------------------------------------------------------------------ *
     *  handleTurn happy-path tests
     * ------------------------------------------------------------------ */
    describe('handleTurn Method', () => {
        it('logs turn start', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                `Starting AI turn processing for actor: ${mockActor.id}`
            );
        });

        it('dispatches core:ai_turn_processing_started', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.validatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
                'core:ai_turn_processing_started',
                {entityId: mockActor.id}
            );
        });

        it('calls worldContext.getLocationOfEntity', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.worldContext.getLocationOfEntity).toHaveBeenCalledWith(mockActor.id);
        });

        it('falls back to "wait" command when no actions returned', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.commandProcessor.processCommand).toHaveBeenCalledWith(mockActor, 'wait');
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                `AI actor ${mockActor.id} determined command: "wait"`
            );
        });

        it('logs processing of the command', async () => {
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                `AITurnHandler: Processing command 'wait' for actor ${mockActor.id} via CommandProcessor.`
            );
        });

        it('warns if command succeeded but did not end turn', async () => {
            mockDeps.commandProcessor.processCommand.mockResolvedValue({
                success: true,
                turnEnded: false,
                actionResult: {}
            });
            await handler.handleTurn(mockActor);
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('did not end turn according to CommandResult')
            );
        });

        it('handles invalid actor gracefully', async () => {
            await expect(handler.handleTurn(null)).rejects.toThrow('AITurnHandler: Actor must be a valid entity.');
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'AITurnHandler: Attempted to handle turn for an invalid actor.'
            );
            expect(mockDeps.commandProcessor.processCommand).not.toHaveBeenCalled();
        });
    });

    /* ------------------------------------------------------------------ *
     *  New Ticket 6.2.3 tests
     * ------------------------------------------------------------------ */
    describe('AI action determination & error scenarios', () => {
        it('uses ActionDiscoverySystem result and prefers "core:wait" when present', async () => {
            const deps = createMockDeps();
            deps.actionDiscoverySystem.getValidActions.mockResolvedValue([
                {id: 'move_north'},
                {id: 'core:wait'},       // should be selected even though not first
                {id: 'attack'}
            ]);
            const localHandler = new AITurnHandler(deps);

            await localHandler.handleTurn(mockActor);

            expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(mockActor, 'core:wait');
            expect(deps.logger.debug).toHaveBeenCalledWith(
                `AI actor ${mockActor.id} determined command: "core:wait"`
            );
        });

        it('picks first returned action if "core:wait" is absent', async () => {
            const deps = createMockDeps();
            deps.actionDiscoverySystem.getValidActions.mockResolvedValue([
                {id: 'move_east'},
                {id: 'attack'}
            ]);
            const localHandler = new AITurnHandler(deps);

            await localHandler.handleTurn(mockActor);

            expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(mockActor, 'move_east');
            expect(deps.logger.debug).toHaveBeenCalledWith(
                `AI actor ${mockActor.id} determined command: "move_east"`
            );
        });

        it('falls back to "wait" if actionDiscoverySystem.getValidActions rejects', async () => {
            const deps = createMockDeps();
            deps.actionDiscoverySystem.getValidActions.mockRejectedValue(new Error('DB offline'));
            const localHandler = new AITurnHandler(deps);

            await localHandler.handleTurn(mockActor);

            expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(mockActor, 'wait');
            expect(deps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`AI ${mockActor.id} failed during action discovery:`),
                expect.any(Error)
            );
        });

        it('falls back to "wait" if worldContext.getLocationOfEntity throws', async () => {
            const deps = createMockDeps();
            deps.worldContext.getLocationOfEntity.mockRejectedValue(new Error('WorldCTX failure'));
            const localHandler = new AITurnHandler(deps);

            await localHandler.handleTurn(mockActor);

            expect(deps.commandProcessor.processCommand).toHaveBeenCalledWith(mockActor, 'wait');
            expect(deps.logger.error).toHaveBeenCalledWith(
                expect.stringContaining(`AI ${mockActor.id} failed during action discovery:`),
                expect.any(Error)
            );
        });
    });

    describe('CommandProcessor failure paths', () => {
        it('logs a warning when CommandProcessor.processCommand returns success:false', async () => {
            const deps = createMockDeps();
            deps.commandProcessor.processCommand.mockResolvedValue({
                success: false,
                turnEnded: true,
                error: 'Bad things',
                internalError: null,
                actionResult: {}
            });
            const localHandler = new AITurnHandler(deps);

            await localHandler.handleTurn(mockActor);

            expect(deps.logger.warn).toHaveBeenCalledWith(
                `AITurnHandler: Command failed for AI actor ${mockActor.id}. See previous logs/events for details.`
            );
        });
    });

    /* ------------------------------------------------------------------ *
     *  Event-dispatch error handling (already covered above) is unchanged
     * ------------------------------------------------------------------ */
});