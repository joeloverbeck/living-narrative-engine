/**
 * @file Helper functions for creating common actor test data.
 * @see tests/common/turns/testActors.js
 */

import { createMockActor } from '../mockFactories';

/**
 * Creates a mock AI actor entity.
 *
 * @param {string} id - Actor identifier.
 * @param {object} [options] - Additional creation options.
 * @returns {ReturnType<typeof createMockActor>} Mock AI actor.
 */
export function createAiActor(id, options = {}) {
  return createMockActor(id, { ...options, isPlayer: false });
}

/**
 * Creates a mock player actor entity.
 *
 * @param {string} [id] - Player identifier.
 * @param {object} [options] - Additional creation options.
 * @returns {ReturnType<typeof createMockActor>} Mock player actor.
 */
export function createPlayerActor(id = 'player1', options = {}) {
  return createMockActor(id, { ...options, isPlayer: true });
}

/**
 * Returns a simple set of default actors frequently used in TurnManager tests.
 *
 * @returns {{ ai1: ReturnType<typeof createAiActor>, ai2: ReturnType<typeof createAiActor>, player: ReturnType<typeof createPlayerActor> }}
 *   Object containing two AI actors and one player actor.
 */
export function createDefaultActors() {
  return {
    ai1: createAiActor('actor1'),
    ai2: createAiActor('actor2'),
    player: createPlayerActor('player1'),
  };
}
