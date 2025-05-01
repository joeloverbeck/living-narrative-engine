// src/tests/core/gameLoop.stop.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
// Assume ActionExecutor is imported if needed for type checks, though not strictly required for mocking
// import ActionExecutor from '../../actions/actionExecutor.js';

// --- Mock Dependencies ---
const mockEventBus = {
    // *** Ensure dispatch returns a promise if awaited ***
    dispatch: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
};
const mockInputHandler = {
    enable: jest.fn(),
    disable: jest.fn(),
    clear: jest.fn(),
    setCommandCallback: jest.fn()
};
const mockGameStateManager = {
    getPlayer: jest.fn(),
    getCurrentLocation: jest.fn(),
    setPlayer: jest.fn(),
    setCurrentLocation: jest.fn()
};
const mockGameDataRepository = {};
const mockEntityManager = {
    activeEntities: new Map()
};
const mockCommandParser = {
    parse: jest.fn(),
};
const mockActionExecutor = {
    executeAction: jest.fn(),
};
const mockActionDiscoverySystem = {
    getValidActions: jest.fn().mockResolvedValue([]),
};
const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
const mockvalidatedEventDispatcher = {
    // *** Ensure dispatchValidated returns a promise if awaited ***
    dispatchValidated: jest.fn().mockResolvedValue(undefined),
};
const mockTurnOrderService = {
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn().mockReturnValue(null),
    clearCurrentRound: jest.fn(),
};
// ****************************************


// Mock entities for GameStateManager/TurnOrderService
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === PLAYER_COMPONENT_ID) // Assuming PLAYER_COMPONENT_ID is defined/imported
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID) // Assuming ACTOR_COMPONENT_ID is defined/imported
};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn()};

// Helper to create a complete, valid options object
const createValidOptions = () => ({
    gameDataRepository: mockGameDataRepository,
    entityManager: mockEntityManager,
    gameStateManager: mockGameStateManager,
    inputHandler: mockInputHandler,
    commandParser: mockCommandParser,
    actionExecutor: mockActionExecutor,
    eventBus: mockEventBus,
    actionDiscoverySystem: mockActionDiscoverySystem,
    validatedEventDispatcher: mockvalidatedEventDispatcher,
    turnOrderService: mockTurnOrderService,
    logger: mockLogger,
});

// Define dummy component IDs if not imported elsewhere in test context
const PLAYER_COMPONENT_ID = 'playerComponent';
const ACTOR_COMPONENT_ID = 'actorComponent';


// --- Test Suite ---

describe('GameLoop', () => {
    let gameLoop;
    let promptInputSpy;
    let processNextTurnSpy;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mocks (as before)
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(null);
        mockActionExecutor.executeAction.mockResolvedValue({
            success: true,
            messages: [{text: 'Default mock action executed'}]
        });
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});
        mockTurnOrderService.isEmpty.mockReturnValue(true);
        mockTurnOrderService.getNextEntity.mockReturnValue(null);
        mockEntityManager.activeEntities = new Map();
        mockPlayer.hasComponent.mockImplementation((componentId) => componentId === PLAYER_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((componentId) => componentId === ACTOR_COMPONENT_ID);

        // *** Reset mock implementations that return promises ***
        mockEventBus.dispatch.mockResolvedValue(undefined);
        mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(undefined);
    });

    afterEach(async () => { // Make afterEach async if cleanup involves async operations potentially
        if (promptInputSpy) {
            promptInputSpy.mockRestore();
            promptInputSpy = null;
        }
        if (processNextTurnSpy) {
            processNextTurnSpy.mockRestore();
            processNextTurnSpy = null;
        }
        // No await needed for cleanup check, but ensure stop is called if needed
        if (gameLoop && gameLoop.isRunning) {
            // console.log("Stopping game loop in afterEach"); // Debug log
            await gameLoop.stop(); // Use await here just in case cleanup matters for subsequent tests
        }
        gameLoop = null; // Help GC
    });


    // --- stop() Method Tests ---
    describe('stop', () => {
        beforeEach(() => { // No need for async here if setup is sync
            gameLoop = new GameLoop(createValidOptions());
            gameLoop._test_setRunning(true); // Set state AFTER creating instance

            // Clear mocks called during setup (like _test_setRunning logger call)
            jest.clearAllMocks();
            // *** Re-reset mock implementations AFTER clearAllMocks ***
            mockEventBus.dispatch.mockResolvedValue(undefined);
            mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(undefined);
        });

        // --- TEST FIXES BELOW ---

        it('When Running: should set isRunning to false', async () => { // Make test async
            await gameLoop.stop(); // Await the async call
            expect(gameLoop.isRunning).toBe(false);
        });

        it('When Running: should call inputHandler.disable', async () => { // Make test async
            await gameLoop.stop(); // Await the async call
            expect(mockInputHandler.disable).toHaveBeenCalledTimes(1);
        });

        it('When Running: should dispatch textUI:disable_input event with message', async () => { // Make test async
            await gameLoop.stop(); // Await the async call
            // This assertion is okay because it's the first call
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:disable_input', {
                message: 'Game stopped.',
            });
        });

        it('When Running: should dispatch textUI:display_message event with info', async () => { // Make test async
            await gameLoop.stop(); // Await the async call

            // *** FIX: Assert the SECOND call specifically ***
            expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenNthCalledWith(2, 'textUI:display_message', expect.objectContaining({
                text: 'Game stopped.',
                type: 'info',
            }));
        });

        it('When Running: should call turnOrderService.clearCurrentRound if available', async () => { // Make test async
            await gameLoop.stop(); // Await the async call
            expect(mockTurnOrderService.clearCurrentRound).toHaveBeenCalledTimes(1);
        });

        it('When Running: should dispatch game:stopped event', async () => { // Make test async
            await gameLoop.stop(); // Await the async call
            // Ensure the event bus mock is checked correctly
            expect(mockEventBus.dispatch).toHaveBeenCalledWith('game:stopped', {});
        });

        it('When Already Stopped: should not perform actions', async () => { // Make test async
            // Arrange: Ensure the loop is stopped first
            gameLoop._test_setRunning(true);
            await gameLoop.stop(); // *** Await the first stop call ***
            expect(gameLoop.isRunning).toBe(false);

            // Clear mocks from the first stop()
            jest.clearAllMocks();
            // *** Re-reset mock implementations AFTER clearAllMocks ***
            mockEventBus.dispatch.mockResolvedValue(undefined);
            mockvalidatedEventDispatcher.dispatchValidated.mockResolvedValue(undefined);

            // Act: Call stop again
            await gameLoop.stop(); // *** Await the second call (idempotent) ***

            // Assert
            expect(gameLoop.isRunning).toBe(false);
            expect(mockLogger.info).toHaveBeenCalledWith('GameLoop: Stop called, but already stopped.');
            expect(mockInputHandler.disable).not.toHaveBeenCalled();
            expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            expect(mockTurnOrderService.clearCurrentRound).not.toHaveBeenCalled();
            // Check eventBus.dispatch specifically wasn't called *this time*
            expect(mockEventBus.dispatch).not.toHaveBeenCalled();
        });
    });
});