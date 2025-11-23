# JSON Schema Validation System - Robustness Specification

**Version**: 1.0
**Date**: 2025-01-22
**Status**: Active
**Related Fix**: oneOf → anyOf schema change (operation.schema.json)

---

## Table of Contents

1. [Context](#context)
2. [Problem](#problem)
3. [Truth Sources](#truth-sources)
4. [Desired Behavior](#desired-behavior)
5. [Testing Plan](#testing-plan)
6. [Implementation Guidelines](#implementation-guidelines)

---

## Context

### Location in Codebase

The JSON schema validation system spans multiple modules:

| Module | File Path | Purpose |
|--------|-----------|---------|
| **Schema Definition** | `data/schemas/operation.schema.json` | Defines Operation and MacroReference validation rules |
| **Pre-Validation** | `src/utils/preValidationUtils.js` | Fast structural checks before AJV validation |
| **AJV Validation** | `src/validation/ajvSchemaValidator.js` | Main validation coordinator using AJV library |
| **Error Formatting** | `src/utils/ajvAnyOfErrorFormatter.js` | Intelligent error message generation |
| **Macro Expansion** | `src/loaders/macroUtils.js` | Load-time macro reference expansion |
| **Rule Loading** | `src/loaders/ruleLoader.js` | Orchestrates validation and macro expansion |

### What the Module Does

The validation system provides **three-stage validation** for game rule files:

```
┌─────────────────────────────────────────────────────────┐
│ Stage 1: Pre-Validation (preValidationUtils.js)        │
│ ├─ Fast structural checks                              │
│ ├─ Operation type whitelist validation                 │
│ └─ Common mistake detection                            │
├─────────────────────────────────────────────────────────┤
│ Stage 2: AJV Schema Validation (ajvSchemaValidator.js) │
│ ├─ JSON Schema validation against operation.schema.json│
│ ├─ anyOf[MacroReference, Operation] validation         │
│ └─ Comprehensive parameter validation                  │
├─────────────────────────────────────────────────────────┤
│ Stage 3: Error Formatting (ajvAnyOfErrorFormatter.js)  │
│ ├─ Intelligent error grouping by operation type        │
│ ├─ Operation type inference from errors                │
│ └─ Actionable fix suggestions                          │
└─────────────────────────────────────────────────────────┘
                        ↓
            [Pass] → Macro Expansion
                        ↓
                Fully Validated Rule
```

**Key Responsibilities:**

1. **Structural Integrity**: Ensure all actions have either `type` or `macro` field
2. **Type Safety**: Validate operation types against registered handlers
3. **Parameter Validation**: Enforce operation-specific parameter schemas
4. **Macro Resolution**: Expand macro references to concrete operations at load time
5. **User Guidance**: Provide clear, actionable error messages

### Architecture Overview

```
Rule File (JSON)
    │
    ├─→ Pre-Validation (Fast Path)
    │   ├─ Check structure (type XOR macro)
    │   ├─ Validate against KNOWN_OPERATION_TYPES whitelist
    │   └─ Detect common parameter mistakes
    │
    ├─→ AJV Validation (Comprehensive)
    │   ├─ Load operation.schema.json
    │   ├─ Validate using anyOf[MacroReference, Operation]
    │   └─ Validate parameters against specific operation schemas
    │
    ├─→ Error Formatting (User-Friendly)
    │   ├─ Group errors by operation type
    │   ├─ Infer intended operation from data
    │   └─ Generate fix suggestions
    │
    └─→ Macro Expansion (Load-Time)
        ├─ Replace {"macro": "id"} with expanded actions
        ├─ Recursively expand nested macros (max depth: 10)
        └─ Validate no unexpanded references remain
```

---

## Problem

### What Failed

**Issue**: The `operation.schema.json` file used the `oneOf` JSON Schema keyword to validate actions that could be either a `MacroReference` or an `Operation`. This caused **322 false-positive validation errors** for valid macro references.

**Affected Files**:
- `data/mods/metabolism/rules/handle_drink_beverage.rule.json` (322 errors)
- `data/mods/metabolism/rules/handle_eat_food.rule.json` (322 errors)

**Example Valid Macro Reference** (from handle_drink_beverage.rule.json:76-78):
```json
{
  "comment": "Log success, dispatch events, and end turn",
  "macro": "core:logSuccessAndEndTurn"
}
```

### How It Failed

**Error Message** (misleading):
```
Missing operation type - this operation needs a "type" field.

For regular operations, use:
  {"type": "OPERATION_NAME", "parameters": {...}}

For macro references, use:
  {"macro": "namespace:macroId"}

Common operation types:
  - QUERY_COMPONENT
  - MODIFY_COMPONENT
  ...
```

**Actual Validation Flow**:

1. **AJV encounters** `{"macro": "core:logSuccessAndEndTurn", "comment": "..."}`

2. **oneOf semantic**: Try BOTH branches, require EXACTLY ONE to match

3. **Branch 1: MacroReference** → ✅ **MATCHES** (has required "macro" field)

4. **Branch 2: Operation** → ❌ **FAILS** (missing required "type" field)
   - Enters `anyOf` with 60+ operation schemas
   - Each operation schema fails (no "type" field)
   - Each failure generates ~5 error messages
   - Total: 60 operations × 5 errors ≈ 300+ errors

5. **oneOf evaluation**: ONE branch matched (MacroReference), but `oneOf` reports ALL failures before declaring success

6. **Result**: Validation **ultimately passes**, but generates 322 error messages

### Why It Failed

**Root Cause**: Misunderstanding of JSON Schema `oneOf` semantics

- **oneOf Behavior**: Validates data against ALL branches, then checks that EXACTLY one passed
  - Reports errors from ALL failed branches
  - Only succeeds if exactly one branch matches
  - Designed for mutual exclusivity validation

- **anyOf Behavior**: Validates data against branches until one passes
  - Can short-circuit after first match
  - Succeeds if one OR more branches match
  - Designed for union type validation

**Why oneOf Was Wrong Choice**:
```json
// oneOf says: "This MUST be MacroReference XOR Operation, prove it's not both"
// But we only care: "Is this a valid MacroReference OR Operation?"

// oneOf forces validation of BOTH branches → reports all errors
// anyOf stops after first match → no error cascade
```

**Performance Impact**:
- oneOf: O(n) where n = total schemas in all branches (300+ schemas)
- anyOf: O(k) where k = schemas until first match (1-2 schemas typically)

### Test Links

**Primary Test Coverage**:

1. **tests/integration/validation/anyOfErrorFormatting.integration.test.js** (706 lines)
   - Tests anyOf error formatting with 140+ operation types
   - Validates error grouping by operation type
   - Tests macro reference format validation
   - Covers high-volume error cascade scenarios

2. **tests/unit/utils/ajvAnyOfErrorFormatter.test.js** (452 lines)
   - Unit tests for error formatter logic
   - Tests operation type inference
   - Validates enum guidance generation
   - Tests entity_id vs entity_ref correction

3. **tests/integration/validation/operationValidationError.test.js**
   - Integration tests for operation validation errors
   - Tests pre-validation failures
   - Validates error message quality

**Gap**: No specific test for oneOf → anyOf regression (should be added)

---

## Truth Sources

### 1. JSON Schema Specification (Draft 07)

**Source**: https://json-schema.org/draft-07/json-schema-validation.html

**Relevant Sections**:

**Section 6.7.1 - oneOf**:
> An instance validates successfully against this keyword if it validates successfully against exactly one schema defined by this keyword's value.

**Section 6.7.2 - anyOf**:
> An instance validates successfully against this keyword if it validates successfully against at least one schema defined by this keyword's value.

**Key Implications**:
- **oneOf** is for **mutual exclusivity** (validate it's not both)
- **anyOf** is for **union types** (validate it's at least one)
- **Performance**: anyOf can short-circuit, oneOf must validate all branches

### 2. AJV Library Documentation

**Source**: https://ajv.js.org/json-schema.html

**Error Reporting Behavior**:
- **oneOf errors**: Reports errors from ALL branches that failed, plus a final oneOf error if match count ≠ 1
- **anyOf errors**: Reports errors only if NO branches match
- **Recommended**: Use anyOf for discriminated unions (our use case)

**Configuration** (from ajvSchemaValidator.js:48-53):
```javascript
{
  allErrors: true,           // Collect all errors (not just first)
  verbose: true,             // Include schema and data in errors
  strictTypes: false,        // Allow type coercion
  allowUnionTypes: true,     // Allow anyOf/oneOf with different types
  strictRequired: false,     // Allow additional properties
  validateFormats: true      // Validate format keywords
}
```

### 3. Project Conventions

**Source**: `CLAUDE.md` (project documentation)

**Operation Registration Pattern** (CLAUDE.md:421-504):

Seven-step checklist for adding new operations:
1. Create operation schema in `data/schemas/operations/`
2. Add $ref to `operation.schema.json` anyOf array
3. Create operation handler in `src/logic/operationHandlers/`
4. Define DI token in `tokens-core.js`
5. Register handler factory in `operationHandlerRegistrations.js`
6. Map operation to handler in `interpreterRegistrations.js`
7. **⚠️ CRITICAL**: Add to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`

**Consequence**: Forgetting step 7 causes validation failures

### 4. Domain Rules

**Macro Expansion Rules** (from macroUtils.js):

1. **Timing**: Macros expand at load time, not runtime
2. **Recursion**: Nested macros expand recursively (max depth: 10)
3. **Validation Order**: Validate → Expand → Re-validate expanded actions
4. **Reference Format**: `{"macro": "namespace:identifier"}`
5. **Substitution**: Entire macro reference replaced with macro's `actions` array

**Example Macro Definition**:
```json
{
  "macro_id": "core:logSuccessAndEndTurn",
  "description": "Standard success logging and turn end",
  "actions": [
    {
      "type": "LOG",
      "parameters": {"message": "Action completed successfully", "level": "info"}
    },
    {
      "type": "END_TURN",
      "parameters": {}
    }
  ]
}
```

**Expansion**:
```json
// Before
{"macro": "core:logSuccessAndEndTurn"}

// After
[
  {"type": "LOG", "parameters": {"message": "Action completed successfully", "level": "info"}},
  {"type": "END_TURN", "parameters": {}}
]
```

### 5. External Contracts

**AJV Version**: `^8.12.0` (package.json)
- **Breaking Changes**: v8 introduced strictTypes by default
- **Compatibility**: Must maintain compatibility with v8.x for security updates
- **Migration Path**: Document any required config changes for v9.x

**JSON Schema Draft**: Draft-07
- **Stability**: No breaking changes expected (Draft-08 is not widely adopted)
- **Features**: Conditional schemas (`if/then/else`) available but not currently used
- **Future**: Consider Draft 2020-12 for better discriminated union support

---

## Desired Behavior

### Normal Cases

#### 1. Valid Macro Reference

**Input**:
```json
{
  "rule_id": "test_rule",
  "event_type": "core:test_event",
  "actions": [
    {"macro": "core:logSuccessAndEndTurn"}
  ]
}
```

**Expected Behavior**:
- ✅ Pre-validation: Pass (has "macro" field)
- ✅ AJV validation: Pass (matches MacroReference schema)
- ✅ Error count: 0
- ✅ Macro expansion: Expands to LOG + END_TURN operations
- ✅ Final validation: Validates expanded operations

#### 2. Valid Operation

**Input**:
```json
{
  "rule_id": "test_rule",
  "event_type": "core:test_event",
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_id": "core:actor",
        "output_var": "actorData"
      }
    }
  ]
}
```

**Expected Behavior**:
- ✅ Pre-validation: Pass (type in KNOWN_OPERATION_TYPES)
- ✅ AJV validation: Pass (matches QUERY_COMPONENT schema)
- ✅ Error count: 0
- ✅ Macro expansion: N/A (no macros)
- ✅ Final validation: Pass

#### 3. Mixed Actions Array

**Input**:
```json
{
  "rule_id": "test_rule",
  "event_type": "core:test_event",
  "actions": [
    {"type": "SET_VARIABLE", "parameters": {"variable_name": "test", "value": "123"}},
    {"macro": "core:logSuccessAndEndTurn"}
  ]
}
```

**Expected Behavior**:
- ✅ Pre-validation: Pass (both actions valid)
- ✅ AJV validation: Pass (SET_VARIABLE + MacroReference both valid)
- ✅ Error count: 0
- ✅ Macro expansion: Second action expands to [LOG, END_TURN]
- ✅ Final result: [SET_VARIABLE, LOG, END_TURN]

#### 4. Nested Macro Expansion

**Input**:
```json
// Macro A references Macro B
{"macro": "custom:complexWorkflow"}

// Macro B definition contains:
{
  "actions": [
    {"type": "LOG", "parameters": {"message": "Starting"}},
    {"macro": "core:logSuccessAndEndTurn"}
  ]
}
```

**Expected Behavior**:
- ✅ First expansion: Macro A → [LOG, {"macro": "core:logSuccessAndEndTurn"}]
- ✅ Second expansion: Nested macro → [LOG, LOG, END_TURN]
- ✅ Max depth check: Depth 2 < 10, allowed
- ✅ Final validation: All expanded operations valid

### Edge Cases

#### 1. Empty Macro Reference (Missing Required Field)

**Input**:
```json
{"macro": ""}
```

**Expected Behavior**:
- ❌ AJV validation: Fail (empty string doesn't match namespacedId pattern)
- 📋 Error message: "Invalid macro ID format. Expected 'namespace:identifier'"
- 🔧 Suggestion: "Check macro ID follows 'namespace:identifier' format (e.g., 'core:logSuccess')"

#### 2. Macro with Type Field (Invalid Hybrid)

**Input**:
```json
{
  "type": "QUERY_COMPONENT",
  "macro": "core:logSuccess"
}
```

**Expected Behavior**:
- ❌ Pre-validation: Fail (has both type and macro)
- 📋 Error message: "Macro reference should not have a type field"
- 🔧 Suggestion: "Remove either 'type' (for macro) or 'macro' (for operation)"

#### 3. Unknown Operation Type

**Input**:
```json
{
  "type": "UNKNOWN_OPERATION",
  "parameters": {}
}
```

**Expected Behavior**:
- ❌ Pre-validation: Fail (type not in KNOWN_OPERATION_TYPES)
- 📋 Error message: "Unknown operation type: 'UNKNOWN_OPERATION'"
- 🔧 Suggestion: Lists first 12 valid operation types + "... and 81 more"

#### 4. Missing Required Parameters

**Input**:
```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "component_id": "core:actor"
    // Missing required: entity_ref, output_var
  }
}
```

**Expected Behavior**:
- ✅ Pre-validation: Pass (type exists)
- ❌ AJV validation: Fail (missing required parameters)
- 📋 Error message: "Operation type 'QUERY_COMPONENT' validation failed:
  - /parameters: Missing required property 'entity_ref'
  - /parameters: Missing required property 'output_var'"

#### 5. entity_id vs entity_ref Typo

**Input**:
```json
{
  "type": "GET_NAME",
  "parameters": {
    "entity_id": "actor",  // Should be entity_ref
    "output_var": "actorName"
  }
}
```

**Expected Behavior**:
- ❌ AJV validation: Fail (additionalProperty 'entity_id')
- 📋 Error message: "Operation type 'GET_NAME' has invalid parameters:
  - /parameters: Unexpected property 'entity_id'

  Common issue detected: 'entity_id' should be 'entity_ref'
  The GET_NAME operation expects 'entity_ref', not 'entity_id'"

#### 6. Circular Macro Reference

**Input**:
```json
// Macro A
{"macro": "custom:macroA"}
// macroA definition: {"actions": [{"macro": "custom:macroB"}]}

// Macro B
// macroB definition: {"actions": [{"macro": "custom:macroA"}]}
```

**Expected Behavior**:
- ❌ Macro expansion: Fail (max depth 10 exceeded)
- 📋 Error message: "Circular macro reference detected: custom:macroA → custom:macroB → custom:macroA"
- 🔧 Suggestion: "Check macro definitions for circular references"

#### 7. Undefined Macro Reference

**Input**:
```json
{"macro": "custom:nonexistentMacro"}
```

**Expected Behavior**:
- ✅ Pre-validation: Pass (valid structure)
- ✅ AJV validation: Pass (valid MacroReference)
- ❌ Macro expansion: Fail (macro not found in registry)
- 📋 Error message: "Macro 'custom:nonexistentMacro' not found in registry"
- 🔧 Suggestion: "Check macro is defined and mod is loaded"

### Failure Modes

#### 1. Pre-Validation Failures

**When**: Structural issues caught before AJV validation

**Error Response**:
```javascript
throw new Error(`Pre-validation failed for ${filename}: ${error.message}`);
```

**User Impact**: Immediate failure with clear error message

**Examples**:
- Missing "type" and "macro" fields
- Unknown operation type
- Both "type" and "macro" present

#### 2. AJV Validation Failures

**When**: Schema validation fails

**Error Response**:
```javascript
const formattedError = formatAjvErrorsEnhanced(errors, data);
throw new Error(`RuleLoader [${modId}]: Primary schema validation failed for '${filename}' using schema '${schemaId}'.\nDetails:\n${formattedError}`);
```

**User Impact**: Detailed validation errors with fix suggestions

**Examples**:
- Missing required parameters
- Invalid parameter types
- Additional unexpected properties
- Invalid enum values

#### 3. Macro Expansion Failures

**When**: Macro cannot be resolved or expanded

**Error Response**:
```javascript
throw new Error(`Macro expansion failed: ${error.message}`);
```

**User Impact**: Clear indication of which macro failed and why

**Examples**:
- Macro not found in registry
- Circular macro reference
- Max recursion depth exceeded

#### 4. Schema Loading Failures

**When**: Schema compilation fails during initialization

**Error Response**:
```javascript
throw new Error(`Schema compilation failed for ${schemaId}: ${error.message}`);
```

**User Impact**: Application fails to start, requires schema fix

**Examples**:
- Invalid schema syntax
- Circular $ref dependencies
- Unknown schema format

### Invariants

Properties that must ALWAYS hold:

#### 1. Action Structure Invariant

```
∀ action ∈ actions: (has(action, "type") XOR has(action, "macro"))
```

**Meaning**: Every action must have EITHER a "type" field OR a "macro" field, never both, never neither.

**Enforcement**:
- Pre-validation checks this before AJV validation
- anyOf schema structure enforces at AJV level
- Macro expansion validates expanded actions maintain invariant

#### 2. Validation Order Invariant

```
Pre-validation → AJV Validation → Macro Expansion → Final Validation
```

**Meaning**: Validation stages ALWAYS execute in this order.

**Enforcement**:
- RuleLoader orchestrates order (ruleLoader.js:103-126)
- Pre-validation throws before AJV validation can run
- Macro expansion only happens after validation passes

#### 3. Operation Type Whitelist Invariant

```
∀ operation: operation.type ∈ KNOWN_OPERATION_TYPES ⟺ ∃ handler registered
```

**Meaning**: Every operation type in the whitelist has a registered handler, and vice versa.

**Enforcement**:
- Developer checklist in CLAUDE.md (step 7)
- Validation script: `npm run validate:operation-types` (proposed)
- Integration test: operationTypeCompleteness.test.js

#### 4. Error Message Quality Invariant

```
∀ error: error.message.includes(suggestion) ∨ error.message.includes(validTypes)
```

**Meaning**: Every error message includes either a fix suggestion OR a list of valid options.

**Enforcement**:
- ajvAnyOfErrorFormatter.js provides suggestions
- Pre-validation messages include guidance
- Test coverage for error message quality

#### 5. Macro Expansion Completeness Invariant

```
∀ rule: ¬∃ action ∈ expandedRule.actions: has(action, "macro")
```

**Meaning**: After expansion, NO actions should have "macro" field (all resolved).

**Enforcement**:
- macroUtils.js validateExpansion() function
- Recursive expansion with termination check
- Final validation ensures no unexpanded macros

### API Contracts

#### What Stays Stable

**1. Schema Structure**

**MacroReference Schema** (STABLE):
```json
{
  "type": "object",
  "properties": {
    "macro": {"$ref": "./common.schema.json#/definitions/namespacedId"},
    "comment": {"type": "string"}
  },
  "required": ["macro"],
  "additionalProperties": false
}
```

**Operation Schema** (STABLE):
```json
{
  "type": "object",
  "properties": {
    "type": {"const": "OPERATION_NAME"},
    "parameters": {"type": "object"}
  },
  "required": ["type", "parameters"],
  "additionalProperties": false
}
```

**2. Validation Function Signatures**

```javascript
// Pre-validation (preValidationUtils.js:304-399)
validateOperationStructure(operation, index) → {
  isValid: boolean,
  error: string | null,
  path: string | null,
  suggestions: string[] | null
}

// AJV validation (ajvSchemaValidator.js:87-96)
validate(schemaId, data) → boolean

// Error formatting (ajvAnyOfErrorFormatter.js:354-424)
formatAjvErrorsEnhanced(errors, data) → string
```

**3. Macro Expansion Interface**

```javascript
// macroUtils.js
expandMacros(actions, macroRegistry, options) → {
  expanded: Action[],
  errors: string[]
}
```

**4. Event Dispatch Contract**

```javascript
// On validation failure
eventBus.dispatch({
  type: 'VALIDATION_ERROR',
  payload: {
    modId: string,
    filename: string,
    schemaId: string,
    errors: ErrorObject[]
  }
});
```

#### What Is Allowed to Change

**1. Number of Operation Types**

- **Current**: 93 operation types in KNOWN_OPERATION_TYPES
- **Allowed**: Add unlimited new operation types
- **Requirement**: Update whitelist in same PR as handler registration
- **Backward Compatible**: Yes (adding types doesn't break existing operations)

**2. Error Message Wording**

- **Current**: Specific error messages and suggestions
- **Allowed**: Improve clarity, add new suggestions, rephrase
- **Requirement**: Maintain error message structure (problem + suggestion)
- **Backward Compatible**: Yes (error messages are for humans, not parsed)

**3. Pre-Validation Rules**

- **Current**: 3 main checks (structure, whitelist, common mistakes)
- **Allowed**: Add new pre-validation checks (e.g., parameter pattern validation)
- **Requirement**: New checks must fail fast with clear messages
- **Backward Compatible**: Yes (stricter validation is allowed)

**4. AJV Configuration**

- **Current**: allErrors=true, verbose=true, strictTypes=false
- **Allowed**: Tune performance settings (e.g., cache compiled schemas)
- **Requirement**: Maintain error reporting quality
- **Backward Compatible**: Must be tested against existing schemas

**5. Macro Expansion Algorithm**

- **Current**: Recursive expansion with max depth 10
- **Allowed**: Optimize expansion (e.g., iterative vs recursive, caching)
- **Requirement**: Maintain expansion semantics (same output)
- **Backward Compatible**: Yes (internal optimization)

**6. Schema Organization**

- **Current**: One schema per operation in operations/ folder
- **Allowed**: Reorganize schema files (e.g., group by category)
- **Requirement**: Maintain $id and $ref resolution
- **Backward Compatible**: Yes (schema IDs are stable)

---

## Testing Plan

### Tests to Add

#### 1. Regression Test: oneOf → anyOf Fix

**File**: `tests/integration/validation/macroReferenceValidation.test.js` (NEW)

**Purpose**: Prevent regression to oneOf schema pattern

**Test Cases**:

```javascript
describe('Macro Reference Validation - anyOf Regression Prevention', () => {
  it('should validate macro reference without generating cascading errors', async () => {
    const rule = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'test_macro_validation',
      event_type: 'core:test_event',
      actions: [
        { macro: 'core:logSuccessAndEndTurn' }
      ]
    };

    const errors = [];
    const mockLogger = {
      error: (msg, ctx) => errors.push({ msg, ctx })
    };

    await validateAgainstSchema(schemaValidator, schemaId, rule, mockLogger);

    // Should have NO errors for valid macro reference
    expect(errors).toHaveLength(0);
  });

  it('should not generate more than 10 errors for invalid macro reference', async () => {
    const rule = {
      actions: [
        { macro: '' } // Invalid: empty string
      ]
    };

    const errors = [];
    const mockLogger = {
      error: (msg, ctx) => errors.push({ msg, ctx })
    };

    try {
      await validateAgainstSchema(schemaValidator, schemaId, rule, mockLogger);
    } catch (err) {
      // Should fail, but with limited error count
      const errorCount = errors[0]?.ctx?.validationErrors?.length || 0;
      expect(errorCount).toBeLessThan(10);
    }
  });

  it('should validate both MacroReference and Operation in anyOf without error cascade', async () => {
    const rule = {
      actions: [
        { type: 'LOG', parameters: { message: 'test' } },
        { macro: 'core:logSuccessAndEndTurn' }
      ]
    };

    const errors = [];
    await validateAgainstSchema(schemaValidator, schemaId, rule, mockLogger);

    expect(errors).toHaveLength(0);
  });
});
```

**Success Criteria**:
- ✅ Valid macro references generate 0 errors
- ✅ Invalid macro references generate <10 errors (not 322)
- ✅ Mixed actions arrays validate correctly

#### 2. Property-Based Test: Action Array Validation

**File**: `tests/unit/schemas/actionArrayProperties.test.js` (NEW)

**Purpose**: Ensure validation is consistent across all possible action structures

**Property Tests**:

```javascript
import fc from 'fast-check';

describe('Action Array Validation - Property Tests', () => {
  // Property: Every valid macro reference validates
  it('should validate all well-formed macro references', () => {
    fc.assert(
      fc.property(
        fc.record({
          macro: fc.string({ minLength: 3 }).map(s => `namespace:${s}`),
          comment: fc.option(fc.string())
        }),
        (macroRef) => {
          const result = validateMacroReference(macroRef);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Every valid operation validates
  it('should validate all well-formed operations', () => {
    const operationTypes = KNOWN_OPERATION_TYPES;

    fc.assert(
      fc.property(
        fc.constantFrom(...operationTypes),
        fc.object(),
        (type, parameters) => {
          const operation = { type, parameters };
          const preValidation = validateOperationStructure(operation);
          expect(preValidation.isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Actions with both type AND macro always fail
  it('should reject all actions with both type and macro fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...KNOWN_OPERATION_TYPES),
        fc.string().map(s => `namespace:${s}`),
        (type, macro) => {
          const invalidAction = { type, macro, parameters: {} };
          const result = validateOperationStructure(invalidAction);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('should not have a type field');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: Actions with neither type nor macro always fail
  it('should reject all actions without type or macro fields', () => {
    fc.assert(
      fc.property(
        fc.object({ excludedKeys: ['type', 'macro'] }),
        (invalidAction) => {
          const result = validateOperationStructure(invalidAction);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('Missing operation type');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Success Criteria**:
- ✅ 100 random valid macro references validate
- ✅ 100 random valid operations validate
- ✅ 100 random invalid hybrids fail with correct error
- ✅ No false positives or false negatives

#### 3. Performance Test: Large anyOf Schemas

**File**: `tests/performance/validation/anyOfPerformance.test.js` (NEW)

**Purpose**: Ensure no performance regression from oneOf → anyOf change

**Benchmark Tests**:

```javascript
describe('anyOf Performance - Regression Prevention', () => {
  it('should validate 1000 macro references in <100ms', async () => {
    const rules = Array(1000).fill().map((_, i) => ({
      rule_id: `test_rule_${i}`,
      event_type: 'core:test_event',
      actions: [{ macro: 'core:logSuccessAndEndTurn' }]
    }));

    const start = performance.now();

    for (const rule of rules) {
      await validateAgainstSchema(schemaValidator, schemaId, rule);
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // <0.1ms per rule
  });

  it('should validate with 100+ operation types without significant slowdown', async () => {
    // Simulate adding 50 more operation types to schema
    const largeSchema = createSchemaWithOperations(150);
    const validator = new AjvSchemaValidator();
    await validator.addSchema(largeSchema);

    const rule = {
      actions: [{ type: 'QUERY_COMPONENT', parameters: { /* valid */ } }]
    };

    const start = performance.now();
    const result = validator.validate(schemaId, rule);
    const duration = performance.now() - start;

    expect(result).toBe(true);
    expect(duration).toBeLessThan(5); // <5ms per validation
  });

  it('should not degrade with nested macro expansion', async () => {
    // Create nested macro: A → B → C → D → E (depth 5)
    const nestedMacros = createNestedMacros(5);

    const start = performance.now();
    const expanded = await expandMacros([{ macro: 'test:macroA' }], nestedMacros);
    const duration = performance.now() - start;

    expect(expanded.errors).toHaveLength(0);
    expect(duration).toBeLessThan(10); // <10ms for 5 levels
  });
});
```

**Success Criteria**:
- ✅ 1000 validations in <100ms (baseline: oneOf was ~150ms)
- ✅ Large schemas (<5ms per validation)
- ✅ Nested expansion remains <10ms

### Tests to Update

#### 1. Update anyOfErrorFormatting.integration.test.js

**File**: `tests/integration/validation/anyOfErrorFormatting.integration.test.js`

**Changes Needed**:

```javascript
// ADD: Test for macro reference error suppression
describe('Macro Reference Error Handling', () => {
  it('should not report false positives for valid macro references', async () => {
    const data = {
      actions: [
        { macro: 'core:logSuccessAndEndTurn' }
      ]
    };

    const errors = validator.validate(schemaId, data);

    // Should have NO anyOf errors for valid macro
    const anyOfErrors = errors.filter(e => e.keyword === 'anyOf');
    expect(anyOfErrors).toHaveLength(0);
  });

  it('should provide clear error for invalid macro format', async () => {
    const data = {
      actions: [
        { macro: 'invalid-format' } // Missing namespace separator
      ]
    };

    try {
      validator.validate(schemaId, data);
    } catch (err) {
      expect(err.message).toContain('Invalid macro ID format');
      expect(err.message).toContain('namespace:identifier');
    }
  });
});
```

#### 2. Update preValidationUtils Tests

**File**: `tests/unit/utils/preValidationUtils.test.js`

**Changes Needed**:

```javascript
// ADD: Test for KNOWN_OPERATION_TYPES completeness
describe('KNOWN_OPERATION_TYPES Whitelist', () => {
  it('should include all registered operation handlers', () => {
    const registeredHandlers = getRegisteredOperationHandlers();
    const whitelistedTypes = KNOWN_OPERATION_TYPES;

    registeredHandlers.forEach(handlerType => {
      expect(whitelistedTypes).toContain(handlerType);
    });
  });

  it('should not include non-existent operation types', () => {
    const registeredHandlers = getRegisteredOperationHandlers();

    KNOWN_OPERATION_TYPES.forEach(type => {
      expect(registeredHandlers).toContain(type);
    });
  });

  it('should maintain alphabetical order for maintainability', () => {
    const sorted = [...KNOWN_OPERATION_TYPES].sort();
    expect(KNOWN_OPERATION_TYPES).toEqual(sorted);
  });
});
```

### Regression Tests

#### 1. All Current Operation Types

**Test**: Validate all 93 current operation types still work

```javascript
describe('Operation Type Regression', () => {
  KNOWN_OPERATION_TYPES.forEach(operationType => {
    it(`should validate operation type: ${operationType}`, async () => {
      const operation = createMinimalOperation(operationType);
      const result = validateOperationStructure(operation);

      expect(result.isValid).toBe(true);
    });
  });
});
```

#### 2. Macro Expansion with Nested References

**Test**: Ensure nested macro expansion still works correctly

```javascript
describe('Nested Macro Expansion Regression', () => {
  it('should expand macros with 3 levels of nesting', async () => {
    const macros = {
      'test:level1': { actions: [{ macro: 'test:level2' }] },
      'test:level2': { actions: [{ macro: 'test:level3' }] },
      'test:level3': { actions: [{ type: 'LOG', parameters: { message: 'final' } }] }
    };

    const result = await expandMacros([{ macro: 'test:level1' }], macros);

    expect(result.expanded).toHaveLength(1);
    expect(result.expanded[0].type).toBe('LOG');
  });
});
```

#### 3. Error Messages for Common Mistakes

**Test**: Verify helpful error messages still provided

```javascript
describe('Error Message Quality Regression', () => {
  it('should detect entity_id vs entity_ref typo', () => {
    const operation = {
      type: 'GET_NAME',
      parameters: { entity_id: 'actor', output_var: 'name' }
    };

    try {
      validateAgainstSchema(validator, schemaId, { actions: [operation] });
    } catch (err) {
      expect(err.message).toContain('entity_id');
      expect(err.message).toContain('entity_ref');
      expect(err.message).toContain('should be');
    }
  });
});
```

#### 4. Mixed Action Arrays

**Test**: Ensure mixed macro + operation arrays work

```javascript
describe('Mixed Action Array Regression', () => {
  it('should validate arrays with both macros and operations', async () => {
    const actions = [
      { type: 'SET_VARIABLE', parameters: { variable_name: 'test', value: '123' } },
      { macro: 'core:logSuccessAndEndTurn' },
      { type: 'LOG', parameters: { message: 'after macro' } }
    ];

    const result = await validateActions(actions);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

### Property Tests

#### Property 1: Validation is Deterministic

**Statement**: Same input always produces same validation result

```javascript
fc.assert(
  fc.property(
    fc.record({
      type: fc.constantFrom(...KNOWN_OPERATION_TYPES),
      parameters: fc.object()
    }),
    (operation) => {
      const result1 = validateOperationStructure(operation);
      const result2 = validateOperationStructure(operation);

      expect(result1).toEqual(result2);
    }
  )
);
```

#### Property 2: Error Count ≤ Actual Failures

**Statement**: Error messages should not exceed actual validation failures

```javascript
fc.assert(
  fc.property(
    fc.array(fc.oneof(
      fc.record({ type: fc.string(), parameters: fc.object() }),
      fc.record({ macro: fc.string() })
    )),
    (actions) => {
      try {
        validateActions(actions);
      } catch (err) {
        const errorCount = err.validationErrors?.length || 0;
        const actionCount = actions.length;

        // Error count should be reasonable (not 322 for 1 action)
        expect(errorCount).toBeLessThan(actionCount * 20);
      }
    }
  )
);
```

#### Property 3: All Valid MacroReferences Validate

**Statement**: Well-formed macro references always validate successfully

```javascript
fc.assert(
  fc.property(
    fc.record({
      macro: fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }))
        .map(([ns, id]) => `${ns}:${id}`),
      comment: fc.option(fc.string())
    }),
    (macroRef) => {
      const result = validateMacroReference(macroRef);
      expect(result.valid).toBe(true);
    }
  )
);
```

#### Property 4: All Valid Operations Validate

**Statement**: Well-formed operations always validate successfully

```javascript
fc.assert(
  fc.property(
    fc.constantFrom(...KNOWN_OPERATION_TYPES),
    fc.object(),
    (type, parameters) => {
      const operation = { type, parameters };
      const preValidation = validateOperationStructure(operation);

      // Pre-validation should pass for known types
      expect(preValidation.isValid).toBe(true);
    }
  )
);
```

---

## Implementation Guidelines

### Schema Design Principles

#### 1. Use anyOf for Union Types

**Rule**: When data can match multiple valid structures (union types), use `anyOf`

**Example**:
```json
{
  "anyOf": [
    { "$ref": "#/$defs/MacroReference" },
    { "$ref": "#/$defs/Operation" }
  ]
}
```

**Rationale**:
- anyOf allows short-circuit validation (stops after first match)
- No error cascade from failed branches
- Better performance (O(k) vs O(n) where k = matching branches)

**When NOT to use anyOf**:
- When you need to validate EXACTLY one match (use oneOf)
- When order matters (use ordered validation instead)

#### 2. Use oneOf for Mutual Exclusivity

**Rule**: When data MUST match exactly one schema and you want to verify it's not ambiguous, use `oneOf`

**Example**:
```json
{
  "oneOf": [
    { "properties": { "foo": { "type": "string" } }, "required": ["foo"] },
    { "properties": { "bar": { "type": "number" } }, "required": ["bar"] }
  ]
}
```

**Rationale**:
- Validates data is unambiguous (matches exactly one schema)
- Useful for discriminated unions where overlap is an error
- Reports all failures to help identify ambiguity

**When NOT to use oneOf**:
- For simple union types (use anyOf instead)
- When error cascade is unacceptable
- When performance is critical

#### 3. Order anyOf Branches by Specificity

**Rule**: Place most specific schemas first, most general last

**Example**:
```json
{
  "anyOf": [
    { "$ref": "#/$defs/MacroReference" },  // More specific (requires "macro")
    { "$ref": "#/$defs/Operation" }         // More general (many subtypes)
  ]
}
```

**Rationale**:
- Fails fast for specific types (macro validates in 1 schema check)
- Reduces validation overhead (doesn't check 60+ operation types first)
- Better error messages (tries likely matches first)

#### 4. Document Schema Semantics

**Rule**: Always include description fields explaining schema purpose

**Example**:
```json
{
  "Action": {
    "description": "Represents either a concrete operation or a macro reference. This is the canonical definition for any item in an action sequence.",
    "anyOf": [...]
  }
}
```

**Rationale**:
- Improves maintainability (future developers understand intent)
- Helps with schema evolution (know what can change)
- Better error messages (descriptions appear in AJV errors)

### Pre-Validation Maintenance

#### 1. Keep KNOWN_OPERATION_TYPES Synchronized

**Rule**: Operation type whitelist MUST match registered handlers

**Location**: `src/utils/preValidationUtils.js` lines 32-94

**Current State**: 93 operation types registered

**Maintenance Workflow**:

1. **Adding New Operation**:
   ```javascript
   // Step 7 of operation registration (CLAUDE.md:421-504)
   // CRITICAL: Add to KNOWN_OPERATION_TYPES array

   export const KNOWN_OPERATION_TYPES = [
     // ... existing types ...
     'NEW_OPERATION_TYPE',  // Add here, alphabetically sorted
   ];
   ```

2. **Verification**:
   ```bash
   # Proposed npm script
   npm run validate:operation-types

   # Should check:
   # - All types in whitelist have handlers
   # - All handlers have types in whitelist
   # - Alphabetical order maintained
   ```

3. **Test Coverage**:
   ```javascript
   // tests/unit/utils/preValidationUtils.test.js
   it('should include all registered operation handlers', () => {
     const registeredHandlers = container.resolve('OperationHandlerRegistry').getAll();
     const whitelistedTypes = KNOWN_OPERATION_TYPES;

     registeredHandlers.forEach(handler => {
       expect(whitelistedTypes).toContain(handler.type);
     });
   });
   ```

**Consequences of Desynchronization**:
- ❌ Pre-validation fails for valid operations
- ❌ Error: "Unknown operation type: X"
- ❌ Mod loading fails even though handler exists

#### 2. Add Operation to Whitelist in Same PR

**Rule**: Handler registration and whitelist update MUST be atomic

**Git Best Practice**:
```bash
# Single commit for operation addition
git add src/logic/operationHandlers/newOperationHandler.js
git add src/utils/preValidationUtils.js
git add data/schemas/operations/newOperation.schema.json
git commit -m "Add NEW_OPERATION handler with schema and whitelist"
```

**PR Checklist**:
- [ ] Handler implemented
- [ ] Schema defined
- [ ] Whitelist updated (preValidationUtils.js)
- [ ] DI token defined
- [ ] Factory registered
- [ ] Handler mapped
- [ ] Tests added

#### 3. Use npm Script for Validation

**Proposed Script** (`package.json`):
```json
{
  "scripts": {
    "validate:operation-types": "node scripts/validateOperationTypes.js"
  }
}
```

**Script Implementation** (`scripts/validateOperationTypes.js`):
```javascript
import { KNOWN_OPERATION_TYPES } from '../src/utils/preValidationUtils.js';
import { getRegisteredOperationHandlers } from '../src/logic/operationRegistry.js';

const registered = getRegisteredOperationHandlers();
const whitelisted = new Set(KNOWN_OPERATION_TYPES);

// Check all registered handlers are whitelisted
const missing = registered.filter(type => !whitelisted.has(type));
if (missing.length > 0) {
  console.error(`❌ Missing from whitelist: ${missing.join(', ')}`);
  process.exit(1);
}

// Check all whitelisted types have handlers
const orphaned = [...whitelisted].filter(type => !registered.includes(type));
if (orphaned.length > 0) {
  console.error(`❌ Whitelisted but no handler: ${orphaned.join(', ')}`);
  process.exit(1);
}

// Check alphabetical order
const sorted = [...KNOWN_OPERATION_TYPES].sort();
if (JSON.stringify(sorted) !== JSON.stringify(KNOWN_OPERATION_TYPES)) {
  console.error(`❌ Whitelist not alphabetically sorted`);
  process.exit(1);
}

console.log(`✅ All ${registered.length} operation types validated`);
```

**Usage in CI**:
```yaml
# .github/workflows/validate.yml
- name: Validate Operation Types
  run: npm run validate:operation-types
```

### Error Formatter Enhancement

#### 1. Detect Common Patterns Before Formatting

**Rule**: Check for known issues before detailed formatting

**Implementation** (`ajvAnyOfErrorFormatter.js`):

```javascript
export function formatAjvErrorsEnhanced(errors, data) {
  if (!errors || errors.length === 0) {
    return 'No validation errors';
  }

  // Pattern 1: entity_id vs entity_ref
  if (errors.some(e => e.params?.additionalProperty === 'entity_id')) {
    return formatEntityIdTypo(errors, data);
  }

  // Pattern 2: Missing type field
  if (!data?.type && !data?.macro && errors.length > 50) {
    return formatMissingTypeField(errors, data);
  }

  // Pattern 3: Invalid enum value
  const enumError = errors.find(e => e.keyword === 'enum');
  if (enumError) {
    return formatEnumError(enumError, data);
  }

  // Default: Intelligent anyOf formatting
  return formatAnyOfErrors(errors, data);
}
```

**Benefits**:
- Faster error detection (pattern matching vs full formatting)
- More relevant error messages (targeted to specific issues)
- Better user experience (clear fix guidance)

#### 2. Provide Actionable Fix Suggestions

**Rule**: Every error message includes at least one fix suggestion

**Examples**:

**Missing Type Error**:
```
Missing operation type - this operation needs a "type" field.

For regular operations, use:
  {"type": "OPERATION_NAME", "parameters": {...}}

For macro references, use:
  {"macro": "namespace:macroId"}

Common operation types:
  - QUERY_COMPONENT
  - MODIFY_COMPONENT
  - SET_VARIABLE
```

**entity_id Typo Error**:
```
Operation type 'GET_NAME' has invalid parameters:
  - /parameters: Unexpected property 'entity_id'

Common issue detected: "entity_id" should be "entity_ref"
The GET_NAME operation expects "entity_ref", not "entity_id"
```

**Enum Error**:
```
Invalid enum value 'INVALID_TYPE'. Allowed values: [TYPE_A, TYPE_B, TYPE_C]

💡 FIX: Add "INVALID_TYPE" to the enum in:
  data/schemas/operations/operationName.schema.json
  Look for the "fieldName" enum array and add your value.
```

#### 3. Group Related Errors

**Rule**: Combine errors by operation type or schema branch

**Implementation**:
```javascript
function groupErrorsByOperationType(errors) {
  const grouped = new Map();

  errors.forEach((error) => {
    const anyOfMatch = error.schemaPath.match(/#\/anyOf\/([0-9]+)\//);
    if (anyOfMatch) {
      const branchIndex = anyOfMatch[1];
      if (!grouped.has(branchIndex)) {
        grouped.set(branchIndex, []);
      }
      grouped.get(branchIndex).push(error);
    }
  });

  return grouped;
}
```

**Output**:
```
Operation type 'QUERY_COMPONENT' validation failed:
  - /parameters: Missing required property 'entity_ref'
  - /parameters: Missing required property 'output_var'
```

Instead of:
```
Error 1: Missing required property 'entity_ref'
Error 2: Missing required property 'output_var'
Error 3: oneOf validation failed
Error 4: anyOf branch 0 failed
...
```

#### 4. Limit Error Verbosity

**Rule**: Show maximum 5 errors per category, indicate if more exist

**Implementation**:
```javascript
function formatOperationErrors(errors) {
  const MAX_ERRORS = 5;
  const lines = [`Operation validation failed:`];

  const paramErrors = errors
    .filter(e => e.instancePath.includes('/parameters'))
    .slice(0, MAX_ERRORS);

  paramErrors.forEach(error => {
    lines.push(`  - ${error.instancePath}: ${formatSingleError(error)}`);
  });

  if (errors.length > MAX_ERRORS) {
    lines.push(`  ... and ${errors.length - MAX_ERRORS} more errors`);
  }

  return lines.join('\n');
}
```

**Benefits**:
- Prevents overwhelming error output (not 322 errors)
- Highlights most important errors first
- Still indicates total error count for awareness

### Macro System Guidelines

#### 1. Validate Before Expansion

**Rule**: Always validate macro reference structure before attempting expansion

**Workflow**:
```
1. Pre-validate: Check structure (has "macro" field)
2. AJV validate: Check macro ID format (namespacedId pattern)
3. Expand: Fetch macro definition and substitute
4. Post-validate: Validate expanded operations
```

**Implementation** (`macroUtils.js`):
```javascript
export function expandMacros(actions, macroRegistry, options = {}) {
  const errors = [];

  // Step 1: Pre-validate all macro references
  for (const action of actions) {
    if (action.macro) {
      const validation = validateMacroReference(action);
      if (!validation.valid) {
        errors.push(validation.error);
        continue;
      }
    }
  }

  if (errors.length > 0) {
    return { expanded: [], errors };
  }

  // Step 2: Expand macros
  const expanded = expandRecursively(actions, macroRegistry, options);

  // Step 3: Post-validate expanded operations
  for (const operation of expanded) {
    const validation = validateOperationStructure(operation);
    if (!validation.isValid) {
      errors.push(validation.error);
    }
  }

  return { expanded, errors };
}
```

#### 2. Expand Recursively with Cycle Detection

**Rule**: Support nested macros up to max depth 10, detect cycles

**Implementation**:
```javascript
function expandRecursively(actions, macroRegistry, options, depth = 0) {
  const MAX_DEPTH = 10;
  const genealogy = options.genealogy || [];

  if (depth > MAX_DEPTH) {
    throw new Error(`Max macro expansion depth (${MAX_DEPTH}) exceeded. Possible circular reference.`);
  }

  const expanded = [];

  for (const action of actions) {
    if (action.macro) {
      // Check for circular reference
      if (genealogy.includes(action.macro)) {
        throw new Error(`Circular macro reference detected: ${genealogy.join(' → ')} → ${action.macro}`);
      }

      // Fetch and expand macro
      const macroDef = macroRegistry.get(action.macro);
      if (!macroDef) {
        throw new Error(`Macro '${action.macro}' not found in registry`);
      }

      // Recursive expansion
      const childActions = expandRecursively(
        macroDef.actions,
        macroRegistry,
        { genealogy: [...genealogy, action.macro] },
        depth + 1
      );

      expanded.push(...childActions);
    } else {
      expanded.push(action);
    }
  }

  return expanded;
}
```

**Benefits**:
- Supports arbitrary nesting (limited by max depth)
- Detects circular references early
- Provides clear genealogy for debugging

#### 3. Track Expansion Genealogy

**Rule**: Maintain parent-child relationships for debugging

**Data Structure**:
```javascript
{
  originalAction: { macro: 'custom:macroA' },
  expanded: [
    { type: 'LOG', parameters: {...}, source: 'custom:macroA' },
    { type: 'END_TURN', parameters: {...}, source: 'custom:macroA' }
  ],
  genealogy: ['custom:macroA'],
  depth: 1
}
```

**Usage in Error Messages**:
```
Macro expansion failed at depth 3:
  custom:workflowA → custom:workflowB → custom:workflowC
  Error: Macro 'custom:nonexistent' not found in registry
```

#### 4. Cache Expanded Macros

**Rule**: Cache macro expansion results for performance

**Implementation**:
```javascript
const expansionCache = new Map();

function expandMacrosWithCache(actions, macroRegistry) {
  const cacheKey = JSON.stringify(actions);

  if (expansionCache.has(cacheKey)) {
    return expansionCache.get(cacheKey);
  }

  const result = expandMacros(actions, macroRegistry);
  expansionCache.set(cacheKey, result);

  return result;
}
```

**Cache Invalidation**:
```javascript
// Clear cache when macros are modified
macroRegistry.on('macro:updated', (macroId) => {
  expansionCache.clear(); // Simple: clear all
  // Or: Invalidate only affected expansions
});
```

**Benefits**:
- Faster validation for repeated rule loads
- Reduced computational overhead
- Better performance in hot paths (rule re-validation)

---

## Conclusion

This specification establishes robust guidelines for the JSON schema validation system to prevent future failures similar to the oneOf → anyOf issue. By following these principles, maintaining synchronization between components, and implementing comprehensive testing, we ensure:

1. **No False-Positive Errors**: anyOf prevents error cascades for valid macro references
2. **Clear Error Messages**: Users receive actionable guidance for fixing validation errors
3. **Maintainable System**: Whitelist synchronization and testing prevent configuration drift
4. **Extensible Architecture**: New operations can be added safely following documented patterns
5. **Performance**: Validation remains fast even with 100+ operation types

**Next Steps**:
1. Implement proposed validation script (`npm run validate:operation-types`)
2. Add regression tests for oneOf → anyOf fix
3. Add property-based tests for action validation
4. Update documentation with new patterns
5. Train team on operation addition workflow

---

**Document History**:
- 2025-01-22: Initial version (1.0) - Created after oneOf → anyOf fix
