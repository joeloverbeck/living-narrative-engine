import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter contract integration', () => {
  /** @type {{ loadGame: jest.Mock }} */
  let engine;

  beforeEach(() => {
    engine = {
      loadGame: jest.fn(),
    };
  });

  it('implements the ILoadService contract and resolves with engine payloads verbatim', async () => {
    const adapter = new GameEngineLoadAdapter(engine);
    const payload = { success: true, slots: [{ id: 'slot-3' }] };
    engine.loadGame.mockResolvedValue(payload);

    expect(adapter).toBeInstanceOf(ILoadService);

    const result = await adapter.load('slot-3');

    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('slot-3');
    expect(result).toBe(payload);
  });

  it('propagates rejections from the underlying game engine without wrapping the error', async () => {
    const adapter = new GameEngineLoadAdapter(engine);
    const error = new Error('filesystem unreachable');
    engine.loadGame.mockRejectedValue(error);

    await expect(adapter.load('slot-7')).rejects.toBe(error);
    expect(engine.loadGame).toHaveBeenCalledWith('slot-7');
  });

  it('surfaces synchronous exceptions thrown by the engine load method as rejections', async () => {
    const adapter = new GameEngineLoadAdapter({
      loadGame: () => {
        throw new Error('synchronous failure');
      },
    });

    await expect(adapter.load('slot-bad')).rejects.toThrow(
      'synchronous failure'
    );
  });
});
