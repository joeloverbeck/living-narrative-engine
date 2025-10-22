import { describe, expect, it, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';

/**
 * @file Additional behavioural coverage for GameEngineLoadAdapter to ensure
 * context delegation and synchronous error propagation are preserved.
 */

describe('GameEngineLoadAdapter context delegation', () => {
  it('preserves the engine context when delegating to loadGame', async () => {
    const engine = {
      secret: Symbol('engine-secret'),
      loadGame: jest.fn(function loadGame(identifier) {
        return {
          identifier,
          secret: this.secret,
          callCount: this.callCount ?? 0,
        };
      }),
      callCount: 0,
    };

    engine.loadGame.mockImplementation(function loadGame(identifier) {
      this.callCount += 1;
      return {
        identifier,
        secret: this.secret,
        callCount: this.callCount,
      };
    });

    const adapter = new GameEngineLoadAdapter(engine);
    const identifier = { slot: 'delta', metadata: { difficulty: 'hard' } };

    const result = await adapter.load(identifier);

    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith(identifier);
    expect(engine.loadGame.mock.instances[0]).toBe(engine);
    expect(result).toEqual({
      identifier,
      secret: engine.secret,
      callCount: 1,
    });
  });

  it('propagates synchronous exceptions thrown by loadGame', async () => {
    const error = new Error('synchronous failure');
    const engine = {
      loadGame: jest.fn(() => {
        throw error;
      }),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('slot-omega')).rejects.toBe(error);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('slot-omega');
  });
});
