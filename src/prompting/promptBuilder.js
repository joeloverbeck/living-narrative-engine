/**
 * @module PromptBuilder
 * @description Orchestrator‑only implementation that delegates all element assembly
 *              to the AssemblerRegistry + PromptAssembler. It is responsible only
 *              for (1) resolving the LLM configuration, (2) filtering elements by
 *              their condition, (3) wiring those elements into PromptAssembler,
 *              and (4) returning the final prompt string.
 *
 * Public API surface remains **unchanged**: `async build(llmId, promptData)`.
 */

/* eslint-env es2022 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../llms/llmConfigService.js').LLMConfigService} LLMConfigService */
/** @typedef {import('../utils/placeholderResolverUtils.js').PlaceholderResolver} PlaceholderResolver */
/** @typedef {import('../interfaces/IPromptBuilder.js').IPromptBuilder} IPromptBuilder */
/** @typedef {import('../prompting/assemblerRegistry.js').AssemblerRegistry} AssemblerRegistry */
/** @typedef {import('../prompting/elementConditionEvaluator.js')} ConditionEvaluatorModule */
/** @typedef {import('../types/promptData.js').PromptData} PromptData */

import { IPromptBuilder } from '../interfaces/IPromptBuilder.js';
import { validateDependency } from '../utils/validationUtils.js';
import { PromptAssembler } from './promptAssembler.js';

const INIT_MSG =
  'PromptBuilder (orchestrator‑only) initialised with LLMConfigService, PlaceholderResolver, AssemblerRegistry and ConditionEvaluator.';

/**
 * @class PromptBuilder
 * @implements {IPromptBuilder}
 */
export class PromptBuilder extends IPromptBuilder {
  /** @type {ILogger} */ #logger;
  /** @type {LLMConfigService} */ #llmConfigService;
  /** @type {PlaceholderResolver} */ #placeholderResolver;
  /** @type {AssemblerRegistry} */ #assemblerRegistry;
  /** @type {{ isElementConditionMet: Function }} */ #conditionEvaluator;

  /**
   * Creates a new PromptBuilder instance.
   *
   * @param {object} dependencies
   * @param {ILogger} [dependencies.logger]
   * @param {LLMConfigService} dependencies.llmConfigService
   * @param {PlaceholderResolver} dependencies.placeholderResolver
   * @param {AssemblerRegistry} dependencies.assemblerRegistry
   * @param {{ isElementConditionMet: Function }} dependencies.conditionEvaluator
   */
  constructor({
    logger = console,
    llmConfigService,
    placeholderResolver,
    assemblerRegistry,
    conditionEvaluator,
  }) {
    super();

    this.#logger = logger;

    // ──────────────────────────────────────────────────────────────────────────
    // Dependency validation – fail fast & loud
    // ──────────────────────────────────────────────────────────────────────────
    validateDependency(llmConfigService, 'LLMConfigService', this.#logger, {
      requiredMethods: ['getConfig'],
    });
    this.#llmConfigService = llmConfigService;

    validateDependency(
      placeholderResolver,
      'PlaceholderResolver',
      this.#logger
    );
    this.#placeholderResolver = placeholderResolver;

    validateDependency(assemblerRegistry, 'AssemblerRegistry', this.#logger, {
      requiredMethods: ['resolve'],
    });
    this.#assemblerRegistry = assemblerRegistry;

    validateDependency(conditionEvaluator, 'ConditionEvaluator', this.#logger, {
      requiredMethods: ['isElementConditionMet'],
    });
    this.#conditionEvaluator = conditionEvaluator;

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

    // 1️⃣  Load config for the requested LLM
    const cfg = await this.#llmConfigService.getConfig(llmId);
    if (!cfg) {
      this.#logger.error(
        `PromptBuilder.build: No configuration found for llmId '${llmId}'.`
      );
      return '';
    }

    // Re‑index elements for O(1) lookup
    const elementMap = new Map(cfg.promptElements.map((e) => [e.key, e]));

    /** @type {import('./promptAssembler.js').PromptAssemblerElement[]} */
    const assemblerElements = [];

    // 2️⃣  Iterate over declared assemblyOrder, filter by condition, resolve assembler
    for (const key of cfg.promptAssemblyOrder) {
      const elementConfig = elementMap.get(key);
      if (!elementConfig) {
        this.#logger.warn(
          `PromptBuilder.build: Key '${key}' missing in promptElements. Skipping.`
        );
        continue;
      }

      const shouldInclude = this.#conditionEvaluator.isElementConditionMet(
        elementConfig.condition,
        promptData
      );
      if (!shouldInclude) {
        this.#logger.debug(
          `PromptBuilder.build: Condition for '${key}' not met – skipped.`
        );
        continue;
      }

      /** @type {import('../interfaces/IPromptElementAssembler.js').IPromptElementAssembler} */
      let assembler;
      try {
        assembler = this.#assemblerRegistry.resolve(key);
      } catch (err) {
        // Bubble the error – this is exactly the acceptance‑test expectation
        this.#logger.error(err.message);
        throw err;
      }

      assemblerElements.push({
        key,
        assembler,
        elementConfig,
        promptData,
      });
    }

    // 3️⃣  Delegate concatenation to PromptAssembler
    const promptAssembler = new PromptAssembler({
      elements: assemblerElements,
      placeholderResolver: this.#placeholderResolver,
      allElementsMap: elementMap,
    });

    const { prompt, errors } = promptAssembler.build();

    // 4️⃣  Surface non‑fatal assembly errors for diagnostics
    if (errors.length) {
      this.#logger.error(
        `PromptBuilder.build: ${errors.length} element(s) failed during assembly. First error:`,
        errors[0]
      );
    }

    this.#logger.debug(
      `PromptBuilder.build: Completed. Final prompt length = ${prompt.length}.`
    );

    return prompt;
  }
}

export default PromptBuilder;
