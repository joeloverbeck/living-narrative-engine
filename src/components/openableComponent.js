import Component from './component.js';

/**
 * @typedef {import('../schemas/openable.schema.json')} OpenableSchema
 */

/**
 * Component indicating an entity can be opened or closed.
 * Manages the 'isOpen' state.
 */
class OpenableComponent extends Component {
  /**
     * Creates an instance of OpenableComponent.
     * @param {OpenableSchema} data - Component data matching the schema.
     * Expected format: { isOpen: boolean }
     */
  constructor(data) {
    super();

    // Basic validation: Check if data is an object
    if (typeof data !== 'object' || data === null) {
      console.warn('OpenableComponent: Invalid data provided to constructor. Expected an object.', data);
      // Apply default state
      this.isOpen = false;
      return;
    }

    // Default value from schema: false
    this.isOpen = typeof data.isOpen === 'boolean' ? data.isOpen : false;

    // Additional validation (optional): ensure isOpen is boolean if provided
    if (data.hasOwnProperty('isOpen') && typeof data.isOpen !== 'boolean') {
      console.warn(`OpenableComponent: Invalid type for isOpen. Expected boolean, received ${typeof data.isOpen}. Defaulting to false.`);
      this.isOpen = false;
    }

  }

  /**
     * Toggles the open state.
     * @returns {boolean} The new state.
     */
  toggle() {
    this.isOpen = !this.isOpen;
    return this.isOpen;
  }

  /**
     * Sets the open state explicitly.
     * @param {boolean} state - The desired state (true for open, false for closed).
     */
  setState(state) {
    if (typeof state !== 'boolean') {
      console.warn(`OpenableComponent: Invalid state provided to setState. Expected boolean, received ${typeof state}.`);
      return;
    }
    this.isOpen = state;
  }
}

export default OpenableComponent;