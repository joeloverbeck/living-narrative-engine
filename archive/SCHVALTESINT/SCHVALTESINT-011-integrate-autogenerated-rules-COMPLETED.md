# SCHVALTESINT-011: Integrate Auto-Generated Rules into preValidationUtils

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: MEDIUM
**Phase**: 4 - Parameter Rule Auto-Generation
**Dependencies**: SCHVALTESINT-010
**Blocks**: None
**Status**: ✅ COMPLETED

---

## Objective

Integrate the `parameterRuleGenerator.js` with `preValidationUtils.js` so that `OPERATION_PARAMETER_RULES` is automatically populated from schemas at startup, replacing the manual maintenance approach.

## File List

### Files to Modify

| File                              | Change Type                              |
| --------------------------------- | ---------------------------------------- |
| `src/utils/preValidationUtils.js` | Replace manual rules with auto-generated |

### Files to Create

None

### Files to Read (for reference)

| File                                  | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `src/utils/parameterRuleGenerator.js` | Generator created in SCHVALTESINT-010 |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/utils/parameterRuleGenerator.js` - Already done in SCHVALTESINT-010
- Any schema files in `data/schemas/`
- Any test infrastructure files
- The `KNOWN_OPERATION_TYPES` array (should remain separate whitelist)

**DO NOT:**

- Remove `KNOWN_OPERATION_TYPES` (still needed for fast whitelist check)
- Change the external API of `preValidationUtils.js`
- Make synchronous file I/O in hot paths

---

## Implementation Details

### Current Manual Approach

```javascript
// src/utils/preValidationUtils.js - current (lines 220-249)
// NOTE: These rules are for TYPO DETECTION, not schema validation
// They include invalidFields and fieldCorrections for common mistakes

const OPERATION_PARAMETER_RULES = {
  GET_NAME: {
    required: ['entity_ref', 'result_variable'],
    invalidFields: ['entity_id'], // Common mistake
    fieldCorrections: { entity_id: 'entity_ref' },
  },
  QUERY_COMPONENT: {
    required: ['entity_ref', 'component_type', 'result_variable'],
    invalidFields: ['entity_id'],
    fieldCorrections: { entity_id: 'entity_ref' },
  },
  ADD_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: { entity_id: 'entity_ref' },
  },
  REMOVE_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: { entity_id: 'entity_ref' },
  },
  // Only 4 of 66 operations have typo-detection rules!
};
```

### Required Changes

1. **Import generator** at module level
2. **Generate rules** during initialization (lazy, async)
3. **Add startup assertion** that all KNOWN_OPERATION_TYPES have rules
4. **Preserve backward compatibility** with existing typo-detection rules
5. **Merge** auto-generated schema rules with manual typo-detection rules

### Implementation Strategy

The implementation uses a **lazy initialization pattern** that:

- Keeps `OPERATION_PARAMETER_RULES` as the internal variable name
- Adds new exported functions for initialization and access
- Preserves the existing internal `validateOperationParameters` function behavior
- Merges auto-generated rules with manual typo-detection rules

### Suggested Implementation

```javascript
// src/utils/preValidationUtils.js - additions

import {
  generateParameterRules,
  validateCoverage,
} from './parameterRuleGenerator.js';

/** @type {Object|null} Auto-generated rules from schemas, initialized lazily */
let _schemaGeneratedRules = null;

/** @type {boolean} Whether schema-derived rules have been initialized */
let _rulesInitialized = false;

/**
 * Manual typo-detection rules (preserved from original implementation)
 * These provide helpful error messages for common parameter mistakes
 */
const MANUAL_TYPO_RULES = {
  GET_NAME: {
    required: ['entity_ref', 'result_variable'],
    invalidFields: ['entity_id'],
    fieldCorrections: { entity_id: 'entity_ref' },
  },
  // ... other manual rules preserved
};

/**
 * Gets the combined operation parameter rules (schema + manual)
 * @returns {Object} Map of operation type to parameter rules
 */
export function getOperationParameterRules() {
  if (!_rulesInitialized) {
    throw new Error(
      'Operation parameter rules not initialized. ' +
        'Call initializeParameterRules() during startup.'
    );
  }
  return _schemaGeneratedRules;
}

/**
 * Initializes operation parameter rules from schemas
 * Should be called during application startup before any validation
 * @param {Object} [options] - Initialization options
 * @param {boolean} [options.assertCoverage=true] - Assert all known types have rules
 * @throws {Error} If assertCoverage is true and coverage is incomplete
 */
export async function initializeParameterRules(options = {}) {
  const { assertCoverage = true } = options;

  if (_rulesInitialized) {
    return; // Already initialized
  }

  const schemaRules = await generateParameterRules();

  // Merge schema-derived rules with manual typo-detection rules
  // Manual rules take precedence for invalidFields/fieldCorrections
  _schemaGeneratedRules = {};
  for (const [type, rule] of Object.entries(schemaRules)) {
    const manualRule = MANUAL_TYPO_RULES[type];
    _schemaGeneratedRules[type] = {
      ...rule,
      // Preserve manual typo-detection features if they exist
      invalidFields: manualRule?.invalidFields || [],
      fieldCorrections: manualRule?.fieldCorrections || {},
    };
  }

  _rulesInitialized = true;

  if (assertCoverage) {
    const { missing, extra } = validateCoverage(
      _schemaGeneratedRules,
      KNOWN_OPERATION_TYPES
    );

    if (missing.length > 0) {
      throw new Error(
        `INV-3 Violation: Missing parameter rules for operation types: ${missing.join(', ')}. ` +
          `Ensure all operations have schemas in data/schemas/operations/`
      );
    }

    if (extra.length > 0) {
      console.warn(
        `Warning: Found parameter rules for types not in KNOWN_OPERATION_TYPES: ${extra.join(', ')}. ` +
          `Consider adding to KNOWN_OPERATION_TYPES if these are valid operations.`
      );
    }
  }
}

