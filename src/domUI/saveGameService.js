// src/domUI/saveGameService.js

/**
 * @file Service handling validation and execution of save game operations.
 */

import { validateDependency } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/index.js';

/** @typedef {import('./saveGameUI.js').SlotDisplayData} SlotDisplayData */
/** @typedef {import('../interfaces/ISaveService.js').ISaveService} ISaveService */
/** @typedef {import('../interfaces/IUserPrompt.js').IUserPrompt} IUserPrompt */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class SaveGameService
 * @description Encapsulates logic for validating and executing manual save requests.
 */
export default class SaveGameService {
  /** @type {ILogger} */
  #logger;
  /** @type {IUserPrompt} */
  #userPrompt;

  /**
   * Creates a new SaveGameService.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging instance.
   * @param {IUserPrompt} deps.userPrompt - Prompt utility for confirmations.
   */
  constructor({ logger, userPrompt }) {
    validateDependency(userPrompt, 'IUserPrompt', logger, {
      requiredMethods: ['confirm'],
    });
    this.#logger = ensureValidLogger(logger, 'SaveGameService');
    this.#userPrompt = userPrompt;
    this.#logger.debug('SaveGameService initialized.');
  }

  /**
   * Validates that a save can proceed.
   *
   * @param {SlotDisplayData | null} selectedSlotData - Currently selected slot.
   * @param {string} saveName - Proposed save name.
   * @param {GameEngine | null} gameEngine - Game engine instance.
   * @returns {string | null} Error message if validation fails, otherwise null.
   */
  validatePreconditions(selectedSlotData, saveName) {
    if (!selectedSlotData) {
      this.#logger.error(
        'SaveGameService.validatePreconditions: missing slot.'
      );
      return 'Cannot save: Internal error. Please select a slot and enter a name.';
    }

    if (!saveName || saveName.trim() === '') {
      return 'Please enter a name for your save.';
    }

    if (selectedSlotData.isCorrupted) {
      return 'Cannot save to a corrupted slot. Please choose another slot.';
    }

    return null;
  }

  /**
   * Asks the user to confirm overwriting an existing save.
   *
   * @param {SlotDisplayData | null} selectedSlotData - Slot to save into.
   * @param {string} saveName - Proposed save name.
   * @returns {boolean} True if confirmed or not required.
   */
  confirmOverwrite(selectedSlotData, saveName) {
    if (!selectedSlotData || selectedSlotData.isEmpty) {
      return true;
    }

    const originalName =
      selectedSlotData.saveName || `Slot ${selectedSlotData.slotId + 1}`;
    const confirmed = this.#userPrompt.confirm(
      `Are you sure you want to overwrite the existing save "${originalName}" with "${saveName}"?`
    );
    if (!confirmed) {
      this.#logger.debug(
        `SaveGameService: Save overwrite cancelled for slot ${selectedSlotData.slotId}.`
      );
    }
    return confirmed;
  }

  /**
   * Calls the game engine to execute the save.
   *
   * @param {SlotDisplayData} selectedSlotData - Slot being saved into.
   * @param {string} saveName - Name to use when saving.
   * @param {GameEngine} gameEngine - Game engine instance.
   * @param saveService
   * @returns {Promise<{result: any, returnedIdentifier: string | null}>}
   *   Result from the engine and identifier, if provided.
   */
  async executeSave(selectedSlotData, saveName, saveService) {
    this.#logger.debug(
      `SaveGameService: Triggering manual save "${saveName}" for slot ${selectedSlotData.slotId}. Identifier: ${selectedSlotData.identifier}`
    );
    const result = await saveService.save(selectedSlotData.slotId, saveName);
    const returnedIdentifier = result ? result.filePath : null;
    if (result && result.success && !returnedIdentifier) {
      this.#logger.error(
        'SaveGameService: Save operation succeeded but returned no filePath/identifier.',
        result
      );
    }
    return { result, returnedIdentifier };
  }

  /**
   * Executes the save and formats the outcome for the UI layer.
   *
   * @param {SlotDisplayData} selectedSlotData - Slot being saved into.
   * @param {string} saveName - Name to use when saving.
   * @param {GameEngine} gameEngine - Game engine instance.
   * @param saveService
   * @returns {Promise<{success: boolean, message: string, returnedIdentifier: string | null}>}
   *   Operation outcome details.
   */
  async performSave(selectedSlotData, saveName, saveService) {
    let saveSucceeded = false;
    let finalMessage = '';
    let returnedIdentifier = null;

    try {
      const { result, returnedIdentifier: id } = await this.executeSave(
        selectedSlotData,
        saveName,
        saveService
      );
      returnedIdentifier = id;

      if (result && result.success) {
        saveSucceeded = true;
        finalMessage = `Game saved as "${saveName}".`;
      } else {
        finalMessage = `Save failed: ${result?.error || 'An unknown error occurred while saving.'}`;
        this.#logger.error(`SaveGameService.performSave: ${finalMessage}`);
      }
    } catch (error) {
      const exceptionMsg =
        error instanceof Error ? error.message : String(error);
      finalMessage = `Save failed: ${exceptionMsg || 'An unexpected error occurred.'}`;
      this.#logger.error(
        'SaveGameService.performSave: Exception during save operation:',
        error
      );
    }

    return {
      success: saveSucceeded,
      message: finalMessage,
      returnedIdentifier,
    };
  }
}
