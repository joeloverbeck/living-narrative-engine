// src/prompting/promptBuilder.js

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../llms/llmConfigService.js').LLMConfigService} LLMConfigService
 * @typedef {import('../utils/placeholderResolver.js').PlaceholderResolver} PlaceholderResolver
 * @typedef {import('./assembling/standardElementAssembler.js').StandardElementAssembler} StandardElementAssembler
 * @typedef {import('./assembling/perceptionLogAssembler.js').PerceptionLogAssembler} PerceptionLogAssembler
 * @typedef {import('./assembling/thoughtsSectionAssembler.js').default} ThoughtsSectionAssembler
 * @typedef {import('./assembling/notesSectionAssembler.js').default} NotesSectionAssembler
 * @typedef {import('./assembling/goalsSectionAssembler.js').default} GoalsSectionAssembler
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
 * @property {Array<{ text: string; timestamp: string }>} [goalsArray]
 * @property {boolean} [someConditionFlag]
 * @property {string} [characterSheetContent]
 * @property {boolean} [enableReasoning]
 * @property {Array<{ index: number; description: string }>} [indexedChoicesArray]
 */

import { IPromptBuilder } from '../interfaces/IPromptBuilder.js';
import { StandardElementAssembler } from './assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from './assembling/perceptionLogAssembler.js';
import { ThoughtsSectionAssembler } from './assembling/thoughtsSectionAssembler.js';
import { NotesSectionAssembler } from './assembling/notesSectionAssembler.js';
import { GoalsSectionAssembler } from './assembling/goalsSectionAssembler.js';
import { IndexedChoicesAssembler } from './assembling/indexedChoicesAssembler.js';
import { validateDependency } from '../utils/validationUtils.js';

// Special keys
const PERCEPTION_LOG_WRAPPER_KEY = 'perception_log_wrapper';
const THOUGHTS_WRAPPER_KEY = 'thoughts_wrapper';
const NOTES_WRAPPER_KEY = 'notes_wrapper';
const GOALS_WRAPPER_KEY = 'goals_wrapper';
const INDEXED_CHOICES_KEY = 'indexed_choices';

// Initialization message
const INIT_MSG =
  'PromptBuilder initialized with LLMConfigService, PlaceholderResolver, Assemblers (standard, perception-log, thoughts, notes, goals), and IndexedChoicesAssembler.';

export class PromptBuilder extends IPromptBuilder {
  #logger;
  #llmConfigService;
  #placeholderResolver;
  #standardElementAssembler;
  #perceptionLogAssembler;
  #thoughtsSectionAssembler;
  #notesSectionAssembler;
  #goalsSectionAssembler;
  #indexedChoicesAssembler;

