/* eslint-env es2022 */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { parseAndRepairJson } from '../../utils/llmUtils.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../schemas/llmOutputSchemas.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Custom error for LLM response processing failures.
 */
export class LLMProcessingError extends Error {
  /**
   * @param {string} message
   * @param {object} [details]
   */
  constructor(message, details) {
    super(message);
    this.name = 'LLMProcessingError';
    if (details) this.details = details;
  }
}

/**
 * @implements {ILLMResponseProcessor}
 */
export class LLMResponseProcessor extends ILLMResponseProcessor {
  /** @type {ISchemaValidator} */
  #schemaValidator;
  /** @type {ILogger} */
  #logger;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #safeEventDispatcher;

  /**
   * @param {{ schemaValidator: ISchemaValidator, logger: ILogger, safeEventDispatcher: import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher }} options
   */
  constructor({ schemaValidator, logger, safeEventDispatcher }) {
    super();
    if (
      !schemaValidator ||
      typeof schemaValidator.validate !== 'function' ||
      typeof schemaValidator.isSchemaLoaded !== 'function'
    ) {
      throw new Error('LLMResponseProcessor needs a valid ISchemaValidator');
    }
    if (!logger) {
      throw new Error('LLMResponseProcessor needs a valid ILogger');
    }
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'LLMResponseProcessor requires a valid ISafeEventDispatcher'
      );
    }

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
    this.#safeEventDispatcher = safeEventDispatcher;

    // Ensure the required schema is loaded
    if (
      !this.#schemaValidator.isSchemaLoaded(LLM_TURN_ACTION_RESPONSE_SCHEMA_ID)
    ) {
      throw new Error(
        `Schema ${LLM_TURN_ACTION_RESPONSE_SCHEMA_ID} not loaded`
      );
    }
  }

  /**
   * @description Parse and repair the raw JSON from the LLM.
   * @param {string} llmJsonResponse - Raw JSON string from the LLM.
   * @param {string} actorId - ID of the actor for logging context.
   * @returns {Promise<object>} Parsed JSON object.
   * @throws {LLMProcessingError} If the response is not a string or cannot be parsed.
   */
  async #parseResponse(llmJsonResponse, actorId) {
    if (typeof llmJsonResponse !== 'string') {
      throw new LLMProcessingError(
        `LLM response must be a JSON string for actor ${actorId}.`
      );
    }

    try {
      return await parseAndRepairJson(llmJsonResponse, this.#logger);
    } catch (err) {
      const errorMsg = `LLMResponseProcessor: JSON could not be parsed for actor ${actorId}: ${err.message}`;
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
   * @description Validate the parsed JSON against the turn action schema.
   * @param {object} parsed - Parsed JSON object.
   * @param {string} actorId - ID of the actor for logging context.
   * @throws {LLMProcessingError} When schema validation fails.
   * @returns {void}
   */
  #validateSchema(parsed, actorId) {
    const validationResult = this.#schemaValidator.validate(
      LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
      parsed
    );
    const { isValid, errors } = validationResult;
    if (!isValid) {
      const errorMsg = `LLMResponseProcessor: schema invalid for actor ${actorId}`;
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
        `LLM response JSON schema validation failed for actor ${actorId}.`,
        { validationErrors: errors }
      );
    }
  }

  /**
   * @description Extract the actionable data from the validated JSON.
   * @param {object} parsed - Validated JSON object from the LLM.
   * @param {string} actorId - ID of the actor for logging context.
   * @returns {{ action: { chosenIndex: number; speech: string }; extractedData: { thoughts: string; notes?: string[] } }}
   */
  #extractData(parsed, actorId) {
    const { chosenIndex, speech, thoughts, notes } = parsed;
    this.#logger.debug(
      `LLMResponseProcessor: Validated LLM output for actor ${actorId}. Chosen ID: ${chosenIndex}`
    );
    return {
      action: { chosenIndex, speech },
      extractedData: {
        thoughts,
        ...(notes !== undefined ? { notes } : {}),
      },
    };
  }

  /**
   * Process a raw LLM JSON response into structured action data.
   *
   * @param {string} llmJsonResponse
   * @param {string} actorId
   * @returns {Promise<{ success: boolean; action: { chosenIndex: number; speech: string }; extractedData: { thoughts: string; notes?: string[] } }>}
   */
  async processResponse(llmJsonResponse, actorId) {
    const parsed = await this.#parseResponse(llmJsonResponse, actorId);
    this.#validateSchema(parsed, actorId);
    const { action, extractedData } = this.#extractData(parsed, actorId);
    return { success: true, action, extractedData };
  }
}
