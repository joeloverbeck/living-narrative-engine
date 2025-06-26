import { describe, it, expect, jest } from '@jest/globals';
import SaveGameService from '../../src/domUI/saveGameService.js';
import { createMockLogger } from '../common/mockFactories';

/**
 *
 */
function makeService() {
  const logger = createMockLogger();
  const userPrompt = { confirm: jest.fn(() => true) };
  const service = new SaveGameService({ logger, userPrompt });
  return { service, logger, userPrompt };
}

describe('SaveGameService', () => {
  describe('validatePreconditions', () => {
    it('returns error when slot missing', () => {
      const { service } = makeService();
      const result = service.validatePreconditions(null, 'name');
      expect(result).toMatch(/Cannot save/);
    });

    it('returns error when name empty', () => {
      const { service } = makeService();
      const result = service.validatePreconditions({ slotId: 0 }, '');
      expect(result).toBe('Please enter a name for your save.');
    });

    it('returns error when slot corrupted', () => {
      const { service } = makeService();
      const result = service.validatePreconditions(
        { slotId: 0, isCorrupted: true },
        'Test'
      );
      expect(result).toMatch(/corrupted/);
    });

    it('returns null when valid', () => {
      const { service } = makeService();
      const result = service.validatePreconditions(
        { slotId: 0, isCorrupted: false },
        'Valid'
      );
      expect(result).toBeNull();
    });
  });

  describe('confirmOverwrite', () => {
    it('bypasses confirmation for empty slot', () => {
      const { service, userPrompt } = makeService();
      const result = service.confirmOverwrite(
        { slotId: 0, isEmpty: true },
        'Test'
      );
      expect(result).toBe(true);
      expect(userPrompt.confirm).not.toHaveBeenCalled();
    });

    it('asks user when overwriting existing save', () => {
      const { service, userPrompt } = makeService();
      userPrompt.confirm.mockReturnValueOnce(false);
      const result = service.confirmOverwrite(
        { slotId: 0, isEmpty: false, saveName: 'Old' },
        'New'
      );
      expect(userPrompt.confirm).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('executeSave', () => {
    it('calls save service with slot and name', async () => {
      const { service } = makeService();
      const saveService = {
        save: jest.fn().mockResolvedValue({ success: true, filePath: 'id1' }),
      };
      const slot = { slotId: 1, identifier: 'id1' };
      const result = await service.executeSave(slot, 'Name', saveService);
      expect(saveService.save).toHaveBeenCalledWith(1, 'Name');
      expect(result).toEqual({
        result: { success: true, filePath: 'id1' },
        returnedIdentifier: 'id1',
      });
    });

    it('logs when success has no filePath', async () => {
      const { service, logger } = makeService();
      const saveService = {
        save: jest.fn().mockResolvedValue({ success: true }),
      };
      const slot = { slotId: 1 };
      const result = await service.executeSave(slot, 'Name', saveService);
      expect(logger.error).toHaveBeenCalled();
      expect(result).toEqual({
        result: { success: true },
        returnedIdentifier: undefined,
      });
    });
  });

  describe('performSave', () => {
    it('returns success message on successful save', async () => {
      const { service } = makeService();
      jest.spyOn(service, 'executeSave').mockResolvedValue({
        result: { success: true, filePath: 'id' },
        returnedIdentifier: 'id',
      });
      const slot = { slotId: 0 };
      const res = await service.performSave(slot, 'Name', {});
      expect(res).toEqual({
        success: true,
        message: 'Game saved as "Name".',
        returnedIdentifier: 'id',
      });
    });

    it('handles failure result', async () => {
      const { service } = makeService();
      jest.spyOn(service, 'executeSave').mockResolvedValue({
        result: { success: false, error: 'fail' },
        returnedIdentifier: null,
      });
      const res = await service.performSave({ slotId: 0 }, 'Name', {});
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/fail/);
      expect(res.returnedIdentifier).toBeNull();
    });

    it('handles thrown errors', async () => {
      const { service } = makeService();
      jest.spyOn(service, 'executeSave').mockRejectedValue(new Error('boom'));
      const res = await service.performSave({ slotId: 0 }, 'Name', {});
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/boom/);
      expect(res.returnedIdentifier).toBeNull();
    });
  });
});
