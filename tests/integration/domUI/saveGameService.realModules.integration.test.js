/**
 * @file Integration tests covering SaveGameService with its real dependency validators.
 */

import SaveGameService from '../../../src/domUI/saveGameService.js';
import { createEnhancedMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { validateLoggerMock } from '../../common/loggerTestUtils.js';

/**
 * Creates a SaveGameService harness wired with real dependency validators.
 *
 * @param {object} [options]
 * @param {() => boolean} [options.confirmImpl] - Custom confirm implementation.
 * @returns {{ service: SaveGameService, logger: ReturnType<typeof createEnhancedMockLogger>, userPrompt: { confirm: jest.Mock }}}
 */
function createHarness({ confirmImpl } = {}) {
  const logger = createEnhancedMockLogger();
  validateLoggerMock(logger, 'SaveGameService integration harness');

  const confirm = jest.fn(confirmImpl || (() => true));
  const userPrompt = { confirm };

  const service = new SaveGameService({ logger, userPrompt });
  // ensure initialization log captured and not interfering with assertions
  logger.debug.mockClear();

  return { service, logger, userPrompt };
}

describe('SaveGameService integration with dependencyUtils', () => {
  describe('constructor dependency validation', () => {
    it('rejects userPrompt instances without confirm method', () => {
      const logger = createEnhancedMockLogger();
      validateLoggerMock(logger, 'SaveGameService dependency rejection');

      expect(() => new SaveGameService({ logger, userPrompt: {} })).toThrow(
        /IUserPrompt/
      );
    });
  });

  describe('validatePreconditions', () => {
    it('returns error when no slot is selected and logs the issue', () => {
      const { service, logger } = createHarness();

      const result = service.validatePreconditions(null, 'Emergency Save');

      expect(result).toBe(
        'Cannot save: Internal error. Please select a slot and enter a name.'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'SaveGameService.validatePreconditions: missing slot.'
      );
    });

    it('asks for a save name when only whitespace is provided', () => {
      const { service } = createHarness();
      const slot = { slotId: 2, isEmpty: false, isCorrupted: false };

      expect(service.validatePreconditions(slot, '   ')).toBe(
        'Please enter a name for your save.'
      );
    });

    it('blocks corrupted slots from being used', () => {
      const { service } = createHarness();
      const slot = { slotId: 1, isEmpty: false, isCorrupted: true };

      expect(service.validatePreconditions(slot, 'Emergency Save')).toBe(
        'Cannot save to a corrupted slot. Please choose another slot.'
      );
    });

    it('approves valid slots and names', () => {
      const { service } = createHarness();
      const slot = { slotId: 0, isEmpty: false, isCorrupted: false };

      expect(service.validatePreconditions(slot, 'Chapter 3')).toBeNull();
    });
  });

  describe('confirmOverwrite', () => {
    it('skips confirmation when the slot is empty', () => {
      const { service, userPrompt } = createHarness();

      const result = service.confirmOverwrite(
        { slotId: 4, isEmpty: true },
        'Fresh Start'
      );

      expect(result).toBe(true);
      expect(userPrompt.confirm).not.toHaveBeenCalled();
    });

    it('asks for confirmation using the existing save name', () => {
      const confirmImpl = jest.fn(() => false);
      const { service, logger, userPrompt } = createHarness({
        confirmImpl,
      });
      const slot = {
        slotId: 6,
        isEmpty: false,
        isCorrupted: false,
        saveName: 'Existing Legend',
      };

      const confirmed = service.confirmOverwrite(slot, 'New Legend');

      expect(userPrompt.confirm).toHaveBeenCalledWith(
        'Are you sure you want to overwrite the existing save "Existing Legend" with "New Legend"?'
      );
      expect(confirmed).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        'SaveGameService: Save overwrite cancelled for slot 6.'
      );
    });

    it('falls back to slot index when previous name is unavailable', () => {
      const confirmImpl = jest.fn(() => true);
      const { service, userPrompt } = createHarness({ confirmImpl });
      const slot = { slotId: 0, isEmpty: false, isCorrupted: false };

      const confirmed = service.confirmOverwrite(slot, 'Overwrite Save');

      expect(confirmed).toBe(true);
      expect(userPrompt.confirm).toHaveBeenCalledWith(
        'Are you sure you want to overwrite the existing save "Slot 1" with "Overwrite Save"?'
      );
    });
  });

  describe('executeSave', () => {
    it('delegates to the save service and returns identifiers', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockResolvedValue({
          success: true,
          filePath: '/saves/slot-3.json',
        }),
      };
      const slot = { slotId: 3, identifier: 'slot-3', isEmpty: false };

      const outcome = await service.executeSave(
        slot,
        'Boss Fight',
        saveService
      );

      expect(saveService.save).toHaveBeenCalledWith(3, 'Boss Fight');
      expect(outcome).toEqual({
        result: { success: true, filePath: '/saves/slot-3.json' },
        returnedIdentifier: '/saves/slot-3.json',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'SaveGameService: Triggering manual save "Boss Fight" for slot 3. Identifier: slot-3'
      );
    });

    it('logs a warning when no identifier is returned despite success', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockResolvedValue({ success: true }),
      };
      const slot = { slotId: 1, identifier: null, isEmpty: false };

      const outcome = await service.executeSave(
        slot,
        'No Identifier',
        saveService
      );

      expect(outcome).toEqual({
        result: { success: true },
        returnedIdentifier: undefined,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'SaveGameService: Save operation succeeded but returned no filePath/identifier.',
        { success: true }
      );
    });

    it('treats null save results as missing data without logging errors', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockResolvedValue(null),
      };
      const slot = { slotId: 5, identifier: 'slot-5', isEmpty: false };

      const outcome = await service.executeSave(
        slot,
        'Ghost Save',
        saveService
      );

      expect(outcome).toEqual({ result: null, returnedIdentifier: null });
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('performSave', () => {
    it('wraps successful saves into a friendly response', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockResolvedValue({
          success: true,
          filePath: '/saves/slot-9.json',
        }),
      };
      const slot = { slotId: 9, identifier: 'slot-9', isEmpty: false };

      const result = await service.performSave(slot, 'Victory', saveService);

      expect(result).toEqual({
        success: true,
        message: 'Game saved as "Victory".',
        returnedIdentifier: '/saves/slot-9.json',
      });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('propagates error messages from the save service', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockResolvedValue({
          success: false,
          error: 'Disk full',
          filePath: '/saves/failing-slot.json',
        }),
      };
      const slot = { slotId: 12, identifier: 'slot-12', isEmpty: false };

      const result = await service.performSave(
        slot,
        'Retry Later',
        saveService
      );

      expect(result).toEqual({
        success: false,
        message: 'Save failed: Disk full',
        returnedIdentifier: '/saves/failing-slot.json',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Save failed: Disk full'
      );
    });

    it('reports unknown failures when the save service returns no result', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockResolvedValue(null),
      };
      const slot = { slotId: 13, identifier: 'slot-13', isEmpty: false };

      const result = await service.performSave(
        slot,
        'Missing Result',
        saveService
      );

      expect(result).toEqual({
        success: false,
        message: 'Save failed: An unknown error occurred while saving.',
        returnedIdentifier: null,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Save failed: An unknown error occurred while saving.'
      );
    });

    it('handles unexpected exceptions from the save service', async () => {
      const { service, logger } = createHarness();
      const failure = new Error('Persistence offline');
      const saveService = {
        save: jest.fn().mockRejectedValue(failure),
      };
      const slot = { slotId: 15, identifier: 'slot-15', isEmpty: false };

      const result = await service.performSave(
        slot,
        'Emergency Backup',
        saveService
      );

      expect(result).toEqual({
        success: false,
        message: 'Save failed: Persistence offline',
        returnedIdentifier: null,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Exception during save operation:',
        failure
      );
    });

    it('uses a fallback message when rejection lacks error details', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockRejectedValue(''),
      };
      const slot = { slotId: 18, identifier: 'slot-18', isEmpty: false };

      const result = await service.performSave(
        slot,
        'Fallback Save',
        saveService
      );

      expect(result).toEqual({
        success: false,
        message: 'Save failed: An unexpected error occurred.',
        returnedIdentifier: null,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Exception during save operation:',
        ''
      );
    });

    it('still succeeds when the save lacks a returned identifier', async () => {
      const { service, logger } = createHarness();
      const saveService = {
        save: jest.fn().mockResolvedValue({ success: true }),
      };
      const slot = { slotId: 7, identifier: 'slot-7', isEmpty: false };

      const result = await service.performSave(
        slot,
        'Identifier Missing',
        saveService
      );

      expect(result).toEqual({
        success: true,
        message: 'Game saved as "Identifier Missing".',
        returnedIdentifier: undefined,
      });
      expect(logger.error).toHaveBeenCalledWith(
        'SaveGameService: Save operation succeeded but returned no filePath/identifier.',
        { success: true }
      );
    });
  });
});
