import { describe, it, expect } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter async behaviour', () => {
  it('wraps synchronous loadGame results in a resolved promise', async () => {
    const resultPayload = { ok: true, data: { slot: 'seven' } };
    const engine = {
      loadGame(identifier) {
        expect(identifier).toBe('slot-7');
        return resultPayload;
      },
    };

    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('slot-7')).resolves.toBe(resultPayload);
  });

  it('invokes loadGame with the engine context intact', async () => {
    const calls = [];
    const engine = {
      id: 'engine-42',
      loadGame(identifier) {
        calls.push({ identifier, context: this.id });
        return { ok: true, context: this.id, identifier };
      },
    };

    const adapter = new GameEngineLoadAdapter(engine);
    const identifier = { slot: 'beta' };

    const resolution = await adapter.load(identifier);

    expect(resolution).toEqual({ ok: true, context: 'engine-42', identifier });
    expect(calls).toEqual([
      {
        identifier,
        context: 'engine-42',
      },
    ]);
    expect(calls[0].identifier).toBe(identifier);
  });

  it('propagates non-Error rejection reasons from loadGame', async () => {
    const rejection = { ok: false, reason: 'save missing' };
    const engine = {
      loadGame: () => Promise.reject(rejection),
    };

    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('slot-404')).rejects.toBe(rejection);
    expect(adapter).toBeInstanceOf(ILoadService);
  });
});
