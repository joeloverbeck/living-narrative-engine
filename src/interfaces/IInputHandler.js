/**
 * @interface IInputHandler
 * @description Defines the contract for managing user input, enabling/disabling input capture,
 * and setting callbacks for command submission. Primarily interacts with the UI layer abstraction.
 */
export class IInputHandler {
  /**
   * Enables the input handler, allowing it to capture and process user input (e.g., listen for Enter key).
   * Often involves focusing a specific UI input element.
   *
   * @function enable
   * @returns {void}
   */
  enable() {
    throw new Error('IInputHandler.enable method not implemented.');
  }

  /**
   * Disables the input handler, preventing it from processing user input.
   * Often involves blurring or visually disabling a UI input element.
   *
   * @function disable
   * @returns {void}
   */
  disable() {
    throw new Error('IInputHandler.disable method not implemented.');
  }

  /**
   * Sets or replaces the callback function to be invoked when a command is submitted
   * (e.g., when the user presses Enter in the input field).
   *
   * @function setCommandCallback
   * @param {(command: string) => void} callbackFn - The function to call with the submitted command string.
   * Passing `null` or `undefined` might be used to clear the callback, depending on implementation.
   * @returns {void}
   * @throws {Error} Implementations might throw if the provided callback is not a function.
   */
  setCommandCallback(callbackFn) {
    throw new Error('IInputHandler.setCommandCallback method not implemented.');
  }
}
