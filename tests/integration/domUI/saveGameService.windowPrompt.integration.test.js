import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import SaveGameService from '../../../src/domUI/saveGameService.js';
import WindowUserPrompt from '../../../src/domUI/windowUserPrompt.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import ISaveService from '../../../src/interfaces/ISaveService.js';

/**
 * Creates a SaveGameService configured with the real WindowUserPrompt and ConsoleLogger.
 *
 * @param {object} [options]
 * @param {() => boolean} [options.confirmImplementation] Custom confirmation behaviour.
 * @returns {{ service: SaveGameService, confirmSpy: jest.Mock }}
 */
function createService({ confirmImplementation } = {}) {
  if (!global.window) {
    throw new Error('jsdom window is not available for integration test.');
  }

  const confirmSpy = jest
    .fn(confirmImplementation || (() => true))
    .mockName('window.confirm');
  global.window.confirm = confirmSpy;

  const logger = new ConsoleLogger(LogLevel.DEBUG);
  const userPrompt = new WindowUserPrompt();
  const service = new SaveGameService({ logger, userPrompt });

  // Clear initialization logs so assertions only capture behaviour under test.
  console.debug.mockClear();
  console.error.mockClear();
  console.info.mockClear();
  console.warn.mockClear();

  return { service, confirmSpy };
}

/**
 * Utility class to drive SaveGameService with deterministic outcomes.
 */
class ScriptedSaveService extends ISaveService {
  /**
   * @param {(object | null | Error | string)[]} responses
   */
  constructor(responses) {
    super();
    this._responses = Array.isArray(responses) ? [...responses] : [];
    this.calls = [];
  }

  async save(slotId, name) {
    this.calls.push({ slotId, name });
    if (this._responses.length === 0) {
      return null;
    }

    const next = this._responses.shift();
    if (next instanceof Error || typeof next === 'string') {
      throw next;
    }
    return next;
  }
}

