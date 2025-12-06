import { describe, expect, it, jest } from '@jest/globals';

import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter behavioural coverage', () => {
  it('delegates load requests to the underlying engine and resolves with its result', async () => {
    const engine = {
      loadGame: jest.fn().mockResolvedValue({ slot: 'alpha', restored: true }),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    expect(adapter).toBeInstanceOf(ILoadService);

    await expect(adapter.load('alpha')).resolves.toEqual({
      slot: 'alpha',
      restored: true,
    });
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('alpha');
  });

  it('propagates rejections from engine.loadGame without altering the error instance', async () => {
    const failure = new Error('save slot not found');
    const engine = {
      loadGame: jest.fn().mockRejectedValue(failure),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('beta')).rejects.toBe(failure);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('beta');
  });

  it('supports synchronous loadGame implementations by wrapping their value in a promise', async () => {
    const engine = {
      loadGame: jest.fn((identifier) => ({ identifier, via: 'sync-path' })),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    const result = await adapter.load('gamma');
    expect(result).toEqual({ identifier: 'gamma', via: 'sync-path' });
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('gamma');
  });
});
