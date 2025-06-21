/**
 * @file Helper functions for ad-hoc GameEngine test beds.
 * @see tests/common/engine/gameEngineHelpers.js
 */

import {
  createGameEngineTestBed,
  GameEngineTestBed,
} from './gameEngineTestBed.js';

/**
 * Executes a callback with a temporary {@link GameEngineTestBed} instance.
 *
 * @param {Record<string, any>} [overrides] - Optional dependency overrides.
 * @param {(bed: import('./gameEngineTestBed.js').GameEngineTestBed,
 *   engine: import('../../../src/engine/gameEngine.js').default) =>
 *   (Promise<void>|void)} testFn - Function invoked with the bed and engine.
 * @returns {Promise<void>} Resolves when the callback completes.
 */
export async function withGameEngineBed(overrides = {}, testFn) {
  const bed = createGameEngineTestBed(overrides);
  try {
    bed.resetMocks();
    await testFn(bed, bed.engine);
  } finally {
    await bed.cleanup();
  }
}
