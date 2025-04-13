// src/components/connectionsComponent.js

import Component from "./component.js";

/**
 * @typedef {object} Connection
 * @property {string} connectionId - A unique identifier for this specific connection instance.
 * @property {string} direction - The direction of travel (e.g., 'north', 'east', 'up'). Case-insensitive matching is often applied.
 * @property {string} target - The entity ID of the location this connection leads to.
 * @property {string} [name] - Optional display name or description for the connection (e.g., "sturdy north door", "glowing portal"). Used for targeting by description.
 * @property {string} [description_override] - Optional text to display instead of the standard exit description.
 * @property {string} [type='passage'] - The type of connection (e.g., 'passage', 'door', 'portal'). Defaults to 'passage'.
 * @property {boolean} [hidden=false] - If true, this connection is not initially visible or listed in exits. Defaults to false.
 * @property {string} [initial_state] - The state the connection starts in (e.g., 'locked', 'unlocked', 'hidden'). If omitted, defaults based on 'hidden', UNLESS blockerEntityId is present.
 * @property {string} state - The **runtime** state of the connection itself (e.g., 'locked', 'unlocked', 'hidden', 'broken'). This represents the inherent state of the passage and is distinct from whether it is currently passable due to a blockerEntityId. It is initialized based on initial_state or defaults, and can be modified during gameplay.
 * @property {string|null} [blockerEntityId] - Optional ID of an entity (e.g., a door, barrier) that blocks this connection. The state of the blocker entity determines passage, potentially overriding the connection's inherent 'unlocked' state.
 * @property {boolean} [blockable=false] - Indicates if this connection's passage can be dynamically blocked/unblocked by game logic or linked entities. Defaults to false.
 * @property {any[]} [interactions] - Optional list of interactions possible with this connection.
 */

export class ConnectionsComponent extends Component {
    /**
     * @param {{connections: Array<Omit<Connection, 'state'>>}} data - The component data object from JSON, expected to have a 'connections' array property.
     * Note: The input 'connections' should contain 'connectionId' and optionally 'initial_state', 'blockerEntityId', 'blockable'.
     * The 'state' property will be added during initialization.
     */
    constructor(data) {
        super();
        /** @type {Connection[]} */
        this.connections = []; // Initialize as an array of Connection type

        // Ensure data exists and has the connections property, which should be an array
        if (!data || !Array.isArray(data.connections)) {
            console.warn(`ConnectionsComponent constructor received unexpected data format. Expected { connections: [...] }, got:`, data);
            // Keep this.connections as an empty array
        } else {
            // Deep copy the *inner* connections array to prevent mutation of the original definition
            // Note: While JSON.parse(JSON.stringify(...)) is a common deep copy method,
            // be aware it can have limitations (e.g., loses Date objects, functions, undefined).
            // For typical JSON data structures like this, it's usually sufficient.
            const rawConnections = JSON.parse(JSON.stringify(data.connections));

            // Initialize runtime state and other properties for each connection
            this.connections = rawConnections.map(conn => {
                // --- State Initialization Logic (Ticket 4.2 Refactor) ---
                let runtimeState;

                // Read blockerEntityId first, default to null if undefined/null.
                const blockerEntityId = conn.blockerEntityId !== undefined && conn.blockerEntityId !== null ? conn.blockerEntityId : null;

                // If a blocker entity is specified, it dictates the initial accessible state, ignoring initial_state.
                if (blockerEntityId !== null) {
                    if (conn.hidden === true) {
                        // If hidden, it starts hidden regardless of blocker.
                        runtimeState = 'hidden';
                    } else {
                        // If not hidden, but blocked, default to unlocked (as the *connection's* state).
                        // The blocker's state will determine actual passage.
                        runtimeState = 'unlocked';
                    }
                } else {
                    // If no blocker, use the original logic based on initial_state or hidden flag.
                    if (conn.initial_state !== undefined && conn.initial_state !== null) {
                        runtimeState = conn.initial_state;
                    } else if (conn.hidden === true) {
                        // If hidden and no initial state specified, default to 'hidden' state
                        runtimeState = 'hidden';
                    } else {
                        // Otherwise, default to 'unlocked'
                        runtimeState = 'unlocked';
                    }
                }

                // --- Connection ID Check ---
                // Log an error if a non-hidden connection lacks an ID, as it might be unmanageable.
                // Note: A connection initially 'unlocked' but with a blocker might still need an ID.
                if (!conn.connectionId && runtimeState !== 'hidden') {
                    console.error(`ConnectionsComponent: Connection data is missing required 'connectionId' for a potentially visible/interactive connection. This connection may be unusable by ID. Connection details:`, conn);
                    // Decide on handling: skip, throw, or add with warning (current approach).
                }

                // --- Blocker Properties Handling (Simplified) ---
                // blockerEntityId is already determined above.
                // Read blockable if present, otherwise default to false.
                const blockable = conn.blockable === true; // Explicitly check for true, default is false

                // Add the runtime state and other properties, carry over existing ones
                return {
                    ...conn, // Spread existing properties (direction, target, connectionId, name, etc.)
                    state: runtimeState, // The determined initial state
                    blockerEntityId: blockerEntityId, // Store the blocker entity ID (or null)
                    blockable: blockable // Store the blockable flag (defaults to false)
                };
            });
        }
    }

