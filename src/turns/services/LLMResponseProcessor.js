// --- FILE START: src/turns/services/LLMResponseProcessor.js ---

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction}   ITurnAction_Imported */
/** @typedef {import('../../interfaces/coreServices.js').ILogger}           ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator}  ISchemaValidator */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */
/** @typedef {import('../../utils/llmUtils.js').JsonProcessingError}        JsonProcessingError */

import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { parseAndRepairJson } from '../../utils/llmUtils.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../schemas/llmOutputSchemas.js';

/**
 * @typedef {object} LlmProcessingResult
 * @property {boolean} success - Indicates if processing was successful.
 * @property {ProcessedTurnAction} action - The final, usable action. If success is false, this will be a fallback action.
 * @property {object} [extractedData] - Raw data extracted from the LLM response for side-effects. Only present if success is true.
 * @property {string} [extractedData.thoughts] - The 'thoughts' string, if present.
 * @property {Array<string>} [extractedData.notes] - The 'notes' array, if present.
 */

/**
 * @typedef {object} LlmProcessingFailureInfo
 * @property {string} errorContext - short identifier of the error type
 * @property {string} [rawResponse] - raw LLM response string, if available
 * @property {string} [cleanedResponse] - cleaned JSON string before parsing
 * @property {object} [parsedResponse] - parsed JSON object attempt
 * @property {Array<object>} [validationErrors] - validation errors from schema
 * @property {string} [parseErrorStage] - stage at which parse error occurred
 */

/**
 * @typedef {object} ProcessedTurnAction
 * @property {string} actionDefinitionId - system identifier for the chosen action
 * @property {string} commandString - command string for the game parser
 * @property {string} speech - character’s spoken words
 * @property {LlmProcessingFailureInfo} [llmProcessingFailureInfo] - detailed failure info if processing failed
 * @property {object} [resolvedParameters] - any parameters resolved during processing
 */

/**
 * Thrown by LLMResponseProcessor when LLM output fails parsing or validation.
 * Contains detailed diagnostic information.
 */
class LLMProcessingError extends Error {
  /**
   * Error type thrown when LLM output cannot be parsed or validated.
   *
   * @param {string} message - The error message.
   * @param {object} details - The diagnostic details.
   */
  constructor(message, details) {
    super(message);
    this.name = 'LLMProcessingError';
    this.details = details;
  }
}

/**
 * Concrete implementation of {@link ILLMResponseProcessor}.
 */
export class LLMResponseProcessor extends ILLMResponseProcessor {
  /** @type {ISchemaValidator} */
  #schemaValidator;

  /**
   * Constructs a new LLMResponseProcessor.
   *
   * @param {{ schemaValidator: ISchemaValidator }} deps - dependencies object
   * @param {ISchemaValidator} deps.schemaValidator - validator for LLM response schemas
   */
  constructor({ schemaValidator }) {
    super();

    if (
      !schemaValidator ||
      typeof schemaValidator.validate !== 'function' ||
      typeof schemaValidator.isSchemaLoaded !== 'function'
    ) {
      throw new Error(
        "LLMResponseProcessor: Constructor requires a valid ISchemaValidator instance with 'validate' and 'isSchemaLoaded' methods."
      );
    }

    this.#schemaValidator = schemaValidator;

    // Unit tests may spy on this warning:
    if (
      !this.#schemaValidator.isSchemaLoaded(LLM_TURN_ACTION_RESPONSE_SCHEMA_ID)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        `LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_RESPONSE_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail.`
      );
    }
  }

  /**
   * Parses (with repair), validates, and transforms the LLM’s JSON response
   * string into a safe {@link ProcessedTurnAction}. Throws on failure.
   *
   * @override
   * @param {string} llmJsonResponse - raw JSON response string from LLM
   * @param {string} actorId - ID of the actor for which to process the response
   * @param {ILogger} logger - logger instance for logging processing steps
   * @returns {Promise<{action: ProcessedTurnAction, extractedData: object}>} promise resolving to the final result object
   * @throws {LLMProcessingError} if parsing, validation, or transformation fails.
   */
  async processResponse(llmJsonResponse, actorId, logger) {
    let parsedJson;
    const originalInput = llmJsonResponse;

    // 1. Parse & repair
    try {
      parsedJson = await parseAndRepairJson(llmJsonResponse, logger);
    } catch (e) {
      const errorContext =
        e.name === 'TypeError' ? 'invalid_input_type' : 'json_parse_error';
      const message =
        errorContext === 'invalid_input_type'
          ? 'Invalid input type for LLM JSON response'
          : 'Failed to parse/repair LLM JSON response';
      logger.error(
        `LLMResponseProcessor: ${message} for actor ${actorId}. Error: ${e.message}.`,
        { rawResponse: originalInput, actorId, errorName: e.name }
      );
      throw new LLMProcessingError(message, {
        errorContext,
        rawLlmResponse: originalInput,
      });
    }

    if (
      parsedJson &&
      Object.prototype.hasOwnProperty.call(parsedJson, 'goals')
    ) {
      logger.warn(
        `LLMResponseProcessor: LLM for actor ${actorId} attempted to return goals; ignoring.`
      );
      // Do NOT merge or persist any goals. Intentionally skip.
    }

    // 2. Validate against v3 schema (consolidated)
    const validationResult = this.#schemaValidator.validate(
      LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
      parsedJson
    );

    if (validationResult.isValid) {
      const { actionDefinitionId, commandString, speech, thoughts, notes } =
        parsedJson;
      const finalAction = {
        actionDefinitionId: actionDefinitionId.trim(),
        commandString: commandString.trim(),
        speech,
      };

      logger.debug(
        `LLMResponseProcessor: Successfully validated and transformed LLM output for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`
      );
      logger.debug(
        `LLMResponseProcessor: Transformed ProcessedTurnAction details for ${actorId}:`,
        { actorId, action: finalAction, extractedData: { thoughts, notes } }
      );

      return {
        success: true,
        action: finalAction,
        extractedData: { thoughts, notes },
      };
    }

    // 3. Schema validation failed → throw detailed error
    const validationErrorMsg = `LLM response JSON schema validation failed for actor ${actorId}.`;
    logger.error(`LLMResponseProcessor: ${validationErrorMsg}`, {
      validationErrors: validationResult.errors,
      parsedJson,
      actorId,
    });

    throw new LLMProcessingError(validationErrorMsg, {
      errorContext: 'json_schema_validation_error',
      rawLlmResponse: originalInput,
      parsedJsonAttempt: parsedJson,
      validationErrors: validationResult.errors,
    });
  }
}