  /**
   * @param {object} dependencies
   * @param {ILogger} [dependencies.logger]
   * @param {LLMConfigService} dependencies.llmConfigService
   * @param {PlaceholderResolver} dependencies.placeholderResolver
   * @param {StandardElementAssembler} dependencies.standardElementAssembler
   * @param {PerceptionLogAssembler} dependencies.perceptionLogAssembler
   * @param {ThoughtsSectionAssembler} [dependencies.thoughtsSectionAssembler]
   * @param {NotesSectionAssembler} dependencies.notesSectionAssembler
   * @param {GoalsSectionAssembler} [dependencies.goalsSectionAssembler]
   * @param {IndexedChoicesAssembler} dependencies.indexedChoicesAssembler
   */
  constructor({
    logger = console,
    llmConfigService,
    placeholderResolver,
    standardElementAssembler,
    perceptionLogAssembler,
    thoughtsSectionAssembler,
    notesSectionAssembler,
    goalsSectionAssembler,
    indexedChoicesAssembler,
  }) {
    super();

    // Use the provided or console logger
    this.#logger = logger;

    // Validate required dependencies with custom error messages
    if (!llmConfigService) {
      this.#logger.error(
        'PromptBuilder: LLMConfigService is a required dependency.'
      );
      throw new Error(
        'PromptBuilder: LLMConfigService is a required dependency.'
      );
    }
    validateDependency(llmConfigService, 'LLMConfigService', this.#logger, {
      requiredMethods: ['getConfig'],
    });
    this.#llmConfigService = llmConfigService;

    if (!placeholderResolver) {
      this.#logger.error(
        'PromptBuilder: PlaceholderResolver is a required dependency.'
      );
      throw new Error(
        'PromptBuilder: PlaceholderResolver is a required dependency.'
      );
    }
    validateDependency(
      placeholderResolver,
      'PlaceholderResolver',
      this.#logger
    );
    this.#placeholderResolver = placeholderResolver;

    if (!standardElementAssembler) {
      this.#logger.error(
        'PromptBuilder: StandardElementAssembler is a required dependency.'
      );
      throw new Error(
        'PromptBuilder: StandardElementAssembler is a required dependency.'
      );
    }
    validateDependency(
      standardElementAssembler,
      'StandardElementAssembler',
      this.#logger,
      { requiredMethods: ['assemble'] }
    );
    this.#standardElementAssembler = standardElementAssembler;

    if (!perceptionLogAssembler) {
      this.#logger.error(
        'PromptBuilder: PerceptionLogAssembler is a required dependency.'
      );
      throw new Error(
        'PromptBuilder: PerceptionLogAssembler is a required dependency.'
      );
    }
    validateDependency(
      perceptionLogAssembler,
      'PerceptionLogAssembler',
      this.#logger,
      { requiredMethods: ['assemble'] }
    );
    this.#perceptionLogAssembler = perceptionLogAssembler;

    if (!notesSectionAssembler) {
      this.#logger.error(
        'PromptBuilder: NotesSectionAssembler is a required dependency.'
      );
      throw new Error(
        'PromptBuilder: NotesSectionAssembler is a required dependency.'
      );
    }
    validateDependency(
      notesSectionAssembler,
      'NotesSectionAssembler',
      this.#logger,
      { requiredMethods: ['assemble'] }
    );
    this.#notesSectionAssembler = notesSectionAssembler;

    // Optional: ThoughtsSectionAssembler
    if (thoughtsSectionAssembler) {
      validateDependency(
        thoughtsSectionAssembler,
        'ThoughtsSectionAssembler',
        this.#logger,
        { requiredMethods: ['assemble'] }
      );
      this.#thoughtsSectionAssembler = thoughtsSectionAssembler;
    } else {
      this.#logger.warn(
        'PromptBuilder: ThoughtsSectionAssembler not provided; instantiating default.'
      );
      this.#thoughtsSectionAssembler = new ThoughtsSectionAssembler({
        logger: this.#logger,
      });
    }

    // Optional: GoalsSectionAssembler
    if (goalsSectionAssembler) {
      validateDependency(
        goalsSectionAssembler,
        'GoalsSectionAssembler',
        this.#logger,
        { requiredMethods: ['assemble'] }
      );
      this.#goalsSectionAssembler = goalsSectionAssembler;
    } else {
      this.#logger.warn(
        'PromptBuilder: GoalsSectionAssembler not provided; instantiating default.'
      );
      this.#goalsSectionAssembler = new GoalsSectionAssembler({
        logger: this.#logger,
      });
    }

    if (!indexedChoicesAssembler) {
      this.#logger.error(
        'PromptBuilder: IndexedChoicesAssembler is a required dependency.'
      );
      throw new Error(
        'PromptBuilder: IndexedChoicesAssembler is a required dependency.'
      );
    }
    validateDependency(
      indexedChoicesAssembler,
      'IndexedChoicesAssembler',
      this.#logger,
      { requiredMethods: ['assemble'] }
    );
    this.#indexedChoicesAssembler = indexedChoicesAssembler;

    // Final initialization log
    this.#logger.debug(INIT_MSG);
  }

  // (rest of class unchanged: #isElementConditionMet, build, etc.)
  /**
   * @private
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
   * Builds the final prompt string for a given LLM ID and prompt data.
   * @param {string} llmId
   * @param {PromptData} promptData
   * @returns {Promise<string>}
   */
  async build(llmId, promptData) {
    this.#logger.debug(`PromptBuilder.build called for llmId: ${llmId}`);

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
        `PromptBuilder.build: No configuration found for llmId "${llmId}".`
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
          `PromptBuilder.build: Key "${key}" not found in promptElements. Skipping.`
        );
        continue;
      }
      if (!this.#isElementConditionMet(elementConfig.condition, promptData)) {
        this.#logger.debug(
          `PromptBuilder.build: Skipping '${key}' due to unmet condition.`
        );
        continue;
      }

      let assemblerToUse;
      switch (key) {
        case INDEXED_CHOICES_KEY:
          assemblerToUse = this.#indexedChoicesAssembler;
          break;
        case PERCEPTION_LOG_WRAPPER_KEY:
          assemblerToUse = this.#perceptionLogAssembler;
          break;
        case THOUGHTS_WRAPPER_KEY:
          assemblerToUse = this.#thoughtsSectionAssembler;
          break;
        case NOTES_WRAPPER_KEY:
          assemblerToUse = this.#notesSectionAssembler;
          break;
        case GOALS_WRAPPER_KEY:
          assemblerToUse = this.#goalsSectionAssembler;
          break;
        default:
          assemblerToUse = this.#standardElementAssembler;
      }

      try {
        finalPromptString += assemblerToUse.assemble(
          elementConfig,
          promptData,
          this.#placeholderResolver,
          promptElementsMap
        );
      } catch (err) {
        this.#logger.error(
          `PromptBuilder.build: Error assembling '${key}'. Skipping.`,
          { error: err }
        );
      }
    }

    this.#logger.debug(
      `PromptBuilder.build: Finished assembling prompt (length ${finalPromptString.length}).`
    );
    return finalPromptString;
  }
}
