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

    // TODO: Add methods like getConnection(direction), setConnectionState(direction, newState)
}