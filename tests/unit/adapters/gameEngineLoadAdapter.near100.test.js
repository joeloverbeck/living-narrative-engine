import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter additional coverage', () => {
  it('resolves when the engine returns a synchronous value', async () => {
    const engine = {
      loadGame: jest.fn(() => ({ slot: 'alpha', restored: true })),
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

  it('awaits when the engine returns a promise', async () => {
    const payload = { slot: 'delta', restored: true };
    const engine = {
      loadGame: jest.fn().mockResolvedValue(payload),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('delta')).resolves.toBe(payload);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('delta');
  });

  it('rejects when the engine throws synchronously', async () => {
    const error = new Error('synchronous failure');
    const engine = {
      loadGame: jest.fn(() => {
        throw error;
      }),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('beta')).rejects.toBe(error);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('beta');
  });

  it('propagates rejection when the engine returns a rejected promise', async () => {
    const error = new Error('async failure');
    const engine = {
      loadGame: jest.fn().mockRejectedValue(error),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('gamma')).rejects.toBe(error);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('gamma');
  });

  it('rejects with a TypeError when the engine does not expose loadGame', async () => {
    const adapter = new GameEngineLoadAdapter({});

    await expect(adapter.load('missing')).rejects.toBeInstanceOf(TypeError);
  });
});
