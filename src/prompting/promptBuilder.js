// src/prompting/promptBuilder.js

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../llms/llmConfigService.js').LLMConfigService} LLMConfigService
 * @typedef {import('../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 * @typedef {import('./assembling/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler
 * @typedef {import('./assembling/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler
 * @typedef {import('./assembling/thoughtsSectionAssembler.js').default} ThoughtsSectionAssembler
 * @typedef {import('./assembling/notesSectionAssembler.js').default} NotesSectionAssembler
 * @typedef {object} PromptElementCondition
 * @property {string} promptDataFlag
 * @property {any} [expectedValue]
 * @typedef {object} PromptElement
 * @property {string} key
 * @property {string} [prefix]
 * @property {string} [suffix]
 * @property {PromptElementCondition} [condition]
 * @typedef {object} PerceptionLogEntry
 * @property {string} content
 * @property {string} [role]
 * @property {string} [timestamp]
 * @typedef {object} PromptData
 * @property {Array<PerceptionLogEntry>} [perceptionLogArray]
 * @property {string[]} [thoughtsArray]
 * @property {Array<{ text: string; timestamp: string }>} [notesArray]
 * @property {boolean} [someConditionFlag]
 * @property {string} [characterSheetContent]
 * @property {boolean} [enableReasoning]
 */

import { IPromptBuilder } from '../interfaces/IPromptBuilder.js';
import { StandardElementAssembler } from './assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from './assembling/perceptionLogAssembler.js';
import { ThoughtsSectionAssembler } from './assembling/thoughtsSectionAssembler.js';
import { NotesSectionAssembler } from './assembling/notesSectionAssembler.js';

// Special keys
const PERCEPTION_LOG_WRAPPER_KEY = 'perception_log_wrapper';
const THOUGHTS_WRAPPER_KEY = 'thoughts_wrapper';
const NOTES_WRAPPER_KEY = 'notes_wrapper';

export class PromptBuilder extends IPromptBuilder {
  #logger;
  #llmConfigService;
  #placeholderResolver;
  #standardElementAssembler;
  #perceptionLogAssembler;
  #thoughtsSectionAssembler;
  #notesSectionAssembler;

  /**
   * @param {object} dependencies
   * @param {ILogger} [dependencies.logger]
   * @param {LLMConfigService} dependencies.llmConfigService
   * @param {PlaceholderResolver} dependencies.placeholderResolver
   * @param {StandardElementAssembler} dependencies.standardElementAssembler
   * @param {PerceptionLogAssembler} dependencies.perceptionLogAssembler
   * @param {ThoughtsSectionAssembler} dependencies.thoughtsSectionAssembler
   * @param {NotesSectionAssembler} dependencies.notesSectionAssembler
   */
  constructor({
    logger = console,
    llmConfigService,
    placeholderResolver,
    standardElementAssembler,
    perceptionLogAssembler,
    thoughtsSectionAssembler,
    notesSectionAssembler,
  }) {
    super();
    this.#logger = logger;

    if (!llmConfigService) {
      const errorMsg =
        'PromptBuilder: LLMConfigService is a required dependency.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#llmConfigService = llmConfigService;

    if (!placeholderResolver) {
      const errorMsg =
        'PromptBuilder: PlaceholderResolver is a required dependency.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#placeholderResolver = placeholderResolver;

    if (!standardElementAssembler) {
      const errorMsg =
        'PromptBuilder: StandardElementAssembler is a required dependency.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#standardElementAssembler = standardElementAssembler;

    if (!perceptionLogAssembler) {
      const errorMsg =
        'PromptBuilder: PerceptionLogAssembler is a required dependency.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#perceptionLogAssembler = perceptionLogAssembler;

    if (!thoughtsSectionAssembler) {
      this.#logger.warn(
        'PromptBuilder: ThoughtsSectionAssembler not provided; instantiating default.'
      );
      this.#thoughtsSectionAssembler = new ThoughtsSectionAssembler({
        logger: this.#logger,
      });
    } else {
      this.#thoughtsSectionAssembler = thoughtsSectionAssembler;
    }

    if (!notesSectionAssembler) {
      const errorMsg =
        'PromptBuilder: NotesSectionAssembler is a required dependency.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#notesSectionAssembler = notesSectionAssembler;

    this.#logger.info(
      'PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers (standard, perception-log, thoughts, notes).'
    );
  }

  /**
   * @private
   * @param {PromptElementCondition | undefined} condition
   * @param {PromptData} promptData
   * @returns {boolean}
   */
  #isElementConditionMet(condition, promptData) {
    if (!condition) {
      return true;
    }

    if (
      typeof condition.promptDataFlag !== 'string' ||
      !condition.promptDataFlag.trim()
    ) {
      this.#logger.warn(
        `PromptBuilder.#isElementConditionMet: Conditional element has invalid or empty 'promptDataFlag'. Assuming condition not met.`,
        { condition }
      );
      return false;
    }

    const flagName = condition.promptDataFlag;
    const actualVal = promptData[flagName];
    let conditionMet = false;

    if (Object.prototype.hasOwnProperty.call(condition, 'expectedValue')) {
      conditionMet = actualVal === condition.expectedValue;
    } else {
      conditionMet = Boolean(actualVal);
    }

    if (!conditionMet) {
      const expectedValMsg = Object.prototype.hasOwnProperty.call(
        condition,
        'expectedValue'
      )
        ? `'${condition.expectedValue}'`
        : 'truthy';

      this.#logger.debug(
        `PromptBuilder.#isElementConditionMet: Flag '${flagName}' (value: ${actualVal}) did not match expected (${expectedValMsg}).`
      );
    } else {
      this.#logger.debug(
        `PromptBuilder.#isElementConditionMet: Flag '${flagName}' condition met.`
      );
    }

    return conditionMet;
  }

  /**
   * @param {string} llmId
   * @param {PromptData} promptData
   * @returns {Promise<string>}
   */
  async build(llmId, promptData) {
    this.#logger.info(`PromptBuilder.build called for llmId: ${llmId}`);

    if (!llmId || typeof llmId !== 'string') {
      this.#logger.error(
        'PromptBuilder.build: llmId is required and must be a string.'
      );
      return '';
    }
    if (!promptData || typeof promptData !== 'object' || promptData === null) {
      this.#logger.error(
        'PromptBuilder.build: promptData is required and must be a non-null object.'
      );
      return '';
    }

    const selectedConfig = await this.#llmConfigService.getConfig(llmId);
    if (!selectedConfig) {
      this.#logger.error(
        `PromptBuilder.build: No configuration found or provided by LLMConfigService for llmId "${llmId}". Cannot build prompt.`
      );
      return '';
    }
    this.#logger.debug(
      `PromptBuilder.build: Using configuration '${selectedConfig.configId}'.`
    );

    let finalPromptString = '';
    const promptElementsMap = new Map(
      selectedConfig.promptElements.map((el) => [el.key, el])
    );

    for (const key of selectedConfig.promptAssemblyOrder) {
      const elementConfig = promptElementsMap.get(key);
      if (!elementConfig) {
        this.#logger.warn(
          `PromptBuilder.build: Key "${key}" from promptAssemblyOrder not found in promptElements for configId "${selectedConfig.configId}". Skipping.`
        );
        continue;
      }

      if (!this.#isElementConditionMet(elementConfig.condition, promptData)) {
        this.#logger.debug(
          `PromptBuilder.build: Skipping '${key}' due to unmet condition.`
        );
        continue;
      }

      this.#logger.debug(`PromptBuilder.build: Including element '${key}'.`);

      let currentElementOutput = '';
      let assemblerToUse = null;

      if (key === PERCEPTION_LOG_WRAPPER_KEY) {
        assemblerToUse = this.#perceptionLogAssembler;
      } else if (key === THOUGHTS_WRAPPER_KEY) {
        assemblerToUse = this.#thoughtsSectionAssembler;
      } else if (key === NOTES_WRAPPER_KEY) {
        assemblerToUse = this.#notesSectionAssembler;
      } else {
        assemblerToUse = this.#standardElementAssembler;
      }

      if (!assemblerToUse) {
        this.#logger.warn(
          `PromptBuilder.build: No assembler found for '${key}'. Skipping element.`
        );
        continue;
      }

      try {
        currentElementOutput = assemblerToUse.assemble(
          elementConfig,
          promptData,
          this.#placeholderResolver,
          promptElementsMap
        );
      } catch (err) {
        this.#logger.error(
          `PromptBuilder.build: Error assembling '${key}' with ${assemblerToUse.constructor.name}. Skipping element.`,
          { error: err }
        );
        currentElementOutput = '';
      }

      finalPromptString += currentElementOutput;
    }

    this.#logger.info(
      `PromptBuilder.build: Successfully assembled prompt for llmId: ${llmId} using config ${selectedConfig.configId}. Length: ${finalPromptString.length}`
    );
    return finalPromptString;
  }
}