    addConnection(connection) {
        // Consider adding validation or state initialization here if needed for dynamic additions
        // Needs to follow the same logic as the constructor's map if adding dynamically.
        // TODO: Refactor state initialization into a separate helper method?
        this.connections.push(connection);
    }

    clearConnections() {
        this.connections = [];
    }

    /**
     * Finds a connection object by its unique connectionId (case-sensitive).
     * @param {string} connectionId - The unique ID of the connection.
     * @returns {Connection | undefined} The connection object or undefined if not found.
     */
    getConnectionById(connectionId) {
        if (!connectionId || typeof connectionId !== 'string') return undefined;
        return this.connections.find(conn => conn.connectionId === connectionId);
    }

    /**
     * Gets the current inherent runtime state of a connection by its ID.
     * Note: This returns the connection's own state (e.g., 'locked', 'broken') and does not account for blocking by a blockerEntityId.
     * @param {string} connectionId - The unique ID of the connection.
     * @returns {string | undefined} The current inherent state string or undefined if the connection is not found.
     */
    getConnectionState(connectionId) {
        const connection = this.getConnectionById(connectionId);
        return connection ? connection.state : undefined;
    }

    /**
     * Updates the inherent runtime state of a specific connection identified by its ID.
     * Note: This directly sets the connection's state property. Use this for states like 'hidden', 'broken', etc.
     * **Warning:** Avoid using this to manage 'locked'/'unlocked' states if the connection has a blockerEntityId,
     * as passage is typically controlled by the blocker entity's state in that case. Modify the blocker entity's state instead.
     * @param {string} connectionId - The unique ID of the connection to update.
     * @param {string} newState - The new inherent state value (e.g., 'unlocked', 'locked', 'broken', 'hidden').
     * @returns {boolean} True if the connection was found and its state was updated, false otherwise.
     */
    setConnectionState(connectionId, newState) {
        const connection = this.getConnectionById(connectionId);
        if (connection) {
            connection.state = newState;
            // Optional: Add validation for newState if needed (e.g., ensure it's a known valid state string)
            // Optional: Fire an event if state changes need to be broadcasted
            // this.eventBus?.dispatch('connection:state_changed', { connectionId, newState });
            return true;
        }
        return false; // Connection not found
    }

    /**
     * Finds a connection object by direction (case-insensitive).
     * Prioritizes non-hidden connections first if multiple match.
     * @param {string} direction
     * @returns {Connection | undefined} The connection object or undefined if not found.
     */
    getConnectionByDirection(direction) {
        if (!direction || typeof direction !== 'string') return undefined;
        const lowerDir = direction.toLowerCase();
        // Prefer non-hidden connections if multiple match the direction
        return this.connections.find(conn => conn.direction && conn.direction.toLowerCase() === lowerDir && conn.state !== 'hidden') ||
            this.connections.find(conn => conn.direction && conn.direction.toLowerCase() === lowerDir);
    }

    /**
     * Gets all connections currently managed by this component.
     * Useful for iterating through all available connections (e.g., displaying exits).
     * @returns {Connection[]} A shallow copy of the internal connections array.
     */
    getAllConnections() {
        // Return a shallow copy to prevent external modification of the internal array structure
        return [...this.connections];
    }

    // --- Potential Future Methods related to blockerEntityId / blockable ---

    /**
     * Gets the blocker entity ID for a specific connection.
     * @param {string} connectionId - The unique ID of the connection.
     * @returns {string | null | undefined} The blocker entity ID, null if none, or undefined if connection not found.
     */
    getConnectionBlockerId(connectionId) {
        const connection = this.getConnectionById(connectionId);
        // Explicitly check if connection exists before accessing property
        return connection ? connection.blockerEntityId : undefined;
    }

    /**
     * Checks if a connection is marked as dynamically blockable.
     * @param {string} connectionId - The unique ID of the connection.
     * @returns {boolean | undefined} True if blockable, false if not, or undefined if connection not found.
     */
    isConnectionBlockable(connectionId) {
        const connection = this.getConnectionById(connectionId);
        return connection ? connection.blockable : undefined;
    }
}