// src/turns/adapters/eventBusCommandInputGateway.js
// --- FILE START ---

import { ICommandInputPort } from '../ports/ICommandInputPort.js';
/* eslint-disable no-console */

// --- Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../ports/commonTypes.js').UnsubscribeFn} UnsubscribeFn */
/** @typedef {import('../ports/ICommandInputPort.js').CommandListener} CommandListener */
/** @typedef {import('../handlers/playerTurnHandler.js').CommandSubmitEvent} CommandSubmitEvent */ // Assuming type definition location
/** @typedef {import('../handlers/playerTurnHandler.js').CommandSubmitEventData} CommandSubmitEventData */ // Assuming type definition location

/**
 * @class EventBusCommandInputGateway
 * @implements {ICommandInputPort}
 * @description Implements the ICommandInputPort by subscribing to the 'core:submit_command'
 * event on the Validated Event Dispatcher (VED) and forwarding valid commands to the registered listener.
 */
export class EventBusCommandInputGateway extends ICommandInputPort {
  /**
   * @private
   * @type {IValidatedEventDispatcher}
   */
  #ved;

  /**
   * @private
   * @type {Map<CommandListener, Function>} Stores the mapping between the original listener and its bound event handler.
   */
  #listeners = new Map();

  /**
   * Creates an instance of EventBusCommandInputGateway.
   *
   * @param {object} dependencies - The dependencies required by the gateway.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - The VED instance.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({ validatedEventDispatcher }) {
    super();
    if (
      !validatedEventDispatcher ||
      typeof validatedEventDispatcher.subscribe !== 'function' ||
      typeof validatedEventDispatcher.unsubscribe !== 'function'
    ) {
      throw new Error(
        'EventBusCommandInputGateway: Invalid or missing validatedEventDispatcher dependency (requires subscribe, unsubscribe).'
      );
    }
    this.#ved = validatedEventDispatcher;
  }

  /**
   * Handles the 'core:submit_command' event. Extracts the command, trims it,
   * and calls the provided listener if the command is non-empty.
   *
   * @private
   * @param {CommandListener} listener - The original listener callback provided to onCommand.
   * @param {CommandSubmitEvent | CommandSubmitEventData} eventData - The event data received from the VED.
   * @returns {void}
   */
  #handleEvent(listener, eventData) {
    // Normalize payload access, checking both event wrapper and direct data
    const payload = /** @type {CommandSubmitEventData} */ (
      eventData?.payload ?? eventData
    );
    const commandString = payload?.command?.trim();

    if (commandString) {
      // Call the original listener passed to onCommand
      try {
        const result = listener(commandString);
        // Handle potential promises returned by the listener
        if (result instanceof Promise) {
          result.catch((error) => {
            // Optional: Log listener errors, but don't crash the gateway
            console.error(
              'EventBusCommandInputGateway: Error in async listener:',
              error
            );
          });
        }
      } catch (error) {
        // Optional: Log synchronous listener errors
        console.error(
          'EventBusCommandInputGateway: Error in sync listener:',
          error
        );
      }
    }
    // No action if commandString is empty or missing
  }

  /**
   * Registers a listener to be called whenever a 'core:submit_command' event occurs.
   *
   * @param {CommandListener} listener - The function to execute when a valid command is received.
   * @returns {UnsubscribeFn} A function that, when called, unregisters this specific listener.
   * @throws {Error} If the listener is not a function or subscription fails.
   */
  onCommand(listener) {
    if (typeof listener !== 'function') {
      throw new Error(
        'EventBusCommandInputGateway.onCommand: listener must be a function.'
      );
    }

    // Create a bound version of the handler specific to this listener
    const boundEventHandler = this.#handleEvent.bind(this, listener);

    try {
      // Subscribe the bound handler
      this.#ved.subscribe('core:submit_command', boundEventHandler);
      // Store the mapping for later unsubscribe
      this.#listeners.set(listener, boundEventHandler);
    } catch (subError) {
      // Log or handle subscription errors if necessary
      console.error(
        `EventBusCommandInputGateway: Failed to subscribe listener to core:submit_command: ${subError.message}`,
        subError
      );
      throw new Error(
        `EventBusCommandInputGateway: Failed to subscribe to VED event 'core:submit_command'.`
      );
    }

    // Return the unsubscribe function
    const unsubscribeFn = () => {
      const handlerToRemove = this.#listeners.get(listener);
      if (handlerToRemove) {
        try {
          this.#ved.unsubscribe('core:submit_command', handlerToRemove);
          this.#listeners.delete(listener);
        } catch (unsubError) {
          // Log or handle unsubscription errors if necessary
          console.error(
            `EventBusCommandInputGateway: Failed to unsubscribe listener from core:submit_command: ${unsubError.message}`,
            unsubError
          );
          // Optionally re-throw or handle differently
        }
      } else {
        // Optional: Warn if trying to unsubscribe a non-registered or already removed listener
        // console.warn('EventBusCommandInputGateway: Attempted to unsubscribe a listener that was not found.');
      }
    };

    return unsubscribeFn;
  }

  /**
   * Cleans up all subscriptions when the gateway is no longer needed.
   * Good practice for preventing memory leaks, especially in long-running applications.
   */
  destroy() {
    // Create a copy of keys to iterate over, as we modify the map during iteration
    const listenersToUnsubscribe = Array.from(this.#listeners.keys());
    listenersToUnsubscribe.forEach((listener) => {
      const handlerToRemove = this.#listeners.get(listener);
      if (handlerToRemove) {
        try {
          this.#ved.unsubscribe('core:submit_command', handlerToRemove);
        } catch (unsubError) {
          console.error(
            `EventBusCommandInputGateway: Error during destroy unsubscribe for core:submit_command: ${unsubError.message}`,
            unsubError
          );
        }
      }
    });
    this.#listeners.clear();
  }
}

// --- FILE END ---
