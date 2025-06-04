// src/core/ports/ICommandInputPort.js
// --- FILE START ---

/**
 * @file Defines the interface for receiving command input for the current player.
 */

/** @typedef {import('./commonTypes.js').UnsubscribeFn} UnsubscribeFn */

/**
 * @callback CommandListener
 * @description A listener function that receives submitted command strings.
 * @param {string} commandString - The command string submitted by the input source.
 * @returns {void | Promise<void>}
 */

/**
 * @interface ICommandInputPort
 * @description An interface representing the input boundary for player commands.
 * Implementations (Adapters) will bridge specific input mechanisms
 * (like an EventBus subscription, WebSocket message, etc.) to this port,
 * allowing the PlayerTurnHandler to remain agnostic to the command source.
 */
export class ICommandInputPort {
  /**
   * Registers a listener to be called whenever a command is submitted for the player.
   * This is analogous to subscribing to a command submission event.
   * @param {CommandListener} listener - The function to execute when a command is received.
   * @returns {UnsubscribeFn} A function that, when called, unregisters the provided listener.
   * @throws {Error} Implementations might throw if the listener is invalid or registration fails.
   */
  onCommand(listener) {
    throw new Error('ICommandInputPort.onCommand method not implemented.');
  }
}

// --- FILE END ---
