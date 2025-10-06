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
});
