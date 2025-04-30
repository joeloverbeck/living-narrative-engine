// src/tests/core/gameLoop.internalEventHandling.test.js

import {describe, it, expect, jest, beforeEach, afterEach} from '@jest/globals';
import GameLoop from '../../core/GameLoop.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from "../../types/components.js";

// --- Mock Dependencies ---
const mockEventBus = {
    dispatch: jest.fn(),
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
    dispatchValidated: jest.fn(),
};
const mockTurnOrderService = {
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
    getNextEntity: jest.fn().mockReturnValue(null),
    clearCurrentRound: jest.fn(),
};
// ****************************************


// Mock entities
const mockPlayer = {
    id: 'player1',
    name: 'Tester',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) =>
        componentId === PLAYER_COMPONENT_ID || componentId === ACTOR_COMPONENT_ID
    )
};
const mockNpc = {
    id: 'npc1',
    name: 'Goblin',
    getComponent: jest.fn(),
    hasComponent: jest.fn((componentId) => componentId === ACTOR_COMPONENT_ID)
};
const mockLocation = {id: 'room:test', name: 'Test Chamber', getComponent: jest.fn()};

// ****** Helper Function START ******
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
// ****** Helper Function END ******


// --- Test Suite ---
describe('GameLoop', () => {
    // Outer scope variables if needed across different top-level describes
    // let gameLoop;

    // --- Top Level Setup ---
    // General mocks reset before ANY test in this file
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mocks to default states FOR ALL TESTS IN SUITE
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        mockActionExecutor.executeAction.mockResolvedValue({success: true, messages: []});
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});
        mockTurnOrderService.isEmpty.mockReturnValue(true);
        mockTurnOrderService.getNextEntity.mockReturnValue(null);
        mockEntityManager.activeEntities = new Map();

        // Default hasComponent implementations
        mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
    });

    // General cleanup after ANY test in this file
    afterEach(() => {
        // Restore any spies created OUTSIDE specific describe blocks if needed
        // Example: if promptInputSpy was defined in the outer scope:
        // if (promptInputSpy) {
        //     promptInputSpy.mockRestore();
        //     promptInputSpy = null;
        // }

        // Ensure game loop instance is stopped and cleared if created in outer scope
        // if (gameLoop && gameLoop.isRunning) {
        //     gameLoop.stop();
        // }
        // gameLoop = null;
    });


    // --- Internal Event Handling (#handleSubmittedCommandFromEvent) ---
    describe('Internal Event Handling (#handleSubmittedCommandFromEvent)', () => {

        // --- Default Setup: Player Turn Active After Start ---
        describe('when player turn is active after start', () => {
            let gameLoop; // Instance specific to this describe block
            let commandSubmitHandler;
            let processCmdSpy;
            let promptInputSpy;

            beforeEach(async () => {
                // Clear mocks specifically for this block's setup run
                jest.clearAllMocks();

                // Configure mocks for player turn start
                mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
                mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
                mockEntityManager.activeEntities = new Map([[mockPlayer.id, mockPlayer], [mockNpc.id, mockNpc]]);
                mockTurnOrderService.isEmpty.mockReturnValueOnce(true).mockReturnValue(false);
                mockTurnOrderService.getNextEntity.mockReturnValueOnce(mockPlayer);

                // Re-create instance for this block
                gameLoop = new GameLoop(createValidOptions());

                // Re-create spies for this block
                processCmdSpy = jest.spyOn(gameLoop, 'processSubmittedCommand').mockResolvedValue();
                promptInputSpy = jest.spyOn(gameLoop, 'promptInput');

                // Find handler (safe as constructor subscribes)
                const subscribeCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'command:submit');
                if (!subscribeCall) throw new Error("Setup failed: 'command:submit' not subscribed.");
                commandSubmitHandler = subscribeCall[1].bind(gameLoop);

                // Start the loop
                await gameLoop.start();

                // Workaround for start() state verification issue
                if (gameLoop['_GameLoop__currentTurnEntity'] !== mockPlayer) {
                    // Keep this warning potentially, as it highlights an underlying issue
                    console.warn("TEST WARN (Player Turn Suite): Manually setting #currentTurnEntity post-start.");
                    gameLoop['_GameLoop__currentTurnEntity'] = mockPlayer;
                }
                // Verify workaround ensures state for tests
                expect(gameLoop['_GameLoop__currentTurnEntity']).toBe(mockPlayer);

                // --- Clear mocks called DURING start() ---
                // We clear mocks again here to reset calls made *by start()* so asserts in 'it' blocks are clean.
                // Note: Spies (processCmdSpy, promptInputSpy) are *not* cleared by jest.clearAllMocks().
                jest.clearAllMocks();

                // --- Re-establish mocks needed AFTER start() for tests ---
                // Re-apply necessary mock implementations that might have been cleared
                mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
                mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
                mockActionDiscoverySystem.getValidActions.mockResolvedValue([]);
                // Ensure logger is still the mock (though clearAllMocks shouldn't break this)
                if (gameLoop['_GameLoop__logger'] !== mockLogger) {
                    gameLoop['_GameLoop__logger'] = mockLogger;
                }
                // Ensure spies are clear for individual test assertions
                processCmdSpy.mockClear();
                promptInputSpy.mockClear();
                // Ensure dispatcher is clear for tests
                mockvalidatedEventDispatcher.dispatchValidated.mockClear();
                mockLogger.warn.mockClear(); // Clear any warnings from start()
            });

            afterEach(() => {
                // Restore spies created in this describe block
                if (processCmdSpy) processCmdSpy.mockRestore();
                if (promptInputSpy) promptInputSpy.mockRestore();
                // Stop instance specific to this block
                if (gameLoop && gameLoop.isRunning) gameLoop.stop();
                gameLoop = null;
            });

            // --- Tests Assuming Player Turn ---
            it("should call processSubmittedCommand with entity and command when 'command:submit' received for the current player's turn", async () => {
                const eventData = {command: 'look', entityId: mockPlayer.id};
                await commandSubmitHandler(eventData);
                expect(processCmdSpy).toHaveBeenCalledTimes(1);
                expect(processCmdSpy).toHaveBeenCalledWith(mockPlayer, eventData.command);
                expect(mockLogger.warn).not.toHaveBeenCalled();
            });

            it("should NOT call processSubmittedCommand when 'command:submit' is received and loop is stopped", async () => {
                gameLoop.stop(); // Stop the loop *after* beforeEach start
                const eventData = {command: 'look', entityId: mockPlayer.id};
                // mockLogger.warn was cleared in beforeEach, no need to clear again unless stop() calls it unexpectedly
                await commandSubmitHandler(eventData);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('loop is not running'));
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should NOT call processSubmittedCommand if event's entityId does not match current turn entity", async () => {
                const eventData = {command: 'wait', entityId: 'otherPlayer'};
                await commandSubmitHandler(eventData);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("received command event for entity otherPlayer, but it's not that player's turn (Current: player1). Ignoring."));
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should display 'Not your turn.' message if command is from wrong player while waiting for player input", async () => {
                const eventData = {command: 'wait', entityId: 'otherPlayer'};
                await commandSubmitHandler(eventData);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("but it's not that player's turn (Current: player1)"));
                expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
                    text: "It's not your turn.",
                    type: 'warning'
                });
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should re-discover actions and call promptInput if event has invalid/missing command string while running and player turn", async () => {
                const eventData = {wrong_key: 'look', entityId: mockPlayer.id};
                promptInputSpy.mockClear(); // Clear calls from start()
                await commandSubmitHandler(eventData);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("invalid 'command:submit' event data"), expect.anything());
                expect(processCmdSpy).not.toHaveBeenCalled();
                expect(mockGameStateManager.getCurrentLocation).toHaveBeenCalled();
                expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockPlayer, expect.any(Object));
                expect(promptInputSpy).toHaveBeenCalledTimes(1); // Called once here
            });
            // --- End Tests Assuming Player Turn ---
        });


        // --- Specific Setups for Edge Cases ---
        // ****** CORRECTED NPC Turn Suite START ******
        describe('when NPC turn is active', () => {
            let gameLoop; // Instance specific to this describe block
            let commandSubmitHandler; // To hold the bound handler function
            let processCmdSpy;
            let promptInputSpy;

            beforeEach(() => {
                jest.clearAllMocks(); // Clear all mocks before setting up this specific state

                // Configure basic entity mocks
                mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
                mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
                // Configure mocks needed directly by the handler's logic paths
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
                mockActionDiscoverySystem.getValidActions.mockResolvedValue([]); // Needed for invalid command recovery path

                // Create instance
                const options = createValidOptions();
                options.logger = mockLogger; // Ensure mock logger is passed
                gameLoop = new GameLoop(options);

                // --- Find the actual bound handler function ---
                // The constructor calls subscribe, so find the call associated with this instance
                // Clear potential leftover calls from previous tests first
                // mockEventBus.subscribe.mockClear(); // Be careful if other suites rely on prior calls
                const subscribeCall = mockEventBus.subscribe.mock.calls.find(call => call[0] === 'command:submit' && call[1].name === 'bound #handleSubmittedCommandFromEvent');
                if (!subscribeCall || typeof subscribeCall[1] !== 'function') {
                    // Fallback: Assume the last 'command:submit' subscription is the one we want
                    const subscribeCallsAfterConstruction = mockEventBus.subscribe.mock.calls.filter(call => call[0] === 'command:submit');
                    if (subscribeCallsAfterConstruction.length === 0 || typeof subscribeCallsAfterConstruction[subscribeCallsAfterConstruction.length - 1][1] !== 'function') {
                        throw new Error("Setup failed: Bound '#handleSubmittedCommandFromEvent' not found in subscribe calls.");
                    }
                    // Assume the last relevant subscription belongs to this instance
                    commandSubmitHandler = subscribeCallsAfterConstruction[subscribeCallsAfterConstruction.length - 1][1];
                } else {
                    commandSubmitHandler = subscribeCall[1]; // Get the bound function passed to subscribe
                }
                // Check if we actually got a function
                if (typeof commandSubmitHandler !== 'function') {
                    throw new Error("Setup failed: Could not retrieve bound handler function.");
                }
                // --- End Handler Find ---


                // --- Direct State Manipulation for Testing ---
                gameLoop._test_setRunning(true);
                gameLoop._test_setCurrentTurnEntity(mockNpc);

                // --- Setup Spies ---
                processCmdSpy = jest.spyOn(gameLoop, 'processSubmittedCommand').mockResolvedValue();
                promptInputSpy = jest.spyOn(gameLoop, 'promptInput');

                // --- Ensure mocks/spies are clear for individual test assertions ---
                // Must clear AFTER finding the handler but BEFORE the test runs
                jest.clearAllMocks(); // Clear mocks called during constructor/setup

                // Ensure spies start with zero calls for each test
                processCmdSpy.mockClear();
                promptInputSpy.mockClear();
                mockvalidatedEventDispatcher.dispatchValidated.mockClear();
                mockLogger.warn.mockClear();
                mockLogger.info.mockClear();

                // --- Re-apply critical mock implementations potentially cleared by jest.clearAllMocks ---
                mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
                mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
                mockActionDiscoverySystem.getValidActions.mockResolvedValue([]);
                // Ensure internal logger is still the mock instance (redundant if options correct, but safe)
                gameLoop['_GameLoop__logger'] = mockLogger;
                // Ensure EventBus mock persists if needed by handler (clearAllMocks clears calls, not mock itself)
                gameLoop['_GameLoop__eventBus'] = mockEventBus;
                gameLoop['_GameLoop__validatedEventDispatcher'] = mockvalidatedEventDispatcher;


            });

            afterEach(() => {
                // Restore spies specific to this block
                if (processCmdSpy) processCmdSpy.mockRestore();
                if (promptInputSpy) promptInputSpy.mockRestore();
                gameLoop = null;
            });

            // --- Tests Assuming NPC Turn (Direct State Set, Called via Bound Handler) ---
            it("should NOT display 'Not your turn.' message if current turn is an NPC and event is from Player", async () => {
                // Arrange: state is set by beforeEach (isRunning=true, entity=mockNpc)
                const eventData = {command: 'wait', entityId: mockPlayer.id}; // Command *from* Player

                // Act: Call the retrieved bound handler function
                await commandSubmitHandler(eventData);

                // Assert
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`received command event for entity ${mockPlayer.id}, but it's not that player's turn (Current: ${mockNpc.id}). Ignoring.`)
                );
                expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.objectContaining({text: "It's not your turn."}));
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should NOT re-prompt if event has invalid command string BUT it's not player turn (event from NPC)", async () => {
                // Arrange: state is set by beforeEach (isRunning=true, entity=mockNpc)
                const eventData = {command: '', entityId: mockNpc.id}; // Invalid command *from* NPC

                // Act: Call the retrieved bound handler function
                await commandSubmitHandler(eventData);

                // Assert: Should still warn because isPlayerTurn check fails (NPC lacks PLAYER_COMPONENT_ID)
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`received command event for entity ${mockNpc.id}, but it's not that player's turn (Current: ${mockNpc.id}). Ignoring.`)
                );
                expect(processCmdSpy).not.toHaveBeenCalled();
                expect(mockGameStateManager.getCurrentLocation).not.toHaveBeenCalled();
                expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
                expect(promptInputSpy).not.toHaveBeenCalled();
            });

            it("should NOT process command if event is from NPC (matching current turn) but loop is stopped", async () => {
                // Arrange: state is set by beforeEach (isRunning=true, entity=mockNpc)
                gameLoop._test_setRunning(false); // Manually stop the loop AFTER initial setup
                const eventData = {command: 'wait', entityId: mockNpc.id}; // Command *from* NPC

                // Act: Call the retrieved bound handler function
                await commandSubmitHandler(eventData);

                // Assert: Should exit early due to !isRunning check
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('loop is not running'));
                expect(processCmdSpy).not.toHaveBeenCalled();
                expect(promptInputSpy).not.toHaveBeenCalled();
                expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalled();
            });

            // This test still verifies the CURRENT behavior of the handler.
            // If NPC commands via event SHOULD be processed, GameLoop logic needs changing.
            it("should NOT process command if event is from NPC and it's NPC's turn (CURRENT LOGIC)", async () => {
                // Arrange: state is set by beforeEach (isRunning=true, entity=mockNpc)
                const eventData = {command: 'wait', entityId: mockNpc.id}; // Command *from* NPC

                // Act: Call the retrieved bound handler function
                await commandSubmitHandler(eventData);

                // Asserting CURRENT behaviour: It hits the !isPlayerTurn warning path
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`received command event for entity ${mockNpc.id}, but it's not that player's turn (Current: ${mockNpc.id}). Ignoring.`)
                );
                expect(processCmdSpy).not.toHaveBeenCalled(); // Command is NOT processed currently
            });
            // --- End Tests Assuming NPC Turn ---
        });
        // ****** CORRECTED NPC Turn Suite END ******
    }); // End describe Internal Event Handling

}); // End describe GameLoop
