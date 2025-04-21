// src/components/connectionsComponent.js

import Component from "./component.js";

/**
 * @description Component for Location entities defining the exits or links
 * from this location by mapping direction strings to Connection entity IDs.
 * This component *only* stores the mapping and does not manage the runtime state
 * (e.g., locked, hidden, blocked) of the connections themselves.
 *
 * @example
 * // Expected data structure from entity definition (e.g., JSON)
 * {
 * "connections": {
 * "north": "conn:roomA_to_roomB",
 * "climb ladder": "conn:roomA_to_attic",
 * "enter door": "conn:roomA_to_closet"
 * }
 * }
 */
export class ConnectionsComponent extends Component {
    /**
     * Initializes the ConnectionsComponent.
     * @param {object} data - The component data object from the entity definition.
     * @param {object.<string, string>} [data.connections] - An object where keys are direction strings
     * (e.g., 'north', 'enter door') and values are the namespaced IDs
     * of the corresponding Connection entities. Case-insensitivity for directions
     * is handled internally by storing keys in lowercase and trimmed.
     */
    constructor(data) {
        super();
        /**
         * Internal map storing connection direction (lowercase, trimmed) to Connection Entity ID.
         * @type {Map<string, string>}
         * @private
         */
        this.connectionMap = new Map();

        // Validate and populate the map from input data
        if (data && data.connections && typeof data.connections === 'object' && !Array.isArray(data.connections) && data.connections !== null) {
            const inputConnections = data.connections;


            for (const direction in inputConnections) {
                // Ensure the property belongs to the object itself
                if (Object.prototype.hasOwnProperty.call(inputConnections, direction)) { // direction is string here (e.g., "123", "north", "  up  ")
                    const connectionEntityId = inputConnections[direction];

                    // --- Updated Validation Logic ---

                    // 1. Reject keys that are purely numeric strings
                    const isNumericString = /^\d+$/.test(direction);
                    if (isNumericString) {
                        console.warn(`ConnectionsComponent constructor: Skipping numeric key entry. Direction key: '${direction}'.`);
                        continue; // Skip to the next iteration
                    }

                    // 2. Validate remaining string keys and the entity ID value
                    const isDirectionString = typeof direction === 'string'; // Will be true here unless key was exotic symbol
                    const trimmedDirection = isDirectionString ? direction.trim() : '';
                    const isEntityIdString = typeof connectionEntityId === 'string';
                    const trimmedEntityId = isEntityIdString ? connectionEntityId.trim() : '';

                    // Check: Trimmed direction non-empty, value is string, trimmed value non-empty
                    if (trimmedDirection !== '' && isEntityIdString && trimmedEntityId !== '') {
                        // Store direction key lowercase AND trimmed for consistent lookup
                        this.connectionMap.set(trimmedDirection.toLowerCase(), connectionEntityId);
                    } else {
                        // Warn for other invalid cases (empty trimmed key, invalid value type, empty trimmed value)
                        console.warn(`ConnectionsComponent constructor: Skipping invalid entry. Direction: '${direction}', ConnectionEntityId: '${connectionEntityId}'. Ensure direction and value are non-empty strings.`);
                    }
                    // --- End Updated Validation Logic ---
                }
            }
        } else if (data && data.connections) {
            // Log a warning if data.connections exists but is not a valid object map
            console.warn(`ConnectionsComponent constructor received unexpected data.connections format. Expected a plain object mapping directions to connection IDs, but got:`, data.connections);
            // connectionMap remains empty as initialized
        }
        // If data or data.connections is null/undefined/empty object,
        // this.connectionMap is already initialized as an empty Map.
    }

    /**
     * Finds a connection entity ID by direction (case-insensitive, space-insensitive).
     * @param {string} direction - The direction command (e.g., 'north', 'enter door').
     * @returns {string | undefined} The connectionEntityId string or undefined if no connection exists for that direction.
     */
    getConnectionByDirection(direction) {
        if (typeof direction !== 'string') {
            return undefined; // Invalid input type
        }
        const processedDirection = direction.trim().toLowerCase(); // FIX 2: Trim input direction before lowercasing
        if (processedDirection === '') {
            return undefined; // Invalid input (empty after trim)
        }
        // Perform lookup using the trimmed and lowercase version of the direction
        return this.connectionMap.get(processedDirection);
    }

    /**
     * Gets all connections managed by this component as direction-ID pairs.
     * Returns the directions as stored (lowercase, trimmed).
     * @returns {Array<{ direction: string, connectionEntityId: string }>} An array containing objects,
     * each with a 'direction' (lowercase, trimmed) and the corresponding 'connectionEntityId'.
     * Returns an empty array if there are no connections.
     */
    getAllConnections() {
        const connectionsArray = [];
        for (const [direction, connectionEntityId] of this.connectionMap.entries()) {
            connectionsArray.push({ direction, connectionEntityId });
        }
        return connectionsArray;
    }

    // --- NEW METHODS IMPLEMENTING TICKET CONN-4.2 ---

    /**
     * Adds a new connection or updates an existing one for the given direction.
     * Directions are stored and matched case-insensitively and space-insensitively (by trimming and converting to lowercase).
     * If the direction already exists (after processing), its connectionEntityId will be overwritten.
     * @param {string} direction - The direction command (e.g., 'north', 'climb up'). Must be a non-empty string after trimming.
     * @param {string} connectionEntityId - The ID of the Connection entity. Must be a non-empty string after trimming.
     * @returns {void}
     */
    addConnection(direction, connectionEntityId) {
        const isValidDirection = typeof direction === 'string' && direction.trim() !== '';
        const isValidEntityId = typeof connectionEntityId === 'string' && connectionEntityId.trim() !== ''; // Check trimmed value for validity

        // Validate inputs
        if (!isValidDirection || !isValidEntityId) {
            // Warn using original values
            console.warn(`ConnectionsComponent.addConnection: Invalid input. Direction: '${direction}', ConnectionEntityId: '${connectionEntityId}'. Both must be non-empty strings.`);
            return; // Do nothing if invalid
        }

        // Convert direction to lowercase AND trim for storage and matching
        const processedDirection = direction.trim().toLowerCase(); // FIX 3: Trim before lowercasing

        // Set the entry in the map (adds if new, updates if exists)
        // Store the ORIGINAL, untrimmed connectionEntityId
        this.connectionMap.set(processedDirection, connectionEntityId);
    }

    /**
     * Removes a connection entry based on the provided direction (case-insensitive, space-insensitive).
     * @param {string} direction - The direction command to remove (e.g., 'north', 'climb up').
     * @returns {boolean} True if a connection for the direction was found and removed, false otherwise.
     */
    removeConnection(direction) {
        // Validate input type
        if (typeof direction !== 'string') {
            return false;
        }

        // Convert direction to lowercase AND trim for matching
        const processedDirection = direction.trim().toLowerCase(); // FIX 4: Trim before lowercasing

        // Check if processed direction is empty after trimming
        if (processedDirection === '') {
            // Optional warning could go here, but AC says return false silently
            return false;
        }

        // Attempt to delete the entry and return the result
        return this.connectionMap.delete(processedDirection);
    }

    /**
     * Removes all connection entries from this component.
     * @returns {void}
     */
    clearConnections() {
        this.connectionMap.clear();
    }
}