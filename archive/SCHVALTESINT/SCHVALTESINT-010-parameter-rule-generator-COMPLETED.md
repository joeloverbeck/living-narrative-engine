# SCHVALTESINT-010: Create parameterRuleGenerator.js

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: MEDIUM
**Phase**: 4 - Parameter Rule Auto-Generation
**Dependencies**: None (can proceed in parallel with Phase 3)
**Blocks**: SCHVALTESINT-011

---

## Objective

Create `parameterRuleGenerator.js` that automatically generates parameter validation rules from operation schemas, eliminating the need to manually maintain `OPERATION_PARAMETER_RULES` in `preValidationUtils.js`.

## File List

### Files to Create

| File | Purpose |
|------|---------|
| `src/utils/parameterRuleGenerator.js` | Auto-generation of parameter rules from schemas |
| `tests/unit/utils/parameterRuleGenerator.test.js` | Unit tests for generator |

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `src/utils/preValidationUtils.js` | Current OPERATION_PARAMETER_RULES structure |
| `data/schemas/operations/*.schema.json` | All operation schemas to parse |
| `data/schemas/base-operation.schema.json` | Base structure for all operations |

---

## Out of Scope

**DO NOT MODIFY:**

- `src/utils/preValidationUtils.js` - Separate ticket (SCHVALTESINT-011)
- Any schema files in `data/schemas/`
- Any operation handlers in `src/logic/operationHandlers/`
- Any test infrastructure files

**DO NOT:**

