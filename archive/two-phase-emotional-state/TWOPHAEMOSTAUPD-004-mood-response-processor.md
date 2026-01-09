# TWOPHAEMOSTAUPD-004: MoodResponseProcessor Service

## Status: ✅ COMPLETED

## Summary

Create a new processor service that parses and validates Phase 1 (mood-only) LLM responses against the mood update schema.

## Dependencies

- **Requires:** TWOPHAEMOSTAUPD-001 (schema tests) - ensures schemas are properly tested

## Assumption Corrections (discovered during implementation)

The following discrepancies were found between original ticket assumptions and actual codebase patterns:

1. **`parseAndRepair` signature**: Original showed `(response, actorId)` but actual interface is `(response, { logger })` - corrected in implementation
2. **Error handling**: Original used generic `Error`, corrected to use `LLMProcessingError` + `safeDispatchError()` pattern
3. **Schema loading check**: Added `isSchemaLoaded()` check in constructor (missing from original)
4. **SchemaValidator interface**: Now requires both `validate` AND `isSchemaLoaded` methods
5. **Error messages**: Corrected to match existing pattern `"MoodResponseProcessor needs a valid..."`

## Files to Touch

| File | Action |
|------|--------|
| `src/turns/services/MoodResponseProcessor.js` | CREATE |
| `src/dependencyInjection/tokens/tokens-ai.js` | MODIFY |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY |
| `tests/unit/turns/services/MoodResponseProcessor.test.js` | CREATE |

## Out of Scope

- **DO NOT** modify `LLMResponseProcessor` (existing action processor remains unchanged)
- **DO NOT** modify `LLMChooser`
- **DO NOT** create the orchestrator
- **DO NOT** modify persistence listeners
- **DO NOT** add fallback behavior (failures should throw)

## Implementation Details

### New File: `MoodResponseProcessor.js`

**Note:** The implementation below has been corrected from the original to match actual codebase patterns.

```javascript
/**
 * @file Processes Phase 1 LLM responses (mood/sexual updates only)
 */

import { LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID } from '../schemas/llmOutputSchemas.js';
import { LLMProcessingError } from './LLMResponseProcessor.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

export class MoodResponseProcessor {
  #schemaValidator;
  #logger;
  #safeEventDispatcher;
  #llmJsonService;

  constructor({ schemaValidator, logger, safeEventDispatcher, llmJsonService }) {
    // Validate all dependencies (corrected to match LLMResponseProcessor pattern)
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
    if (!safeEventDispatcher || typeof safeEventDispatcher.dispatch !== 'function') {
      throw new Error('MoodResponseProcessor requires a valid ISafeEventDispatcher');
    }
    if (!llmJsonService || typeof llmJsonService.parseAndRepair !== 'function') {
      throw new Error('MoodResponseProcessor requires a valid LlmJsonService');
    }

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
    this.#safeEventDispatcher = safeEventDispatcher;
    this.#llmJsonService = llmJsonService;

    // Verify schema is loaded (corrected - was missing from original)
    if (!this.#schemaValidator.isSchemaLoaded(LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID)) {
      throw new Error(`Schema ${LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID} not loaded`);
    }
  }

  /**
   * Process a Phase 1 LLM response containing mood/sexual updates.
   * @param {string} llmJsonResponse - Raw JSON string from LLM
   * @param {string} actorId - Actor entity ID for logging
   * @returns {Promise<{moodUpdate: Object, sexualUpdate: Object}>}
   * @throws {LLMProcessingError} If parsing or validation fails
   */
  async processMoodResponse(llmJsonResponse, actorId) {
    this.#logger.debug(`MoodResponseProcessor: Processing mood response for actor ${actorId}`);

    // Parse and repair JSON (corrected signature: options object, not actorId)
    let parsed;
    try {
      parsed = await this.#llmJsonService.parseAndRepair(llmJsonResponse, {
        logger: this.#logger,
      });
    } catch (err) {
      const errorMsg = `MoodResponseProcessor: JSON could not be parsed for actor ${actorId}: ${err.message}`;
      safeDispatchError(this.#safeEventDispatcher, errorMsg, {
        actorId,
        rawResponse: llmJsonResponse,
        error: err.message,
        stack: err.stack,
      }, this.#logger);
      throw new LLMProcessingError(errorMsg);
    }

    // Validate against mood schema
    const validationResult = this.#schemaValidator.validate(
      LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID,
      parsed
    );

    if (!validationResult.isValid) {
      const errorMsg = `MoodResponseProcessor: schema invalid for actor ${actorId}`;
      safeDispatchError(this.#safeEventDispatcher, errorMsg, {
        errors: validationResult.errors,
        parsed,
      }, this.#logger);
      throw new LLMProcessingError(
        `Mood response JSON schema validation failed for actor ${actorId}.`,
        { validationErrors: validationResult.errors }
      );
    }

    // Log mood values at INFO level
    this.#logger.info(`MoodResponseProcessor: moodUpdate extracted for actor ${actorId}`, {
      valence: parsed.moodUpdate.valence,
      arousal: parsed.moodUpdate.arousal,
      threat: parsed.moodUpdate.threat,
    });

    this.#logger.info(`MoodResponseProcessor: sexualUpdate extracted for actor ${actorId}`, {
      sex_excitation: parsed.sexualUpdate.sex_excitation,
      sex_inhibition: parsed.sexualUpdate.sex_inhibition,
    });

    return {
      moodUpdate: parsed.moodUpdate,
      sexualUpdate: parsed.sexualUpdate,
    };
  }
}
```

