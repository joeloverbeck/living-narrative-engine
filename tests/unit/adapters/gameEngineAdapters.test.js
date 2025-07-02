import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';

describe('GameEngineLoadAdapter', () => {
  it('delegates load to the engine', async () => {
    const engine = { loadGame: jest.fn().mockResolvedValue('result') };
    const adapter = new GameEngineLoadAdapter(engine);
    await expect(adapter.load('foo')).resolves.toBe('result');
    expect(engine.loadGame).toHaveBeenCalledWith('foo');
  });
});

describe('GameEngineSaveAdapter', () => {
  it('delegates save to the engine', async () => {
    const engine = { triggerManualSave: jest.fn().mockResolvedValue('saved') };
    const adapter = new GameEngineSaveAdapter(engine);
    await expect(adapter.save('slot', 'name')).resolves.toBe('saved');
    expect(engine.triggerManualSave).toHaveBeenCalledWith('name', 'slot');
  });
});
