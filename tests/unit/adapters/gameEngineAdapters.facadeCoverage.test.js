import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';

describe('GameEngine adapters facade coverage', () => {
  describe('GameEngineLoadAdapter', () => {
    it('delegates load requests to the underlying engine', async () => {
      const loadGame = jest.fn().mockResolvedValue({ success: true });
      const adapter = new GameEngineLoadAdapter({ loadGame });

      const result = await adapter.load('slot-42');

      expect(loadGame).toHaveBeenCalledTimes(1);
      expect(loadGame).toHaveBeenCalledWith('slot-42');
      expect(result).toEqual({ success: true });
    });

    it('propagates engine errors', async () => {
      const error = new Error('engine failure');
      const loadGame = jest.fn().mockRejectedValue(error);
      const adapter = new GameEngineLoadAdapter({ loadGame });

      await expect(adapter.load('broken-slot')).rejects.toBe(error);
    });
  });

  describe('GameEngineSaveAdapter', () => {
    it('delegates save requests with correct argument order', async () => {
      const triggerManualSave = jest.fn().mockResolvedValue({ saved: true });
      const adapter = new GameEngineSaveAdapter({ triggerManualSave });

      const result = await adapter.save('slot-alpha', 'Quick Save');

      expect(triggerManualSave).toHaveBeenCalledTimes(1);
      expect(triggerManualSave).toHaveBeenCalledWith(
        'Quick Save',
        'slot-alpha'
      );
      expect(result).toEqual({ saved: true });
    });

    it('bubbles up save failures from the engine', async () => {
      const triggerManualSave = jest
        .fn()
        .mockRejectedValue(new Error('write-protected'));
      const adapter = new GameEngineSaveAdapter({ triggerManualSave });

      await expect(adapter.save('slot-beta', 'Manual Save')).rejects.toThrow(
        'write-protected'
      );
    });
  });
});
