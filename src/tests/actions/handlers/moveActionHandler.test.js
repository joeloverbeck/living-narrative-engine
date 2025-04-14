import {describe, it, expect, beforeEach, jest} from '@jest/globals';

// --- Mock Dependencies ---
jest.mock('../../../utils/actionValidationUtils.js', () => {
    const mockValidateFn = jest.fn();
    return {
        validateRequiredCommandPart: mockValidateFn,
    };
});

// --- Import Modules Under Test AND the MOCKED function ---
import {executeMove} from '../../../actions/handlers/moveActionHandler.js';
import {validateRequiredCommandPart as mockValidateRequiredCommandPart} from '../../../utils/actionValidationUtils.js';

// Import other non-mocked dependencies
import {ConnectionsComponent} from '../../../components/connectionsComponent.js';
import {PositionComponent} from '../../../components/positionComponent.js';


// --- Test Suite ---
describe('executeMove Action Handler', () => {
    // --- Declare Mock Variables ---
    let mockDispatch;
    let mockPlayerEntity;
    let mockCurrentLocation;
    let mockPositionComponent;
    let mockConnectionsComponent;
    let mockDataManager;
    let mockParsedCommand;
    let mockContext;

    // --- Setup Mocks Before Each Test ---
    beforeEach(() => {
        // Reset mocks to ensure test isolation
        mockDispatch = jest.fn();
        mockValidateRequiredCommandPart.mockClear();
        mockValidateRequiredCommandPart.mockReturnValue(true); // Default pass

        // --- Mock Player Entity and its Components ---
        mockPositionComponent = {
            locationId: 'loc-start',
        };
        mockPlayerEntity = {
            id: 'player-1',
            getComponent: jest.fn().mockImplementation((componentConstructor) => {
                if (componentConstructor === PositionComponent) {
                    return mockPositionComponent;
                }
                return undefined;
            }),
        };

        // --- Mock Current Location Entity and its Components ---
        mockConnectionsComponent = {
            getConnectionByDirection: jest.fn().mockReturnValue(undefined),
            connections: [{direction: 'south', target: 'loc-south'}],
        };
        mockCurrentLocation = {
            id: 'loc-start',
            getComponent: jest.fn().mockImplementation((componentConstructor) => {
                if (componentConstructor === ConnectionsComponent) {
                    return mockConnectionsComponent;
                }
                return undefined;
            }),
        };

        // --- Mock Data Manager ---
        mockDataManager = {
            getEntityDefinition: jest.fn().mockReturnValue(undefined),
        };

        // --- Mock Parsed Command ---
        mockParsedCommand = {
            verb: 'move',
            directObjectPhrase: 'north',
            indirectObjectPhrase: null,
            prepositionalPhrase: null,
        };

        // --- Assemble Base Mock Context ---
        mockContext = {
            playerEntity: mockPlayerEntity,
            currentLocation: mockCurrentLocation,
            dataManager: mockDataManager,
            dispatch: mockDispatch,
            parsedCommand: mockParsedCommand,
        };
    });

    // --- Basic Setup Test ---
    it('should be defined and importable', () => {
        expect(executeMove).toBeDefined();
        expect(typeof executeMove).toBe('function');
        expect(mockValidateRequiredCommandPart).toBeDefined();
        expect(jest.isMockFunction(mockValidateRequiredCommandPart)).toBe(true);
    });

    // --- Tests for Sub-Ticket 5.6.2 (Input Validation Failures) ---
    describe('Initial Context and Input Validation Failures (Sub-Ticket 5.6.2)', () => {
        it('AC1: should dispatch action:move_failed with SETUP_ERROR if currentLocation is missing', () => {
            mockContext.currentLocation = null;
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: 'player-1',
                reasonCode: 'SETUP_ERROR',
                details: 'Current location unknown',
            });
            expect(mockValidateRequiredCommandPart).not.toHaveBeenCalled();
        });

        it('AC2: should dispatch action:move_failed with SETUP_ERROR if player PositionComponent is missing', () => {
            mockPlayerEntity.getComponent.mockImplementation((constructor) =>
                constructor === PositionComponent ? undefined : undefined
            );
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: 'player-1',
                locationId: 'loc-start',
                reasonCode: 'SETUP_ERROR',
                details: 'Player position unknown',
            });
            expect(mockValidateRequiredCommandPart).toHaveBeenCalledTimes(1);
        });


        it('AC3: should return success: false and not dispatch if validateRequiredCommandPart fails', () => {
            mockValidateRequiredCommandPart.mockReturnValue(false);
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockValidateRequiredCommandPart).toHaveBeenCalledTimes(1);
            expect(mockValidateRequiredCommandPart).toHaveBeenCalledWith(
                mockContext, 'move', 'directObjectPhrase'
            );
            expect(mockDispatch).not.toHaveBeenCalled();
        });
    });

    // --- Tests for Sub-Ticket 5.6.3 (Connection Finding Failures) ---
    describe('Connection Finding Failures (Sub-Ticket 5.6.3)', () => {

        it('AC1: should fail with NO_EXITS if ConnectionsComponent is missing', () => {
            mockCurrentLocation.getComponent.mockImplementation((componentConstructor) => {
                if (componentConstructor === ConnectionsComponent) {
                    return undefined;
                }
                return undefined;
            });
            mockParsedCommand.directObjectPhrase = 'east';
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: 'player-1',
                locationId: 'loc-start',
                direction: 'east',
                reasonCode: 'NO_EXITS'
            });
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
        });

        it.each([
            {case: 'null', connectionsValue: null},
            {case: 'undefined', connectionsValue: undefined},
            {case: 'empty array', connectionsValue: []},
        ])('AC2: should fail with NO_EXITS if connections property is $case', ({connectionsValue}) => {
            mockConnectionsComponent.connections = connectionsValue;
            mockCurrentLocation.getComponent.mockImplementation((componentConstructor) => {
                if (componentConstructor === ConnectionsComponent) {
                    return mockConnectionsComponent;
                }
                return undefined;
            });
            mockParsedCommand.directObjectPhrase = 'west';
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: 'player-1',
                locationId: 'loc-start',
                direction: 'west',
                reasonCode: 'NO_EXITS'
            });
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
        });

        it('AC3: should fail with INVALID_DIRECTION if getConnectionByDirection returns null/undefined', () => {
            mockParsedCommand.directObjectPhrase = 'north';
            mockConnectionsComponent.connections = [{direction: 'south', target: 'loc-south'}];
            mockConnectionsComponent.getConnectionByDirection.mockImplementation((dir) => {
                if (dir === 'north') {
                    return null;
                }
                return undefined;
            });
            mockCurrentLocation.getComponent.mockImplementation((constructor) =>
                constructor === ConnectionsComponent ? mockConnectionsComponent : undefined
            );
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledWith('north');
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: 'player-1',
                locationId: 'loc-start',
                direction: 'north',
                reasonCode: 'INVALID_DIRECTION'
            });
        });

        it('AC4: should fail with DATA_ERROR if connection object lacks a target property', () => {
            const directionToTest = 'up';
            mockParsedCommand.directObjectPhrase = 'up';
            const connectionWithoutTarget = {direction: 'up'};
            mockConnectionsComponent.getConnectionByDirection.mockImplementation((dir) => {
                if (dir === directionToTest) {
                    return connectionWithoutTarget;
                }
                return undefined;
            });
            mockCurrentLocation.getComponent.mockImplementation((constructor) =>
                constructor === ConnectionsComponent ? mockConnectionsComponent : undefined
            );
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledWith(directionToTest);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: 'player-1',
                locationId: 'loc-start',
                direction: directionToTest,
                reasonCode: 'DATA_ERROR',
                details: 'Invalid connection: missing target'
            });
        });

        it('AC4: should fail with DATA_ERROR if connection target property is null', () => {
            const directionToTest = 'down';
            mockParsedCommand.directObjectPhrase = 'down';
            const connectionWithNullTarget = {direction: 'down', target: null};
            mockConnectionsComponent.getConnectionByDirection.mockImplementation((dir) => {
                if (dir === directionToTest) {
                    return connectionWithNullTarget;
                }
                return undefined;
            });
            mockCurrentLocation.getComponent.mockImplementation((constructor) =>
                constructor === ConnectionsComponent ? mockConnectionsComponent : undefined
            );
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledWith(directionToTest);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: 'player-1',
                locationId: 'loc-start',
                direction: directionToTest,
                reasonCode: 'DATA_ERROR',
                details: 'Invalid connection: missing target'
            });
        });
    });

    // --- Tests for Sub-Ticket 5.6.4 (Target Validation Failures) ---
    describe('Target Location Validation Failures (Sub-Ticket 5.6.4)', () => {
        it('AC: should fail with DATA_ERROR if target definition is not found', () => {
            const directionToTest = 'north';
            const targetIdNotFound = 'loc-target-nonexistent';
            mockParsedCommand.directObjectPhrase = directionToTest;
            const validConnection = {direction: directionToTest, target: targetIdNotFound};
            mockConnectionsComponent.getConnectionByDirection.mockImplementation((dir) => {
                if (dir === directionToTest) {
                    return validConnection;
                }
                return undefined;
            });
            mockCurrentLocation.getComponent.mockImplementation((constructor) =>
                constructor === ConnectionsComponent ? mockConnectionsComponent : undefined
            );
            mockDataManager.getEntityDefinition.mockImplementation((entityId) => {
                if (entityId === targetIdNotFound) {
                    return null;
                }
                return {id: entityId, name: 'Some Other Location'};
            });
            mockValidateRequiredCommandPart.mockReturnValue(true);
            const result = executeMove(mockContext);
            expect(result).toEqual({success: false});
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledWith(directionToTest);
            expect(mockDataManager.getEntityDefinition).toHaveBeenCalledTimes(1);
            expect(mockDataManager.getEntityDefinition).toHaveBeenCalledWith(targetIdNotFound);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('action:move_failed', {
                actorId: mockPlayerEntity.id,
                locationId: mockCurrentLocation.id,
                direction: directionToTest,
                targetLocationId: targetIdNotFound,
                reasonCode: 'DATA_ERROR',
                details: 'Target location definition not found'
            });
        });
    });

    // --- Tests for Sub-Ticket 5.6.5 (Successful Dispatch - No Blocker) ---
    describe('Successful Move Attempt Dispatch (No Blocker) (Sub-Ticket 5.6.5)', () => {
        it('AC 1-7: should dispatch event:move_attempted and return success: true for a valid move without a blocker', () => {
            const directionToTest = 'south';
            const targetLocationId = 'loc-south';
            mockParsedCommand.directObjectPhrase = directionToTest;
            const validConnectionWithoutBlocker = {
                direction: directionToTest,
                target: targetLocationId,
            };
            mockConnectionsComponent.getConnectionByDirection.mockImplementation((dir) => {
                if (dir === directionToTest) {
                    return validConnectionWithoutBlocker;
                }
                return undefined;
            });
            mockCurrentLocation.getComponent.mockImplementation((constructor) =>
                constructor === ConnectionsComponent ? mockConnectionsComponent : undefined
            );
            const mockTargetDefinition = {id: targetLocationId, name: "Southern Room"};
            mockDataManager.getEntityDefinition.mockImplementation((entityId) => {
                if (entityId === targetLocationId) {
                    return mockTargetDefinition;
                }
                return null;
            });

            const result = executeMove(mockContext);

            expect(result).toEqual({success: true});
            expect(mockValidateRequiredCommandPart).toHaveBeenCalledTimes(1);
            expect(mockPlayerEntity.getComponent).toHaveBeenCalledWith(PositionComponent);
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledWith(directionToTest);
            expect(mockDataManager.getEntityDefinition).toHaveBeenCalledTimes(1);
            expect(mockDataManager.getEntityDefinition).toHaveBeenCalledWith(targetLocationId);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            const expectedPayload = {
                entityId: mockPlayerEntity.id,
                targetLocationId: targetLocationId,
                direction: directionToTest,
                previousLocationId: mockPositionComponent.locationId
            };
            expect(mockDispatch).toHaveBeenCalledWith('event:move_attempted', expectedPayload);
            const actualPayload = mockDispatch.mock.calls[0][1];
            expect(actualPayload).not.toHaveProperty('blockerEntityId');
        });

        it('should handle direction aliases correctly on success path (no blocker)', () => {
            const directionAlias = 's';
            const normalizedDirection = 'south';
            const targetLocationId = 'loc-south';
            mockParsedCommand.directObjectPhrase = directionAlias;
            const validConnectionWithoutBlocker = {
                direction: normalizedDirection,
                target: targetLocationId,
            };
            mockConnectionsComponent.getConnectionByDirection.mockImplementation((dir) => {
                if (dir === normalizedDirection) {
                    return validConnectionWithoutBlocker;
                }
                return undefined;
            });
            mockCurrentLocation.getComponent.mockImplementation((constructor) =>
                constructor === ConnectionsComponent ? mockConnectionsComponent : undefined
            );
            const mockTargetDefinition = {id: targetLocationId, name: "Southern Room"};
            mockDataManager.getEntityDefinition.mockImplementation((entityId) => {
                if (entityId === targetLocationId) {
                    return mockTargetDefinition;
                }
                return null;
            });

            const result = executeMove(mockContext);

            expect(result).toEqual({success: true});
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledWith(normalizedDirection);
            expect(mockDispatch).toHaveBeenCalledTimes(1);
            expect(mockDispatch).toHaveBeenCalledWith('event:move_attempted', expect.objectContaining({
                direction: normalizedDirection,
                entityId: mockPlayerEntity.id,
                targetLocationId: targetLocationId,
                previousLocationId: mockPositionComponent.locationId
            }));
            const actualPayload = mockDispatch.mock.calls[0][1];
            expect(actualPayload).not.toHaveProperty('blockerEntityId');
        });
    }); // End describe 'Successful Move Attempt Dispatch (No Blocker) (Sub-Ticket 5.6.5)'


    // --- **Tests for Sub-Ticket 5.6.6 (Successful Dispatch - With Blocker)** ---
    describe('Successful Move Attempt Dispatch (With Blocker) (Sub-Ticket 5.6.6)', () => {

        it('AC 1-7: should dispatch event:move_attempted with blockerEntityId and return success: true', () => {
            // Arrange: Configure mocks for a successful move to the 'east' via a blocked connection
            const directionToTest = 'east';
            const targetLocationId = 'loc-east';
            const blockerId = 'door_entity_blocker_99'; // Specific blocker ID for this test
            mockParsedCommand.directObjectPhrase = directionToTest; // Player command

            // AC 1 (Given): Mock connection finding to succeed *with* a blocker ID
            const validConnectionWithBlocker = {
                direction: directionToTest,
                target: targetLocationId,
                blockerEntityId: blockerId // <<-- The crucial part for this test
            };
            mockConnectionsComponent.getConnectionByDirection.mockImplementation((dir) => {
                if (dir === directionToTest) {
                    return validConnectionWithBlocker;
                }
                return undefined;
            });
            // Ensure ConnectionsComponent *is* returned by the location mock
            mockCurrentLocation.getComponent.mockImplementation((constructor) =>
                constructor === ConnectionsComponent ? mockConnectionsComponent : undefined
            );

            // AC 2 (Given): Mock dataManager to find the target location definition
            const mockTargetDefinition = {id: targetLocationId, name: "Eastern Corridor"};
            mockDataManager.getEntityDefinition.mockImplementation((entityId) => {
                if (entityId === targetLocationId) {
                    return mockTargetDefinition;
                }
                return null;
            });

            // AC 3 (Given): Ensure basic validations pass (defaults in beforeEach are sufficient)
            // mockValidateRequiredCommandPart already returns true by default

            // Act (When): Execute the move handler
            const result = executeMove(mockContext);

            // Assert (Then):
            // AC 7: Check return value
            expect(result).toEqual({success: true});

            // Verify intermediate mock calls
            expect(mockValidateRequiredCommandPart).toHaveBeenCalledTimes(1);
            expect(mockPlayerEntity.getComponent).toHaveBeenCalledWith(PositionComponent);
            expect(mockCurrentLocation.getComponent).toHaveBeenCalledWith(ConnectionsComponent);
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledTimes(1);
            expect(mockConnectionsComponent.getConnectionByDirection).toHaveBeenCalledWith(directionToTest); // Normalized direction
            expect(mockDataManager.getEntityDefinition).toHaveBeenCalledTimes(1);
            expect(mockDataManager.getEntityDefinition).toHaveBeenCalledWith(targetLocationId);

            // AC 4: Verify dispatch was called exactly once
            expect(mockDispatch).toHaveBeenCalledTimes(1);

            // AC 5, 6: Verify the dispatch payload, including the blockerEntityId
            const expectedPayload = {
                entityId: mockPlayerEntity.id,                  // 'player-1'
                targetLocationId: targetLocationId,             // 'loc-east'
                direction: directionToTest,                     // 'east' (normalized)
                previousLocationId: mockPositionComponent.locationId, // 'loc-start'
                blockerEntityId: blockerId                      // <<-- Must be present and correct
            };
            expect(mockDispatch).toHaveBeenCalledWith('event:move_attempted', expectedPayload);

            // Optional: Explicitly check blockerEntityId *is* present in the actual dispatched payload
            const actualPayload = mockDispatch.mock.calls[0][1]; // Get the payload from the first call
            expect(actualPayload).toHaveProperty('blockerEntityId', blockerId);
        });

    }); // End describe 'Successful Move Attempt Dispatch (With Blocker) (Sub-Ticket 5.6.6)'

}); // End describe 'executeMove Action Handler'