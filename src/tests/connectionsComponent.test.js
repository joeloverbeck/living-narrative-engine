// src/tests/connectionsComponent.test.js

import {describe, it, expect, beforeEach} from '@jest/globals';
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Adjust path as needed

describe('ConnectionsComponent', () => {
    let component;
    const mockConnectionData = {
        connections: [
            {
                connectionId: 'door_north_01',
                direction: 'north',
                target: 'room_hallway',
                initial_state: 'locked', // Explicit initial state
            },
            {
                connectionId: 'passage_east_secret',
                direction: 'east',
                target: 'room_secret',
                hidden: true, // Hidden, no initial state -> defaults to 'hidden'
            },
            {
                connectionId: 'window_south_view',
                direction: 'south',
                target: 'outside_view',
                // No initial state, not hidden -> defaults to 'unlocked'
            },
            {
                connectionId: 'portal_west_magic',
                direction: 'west',
                target: 'plane_arcane',
                hidden: true,
                initial_state: 'inactive', // Hidden, but explicit initial state overrides default
            },
            // Connection missing initial_state and hidden (should default to unlocked)
            {
                connectionId: 'archway_up',
                direction: 'up',
                target: 'room_attic',
            }
        ],
    };

    const mockEmptyData = {connections: []};
    const mockInvalidData1 = {}; // Missing connections array
    const mockInvalidData2 = {connections: null}; // connections is not an array

    beforeEach(() => {
        // Create a fresh component for each test using the standard mock data
        component = new ConnectionsComponent(mockConnectionData);
    });

    // --- Test Initialization ---
    describe('Constructor and State Initialization', () => {
        it('should initialize connections as an empty array if data is invalid or missing', () => {
            const compInvalid1 = new ConnectionsComponent(mockInvalidData1);
            const compInvalid2 = new ConnectionsComponent(mockInvalidData2);
            const compNull = new ConnectionsComponent(null);
            const compUndefined = new ConnectionsComponent(undefined);

            expect(compInvalid1.connections).toEqual([]);
            expect(compInvalid2.connections).toEqual([]);
            expect(compNull.connections).toEqual([]);
            expect(compUndefined.connections).toEqual([]);
        });

        it('should initialize connections as an empty array if data.connections is empty', () => {
            const compEmpty = new ConnectionsComponent(mockEmptyData);
            expect(compEmpty.connections).toEqual([]);
        });

        it('should deep copy connection data', () => {
            expect(component.connections).not.toBe(mockConnectionData.connections); // Ensure it's a copy
            component.connections[0].state = 'broken'; // Mutate copy
            expect(mockConnectionData.connections[0].initial_state).toBe('locked'); // Original should be unchanged
        });

        it('should initialize runtime state from initial_state if provided', () => {
            const northDoor = component.getConnectionById('door_north_01');
            const westPortal = component.getConnectionById('portal_west_magic');
            expect(northDoor?.state).toBe('locked');
            expect(westPortal?.state).toBe('inactive'); // Explicit initial state overrides hidden default
        });

        it('should initialize runtime state to "hidden" if hidden is true and initial_state is not provided', () => {
            const eastPassage = component.getConnectionById('passage_east_secret');
            expect(eastPassage?.state).toBe('hidden');
        });

        it('should initialize runtime state to "unlocked" if initial_state is not provided and hidden is false or undefined', () => {
            const southWindow = component.getConnectionById('window_south_view');
            const upArchway = component.getConnectionById('archway_up');
            expect(southWindow?.state).toBe('unlocked');
            expect(upArchway?.state).toBe('unlocked');
        });

        it('should add the state property to all connection objects', () => {
            component.connections.forEach(conn => {
                expect(conn).toHaveProperty('state');
            });
        });
    });

    // --- Test getConnectionById ---
    describe('getConnectionById', () => {
        it('should return the correct connection object for a valid ID', () => {
            const connection = component.getConnectionById('door_north_01');
            expect(connection).toBeDefined();
            expect(connection?.connectionId).toBe('door_north_01');
            expect(connection?.direction).toBe('north');
            expect(connection?.state).toBe('locked'); // Check initial state was set correctly
        });

        it('should return undefined for a non-existent ID', () => {
            const connection = component.getConnectionById('non_existent_id');
            expect(connection).toBeUndefined();
        });

        it('should return undefined for null or empty string ID', () => {
            expect(component.getConnectionById('')).toBeUndefined();
            expect(component.getConnectionById(null)).toBeUndefined();
            expect(component.getConnectionById(undefined)).toBeUndefined();
        });

        it('should be case-sensitive for IDs', () => {
            const connection = component.getConnectionById('Door_North_01'); // Incorrect case
            expect(connection).toBeUndefined();
        });
    });

    // --- Test getConnectionState ---
    describe('getConnectionState', () => {
        it('should return the current state for a valid ID', () => {
            expect(component.getConnectionState('door_north_01')).toBe('locked');
            expect(component.getConnectionState('passage_east_secret')).toBe('hidden');
            expect(component.getConnectionState('window_south_view')).toBe('unlocked');
            expect(component.getConnectionState('portal_west_magic')).toBe('inactive');
        });

        it('should return undefined for a non-existent ID', () => {
            expect(component.getConnectionState('non_existent_id')).toBeUndefined();
        });

        it('should return undefined for null or empty string ID', () => {
            expect(component.getConnectionState('')).toBeUndefined();
            expect(component.getConnectionState(null)).toBeUndefined();
            expect(component.getConnectionState(undefined)).toBeUndefined();
        });
    });

    // --- Test setConnectionState ---
    describe('setConnectionState', () => {
        it('should update the state of an existing connection and return true', () => {
            const connectionId = 'door_north_01';
            const newState = 'unlocked';

            // Verify initial state
            expect(component.getConnectionState(connectionId)).toBe('locked');

            // Set new state
            const setResult = component.setConnectionState(connectionId, newState);
            expect(setResult).toBe(true);

            // Verify updated state
            expect(component.getConnectionState(connectionId)).toBe(newState);
            // Also check the object directly
            const updatedConnection = component.getConnectionById(connectionId);
            expect(updatedConnection?.state).toBe(newState);
        });

        it('should return false for a non-existent ID and not throw error', () => {
            const setResult = component.setConnectionState('non_existent_id', 'unlocked');
            expect(setResult).toBe(false);
        });

        it('should return false for null or empty string ID', () => {
            expect(component.setConnectionState('', 'unlocked')).toBe(false);
            expect(component.setConnectionState(null, 'unlocked')).toBe(false);
            expect(component.setConnectionState(undefined, 'unlocked')).toBe(false);
        });

        it('should allow setting any string value as state (no validation yet)', () => {
            const connectionId = 'window_south_view';
            const crazyState = 'shattered_and_glowing';
            const setResult = component.setConnectionState(connectionId, crazyState);
            expect(setResult).toBe(true);
            expect(component.getConnectionState(connectionId)).toBe(crazyState);
        });
    });

    // --- Test interaction between set and get ---
    describe('State Persistence (Set then Get)', () => {
        it('getting state after setting it should return the new state', () => {
            const connectionId = 'passage_east_secret'; // Starts as 'hidden'
            const newState = 'revealed';

            // Set
            const setResult = component.setConnectionState(connectionId, newState);
            expect(setResult).toBe(true);

            // Get immediately after
            const currentState = component.getConnectionState(connectionId);
            expect(currentState).toBe(newState);
        });

        it('setting state multiple times should reflect the latest state', () => {
            const connectionId = 'archway_up'; // Starts as 'unlocked'
            component.setConnectionState(connectionId, 'sealed');
            expect(component.getConnectionState(connectionId)).toBe('sealed');
            component.setConnectionState(connectionId, 'open');
            expect(component.getConnectionState(connectionId)).toBe('open');
        });
    });
});