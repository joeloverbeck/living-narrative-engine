import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';

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

  it('implements the ILoadService contract and forwards identifiers untouched', async () => {
    const engine = { loadGame: jest.fn().mockResolvedValue({ ok: true }) };
    const adapter = new GameEngineLoadAdapter(engine);

    expect(adapter).toBeInstanceOf(ILoadService);

    const identifier = { slot: 'alpha', metadata: { timestamp: 123 } };
    await expect(adapter.load(identifier)).resolves.toEqual({ ok: true });
    expect(engine.loadGame).toHaveBeenCalledWith(identifier);
    expect(engine.loadGame.mock.calls[0][0]).toBe(identifier);
  });

  it('rejects when the engine does not expose a loadGame function', async () => {
    const adapter = new GameEngineLoadAdapter({});

    await expect(adapter.load('missing-method')).rejects.toBeInstanceOf(
      TypeError
    );
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
    expect(engine.triggerManualSave).toHaveBeenCalledWith(
      'critical',
      'slot-42'
    );
  });
});
