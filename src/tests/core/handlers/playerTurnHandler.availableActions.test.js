// src/tests/core/handlers/playerTurnHandler.availableActions.test.js

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

    it('should dispatch core:player_turn_prompt with valid string IDs when actions are discovered', async () => {
        // Arrange: Mock Action Discovery to return valid actions
        const discoveredActions = [
            {id: 'core:move', name: 'Move'},
            {id: 'core:attack', name: 'Attack'},
            {id: 'custom:skill', name: 'Use Skill'},
        ];
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

        // Act: Start the turn, BUT DON'T await its completion.
        handler.handleTurn(mockActor);
        // Yield control to allow async operations within handleTurn (like dispatch) to proceed
        await new Promise(resolve => setTimeout(resolve, 0)); // <--- MODIFIED WAIT

        // Assert: Check that dispatchValidated was called correctly for the prompt
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: mockActor.id,
                availableActions: ['core:move', 'core:attack', 'custom:skill'], // Expect array of strings
            })
        );
        expect(mockLogger.error).not.toHaveBeenCalled(); // Ensure no errors were logged during prompt
    });

    it('should dispatch core:player_turn_prompt with an EMPTY array if discovered actions contains only undefined', async () => {
        // Arrange: Mock Action Discovery to return an array with undefined (simulating the bug)
        const discoveredActions = [undefined];
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

        // Act: Start the turn, don't await completion
        handler.handleTurn(mockActor);
        // Yield control
        await new Promise(resolve => setTimeout(resolve, 0)); // <--- MODIFIED WAIT

        // Assert: Check that the dispatched payload has an empty array (due to filtering)
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: mockActor.id,
                availableActions: [], // *** Crucial: Expect empty array, not [undefined] ***
            })
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should dispatch core:player_turn_prompt filtering out actions without IDs or null/undefined actions', async () => {
        // Arrange: Mock Action Discovery with mixed valid and invalid entries
        const discoveredActions = [
            {id: 'core:wait', name: 'Wait'},
            null, // Invalid entry
            {name: 'Action Without ID'}, // Invalid entry (missing ID)
            undefined, // Invalid entry
            {id: 'core:look', name: 'Look'},
            {id: '', name: 'Action With Empty ID'}, // Invalid entry (empty string ID)
        ];
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

        // Act: Start the turn, don't await completion
        handler.handleTurn(mockActor);
        // Yield control
        await new Promise(resolve => setTimeout(resolve, 0)); // <--- MODIFIED WAIT

        // Assert: Check that only valid string IDs are included
        expect(mockValidatedEventDispatcher.dispatchValidated).toHaveBeenCalledWith(
            'core:player_turn_prompt',
            expect.objectContaining({
                entityId: mockActor.id,
                availableActions: ['core:wait', 'core:look'], // Only valid, non-empty string IDs
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
                availableActions: [],
            })
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // This test was already correct because the promise rejects, stopping the wait.
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
                availableActions: [], // Empty actions on error
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