### DI Token

Add to `tokens-ai.js`:
```javascript
MoodResponseProcessor: 'MoodResponseProcessor',
```

### DI Registration

Add factory to `aiRegistrations.js`:
```javascript
registrar.singletonFactory(tokens.MoodResponseProcessor, (c) =>
  new MoodResponseProcessor({
    schemaValidator: c.resolve(tokens.ISchemaValidator),
    logger: c.resolve(tokens.ILogger),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    llmJsonService: c.resolve(tokens.LlmJsonService),
  })
);
```

## Acceptance Criteria

### Tests that must pass

#### `MoodResponseProcessor.test.js`

**Constructor validation tests:**
1. Throws if `schemaValidator` is missing
2. Throws if `schemaValidator` lacks `validate` method
3. Throws if `logger` is missing
4. Throws if `logger` lacks `debug` method
5. Throws if `safeEventDispatcher` is missing
6. Throws if `llmJsonService` is missing
7. Throws if `llmJsonService` lacks `parseAndRepair` method

**Processing tests:**
8. Valid JSON with all fields returns `{ moodUpdate, sexualUpdate }`
9. Calls `llmJsonService.parseAndRepair()` with response and actorId
10. Calls `schemaValidator.validate()` with correct schema ID
11. Throws error when JSON parsing fails
12. Throws error when schema validation fails
13. Missing `moodUpdate` causes validation failure (throws)
14. Missing `sexualUpdate` causes validation failure (throws)
15. Logs mood values (valence, arousal, threat) at INFO level
16. Logs sexual values (sex_excitation, sex_inhibition) at INFO level

**Return value tests:**
17. Returns object with exactly `moodUpdate` and `sexualUpdate` keys
18. `moodUpdate` contains all 7 axes
19. `sexualUpdate` contains both fields

### Invariants that must remain true

1. Follows existing `LLMResponseProcessor` patterns for consistency
2. Uses same `llmJsonService` interface for JSON parsing
3. Uses same `schemaValidator` interface
4. Uses same `safeEventDispatcher` interface
5. No fallback behavior - failures throw errors
6. DI token follows naming convention: `MoodResponseProcessor`
7. Does not dispatch events on success (persistence handles that)

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/turns/services/MoodResponseProcessor.test.js

# Type check
npm run typecheck

# Lint
npx eslint src/turns/services/MoodResponseProcessor.js
```

## Estimated Scope

- ~70 lines for `MoodResponseProcessor.js`
- ~5 lines DI token addition
- ~10 lines DI registration
- ~200 lines for tests
- Small, focused diff

## Outcome

### What Was Originally Planned
- Create `MoodResponseProcessor.js` service with constructor validation and `processMoodResponse` method
- Add DI token and registration
- Create comprehensive test suite

### What Was Actually Changed
All planned changes were implemented, with corrections based on discovered discrepancies:

**Files Created:**
- `src/turns/services/MoodResponseProcessor.js` (~195 lines) - Refactored into clean private methods (`#parseResponse`, `#validateSchema`, `#extractData`)
- `tests/unit/turns/services/MoodResponseProcessor.test.js` (~518 lines, 26 tests)

**Files Modified:**
- `src/dependencyInjection/tokens/tokens-ai.js` - Added `MoodResponseProcessor` token
- `src/dependencyInjection/registrations/aiRegistrations.js` - Added import + singleton factory registration

### Deviations from Original Ticket
1. **parseAndRepair signature**: Corrected from `(response, actorId)` to `(response, { logger })`
2. **Error handling**: Changed from generic `Error` to `LLMProcessingError` + `safeDispatchError()` pattern
3. **Constructor validation**: Added `isSchemaLoaded()` check (missing from original)
4. **Code organization**: Refactored into 3 private helper methods for cleaner separation of concerns
5. **Test count**: 26 tests (vs ~19 in ticket) with 100% code coverage

### Verification Results
- ✅ All 26 unit tests pass
- ✅ 100% code coverage on MoodResponseProcessor.js
- ✅ ESLint: No errors (only pre-existing JSDoc warnings)
- ✅ No regression in related tests (LLMResponseProcessor: 22 pass, schema: 15 pass)
