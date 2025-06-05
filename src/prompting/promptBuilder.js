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
 *
 * @typedef {object} PromptElementCondition
 * @property {string} promptDataFlag - The name of the flag in promptData that this condition checks.
 * @property {any} [expectedValue] - Optional specific value that promptData[promptDataFlag] must equal for the condition to pass.
 *
 * @typedef {object} PromptElement
 * @property {string} key - The unique identifier for this prompt element in the configuration.
 * @property {string} [prefix] - Optional string to prepend before the element content.
 * @property {string} [suffix] - Optional string to append after the element content.
 * @property {PromptElementCondition} [condition] - Condition object that determines whether to include this element.
 *
 * @typedef {object} PerceptionLogEntry
 * @property {string} content - The textual content of the perception log entry.
 * @property {string} [role] - The role associated with this log entry (e.g., 'user', 'system').
 * @property {string} [timestamp] - ISO timestamp indicating when this perception log entry was recorded.
 *
 * @typedef {object} PromptData
 * @property {Array<PerceptionLogEntry>} [perceptionLogArray] - Array of perception log entries to include in the prompt.
 * @property {string[]} [thoughtsArray] - Array of thought strings to include in the prompt.
 * @property {Array<{ text: string; timestamp: string }>} [notesArray] - Array of note objects, each with 'text' and 'timestamp'.
 * @property {Array<{ text: string; timestamp: string }>} [goalsArray] - Array of goal objects, each with 'text' and 'timestamp'.
 * @property {boolean} [someConditionFlag] - Boolean flag that can be used to conditionally include elements.
 * @property {string} [characterSheetContent] - The character sheet content to insert into the prompt.
 * @property {boolean} [enableReasoning] - Boolean flag to indicate whether to include the reasoning section.
 */

import { IPromptBuilder } from '../interfaces/IPromptBuilder.js';
import { StandardElementAssembler } from './assembling/standardElementAssembler.js';
import { PerceptionLogAssembler } from './assembling/perceptionLogAssembler.js';
import { ThoughtsSectionAssembler } from './assembling/thoughtsSectionAssembler.js';
import { NotesSectionAssembler } from './assembling/notesSectionAssembler.js';
import { GoalsSectionAssembler } from './assembling/goalsSectionAssembler.js';

// Special keys
const PERCEPTION_LOG_WRAPPER_KEY = 'perception_log_wrapper';
const THOUGHTS_WRAPPER_KEY = 'thoughts_wrapper';
const NOTES_WRAPPER_KEY = 'notes_wrapper';
const GOALS_WRAPPER_KEY = 'goals_wrapper';

export class PromptBuilder extends IPromptBuilder {
  #logger;
  #llmConfigService;
  #placeholderResolver;
  #standardElementAssembler;
  #perceptionLogAssembler;
  #thoughtsSectionAssembler;
  #notesSectionAssembler;
  #goalsSectionAssembler;

  /**
   * @param {object} dependencies - An object containing all required dependencies.
   * @param {ILogger} [dependencies.logger] - Optional logger; defaults to console if not provided.
   * @param {LLMConfigService} dependencies.llmConfigService - Service providing LLM configurations for building prompts.
   * @param {PlaceholderResolver} dependencies.placeholderResolver - Utility to resolve placeholders in prompt templates.
   * @param {StandardElementAssembler} dependencies.standardElementAssembler - Assembler for standard prompt elements.
   * @param {PerceptionLogAssembler} dependencies.perceptionLogAssembler - Assembler for perception log sections.
   * @param {ThoughtsSectionAssembler} dependencies.thoughtsSectionAssembler - Assembler for thoughts section (defaults if omitted).
   * @param {NotesSectionAssembler} dependencies.notesSectionAssembler - Assembler for notes section.
   * @param {GoalsSectionAssembler} dependencies.goalsSectionAssembler - Assembler for goals section (defaults if omitted).
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

    if (!goalsSectionAssembler) {
      this.#logger.warn(
        'PromptBuilder: GoalsSectionAssembler not provided; instantiating default.'
      );
      this.#goalsSectionAssembler = new GoalsSectionAssembler({
        logger: this.#logger,
      });
    } else {
      this.#goalsSectionAssembler = goalsSectionAssembler;
    }

    this.#logger.info(
      'PromptBuilder initialized with LLMConfigService, PlaceholderResolver, and Assemblers (standard, perception‐log, thoughts, notes, goals).'
    );
  }

  /**
   * @private
   * @description Checks if a prompt element's condition is satisfied based on the provided promptData.
   * @param {PromptElementCondition | undefined} condition - The condition object defining which flag to check and its expected value.
   * @param {PromptData} promptData - The data object containing flags and arrays used to build the prompt.
   * @returns {boolean} True if the condition is met (or if no condition is provided); false otherwise.
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
   * @description Builds the final prompt string for a given LLM ID and prompt data by assembling configured elements.
   * @param {string} llmId - Identifier of the LLM configuration to use for building the prompt.
   * @param {PromptData} promptData - Data object containing information to populate prompt elements.
   * @returns {Promise<string>} A promise resolving to the assembled prompt string.
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
      } else if (key === GOALS_WRAPPER_KEY) {
        assemblerToUse = this.#goalsSectionAssembler;
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
