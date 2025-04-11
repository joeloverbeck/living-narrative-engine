// src/components/descriptionComponent.js
import Component from "./component.js"; // Assuming component.js is in the same directory

export class DescriptionComponent extends Component {
    /** @param {{text: string}} data */
    constructor(data) {
        super();
        if (!data || typeof data.text !== 'string') {
            // Allow empty string, but require the 'text' property
            throw new Error("DescriptionComponent requires a 'text' string property in data.");
        }
        this.text = data.text;
    }
}