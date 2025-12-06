import { describe, it, expect, jest } from '@jest/globals';
import GameEngineLoadAdapter from '../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../src/adapters/GameEngineSaveAdapter.js';
import ILoadService from '../../../src/interfaces/ILoadService.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

describe('GameEngine adapter coverage boost', () => {
  describe('GameEngineLoadAdapter', () => {
    it('delegates to the engine and resolves the value', async () => {
      const result = { ok: true, payload: { slot: 'alpha' } };
      const engine = { loadGame: jest.fn().mockResolvedValue(result) };
      const adapter = new GameEngineLoadAdapter(engine);

      expect(adapter).toBeInstanceOf(ILoadService);
      await expect(adapter.load('alpha')).resolves.toBe(result);
      expect(engine.loadGame).toHaveBeenCalledWith('alpha');
    });

    it('propagates engine rejections', async () => {
      const error = new Error('load failure');
      const engine = { loadGame: jest.fn().mockRejectedValue(error) };
      const adapter = new GameEngineLoadAdapter(engine);

      await expect(adapter.load('beta')).rejects.toBe(error);
      expect(engine.loadGame).toHaveBeenCalledTimes(1);
    });
  });

  describe('GameEngineSaveAdapter', () => {
    it('forwards save parameters in order', async () => {
      const engine = {
        triggerManualSave: jest.fn().mockResolvedValue({ ok: true }),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      expect(adapter).toBeInstanceOf(ISaveService);
      await expect(adapter.save(7, 'chapter 3')).resolves.toEqual({ ok: true });
      expect(engine.triggerManualSave).toHaveBeenCalledWith('chapter 3', 7);
    });

    it('bubbles up synchronous errors from the engine', async () => {
      const failure = new Error('disk full');
      const engine = {
        triggerManualSave: jest.fn(() => {
          throw failure;
        }),
      };
      const adapter = new GameEngineSaveAdapter(engine);

      await expect(adapter.save(5, 'danger')).rejects.toBe(failure);
      expect(engine.triggerManualSave).toHaveBeenCalledWith('danger', 5);
    });
  });
});
