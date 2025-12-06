import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter synchronous behaviour', () => {
  it('resolves synchronous results returned by the engine', async () => {
    const expectedResult = { id: 'slot-7', ok: true };
    const engine = { loadGame: jest.fn(() => expectedResult) };
    const adapter = new GameEngineLoadAdapter(engine);

    expect(adapter).toBeInstanceOf(ILoadService);

    const result = await adapter.load('slot-7');
    expect(result).toBe(expectedResult);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('slot-7');
  });

  it('rejects when the engine throws synchronously', async () => {
    const boom = new Error('sync failure');
    const engine = {
      loadGame: jest.fn(() => {
        throw boom;
      }),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('slot-9')).rejects.toBe(boom);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('slot-9');
  });
});
