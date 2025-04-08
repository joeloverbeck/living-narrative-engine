// src/components/connectionsComponent.js

import Component from "./component.js";

export class ConnectionsComponent extends Component {
    /**
     * @param {{connections: Array<{direction: string, target: string, description_override?: string, type?: string, hidden?: boolean, initial_state?: string, interactions?: any[]}>}} data - The component data object from JSON, expected to have a 'connections' array property.
     */
    constructor(data) {
        super();
        // Ensure data exists and has the connections property, which should be an array
        // Deep copy the *inner* connections array to prevent mutation of the original definition
        this.connections = (data && Array.isArray(data.connections))
            ? JSON.parse(JSON.stringify(data.connections))
            : []; // Default to an empty array if data is invalid

        // Optional: Add a warning if the input 'data' structure was unexpected
        if (!data || !Array.isArray(data.connections)) {
            console.warn(`ConnectionsComponent constructor received unexpected data format. Expected { connections: [...] }, got:`, data);
        }
    }

    /**
     * Finds a connection object by direction (case-insensitive).
     * @param {string} direction
     * @returns {object | undefined} The connection object or undefined if not found.
     */
    getConnection(direction) {
        if (!direction || typeof direction !== 'string') return undefined;
        const lowerDir = direction.toLowerCase();
        return this.connections.find(
            conn => conn.direction && conn.direction.toLowerCase() === lowerDir
        );
    }

    /**
     * Updates the state of a specific connection.
     * @param {string} direction - The direction of the connection to update.
     * @param {string} newState - The new state value (e.g., 'unlocked', 'locked').
     * @returns {boolean} True if the connection was found and updated, false otherwise.
     */
    setConnectionState(direction, newState) {
        const connection = this.getConnection(direction);
        if (connection) {
            connection.state = newState;
            return true;
        }
        return false;
    }
}