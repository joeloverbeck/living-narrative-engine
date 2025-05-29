// src/types/promptData.js
// --- FILE START ---

/**
 * @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO // Assuming perceptionLogArray might be directly from DTO or processed
 */

/**
 * @typedef {object} PromptData
 * @description Represents the comprehensive data structure required to build a prompt for an LLM.
 * It consolidates all necessary information, including character details, world context,
 * available actions, and specific instructions for the AI.
 *
 * @property {string} taskDefinitionContent - Core instructions defining the AI's primary task.
 * @property {string} characterPersonaContent - Detailed description of the AI character's persona,
 * including traits, background, and motivations.
 * @property {string} portrayalGuidelinesContent - Specific guidelines on how the AI should portray the character,
 * focusing on tone, style, and embodiment.
 * @property {string} contentPolicyContent - Rules or guidelines regarding permissible content in AI responses.
 * @property {string} worldContextContent - Information about the current game world state, including location,
 * present NPCs, and relevant environmental details.
 * @property {string} availableActionsInfoContent - Details about the actions currently available to the AI character.
 * @property {string} userInputContent - The most recent input from the user, if any, to which the AI might react.
 * @property {string} finalInstructionsContent - Concluding instructions to guide the AI's decision-making process for the current turn.
 * @property {Array<object>} perceptionLogArray - A log of recent perceptions or events relevant to the AI character.
 * The exact structure of objects within this array will depend on how perceptions are logged.
 * @property {string} characterName - The name of the AI character.
 * @property {string} locationName - The name of the current location of the AI character.
 */

// exports.PromptData = {}; // Not needed for a typedef
// --- FILE END ---