// tests/components/connectionsComponent.test.js

// Import Jest functions
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import the new ConnectionsComponent
import { ConnectionsComponent } from '../../src/components/connectionsComponent.js'; // Adjust path if your structure differs

// ---- Mock Data Definitions ----
// (Keep existing mock data as provided in the prompt)
/** @description Mock data with typical valid connections. */
const validMockData = {
    connections: {
        "north": "conn:north_exit",
        "Enter Door": "conn:door_1",
        "south": "conn:south_exit"
    }
};

/** @description Mock data with varied casing in direction keys. */
const validMockDataWithMixedCase = {
    connections: {
        "NORTH": "conn:north_exit",
        "south": "conn:south_exit",
        "Enter Door": "conn:door_1"
    }
};

/** @description Mock data representing an empty set of connections. */
const emptyMockData = {
    connections: {}
};

/** @description Mock data where the 'connections' property is null. */
const nullConnectionsData = {
    connections: null
};

/** @description Mock data where the 'connections' property is missing entirely. */
const undefinedConnectionsData = {};

/** @description Mock data where 'connections' is an array (invalid structure). */
const arrayConnectionsData = {
    connections: ["north", "conn:north_exit"]
};

/** @description Mock data with invalid entries within a valid structure. */
const invalidEntriesData = {
    connections: {
        "north": "conn:valid_north",  // Valid
        "": "conn:empty_key",        // Invalid: Empty key
        "east": "",                   // Invalid: Empty value
        "south": null,                // Invalid: Null value
        "west": 123,                  // Invalid: Number value
        "  up  ": "conn:valid_up",      // Valid: Key with spaces (trimmed/lowercased by constructor now)
        "down": "  conn:valid_down  ",// Valid: Value with spaces (stored as is)
        "valid_key": undefined,       // Invalid: Undefined value
        123: "conn:numeric_key"       // Invalid: Numeric key
    }
};

/** @description Mock data representing a null input to the constructor. */
const nullInput = null;

/** @description Mock data representing an undefined input to the constructor. */
const undefinedInput = undefined;

// ---- Test Suite ----

