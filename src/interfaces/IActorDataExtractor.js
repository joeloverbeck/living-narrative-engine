/**
 * @file This interface provides actor-specific data for a prompt.
 * @see src/interfaces/IActorDataExtractor.js
 */

/** @typedef {import('../turns/dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIActorStateDTO} AIActorStateDTO */

/**
 * @interface IActorDataExtractor
 * @description Defines the contract for a service that processes raw actorState
 * into a format suitable for AI prompts.
 */
export class IActorDataExtractor {
  /**
   * Extracts and transforms actor-specific data into an ActorPromptDataDTO.
   *
   * @param {AIActorStateDTO} actorState - The raw actor state object from the game state.
   * @returns {ActorPromptDataDTO} The populated DTO.
   */
  extractPromptData(actorState) {
    throw new Error(
      "Method 'extractPromptData(actorState)' must be implemented."
    );
  }
}