- Integrate with preValidationUtils (that's SCHVALTESINT-011)
- Modify schemas to make them easier to parse
- Add runtime overhead to production startup (generate at build time or cache)

---

## Implementation Details

### Current Manual Structure

```javascript
// src/utils/preValidationUtils.js - current manual approach (lines 220-249)
// NOTE: The actual structure focuses on typo detection/correction, not schema metadata
const OPERATION_PARAMETER_RULES = {
  GET_NAME: {
    required: ['entity_ref', 'result_variable'],
    invalidFields: ['entity_id'], // Common mistake
    fieldCorrections: { entity_id: 'entity_ref' }
  },
  QUERY_COMPONENT: {
    required: ['entity_ref', 'component_type', 'result_variable'],
    invalidFields: ['entity_id'],
    fieldCorrections: { entity_id: 'entity_ref' }
  },
  ADD_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: { entity_id: 'entity_ref' }
  },
  REMOVE_COMPONENT: {
    required: ['entity_ref', 'component_type'],
    invalidFields: ['entity_id'],
    fieldCorrections: { entity_id: 'entity_ref' }
  }
  // Only 4 of 62 operations have rules defined
};
```

> **Note**: The auto-generated structure below is intentionally different from the manual structure above.
> The manual structure focuses on typo correction (`invalidFields`, `fieldCorrections`), while the
> generated structure provides schema-derived metadata (`optional`, `templateFields`, `schemaId`).
> SCHVALTESINT-011 will handle integration of both structures.

### Generated Structure Target

```javascript
// Auto-generated from schemas
{
  LOCK_GRABBING: {
    required: ['actor_id', 'count'],
    optional: ['item_id'],
    templateFields: ['actor_id', 'count', 'item_id'],
    schemaId: 'schema://living-narrative-engine/operations/lockGrabbing.schema.json'
  },
  UNLOCK_GRABBING: {
    required: ['actor_id', 'count'],
    optional: ['item_id'],
    templateFields: ['actor_id', 'count', 'item_id'],
    schemaId: 'schema://living-narrative-engine/operations/unlockGrabbing.schema.json'
  },
  // ... all 62 operations auto-generated
}
```

### Suggested Implementation

```javascript
/**
 * @file src/utils/parameterRuleGenerator.js
 * Generates parameter validation rules from operation schemas
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const OPERATIONS_DIR = 'data/schemas/operations';

/**
 * Generates parameter rules for all operation schemas
 * @returns {Promise<Object>} Map of operation type to parameter rules
 */
export async function generateParameterRules() {
  const files = await readdir(OPERATIONS_DIR);
  const schemaFiles = files.filter(f => f.endsWith('.schema.json'));

  const rules = {};

  for (const file of schemaFiles) {
    const content = await readFile(join(OPERATIONS_DIR, file), 'utf8');
    const schema = JSON.parse(content);

    const rule = extractRuleFromSchema(schema);
    if (rule) {
      rules[rule.operationType] = {
        required: rule.required,
        optional: rule.optional,
        templateFields: rule.templateFields,
        schemaId: schema.$id
      };
    }
  }

  return rules;
}

/**
 * Extracts parameter rule from a single operation schema
 * @param {Object} schema - Parsed JSON schema
 * @returns {Object|null} Extracted rule or null if not an operation schema
 */
export function extractRuleFromSchema(schema) {
  // Navigate through allOf to find operation type and parameters
  const allOf = schema.allOf;
  if (!Array.isArray(allOf)) return null;

  let operationType = null;
  let parameters = null;

  for (const part of allOf) {
    if (part.properties) {
      // Find type constant
      if (part.properties.type?.const) {
        operationType = part.properties.type.const;
      }

      // Find parameters definition
      if (part.properties.parameters) {
        parameters = part.properties.parameters;
      }
    }
  }

  if (!operationType || !parameters) return null;

  // Extract required and optional fields
  const required = parameters.required || [];
  const allProperties = Object.keys(parameters.properties || {});
  const optional = allProperties.filter(p => !required.includes(p));

  // Detect template-capable fields (those with oneOf or $ref to template types)
  const templateFields = detectTemplateFields(parameters.properties || {});

  return {
    operationType,
    required,
    optional,
    templateFields
  };
}

/**
 * Detects which fields can accept template strings
 * @param {Object} properties - Schema properties object
 * @returns {string[]} Field names that accept templates
 */
export function detectTemplateFields(properties) {
  const templateFields = [];

  for (const [name, def] of Object.entries(properties)) {
    if (isTemplateCapable(def)) {
      templateFields.push(name);
    }
  }

  return templateFields;
}

/**
 * Checks if a property definition accepts template strings
 * @param {Object} def - Property definition
 * @returns {boolean}
 */
function isTemplateCapable(def) {
  // Check for $ref to common template definitions
  if (def.$ref && def.$ref.includes('common.schema.json#/definitions/')) {
    return true;
  }

  // Check for local oneOf with string pattern (legacy detection)
  if (def.oneOf) {
    return def.oneOf.some(branch =>
      branch.type === 'string' &&
      (branch.pattern || branch.$ref?.includes('templateString'))
    );
  }

  // Strings are generally template-capable in this system
  if (def.type === 'string') {
    return true;
  }

  return false;
}

/**
 * Validates that all known operation types have rules
 * @param {Object} rules - Generated rules
 * @param {string[]} knownTypes - Known operation types from whitelist
 * @returns {{ missing: string[], extra: string[] }}
 */
export function validateCoverage(rules, knownTypes) {
  const generatedTypes = Object.keys(rules);

  const missing = knownTypes.filter(t => !generatedTypes.includes(t));
  const extra = generatedTypes.filter(t => !knownTypes.includes(t));

  return { missing, extra };
}

export default {
  generateParameterRules,
  extractRuleFromSchema,
  detectTemplateFields,
  validateCoverage
};
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New unit test**: `tests/unit/utils/parameterRuleGenerator.test.js`

```javascript
describe('parameterRuleGenerator', () => {
  describe('extractRuleFromSchema', () => {
    it('should extract operation type from const', () => {});
    it('should extract required parameters', () => {});
    it('should extract optional parameters', () => {});
    it('should return null for non-operation schemas', () => {});
  });

  describe('detectTemplateFields', () => {
    it('should detect $ref to common.schema.json template types', () => {});
    it('should detect local oneOf template patterns', () => {});
    it('should treat string properties as template-capable', () => {});
  });

  describe('generateParameterRules', () => {
    it('should generate rules for all operation schemas', async () => {});
    it('should include schemaId in each rule', () => {});
  });

  describe('validateCoverage', () => {
    it('should identify missing rules', () => {});
    it('should identify extra rules', () => {});
    it('should return empty arrays when coverage complete', () => {});
  });
});
```

### Generation Requirements

1. **Coverage**: Rules generated for all 62 operation schemas
2. **Accuracy**: Required/optional correctly extracted from schema `required` array
3. **Template Detection**: All template-capable fields identified
4. **Schema Reference**: Each rule includes source `schemaId`

### Manual Verification Steps

1. Run generator on current schemas:
   ```javascript
   import { generateParameterRules } from './src/utils/parameterRuleGenerator.js';
   const rules = await generateParameterRules();
   console.log(Object.keys(rules).length); // Should be 62
   console.log(rules.LOCK_GRABBING); // Verify structure
   ```

2. Verify coverage against KNOWN_OPERATION_TYPES:
   ```javascript
   import { KNOWN_OPERATION_TYPES } from './src/utils/preValidationUtils.js';
   import { validateCoverage, generateParameterRules } from './src/utils/parameterRuleGenerator.js';

   const rules = await generateParameterRules();
   const { missing, extra } = validateCoverage(rules, KNOWN_OPERATION_TYPES);
   console.log('Missing:', missing);
   console.log('Extra:', extra);
   ```

### Invariants That Must Remain True

1. **INV-3 (Parameter Coverage)**: Generator produces rules for all operations
2. **Schema Accuracy**: Generated rules match schema definitions exactly
3. **No Runtime Overhead**: Generator runs at build/startup time, not per-request

---

## Estimated Effort

- **Size**: Large (L)
- **Complexity**: Medium - schema parsing requires careful navigation
- **Risk**: Low - new module, no existing code changes

## Review Checklist

- [x] All 62 operation schemas generate rules
- [x] Required/optional arrays match schema `required` property
- [x] Template fields correctly identified
- [x] schemaId included in each rule
- [x] Coverage validation works correctly
- [x] Unit tests comprehensive
- [x] JSDoc documentation complete
- [x] No runtime file I/O (schemas read at startup/build)

---

## Outcome

**Status**: ✅ COMPLETED

### What Was Actually Changed vs Originally Planned

1. **Ticket Correction** (Pre-implementation):
   - The "Current Manual Structure" section was corrected to reflect the actual code in `preValidationUtils.js`
   - Original ticket showed fictional `SET_COMPONENT` with `optional`/`templateFields`
   - Corrected to show actual operations (`GET_NAME`, `QUERY_COMPONENT`, `ADD_COMPONENT`, `REMOVE_COMPONENT`) with `invalidFields`/`fieldCorrections`
   - Added clarifying note that the generated structure is intentionally different from the manual structure

2. **Implementation**:
   - Created `src/utils/parameterRuleGenerator.js` following the suggested implementation pattern
   - Modified schema navigation to use `$defs.Parameters` (actual schema structure) instead of inline `parameters.properties`
   - Added `TEMPLATE_DEFINITIONS` Set for precise template type matching
   - Enhanced template detection to support all common.schema.json template types

3. **Tests**:
   - Created comprehensive unit tests with 31 test cases
   - Tests cover all acceptance criteria and edge cases
   - Integration test validates coverage against KNOWN_OPERATION_TYPES

### Test Results Summary

```
Test Suites: 1 passed, 1 total
Tests:       31 passed, 31 total
```

**Coverage Verification**:
- Generated rules: 62 operations (matches 62 schema files)
- Known operation types: 64
- Missing schemas: `HAS_BODY_PART_WITH_COMPONENT_VALUE`, `SEQUENCE` (operations in whitelist but no schema files)
- Extra schemas: None
- Coverage: 96.9% (62/64 known types have schemas)

### New Tests Added

| Test File | Test Count | Purpose |
|-----------|------------|---------|
| `tests/unit/utils/parameterRuleGenerator.test.js` | 31 | Comprehensive unit tests for all exported functions |

**Test Categories**:
- `extractRuleFromSchema` - 9 tests covering schema parsing, edge cases, missing fields
- `detectTemplateFields` - 10 tests covering template type detection, edge cases
- `generateParameterRules` - 6 tests covering full generation, structure validation
- `validateCoverage` - 5 tests covering coverage validation logic
- Integration - 1 test validating against actual KNOWN_OPERATION_TYPES

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/parameterRuleGenerator.js` | 236 | Schema parser and rule generator |
| `tests/unit/utils/parameterRuleGenerator.test.js` | 450 | Unit tests |

### Sample Generated Rule

```javascript
{
  "LOCK_GRABBING": {
    "required": ["actor_id", "count"],
    "optional": ["item_id"],
    "templateFields": ["actor_id", "count", "item_id"],
    "schemaId": "schema://living-narrative-engine/operations/lockGrabbing.schema.json"
  }
}
```
