import { describe, it, expect } from '@jest/globals';

import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

describe('GameEngine adapters proxy behaviour', () => {
  describe('GameEngineLoadAdapter', () => {
    it('delegates load requests to the underlying engine', async () => {
      const engine = {
        loadGame: jest.fn().mockResolvedValue({ success: true, slot: 'alpha' }),
      };
      const adapter = new GameEngineLoadAdapter(engine);

      expect(adapter).toBeInstanceOf(ILoadService);

      const result = await adapter.load('alpha');

      expect(result).toEqual({ success: true, slot: 'alpha' });
      expect(engine.loadGame).toHaveBeenCalledTimes(1);
      expect(engine.loadGame).toHaveBeenCalledWith('alpha');
    });

    it('propagates engine failures without modification', async () => {
      const failure = new Error('load failed');
      const engine = {
        loadGame: jest.fn().mockRejectedValue(failure),
      };
      const adapter = new GameEngineLoadAdapter(engine);

      await expect(adapter.load('beta')).rejects.toBe(failure);
      expect(engine.loadGame).toHaveBeenCalledWith('beta');
    });
  });

  describe('GameEngineSaveAdapter', () => {
    it('invokes triggerManualSave with the expected argument order', async () => {
      const engine = {
        triggerManualSave: jest
          .fn()
          .mockResolvedValue({ ok: true, name: 'Hero', slotId: 'slot-7' }),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      expect(adapter).toBeInstanceOf(ISaveService);

      const result = await adapter.save('slot-7', 'Hero');

      expect(result).toEqual({ ok: true, name: 'Hero', slotId: 'slot-7' });
      expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
      expect(engine.triggerManualSave).toHaveBeenCalledWith('Hero', 'slot-7');
    });

    it('surface engine errors directly to the caller', async () => {
      const failure = Object.assign(new Error('save failed'), {
        code: 'EFAIL',
      });
      const engine = {
        triggerManualSave: jest.fn().mockRejectedValue(failure),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      await expect(adapter.save('slot-99', 'Fallback')).rejects.toBe(failure);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Fallback',
        'slot-99'
      );
    });
  });
});
