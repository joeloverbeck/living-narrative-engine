import { describe, it, expect, jest } from '@jest/globals';

import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

describe('GameEngine adapters direct coverage', () => {
  describe('GameEngineLoadAdapter', () => {
    it('delegates load requests to the provided engine', async () => {
      const engine = {
        loadGame: jest.fn().mockResolvedValue({ slot: 'alpha', ok: true }),
      };
      const adapter = new GameEngineLoadAdapter(engine);

      expect(adapter).toBeInstanceOf(ILoadService);

      await expect(adapter.load('alpha')).resolves.toEqual({
        slot: 'alpha',
        ok: true,
      });

      expect(engine.loadGame).toHaveBeenCalledTimes(1);
      expect(engine.loadGame).toHaveBeenCalledWith('alpha');
    });

    it('propagates engine load errors', async () => {
      const error = new Error('load failure');
      const engine = {
        loadGame: jest.fn().mockRejectedValue(error),
      };
      const adapter = new GameEngineLoadAdapter(engine);

      await expect(adapter.load('broken-slot')).rejects.toBe(error);
      expect(engine.loadGame).toHaveBeenCalledWith('broken-slot');
    });
  });

  describe('GameEngineSaveAdapter', () => {
    it('delegates save requests to triggerManualSave', async () => {
      const engine = {
        triggerManualSave: jest.fn().mockResolvedValue('saved!'),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      expect(adapter).toBeInstanceOf(ISaveService);

      await expect(adapter.save('slot-42', 'Manual Backup')).resolves.toBe(
        'saved!'
      );
      expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Manual Backup',
        'slot-42'
      );
    });

    it('propagates engine save failures', async () => {
      const error = new Error('save failure');
      const engine = {
        triggerManualSave: jest.fn().mockRejectedValue(error),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      await expect(adapter.save('slot-11', 'Broken Save')).rejects.toBe(error);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Broken Save',
        'slot-11'
      );
    });
  });
});
