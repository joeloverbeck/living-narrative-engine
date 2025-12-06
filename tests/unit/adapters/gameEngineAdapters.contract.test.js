import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

describe('GameEngine adapters contract coverage', () => {
  describe('GameEngineLoadAdapter', () => {
    it('wraps a GameEngine instance and forwards load requests verbatim', async () => {
      const expectedResult = { slot: 'alpha', state: { hero: 'Evelyn' } };
      const engine = {
        loadGame: jest.fn().mockResolvedValue(expectedResult),
      };

      const adapter = new GameEngineLoadAdapter(engine);

      expect(adapter).toBeInstanceOf(ILoadService);
      await expect(adapter.load('alpha')).resolves.toBe(expectedResult);
      expect(engine.loadGame).toHaveBeenCalledTimes(1);
      expect(engine.loadGame).toHaveBeenCalledWith('alpha');
    });

    it('surfaces thrown errors from the underlying engine load implementation', async () => {
      const error = new Error('load failed');
      const engine = {
        loadGame: jest.fn(() => {
          throw error;
        }),
      };
      const adapter = new GameEngineLoadAdapter(engine);

      await expect(adapter.load('beta')).rejects.toBe(error);
      expect(engine.loadGame).toHaveBeenCalledWith('beta');
    });

    it('rejects when the provided engine does not implement loadGame', async () => {
      const adapter = new GameEngineLoadAdapter({});

      await expect(adapter.load('missing-method')).rejects.toBeInstanceOf(
        TypeError
      );
    });
  });

  describe('GameEngineSaveAdapter', () => {
    it('invokes triggerManualSave with the expected argument order', async () => {
      const result = { ok: true };
      const engine = {
        triggerManualSave: jest.fn().mockResolvedValue(result),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      expect(adapter).toBeInstanceOf(ISaveService);
      await expect(adapter.save('slot-3', 'Autosave')).resolves.toBe(result);
      expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Autosave',
        'slot-3'
      );
    });

    it('propagates synchronous exceptions from triggerManualSave', async () => {
      const error = new Error('save failure');
      const engine = {
        triggerManualSave: jest.fn(() => {
          throw error;
        }),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      await expect(adapter.save('slot-4', 'Manual Save')).rejects.toBe(error);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Manual Save',
        'slot-4'
      );
    });

    it('rejects when the engine is missing triggerManualSave', async () => {
      const adapter = new GameEngineSaveAdapter({});

      await expect(adapter.save('slot-5', 'Broken')).rejects.toBeInstanceOf(
        TypeError
      );
    });
  });
});
