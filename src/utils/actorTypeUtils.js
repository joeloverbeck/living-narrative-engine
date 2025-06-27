// src/utils/actorTypeUtils.js

/**
 * @file Utility to determine the actor type string.
 */

/**
 * Determines the actor type for event payloads.
 *
 * @description
 * Checks the actor's player_type component first, then falls back to legacy
 * detection methods. Returns the specific player type when available.
 * @param {object} actor - Actor entity or model to inspect.
 * @returns {string} The actor type: 'human', 'ai', 'llm', or 'goap'.
 */
export function determineActorType(actor) {
  // Check new player_type component first
  if (actor?.components?.['core:player_type']) {
    const playerType = actor.components['core:player_type'].type;
    // For backward compatibility, map non-human types to 'ai'
    return playerType === 'human' ? 'human' : 'ai';
  }

  // Legacy check for core:player component
  if (actor?.components?.['core:player']) {
    return 'human';
  }

  // Legacy isAi property check
  return actor && actor.isAi === true ? 'ai' : 'human';
}

/**
 * Determines the specific player type including AI subtypes.
 *
 * @description
 * Returns the specific player type from the player_type component or
 * infers it from legacy properties.
 * @param {object} actor - Actor entity or model to inspect.
 * @returns {string} The specific player type: 'human', 'llm', or 'goap'.
 */
export function determineSpecificPlayerType(actor) {
  // Check new player_type component first
  if (actor?.components?.['core:player_type']) {
    return actor.components['core:player_type'].type;
  }

  // Check AI type from legacy ai component
  if (actor?.components?.ai?.type) {
    return actor.components.ai.type.toLowerCase();
  }

  // Legacy checks
  if (actor?.components?.['core:player']) {
    return 'human';
  }

  if (actor?.isAi === true) {
    return 'llm'; // Default AI type
  }

  return 'human'; // Default fallback
}
