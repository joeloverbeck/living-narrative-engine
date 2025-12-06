import { describe, it, expect, jest } from '@jest/globals';

import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter (coverage focused)', () => {
  it('delegates the identifier to the underlying engine and returns its resolution', async () => {
    const loadGame = jest
      .fn()
      .mockResolvedValue({ ok: true, meta: { slot: 'alpha' } });
    const adapter = new GameEngineLoadAdapter({ loadGame });

    expect(adapter).toBeInstanceOf(ILoadService);

    await expect(adapter.load('save-alpha')).resolves.toEqual({
      ok: true,
      meta: { slot: 'alpha' },
    });
    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledWith('save-alpha');
  });

  it('surfaces rejections from the engine.loadGame call', async () => {
    const error = new Error('boom');
    const adapter = new GameEngineLoadAdapter({
      loadGame: jest.fn().mockRejectedValue(error),
    });

    await expect(adapter.load('save-beta')).rejects.toBe(error);
  });
});
