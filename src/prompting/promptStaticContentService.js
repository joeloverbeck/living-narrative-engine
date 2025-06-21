// src/prompting/promptStaticContentService.js
// --- FILE START ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
import { IPromptStaticContentService } from '../interfaces/iPromptStaticContentService.js';

/** @typedef {import('../loaders/promptTextLoader.js').default} PromptTextLoader */
/** @typedef {import('../interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService_Interface */

/**
 * @class PromptStaticContentService
 * @description Provides static text blocks and templates for LLM prompts loaded via PromptTextLoader.
 * @implements {IPromptStaticContentService_Interface}
 */
export class PromptStaticContentService extends IPromptStaticContentService {
  /** @type {ILogger} */ #logger;
  /** @type {PromptTextLoader} */ #promptTextLoader;
  /** @type {object|null} */ #promptData = null;
  /** @type {boolean} */ #initialized = false;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance.
   * @param {PromptTextLoader} dependencies.promptTextLoader - Loader used to fetch prompt text.
   */
  constructor({ logger, promptTextLoader }) {
    super();

    if (!logger) {
      throw new Error(
        'PromptStaticContentService: Logger dependency is required.'
      );
    }
    if (!promptTextLoader) {
      throw new Error(
        'PromptStaticContentService: PromptTextLoader dependency is required.'
      );
    }

    this.#logger = logger;
    this.#promptTextLoader = promptTextLoader;
    this.#logger.debug('PromptStaticContentService initialized.');
  }

  /**
   * Loads and caches the prompt text if it hasn't been loaded yet.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) return;

    this.#promptData = await this.#promptTextLoader.loadPromptText();
    this.#initialized = true;
  }

  /** @private */
  #ensureInitialized() {
    if (!this.#initialized) {
      throw new Error('PromptStaticContentService: Service not initialized.');
    }
  }

  /**
   * @returns {string}
   */
  getCoreTaskDescriptionText() {
    this.#ensureInitialized();
    return this.#promptData.coreTaskDescriptionText;
  }

  /**
   * @param {string} characterName
   * @returns {string}
   */
  getCharacterPortrayalGuidelines(characterName) {
    this.#ensureInitialized();
    const template = this.#promptData.characterPortrayalGuidelinesTemplate;
    return template.replace(/{{name}}/g, characterName);
  }

  /**
   * @returns {string}
   */
  getNc21ContentPolicyText() {
    this.#ensureInitialized();
    return this.#promptData.nc21ContentPolicyText;
  }

  /**
   * @returns {string}
   */
  getFinalLlmInstructionText() {
    this.#ensureInitialized();
    return this.#promptData.finalLlmInstructionText;
  }
}

export default PromptStaticContentService;
// --- FILE END ---