/**
 * Resets initialization state (for testing only)
 * @internal
 */
export function _resetParameterRulesForTesting() {
  _schemaGeneratedRules = null;
  _rulesInitialized = false;
}

// Keep KNOWN_OPERATION_TYPES as a fast whitelist (no async needed)
// See existing array at lines 32-97
```

### Integration Point

Initialization should be called during application startup. This is a **non-blocking enhancement** - if not initialized, the existing `validateOperationParameters` function continues to work with manual rules only.

```javascript
// In startup/initialization code (e.g., main.js or similar)
import { initializeParameterRules } from './utils/preValidationUtils.js';

// During async initialization phase
await initializeParameterRules({ assertCoverage: true });
```

**Note**: Until a startup initialization call point is identified, the implementation can be marked complete with the new exports available. A follow-up task may integrate into the actual startup sequence.

---

## Acceptance Criteria

### Tests That Must Pass

1. **All existing pre-validation tests** must continue to pass
2. **Update/add tests**: `tests/unit/utils/preValidationUtils.test.js`
   - `should initialize rules from schemas`
   - `should throw if accessed before initialization`
   - `should assert coverage when enabled`
   - `should skip assertion when disabled`
   - `should validate required parameters`
   - `should warn about unknown parameters`

### Integration Requirements

1. **Startup Assertion**: Fails fast if any operation lacks rules
2. **Backward Compatible**: Existing code using `validateOperationParameters` still works
3. **Lazy Initialization**: Rules generated once, cached thereafter
4. **Clear Errors**: Initialization failure messages point to missing schemas

### Invariants That Must Remain True

1. **INV-3 (Parameter Coverage)**: Startup fails if any KNOWN_OPERATION_TYPE lacks rules
2. **No Runtime Overhead**: Rules generated once at startup, not per-validation
3. **KNOWN_OPERATION_TYPES Independence**: Whitelist remains synchronous, fast

### Manual Verification Steps

1. Start application:

   ```bash
   npm run start
   ```

   Should initialize without errors (all 62 operations have rules).

2. Remove one schema temporarily:

   ```bash
   mv data/schemas/operations/lockGrabbing.schema.json /tmp/
   npm run start
   ```

   Should fail with INV-3 violation error.

3. Restore and verify:
   ```bash
   mv /tmp/lockGrabbing.schema.json data/schemas/operations/
   npm run start
   ```
   Should succeed.

---

## Estimated Effort

- **Size**: Medium (M)
- **Complexity**: Medium - requires careful initialization ordering
- **Risk**: Medium - modifies core validation logic

## Review Checklist

- [x] All existing pre-validation tests pass
- [x] New initialization tests pass
- [x] Startup assertion works correctly
- [x] Backward compatibility maintained
- [x] Error messages are clear and actionable
- [x] No synchronous file I/O in hot paths
- [x] JSDoc documentation updated
- [ ] Integration tested with full application startup (deferred - no startup integration point identified)

---

## Outcome

### Implementation Summary

Successfully integrated `parameterRuleGenerator.js` with `preValidationUtils.js` using a lazy initialization pattern.

### Files Modified

| File                              | Changes                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `src/utils/preValidationUtils.js` | Added lazy initialization infrastructure: imports, state variables, 4 new exports |

### Files Created

| File                                                          | Purpose                                  |
| ------------------------------------------------------------- | ---------------------------------------- |
| `tests/unit/utils/preValidationUtils.schemaRulesInit.test.js` | 19 tests for schema rules initialization |

### New Exports Added

```javascript
export function getOperationParameterRules()     // Get combined schema + manual rules
export async function initializeParameterRules() // Async initialization from schemas
export function isParameterRulesInitialized()    // Check initialization state
export function _resetParameterRulesForTesting() // Testing utility
```

### Key Implementation Details

1. **Lazy Initialization**: Rules are generated once on first call to `initializeParameterRules()` and cached
2. **Rule Merging**: Schema-derived rules are merged with existing manual typo-detection rules (GET_NAME, QUERY_COMPONENT, ADD_COMPONENT, REMOVE_COMPONENT)
3. **Coverage Validation**: INV-3 assertion throws if any KNOWN_OPERATION_TYPE lacks a schema (when `assertCoverage: true`)
4. **Backward Compatible**: Existing `validateOperationParameters` continues to work with manual rules

### Test Results

- **All existing tests pass**: 153 tests in preValidationUtils test suite
- **New tests added**: 19 tests covering initialization, merging, structure validation, and coverage assertion
- **Coverage**: 62 of 64 known operation types have schemas (97%)
- **Missing schemas**: `HAS_BODY_PART_WITH_COMPONENT_VALUE`, `SEQUENCE` (documented)

### Remaining Work

- **Startup Integration**: A follow-up task should integrate `initializeParameterRules()` into the application startup sequence
- **Missing Schemas**: Consider creating schemas for `HAS_BODY_PART_WITH_COMPONENT_VALUE` and `SEQUENCE` to achieve 100% coverage
