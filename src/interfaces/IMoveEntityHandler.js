/**
 * @file Interface for handlers that move an entity between locations.
 */

/** @typedef {import('../logic/defs.js').ExecutionContext} ExecutionContext */

/**
 * @interface IMoveEntityHandler
 * @description Defines a contract for moving an entity from one location to another.
 */
export class IMoveEntityHandler {
  /**
   * Execute a move operation.
   *
   * @param {object} params - Parameters for the move operation.
   * @param {ExecutionContext} executionContext - The execution context.
   * @returns {Promise<void>|void}
   */
  execute(params, executionContext) {
    throw new Error('IMoveEntityHandler.execute not implemented.');
  }
}
