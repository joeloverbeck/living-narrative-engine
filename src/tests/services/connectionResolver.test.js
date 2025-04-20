// src/services/connectionResolver.test.js

// ** Imports for Jest and Core Testing Utilities **
import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

// ** Import Function Under Test **
import {resolveTargetConnection} from '../../services/connectionResolver.js';

// ** Import Dependencies for Mocking/Setup **
// Assume Entity is a class we can instantiate or mock easily
// If Entity has complex dependencies, you might need to mock its constructor or use a simplified mock object
import Entity from '../../entities/entity.js'; // Adjust path if necessary
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Adjust path
import {NameComponent} from '../../components/nameComponent.js'; // Adjust path
import {TARGET_MESSAGES} from '../../utils/messages.js'; // Adjust path
import {getDisplayName} from '../../utils/messages.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js'; // Adjust path if needed
import {ILogger} from '../../core/interfaces/coreServices.js'; // Adjust path if needed

// ** Import Types (for clarity, often optional in JS tests but good practice) **
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/connectionsComponent.js').ConnectionMapping} ConnectionMapping */


// ========================================================================
// == Test Suite Setup ====================================================
// ========================================================================

describe('ConnectionResolverService: resolveTargetConnection', () => {

    let mockContext;
    let mockDispatch;
    let mockEntityManager;
    let mockCurrentLocation;
    let mockConnectionsComponentInstance;
    let mockValidatedDispatcher; // <--- Add mock variable
    let mockLogger;            // <--- Add mock variable

    // --- Helper Function to Create Mock Entities ---
    /**
     * Creates a mock Entity with a NameComponent and mocks its getComponent method.
     * Adds the entity to the mockEntityManager.
     * @param {string} id - Entity ID.
     * @param {string} name - Display Name for the NameComponent.
     * @returns {Entity} The mock entity instance.
     */
    const createMockConnectionEntity = (id, name) => {
        const entity = new Entity(id); // Or use a simpler mock object if Entity is complex
        const mockNameComp = {value: name}; // Simple NameComponent mock data

        // Mock the getComponent method for this specific entity instance
        entity.getComponent = jest.fn((componentConstructor) => {
            if (componentConstructor === NameComponent) {
                // Return an object mimicking the NameComponent interface needed by getDisplayName
                return mockNameComp;
            }
            return undefined; // Return undefined for other components by default
        });

        // Add standard properties if needed by getDisplayName or other parts
        entity.name = name; // Sometimes useful for debugging/logging

        // Store in mock manager
        mockEntityManager.entities.set(id, entity);
        return entity;
    };

    beforeEach(() => {
        // 1. Clear all mocks
        jest.clearAllMocks();

        // --- Mock Logger ---
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        // --- Mock ValidatedEventDispatcher ---
        // Assuming ValidatedEventDispatcher might need the eventBus or similar
        // You might need to adjust this based on its actual constructor/dependencies
        // For now, just mock the required 'dispatchValidated' method
        mockValidatedDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined), // Mock it as an async function if it is one
            // You might need a reference to the original mockDispatch or mockEventBus here
            // depending on how ValidatedEventDispatcher works, e.g.:
            // eventBus: mockEventBus // if needed by the dispatcher internally
        };

        mockEntityManager = {
            entities: new Map(),
            getEntityInstance: jest.fn((entityId) => mockEntityManager.entities.get(entityId)),
            // Add other methods if findPotentialConnectionMatches ever needs them
        };

        // Mock ConnectionsComponent instance - we'll mock its methods
        mockConnectionsComponentInstance = {
            // Mock the method that the service uses
            getAllConnections: jest.fn(() => []), // Default to empty connections
            // Add other methods if needed
        };

        // Mock Current Location Entity
        mockCurrentLocation = new Entity('loc-current'); // Or simple object
        mockCurrentLocation.getComponent = jest.fn((componentConstructor) => {
            if (componentConstructor === ConnectionsComponent) {
                // Return the mock instance by default
                return mockConnectionsComponentInstance;
            }
            return undefined;
        });

        // Mock ActionContext
        mockContext = {
            // eventBus: mockEventBus, // Keep if ValidatedDispatcher needs it, or remove
            entityManager: mockEntityManager,
            currentLocation: mockCurrentLocation,
            playerEntity: new Entity('player-test'),
            validatedDispatcher: mockValidatedDispatcher, // <--- Add mock
            logger: mockLogger,                        // <--- Add mock
        };

        // Ensure getDisplayName mock points to the real implementation
        // (We generally don't mock getDisplayName itself, but rely on mocked NameComponents)
        // jest.mock('../utils/messages', () => ({
        //   ...jest.requireActual('../utils/messages'), // Keep original TARGET_MESSAGES etc.
        //   getDisplayName: jest.fn((entity) => entity?.getComponent(NameComponent)?.value || entity?.id || 'mock display name')
        // }));
        // Note: Above mocking is complex; usually better to rely on real getDisplayName + mocked data.
    });

    // ========================================================================
    // == Test Cases Implementation ==========================================
    // ========================================================================

    // --- Scenario: Valid Input Required ---
    describe('Input Validation', () => {
        test.each([
            [null],
            [undefined],
            [''],
            ['   '],
            // Add cases specifically testing logger/dispatcher presence if needed
            // [{/* missing logger */}, 'some input'],
            // [{/* missing dispatcher */}, 'some input']
        ])('should return null and not dispatch for invalid input: %p', async (invalidInput) => { // <-- Add async
            // Call the function and wait for the promise to resolve
            const result = await resolveTargetConnection(mockContext, invalidInput); // <-- Add await

            // Assert on the resolved value
            expect(result).toBeNull();

            // Check that the dispatcher was NOT called
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // <-- Check the new dispatcher mock

            // Optionally check if logger.warn was called for empty string cases
            if (typeof invalidInput === 'string' && invalidInput.trim() === '') {
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName"));
            } else if (invalidInput === null || invalidInput === undefined) {
                // For null/undefined input, the check might happen even earlier
                // depending on how connectionTargetName is used before trimming.
                // If trimmedTargetName handles it, the warn might still be called.
                expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid or empty connectionTargetName"));
            }
        });

        // Add specific tests for context validation failure if desired
        test('should return null if context is invalid (missing logger)', async () => {
            const invalidContext = {...mockContext, logger: undefined};
            const result = await resolveTargetConnection(invalidContext, 'north');
            expect(result).toBeNull();
            // Check console.error might be tricky/flaky in Jest, focus on return value
        });

        test('should return null if context is invalid (missing validatedDispatcher)', async () => {
            const invalidContext = {...mockContext, validatedDispatcher: undefined};
            const result = await resolveTargetConnection(invalidContext, 'north');
            expect(result).toBeNull();
        });
    });

    // --- Scenario: Unique Direction Match ---
    describe('Unique Direction Match', () => {
        let northEntity;
        beforeEach(() => {
            northEntity = createMockConnectionEntity('conn-n', 'North Passage');
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'north', connectionEntityId: northEntity.id}
            ]);
        });

        test.each([
            ['north'],
            ['NORTH'],
            [' north '],
        ])('should return the correct entity for unique direction "%s"', async (input) => { // <-- Add async
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBe(northEntity); // Assertion remains the same, but now checks the resolved value
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // <-- Check the new dispatcher mock
            // Verify internal calls (optional but good for sanity check)
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponentInstance.getAllConnections).toHaveBeenCalled();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(northEntity.id);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: north -> ${northEntity.id}`)); // <-- Check logger call
        });
    });

    // --- Scenario: Ambiguous Direction Match ---
    describe('Ambiguous Direction Match', () => {
        let westEntity1;
        let westEntity2;
        beforeEach(() => {
            westEntity1 = createMockConnectionEntity('conn-w1', 'West Archway');
            westEntity2 = createMockConnectionEntity('conn-w2', 'West Tunnel');
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'west', connectionEntityId: westEntity1.id},
                {direction: 'west', connectionEntityId: westEntity2.id} // Same direction, different entities
            ]);
        });

        test('should return null and dispatch AMBIGUOUS_DIRECTION message', async () => { // <-- Add async
            const input = 'west';
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // <-- Check new dispatcher

            // --- Updated Check for Dispatch ---
            const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(input, [getDisplayName(westEntity1), getDisplayName(westEntity2)]);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
                "event:display_message", // Or the specific event string if different
                {text: expectedMsg, type: 'warning'}
            );
            // --- End Updated Check ---

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous direction match for '${input}'`)); // <-- Check logger
        });
    });

    // --- Scenario: Unique Name Match (No Direction Match) ---
    describe('Unique Name Match (No Direction Match)', () => {
        let doorEntity;
        beforeEach(() => {
            doorEntity = createMockConnectionEntity('conn-door', 'Ornate Door');
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'east', connectionEntityId: doorEntity.id} // Direction doesn't match 'door'
            ]);
        });

        test.each([
            ['door'],
            ['DOOR'],
            [' ornate '], // This might fail if your name matching isn't robust enough for partials like this - adjust test or logic if needed
            ['Ornate Door'],
        ])('should return the correct entity for unique name match "%s"', async (input) => { // <-- Add async
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBe(doorEntity);
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // <-- Check new dispatcher
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(doorEntity.id);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique name match: ${getDisplayName(doorEntity)} (${doorEntity.id})`)); // <-- Check logger
        });
    });

    // --- Scenario: Ambiguous Name Match (No Direction Match) ---
    describe('Ambiguous Name Match (No Direction Match)', () => {
        let pathEntity1;
        let pathEntity2;
        beforeEach(() => {
            pathEntity1 = createMockConnectionEntity('conn-p1', 'Narrow Path');
            pathEntity2 = createMockConnectionEntity('conn-p2', 'Winding Path');
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'north', connectionEntityId: pathEntity1.id}, // Directions don't match 'path'
                {direction: 'south', connectionEntityId: pathEntity2.id}
            ]);
        });

        test('should return null and dispatch TARGET_AMBIGUOUS_CONTEXT message', async () => { // <-- Add async
            const input = 'path';
            const actionVerb = 'examine'; // Example verb
            const result = await resolveTargetConnection(mockContext, input, actionVerb); // <-- Add await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // <-- Check new dispatcher

            const expectedEntities = [pathEntity1, pathEntity2];
            const expectedMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, input, expectedEntities);

            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith( // <-- Check new dispatcher
                "event:display_message", // Assuming this is your event type constant
                {text: expectedMsg, type: 'warning'}
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous name match for '${input}'`)); // <-- Check logger
        });
    });

    // --- Scenario: Prioritization (Direction > Name) ---
    describe('Prioritization (Direction over Name)', () => {
        let eastDirEntity; // Matches direction 'east'
        let upNameEntity; // Matches name 'east' (e.g., "East Window")
        beforeEach(() => {
            eastDirEntity = createMockConnectionEntity('conn-e', 'Corridor');
            // Ensure the name actually contains the target word for the test case
            upNameEntity = createMockConnectionEntity('conn-u', 'East Window'); // Name contains 'East'
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'east', connectionEntityId: eastDirEntity.id}, // Direction match
                {direction: 'up', connectionEntityId: upNameEntity.id}     // Name match for 'east'
            ]);
        });

        test('should return the entity matched by direction when input matches both', async () => { // <-- Add async
            const input = 'east';
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBe(eastDirEntity); // Prioritizes direction match
            expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled(); // <-- Check new dispatcher
            // Check logger confirms direction match was chosen
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: ${eastDirEntity.direction || 'east'} -> ${eastDirEntity.id}`));
        });
    });

    // --- Scenario: No Match ---
    describe('No Match', () => {
        beforeEach(() => {
            const northEntity = createMockConnectionEntity('conn-n', 'North Exit');
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'north', connectionEntityId: northEntity.id}
            ]);
        });

        test('should return null and dispatch TARGET_NOT_FOUND_CONTEXT message', async () => { // <-- Add async
            const input = 'teleporter'; // Doesn't match 'north' or 'North Exit'
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // <-- Check new dispatcher
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith( // <-- Check new dispatcher
                "event:display_message", // Assuming this is your event type constant
                {text: expectedMsg, type: 'info'}
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`)); // <-- Check logger
        });
    });

    // --- Scenario: Edge Cases ---
    describe('Edge Cases', () => {
        test('should return null and dispatch Not Found if location lacks ConnectionsComponent', async () => { // <-- Add async
            // Override default mock for this test
            mockCurrentLocation.getComponent.mockReturnValue(undefined);
            const input = 'north';
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBeNull();
            // Note: In the actual code, findPotentialConnectionMatches might return early
            // and the "Not Found" message might not be dispatched if the component is missing.
            // Let's check the logger/dispatcher based on the code path.
            // findPotentialConnectionMatches logs a warning in this case.
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("ConnectionsComponent not found on location"));
            // The main function then finds 0 matches and dispatches Not Found.
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // <-- Check new dispatcher
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith( // <-- Check new dispatcher
                "event:display_message",
                {text: expectedMsg, type: 'info'}
            );
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`)); // <-- Check logger
        });

        test('should return null and dispatch Not Found if ConnectionsComponent map is empty', async () => { // <-- Add async
            // Default setup already has getAllConnections return []
            const input = 'south';
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBeNull();
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // <-- Check new dispatcher
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith( // <-- Check new dispatcher
                "event:display_message",
                {text: expectedMsg, type: 'info'}
            );
            // Verify internal calls
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponentInstance.getAllConnections).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`)); // <-- Check logger
        });

        test('should return null and dispatch Not Found if connection ID is dangling', async () => { // <-- Add async
            const danglingId = 'conn-dangling';
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'up', connectionEntityId: danglingId}
            ]);
            // Ensure entityManager returns null for this specific ID
            mockEntityManager.getEntityInstance.mockImplementation((id) => {
                if (id === danglingId) return null;
                return mockEntityManager.entities.get(id); // Fallback for other IDs
            });

            const input = 'up';
            const result = await resolveTargetConnection(mockContext, input); // <-- Add await

            expect(result).toBeNull();
            // Check that findPotentialConnectionMatches logged a warning about the missing entity
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Could not find Connection entity '${danglingId}'`));
            // Check that the main function dispatched the "Not Found" message
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1); // <-- Check new dispatcher
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith( // <-- Check new dispatcher
                "event:display_message",
                {text: expectedMsg, type: 'info'}
            );
            // Verify the dangling ID was requested
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(danglingId);
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`)); // <-- Check logger
        });
    });

}); // End describe('ConnectionResolverService: resolveTargetConnection')