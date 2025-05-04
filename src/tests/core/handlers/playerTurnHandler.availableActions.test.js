// src/tests/core/handlers/playerTurnHandler.availableActions.test.js
// --- FILE START (Entire file content as requested) ---

// --- Mock Dependencies ---
// Assume these are utility functions or classes to create basic mocks
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";

const createMockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

const createMockActionDiscoverySystem = () => ({
    getValidActions: jest.fn(),
});

const createMockValidatedEventDispatcher = () => ({
    dispatchValidated: jest.fn().mockResolvedValue(true), // Assume success by default
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
});

const createMockCommandProcessor = () => ({
    processCommand: jest.fn(),
});

const createMockWorldContext = () => ({
    getLocationOfEntity: jest.fn().mockResolvedValue({id: 'loc:test', name: 'Test Location'}),
    getCurrentLocation: jest.fn().mockResolvedValue({id: 'loc:test', name: 'Test Location'}),
});

const createMockEntityManager = () => ({
    getEntityInstance: jest.fn((id) => ({id: id, /* other props */})), // Basic mock
    activeEntities: new Map(), // For completeness if needed elsewhere
});

const createMockGameDataRepository = () => ({
    getActionDefinition: jest.fn((id) => ({id: id, name: 'Mock Action'})), // Basic mock
});

// Mock Entity
const createMockActor = (id = 'player:hero') => ({
    id: id,
    // Add any other methods/properties PlayerTurnHandler might access
});

// --- Import the Class to Test ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js'; // Adjust path as needed

// --- Test Suite ---
describe('PlayerTurnHandler', () => {
    let mockLogger;
    let mockActionDiscoverySystem;
    let mockValidatedEventDispatcher;
    let mockCommandProcessor;
    let mockWorldContext;
    let mockEntityManager;
    let mockGameDataRepository;
    let handler;
    let mockActor;

    beforeEach(() => {
        // Create fresh mocks for each test
        mockLogger = createMockLogger();
        mockActionDiscoverySystem = createMockActionDiscoverySystem();
        mockValidatedEventDispatcher = createMockValidatedEventDispatcher();
        mockCommandProcessor = createMockCommandProcessor();
        mockWorldContext = createMockWorldContext();
        mockEntityManager = createMockEntityManager();
        mockGameDataRepository = createMockGameDataRepository();
        mockActor = createMockActor('player:testHero');

        // Instantiate the handler with mocks
        handler = new PlayerTurnHandler({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            validatedEventDispatcher: mockValidatedEventDispatcher,
            commandProcessor: mockCommandProcessor,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
        });
    });

    afterEach(() => {
        jest.clearAllMocks(); // Clear mock call history
        // Optional: If handler setup listeners/timers that persist, call destroy
        // handler.destroy();
    });

    // --- Tests focusing on #_promptPlayerForAction via handleTurn ---

    // --- MODIFIED TEST ---
    it('should dispatch core:player_turn_prompt with valid action objects when actions are discovered', async () => {
        // Arrange: Mock Action Discovery to return valid action objects {id, command}
        const discoveredActions = [
            {id: 'core:move', command: 'move north'}, // Use command property
            {id: 'core:attack', command: 'attack goblin'},
            {id: 'custom:skill', command: 'cast heal'},
        ];
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

        // Act: Start the turn, BUT DON'T await its completion.
        handler.handleTurn(mockActor);
        // Yield control to allow async operations within handleTurn (like dispatch) to proceed
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert: Check that dispatchValidated was called correctly for the prompt
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: mockActor.id,
                availableActions: discoveredActions, // Expect the exact array of objects
            })
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure no errors were logged during prompt
    });

    // --- REMOVED TEST ---
    // This test checked the handler's internal filtering, which was removed.
    // Responsibility is now on ActionDiscoverySystem to return clean data.
    // it('should dispatch core:player_turn_prompt with an EMPTY array if discovered actions contains only undefined', async () => { ... });

    // --- MODIFIED TEST ---
    it('should dispatch core:player_turn_prompt with the exact valid action objects returned by discovery', async () => {
        // Arrange: Mock Action Discovery to return *only* valid action objects.
        // Assumes ActionDiscoverySystem itself handles filtering now.
        const discoveredActions = [
            {id: 'core:wait', command: 'wait'},
            {id: 'core:look', command: 'look'},
        ];
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

        // Act: Start the turn, don't await completion
        handler.handleTurn(mockActor);
        // Yield control
        await new Promise(resolve => setTimeout(resolve, 0));

        // Assert: Check that the exact objects returned by the mock are dispatched
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: mockActor.id,
                availableActions: discoveredActions, // Expect the exact array of objects
            })
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });


    it('should dispatch core:player_turn_prompt with an empty array if action discovery returns an empty array', async () => {
        // Arrange: Mock Action Discovery to return an empty array
        const discoveredActions = [];
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

        // Act: Start the turn, don't await completion
        handler.handleTurn(mockActor);
        // Yield control
        await new Promise(resolve => setTimeout(resolve, 0)); // <--- MODIFIED WAIT

        // Assert: Check that the payload has an empty array
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: mockActor.id,
                availableActions: [], // This remains correct
            })
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // This test should still pass as is, error handling dispatches an empty array
    it('should dispatch core:player_turn_prompt with an empty array and error message if action discovery throws', async () => {
        // Arrange: Mock Action Discovery to throw an error
        const discoveryError = new Error('Failed to discover actions!');
        mockActionDiscoverySystem.getValidActions.mockRejectedValue(discoveryError);

        // Act & Assert: handleTurn should catch, dispatch error prompt, and reject
        // We expect handleTurn's promise to reject because _promptPlayerForAction throws
        await expect(handler.handleTurn(mockActor)).rejects.toThrow('Failed to discover actions!');

        // Assert: Check that the error prompt was dispatched before rejection
        // Note: The dispatch happens *within* the handleTurn execution before it rejects
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: mockActor.id,
                availableActions: [], // Empty actions on error - This remains correct
                error: discoveryError.message, // Error message included
            })
        );
        // We also expect the turn end event to be dispatched during the error handling in handleTurn
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:turn_ended',
            {entityId: mockActor.id}
        );
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error during action discovery or prompting'), expect.any(Error));
    });

    // TODO: Add more tests for other parts of PlayerTurnHandler (command handling, turn ending, etc.)
    // These tests *will* need to simulate the 'core:submit_command' event and potentially mock commandProcessor results.
});
// --- FILE END ---