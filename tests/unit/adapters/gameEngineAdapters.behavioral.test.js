import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

describe('GameEngine adapters – delegation behaviour', () => {
  describe('GameEngineLoadAdapter', () => {
    it('extends ILoadService and delegates to loadGame', async () => {
      const engine = { loadGame: jest.fn().mockResolvedValue({ ok: true }) };
      const adapter = new GameEngineLoadAdapter(engine);

      expect(adapter).toBeInstanceOf(ILoadService);

      const identifier = { slot: 'alpha' };
      await expect(adapter.load(identifier)).resolves.toEqual({ ok: true });
      expect(engine.loadGame).toHaveBeenCalledTimes(1);
      expect(engine.loadGame).toHaveBeenCalledWith(identifier);
    });

    it('propagates rejections from the underlying engine', async () => {
      const failure = new Error('load failed');
      const engine = { loadGame: jest.fn().mockRejectedValue(failure) };
      const adapter = new GameEngineLoadAdapter(engine);

      await expect(adapter.load('slot-9')).rejects.toBe(failure);
      expect(engine.loadGame).toHaveBeenCalledWith('slot-9');
    });

    it('rejects with a TypeError when loadGame is not a function', async () => {
      const adapter = new GameEngineLoadAdapter({});

      await expect(adapter.load('missing-method')).rejects.toBeInstanceOf(
        TypeError
      );
    });
  });

  describe('GameEngineSaveAdapter', () => {
    it('extends ISaveService and forwards to triggerManualSave with name first', async () => {
      const engine = {
        triggerManualSave: jest.fn().mockResolvedValue({ saved: true }),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      expect(adapter).toBeInstanceOf(ISaveService);

      const payload = { slotId: 'slot-3', name: 'Quick Save' };
      await expect(adapter.save(payload.slotId, payload.name)).resolves.toEqual(
        {
          saved: true,
        }
      );
      expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        payload.name,
        payload.slotId
      );
    });

    it('propagates triggerManualSave rejections', async () => {
      const failure = new Error('save failed');
      const engine = {
        triggerManualSave: jest.fn().mockRejectedValue(failure),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      await expect(adapter.save('slot-7', 'Manual Save')).rejects.toBe(failure);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Manual Save',
        'slot-7'
      );
    });

    it('rejects with a TypeError when triggerManualSave is not present', async () => {
      const adapter = new GameEngineSaveAdapter({});

      await expect(adapter.save('slot-1', 'Broken')).rejects.toBeInstanceOf(
        TypeError
      );
    });
  });
});
