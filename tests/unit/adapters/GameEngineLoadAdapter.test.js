import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

describe('GameEngineLoadAdapter', () => {
  it('delegates load to the underlying engine', async () => {
    const loadResult = { success: true, data: { slot: 'alpha' } };
    const mockEngine = {
      loadGame: jest.fn().mockResolvedValue(loadResult),
    };
    const adapter = new GameEngineLoadAdapter(mockEngine);

    const result = await adapter.load('alpha');

    expect(mockEngine.loadGame).toHaveBeenCalledTimes(1);
    expect(mockEngine.loadGame).toHaveBeenCalledWith('alpha');
    expect(result).toBe(loadResult);
  });

  it('propagates errors thrown by the engine', async () => {
    const error = new Error('failed to load');
    const mockEngine = {
      loadGame: jest.fn().mockRejectedValue(error),
    };
    const adapter = new GameEngineLoadAdapter(mockEngine);

    await expect(adapter.load('beta')).rejects.toThrow(error);
    expect(mockEngine.loadGame).toHaveBeenCalledWith('beta');
  });

  it('implements the ILoadService contract', () => {
    const adapter = new GameEngineLoadAdapter({ loadGame: jest.fn() });

    expect(adapter).toBeInstanceOf(ILoadService);
    expect(typeof adapter.load).toBe('function');
  });
});
