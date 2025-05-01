// src/tests/core/gameLoop.internalEventHandling.test.js
// ****** CORRECTED FILE ******

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
const mockTurnManager = {
    start: jest.fn(),
    stop: jest.fn(),
    getCurrentActor: jest.fn().mockReturnValue(null),
    advanceTurn: jest.fn(),
    isEmpty: jest.fn().mockReturnValue(true),
    startNewRound: jest.fn(),
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

// ****** Helper Function ******
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
    turnManager: mockTurnManager,
    logger: mockLogger,
});
// ****** Helper Function END ******


// --- Test Suite ---
describe('GameLoop', () => {
    let gameLoop = null; // Define in outer scope for cleanup in afterEach
    let processCmdSpy = null; // Define spies in outer scope
    let promptInputSpy = null;

    // --- Top Level Setup ---
    beforeEach(() => {
        // Clear ALL mocks ONCE at the beginning of EACH test run (for both describe blocks)
        jest.clearAllMocks();

        // --- Reset mocks to default states ---
        mockGameStateManager.getPlayer.mockReturnValue(null);
        mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
        mockActionExecutor.executeAction.mockResolvedValue({success: true, messages: []});
        mockCommandParser.parse.mockReturnValue({actionId: null, error: 'Default mock parse', originalInput: ''});
        // Reset TurnManager mocks (can use mockClear, but resetting return values is safer)
        mockTurnManager.start.mockResolvedValue();
        mockTurnManager.stop.mockResolvedValue();
        mockTurnManager.getCurrentActor.mockReturnValue(null);
        mockTurnManager.advanceTurn.mockResolvedValue();
        mockTurnManager.isEmpty.mockReturnValue(true);
        // Reset Entity mocks (critical!) - Restore default implementation after clearAllMocks
        mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
        mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
        // Reset other mocks if necessary
        mockActionDiscoverySystem.getValidActions.mockResolvedValue([]);
        mockEntityManager.activeEntities = new Map();
    });

    // General cleanup after ANY test in this file
    afterEach(async () => {
        // Restore spies
        if (processCmdSpy) processCmdSpy.mockRestore();
        if (promptInputSpy) promptInputSpy.mockRestore();
        processCmdSpy = null;
        promptInputSpy = null;

        // Stop and nullify game loop instance
        if (gameLoop && gameLoop.isRunning) {
            await gameLoop.stop(); // Ensure stop is called if running
        }
        if (gameLoop && typeof gameLoop.stop === 'function' && !gameLoop.isRunning) {
            // If not running but instance exists, ensure turn manager stop is called if needed
            // This might be redundant if stop() always calls turnManager.stop()
            await gameLoop.stop(); // Call stop anyway to ensure cleanup consistency? Or just nullify? Let's nullify for now.
        }
        gameLoop = null;
    });


    // --- Internal Event Handling (#handleSubmittedCommandFromEvent) ---
    describe('Internal Event Handling (#handleSubmittedCommandFromEvent)', () => {

        // --- Default Setup: Player Turn Active After Start ---
        describe('when player turn is active after start', () => {
            let commandSubmitHandler; // Bound handler for command:submit
            let turnActorChangedHandler; // Bound handler for turn:actor_changed

            beforeEach(async () => {
                // Mocks should be reset by outer beforeEach

                // Configure necessary mock implementations for THIS specific context
                mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID); // Ensure correct implementation
                mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID);
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
                mockEntityManager.activeEntities = new Map([[mockPlayer.id, mockPlayer], [mockNpc.id, mockNpc]]);
                // ****** CRITICAL: Set TurnManager state for these tests ******
                mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // Ensure mock returns player

                // Create instance (subscribes handlers internally)
                gameLoop = new GameLoop(createValidOptions());

                // Create spies AFTER instance creation
                processCmdSpy = jest.spyOn(gameLoop, 'processSubmittedCommand').mockResolvedValue();
                promptInputSpy = jest.spyOn(gameLoop, 'promptInput');

                // Find the *bound* handlers subscribed by the instance
                const subscribeCalls = mockEventBus.subscribe.mock.calls;
                const commandSubmitCall = subscribeCalls.find(call => call[0] === 'command:submit');
                commandSubmitHandler = commandSubmitCall ? commandSubmitCall[1] : null;
                const turnActorChangedCall = subscribeCalls.find(call => call[0] === 'turn:actor_changed');
                turnActorChangedHandler = turnActorChangedCall ? turnActorChangedCall[1] : null;

                if (!commandSubmitHandler) throw new Error("Setup failed: commandSubmitHandler not found.");
                if (!turnActorChangedHandler) throw new Error("Setup failed: turnActorChangedHandler not found.");

                // Start the loop
                await gameLoop.start();
                expect(gameLoop.isRunning).toBe(true);

                // Simulate the event that sets the state (via TurnManager)
                // NOTE: We don't need to call turnActorChangedHandler directly here for the command submission tests,
                // as the handler under test (#handleSubmittedCommandFromEvent) directly queries mockTurnManager.getCurrentActor().
                // We *do* rely on mockTurnManager.getCurrentActor() being set correctly above.

                // ****** REMOVED OBSOLETE VERIFICATION USING INTERNAL STATE ******
                // expect(gameLoop._test_getInternalCurrentTurnEntity()).toBe(mockPlayer);

                // --- Clear ONLY spies and mock CALLS before tests ---
                // DO NOT call jest.clearAllMocks() here as it resets implementations needed by the tests
                processCmdSpy.mockClear();
                promptInputSpy.mockClear(); // Clears calls from setup path (#handleTurnActorChanged -> _processCurrentActorTurn -> etc.)
                mockEventBus.dispatch.mockClear(); // Clear any events dispatched during setup
                mockvalidatedEventDispatcher.dispatchValidated.mockClear();
                mockLogger.warn.mockClear(); // Clear warnings from setup
                // Input handler might have been called, clear calls
                mockInputHandler.enable.mockClear();
                mockInputHandler.disable.mockClear();
                mockActionDiscoverySystem.getValidActions.mockClear(); // Clear calls from setup
                mockGameStateManager.getCurrentLocation.mockClear(); // Clear calls from setup
                // Clear TurnManager calls from setup/previous tests
                mockTurnManager.getCurrentActor.mockClear();
            });

            // afterEach is handled by the outer block

            // --- Tests Assuming Player Turn ---
            it("should call processSubmittedCommand with entity and command when 'command:submit' received for the current player's turn", async () => {
                const eventData = {command: 'look', entityId: mockPlayer.id};
                // Ensure hasComponent mock is still active before calling handler
                expect(typeof mockPlayer.hasComponent).toBe('function');
                mockPlayer.hasComponent.mockImplementationOnce((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID); // Be explicit if needed

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer);
                await commandSubmitHandler(eventData);

                expect(mockTurnManager.getCurrentActor).toHaveBeenCalled(); // Verify it checked whose turn it is
                expect(processCmdSpy).toHaveBeenCalledTimes(1);
                expect(processCmdSpy).toHaveBeenCalledWith(mockPlayer, eventData.command);
                expect(mockLogger.warn).not.toHaveBeenCalled();
            });

            it("should NOT call processSubmittedCommand when 'command:submit' is received and loop is stopped", async () => {
                gameLoop._test_setRunning(false); // Stop the loop using the *existing* test helper
                const eventData = {command: 'look', entityId: mockPlayer.id};

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer);
                await commandSubmitHandler(eventData);

                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('loop is not running'));
                // TurnManager shouldn't be checked if not running
                expect(mockTurnManager.getCurrentActor).not.toHaveBeenCalled();
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should NOT call processSubmittedCommand if event's entityId does not match current turn entity", async () => {
                const eventData = {command: 'wait', entityId: 'otherPlayer'}; // Wrong entity
                // Ensure current entity's hasComponent mock is active before calling handler
                expect(typeof mockPlayer.hasComponent).toBe('function');
                mockPlayer.hasComponent.mockImplementationOnce((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // It's still player's turn
                await commandSubmitHandler(eventData);

                // TurnManager is the source of truth now for the current actor check inside the handler
                expect(mockTurnManager.getCurrentActor).toHaveBeenCalled();
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`received command event for entity otherPlayer, but it's not that player's turn (Current: ${mockPlayer.id}). Ignoring.`));
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should display 'Not your turn.' message if command is from wrong player while waiting for player input", async () => {
                const eventData = {command: 'wait', entityId: 'otherPlayer'}; // Wrong entity
                // Ensure current entity's hasComponent mock is active before calling handler
                expect(typeof mockPlayer.hasComponent).toBe('function');
                mockPlayer.hasComponent.mockImplementationOnce((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer); // It's still player's turn
                await commandSubmitHandler(eventData);

                // TurnManager is the source of truth now for the current actor check inside the handler
                expect(mockTurnManager.getCurrentActor).toHaveBeenCalled();
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`but it's not that player's turn (Current: ${mockPlayer.id})`));
                expect(mockvalidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith('textUI:display_message', {
                    text: "It's not your turn.",
                    type: 'warning'
                });
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should re-discover actions and call promptInput if event has invalid/missing command string while running and player turn", async () => {
                const invalidCommandEvent = {command: undefined, entityId: mockPlayer.id}; // Correct entity, invalid data
                // Ensure current entity's hasComponent mock is active before calling handler
                expect(typeof mockPlayer.hasComponent).toBe('function');
                mockPlayer.hasComponent.mockImplementationOnce((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockPlayer);
                await commandSubmitHandler(invalidCommandEvent);

                // TurnManager is the source of truth now for the current actor check inside the handler
                expect(mockTurnManager.getCurrentActor).toHaveBeenCalled();
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("invalid 'command:submit' event data"), expect.anything());
                expect(processCmdSpy).not.toHaveBeenCalled();
                // _promptPlayerInput -> _discoverActionsForEntity -> getCurrentLocation
                expect(mockGameStateManager.getCurrentLocation).toHaveBeenCalled();
                // _promptPlayerInput -> _discoverActionsForEntity -> getValidActions
                expect(mockActionDiscoverySystem.getValidActions).toHaveBeenCalledWith(mockPlayer, expect.any(Object));
                // _promptPlayerInput -> promptInput
                expect(promptInputSpy).toHaveBeenCalledTimes(1);
            });
            // --- End Tests Assuming Player Turn ---
        });


        // --- Specific Setups for Edge Cases ---
        describe('when NPC turn is active', () => {
            let commandSubmitHandler; // Bound handler for command:submit

            beforeEach(() => {
                // Mocks should be reset by outer beforeEach

                // Configure necessary mock implementations for THIS specific context
                mockPlayer.hasComponent.mockImplementation((id) => id === PLAYER_COMPONENT_ID || id === ACTOR_COMPONENT_ID);
                mockNpc.hasComponent.mockImplementation((id) => id === ACTOR_COMPONENT_ID); // Ensure correct implementation
                mockGameStateManager.getCurrentLocation.mockReturnValue(mockLocation);
                mockEntityManager.activeEntities = new Map([[mockPlayer.id, mockPlayer], [mockNpc.id, mockNpc]]);
                // ****** CRITICAL: Set TurnManager state for these tests ******
                mockTurnManager.getCurrentActor.mockReturnValue(mockNpc); // Ensure mock returns NPC

                // Create instance
                const options = createValidOptions();
                options.logger = mockLogger;
                gameLoop = new GameLoop(options);

                // Create spies AFTER instance creation
                processCmdSpy = jest.spyOn(gameLoop, 'processSubmittedCommand').mockResolvedValue();
                promptInputSpy = jest.spyOn(gameLoop, 'promptInput');

                // Find the command submit handler
                const subscribeCalls = mockEventBus.subscribe.mock.calls;
                const commandSubmitCall = subscribeCalls.find(call => call[0] === 'command:submit');
                commandSubmitHandler = commandSubmitCall ? commandSubmitCall[1] : null;
                if (!commandSubmitHandler) throw new Error("Setup failed: commandSubmitHandler not found.");

                // --- Set State Directly for NPC tests ---
                gameLoop._test_setRunning(true); // Use the *existing* running state helper

                // ****** REMOVED OBSOLETE SETTER ******
                // gameLoop._test_setInternalCurrentTurnEntity(mockNpc); // Use test setter

                // ****** REMOVED OBSOLETE VERIFICATION USING INTERNAL STATE ******
                // Verify state using the NEW test getter
                // expect(gameLoop._test_getInternalCurrentTurnEntity()).toBe(mockNpc);

                // --- Clear ONLY spies and mock CALLS before tests ---
                processCmdSpy.mockClear();
                promptInputSpy.mockClear();
                mockEventBus.dispatch.mockClear();
                mockvalidatedEventDispatcher.dispatchValidated.mockClear();
                mockLogger.warn.mockClear();
                mockLogger.info.mockClear();
                mockInputHandler.enable.mockClear();
                mockInputHandler.disable.mockClear();
                mockActionDiscoverySystem.getValidActions.mockClear();
                mockGameStateManager.getCurrentLocation.mockClear();
                // Also clear TurnManager calls from setup/previous tests
                mockTurnManager.getCurrentActor.mockClear();
            });

            // afterEach is handled by the outer block

            // --- Tests Assuming NPC Turn ---
            it("should NOT display 'Not your turn.' message if current turn is an NPC and event is from Player", async () => {
                const eventData = {command: 'wait', entityId: mockPlayer.id}; // Command from Player
                // Ensure current entity (NPC)'s hasComponent mock is active
                expect(typeof mockNpc.hasComponent).toBe('function');
                mockNpc.hasComponent.mockImplementationOnce((id) => id === ACTOR_COMPONENT_ID);

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockNpc); // It's NPC's turn
                await commandSubmitHandler(eventData);

                // TurnManager is the source of truth now for the current actor check inside the handler
                expect(mockTurnManager.getCurrentActor).toHaveBeenCalled();
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`received command event for entity ${mockPlayer.id}, but it's not that player's turn (Current: ${mockNpc.id}). Ignoring.`));
                // This check is key: no "Not your turn" message should be sent
                expect(mockvalidatedEventDispatcher.dispatchValidated).not.toHaveBeenCalledWith('textUI:display_message', expect.objectContaining({text: "It's not your turn."}));
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should NOT re-prompt if event has invalid command string BUT it's not player turn (event from NPC)", async () => {
                const eventData = {command: '', entityId: mockNpc.id}; // Invalid command from NPC
                // Ensure current entity (NPC)'s hasComponent mock is active
                expect(typeof mockNpc.hasComponent).toBe('function');
                mockNpc.hasComponent.mockImplementationOnce((id) => id === ACTOR_COMPONENT_ID);

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockNpc); // It's NPC's turn
                await commandSubmitHandler(eventData);

                // TurnManager is the source of truth now for the current actor check inside the handler
                expect(mockTurnManager.getCurrentActor).toHaveBeenCalled();
                // Handler checks if currentActor has PLAYER_COMPONENT_ID, which NPC does not
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`received command event for entity ${mockNpc.id}, but it's not that player's turn (Current: ${mockNpc.id}). Ignoring.`));
                expect(processCmdSpy).not.toHaveBeenCalled();
                // Should not try to re-prompt an NPC
                expect(promptInputSpy).not.toHaveBeenCalled();
            });

            it("should NOT process command if event is from NPC (matching current turn) but loop is stopped", async () => {
                gameLoop._test_setRunning(false); // Stop the loop
                const eventData = {command: 'wait', entityId: mockNpc.id};

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockNpc); // It would be NPC's turn if running
                await commandSubmitHandler(eventData);

                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('loop is not running'));
                // TurnManager shouldn't even be checked if not running
                expect(mockTurnManager.getCurrentActor).not.toHaveBeenCalled();
                expect(processCmdSpy).not.toHaveBeenCalled();
            });

            it("should NOT process command if event is from NPC and it's NPC's turn (CURRENT LOGIC)", async () => {
                const eventData = {command: 'wait', entityId: mockNpc.id}; // Command from NPC
                // Ensure current entity (NPC)'s hasComponent mock is active
                expect(typeof mockNpc.hasComponent).toBe('function');
                mockNpc.hasComponent.mockImplementationOnce((id) => id === ACTOR_COMPONENT_ID);

                // Reset getCurrentActor mock return value *before* the handler call
                mockTurnManager.getCurrentActor.mockReturnValue(mockNpc); // It's NPC's turn
                await commandSubmitHandler(eventData);

                // TurnManager is the source of truth now for the current actor check inside the handler
                expect(mockTurnManager.getCurrentActor).toHaveBeenCalled();
                // Handler checks if currentActor has PLAYER_COMPONENT_ID, which NPC does not
                expect(mockLogger.warn).toHaveBeenCalledTimes(1);
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`received command event for entity ${mockNpc.id}, but it's not that player's turn (Current: ${mockNpc.id}). Ignoring.`));
                expect(processCmdSpy).not.toHaveBeenCalled();
            });
            // --- End Tests Assuming NPC Turn ---
        });
        // ****** CORRECTED NPC Turn Suite END ******
    }); // End describe Internal Event Handling

}); // End describe GameLoop