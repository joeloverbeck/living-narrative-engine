import { describe, it, expect, beforeEach } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';

describe('GameEngine adapters integration', () => {
  describe('GameEngineLoadAdapter', () => {
    /** @type {{ loadGame: jest.Mock }} */
    let engine;

    beforeEach(() => {
      engine = {
        loadGame: jest.fn(),
      };
    });

    it('delegates load requests to the underlying game engine', async () => {
      const adapter = new GameEngineLoadAdapter(engine);
      const expected = { success: true, metadata: { slot: 'slot-1' } };
      engine.loadGame.mockResolvedValue(expected);

      const result = await adapter.load('slot-1');

      expect(engine.loadGame).toHaveBeenCalledTimes(1);
      expect(engine.loadGame).toHaveBeenCalledWith('slot-1');
      expect(result).toEqual(expected);
    });

    it('propagates load errors from the game engine', async () => {
      const adapter = new GameEngineLoadAdapter(engine);
      const error = new Error('Load failed');
      engine.loadGame.mockRejectedValue(error);

      await expect(adapter.load('corrupted-slot')).rejects.toBe(error);
      expect(engine.loadGame).toHaveBeenCalledWith('corrupted-slot');
    });
  });

  describe('GameEngineSaveAdapter', () => {
    /** @type {{ triggerManualSave: jest.Mock }} */
    let engine;

    beforeEach(() => {
      engine = {
        triggerManualSave: jest.fn(),
      };
    });

    it('delegates save requests to the underlying game engine', async () => {
      const adapter = new GameEngineSaveAdapter(engine);
      const payload = {
        success: true,
        slotId: 'slot-42',
        name: 'Integration Save',
      };
      engine.triggerManualSave.mockResolvedValue(payload);

      const result = await adapter.save('slot-42', 'Integration Save');

      expect(engine.triggerManualSave).toHaveBeenCalledTimes(1);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Integration Save',
        'slot-42'
      );
      expect(result).toEqual(payload);
    });

    it('propagates save errors from the game engine', async () => {
      const adapter = new GameEngineSaveAdapter(engine);
      const error = new Error('Save failed');
      engine.triggerManualSave.mockRejectedValue(error);

      await expect(adapter.save('slot-7', 'Broken Save')).rejects.toBe(error);
      expect(engine.triggerManualSave).toHaveBeenCalledWith(
        'Broken Save',
        'slot-7'
      );
    });
  });
});