describe('SaveGameService integration with WindowUserPrompt and ConsoleLogger', () => {
  /** @type {jest.SpyInstance[]} */
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = [
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
    ];
  });

  afterEach(() => {
    if (global.window) {
      delete global.window.confirm;
    }
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  describe('validatePreconditions', () => {
    it('reports missing slot information and logs the issue', () => {
      const { service } = createService();

      const result = service.validatePreconditions(null, 'Any Save');

      expect(result).toBe(
        'Cannot save: Internal error. Please select a slot and enter a name.'
      );
      expect(console.error).toHaveBeenCalledWith(
        'SaveGameService.validatePreconditions: missing slot.'
      );
    });

    it('requires a non-empty save name', () => {
      const { service } = createService();
      const slot = { slotId: 2, isEmpty: false, isCorrupted: false };

      expect(service.validatePreconditions(slot, '   ')).toBe(
        'Please enter a name for your save.'
      );
      expect(service.validatePreconditions(slot, '')).toBe(
        'Please enter a name for your save.'
      );
    });

    it('blocks corrupted slots and approves valid ones', () => {
      const { service } = createService();
      const corruptedSlot = { slotId: 1, isEmpty: false, isCorrupted: true };
      const cleanSlot = { slotId: 1, isEmpty: false, isCorrupted: false };

      expect(service.validatePreconditions(corruptedSlot, 'Backup')).toBe(
        'Cannot save to a corrupted slot. Please choose another slot.'
      );
      expect(service.validatePreconditions(cleanSlot, 'Backup')).toBeNull();
    });
  });

  describe('confirmOverwrite', () => {
    it('bypasses prompts when no slot is selected', () => {
      const { service, confirmSpy } = createService();

      expect(service.confirmOverwrite(null, 'Any Save')).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('skips confirmation for empty slots', () => {
      const { service, confirmSpy } = createService();
      const emptySlot = { slotId: 3, isEmpty: true };

      expect(service.confirmOverwrite(emptySlot, 'First Save')).toBe(true);
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('asks for confirmation using the stored save name', () => {
      const { service, confirmSpy } = createService({
        confirmImplementation: () => false,
      });
      const slot = {
        slotId: 4,
        isEmpty: false,
        isCorrupted: false,
        saveName: 'Existing Run',
      };

      expect(service.confirmOverwrite(slot, 'Overwrite')).toBe(false);
      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to overwrite the existing save "Existing Run" with "Overwrite"?'
      );
      expect(console.debug).toHaveBeenCalledWith(
        'SaveGameService: Save overwrite cancelled for slot 4.'
      );
    });

    it('falls back to slot numbering when no previous name exists', () => {
      const { service, confirmSpy } = createService();
      const slot = { slotId: 0, isEmpty: false, isCorrupted: false };

      expect(service.confirmOverwrite(slot, 'New Save')).toBe(true);
      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to overwrite the existing save "Slot 1" with "New Save"?'
      );
    });
  });

  describe('executeSave', () => {
    it('delegates to the save service and returns identifiers', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService([
        { success: true, filePath: '/saves/run.json' },
      ]);
      const slot = { slotId: 5, identifier: 'slot-5', isEmpty: false };

      const outcome = await service.executeSave(
        slot,
        'Critical Run',
        saveService
      );

      expect(saveService.calls).toEqual([{ slotId: 5, name: 'Critical Run' }]);
      expect(outcome).toEqual({
        result: { success: true, filePath: '/saves/run.json' },
        returnedIdentifier: '/saves/run.json',
      });
      expect(console.debug).toHaveBeenCalledWith(
        'SaveGameService: Triggering manual save "Critical Run" for slot 5. Identifier: slot-5'
      );
    });

    it('logs when a successful save omits the identifier', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService([{ success: true }]);
      const slot = { slotId: 2, identifier: null, isEmpty: false };

      const outcome = await service.executeSave(
        slot,
        'No Identifier',
        saveService
      );

      expect(outcome).toEqual({
        result: { success: true },
        returnedIdentifier: undefined,
      });
      expect(console.error).toHaveBeenCalledWith(
        'SaveGameService: Save operation succeeded but returned no filePath/identifier.',
        { success: true }
      );
    });

    it('propagates null results without logging errors', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService([null]);
      const slot = { slotId: 1, identifier: 'slot-1', isEmpty: false };

      const outcome = await service.executeSave(
        slot,
        'Null Result',
        saveService
      );

      expect(outcome).toEqual({ result: null, returnedIdentifier: null });
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('performSave', () => {
    it('returns a friendly message when saves succeed', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService([
        { success: true, filePath: '/saves/success.json' },
      ]);
      const slot = { slotId: 8, identifier: 'slot-8', isEmpty: false };

      const result = await service.performSave(slot, 'Champion', saveService);

      expect(result).toEqual({
        success: true,
        message: 'Game saved as "Champion".',
        returnedIdentifier: '/saves/success.json',
      });
      expect(console.error).not.toHaveBeenCalled();
    });

    it('propagates save service errors into the UI message', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService([
        {
          success: false,
          error: 'Disk full',
          filePath: '/saves/failure.json',
        },
      ]);
      const slot = { slotId: 3, identifier: 'slot-3', isEmpty: false };

      const result = await service.performSave(slot, 'Disk Issue', saveService);

      expect(result).toEqual({
        success: false,
        message: 'Save failed: Disk full',
        returnedIdentifier: '/saves/failure.json',
      });
      expect(console.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Save failed: Disk full'
      );
    });

    it('reports unknown failures when the save result is missing', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService([null]);
      const slot = { slotId: 10, identifier: 'slot-10', isEmpty: false };

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
      expect(console.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Save failed: An unknown error occurred while saving.'
      );
    });

    it('surfaces exceptions thrown by the save service', async () => {
      const { service } = createService();
      const failure = new Error('Persistence offline');
      const saveService = new ScriptedSaveService([failure]);
      const slot = { slotId: 7, identifier: 'slot-7', isEmpty: false };

      const result = await service.performSave(
        slot,
        'Critical Backup',
        saveService
      );

      expect(result).toEqual({
        success: false,
        message: 'Save failed: Persistence offline',
        returnedIdentifier: null,
      });
      expect(console.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Exception during save operation:',
        failure
      );
    });

    it('falls back to a generic error message for unknown rejections', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService(['']);
      const slot = { slotId: 6, identifier: 'slot-6', isEmpty: false };

      const result = await service.performSave(
        slot,
        'Fallback Failure',
        saveService
      );

      expect(result).toEqual({
        success: false,
        message: 'Save failed: An unexpected error occurred.',
        returnedIdentifier: null,
      });
      expect(console.error).toHaveBeenCalledWith(
        'SaveGameService.performSave: Exception during save operation:',
        ''
      );
    });

    it('still succeeds when the save lacks a returned identifier', async () => {
      const { service } = createService();
      const saveService = new ScriptedSaveService([{ success: true }]);
      const slot = { slotId: 12, identifier: 'slot-12', isEmpty: false };

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
      expect(console.error).toHaveBeenCalledWith(
        'SaveGameService: Save operation succeeded but returned no filePath/identifier.',
        { success: true }
      );
    });
  });
});
