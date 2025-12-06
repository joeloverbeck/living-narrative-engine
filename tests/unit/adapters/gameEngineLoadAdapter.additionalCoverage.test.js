import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter additional coverage', () => {
  it('resolves with direct values returned by the engine', async () => {
    const saveData = { slots: ['alpha'] };
    const engine = { loadGame: jest.fn().mockReturnValue(saveData) };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('alpha')).resolves.toBe(saveData);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('alpha');
  });

  it('propagates synchronous errors thrown by the engine', async () => {
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

  it('remains an ILoadService and forwards identifiers across multiple invocations', async () => {
    const engine = {
      loadGame: jest.fn((id) => ({ id })),
    };
    const adapter = new GameEngineLoadAdapter(engine);

    expect(adapter).toBeInstanceOf(ILoadService);

    await expect(adapter.load('first')).resolves.toEqual({ id: 'first' });
    await expect(adapter.load('second')).resolves.toEqual({ id: 'second' });

    expect(engine.loadGame).toHaveBeenCalledTimes(2);
    expect(engine.loadGame).toHaveBeenNthCalledWith(1, 'first');
    expect(engine.loadGame).toHaveBeenNthCalledWith(2, 'second');
  });
});
