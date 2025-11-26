# SCHVALTESINT-011: Integrate Auto-Generated Rules into preValidationUtils

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: MEDIUM
**Phase**: 4 - Parameter Rule Auto-Generation
**Dependencies**: SCHVALTESINT-010
**Blocks**: None

---

## Objective

Integrate the `parameterRuleGenerator.js` with `preValidationUtils.js` so that `OPERATION_PARAMETER_RULES` is automatically populated from schemas at startup, replacing the manual maintenance approach.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `src/utils/preValidationUtils.js` | Replace manual rules with auto-generated |

### Files to Create

None

### Files to Read (for reference)

| File | Purpose |
|------|---------|
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
// src/utils/preValidationUtils.js - current

const OPERATION_PARAMETER_RULES = {
  SET_COMPONENT: { required: ['entity_id', 'component_type_id'], ... },
  REMOVE_COMPONENT: { required: ['entity_id', 'component_type_id'], ... },
  DISPATCH_EVENT: { required: ['type'], ... },
  QUERY_SYSTEM: { required: ['system_id'], ... },
  // Only 4 of 62 defined!
};
```

### Required Changes

1. **Import generator** at module level
2. **Generate rules** during initialization (lazy or eager)
3. **Add startup assertion** that all KNOWN_OPERATION_TYPES have rules
4. **Preserve backward compatibility** with existing validation logic

### Suggested Implementation

```javascript
// src/utils/preValidationUtils.js - modified

import { generateParameterRules, validateCoverage } from './parameterRuleGenerator.js';

/** @type {Object|null} Auto-generated rules, initialized lazily */
let _operationParameterRules = null;

/** @type {boolean} Whether rules have been initialized */
let _rulesInitialized = false;

/**
 * Gets the operation parameter rules, generating them if needed
 * @returns {Object} Map of operation type to parameter rules
 */
export function getOperationParameterRules() {
  if (!_rulesInitialized) {
    throw new Error(
      'Operation parameter rules not initialized. ' +
      'Call initializeParameterRules() during startup.'
    );
  }
  return _operationParameterRules;
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

  _operationParameterRules = await generateParameterRules();
  _rulesInitialized = true;

  if (assertCoverage) {
    const { missing, extra } = validateCoverage(
      _operationParameterRules,
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
 * Validates operation parameters against generated rules
 * @param {string} operationType - The operation type
 * @param {Object} parameters - The parameters to validate
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateOperationParameters(operationType, parameters) {
  const rules = getOperationParameterRules();
  const rule = rules[operationType];

  if (!rule) {
    // No rules for this type - skip parameter validation
    // Type validation already done by KNOWN_OPERATION_TYPES check
    return { isValid: true };
  }

  // Check required parameters
  for (const required of rule.required) {
    if (!(required in parameters)) {
      return {
        isValid: false,
        error: `Missing required parameter '${required}' for ${operationType}`
      };
    }
  }

  // Check for unknown parameters (optional warning, not error)
  const known = [...rule.required, ...rule.optional];
  for (const param of Object.keys(parameters)) {
    if (!known.includes(param)) {
      // Could be a warning instead of error
      console.warn(
        `Unknown parameter '${param}' for ${operationType}. Known: ${known.join(', ')}`
      );
    }
  }

  return { isValid: true };
}

// Keep KNOWN_OPERATION_TYPES as a fast whitelist (no async needed)
export const KNOWN_OPERATION_TYPES = [
  'ADD_COMPONENT',
  'DISPATCH_EVENT',
  'LOCK_GRABBING',
  'UNLOCK_GRABBING',
  // ... all 62 types
];
```

### Integration Point

Initialization should be called during application startup:

```javascript
// In startup/initialization code
import { initializeParameterRules } from './utils/preValidationUtils.js';

async function initializeValidation() {
  await initializeParameterRules({ assertCoverage: true });
}
```

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

- [ ] All existing pre-validation tests pass
- [ ] New initialization tests pass
- [ ] Startup assertion works correctly
- [ ] Backward compatibility maintained
- [ ] Error messages are clear and actionable
- [ ] No synchronous file I/O in hot paths
- [ ] JSDoc documentation updated
- [ ] Integration tested with full application startup
