import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter', () => {
  it('extends the ILoadService contract and returns the engine result', async () => {
    const engine = { loadGame: jest.fn().mockResolvedValue({ ok: true }) };
    const adapter = new GameEngineLoadAdapter(engine);

    expect(adapter).toBeInstanceOf(ILoadService);

    const identifier = { slot: 'alpha' };
    await expect(adapter.load(identifier)).resolves.toEqual({ ok: true });
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith(identifier);
  });

  it('propagates rejections from the underlying engine', async () => {
    const error = new Error('boom');
    const engine = { loadGame: jest.fn().mockRejectedValue(error) };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('save-42')).rejects.toBe(error);
    expect(engine.loadGame).toHaveBeenCalledWith('save-42');
  });

  it('throws a TypeError when the engine does not expose loadGame', async () => {
    const adapter = new GameEngineLoadAdapter({});

    await expect(adapter.load('missing')).rejects.toBeInstanceOf(TypeError);
  });
});
