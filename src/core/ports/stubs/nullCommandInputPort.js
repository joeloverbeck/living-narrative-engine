// src/core/ports/stubs/nullCommandInputPort.js
// --- FILE START ---

/**
 * @fileoverview Implements a non-functional Null/Stub for ICommandInputPort.
 */

import { ICommandInputPort } from '../ICommandInputPort.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../commonTypes.js').UnsubscribeFn} UnsubscribeFn */
/** @typedef {import('../ICommandInputPort.js').CommandListener} CommandListener */

/**
 * @class NullCommandInputPort
 * @implements {ICommandInputPort}
 * @description A non-functional implementation of ICommandInputPort suitable for
 * testing environments where command input is not required or should be ignored.
 * It fulfills the interface contract without performing any actions.
 */
export class NullCommandInputPort extends ICommandInputPort {
    /**
     * A no-op implementation of the onCommand method.
     * It accepts a listener but does nothing with it and returns a
     * no-op unsubscribe function.
     *
     * @param {CommandListener} listener - The listener function (ignored).
     * @returns {UnsubscribeFn} A function that does nothing when called.
     */
    onCommand(listener) {
        // Null implementation: Do nothing with the listener.
        // Return a function that does nothing when called (no-op unsubscribe).
        return () => {};
    }

    /**
     * Optional: Add a method to simulate a command being received,
     * if needed for more advanced stubbing scenarios.
     * For a pure Null object, this is not required.
     */
    // simulateCommand(commandString) {
    //     // If you store the listener, you could call it here.
    //     // For now, it does nothing.
    // }
}

// --- FILE END ---