import { describe, expect, it } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter context-sensitive coverage', () => {
  it('preserves the engine context and forwards identifiers verbatim', async () => {
    const calls = [];
    const engine = {
      loadGame(identifier) {
        calls.push({ thisValue: this, identifier });
        return { ok: true, identifier, observedThis: this };
      },
    };
    const adapter = new GameEngineLoadAdapter(engine);
    const identifier = { slot: 'gamma' };

    const result = await adapter.load(identifier);

    expect(adapter).toBeInstanceOf(ILoadService);
    expect(result).toEqual({
      ok: true,
      identifier,
      observedThis: engine,
    });
    expect(calls).toEqual([
      {
        thisValue: engine,
        identifier,
      },
    ]);
    expect(calls[0].identifier).toBe(identifier);
    expect(result.identifier).toBe(identifier);
    expect(calls[0].thisValue).toBe(engine);
    expect(result.observedThis).toBe(engine);
  });

  it('propagates rejection reasons verbatim when the engine fails', async () => {
    const rejectionReason = { message: 'persistence offline', code: 'E_IO' };
    const engine = {
      async loadGame(identifier) {
        await Promise.resolve(identifier);
        throw rejectionReason;
      },
    };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('delta')).rejects.toBe(rejectionReason);
  });

  it('rejects with a TypeError when loadGame is not callable even if defined', async () => {
    const adapter = new GameEngineLoadAdapter({ loadGame: 42 });

    await expect(adapter.load('epsilon')).rejects.toThrow(
      /this\[#engine\]\.loadGame is not a function/
    );
  });
});
