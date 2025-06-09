/**
 * @file This interface provides the perception log data for a given actor.
 * @see src/interfaces/IPerceptionLogProvider.js
 */

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIPerceptionLogEntryDTO} AIPerceptionLogEntryDTO */

/**
 * @interface IPerceptionLogProvider
 * @description Defines the contract for a service that retrieves an actor's perception log.
 */
export class IPerceptionLogProvider {
  /**
   * Asynchronously retrieves and formats the perception log for a given actor.
   * @param {Entity} actor - The AI-controlled entity.
   * @param {ILogger} logger - An instance of the logger.
   * @returns {Promise<AIPerceptionLogEntryDTO[]>} A promise that resolves to an array of perception log entries.
   */
  async get(actor, logger) {
    throw new Error("Method 'get(actor, logger)' must be implemented.");
  }
}
