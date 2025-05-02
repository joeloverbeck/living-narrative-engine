// src/tests/core/turnManager.advanceTurn.actorIdentification.test.js
// --- FILE START (Corrected) ---

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';
import TurnManager from '../../core/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../types/components.js';

// --- Mock Dependencies ---
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDispatcher = {
    dispatch: jest.fn(), // Keep if used elsewhere
    dispatchValidated: jest.fn().mockResolvedValue(true),
};

const mockEntityManager = {
    activeEntities: new Map(),
    getEntityInstance: jest.fn(), // Checked by constructor
    // Keep other mocks if needed
};

const mockTurnOrderService = {
    startNewRound: jest.fn(),
    getNextEntity: jest.fn(),
    isEmpty: jest.fn(),
    getCurrentOrder: jest.fn(),
    removeEntity: jest.fn(),
    addEntity: jest.fn(),
    clearCurrentRound: jest.fn(),
};

// Mock Turn Handler
const mockTurnHandler = {
    constructor: {name: 'MockTurnHandler'}, // For logging checks
    handleTurn: jest.fn().mockResolvedValue(undefined),
};

const mockTurnHandlerResolver = {
    resolveHandler: jest.fn(),
};
// --- END FIXED MOCKS ---

// Helper to create mock entities
const createMockEntity = (id, isActor = true, isPlayer = false) => ({
    id: id,
    hasComponent: jest.fn((componentId) => {
        if (componentId === ACTOR_COMPONENT_ID) return isActor;
        if (componentId === PLAYER_COMPONENT_ID) return isPlayer;
        return false;
    }),
});

// --- Test Suite ---