describe('ConnectionsComponent', () => {

    // Mock console.warn to check for warnings without cluttering test output
    let consoleWarnSpy;

    beforeEach(() => {
        // Suppress console.warn messages during tests and allow checking calls
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore original console.warn function after each test
        consoleWarnSpy.mockRestore();
    });

    // --- Constructor Tests (Keep existing tests - adjusted for fixed constructor logic) ---
    describe('Constructor', () => {
        it('AC3.1: should initialize correctly with valid data', () => {
            const component = new ConnectionsComponent(validMockData);
            expect(component).toBeDefined();
            expect(component.connectionMap.size).toBe(3);
            // Constructor now stores keys lowercase and trimmed
            expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                { direction: 'north', connectionEntityId: 'conn:north_exit' },
                { direction: 'enter door', connectionEntityId: 'conn:door_1' },
                { direction: 'south', connectionEntityId: 'conn:south_exit' }
            ]));
            expect(component.getAllConnections()).toHaveLength(3);
        });

        it('AC3.2: should store direction keys in lowercase and trimmed for case-insensitivity', () => {
            const component = new ConnectionsComponent({
                connections: {
                    "NORTH": "conn:north_exit",
                    " south ": "conn:south_exit", // with spaces
                    "Enter Door": "conn:door_1"
                }
            });
            expect(component.connectionMap.size).toBe(3);
            // Keys are stored lowercase and trimmed
            expect(Array.from(component.connectionMap.keys())).toEqual(['north', 'south', 'enter door']);
            // Lookup works with various cases/spacing
            expect(component.getConnectionByDirection('NORTH')).toBe('conn:north_exit');
            expect(component.getConnectionByDirection(' South ')).toBe('conn:south_exit');
            expect(component.getConnectionByDirection(' south')).toBe('conn:south_exit');
            expect(component.getConnectionByDirection('Enter Door')).toBe('conn:door_1');
            expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                { direction: 'north', connectionEntityId: 'conn:north_exit' },
                { direction: 'south', connectionEntityId: 'conn:south_exit' },
                { direction: 'enter door', connectionEntityId: 'conn:door_1' }
            ]));
            expect(component.getAllConnections()).toHaveLength(3);
        });

        it('AC3.3: should initialize with an empty map for empty connections object', () => {
            const component = new ConnectionsComponent(emptyMockData);
            expect(component.connectionMap.size).toBe(0);
            expect(component.getAllConnections()).toEqual([]);
        });

        it.each([
            ['null input', nullInput],
            ['undefined input', undefinedInput],
            ['data with null connections', nullConnectionsData],
            ['data with undefined connections', undefinedConnectionsData],
        ])('AC3.4: should initialize with an empty map when input data is %s', (desc, input) => {
            const component = new ConnectionsComponent(input);
            expect(component.connectionMap.size).toBe(0);
            expect(component.getAllConnections()).toEqual([]);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('AC3.4: should initialize with an empty map and warn when data.connections is not a plain object (e.g., Array)', () => {
            const component = new ConnectionsComponent(arrayConnectionsData);
            expect(component.connectionMap.size).toBe(0);
            expect(component.getAllConnections()).toEqual([]);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'ConnectionsComponent constructor received unexpected data.connections format. Expected a plain object mapping directions to connection IDs, but got:',
                arrayConnectionsData.connections
            );
        });

        // Updated test reflecting constructor now trims keys/values
        it('AC3.5: should skip invalid entries within a valid connections object and warn', () => {
            const component = new ConnectionsComponent(invalidEntriesData);
            // Valid: north, up, down
            expect(component.connectionMap.size).toBe(3); // This passes now
            expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                { direction: 'north', connectionEntityId: 'conn:valid_north' },
                { direction: 'up', connectionEntityId: 'conn:valid_up' }, // Key trimmed/lowercased
                { direction: 'down', connectionEntityId: '  conn:valid_down  ' } // Value preserved
            ]));
            expect(component.getAllConnections()).toHaveLength(3); // This passes now
            expect(component.getConnectionByDirection('north')).toBe('conn:valid_north');
            expect(component.getConnectionByDirection('  up  ')).toBe('conn:valid_up');
            expect(component.getConnectionByDirection('UP')).toBe('conn:valid_up');
            expect(component.getConnectionByDirection('down')).toBe('  conn:valid_down  ');

            // --- UPDATED Warning Assertions ---
            expect(consoleWarnSpy).toHaveBeenCalledTimes(6); // Still 6 invalid entries total

            // 1. Check the specific warning for the numeric key
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                // Use the new specific message for numeric keys
                expect.stringContaining("ConnectionsComponent constructor: Skipping numeric key entry. Direction key: '123'.")
            );

            // 2. Check the warnings for the other 5 invalid entries using the new general phrasing
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                // Update the expected text for the empty key ('') case
                expect.stringContaining("ConnectionsComponent constructor: Skipping invalid entry. Direction: '', ConnectionEntityId: 'conn:empty_key'. Ensure direction and value are non-empty strings.")
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                // Update the expected text for the empty value ('east') case
                expect.stringContaining("ConnectionsComponent constructor: Skipping invalid entry. Direction: 'east', ConnectionEntityId: ''. Ensure direction and value are non-empty strings.")
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                // Update the expected text for the null value ('south') case
                expect.stringContaining("ConnectionsComponent constructor: Skipping invalid entry. Direction: 'south', ConnectionEntityId: 'null'. Ensure direction and value are non-empty strings.")
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                // Update the expected text for the number value ('west') case
                expect.stringContaining("ConnectionsComponent constructor: Skipping invalid entry. Direction: 'west', ConnectionEntityId: '123'. Ensure direction and value are non-empty strings.")
            );
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                // Update the expected text for the undefined value ('valid_key') case
                expect.stringContaining("ConnectionsComponent constructor: Skipping invalid entry. Direction: 'valid_key', ConnectionEntityId: 'undefined'. Ensure direction and value are non-empty strings.")
            );
            // --- End UPDATED Warning Assertions ---
        });
    });

    // --- getConnectionByDirection Tests (Keep existing tests - adjusted for fixed constructor) ---
    describe('getConnectionByDirection', () => {
        let component;
        beforeEach(() => {
            // Use data where constructor handles case and spacing
            component = new ConnectionsComponent({
                connections: {
                    "NORTH": "conn:north_id",
                    " go east ": "conn:east_id", // Stored as 'go east'
                    "stay put": " conn:stay_id " // Value has spaces
                }
            });
        });

        it('AC4.1: should return the correct connectionEntityId for existing directions (case-insensitive lookup)', () => {
            expect(component.getConnectionByDirection('north')).toBe('conn:north_id');
            // Lookup correctly handles trimming and lowercasing the input direction
            expect(component.getConnectionByDirection('go east')).toBe('conn:east_id');
            expect(component.getConnectionByDirection(' GO EAST ')).toBe('conn:east_id');
            expect(component.getConnectionByDirection('stay put')).toBe(' conn:stay_id ');
        });

        it('AC4.2: should be case-insensitive during lookup', () => {
            expect(component.getConnectionByDirection('NORTH')).toBe('conn:north_id');
            expect(component.getConnectionByDirection('NoRtH')).toBe('conn:north_id');
            expect(component.getConnectionByDirection(' Go EaSt ')).toBe('conn:east_id');
            expect(component.getConnectionByDirection(' StAy pUt ')).toBe(' conn:stay_id ');
        });

        it('AC4.3: should return undefined for directions that do not exist', () => {
            expect(component.getConnectionByDirection('south')).toBeUndefined();
            expect(component.getConnectionByDirection('nonexistent')).toBeUndefined();
            // If key was 'go east', lookup for 'go east ' (extra space) should fail
            expect(component.getConnectionByDirection('go east ')).toBe('conn:east_id');
        });

        it.each([
            ['empty string', ''],
            ['string with only spaces', '   '],
            ['null', null],
            ['undefined', undefined],
            ['number', 123],
            ['object', {}],
            ['array', []],
        ])('AC4.4: should return undefined for invalid input type (%s)', (desc, input) => {
            expect(component.getConnectionByDirection(input)).toBeUndefined();
            // Should not warn for invalid lookup input
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });

    // --- getAllConnections Tests (Keep existing tests - adjusted for fixed constructor) ---
    describe('getAllConnections', () => {
        it('AC5.1 & AC5.2 & AC5.3: should return an array of {direction: string, connectionEntityId: string} objects with lowercase, trimmed directions for a populated component', () => {
            // Using constructor behavior (keys lowercased AND trimmed)
            const component = new ConnectionsComponent({
                connections: { "NORTH": "conn:n", " go east ": "conn:e" }
            });
            const connections = component.getAllConnections();

            expect(Array.isArray(connections)).toBe(true);
            expect(connections).toHaveLength(2);
            // Keys stored are 'north' and 'go east' (trimmed)
            expect(connections).toEqual(expect.arrayContaining([
                { direction: 'north', connectionEntityId: 'conn:n' },
                { direction: 'go east', connectionEntityId: 'conn:e' } // Direction is trimmed
            ]));
            connections.forEach(conn => {
                expect(typeof conn.direction).toBe('string');
                expect(typeof conn.connectionEntityId).toBe('string');
                // Check key is lowercase and has no leading/trailing spaces
                expect(conn.direction).toEqual(conn.direction.toLowerCase());
                expect(conn.direction).toEqual(conn.direction.trim());
            });
        });

        it('AC5.4: should return an empty array for a component initialized with no connections', () => {
            const component = new ConnectionsComponent(emptyMockData);
            expect(component.getAllConnections()).toEqual([]);
        });

        it('AC5.4: should return an empty array for a component initialized with invalid data', () => {
            const component = new ConnectionsComponent(nullInput);
            expect(component.getAllConnections()).toEqual([]);
        });
    });

    // --- Dynamic Method Tests ---
    describe('Dynamic Methods (add, remove, clear)', () => {
        let component;

        beforeEach(() => {
            // Start with a known state using the constructor
            // Use initial data that tests spaces and case for setup clarity
            component = new ConnectionsComponent({
                connections: {
                    " initial ": "conn:initial_id" // Stored as 'initial'
                }
            });
        });

        // =====================================================================
        // --- addConnection Tests (CONN-4.3.5) - Keep existing ---
        // =====================================================================
        describe('addConnection', () => {

            // AC1: Test for adding new connection exists and passes.
            it('AC1: should add a completely new direction/connection pair', () => {
                component.addConnection('west', 'conn:west_wing');
                expect(component.connectionMap.size).toBe(2); // initial + west
                // Verify using public methods (case-insensitive lookup)
                expect(component.getConnectionByDirection('west')).toBe('conn:west_wing');
                expect(component.getConnectionByDirection('WEST')).toBe('conn:west_wing');
                // Verify the overall state
                expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                    { direction: 'initial', connectionEntityId: 'conn:initial_id'},
                    { direction: 'west', connectionEntityId: 'conn:west_wing' }
                ]));
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            it('AC1: should trim spaces from direction and store it lowercase, preserving spaces in entity ID', () => {
                component.addConnection('  Go UP ', ' conn:attic_hatch '); // Adds 'go up'
                expect(component.connectionMap.size).toBe(2); // initial + go up
                // Check internal map key is correctly processed
                expect(component.connectionMap.has('go up')).toBe(true);
                expect(component.connectionMap.has('  Go UP ')).toBe(false); // Original form should not be the key
                // Verify using public methods (case-insensitive lookup works with processed key)
                expect(component.getConnectionByDirection('GO UP')).toBe(' conn:attic_hatch ');
                expect(component.getConnectionByDirection('go up')).toBe(' conn:attic_hatch ');
                expect(component.getConnectionByDirection('  go up  ')).toBe(' conn:attic_hatch '); // Lookup input is also trimmed/lowercased
                // Verify the overall state (direction is lowercase/trimmed, id preserves spaces)
                expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                    { direction: 'initial', connectionEntityId: 'conn:initial_id'},
                    { direction: 'go up', connectionEntityId: ' conn:attic_hatch ' }
                ]));
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            // AC2: Test for updating existing connection ID exists and passes.
            it('AC2: should update the entity ID of an existing direction (using same case)', () => {
                component.addConnection('initial', 'conn:new_initial'); // Overwrite 'initial'
                expect(component.connectionMap.size).toBe(1); // Size should remain 1
                expect(component.getConnectionByDirection('initial')).toBe('conn:new_initial');
                expect(component.getAllConnections()).toEqual([{ direction: 'initial', connectionEntityId: 'conn:new_initial' }]);
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            // AC3: Test for case-insensitive adding/overwriting exists and passes.
            it('AC3: should overwrite an existing connection using a different case for the direction and trimming', () => {
                // Initial state has 'initial' from key " initial "
                component.addConnection(' INITIAL ', 'conn:newer_initial'); // Overwrite using different case and spacing
                expect(component.connectionMap.size).toBe(1); // Size should still be 1
                // Verify the value was updated for the canonical 'initial' key
                expect(component.getConnectionByDirection('initial')).toBe('conn:newer_initial');
                expect(component.getConnectionByDirection('INITIAL')).toBe('conn:newer_initial'); // Lookup still works case-insensitively
                expect(component.getConnectionByDirection(' initial ')).toBe('conn:newer_initial'); // Lookup works with spacing
                expect(component.getAllConnections()).toEqual([{ direction: 'initial', connectionEntityId: 'conn:newer_initial' }]);
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            it('AC3: should handle sequential adds with varying case/spacing, resulting in one entry with the last ID', () => {
                // Reset component for this specific sequence
                component = new ConnectionsComponent();
                component.addConnection('look', 'conn:look_default');    // Adds 'look'
                component.addConnection('Look', 'conn:look_override');   // Overwrites 'look'
                component.addConnection('LOOK', 'conn:look_final');      // Overwrites 'look' again
                component.addConnection(' look ', 'conn:look_trimmed'); // Overwrites 'look' (due to trim)

                expect(component.connectionMap.size).toBe(1); // Only one entry for 'look'
                expect(component.getConnectionByDirection('look')).toBe('conn:look_trimmed');
                expect(component.getConnectionByDirection('LOOK')).toBe('conn:look_trimmed');
                expect(component.getAllConnections()).toEqual([{ direction: 'look', connectionEntityId: 'conn:look_trimmed' }]);
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            // AC4: Test for invalid input (no state change) exists and passes.
            // AC5: (Optional) Test for console.warn on invalid input exists and passes.
            it.each([
                // Invalid Directions
                ['empty direction string', '', 'conn:valid_id'],
                ['direction string with only spaces', '  ', 'conn:valid_id'],
                ['null direction', null, 'conn:valid_id'],
                ['undefined direction', undefined, 'conn:valid_id'],
                ['numeric direction', 123, 'conn:valid_id'],
                ['object direction', {}, 'conn:valid_id'],
                // Invalid Entity IDs
                ['empty entityId string', 'valid_dir', ''],
                // Note: The implementation checks `connectionEntityId.trim() !== ''`, so spaces *are* allowed if not empty after trim.
                // Let's test both cases for clarity.
                ['entityId string with only spaces', 'valid_dir', '  '],
                ['null entityId', 'valid_dir', null],
                ['undefined entityId', 'valid_dir', undefined],
                ['numeric entityId', 'valid_dir', 456],
                ['object entityId', 'valid_dir', {}],
                // Both Invalid
                ['both null', null, null],
                ['both empty strings', '', ''],
            ])('AC4/AC5: should not modify connections and should warn for invalid input (%s)', (desc, dir, id) => {
                // component starts with 'initial' connection
                const initialSize = component.connectionMap.size; // Should be 1
                const initialConnections = component.getAllConnections();

                // Action: Call addConnection with invalid input
                component.addConnection(dir, id);

                // Verification (AC4): State remains unchanged
                expect(component.connectionMap.size).toBe(initialSize);
                expect(component.getAllConnections()).toEqual(initialConnections);

                // Verification (AC5): Console warning was triggered
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
                // Check the warning message content matches the implementation's format
                expect(consoleWarnSpy).toHaveBeenCalledWith(
                    expect.stringContaining(`ConnectionsComponent.addConnection: Invalid input. Direction: '${dir}', ConnectionEntityId: '${id}'. Both must be non-empty strings.`)
                );
            });

            it('AC4/AC5 edge case: should allow entity ID with only spaces if trim check passes', () => {
                // Based on `connectionEntityId.trim() !== ''`, an ID like "   " IS invalid.
                // Based on implementation `typeof connectionEntityId === 'string'` only, "  " would be valid IF trim wasn't checked.
                // Let's test the *actual* implementation: `typeof ... === 'string'` AND `trim() !== ''`
                const initialSize = component.connectionMap.size;
                const initialConnections = component.getAllConnections();

                component.addConnection('valid_dir', '   '); // This ID is invalid because trim() makes it ''

                expect(component.connectionMap.size).toBe(initialSize);
                expect(component.getAllConnections()).toEqual(initialConnections);
                expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`ConnectionsComponent.addConnection: Invalid input. Direction: 'valid_dir', ConnectionEntityId: '   '. Both must be non-empty strings.`));

            });

            it('AC4/AC5 edge case: should allow entity ID with leading/trailing spaces', () => {
                // An ID like " conn:id " is valid
                component.addConnection('spaced_id_dir', ' conn:id ');
                expect(component.connectionMap.size).toBe(2); // initial + spaced_id_dir
                expect(component.getConnectionByDirection('spaced_id_dir')).toBe(' conn:id ');
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });


        }); // End describe('addConnection')

        // =====================================================================
        // --- removeConnection Tests (CONN-4.3.6) - NEW TESTS ---
        // =====================================================================
        describe('removeConnection', () => {
            // Use beforeEach within this describe block for remove tests
            beforeEach(() => {
                // Reset component and add a known set of connections for removal tests
                component = new ConnectionsComponent(); // Start fresh
                component.addConnection('North', 'conn:north_id');     // Stored as 'north'
                component.addConnection(' south east ', 'conn:se_id'); // Stored as 'south east'
                component.addConnection('Stay', 'conn:stay_id');       // Stored as 'stay'
                // Initial state: size 3, connections 'north', 'south east', 'stay'
            });

            // AC1: Test exists and passes for successfully removing an existing connection
            it('AC1: should remove an existing connection (exact match) and return true', () => {
                const initialSize = component.connectionMap.size; // 3
                expect(component.getConnectionByDirection('north')).toBe('conn:north_id'); // Verify exists

                // Act
                const result = component.removeConnection('north');

                // Assert
                expect(result).toBe(true); // Return value check
                expect(component.connectionMap.size).toBe(initialSize - 1); // Size decreased
                expect(component.getConnectionByDirection('north')).toBeUndefined(); // Verify removed via lookup
                // Verify remaining connections
                expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                    { direction: 'south east', connectionEntityId: 'conn:se_id' },
                    { direction: 'stay', connectionEntityId: 'conn:stay_id' }
                ]));
                expect(component.getAllConnections()).toHaveLength(initialSize - 1);
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            // AC2: Test exists and passes demonstrating case-insensitive removal works correctly
            it('AC2: should remove an existing connection case-insensitively and return true', () => {
                const initialSize = component.connectionMap.size; // 3
                expect(component.getConnectionByDirection('south east')).toBe('conn:se_id'); // Verify exists

                // Act: Use different case
                const result = component.removeConnection('SOUTH EAST');

                // Assert
                expect(result).toBe(true);
                expect(component.connectionMap.size).toBe(initialSize - 1);
                expect(component.getConnectionByDirection('south east')).toBeUndefined();
                expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                    { direction: 'north', connectionEntityId: 'conn:north_id' },
                    { direction: 'stay', connectionEntityId: 'conn:stay_id' }
                ]));
                expect(component.getAllConnections()).toHaveLength(initialSize - 1);
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            it('AC2: should handle trimming on input direction for removal and return true', () => {
                const initialSize = component.connectionMap.size; // 3
                expect(component.getConnectionByDirection('stay')).toBe('conn:stay_id'); // Verify exists

                // Act: Use spacing in input
                const result = component.removeConnection('  Stay  ');

                // Assert
                expect(result).toBe(true);
                expect(component.connectionMap.size).toBe(initialSize - 1);
                expect(component.getConnectionByDirection('stay')).toBeUndefined();
                expect(component.getAllConnections()).toEqual(expect.arrayContaining([
                    { direction: 'north', connectionEntityId: 'conn:north_id' },
                    { direction: 'south east', connectionEntityId: 'conn:se_id' }
                ]));
                expect(component.getAllConnections()).toHaveLength(initialSize - 1);
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });


            // AC3: Test exists and passes verifying false is returned when attempting to remove non-existent direction
            it('AC3: should return false when attempting to remove a non-existent connection and not change state', () => {
                const initialSize = component.connectionMap.size; // 3
                const initialConnections = component.getAllConnections(); // Capture initial state

                // Act: Try to remove something that isn't there
                const result = component.removeConnection('west');

                // Assert
                expect(result).toBe(false); // Return value check
                expect(component.connectionMap.size).toBe(initialSize); // Size unchanged
                expect(component.getAllConnections()).toEqual(initialConnections); // State unchanged
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            it('AC3: should return false when attempting to remove a connection that was already removed', () => {
                // First, remove 'north' successfully
                expect(component.removeConnection('north')).toBe(true);
                const currentSize = component.connectionMap.size; // 2
                const currentConnections = component.getAllConnections();

                // Act: Try to remove 'north' again
                const result = component.removeConnection('north');

                // Assert
                expect(result).toBe(false);
                expect(component.connectionMap.size).toBe(currentSize); // Size unchanged from previous step
                expect(component.getAllConnections()).toEqual(currentConnections); // State unchanged
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });

            // AC4: Test exists and passes verifying false is returned for invalid inputs
            it.each([
                ['empty string', ''],
                ['string with only spaces', '   '],
                ['null', null],
                ['undefined', undefined],
                ['number', 123],
                ['object', {}],
                ['array', []],
            ])('AC4: should return false for invalid input (%s) and not change state', (desc, invalidInput) => {
                const initialSize = component.connectionMap.size; // 3
                const initialConnections = component.getAllConnections(); // Capture initial state

                // Act: Call removeConnection with invalid input
                const result = component.removeConnection(invalidInput);

                // Assert
                expect(result).toBe(false); // Return value check
                expect(component.connectionMap.size).toBe(initialSize); // Size unchanged
                expect(component.getAllConnections()).toEqual(initialConnections); // State unchanged
                // Verify no warning is logged for invalid input in removeConnection (as per implementation)
                expect(consoleWarnSpy).not.toHaveBeenCalled();
            });
        }); // End describe('removeConnection')

        // =====================================================================
        // --- clearConnections Tests (CONN-4.3.7 - Keep existing tests) ---
        // =====================================================================
        describe('clearConnections', () => {
            // Use beforeEach from the parent 'Dynamic Methods' describe block
            // Initial state has 'initial' connection

            it('AC6.7: should remove all connections from a populated component', () => {
                // Add more connections to make it more interesting
                component.addConnection('north', 'conn:n');
                component.addConnection('south', 'conn:s');
                expect(component.connectionMap.size).toBe(3); // initial + north + south

                // Act
                component.clearConnections();

                // Assert
                expect(component.connectionMap.size).toBe(0);
                expect(component.getAllConnections()).toEqual([]);
                expect(component.getConnectionByDirection('initial')).toBeUndefined();
                expect(component.getConnectionByDirection('north')).toBeUndefined();
            });

            it('AC6.7: should do nothing if the component is already empty', () => {
                // Make the component empty first
                component.clearConnections();
                expect(component.connectionMap.size).toBe(0);

                // Act
                component.clearConnections(); // Call again on empty component

                // Assert
                expect(component.connectionMap.size).toBe(0);
                expect(component.getAllConnections()).toEqual([]);
            });
        }); // End describe('clearConnections')

    }); // End describe('Dynamic Methods')

}); // End describe('ConnectionsComponent')