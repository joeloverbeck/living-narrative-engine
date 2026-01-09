/* eslint-env es2022 */
/**
 * @file Processes Phase 1 LLM responses (mood/sexual updates only)
 * @see LLMResponseProcessor.js for the action response processor
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

import { LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID } from '../schemas/llmOutputSchemas.js';
import { LLMProcessingError } from './LLMResponseProcessor.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Processes Phase 1 LLM responses containing only mood and sexual state updates.
 * Used in the two-phase emotional state update flow.
 */
export class MoodResponseProcessor {
  /** @type {ISchemaValidator} */
  #schemaValidator;
  /** @type {ILogger} */
  #logger;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #safeEventDispatcher;
  /** @type {import('../../llms/llmJsonService.js').LlmJsonService} */
  #llmJsonService;

  /**
   * @param {{
   *   schemaValidator: ISchemaValidator,
   *   logger: ILogger,
   *   safeEventDispatcher: import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher,
   *   llmJsonService: import('../../llms/llmJsonService.js').LlmJsonService,
   * }} options
   */
  constructor({ schemaValidator, logger, safeEventDispatcher, llmJsonService }) {
    if (
      !schemaValidator ||
      typeof schemaValidator.validate !== 'function' ||
      typeof schemaValidator.isSchemaLoaded !== 'function'
    ) {
      throw new Error('MoodResponseProcessor needs a valid ISchemaValidator');
    }
    if (!logger) {
      throw new Error('MoodResponseProcessor needs a valid ILogger');
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'MoodResponseProcessor requires a valid ISafeEventDispatcher'
      );
    }
    if (
      !llmJsonService ||
      typeof llmJsonService.parseAndRepair !== 'function'
    ) {
      throw new Error('MoodResponseProcessor requires a valid LlmJsonService');
    }

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#llmJsonService = llmJsonService;

    // Ensure the required schema is loaded
    if (
      !this.#schemaValidator.isSchemaLoaded(LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID)
    ) {
      throw new Error(
        `Schema ${LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID} not loaded`
      );
    }
  }

  /**
   * @description Parse and repair the raw JSON from the LLM.
   * @param {string} llmJsonResponse - Raw JSON string from the LLM.
   * @param {string} actorId - ID of the actor for logging context.
   * @returns {Promise<object>} Parsed JSON object.
   * @throws {LLMProcessingError} If the response cannot be parsed.
   */
  async #parseResponse(llmJsonResponse, actorId) {
    if (typeof llmJsonResponse !== 'string') {
      throw new LLMProcessingError(
        `Mood response must be a JSON string for actor ${actorId}.`
      );
    }

    try {
      return await this.#llmJsonService.parseAndRepair(llmJsonResponse, {
        logger: this.#logger,
      });
    } catch (err) {
      const errorMsg = `MoodResponseProcessor: JSON could not be parsed for actor ${actorId}: ${err.message}`;
      safeDispatchError(
        this.#safeEventDispatcher,
        errorMsg,
        {
          actorId,
          rawResponse: llmJsonResponse,
          error: err.message,
          stack: err.stack,
        },
        this.#logger
      );
      throw new LLMProcessingError(errorMsg);
    }
  }

  /**
   * @description Validate the parsed JSON against the mood update schema.
   * @param {object} parsed - Parsed JSON object.
   * @param {string} actorId - ID of the actor for logging context.
   * @throws {LLMProcessingError} When schema validation fails.
   * @returns {void}
   */
  #validateSchema(parsed, actorId) {
    const validationResult = this.#schemaValidator.validate(
      LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID,
      parsed
    );
    const { isValid, errors } = validationResult;
    if (!isValid) {
      const errorMsg = `MoodResponseProcessor: schema invalid for actor ${actorId}`;
      safeDispatchError(
        this.#safeEventDispatcher,
        errorMsg,
        {
          errors,
          parsed,
        },
        this.#logger
      );
      throw new LLMProcessingError(
        `Mood response JSON schema validation failed for actor ${actorId}.`,
        { validationErrors: errors }
      );
    }
  }

  /**
   * @description Extract mood and sexual update data from the validated JSON.
   * @param {object} parsed - Validated JSON object from the LLM.
   * @param {string} actorId - ID of the actor for logging context.
   * @returns {{ moodUpdate: object, sexualUpdate: object }}
   */
  #extractData(parsed, actorId) {
    const { moodUpdate, sexualUpdate } = parsed;

    this.#logger.debug(
      `MoodResponseProcessor: Validated mood response for actor ${actorId}`
    );

    // INFO-level logging for mood/sexual state extraction visibility
    this.#logger.info(
      `MoodResponseProcessor: moodUpdate extracted for actor ${actorId}`,
      {
        valence: moodUpdate.valence,
        arousal: moodUpdate.arousal,
        threat: moodUpdate.threat,
      }
    );

    this.#logger.info(
      `MoodResponseProcessor: sexualUpdate extracted for actor ${actorId}`,
      {
        sex_excitation: sexualUpdate.sex_excitation,
        sex_inhibition: sexualUpdate.sex_inhibition,
      }
    );

    return { moodUpdate, sexualUpdate };
  }

  /**
   * Process a Phase 1 LLM response containing mood/sexual updates.
   *
   * @param {string} llmJsonResponse - Raw JSON string from LLM
   * @param {string} actorId - Actor entity ID for logging
   * @returns {Promise<{ moodUpdate: { valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, self_evaluation: number }, sexualUpdate: { sex_excitation: number, sex_inhibition: number } }>}
   * @throws {LLMProcessingError} If parsing or validation fails
   */
  async processMoodResponse(llmJsonResponse, actorId) {
    this.#logger.debug(
      `MoodResponseProcessor: Processing mood response for actor ${actorId}`
    );

    const parsed = await this.#parseResponse(llmJsonResponse, actorId);
    this.#validateSchema(parsed, actorId);
    return this.#extractData(parsed, actorId);
  }
}
