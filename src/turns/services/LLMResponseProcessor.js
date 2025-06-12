/* eslint-env es2022 */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { parseAndRepairJson } from '../../utils/llmUtils.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../schemas/llmOutputSchemas.js';

/**
 * Custom error for LLM response processing failures.
 */
class LLMProcessingError extends Error {
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

  /**
   * @param {{ schemaValidator: ISchemaValidator, logger: ILogger }} options
   */
  constructor({ schemaValidator, logger }) {
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

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;

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
   * Process a raw LLM JSON response into structured action data.
   *
   * @param {string} llmJsonResponse
   * @param {string} actorId
   * @returns {Promise<{ success: boolean; action: { chosenIndex: number; speech: string }; extractedData: { thoughts: string; notes?: string[] } }>}
   */
  async processResponse(llmJsonResponse, actorId) {
    // Ensure input is a string
    if (typeof llmJsonResponse !== 'string') {
      throw new LLMProcessingError(
        `LLM response must be a JSON string for actor ${actorId}.`
      );
    }

    // Clean + parse (with repair)
    let parsed;
    try {
      parsed = await parseAndRepairJson(llmJsonResponse, this.#logger);
    } catch (err) {
      this.#logger.error(
        `LLMResponseProcessor: JSON could not be parsed for actor ${actorId}: ${err.message}`,
        { rawResponse: llmJsonResponse }
      );
      throw new LLMProcessingError(
        `LLMResponseProcessor: JSON could not be parsed for actor ${actorId}: ${err.message}`
      );
    }

    // Schema-validate
    const validationResult = this.#schemaValidator.validate(
      LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
      parsed
    );
    const { isValid, errors } = validationResult;
    if (!isValid) {
      this.#logger.error(
        `LLMResponseProcessor: schema invalid for actor ${actorId}`,
        { errors, parsed }
      );
      throw new LLMProcessingError(
        `LLM response JSON schema validation failed for actor ${actorId}.`,
        { validationErrors: errors }
      );
    }

    // Extract the required data
    const { chosenIndex, speech, thoughts, notes } = parsed;
    this.#logger.debug(
      `LLMResponseProcessor: Validated LLM output for actor ${actorId}. Chosen ID: ${chosenIndex}`
    );

    const finalAction = { chosenIndex, speech };
    return {
      success: true,
      action: finalAction,
      extractedData: {
        thoughts,
        ...(notes !== undefined ? { notes } : {}),
      },
    };
  }
}
