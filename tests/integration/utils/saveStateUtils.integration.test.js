import { describe, it, expect, jest } from '@jest/globals';
import { cloneValidatedState } from '../../../src/utils/saveStateUtils.js';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from '../../../src/persistence/persistenceErrors.js';

/**
 *
 */
function createTestLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('saveStateUtils integration', () => {
  it('returns a deep-cloned persistence success when the payload contains a gameState object', () => {
    const logger = createTestLogger();
    const source = {
      gameState: {
        player: { name: 'Avery', level: 7 },
        world: { region: 'Frostfall' },
      },
      metadata: { slot: 2 },
    };

    const result = cloneValidatedState(source, logger);

    expect(result.success).toBe(true);
    expect(result.data).not.toBe(source);
    expect(result.data.gameState).toEqual(source.gameState);
    expect(result.data.gameState).not.toBe(source.gameState);
    expect(result.data.metadata).toEqual(source.metadata);
    expect(logger.error).not.toHaveBeenCalled();

    // Mutating the cloned structure should not affect the original payload.
    result.data.gameState.player.level = 42;
    expect(source.gameState.player.level).toBe(7);
  });

  it('logs an error and returns an invalid game state failure when gameState is missing', () => {
    const logger = createTestLogger();
    const malformed = { gameState: null };

    const outcome = cloneValidatedState(malformed, logger);

    expect(outcome.success).toBe(false);
    expect(outcome.error).toBeInstanceOf(PersistenceError);
    expect(outcome.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
    expect(outcome.error.message).toBe('Invalid gameState for checksum calculation.');
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid or missing gameState property in save object.'
    );
  });

  it('treats primitive gameState values as invalid input', () => {
    const logger = createTestLogger();
    const malformed = { gameState: 'not-an-object' };

    const outcome = cloneValidatedState(malformed, logger);

    expect(outcome.success).toBe(false);
    expect(outcome.error).toBeInstanceOf(PersistenceError);
    expect(outcome.error.code).toBe(PersistenceErrorCodes.INVALID_GAME_STATE);
    expect(outcome.error.message).toBe('Invalid gameState for checksum calculation.');
    expect(logger.error).toHaveBeenCalledWith(
      'Invalid or missing gameState property in save object.'
    );
  });

  it('propagates deep clone failures from safeDeepClone when structured cloning is unavailable', () => {
    const logger = createTestLogger();
    const originalStructuredClone = globalThis.structuredClone;
    // Force the clone utility to use the JSON serialization fallback.
    globalThis.structuredClone = undefined;

    const circular = { gameState: { scene: 'Citadel Plaza' } };
    circular.self = circular;

    try {
      const outcome = cloneValidatedState(circular, logger);

      expect(outcome.success).toBe(false);
      expect(outcome.error).toBeInstanceOf(PersistenceError);
      expect(outcome.error.code).toBe(PersistenceErrorCodes.DEEP_CLONE_FAILED);
      expect(outcome.error.message).toBe('Failed to deep clone object.');
      expect(logger.error).toHaveBeenCalledWith(
        'DeepClone failed:',
        expect.any(Error)
      );
    } finally {
      // Restore the native structured clone implementation for subsequent tests.
      if (typeof originalStructuredClone === 'function') {
        globalThis.structuredClone = originalStructuredClone;
      } else {
        delete globalThis.structuredClone;
      }
    }
  });
});
