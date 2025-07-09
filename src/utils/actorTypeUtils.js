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
  // Support both Entity instances (with getComponentData) and plain objects
  let playerTypeComponent;
  
  if (actor?.getComponentData && typeof actor.getComponentData === 'function') {
    playerTypeComponent = actor.getComponentData('core:player_type');
  } else if (actor?.components?.['core:player_type']) {
    playerTypeComponent = actor.components['core:player_type'];
  }
  
  if (playerTypeComponent) {
    const playerType = playerTypeComponent.type;
    // For backward compatibility, map non-human types to 'ai'
    return playerType === 'human' ? 'human' : 'ai';
  }

  // Legacy check for core:player component
  let playerComponent;
  
  if (actor?.getComponentData && typeof actor.getComponentData === 'function') {
    playerComponent = actor.getComponentData('core:player');
  } else if (actor?.components?.['core:player']) {
    playerComponent = actor.components['core:player'];
  }
  
  if (playerComponent) {
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
  // Support both Entity instances (with getComponentData) and plain objects
  let playerTypeComponent;
  
  if (actor?.getComponentData && typeof actor.getComponentData === 'function') {
    playerTypeComponent = actor.getComponentData('core:player_type');
  } else if (actor?.components?.['core:player_type']) {
    playerTypeComponent = actor.components['core:player_type'];
  }
  
  if (playerTypeComponent) {
    return playerTypeComponent.type;
  }

  // Check AI type from legacy ai component
  let aiComponent;
  
  if (actor?.getComponentData && typeof actor.getComponentData === 'function') {
    aiComponent = actor.getComponentData('ai');
  } else if (actor?.components?.ai) {
    aiComponent = actor.components.ai;
  }
  
  if (aiComponent?.type) {
    return aiComponent.type.toLowerCase();
  }

  // Legacy checks
  let playerComponent;
  
  if (actor?.getComponentData && typeof actor.getComponentData === 'function') {
    playerComponent = actor.getComponentData('core:player');
  } else if (actor?.components?.['core:player']) {
    playerComponent = actor.components['core:player'];
  }
  
  if (playerComponent) {
    return 'human';
  }

  if (actor?.isAi === true) {
    return 'llm'; // Default AI type
  }

  return 'human'; // Default fallback
}
