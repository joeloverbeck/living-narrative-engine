// src/components/definitionRefComponent.js
import Component from "./component.js"; // Assuming component.js is in the same directory

export class DefinitionRefComponent extends Component {
    /** @type {string | null} The identifier string, typically namespaced. */
    id;

    /**
     * Creates an instance of DefinitionRefComponent.
     * @param {string | null | undefined} id - The definition identifier string. Defaults to null if not provided or explicitly null/undefined.
     */
    constructor(id) {
        super();
        this.id = id ?? null; // Use nullish coalescing to default undefined/null to null
    }
}

export default DefinitionRefComponent;