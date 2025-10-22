import { describe, expect, it, jest } from '@jest/globals';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';

/**
 * @file Unit tests that exercise the delegation behaviour of GameEngineSaveAdapter.
 */

describe('GameEngineSaveAdapter delegation', () => {
  it('forwards save requests to the underlying engine with the documented argument order', async () => {
    const engine = {
      triggerManualSave: jest.fn(function triggerManualSave(name, slotId) {
        expect(this).toBe(engine);
        return Promise.resolve({ success: true, name, slotId });
      }),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    const result = await adapter.save(7, 'checkpoint');

    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith('checkpoint', 7);
    expect(result).toEqual({ success: true, name: 'checkpoint', slotId: 7 });
  });

  it('propagates rejections from triggerManualSave without modification', async () => {
    const error = new Error('disk full');
    const engine = {
      triggerManualSave: jest.fn(() => Promise.reject(error)),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save(2, 'autosave')).rejects.toBe(error);
    expect(engine.triggerManualSave).toHaveBeenCalledWith('autosave', 2);
  });

  it('rejects with a TypeError when triggerManualSave is not callable', async () => {
    const engine = { triggerManualSave: undefined };
    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save(1, 'invalid')).rejects.toThrow(TypeError);
  });
});