describe('TurnManager: advanceTurn() - Actor Identification & Handling (Queue Not Empty)', () => {
    let instance;
    let stopSpy;
    let initialAdvanceTurnSpy;

    beforeEach(async () => {
        jest.clearAllMocks();

        // --- Reset Mocks ---
        mockEntityManager.activeEntities = new Map();
        mockTurnOrderService.isEmpty.mockResolvedValue(false); // Default: Queue NOT empty
        mockTurnOrderService.getNextEntity.mockResolvedValue(null);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnOrderService.clearCurrentRound.mockResolvedValue(); // Async if needed

        mockTurnHandler.handleTurn.mockClear().mockResolvedValue(undefined);
        mockTurnHandlerResolver.resolveHandler.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler); // Default return

        instance = new TurnManager({
            logger: mockLogger,
            dispatcher: mockDispatcher,
            entityManager: mockEntityManager,
            turnOrderService: mockTurnOrderService,
            turnHandlerResolver: mockTurnHandlerResolver
        });

        stopSpy = jest.spyOn(instance, 'stop').mockImplementation(async () => {});

        // --- Set instance to running state (suppressing initial advanceTurn) ---
        initialAdvanceTurnSpy = jest.spyOn(instance, 'advanceTurn').mockImplementationOnce(async () => {});
        await instance.start();
        initialAdvanceTurnSpy.mockRestore();

        // --- Clear mocks called during setup ---
        mockLogger.info.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockDispatcher.dispatchValidated.mockClear();
        mockTurnOrderService.isEmpty.mockClear();
        mockTurnOrderService.getNextEntity.mockClear();
        mockTurnHandlerResolver.resolveHandler.mockClear();
        mockTurnHandler.handleTurn.mockClear();

        // Re-apply default mocks needed for tests in this block
        mockTurnOrderService.isEmpty.mockResolvedValue(false);
        mockDispatcher.dispatchValidated.mockResolvedValue(true);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);
        mockTurnHandler.handleTurn.mockResolvedValue(undefined);
    });

    afterEach(() => {
        if (stopSpy) stopSpy.mockRestore();
        // initialAdvanceTurnSpy is restored in beforeEach
        instance = null;
    });

    // --- Updated Test Cases ---

    test('Player actor identified: resolves handler, calls handleTurn', async () => {
        // Arrange
        const playerActor = createMockEntity('player-1', true, true); // isPlayer = true
        const entityType = 'player'; // Define expected type
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);

        // Act
        await instance.advanceTurn();

        // Assert
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        // --- FIX START: Correct log message format ---
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${playerActor.id} (${entityType}) <<<`);
        // --- FIX END ---
        expect(mockLogger.debug).toHaveBeenCalledWith(`Resolving turn handler for entity ${playerActor.id}...`);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('identified as type:'));
        // Verify resolver call
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(playerActor);
        // Verify handler call
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Calling handleTurn on ${mockTurnHandler.constructor.name}`));
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(playerActor);
        // --- FIX START: Correct log message for handleTurn completion ---
        // Note: The code actually logs "handleTurn promise resolved..." now.
        // If the handler calls advanceTurn, further logs would appear AFTER this promise resolves.
        // This assertion checks that the promise resolution was logged *before* waiting for advanceTurn.
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`handleTurn promise resolved for ${mockTurnHandler.constructor.name} for entity ${playerActor.id}`));
        // --- FIX END ---
        expect(stopSpy).not.toHaveBeenCalled();
        // --- FIX START: Check core:turn_started dispatch ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: playerActor.id,
            entityType: entityType
        });
        // --- FIX END ---
    });

    test('AI actor identified: resolves handler, calls handleTurn', async () => {
        // Arrange
        const aiActor = createMockEntity('ai-goblin', true, false); // isPlayer = false
        const entityType = 'ai'; // Define expected type
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);
        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);

        // Act
        await instance.advanceTurn();

        // Assert
        expect(mockTurnOrderService.isEmpty).toHaveBeenCalledTimes(1);
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        // --- FIX START: Correct log message format ---
        expect(mockLogger.info).toHaveBeenCalledWith(`>>> Starting turn for Entity: ${aiActor.id} (${entityType}) <<<`);
        // --- FIX END ---
        expect(mockLogger.debug).toHaveBeenCalledWith(`Resolving turn handler for entity ${aiActor.id}...`);
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('identified as type:'));
        // Verify resolver call
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(aiActor);
        // Verify handler call
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Calling handleTurn on ${mockTurnHandler.constructor.name}`));
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledTimes(1);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(aiActor);
        // --- FIX START: Correct log message for handleTurn completion ---
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`handleTurn promise resolved for ${mockTurnHandler.constructor.name} for entity ${aiActor.id}`));
        // --- FIX END ---
        expect(stopSpy).not.toHaveBeenCalled();
        // --- FIX START: Check core:turn_started dispatch ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledWith('core:turn_started', {
            entityId: aiActor.id,
            entityType: entityType
        });
        // --- FIX END ---
    });

    test('Handles handleTurn rejection gracefully (error logged, advances turn)', async () => {
        // Arrange
        const aiActor = createMockEntity('ai-reject-handler', true, false);
        const entityType = 'ai';
        mockTurnOrderService.getNextEntity.mockResolvedValue(aiActor);
        const handlerError = new Error("Handler action failed");
        const expectedErrorMsg = `Error during turn handling resolution or execution for entity ${aiActor.id}: ${handlerError.message}`;

        mockTurnHandlerResolver.resolveHandler.mockResolvedValue(mockTurnHandler);
        mockTurnHandler.handleTurn.mockRejectedValue(handlerError);

        const advanceTurnRecurseSpy = jest.spyOn(instance, 'advanceTurn');
        let callCount = 0;
        advanceTurnRecurseSpy.mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                await Reflect.apply(TurnManager.prototype.advanceTurn, instance, []);
            } else {
                mockLogger.debug('Recursive advanceTurn call after error suppressed by mock.');
            }
        });

        // Act
        await expect(instance.advanceTurn()).resolves.toBeUndefined();

        // Assert side effects *during* the first call
        expect(mockTurnOrderService.getNextEntity).toHaveBeenCalledTimes(1);
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(aiActor);
        expect(mockTurnHandler.handleTurn).toHaveBeenCalledWith(aiActor);

        // Assert error handling logs
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, handlerError);
        expect(mockLogger.warn).toHaveBeenCalledWith(`Attempting to advance turn after handling error for actor ${aiActor.id}.`);

        // --- FIX START: Correct dispatch expectations ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(2); // turn_started AND system_error
        // 1. Check core:turn_started
        expect(mockDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1, 'core:turn_started', {
            entityId: aiActor.id,
            entityType: entityType
        });
        // 2. Check core:system_error_occurred
        expect(mockDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2, 'core:system_error_occurred', {
            message: `Error during turn processing for ${aiActor.id}. Attempting recovery.`, // Check specific message
            type: 'error',
            details: expectedErrorMsg // Check specific details
        });
        // --- FIX END ---

        // Assert the recursive call happened
        expect(advanceTurnRecurseSpy).toHaveBeenCalledTimes(2);
        expect(mockLogger.debug).toHaveBeenCalledWith('Recursive advanceTurn call after error suppressed by mock.');

        expect(stopSpy).not.toHaveBeenCalled();
        advanceTurnRecurseSpy.mockRestore();
    });

    test('Handles resolver failure gracefully (error logged, advances turn)', async () => {
        // Arrange
        const playerActor = createMockEntity('player-no-resolver', true, true);
        const entityType = 'player';
        mockTurnOrderService.getNextEntity.mockResolvedValue(playerActor);
        const resolveError = new Error("Cannot resolve handler");
        const expectedErrorMsg = `Error during turn handling resolution or execution for entity ${playerActor.id}: ${resolveError.message}`;

        mockTurnHandlerResolver.resolveHandler.mockRejectedValue(resolveError);

        const advanceTurnRecurseSpy = jest.spyOn(instance, 'advanceTurn');
        let callCount = 0;
        advanceTurnRecurseSpy.mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                await Reflect.apply(TurnManager.prototype.advanceTurn, instance, []);
            } else {
                mockLogger.debug('Recursive advanceTurn call after error suppressed by mock.');
            }
        });

        // Act
        await expect(instance.advanceTurn()).resolves.toBeUndefined();

        // Assert
        expect(mockTurnHandlerResolver.resolveHandler).toHaveBeenCalledWith(playerActor);
        expect(mockTurnHandler.handleTurn).not.toHaveBeenCalled(); // Handler should not be called

        // Assert error handling logs
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg, resolveError);
        expect(mockLogger.warn).toHaveBeenCalledWith(`Attempting to advance turn after handling error for actor ${playerActor.id}.`);

        // --- FIX START: Correct dispatch expectations ---
        expect(mockDispatcher.dispatchValidated).toHaveBeenCalledTimes(2); // turn_started AND system_error
        // 1. Check core:turn_started
        expect(mockDispatcher.dispatchValidated).toHaveBeenNthCalledWith(1, 'core:turn_started', {
            entityId: playerActor.id,
            entityType: entityType
        });
        // 2. Check core:system_error_occurred
        expect(mockDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2, 'core:system_error_occurred', {
            message: `Error during turn processing for ${playerActor.id}. Attempting recovery.`, // Check specific message
            type: 'error',
            details: expectedErrorMsg // Check specific details
        });
        // --- FIX END ---

        // Assert the recursive call happened
        expect(advanceTurnRecurseSpy).toHaveBeenCalledTimes(2);
        expect(mockLogger.debug).toHaveBeenCalledWith('Recursive advanceTurn call after error suppressed by mock.');

        expect(stopSpy).not.toHaveBeenCalled();
        advanceTurnRecurseSpy.mockRestore();
    });

});
// --- FILE END ---