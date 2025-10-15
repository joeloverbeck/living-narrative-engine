import { describe, expect, it, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';

const createAdapter = (engineOverrides = {}) => {
  const defaultLoadGame = jest.fn();
  const engine = { loadGame: defaultLoadGame, ...engineOverrides };
  const adapter = new GameEngineLoadAdapter(engine);
  return { adapter, engine, loadGame: engine.loadGame };
};

describe('GameEngineLoadAdapter', () => {
  it('delegates loading to the underlying engine and returns its result', async () => {
    const resolvedValue = { saveSlot: 'slot-a', state: { actors: [] } };
    const { adapter, loadGame } = createAdapter({
      loadGame: jest.fn().mockResolvedValue(resolvedValue),
    });

    await expect(adapter.load('slot-a')).resolves.toBe(resolvedValue);

    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledWith('slot-a');
  });

  it('propagates rejections from the engine without modification', async () => {
    const failure = new Error('filesystem unavailable');
    const { adapter, loadGame } = createAdapter({
      loadGame: jest.fn().mockRejectedValue(failure),
    });

    await expect(adapter.load('slot-b')).rejects.toBe(failure);

    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledWith('slot-b');
  });

  it('can operate with a synchronous loadGame implementation', async () => {
    const { adapter, loadGame } = createAdapter({
      loadGame: jest.fn((identifier) => ({ identifier, observed: true })),
    });

    await expect(adapter.load('slot-c')).resolves.toEqual({
      identifier: 'slot-c',
      observed: true,
    });

    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledWith('slot-c');
  });
});
