import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';

describe('GameEngineLoadAdapter', () => {
  it('delegates load to the engine', async () => {
    const engine = { loadGame: jest.fn().mockResolvedValue('result') };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('foo')).resolves.toBe('result');
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('foo');
  });

  it('propagates load errors from the engine', async () => {
    const error = new Error('load failed');
    const engine = { loadGame: jest.fn().mockRejectedValue(error) };
    const adapter = new GameEngineLoadAdapter(engine);

    await expect(adapter.load('broken-slot')).rejects.toBe(error);
    expect(engine.loadGame).toHaveBeenCalledTimes(1);
    expect(engine.loadGame).toHaveBeenCalledWith('broken-slot');
  });
});

describe('GameEngineSaveAdapter', () => {
  it('delegates save to the engine', async () => {
    const engine = { triggerManualSave: jest.fn().mockResolvedValue('saved') };
    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save('slot', 'name')).resolves.toBe('saved');
    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith('name', 'slot');
  });

  it('propagates save errors from the engine', async () => {
    const error = new Error('save failed');
    const engine = { triggerManualSave: jest.fn().mockRejectedValue(error) };
    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save('slot-42', 'critical')).rejects.toBe(error);
    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith('critical', 'slot-42');
  });
});
