// src/components/connectionsComponent.js

import Component from "./component.js";

export class ConnectionsComponent extends Component {
    /** @param {Record<string, {target_location_id: string, description?: string, state?: string, tests?: object[]}>} data */
    constructor(data) {
        super();
        // Deep copy the connections data to prevent mutation of the original definition
        this.connections = data ? JSON.parse(JSON.stringify(data)) : {};
        // Validate structure? (optional, Ajv already did schema validation)
    }
    // TODO: Add methods like getConnection(direction), setConnectionState(direction, newState)
}