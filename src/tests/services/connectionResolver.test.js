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
import {getDisplayName} from '../../utils/messages.js'; // Adjust path

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

        // 2. Setup fresh mocks for each test
        mockDispatch = jest.fn();
        const mockEventBus = { // Create a mock eventBus object
            dispatch: mockDispatch // Assign the mock dispatch function to its dispatch property
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
            // dispatch: mockDispatch, // Remove or comment out the direct dispatch
            eventBus: mockEventBus, // Add the mock eventBus containing the dispatch function
            entityManager: mockEntityManager,
            currentLocation: mockCurrentLocation,
            playerEntity: new Entity('player-test'),
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
        ])('should return null and not dispatch for invalid input: %p', (invalidInput) => {
            const result = resolveTargetConnection(mockContext, invalidInput);
            expect(result).toBeNull();
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    // --- Scenario: Unique Direction Match ---
    describe('Unique Direction Match', () => {
        let northEntity;
        beforeEach(() => {
            northEntity = createMockConnectionEntity('conn-n', 'North Passage');
            // Setup ConnectionsComponent mock for this scenario
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'north', connectionEntityId: northEntity.id}
            ]);
        });

        test.each([
            ['north'],
            ['NORTH'],
            [' north '],
        ])('should return the correct entity for unique direction "%s"', (input) => {
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBe(northEntity);
            expect(mockDispatch).not.toHaveBeenCalled();
            // Verify internal calls (optional but good for sanity check)
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponentInstance.getAllConnections).toHaveBeenCalled();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(northEntity.id);
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

        test('should return null and dispatch AMBIGUOUS_DIRECTION message', () => {
            const input = 'west';
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBeNull();
            expect(mockDispatch).toHaveBeenCalledTimes(1);

            const expectedNames = [getDisplayName(westEntity1), getDisplayName(westEntity2)];
            // Sort expected names if the message function doesn't guarantee order
            expectedNames.sort();
            // Check call arguments robustly
            expect(mockDispatch).toHaveBeenCalledWith(
                'ui:message_display',
                expect.objectContaining({
                    text: expect.stringContaining(`There are multiple ways to go '${input}'`), // Check key parts
                    text: expect.stringContaining(getDisplayName(westEntity1)),
                    text: expect.stringContaining(getDisplayName(westEntity2)),
                    // OR if TARGET_MESSAGES.AMBIGUOUS_DIRECTION is reliable:
                    // text: TARGET_MESSAGES.AMBIGUOUS_DIRECTION(input, expect.arrayContaining(expectedNames)),
                    type: 'warning'
                })
            );
            // More precise check if TARGET_MESSAGES function is stable
            const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(input, [getDisplayName(westEntity1), getDisplayName(westEntity2)]);
            expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {text: expectedMsg, type: 'warning'});
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
            [' ornate '],
            ['Ornate Door'],
        ])('should return the correct entity for unique name match "%s"', (input) => {
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBe(doorEntity);
            expect(mockDispatch).not.toHaveBeenCalled();
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(doorEntity.id);
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

        test('should return null and dispatch TARGET_AMBIGUOUS_CONTEXT message', () => {
            const input = 'path';
            const actionVerb = 'examine'; // Example verb
            const result = resolveTargetConnection(mockContext, input, actionVerb);

            expect(result).toBeNull();
            expect(mockDispatch).toHaveBeenCalledTimes(1);

            const expectedEntities = [pathEntity1, pathEntity2];
            // --- FIX: Generate expectedMsg using the actual array ---
            const expectedMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, input, expectedEntities); // Pass the actual array here

            expect(mockDispatch).toHaveBeenCalledWith(
                'ui:message_display',
                // Now this comparison should work correctly
                {text: expectedMsg, type: 'warning'}
            );
        });
    });

    // --- Scenario: Prioritization (Direction > Name) ---
    describe('Prioritization (Direction over Name)', () => {
        let eastDirEntity; // Matches direction 'east'
        let upNameEntity; // Matches name 'east' (e.g., "East Window")
        beforeEach(() => {
            eastDirEntity = createMockConnectionEntity('conn-e', 'Corridor');
            upNameEntity = createMockConnectionEntity('conn-u', 'East Window');
            mockConnectionsComponentInstance.getAllConnections.mockReturnValue([
                {direction: 'east', connectionEntityId: eastDirEntity.id}, // Direction match
                {direction: 'up', connectionEntityId: upNameEntity.id}   // Name match
            ]);
        });

        test('should return the entity matched by direction when input matches both', () => {
            const input = 'east';
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBe(eastDirEntity); // Prioritizes direction match
            expect(mockDispatch).not.toHaveBeenCalled();
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

        test('should return null and dispatch TARGET_NOT_FOUND_CONTEXT message', () => {
            const input = 'teleporter'; // Doesn't match 'north' or 'North Exit'
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBeNull();
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockDispatch).toHaveBeenCalledWith(
                'ui:message_display',
                {text: expectedMsg, type: 'info'}
            );
        });
    });

    // --- Scenario: Edge Cases ---
    describe('Edge Cases', () => {
        test('should return null and dispatch Not Found if location lacks ConnectionsComponent', () => {
            // Override default mock for this test
            mockCurrentLocation.getComponent.mockReturnValue(undefined);
            const input = 'north';
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBeNull();
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockDispatch).toHaveBeenCalledWith(
                'ui:message_display',
                {text: expectedMsg, type: 'info'}
            );
        });

        test('should return null and dispatch Not Found if ConnectionsComponent map is empty', () => {
            // Default setup already has getAllConnections return []
            const input = 'south';
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBeNull();
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockDispatch).toHaveBeenCalledWith(
                'ui:message_display',
                {text: expectedMsg, type: 'info'}
            );
            // Verify internal calls
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponentInstance.getAllConnections).toHaveBeenCalled();
        });

        test('should return null and dispatch Not Found if connection ID is dangling', () => {
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
            const result = resolveTargetConnection(mockContext, input);

            expect(result).toBeNull();
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
            expect(mockDispatch).toHaveBeenCalledWith(
                'ui:message_display',
                {text: expectedMsg, type: 'info'}
            );
            // Verify the dangling ID was requested
            expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(danglingId);
        });
    });

}); // End describe('ConnectionResolverService: resolveTargetConnection')