import { describe, expect, it, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';

/**
 * These focused tests ensure the simple adapter still behaves as a faithful
 * delegate when interacting with the underlying engine instance. The module
 * previously showed poor coverage in the unit suite, so we explicitly exercise
 * both construction and the asynchronous delegation contract here.
 */
describe('GameEngineLoadAdapter delegation guarantees', () => {
  it('stores the engine instance provided at construction time', async () => {
    const loadGame = jest
      .fn()
      .mockResolvedValue({ saveSlot: 'alpha', loaded: true });
    const fakeEngine = { loadGame };

    const adapter = new GameEngineLoadAdapter(fakeEngine);
    const result = await adapter.load('alpha-slot');

    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledWith('alpha-slot');
    expect(result).toEqual({ saveSlot: 'alpha', loaded: true });
  });

  it('forwards the identifier verbatim and allows engines returning promises', async () => {
    const loadGame = jest.fn((identifier) => {
      expect(identifier).toBe('resume-42');
      return Promise.resolve({ ok: true, id: identifier });
    });

    const adapter = new GameEngineLoadAdapter({ loadGame });

    await expect(adapter.load('resume-42')).resolves.toEqual({
      ok: true,
      id: 'resume-42',
    });
    expect(loadGame).toHaveBeenCalledTimes(1);
  });
});
