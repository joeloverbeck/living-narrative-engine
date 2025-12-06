import { describe, expect, it, jest } from '@jest/globals';

import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

describe('GameEngineSaveAdapter behavioural coverage', () => {
  it('delegates saves to the engine using triggerManualSave(slotId, name)', async () => {
    const engine = {
      triggerManualSave: jest
        .fn()
        .mockResolvedValue({ slot: 'alpha', acknowledged: true }),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    expect(adapter).toBeInstanceOf(ISaveService);

    await expect(adapter.save('alpha', 'First Slot')).resolves.toEqual({
      slot: 'alpha',
      acknowledged: true,
    });
    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith(
      'First Slot',
      'alpha'
    );
  });

  it('propagates rejections from triggerManualSave so callers can handle the failure', async () => {
    const failure = new Error('disk full');
    const engine = {
      triggerManualSave: jest.fn().mockRejectedValue(failure),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save('beta', 'Emergency')).rejects.toBe(failure);
    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith('Emergency', 'beta');
  });

  it('supports synchronous triggerManualSave implementations and resolves their returned value', async () => {
    const engine = {
      triggerManualSave: jest.fn((name, slotId) => ({
        name,
        slotId,
        stored: true,
      })),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    const result = await adapter.save('gamma', 'Quick Save');
    expect(result).toEqual({
      name: 'Quick Save',
      slotId: 'gamma',
      stored: true,
    });
    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith(
      'Quick Save',
      'gamma'
    );
  });
});
