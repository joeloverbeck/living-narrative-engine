import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter adapter coverage', () => {
  it('delegates to the underlying engine and resolves the returned payload', async () => {
    const loadGame = jest.fn().mockResolvedValue({ slot: 'alpha', ok: true });
    const engine = { loadGame };
    const adapter = new GameEngineLoadAdapter(engine);

    const result = await adapter.load({ slot: 'alpha' });

    expect(result).toEqual({ slot: 'alpha', ok: true });
    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledWith({ slot: 'alpha' });
    expect(adapter).toBeInstanceOf(ILoadService);
  });

  it('propagates synchronous errors thrown by the engine implementation', async () => {
    const error = new Error('synchronous failure');
    const loadGame = jest.fn(() => {
      throw error;
    });
    const adapter = new GameEngineLoadAdapter({ loadGame });

    await expect(adapter.load('beta')).rejects.toBe(error);
    expect(loadGame).toHaveBeenCalledWith('beta');
  });

  it('propagates promise rejections emitted by the engine', async () => {
    const error = new Error('async failure');
    const loadGame = jest.fn().mockRejectedValue(error);
    const adapter = new GameEngineLoadAdapter({ loadGame });

    await expect(adapter.load('gamma')).rejects.toBe(error);
    expect(loadGame).toHaveBeenCalledWith('gamma');
  });

  it('rejects with a TypeError when the engine lacks a loadGame method', async () => {
    const adapter = new GameEngineLoadAdapter({});

    await expect(adapter.load('delta')).rejects.toBeInstanceOf(TypeError);
  });
});
