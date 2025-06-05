// -----------------------------------------------------------------------------
// Parses, validates, and transforms LLM JSON responses into ProcessedTurnAction.
// -----------------------------------------------------------------------------

/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction}   ITurnAction_Imported */
/** @typedef {import('../../interfaces/coreServices.js').ILogger}           ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator}  ISchemaValidator */
/** @typedef {import('../interfaces/ILLMResponseProcessor.js').ILLMResponseProcessor} ILLMResponseProcessor_Interface_Typedef */
/** @typedef {import('../../utils/llmUtils.js').JsonProcessingError}        JsonProcessingError */

import { ILLMResponseProcessor } from '../interfaces/ILLMResponseProcessor.js';
import { parseAndRepairJson } from '../../utils/llmUtils.js';
import { persistThoughts } from '../../ai/thoughtPersistenceHook.js';
import {
  LLM_TURN_ACTION_SCHEMA_ID,
  LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID,
} from '../schemas/llmOutputSchemas.js';
import { NOTES_COMPONENT_ID } from '../../constants/componentIds.js'; // ← **added**

// ─────────────────────────────────────────────────────────────────────────────

const BASE_FALLBACK_WAIT_ACTION = {
  actionDefinitionId: 'core:wait',
  commandString: 'wait',
  speech: '',
};

/**
 * @typedef {object} LlmProcessingFailureInfo
 * @property {string} errorContext
 * @property {string} [rawResponse]
 * @property {string} [cleanedResponse]
 * @property {object} [parsedResponse]
 * @property {Array<object>} [validationErrors]
 * @property {string} [parseErrorStage]
 */

/**
 * @typedef {object} ProcessedTurnAction
 * @property {string} actionDefinitionId
 * @property {string} commandString
 * @property {string} speech
 * @property {LlmProcessingFailureInfo} [llmProcessingFailureInfo]
 * @property {object} [resolvedParameters]
 */

/* ──────────────────────────  HELPER FUNCTION  ───────────────────────── */
/**
 * Normalise note text for duplicate detection.
 *  • trim → lowercase → strip punctuation → collapse internal whitespace
 * @param {string} text
 * @returns {string}
 */
function normalizeNoteText(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]|/g, '') // strip punctuation
    .replace(/\s+/g, ' '); // collapse spaces
}

/**
 * Concrete implementation of {@link ILLMResponseProcessor}.
 */
export class LLMResponseProcessor extends ILLMResponseProcessor {
  /** @type {ISchemaValidator} */
  #schemaValidator;
  /** @type {IEntityManager}  */ // <- optional, see below
  #entityManager;

