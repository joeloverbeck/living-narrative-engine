# Schema Validation Robustness & Test Integration Specification

**Version**: 1.0
**Date**: 2025-11-26
**Status**: Draft
**Related Issues**: LOCK_GRABBING/UNLOCK_GRABBING template string validation failures, corePromptText.json field drift

---

## Table of Contents

1. [Context](#1-context)
   - 1.1 [Location in Codebase](#11-location-in-codebase)
   - 1.2 [What This Module Does](#12-what-this-module-does)
   - 1.3 [Architecture Overview](#13-architecture-overview)
2. [Problem](#2-problem)
   - 2.1 [What Failed](#21-what-failed)
   - 2.2 [How It Failed](#22-how-it-failed)
   - 2.3 [Why It Failed (Root Causes)](#23-why-it-failed-root-causes)
   - 2.4 [Link to Tests](#24-link-to-tests)
3. [Truth Sources](#3-truth-sources)
4. [Desired Behavior](#4-desired-behavior)
   - 4.1 [Normal Cases](#41-normal-cases)
   - 4.2 [Edge Cases](#42-edge-cases)
   - 4.3 [Failure Modes](#43-failure-modes)
5. [Invariants](#5-invariants)
6. [API Contracts](#6-api-contracts)
   - 6.1 [What Stays Stable](#61-what-stays-stable)
   - 6.2 [What Is Allowed to Change](#62-what-is-allowed-to-change)
7. [Testing Plan](#7-testing-plan)
   - 7.1 [Tests to Add](#71-tests-to-add)
   - 7.2 [Tests to Update](#72-tests-to-update)
   - 7.3 [Regression Tests](#73-regression-tests)
   - 7.4 [Property Tests](#74-property-tests-optional)
8. [Implementation Phases](#8-implementation-phases)
9. [Critical Files](#9-critical-files)
10. [Appendix A: Current Validation Flow](#appendix-a-current-validation-flow)
11. [Appendix B: Template String Pattern Reference](#appendix-b-template-string-pattern-reference)

---

## 1. Context

### 1.1 Location in Codebase

| Component              | Path                                        | Purpose                                                            |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Schema Validation Core | `src/validation/ajvSchemaValidator.js`      | Two-stage AJV validation (standard + generated validators)         |
| Pre-Validation Engine  | `src/utils/preValidationUtils.js`           | Fail-fast checks, KNOWN_OPERATION_TYPES whitelist, parameter rules |
| Schema Definitions     | `data/schemas/`                             | 120+ JSON Schema files (Draft 07)                                  |
| Operation Schemas      | `data/schemas/operations/`                  | 62 operation-specific schemas                                      |
| Test Infrastructure    | `tests/common/mods/ModTestFixture.js`       | Mod testing factory (~1600 lines)                                  |
| Test Environment       | `tests/common/engine/systemLogicTestEnv.js` | Rule test environment setup                                        |
| Integration Test Bed   | `tests/common/integrationTestBed.js`        | Full DI container for integration tests                            |
| Error Formatting       | `src/utils/ajvAnyOfErrorFormatter.js`       | AJV error message formatting                                       |
| Schema Loading         | `src/loaders/schemaLoader.js`               | Batch schema loading and compilation                               |

### 1.2 What This Module Does

The schema validation system enforces structural correctness of mod content (rules, actions, components, entities) at load time. It provides:

- **Pre-validation**: Fast whitelist checks for operation types, required field validation, common mistake detection
- **AJV validation**: Full JSON Schema Draft 07 compliance with cross-schema `$ref` resolution
- **Generated validators**: Optional enhanced validation with better error messages for component schemas
- **Error formatting**: Human-readable validation error messages with suggestions

### 1.3 Architecture Overview

```
Content File Loading Flow
=========================

BaseManifestItemLoader._processFileWrapper()
    │
    ├── 1. RESOLVE PATH
    │      resolveContentPath(modId, diskFolder, filename)
    │
    ├── 2. FETCH & PARSE
    │      fetchContent(path) → JSON.parse()
    │
    ├── 3. PRE-VALIDATION (rules only)
    │      performPreValidation(data, schemaId, filePath)
    │      │
    │      └── validateRuleStructure()
    │          ├── Check: event_type exists
    │          ├── Check: actions exists and is non-empty
    │          └── validateAllOperations() [RECURSIVE]
    │              ├── Check: type in KNOWN_OPERATION_TYPES
    │              ├── Check: validateOperationParameters()
    │              └── Recurse into nested operations
    │
    ├── 4. AJV VALIDATION
    │      validator.validate(schemaId, data)
    │      │
    │      └── AjvSchemaValidator.validate()
    │          ├── Stage 1: Standard AJV validation
    │          └── Stage 2: Generated validator (optional)
    │
    └── 5. PROCESS & STORE
           _processFetchedItem() → registry
```

```
Test Infrastructure Flow (CURRENT - PROBLEMATIC)
================================================

ModTestFixture.forAction(modId, actionId)
    │
    ├── Load rule file from disk
    │      fs.readFile() → JSON.parse()
    │      ⚠️ NO SCHEMA VALIDATION
    │
    ├── Load condition file
    │      fs.readFile() → JSON.parse()
    │      ⚠️ NO SCHEMA VALIDATION
    │
    ├── createActionValidationProxy()
    │      ⚠️ Only checks property names, NOT schema compliance
    │
    └── setupEnvironment()
           ⚠️ Passes unvalidated data to rule engine
```

---

## 2. Problem

### 2.1 What Failed

Two categories of runtime errors occurred when loading the game through `game.html`:

1. **LOCK_GRABBING/UNLOCK_GRABBING Operations**
   - Error: "Unknown or invalid operation type" with empty valid types list
   - Files: `data/mods/weapons/rules/handle_wield_threateningly.rule.json`, `handle_unwield_item.rule.json`

2. **corePromptText.json Validation**
   - Error: AJV validation failure due to extra field
   - File: `data/prompts/corePromptText.json`

### 2.2 How It Failed

**Case 1: Template String Type Mismatch**

The schema defined `count` parameter as strict integer:

```json
// data/schemas/operations/lockGrabbing.schema.json (BEFORE FIX)
"count": {
  "type": "integer",
  "minimum": 1
}
```

But rule files use template strings for dynamic values:

```json
// data/mods/weapons/rules/handle_wield_threateningly.rule.json
{
  "type": "LOCK_GRABBING",
  "parameters": {
    "actor_id": "{event.payload.actorId}",
    "count": "{context.targetGrabbingReqs.handsRequired}", // ← STRING at validation time
    "item_id": "{event.payload.targetId}"
  }
}
```

At schema validation time (before template interpolation), `"{context.targetGrabbingReqs.handsRequired}"` is a **string**, not an integer. AJV validation fails because no `anyOf` branch in `operation.schema.json` matches, producing the confusing "Unknown or invalid operation type" error.

**Case 2: Schema-Code Field Drift**

Production code accesses a field not defined in the schema:

```javascript
// src/prompting/promptDataFormatter.js
const actionTagRules = promptTextData.actionTagRulesContent; // ← Field used in code
```

```json
// data/schemas/prompt-text.schema.json (BEFORE FIX)
{
  "properties": {
    "coreTaskDescriptionText": { "type": "string" },
    "characterPortrayalGuidelinesTemplate": { "type": "string" },
    "nc21ContentPolicyText": { "type": "string" },
    "finalLlmInstructionText": { "type": "string" }
    // ⚠️ actionTagRulesContent MISSING
  },
  "additionalProperties": false // ← Strict mode rejects extra fields
}
```

### 2.3 Why It Failed (Root Causes)

| Root Cause                                            | Impact                                       | Severity | Evidence                                                    |
| ----------------------------------------------------- | -------------------------------------------- | -------- | ----------------------------------------------------------- |
| **ModTestFixture bypasses schema validation**         | Invalid mod data passes all tests            | CRITICAL | `ModTestFixture.js:180-200` - JSON parsed but not validated |
| **IntegrationTestBed mocks schema validator**         | Integration tests skip real validation       | HIGH     | `integrationTestBed.js:380` - registers test-only schemas   |
| **Template strings not natively supported**           | Each operation reinvents oneOf pattern       | MEDIUM   | Only `lockGrabbing.schema.json` has pattern                 |
| **Only 4 of 62 operations have pre-validation rules** | Most operations have no parameter validation | MEDIUM   | `preValidationUtils.js:220-248` - OPERATION_PARAMETER_RULES |
| **Error messages lack context**                       | Hard to debug validation failures            | LOW      | No rule ID, line numbers, or code snippets                  |

**Why Tests Didn't Catch This:**

1. `ModTestFixture.forAction()` loads files directly from disk and calls `createActionValidationProxy()` which only checks:
   - Property names exist
   - Required fields present
   - ID format correct
   - **Does NOT** validate against actual JSON schemas

2. `IntegrationTestBed.initialize()` mocks the schema validator and registers simplified test-only schemas, not the real project schemas.

3. The validation test suite (`tests/unit/validation/`, `tests/integration/validation/`) thoroughly tests the validation system itself but is completely isolated from mod action/rule testing.

### 2.4 Link to Tests

The following tests were created to reproduce and verify the fixes:

- `tests/integration/mods/weapons/wield_grabbing_schema_validation.test.js` - Validates LOCK_GRABBING/UNLOCK_GRABBING with template strings
- `tests/integration/validation/corePromptTextValidation.test.js` - Validates corePromptText.json against its schema

---

## 3. Truth Sources

| Source                         | Location                                                            | Authority                   | Notes                                 |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------- | ------------------------------------- |
| JSON Schema Draft 07           | https://json-schema.org/draft-07/schema                             | Schema syntax specification | Defines valid schema keywords         |
| AJV Documentation              | https://ajv.js.org/                                                 | Validation behavior         | v8.x used in project                  |
| CLAUDE.md                      | Project root                                                        | Project conventions         | See "Adding New Operations" checklist |
| Existing oneOf Pattern         | `data/schemas/operations/lockGrabbing.schema.json:24-28`            | Template string pattern     | Reference implementation              |
| Pre-validation Whitelist       | `src/utils/preValidationUtils.js:KNOWN_OPERATION_TYPES`             | Valid operation types       | 62 registered types                   |
| Operation Handler Registration | `src/dependencyInjection/registrations/interpreterRegistrations.js` | Runtime type mapping        | Must match schema `const`             |

---

## 4. Desired Behavior

### 4.1 Normal Cases

1. **ModTestFixture validates against schemas before test execution**

   ```javascript
   // DESIRED: forAction() validates rule file
   const fixture = await ModTestFixture.forAction(
     'weapons',
     'weapons:wield_threateningly'
   );
   // → Throws ValidationError if rule violates schema
   // → Test fails immediately with clear error message
   ```

2. **Template strings accepted via shared definition**

   ```json
   // data/schemas/common.schema.json
   {
     "definitions": {
       "templateString": {
         "type": "string",
         "pattern": "^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$"
       },
       "integerOrTemplate": {
         "oneOf": [
           { "type": "integer", "minimum": 1 },
           { "$ref": "#/definitions/templateString" }
         ]
       }
     }
   }

   // data/schemas/operations/lockGrabbing.schema.json
   "count": {
     "$ref": "../common.schema.json#/definitions/integerOrTemplate"
   }
   ```

3. **All operations have generated parameter validation rules**

   ```javascript
   // Auto-generated from schemas at startup
   OPERATION_PARAMETER_RULES = {
     LOCK_GRABBING: {
       required: ['actor_id', 'count'],
       templateFields: ['count', 'actor_id', 'item_id'],
     },
     UNLOCK_GRABBING: {
       required: ['actor_id', 'count'],
       templateFields: ['count', 'actor_id', 'item_id'],
     },
     // ... all 62 operations
   };
   ```

4. **Error messages include full context**

   ```
   Validation Error in rule "handle_wield_threateningly"
     File: data/mods/weapons/rules/handle_wield_threateningly.rule.json
     Line: 23

     Context:
       21 |       {
       22 |         "type": "LOCK_GRABBING",
     > 23 |         "parameters": { "count": "invalid" }
       24 |       }

     Error: "count" must be integer or template string (e.g., "{context.value}")
     Path: /actions/2/parameters/count
   ```

### 4.2 Edge Cases

| Input                                | Expected Behavior                                       |
| ------------------------------------ | ------------------------------------------------------- |
| Empty template `"{}"`                | Rejected: "Template string cannot be empty"             |
| Nested braces `"{{x}}"`              | Rejected: "Invalid template syntax"                     |
| Spaces in template `"{ context.x }"` | Rejected: "Template must not contain spaces"            |
| Unknown operation `"LOCK_GRABB"`     | Rejected with suggestion: "Did you mean LOCK_GRABBING?" |
| Missing required param               | Rejected: "Missing required parameter 'actor_id'"       |
| Extra unknown param                  | Warning (not error): "Unknown parameter 'foo' ignored"  |

### 4.3 Failure Modes

| Failure                         | Expected Error                              | Severity | Recovery Action                   |
| ------------------------------- | ------------------------------------------- | -------- | --------------------------------- |
| Invalid rule in test            | `ValidationError` thrown, test fails        | CRITICAL | Fix rule JSON before test can run |
| Unknown operation type          | List similar types via Levenshtein distance | HIGH     | Use suggested type                |
| Missing required param          | Show rule context + line number             | HIGH     | Add missing parameter             |
| Schema $ref not found           | Validation skipped with warning             | MEDIUM   | Fix schema reference              |
| Template resolves to wrong type | Runtime warning (not validation error)      | LOW      | Fix context data setup            |

---

## 5. Invariants

### INV-1: Test-Schema Coupling Invariant

```
For all tests t using ModTestFixture:
  ruleFile is validated against schema://living-narrative-engine/rule.schema.json
  AND conditionFile is validated against schema://living-narrative-engine/condition.schema.json
  BEFORE test execution begins
```

**Enforcement Point**: `ModTestFixture.forAction()`, `ModTestFixture.forRule()`

**Current Violation**: `ModTestFixture.js:180-200` loads files without validation

### INV-2: Template Pattern Consistency Invariant

```
For all operation schemas with integer-or-template parameters:
  parameter definition uses $ref to common.schema.json#/definitions/integerOrTemplate
  (NOT a local oneOf definition)
```

**Enforcement Point**: Schema linting (new script)

**Current Violation**: `lockGrabbing.schema.json` and `unlockGrabbing.schema.json` use local oneOf

### INV-3: Parameter Coverage Invariant

```
|OPERATION_PARAMETER_RULES| >= |KNOWN_OPERATION_TYPES|
(Every known operation type has parameter validation rules)
```

**Enforcement Point**: Startup assertion in `preValidationUtils.js`

**Current Violation**: Only 4 of 62 operations have rules

### INV-4: CI Validation Gate Invariant

```
For all PRs merged to main:
  npm run validate:strict passes
  AND npm run validate:operations passes
  BEFORE any test job runs
```

**Enforcement Point**: `.github/workflows/tests.yml`

**Current Violation**: No validation-gate job exists

### INV-5: Schema-Code Field Correspondence Invariant

```
For all fields f accessed from JSON data files in production code:
  f exists in corresponding schema properties
  OR f is allowed by additionalProperties
```

**Enforcement Point**: ESLint rule (new)

**Current Violation**: `actionTagRulesContent` accessed but was not in schema

---

## 6. API Contracts

### 6.1 What Stays Stable

These interfaces MUST NOT change without major version bump:

```javascript
// Schema validation entry point
validateAgainstSchema(validator, schemaId, data, logger, context)
// Returns: void (throws on failure)

// Pre-validation entry point
performPreValidation(data, schemaId, filePath)
// Returns: { isValid: boolean, error?: string, path?: string, suggestions?: string[] }

// Schema IDs (all existing IDs remain valid)
'schema://living-narrative-engine/rule.schema.json'
'schema://living-narrative-engine/action.schema.json'
'schema://living-narrative-engine/operation.schema.json'
// etc.

// ModTestFixture factory methods (signature stable, behavior changes)
ModTestFixture.forAction(modId, actionId, options?)
ModTestFixture.forRule(modId, ruleId, options?)
```

### 6.2 What Is Allowed to Change

These may change without breaking compatibility:

- `OPERATION_PARAMETER_RULES` object contents (will be auto-generated)
- Error message text and format (will include more context)
- `common.schema.json` definitions (will add templateString types)
- Pre-validation internal implementation
- ModTestFixture internal validation logic

---

## 7. Testing Plan

### 7.1 Tests to Add

| Test File                                                       | Purpose                                         | Priority |
| --------------------------------------------------------------- | ----------------------------------------------- | -------- |
| `tests/integration/validation/schemaTestIntegration.test.js`    | Verify ModTestFixture validates against schemas | CRITICAL |
| `tests/unit/utils/parameterRuleGenerator.test.js`               | Test auto-generation of parameter rules         | HIGH     |
| `tests/unit/utils/suggestionUtils.test.js`                      | Test "Did you mean?" Levenshtein matching       | MEDIUM   |
| `tests/unit/validation/validationErrorContext.test.js`          | Test error context with line numbers            | MEDIUM   |
| `tests/integration/validation/templateStringValidation.test.js` | Test template string pattern validation         | HIGH     |

### 7.2 Tests to Update

| Test File                                   | Required Change                                     |
| ------------------------------------------- | --------------------------------------------------- |
| `tests/common/mods/ModTestFixture.js`       | Add schema validation in `forAction()`, `forRule()` |
| `tests/common/engine/systemLogicTestEnv.js` | Inject real schema validator dependency             |
| `tests/common/integrationTestBed.js`        | Option to use real schemas instead of mocks         |

### 7.3 Regression Tests

```javascript
/**
 * @file tests/integration/validation/schemaValidationRegression.test.js
 * Prevents recurrence of LOCK_GRABBING and corePromptText failures
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { readFile } from 'fs/promises';

describe('Schema Validation Regression Prevention', () => {
  let testBed;
  let schemaValidator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    schemaValidator = testBed.container.resolve('ISchemaValidator');
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  describe('LOCK_GRABBING Operation', () => {
    it('should accept integer count parameter', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: 2, item_id: 'item' },
      };

      expect(() => {
        schemaValidator.validateAgainstSchema(
          operation,
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
        );
      }).not.toThrow();
    });

    it('should accept template string count parameter', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: {
          actor_id: '{event.payload.actorId}',
          count: '{context.targetGrabbingReqs.handsRequired}',
          item_id: '{event.payload.targetId}',
        },
      };

      expect(() => {
        schemaValidator.validateAgainstSchema(
          operation,
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
        );
      }).not.toThrow();
    });

    it('should reject non-template string count parameter', () => {
      const operation = {
        type: 'LOCK_GRABBING',
        parameters: { actor_id: 'test', count: 'two', item_id: 'item' },
      };

      expect(() => {
        schemaValidator.validateAgainstSchema(
          operation,
          'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
        );
      }).toThrow();
    });
  });

  describe('corePromptText.json', () => {
    it('should validate against prompt-text schema', async () => {
      const content = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const data = JSON.parse(content);

      expect(() => {
        schemaValidator.validateAgainstSchema(
          data,
          'schema://living-narrative-engine/prompt-text.schema.json'
        );
      }).not.toThrow();
    });

    it('should contain actionTagRulesContent field', async () => {
      const content = await readFile(
        'data/prompts/corePromptText.json',
        'utf8'
      );
      const data = JSON.parse(content);

      expect(data).toHaveProperty('actionTagRulesContent');
      expect(typeof data.actionTagRulesContent).toBe('string');
    });
  });
});
```

### 7.4 Property Tests (Optional)

```javascript
/**
 * @file tests/property/templateStringResolution.property.test.js
 * Property-based tests for template string type resolution
 */

import fc from 'fast-check';

describe('Template String Type Resolution Properties', () => {
  it('should resolve integer templates to integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (intValue) => {
        const context = { handsRequired: intValue };
        const resolved = resolveTemplateString(
          '{context.handsRequired}',
          context
        );
        return typeof resolved === 'number' && Number.isInteger(resolved);
      })
    );
  });

  it('should preserve string values for string templates', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (strValue) => {
        const context = { message: strValue };
        const resolved = resolveTemplateString('{context.message}', context);
        return typeof resolved === 'string' && resolved === strValue;
      })
    );
  });

  it('should return undefined for missing context paths', () => {
    fc.assert(
      fc.property(fc.constantFrom('foo', 'bar', 'baz'), (missingKey) => {
        const context = {};
        const resolved = resolveTemplateString(
          `{context.${missingKey}}`,
          context
        );
        return resolved === undefined;
      })
    );
  });
});
```

---

## 8. Implementation Phases

### Phase 1: CRITICAL - Fail-Fast in Test Infrastructure

**Goal**: Prevent invalid mod data from passing tests

**Tasks**:

- [ ] Modify `ModTestFixture.forAction()` to validate rules against schema before test setup
- [ ] Modify `ModTestFixture.forRule()` to validate rules against schema before test setup
- [ ] Add optional `skipValidation` flag for debugging (default: `false`)
- [ ] Add schema validator injection to `createRuleTestEnvironment()`
- [ ] Update `IntegrationTestBed` to optionally use real schemas

**Files**:

- `tests/common/mods/ModTestFixture.js`
- `tests/common/engine/systemLogicTestEnv.js`
- `tests/common/integrationTestBed.js`

**Acceptance Criteria**:

- Running existing mod tests with invalid rule files causes immediate test failure
- Validation errors include file path and rule ID

### Phase 2: HIGH - CI Validation Gate

**Goal**: Block PRs with validation failures before tests run

**Tasks**:

- [ ] Add `validation-gate` job to `.github/workflows/tests.yml`
- [ ] Run `npm run validate:strict` as first step
- [ ] Run `npm run validate:operations` to verify operation registration
- [ ] Make all test jobs depend on validation-gate passing

**Files**:

- `.github/workflows/tests.yml`

**Acceptance Criteria**:

- PRs with invalid schemas fail in CI before tests run
- Clear error message indicates which validation failed

### Phase 3: MEDIUM - Template String Standardization

**Goal**: Single source of truth for template string patterns

**Tasks**:

- [ ] Add `templateString` definition to `common.schema.json`
- [ ] Add `integerOrTemplate`, `stringOrTemplate` composite definitions
- [ ] Update `lockGrabbing.schema.json` to use `$ref` to common
- [ ] Update `unlockGrabbing.schema.json` to use `$ref` to common
- [ ] Create linting script to detect local oneOf patterns

**Files**:

- `data/schemas/common.schema.json`
- `data/schemas/operations/lockGrabbing.schema.json`
- `data/schemas/operations/unlockGrabbing.schema.json`
- `scripts/lintSchemaPatterns.js` (new)

**Acceptance Criteria**:

- All template-accepting parameters use shared definitions
- Linting script flags local oneOf patterns

### Phase 4: MEDIUM - Parameter Rule Auto-Generation

**Goal**: Every operation has parameter validation rules

**Tasks**:

- [ ] Create `src/utils/parameterRuleGenerator.js`
- [ ] Generate rules from schema `required` and `properties`
- [ ] Detect common mistakes (entity_id vs entity_ref)
- [ ] Integrate with `preValidationUtils.js` at startup
- [ ] Add startup assertion for coverage invariant

**Files**:

- `src/utils/parameterRuleGenerator.js` (new)
- `src/utils/preValidationUtils.js`

**Acceptance Criteria**:

- All 62 operations have generated parameter rules
- Startup fails if any operation lacks rules

### Phase 5: LOW - Enhanced Error Messages

**Goal**: Validation errors include full context for debugging

**Tasks**:

- [ ] Create `src/validation/validationErrorContext.js` for rich error formatting
- [ ] Add line number extraction from JSON path
- [ ] Add code snippet generation
- [ ] Create `src/utils/suggestionUtils.js` for "Did you mean?" matching
- [ ] Integrate with `ajvAnyOfErrorFormatter.js`

**Files**:

- `src/validation/validationErrorContext.js` (new)
- `src/utils/suggestionUtils.js` (new)
- `src/utils/ajvAnyOfErrorFormatter.js`

**Acceptance Criteria**:

- Validation errors show file path, line number, and code snippet
- Unknown operation types suggest similar valid types

---

## 9. Critical Files

| File                                                 | Type   | Purpose                                  |
| ---------------------------------------------------- | ------ | ---------------------------------------- |
| `tests/common/mods/ModTestFixture.js`                | Modify | Add schema validation in factory methods |
| `tests/common/engine/systemLogicTestEnv.js`          | Modify | Inject schema validator dependency       |
| `tests/common/integrationTestBed.js`                 | Modify | Option for real schema validation        |
| `data/schemas/common.schema.json`                    | Modify | Add templateString definitions           |
| `data/schemas/operations/lockGrabbing.schema.json`   | Modify | Use $ref to common                       |
| `data/schemas/operations/unlockGrabbing.schema.json` | Modify | Use $ref to common                       |
| `src/utils/preValidationUtils.js`                    | Modify | Integrate auto-generated rules           |
| `.github/workflows/tests.yml`                        | Modify | Add validation-gate job                  |
| `src/utils/parameterRuleGenerator.js`                | Create | Auto-generate parameter rules            |
| `src/utils/suggestionUtils.js`                       | Create | "Did you mean?" suggestions              |
| `src/validation/validationErrorContext.js`           | Create | Rich error context                       |
| `scripts/lintSchemaPatterns.js`                      | Create | Detect local oneOf patterns              |

---

## Appendix A: Current Validation Flow

```
PRODUCTION FLOW (Works Correctly)
=================================

game.html loads
    │
    ├── SchemaPhase.execute()
    │      SchemaLoader.loadAndCompileAllSchemas()
    │      → 120+ schemas registered with AJV
    │
    ├── ContentPhase.execute()
    │      BaseManifestItemLoader._processFileWrapper()
    │      │
    │      ├── performPreValidation() ← Rules only
    │      │   └── validateOperationStructure()
    │      │       └── Check type in KNOWN_OPERATION_TYPES
    │      │
    │      └── validator.validate(schemaId, data) ← AJV
    │          └── Validates against full schema
    │
    └── ✅ Invalid content rejected at load time


TEST FLOW (BROKEN)
==================

jest runs test file
    │
    ├── ModTestFixture.forAction('weapons', 'weapons:wield_threateningly')
    │      │
    │      ├── fs.readFile(rulePath) → JSON.parse()
    │      │   ⚠️ NO SCHEMA VALIDATION
    │      │
    │      ├── createActionValidationProxy(parsed)
    │      │   ⚠️ Only checks property names exist
    │      │
    │      └── setupEnvironment(ruleFile, conditionFile)
    │          ⚠️ Passes unvalidated data to rule engine
    │
    └── ❌ Invalid content accepted, runtime errors only
```

---

## Appendix B: Template String Pattern Reference

### Valid Template String Syntax

```
Pattern: ^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$

Valid Examples:
  {context.value}
  {event.payload.actorId}
  {context.targetGrabbingReqs.handsRequired}
  {actor_stats.strength}

Invalid Examples:
  {}                    # Empty
  { context.value }     # Spaces
  {{context.value}}     # Double braces
  {context.}            # Trailing dot
  {.value}              # Leading dot
  {123abc}              # Starts with number
  {context-value}       # Hyphen not allowed
```

### Schema Definition for Template Strings

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/common.schema.json",
  "definitions": {
    "templateString": {
      "description": "A runtime template string resolved at execution. Format: {path.to.value}",
      "type": "string",
      "pattern": "^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$"
    },
    "integerOrTemplate": {
      "description": "Either a literal integer or a template string that resolves to integer at runtime",
      "oneOf": [
        { "type": "integer", "minimum": 1 },
        { "$ref": "#/definitions/templateString" }
      ]
    },
    "stringOrTemplate": {
      "description": "Either a literal string or a template string",
      "oneOf": [
        {
          "type": "string",
          "minLength": 1,
          "not": { "pattern": "^\\{.*\\}$" }
        },
        { "$ref": "#/definitions/templateString" }
      ]
    },
    "booleanOrTemplate": {
      "description": "Either a literal boolean or a template string that resolves to boolean at runtime",
      "oneOf": [
        { "type": "boolean" },
        { "$ref": "#/definitions/templateString" }
      ]
    }
  }
}
```

### Usage in Operation Schemas

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/lockGrabbing.schema.json",
  "title": "LOCK_GRABBING Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "LOCK_GRABBING" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_id": { "type": "string" },
            "count": {
              "$ref": "../common.schema.json#/definitions/integerOrTemplate"
            },
            "item_id": { "type": "string" }
          },
          "required": ["actor_id", "count"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```
