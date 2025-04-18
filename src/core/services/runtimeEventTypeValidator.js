// src/core/services/runtimeEventTypeValidator.js

/**
 * @fileoverview Implements the IEventTypeValidator interface to validate event type strings
 * against a dynamically initialized set of known event types. Replicates and centralizes
 * the event type validation logic previously found in GameDataRepository.
 */

/**
 * @typedef {import('../interfaces/coreServices.js').IEventTypeValidator} IEventTypeValidator
 */
// Optional: Define a type for the eventTypes module object if needed elsewhere,
// though using 'object' in initialize's JSDoc is sufficient here based on the ticket.
// /**
//  * @typedef {import('../../types/eventTypes.js')} EventTypesModule
//  */

/**
 * Validates event type strings against a known set, initialized from various sources.
 * This class ensures that parts of the system referencing event types (like triggers in data)
 * use recognized identifiers.
 *
 * @implements {IEventTypeValidator}
 */
class RuntimeEventTypeValidator {
    /**
     * Stores the set of known valid event type strings after initialization.
     * @private
     * @type {Set<string>}
     */
    #validEventTypes = new Set();

    /**
     * Initializes or re-initializes the validator with a source of valid event type strings.
     * Clears any previously stored types before processing the new source.
     * Accepts an object (like an imported module exporting constants), a Set, or an Array.
     * When given an object, it iterates through its values, filtering for strings
     * containing a colon (':'), replicating the previous GameDataRepository logic for
     * extracting event types.
     *
     * @param {object | Set<string> | string[]} eventTypesSource - The source of event types.
     * Can be an object (e.g., imported `eventTypes` module), a Set of strings, or an array of strings.
     * @throws {Error} If the `eventTypesSource` is not one of the expected types or is null/undefined.
     * @override
     */
    initialize(eventTypesSource) {
        // AC: initialize clears previous types before adding new ones.
        const previousSize = this.#validEventTypes.size;
        this.#validEventTypes.clear();
        // Optional logging for reset
        // if (previousSize > 0) {
        //     console.log("RuntimeEventTypeValidator: Cleared previously loaded event types.");
        // }

        if (eventTypesSource instanceof Set) {
            // AC: Calling initialize with a Set ... correctly populates the internal Set
            // Create a new Set from the source Set to avoid shared references if needed,
            // although direct assignment might also be acceptable depending on ownership semantics.
            // Using new Set() ensures a copy.
            this.#validEventTypes = new Set(eventTypesSource);
            // Optional logging as per ticket description
            console.log(`RuntimeEventTypeValidator: Initialized from Set with ${this.#validEventTypes.size} event types.`);

        } else if (Array.isArray(eventTypesSource)) {
            // AC: Calling initialize with an array ... correctly populates the internal Set
            this.#validEventTypes = new Set(eventTypesSource);
            console.log(`RuntimeEventTypeValidator: Initialized from Array with ${this.#validEventTypes.size} event types.`);

        } else if (typeof eventTypesSource === 'object' && eventTypesSource !== null) {
            // AC: Calling initialize with an object (like eventTypes.js export) correctly populates the internal Set
            // Replicate the logic from GameDataRepository.getAllEventTypes
            let count = 0;
            for (const key in eventTypesSource) {
                // Ensure we are looking at own properties if iterating using 'in'
                if (Object.hasOwnProperty.call(eventTypesSource, key)) {
                    const value = eventTypesSource[key];
                    // Check if the value is a string and contains a colon, typical for event names like 'event:type'
                    // AC: When initializing with an object, it iterates through values and adds strings containing ':'
                    if (typeof value === 'string' && value.includes(':')) {
                        this.#validEventTypes.add(value);
                        count++;
                    }
                }
            }
            console.log(`RuntimeEventTypeValidator: Initialized from object values (filtered ${count} strings with ':') with ${this.#validEventTypes.size} total unique event types.`);

        } else {
            // Handle unexpected input type
            // AC: initialize throws an Error for invalid input types.
            const sourceType = eventTypesSource === null ? 'null' : typeof eventTypesSource;
            const errorMessage = `RuntimeEventTypeValidator: Invalid eventTypesSource provided during initialization. Expected Set, Array, or non-null Object, but received type: ${sourceType}.`;
            console.error(errorMessage, eventTypesSource);
            // Throw an error as specified in the ticket for unexpected types
            throw new Error(errorMessage);
        }

        // Optional: uncomment for detailed debugging
        // console.debug("RuntimeEventTypeValidator: Final initialized types:", Array.from(this.#validEventTypes));
    }

    /**
     * Checks if the provided string is a valid, known event type based on the
     * initialized set.
     *
     * @param {string} eventType - The event type string to validate.
     * @returns {boolean} True if the eventType is a non-empty string and exists in the set of valid types, false otherwise.
     * @override
     */
    isValidEventType(eventType) {
        // Basic validation: ensure it's a non-empty string before checking the Set
        // AC: isValidEventType returns false for non-string or empty string inputs.
        if (typeof eventType !== 'string' || eventType.trim() === '') {
            // AC: isValidEventType returns false for ... before initialization (Set is empty)
            // Also handles cases where input is not a valid string.
            return false;
        }
        // AC: isValidEventType returns true for an event type string that was part of the initialized set.
        // AC: isValidEventType returns false for an event type string that was not part of the initialized set.
        // AC: isValidEventType uses the internal Set's `has` method for checking.
        return this.#validEventTypes.has(eventType);
    }
}

// AC: src/core/services/runtimeEventTypeValidator.js exists and exports the RuntimeEventTypeValidator class.
export default RuntimeEventTypeValidator;