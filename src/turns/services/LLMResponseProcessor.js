// src/turns/services/LLMResponseProcessor.js
// -----------------------------------------------------------------------------
// Parses, validates, and transforms LLM JSON responses into ProcessedTurnAction.
// Uses the consolidated “v3” schema (including `notes`) instead of v1/v2.
// -----------------------------------------------------------------------------

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction}   ITurnAction_Imported */
/** @typedef {import('../../interfaces/coreServices.js').ILogger}           ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator}  ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IEntityManager}     IEntityManager */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */
/** @typedef {import('../../utils/llmUtils.js').JsonProcessingError}        JsonProcessingError */

import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { parseAndRepairJson } from '../../utils/llmUtils.js';
import { persistThoughts } from '../../ai/thoughtPersistenceHook.js';
import { LLM_TURN_ACTION_RESPONSE_SCHEMA_ID } from '../schemas/llmOutputSchemas.js';
import { NOTES_COMPONENT_ID } from '../../constants/componentIds.js';

const BASE_FALLBACK_WAIT_ACTION = {
  actionDefinitionId: 'core:wait',
  commandString: 'wait',
  speech: '',
};

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

/* ──────────────────────────  HELPER FUNCTION  ───────────────────────── */

/**
 * Normalize note text for duplicate detection.
 * • trim → lowercase → strip punctuation → collapse internal whitespace
 *
 * @param {string} text - original note text
 * @returns {string} normalized text
 */
function normalizeNoteText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]|/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Concrete implementation of {@link ILLMResponseProcessor}.
 */
export class LLMResponseProcessor extends ILLMResponseProcessor {
  /** @type {ISchemaValidator} */
  #schemaValidator;
  /** @type {IEntityManager}  */
  #entityManager;

  /**
   * Constructs a new LLMResponseProcessor.
   *
   * @param {{ schemaValidator: ISchemaValidator, entityManager?: IEntityManager }} deps - dependencies object
   *   @param {ISchemaValidator} deps.schemaValidator - validator for LLM response schemas
   *   @param {IEntityManager} [deps.entityManager] - optional entity manager for persisting changes
   */
  constructor({ schemaValidator, entityManager = null }) {
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
    this.#entityManager = entityManager;

    // Unit tests may spy on this warning:
    if (
      !this.#schemaValidator.isSchemaLoaded(LLM_TURN_ACTION_RESPONSE_SCHEMA_ID)
    ) {
      console.warn(
        `LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_RESPONSE_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail.`
      );
    }
  }

