// src/components/connectionsComponent.js

import Component from "./component.js";

/**
 * @typedef {object} Connection
 * @property {string} connectionId - A unique identifier for this specific connection instance.
 * @property {string} direction - The direction of travel (e.g., 'north', 'east', 'up'). Case-insensitive matching is often applied.
 * @property {string} target - The entity ID of the location this connection leads to.
 * @property {string} [description_override] - Optional text to display instead of the standard exit description.
 * @property {string} [type='passage'] - The type of connection (e.g., 'passage', 'door', 'portal'). Defaults to 'passage'.
 * @property {boolean} [hidden=false] - If true, this connection is not initially visible or listed in exits. Defaults to false.
 * @property {string} [initial_state] - The state the connection starts in (e.g., 'locked', 'unlocked', 'hidden'). If omitted, defaults based on 'hidden'.
 * @property {string} state - The **runtime** state of the connection (e.g., 'locked', 'unlocked', 'hidden', 'broken'). This is initialized based on initial_state or defaults, and can be modified during gameplay.
 * @property {any[]} [interactions] - Optional list of interactions possible with this connection.
 */

export class ConnectionsComponent extends Component {
    /**
     * @param {{connections: Array<Omit<Connection, 'state'>>}} data - The component data object from JSON, expected to have a 'connections' array property.
     * Note: The input 'connections' should contain 'connectionId' and optionally 'initial_state'.
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
            const rawConnections = JSON.parse(JSON.stringify(data.connections));

            // Initialize runtime state for each connection
            this.connections = rawConnections.map(conn => {
                // --- State Initialization Logic ---
                let runtimeState;
                if (conn.initial_state !== undefined && conn.initial_state !== null) {
                    runtimeState = conn.initial_state;
                } else if (conn.hidden === true) {
                    // If hidden and no initial state specified, default to 'hidden' state
                    runtimeState = 'hidden';
                } else {
                    // Otherwise, default to 'unlocked'
                    runtimeState = 'unlocked';
                }

                // --- Connection ID Check ---
                if (!conn.connectionId) {
                    console.error(`ConnectionsComponent: Connection data is missing required 'connectionId'. Connection details:`, conn);
                    // Handle missing ID, maybe skip this connection or throw error?
                    // For now, let's add it but log the error. It won't be findable by ID.
                }


                // Add the runtime state property to the copied connection object
                return {
                    ...conn,
                    state: runtimeState
                };
            });
        }
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
     * Gets the current runtime state of a connection by its ID.
     * @param {string} connectionId - The unique ID of the connection.
     * @returns {string | undefined} The current state string (e.g., 'locked', 'unlocked') or undefined if the connection is not found.
     */
    getConnectionState(connectionId) {
        const connection = this.getConnectionById(connectionId);
        return connection ? connection.state : undefined;
    }

    /**
     * Updates the runtime state of a specific connection identified by its ID.
     * @param {string} connectionId - The unique ID of the connection to update.
     * @param {string} newState - The new state value (e.g., 'unlocked', 'locked', 'broken').
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
     * Kept for potential compatibility or alternative lookup needs.
     * @param {string} direction
     * @returns {Connection | undefined} The connection object or undefined if not found.
     */
    getConnection(direction) {
        if (!direction || typeof direction !== 'string') return undefined;
        const lowerDir = direction.toLowerCase();
        return this.connections.find(
            conn => conn.direction && conn.direction.toLowerCase() === lowerDir
        );
    }

    /**
     * Gets all connections currently managed by this component.
     * Useful for iterating through all available connections.
     * @returns {Connection[]} A copy of the internal connections array.
     */
    getAllConnections() {
        // Return a shallow copy to prevent external modification of the internal array structure
        return [...this.connections];
    }
}