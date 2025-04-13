import {describe, it, expect, beforeEach} from '@jest/globals';
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Adjust path as needed

describe('ConnectionsComponent', () => {
    let component;
    // Original mock data (no blockers)
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
            {
                connectionId: 'archway_up',
                direction: 'up',
                target: 'room_attic',
                // No initial state, not hidden -> defaults to 'unlocked'
            }
        ],
    };

    // New mock data including connections with blockerEntityId and blockable
    const mockConnectionDataWithBlockers = {
        connections: [
            // Include original connections for broader testing if needed, or keep separate
            {
                connectionId: 'door_north_01', // Original, no blocker
                direction: 'north',
                target: 'room_hallway',
                initial_state: 'locked',
            },
            {
                connectionId: 'passage_east_secret', // Original, hidden, no blocker
                direction: 'east',
                target: 'room_secret',
                hidden: true,
            },
            // --- Connections specifically for blocker tests ---
            {
                connectionId: 'door_blocked_locked_init',
                direction: 'down',
                target: 'room_cellar',
                initial_state: 'locked', // Should be IGNORED due to blocker
                blockerEntityId: 'entity_heavy_door_01'
                // hidden: false (default), blockable: false (default)
            },
            {
                connectionId: 'passage_blocked_hidden',
                direction: 'secret',
                target: 'room_vault',
                initial_state: 'active', // Should be IGNORED due to blocker AND hidden
                hidden: true,
                blockerEntityId: 'entity_magic_seal_01',
                blockable: true // Explicitly blockable
            },
            {
                connectionId: 'gate_open_blockable',
                direction: 'forward',
                target: 'room_courtyard',
                blockerEntityId: null, // Explicitly NO blocker
                blockable: true // Explicitly blockable, but no blocker specified
            },
            {
                connectionId: 'window_no_blocker_id',
                direction: 'lookout',
                target: 'viewpoint',
                blockerEntityId: undefined, // Test undefined blocker defaults to null
                blockable: false // Explicitly false blockable
            }
        ],
    };


    const mockEmptyData = {connections: []};
    const mockInvalidData1 = {}; // Missing connections array
    const mockInvalidData2 = {connections: null}; // connections is not an array

    // Use the simpler mock data for general tests
    beforeEach(() => {
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
            // Use data without blockers for this test simplicity
            const compForCopy = new ConnectionsComponent(mockConnectionData);
            expect(compForCopy.connections).not.toBe(mockConnectionData.connections); // Ensure it's a copy
            compForCopy.connections[0].state = 'broken'; // Mutate copy
            // Verify original input object property 'initial_state' wasn't changed
            expect(mockConnectionData.connections.find(c => c.connectionId === 'door_north_01').initial_state).toBe('locked');
            // Verify original input object property 'hidden' wasn't changed
            expect(mockConnectionData.connections.find(c => c.connectionId === 'passage_east_secret').hidden).toBe(true);
        });

        it('should add the state property to all connection objects', () => {
            component.connections.forEach(conn => {
                expect(conn).toHaveProperty('state');
            });
            // Also test with the blocker data
            const componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
            componentWithBlockers.connections.forEach(conn => {
                expect(conn).toHaveProperty('state');
                expect(conn).toHaveProperty('blockerEntityId'); // Check these are added too
                expect(conn).toHaveProperty('blockable');
            });
        });

        // --- Tests for blockerEntityId and blockable property storage (AC 1) ---
        describe('when handling blockerEntityId and blockable properties', () => {
            let componentWithBlockers;
            beforeEach(() => {
                // Use the new mock data for these specific tests
                componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
            });

            it('should correctly store blockerEntityId when provided', () => {
                const blockedDoor = componentWithBlockers.getConnectionById('door_blocked_locked_init');
                const hiddenPassage = componentWithBlockers.getConnectionById('passage_blocked_hidden');
                expect(blockedDoor?.blockerEntityId).toBe('entity_heavy_door_01');
                expect(hiddenPassage?.blockerEntityId).toBe('entity_magic_seal_01');
            });

            it('should store blockerEntityId as null if missing, null, or undefined in data', () => {
                const northDoor = componentWithBlockers.getConnectionById('door_north_01'); // From original data section
                const blockableGate = componentWithBlockers.getConnectionById('gate_open_blockable'); // Explicitly null
                const undefinedBlockerWindow = componentWithBlockers.getConnectionById('window_no_blocker_id'); // Undefined input
                expect(northDoor?.blockerEntityId).toBeNull();
                expect(blockableGate?.blockerEntityId).toBeNull();
                expect(undefinedBlockerWindow?.blockerEntityId).toBeNull();
            });

            it('should correctly store blockable flag when provided', () => {
                const hiddenPassage = componentWithBlockers.getConnectionById('passage_blocked_hidden'); // true
                const blockableGate = componentWithBlockers.getConnectionById('gate_open_blockable'); // true
                const nonBlockableWindow = componentWithBlockers.getConnectionById('window_no_blocker_id'); // false
                expect(hiddenPassage?.blockable).toBe(true);
                expect(blockableGate?.blockable).toBe(true);
                expect(nonBlockableWindow?.blockable).toBe(false);
            });

            it('should default blockable to false if missing', () => {
                const blockedDoor = componentWithBlockers.getConnectionById('door_blocked_locked_init'); // Missing blockable
                const northDoor = componentWithBlockers.getConnectionById('door_north_01'); // Missing blockable
                expect(blockedDoor?.blockable).toBe(false);
                expect(northDoor?.blockable).toBe(false);
            });
        });


        // --- Tests for state initialization with blockerEntityId (AC 2) ---
        describe('when blockerEntityId is present', () => {
            let componentWithBlockers;
            beforeEach(() => {
                componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
            });

            it('should initialize state to "hidden" if hidden is true, ignoring initial_state', () => {
                const hiddenPassage = componentWithBlockers.getConnectionById('passage_blocked_hidden');
                // Input had initial_state: 'active', hidden: true, blockerEntityId: present
                // Expected state: 'hidden'
                expect(hiddenPassage?.state).toBe('hidden');
            });

            it('should initialize state to "unlocked" if hidden is false or omitted, ignoring initial_state', () => {
                const blockedDoor = componentWithBlockers.getConnectionById('door_blocked_locked_init');
                // Input had initial_state: 'locked', hidden: false (default), blockerEntityId: present
                // Expected state: 'unlocked'
                expect(blockedDoor?.state).toBe('unlocked');
            });
        });

        // --- Tests for state initialization without blockerEntityId (AC 3) ---
        describe('when blockerEntityId is NOT present (null)', () => {
            // Use the original component/data for these tests
            it('should initialize state from initial_state if provided', () => {
                const northDoor = component.getConnectionById('door_north_01');
                const westPortal = component.getConnectionById('portal_west_magic');
                expect(northDoor?.state).toBe('locked');
                expect(westPortal?.state).toBe('inactive'); // Explicit initial state overrides hidden default
            });

            it('should initialize state to "hidden" if hidden is true and initial_state is not provided', () => {
                const eastPassage = component.getConnectionById('passage_east_secret');
                expect(eastPassage?.state).toBe('hidden');
            });

            it('should initialize state to "unlocked" if initial_state is not provided and hidden is false or undefined', () => {
                const southWindow = component.getConnectionById('window_south_view');
                const upArchway = component.getConnectionById('archway_up');
                expect(southWindow?.state).toBe('unlocked');
                expect(upArchway?.state).toBe('unlocked');
            });

            // Test case with blockable:true but blockerEntityId:null (should use normal logic)
            it('should use normal state logic if blockable is true but blockerEntityId is null', () => {
                const componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
                const blockableGate = componentWithBlockers.getConnectionById('gate_open_blockable');
                // blockable: true, blockerEntityId: null, no initial_state, not hidden
                expect(blockableGate?.state).toBe('unlocked'); // Defaults to unlocked
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
            expect(connection?.state).toBe('locked'); // Check initial state (no blocker)
        });

        it('should return the correct connection object including blocker properties if present', () => {
            const componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
            const connection = componentWithBlockers.getConnectionById('door_blocked_locked_init');
            expect(connection).toBeDefined();
            expect(connection?.connectionId).toBe('door_blocked_locked_init');
            expect(connection?.blockerEntityId).toBe('entity_heavy_door_01');
            expect(connection?.blockable).toBe(false);
            expect(connection?.state).toBe('unlocked'); // Check initial state (with blocker)
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
        it('should return the current state for a valid ID (no blocker cases)', () => {
            expect(component.getConnectionState('door_north_01')).toBe('locked');
            expect(component.getConnectionState('passage_east_secret')).toBe('hidden');
            expect(component.getConnectionState('window_south_view')).toBe('unlocked');
            expect(component.getConnectionState('portal_west_magic')).toBe('inactive');
        });

        it('should return the initial state for a valid ID (with blocker cases)', () => {
            const componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
            expect(componentWithBlockers.getConnectionState('door_blocked_locked_init')).toBe('unlocked');
            expect(componentWithBlockers.getConnectionState('passage_blocked_hidden')).toBe('hidden');
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

    // --- Optional: Add tests for new helper methods if desired ---
    describe('getConnectionBlockerId', () => {
        let componentWithBlockers;
        beforeEach(() => {
            componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
        });

        it('should return the blocker ID if present', () => {
            expect(componentWithBlockers.getConnectionBlockerId('door_blocked_locked_init')).toBe('entity_heavy_door_01');
        });

        it('should return null if blocker ID is explicitly null or not present', () => {
            expect(componentWithBlockers.getConnectionBlockerId('door_north_01')).toBeNull();
            expect(componentWithBlockers.getConnectionBlockerId('gate_open_blockable')).toBeNull();
        });

        it('should return undefined if connection ID is not found', () => {
            expect(componentWithBlockers.getConnectionBlockerId('non_existent_id')).toBeUndefined();
        });
    });

    describe('isConnectionBlockable', () => {
        let componentWithBlockers;
        beforeEach(() => {
            componentWithBlockers = new ConnectionsComponent(mockConnectionDataWithBlockers);
        });

        it('should return true if blockable is true', () => {
            expect(componentWithBlockers.isConnectionBlockable('passage_blocked_hidden')).toBe(true);
            expect(componentWithBlockers.isConnectionBlockable('gate_open_blockable')).toBe(true);
        });

        it('should return false if blockable is false or not present', () => {
            expect(componentWithBlockers.isConnectionBlockable('door_north_01')).toBe(false);
            expect(componentWithBlockers.isConnectionBlockable('door_blocked_locked_init')).toBe(false);
            expect(componentWithBlockers.isConnectionBlockable('window_no_blocker_id')).toBe(false);
        });

        it('should return undefined if connection ID is not found', () => {
            expect(componentWithBlockers.isConnectionBlockable('non_existent_id')).toBeUndefined();
        });
    });

});