  /**
   * Creates a safe fallback action and logs the failure.
   *
   * @private
   * @param {string} errorContext - type of error encountered
   * @param {string} actorId - ID of the actor being processed
   * @param {ILogger} logger - logger instance
   * @param {object|null} [errorDetailsInput] - additional error details
   * @returns {ProcessedTurnAction} fallback action object
   */
  _createProcessingFallbackAction(
    errorContext,
    actorId,
    logger,
    errorDetailsInput = null
  ) {
    const loggableErrorReason = `AI LLM Processing Error for ${actorId}: ${errorContext}.`;

    /** @type {LlmProcessingFailureInfo} */
    const failureInfo = { errorContext };
    let problematicOutputDetailsForLog = errorDetailsInput;

    const rawLlmResponse =
      typeof errorDetailsInput === 'object' && errorDetailsInput !== null
        ? errorDetailsInput.rawLlmResponse
        : undefined;
    const cleanedLlmResponse =
      typeof errorDetailsInput === 'object' && errorDetailsInput !== null
        ? errorDetailsInput.cleanedLlmResponse
        : undefined;
    const parsedJsonAttempt =
      typeof errorDetailsInput === 'object' && errorDetailsInput !== null
        ? errorDetailsInput.parsedJsonAttempt
        : undefined;
    const validationErrors =
      typeof errorDetailsInput === 'object' && errorDetailsInput !== null
        ? errorDetailsInput.validationErrors
        : undefined;
    const parseErrorStage =
      typeof errorDetailsInput === 'object' && errorDetailsInput !== null
        ? errorDetailsInput.parseErrorStage
        : undefined;

    if (
      errorContext === 'json_parse_error' ||
      errorContext === 'invalid_input_type'
    ) {
      failureInfo.rawResponse = rawLlmResponse;

      if (cleanedLlmResponse !== undefined) {
        failureInfo.cleanedResponse = cleanedLlmResponse;
        problematicOutputDetailsForLog = cleanedLlmResponse;
      } else {
        problematicOutputDetailsForLog = failureInfo.rawResponse;
      }

      if (parseErrorStage) {
        failureInfo.parseErrorStage = parseErrorStage;
      }
    } else if (errorContext === 'json_schema_validation_error') {
      if (rawLlmResponse !== undefined)
        failureInfo.rawResponse = rawLlmResponse;
      if (cleanedLlmResponse !== undefined)
        failureInfo.cleanedResponse = cleanedLlmResponse;
      if (parsedJsonAttempt !== undefined)
        failureInfo.parsedResponse = parsedJsonAttempt;
      if (validationErrors !== undefined)
        failureInfo.validationErrors = validationErrors;

      problematicOutputDetailsForLog = parsedJsonAttempt;
    } else if (errorContext === 'schema_validator_unavailable') {
      if (rawLlmResponse !== undefined)
        failureInfo.rawResponse = rawLlmResponse;
      if (cleanedLlmResponse !== undefined)
        failureInfo.cleanedResponse = cleanedLlmResponse;
      if (parsedJsonAttempt !== undefined)
        failureInfo.parsedResponse = parsedJsonAttempt;

      problematicOutputDetailsForLog = parsedJsonAttempt;
    }

    const fallbackAction = {
      ...BASE_FALLBACK_WAIT_ACTION,
      llmProcessingFailureInfo: failureInfo,
    };

    logger.error(
      `LLMResponseProcessor: ${loggableErrorReason} Creating fallback action.`,
      {
        actorId,
        errorContext,
        problematicOutputDetails: problematicOutputDetailsForLog,
        llmFailureInfo: failureInfo,
        fallbackActionTaken: fallbackAction,
      }
    );

    return fallbackAction;
  }

