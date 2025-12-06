import { describe, expect, it, jest } from '@jest/globals';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';

const createAdapter = (engineOverrides = {}) => {
  const defaultTriggerManualSave = jest.fn();
  const engine = {
    triggerManualSave: defaultTriggerManualSave,
    ...engineOverrides,
  };
  const adapter = new GameEngineSaveAdapter(engine);
  return { adapter, engine, triggerManualSave: engine.triggerManualSave };
};

describe('GameEngineSaveAdapter', () => {
  it('delegates saving requests to the underlying engine', async () => {
    const saveResult = { slotId: 'slot-1', success: true };
    const { adapter, triggerManualSave } = createAdapter({
      triggerManualSave: jest.fn().mockResolvedValue(saveResult),
    });

    await expect(adapter.save('slot-1', 'First save')).resolves.toBe(
      saveResult
    );

    expect(triggerManualSave).toHaveBeenCalledTimes(1);
    expect(triggerManualSave).toHaveBeenCalledWith('First save', 'slot-1');
  });

  it('propagates engine failures without swallowing details', async () => {
    const error = new Error('disk full');
    const { adapter, triggerManualSave } = createAdapter({
      triggerManualSave: jest.fn().mockRejectedValue(error),
    });

    await expect(adapter.save('slot-2', 'Backup save')).rejects.toBe(error);

    expect(triggerManualSave).toHaveBeenCalledTimes(1);
    expect(triggerManualSave).toHaveBeenCalledWith('Backup save', 'slot-2');
  });

  it('supports synchronous triggerManualSave implementations', async () => {
    const { adapter, triggerManualSave } = createAdapter({
      triggerManualSave: jest.fn((name, slotId) => ({ name, slotId })),
    });

    await expect(adapter.save('slot-3', 'Third save')).resolves.toEqual({
      name: 'Third save',
      slotId: 'slot-3',
    });

    expect(triggerManualSave).toHaveBeenCalledTimes(1);
    expect(triggerManualSave).toHaveBeenCalledWith('Third save', 'slot-3');
  });
});
