import { describe, it, expect, jest } from '@jest/globals';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

describe('GameEngineSaveAdapter additional coverage', () => {
  it('resolves with direct values returned by the engine and forwards slot/name ordering', async () => {
    const savedState = { timestamp: 12345 };
    const engine = {
      triggerManualSave: jest.fn().mockReturnValue(savedState),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save('slot-1', 'first save')).resolves.toBe(
      savedState
    );

    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith(
      'first save',
      'slot-1'
    );
  });

  it('propagates synchronous errors thrown by the engine', async () => {
    const error = new Error('synchronous failure');
    const engine = {
      triggerManualSave: jest.fn(() => {
        throw error;
      }),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    await expect(adapter.save('slot-2', 'second save')).rejects.toBe(error);

    expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
    expect(engine.triggerManualSave).toHaveBeenCalledWith(
      'second save',
      'slot-2'
    );
  });

  it('implements ISaveService and maintains ordering across multiple invocations', async () => {
    const engine = {
      triggerManualSave: jest.fn((name, slot) => ({ name, slot })),
    };
    const adapter = new GameEngineSaveAdapter(engine);

    expect(adapter).toBeInstanceOf(ISaveService);

    await expect(adapter.save('alpha', 'first')).resolves.toEqual({
      name: 'first',
      slot: 'alpha',
    });
    await expect(adapter.save('beta', 'second')).resolves.toEqual({
      name: 'second',
      slot: 'beta',
    });

    expect(engine.triggerManualSave).toHaveBeenCalledTimes(2);
    expect(engine.triggerManualSave).toHaveBeenNthCalledWith(
      1,
      'first',
      'alpha'
    );
    expect(engine.triggerManualSave).toHaveBeenNthCalledWith(
      2,
      'second',
      'beta'
    );
  });

  it('rejects with a TypeError when the engine is missing triggerManualSave', async () => {
    const adapter = new GameEngineSaveAdapter({});

    await expect(adapter.save('slot-missing', 'broken')).rejects.toBeInstanceOf(
      TypeError
    );
  });
});