  /**
   * Post-processes notes returned by the LLM and merges them into the
   * actor’s `core:notes` component with de-duplication and validation.
   *
   * @private
   * @async
   * @param {*} notesArray - raw notes array from LLM; expected to be an array
   * @param {object} actorEntity - actor entity instance to merge notes into
   * @param {ILogger} logger - logger instance for logging errors/info
   * @returns {Promise<void>}
   */
  async _mergeNotesIntoEntity(notesArray, actorEntity, logger) {
    if (notesArray === undefined) {
      return;
    }

    if (!Array.isArray(notesArray)) {
      logger.error("'notes' field is not an array; skipping merge");
      return;
    }

    // Create or retrieve existing notes component
    let notesComp = actorEntity.components?.[NOTES_COMPONENT_ID];
    if (!notesComp) {
      // Create via the canonical pathway so that schema validation fires
      this.#entityManager?.addComponent?.(actorEntity.id, NOTES_COMPONENT_ID, {
        notes: [],
      });
      notesComp = actorEntity.components[NOTES_COMPONENT_ID];
    }

    if (!Array.isArray(notesComp.notes)) {
      logger.error(
        `Actor ${actorEntity.id} 'core:notes' component missing 'notes' array`
      );
      return;
    }

    const existingSet = new Set(
      notesComp.notes
        .filter((n) => typeof n.text === 'string')
        .map((n) => normalizeNoteText(n.text))
    );

    for (const noteObj of notesArray) {
      if (
        typeof noteObj?.text !== 'string' ||
        noteObj.text.trim() === '' ||
        typeof noteObj?.timestamp !== 'string' ||
        Number.isNaN(Date.parse(noteObj.timestamp))
      ) {
        logger.error(`Invalid note skipped: ${JSON.stringify(noteObj)}`);
        continue;
      }

      const normalisedIncoming = normalizeNoteText(noteObj.text);
      if (existingSet.has(normalisedIncoming)) {
        continue;
      }

      notesComp.notes.push({
        text: noteObj.text,
        timestamp: noteObj.timestamp,
      });
      logger.info(
        `[${new Date().toISOString()}] Added note: "${noteObj.text}" at ${noteObj.timestamp}`
      );
      existingSet.add(normalisedIncoming);
    }

    // Persist the updated actorEntity to storage
    if (typeof this.#entityManager?.saveEntity === 'function') {
      await this.#entityManager.saveEntity(actorEntity);
    }
  }

  /**
   * Parses (with repair), validates, and transforms the LLM’s JSON response
   * string into a safe {@link ProcessedTurnAction}.
   *
   * @param {string} llmJsonResponse - raw JSON response string from LLM
   * @param {string} actorId - ID of the actor for which to process the response
   * @param {ILogger} logger - logger instance for logging processing steps
   * @returns {Promise<ProcessedTurnAction>} promise resolving to the final action
   */
  async processResponse(llmJsonResponse, actorId, logger) {
    let parsedJson;
    const originalInput = llmJsonResponse;

    // 1. Parse & repair
    try {
      parsedJson = await parseAndRepairJson(llmJsonResponse, logger);
    } catch (e) {
      const ctx =
        e.name === 'TypeError' ? 'invalid_input_type' : 'json_parse_error';

      const baseMsg =
        ctx === 'invalid_input_type'
          ? 'Invalid input type for LLM JSON response'
          : 'Failed to parse/repair LLM JSON response';

      logger.error(
        `LLMResponseProcessor: ${baseMsg} for actor ${actorId}. Error: ${e.message}.`,
        {
          rawResponse: originalInput,
          actorId,
          errorName: e.name,
          errorMessage: e.message,
        }
      );

      return this._createProcessingFallbackAction(ctx, actorId, logger, {
        rawLlmResponse: originalInput,
      });
    }

    // ─────── Re‐insert “ignore goals” logic ───────
    if (
      parsedJson &&
      Object.prototype.hasOwnProperty.call(parsedJson, 'goals')
    ) {
      logger.warn('LLM attempted to return goals; ignoring.');
      // Do NOT merge or persist any goals. Intentionally skip.
    }
    // ──────────────────────────────────────────────

    // 2. Validate against v3 schema (consolidated)
    const validationResult = this.#schemaValidator.validate(
      LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
      parsedJson
    );

    if (validationResult.isValid) {
      // Persist STM if we can resolve the entity
      const actorEntity = this.#entityManager?.getEntityInstance?.(actorId);

      if (actorEntity) {
        try {
          persistThoughts(parsedJson, actorEntity, logger);

          if ('notes' in parsedJson) {
            await this._mergeNotesIntoEntity(
              parsedJson.notes,
              actorEntity,
              logger
            );
          }
        } catch (e) {
          logger.warn('STM persist failed', { actorId, err: e });
        }
      }

      const { actionDefinitionId, commandString, speech } = parsedJson;
      const finalAction = {
        actionDefinitionId: actionDefinitionId.trim(),
        commandString: commandString.trim(),
        speech,
      };

      logger.info(
        `LLMResponseProcessor: Successfully validated and transformed LLM output for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`
      );
      logger.debug(
        `LLMResponseProcessor: Transformed ProcessedTurnAction details for ${actorId}:`,
        { actorId, action: finalAction }
      );

      return finalAction;
    }

    // 3. Schema validation failed → fallback
    logger.error(
      `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`,
      { validationErrors: validationResult.errors, parsedJson, actorId }
    );

    return this._createProcessingFallbackAction(
      'json_schema_validation_error',
      actorId,
      logger,
      {
        rawLlmResponse: originalInput,
        parsedJsonAttempt: parsedJson,
        validationErrors: validationResult.errors,
      }
    );
  }
}
