// src/turns/interfaces/ILLMAdapter.js
// --- FILE START ---

/**
 * @typedef {import('../../turns/interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction
 * // ITurnAction is the target structure for the parsed LLM JSON output.
 */

/**
 * @interface ILLMAdapter
 * @description
 * Defines the contract for an adapter responsible for all communication with an
 * external Large Language Model (LLM) service. This interface is crucial for
 * abstracting the specific details of LLM interaction from the AIPlayerStrategy,
 * allowing for different LLM providers or communication protocols to be used
 * without altering the core AI turn logic.
 */
export class ILLMAdapter {
    /**
     * Sends a request to the LLM service to generate an action based on the
     * provided game summary.
     *
     * The method is expected to handle communication with the LLM, including
     * formatting the request according to the LLM's API and parsing the response.
     * The gameSummary itself is expected to contain all necessary dynamic
     * information for the LLM to make a decision, including any relevant
     * actor-specific details.
     *
     * Error Handling:
     * Implementations should be robust to errors from the LLM service (e.g., network
     * issues, API errors, malformed responses, timeouts). Errors can be propagated
     * as exceptions. Alternatively, implementations might return a structured error
     * within the JSON string itself if the LLM interaction fails in a recoverable
     * or specific way that the caller (AIPlayerStrategy) might need to handle
     * (e.g., LLM refusing to answer, content moderation). For simplicity in this
     * definition, throwing an exception (e.g., `LLMError` extending `Error`) is
     * the primary expectation for unrecoverable issues.
     *
     * @async
     * @param {string} gameSummary - A string providing a summarized representation
     * of the current game state and relevant actor information, structured
     * as a prompt or query for the LLM. This summary is expected to be
     * self-contained and sufficient for the LLM to generate an action.
     *
     * @returns {Promise<string>} A Promise that resolves to a JSON string.
     * This JSON string represents the LLM's suggested action and must conform to
     * the "Action JSON Structure" defined below.
     * @throws {Error} If communication with the LLM fails, if the response
     * is malformed beyond recovery, or if other critical errors occur during generation.
     *
     * @example Action JSON Structure:
     * The LLM is expected to return a JSON string that can be parsed into an object
     * with the following fields. This structure is designed to be directly
     * transformable into an ITurnAction object.
     *
     * {
     * "actionDefinitionId": "namespace:action_name", // Required. Maps to ITurnAction.actionDefinitionId
     * "resolvedParameters": {                       // Optional. Maps to ITurnAction.resolvedParameters
     * "parameterName1": "value1",
     * "parameterName2": 123,
     * "targetId": "entity_id_123"
     * },
     * "commandString": "optional human-readable command for logging" // Optional. Maps to ITurnAction.commandString
     * }
     *
     * Details:
     * - `actionDefinitionId` (string, required): The unique, namespaced identifier
     * for a data-defined action (e.g., "core:wait", "combat:basic_attack",
     * "skill:fireball", "interaction:speak"). This is the primary field used
     * by the game system to execute the action.
     * - `resolvedParameters` (object, optional): An object containing key-value pairs
     * for parameters specific to this instance of the action. The keys and values
     * depend on the requirements of the action defined by `actionDefinitionId`.
     * If an action requires no parameters, this field can be omitted or be an empty object.
     * - `commandString` (string, optional): A human-readable representation of the
     * command, primarily for logging or debugging purposes. (e.g., "Attack the goblin with the rusty sword").
     *
     * @example JSON for "Attack":
     * {
     * "actionDefinitionId": "combat:attack_target",
     * "resolvedParameters": {
     * "targetId": "enemy_goblin_001",
     * "weaponId": "item_short_sword_001" // Optional, if specific weapon choice is part of action
     * },
     * "commandString": "Attack Goblin Shaman with Short Sword"
     * }
     *
     * @example JSON for "Move":
     * {
     * "actionDefinitionId": "movement:move_to_coordinates",
     * "resolvedParameters": {
     * "x": 15,
     * "y": 22,
     * "z": 0 // Optional, if 3D movement
     * },
     * "commandString": "Move to (15, 22)"
     * }
     * // Alternative "Move Direction"
     * {
     * "actionDefinitionId": "movement:move_direction",
     * "resolvedParameters": {
     * "direction": "north"
     * },
     * "commandString": "Move North"
     * }
     *
     * @example JSON for "Use Item":
     * {
     * "actionDefinitionId": "item:use_on_target",
     * "resolvedParameters": {
     * "itemId": "item_health_potion_001",
     * "targetId": "player_character_001" // Could be self or another entity
     * },
     * "commandString": "Use Health Potion on Player"
     * }
     *
     * @example JSON for "Speak":
     * {
     * "actionDefinitionId": "interaction:speak_to_target",
     * "resolvedParameters": {
     * "targetId": "npc_merchant_001",
     * "speechContent": "Hello there! What wares do you have today?"
     * },
     * "commandString": "Say to Merchant: Hello there! What wares do you have today?"
     * }
     *
     * @example JSON for "Wait" (no parameters):
     * {
     * "actionDefinitionId": "core:wait",
     * "resolvedParameters": {}, // or omit resolvedParameters entirely
     * "commandString": "Wait"
     * }
     */
    async getAIDecision(gameSummary) {
        throw new Error("ILLMAdapter.generateAction method not implemented.");
    }
}

// --- FILE END ---