  /**
   * @param {{schemaValidator: ISchemaValidator}} deps
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
    this.#entityManager = entityManager; // may be null in tests

    // Unit tests spy on this warning:
    if (!this.#schemaValidator.isSchemaLoaded(LLM_TURN_ACTION_SCHEMA_ID)) {
      console.warn(
        `LLMResponseProcessor: Schema with ID '${LLM_TURN_ACTION_SCHEMA_ID}' is not loaded in the provided schema validator. Validation will fail if this schema is required.`
      );
    }
  }

  /**
   * Creates a safe fallback action and logs the failure.
   *
   * @private
   * @param {string} errorContext
   * @param {string} actorId
   * @param {ILogger} logger
   * @param {object|null} [errorDetailsInput]
   * @returns {ProcessedTurnAction}
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
      // ────── CHANGE BELOW: keep undefined instead of coalescing to null ──────
      failureInfo.rawResponse = rawLlmResponse;
      // ───────────────────────────────────────────────────────────────────────

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
   * @param {*} notesArray           – Raw value from the LLM payload.
   * @param {object} actorEntity     – The actor entity instance.
   * @param {ILogger} logger         – Logger instance.
   * @returns {void}
   */
  _mergeNotesIntoEntity(notesArray, actorEntity, logger) {
    /* ---------- guard: input must be an array ---------- */
    if (!Array.isArray(notesArray)) {
      logger.error("'notes' field is not an array; skipping merge");
      return;
    }

    /* ---------- ensure component exists ---------- */
    let notesComp = actorEntity.components?.[NOTES_COMPONENT_ID];
    if (!notesComp) {
      // create component via the canonical pathway so that schema validation fires
      this.#entityManager?.addComponent?.(actorEntity.id, NOTES_COMPONENT_ID, {
        notes: [],
      });
      notesComp = actorEntity.components[NOTES_COMPONENT_ID];
    }

    if (!Array.isArray(notesComp.notes)) {
      // hard-fail if someone corrupted the component
      logger.error(
        `Actor ${actorEntity.id} 'core:notes' component missing 'notes' array`
      );
      return;
    }

    /* ---------- build normalised set from existing ---------- */
    const existingSet = new Set(
      notesComp.notes
        .filter((n) => typeof n.text === 'string')
        .map((n) => normalizeNoteText(n.text))
    );

    /* ---------- iterate incoming array ---------- */
    for (const noteObj of notesArray) {
      // shape & type validation
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
        // duplicate – silently skip
        continue;
      }

      // append new note
      notesComp.notes.push({
        text: noteObj.text,
        timestamp: noteObj.timestamp,
      });
      logger.info(
        `[${new Date().toISOString()}] Added note: "${noteObj.text}" at ${noteObj.timestamp}`
      );
      existingSet.add(normalisedIncoming);
    }
  }

  /**
   * Parses (with repair), validates, and transforms the LLM’s JSON response
   * string into a safe {@link ProcessedTurnAction}.
   *
   * @param {string} llmJsonResponse
   * @param {string} actorId
   * @param {ILogger} logger
   * @returns {Promise<ProcessedTurnAction>}
   */
  async processResponse(llmJsonResponse, actorId, logger) {
    let parsedJson;
    const originalInput = llmJsonResponse;

    /* ---------- 1. Parse & repair ------------------------------------------------ */
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

    /* ---------- 2. Validate against v1 schema ----------------------------------- */
    const v1Result = this.#schemaValidator.validate(
      LLM_TURN_ACTION_SCHEMA_ID,
      parsedJson
    );

    if (v1Result.isValid) {
      // ──────────────────────────────────────────────────────────────────
      // Persist STM if we can resolve the entity
      // ──────────────────────────────────────────────────────────────────
      const actorEntity = this.#entityManager?.getEntityInstance?.(actorId);

      if (actorEntity) {
        try {
          persistThoughts(parsedJson, actorEntity, logger);

          // NEW: merge any notes returned by the LLM
          if (parsedJson.notes !== undefined) {
            this._mergeNotesIntoEntity(parsedJson.notes, actorEntity, logger);
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

    /* ---------- 3. Optionally validate against v2 schema ------------------------ */
    let v2Result = { isValid: false, errors: [] };

    if (
      parsedJson &&
      typeof parsedJson === 'object' &&
      !Array.isArray(parsedJson) &&
      'thoughts' in parsedJson
    ) {
      v2Result = this.#schemaValidator.validate(
        LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID,
        parsedJson
      );

      if (v2Result.isValid) {
        const actorEntity = this.#entityManager?.getEntityInstance?.(actorId);

        if (actorEntity) {
          try {
            persistThoughts(parsedJson, actorEntity, logger);

            if (parsedJson.notes !== undefined) {
              this._mergeNotesIntoEntity(parsedJson.notes, actorEntity, logger);
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
          `LLMResponseProcessor: Successfully validated and transformed LLM output (v2) for actor ${actorId}. Action: ${finalAction.actionDefinitionId}`
        );
        logger.debug(
          `LLMResponseProcessor: Transformed ProcessedTurnAction details for ${actorId}:`,
          { actorId, action: finalAction }
        );

        return finalAction;
      }
    }

    /* ---------- 4. All schema validations failed – fallback -------------------- */
    const validationErrors =
      v1Result.errors && v1Result.errors.length > 0
        ? v1Result.errors
        : v2Result.errors;

    logger.error(
      `LLMResponseProcessor: LLM response JSON schema validation failed for actor ${actorId}. Errors:`,
      { validationErrors, parsedJson, actorId }
    );

    return this._createProcessingFallbackAction(
      'json_schema_validation_error',
      actorId,
      logger,
      {
        rawLlmResponse: originalInput,
        parsedJsonAttempt: parsedJson,
        validationErrors,
      }
    );
  }
}
