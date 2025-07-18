/**
 * @module PromptBuilder
 * @description Simplified prompt builder that uses template substitution instead of assemblers
 *
 * Public API surface remains **unchanged**: `async build(llmId, promptData)`.
 */

/* eslint-env es2022 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../llms/llmConfigManager.js').LlmConfigManager} LlmConfigManager */
/** @typedef {import('../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder */
/** @typedef {import('../types/promptData.js').PromptData} PromptData */
/** @typedef {import('./promptTemplateService.js').PromptTemplateService} PromptTemplateService */
/** @typedef {import('./promptDataFormatter.js').PromptDataFormatter} PromptDataFormatter */

import { IPromptBuilder } from '../interfaces/IPromptBuilder.js';
import { validateDependency } from '../utils/dependencyUtils.js';
import { PromptTemplateService } from './promptTemplateService.js';
import { PromptDataFormatter } from './promptDataFormatter.js';

const INIT_MSG =
  'PromptBuilder (template-based) initialised with LlmConfigManager, PromptTemplateService, and PromptDataFormatter.';

/**
 * @class PromptBuilder
 * @implements {IPromptBuilder}
 */
export class PromptBuilder extends IPromptBuilder {
  /** @type {ILogger} */ #logger;
  /** @type {LlmConfigManager} */ #llmConfigService;
  /** @type {PromptTemplateService} */ #templateService;
  /** @type {PromptDataFormatter} */ #dataFormatter;

  /**
   * Creates a new PromptBuilder instance.
   *
   * @param {object} dependencies
   * @param {ILogger} [dependencies.logger]
   * @param {LlmConfigManager} dependencies.llmConfigService
   * @param {PromptTemplateService} [dependencies.templateService]
   * @param {PromptDataFormatter} [dependencies.dataFormatter]
   */
  constructor({
    logger = console,
    llmConfigService,
    templateService,
    dataFormatter,
  }) {
    super();

    this.#logger = logger;

    // ──────────────────────────────────────────────────────────────────────────
    // Dependency validation – fail fast & loud
    // ──────────────────────────────────────────────────────────────────────────
    validateDependency(llmConfigService, 'LlmConfigManager', this.#logger, {
      requiredMethods: ['getConfig'],
    });
    this.#llmConfigService = llmConfigService;

    // Create default instances if not provided
    this.#templateService =
      templateService || new PromptTemplateService({ logger: this.#logger });
    this.#dataFormatter =
      dataFormatter || new PromptDataFormatter({ logger: this.#logger });

    this.#logger.debug(INIT_MSG);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Builds the final prompt string for a given LLM configuration and prompt data.
   *
   * @inheritdoc
   */
  async build(llmId, promptData) {
    this.#logger.debug(`PromptBuilder.build called for llmId='${llmId}'.`);

    if (!llmId || typeof llmId !== 'string') {
      this.#logger.error(
        'PromptBuilder.build: llmId is required and must be a string.'
      );
      return '';
    }
    if (!promptData || typeof promptData !== 'object') {
      this.#logger.error(
        'PromptBuilder.build: promptData is required and must be an object.'
      );
      return '';
    }

    // 1️⃣  Load config for the requested LLM (still needed for validation)
    const cfg = await this.#llmConfigService.getConfig(llmId);
    if (!cfg) {
      this.#logger.error(
        `PromptBuilder.build: No configuration found for llmId '${llmId}'.`
      );
      return '';
    }

    // 2️⃣  Format the prompt data into a flat object for template substitution
    const formattedData = this.#dataFormatter.formatPromptData(promptData);

    // 3️⃣  Process the character prompt template
    const prompt = this.#templateService.processCharacterPrompt(formattedData);

    this.#logger.debug(
      `PromptBuilder.build: Completed. Final prompt length = ${prompt.length}.`
    );

    return prompt;
  }
}

export default PromptBuilder;
