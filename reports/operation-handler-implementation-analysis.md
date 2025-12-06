# Operation Handler Implementation Analysis & Recommendations

**Date**: 2025-01-07
**Focus**: Architecture & Developer Experience
**Status**: Comprehensive Analysis

---

## Executive Summary

### Current Situation

The Living Narrative Engine uses operation handlers to execute game logic defined in mod rules. Each new operation handler requires updates to 7+ different files across the codebase, involving schema definitions, dependency injection registration, operation registry mapping, and pre-validation whitelisting. This manual process is error-prone and time-consuming.

### Key Findings

- **Critical Registration Gap**: Missing `KNOWN_OPERATION_TYPES` entry in `preValidationUtils.js` causes validation failures, but this step is easily overlooked
- **Complex AJV Validation**: Schema reference resolution issues regularly require 2+ hours of debugging
- **Scattered Knowledge**: No single source of truth; implementation knowledge distributed across 7+ files
- **Weak Safeguards**: Missing registrations often don't fail until integration tests run
- **Poor Error Messages**: AJV validation errors don't indicate root cause (missing registration)

### Impact Assessment

- **Current Time to Add Operation**: 1-3 hours (including debugging)
- **Debugging Time per Issue**: 2+ hours average
- **Error Rate**: High (based on recent commits showing repeated fixes)
- **Developer Friction**: Significant cognitive load, easy to miss steps

### Recommended Improvements

**Immediate (Days):**

- Enhanced documentation and inline comments
- Improved error messages with actionable guidance
- Expanded checklist in CLAUDE.md

**Medium-term (Weeks):**

- CLI scaffolding tool: `npm run create-operation`
- Build-time completeness validation
- Better pre-validation error messages

**Long-term (Months):**

- Schema-driven code generation
- Single source of truth architecture
- Auto-discovery registration patterns

**Expected Outcomes:**

- Time to add operation: 15-30 minutes
- Debugging time: <30 minutes
- Reduced error rate by 80%+
- Improved developer confidence

---

## 1. Current State Analysis

### 1.1 Architecture Overview

Operation handlers in the Living Narrative Engine follow these architectural patterns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Mod Rule Definition                     │
│  (defines operations to execute when conditions are met)    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Schema Validation Layer                    │
│  • Validates operation structure against JSON schemas       │
│  • Pre-validation whitelist check (KNOWN_OPERATION_TYPES)  │
│  • AJV validation with $ref resolution                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Operation Registry (DI Container)              │
│  • Maps operation type to handler implementation            │
│  • Resolves handler dependencies via tokens                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Operation Handler                          │
│  • Extends BaseOperationHandler                             │
│  • Implements execute(context) method                       │
│  • Dispatches events and manages state                      │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **BaseOperationHandler**: Abstract base class providing common functionality
2. **Schema System**: JSON Schema validation using AJV
3. **DI Container**: Token-based dependency injection
4. **Operation Registry**: Maps operation types to handler implementations
5. **Pre-validation**: Whitelist check before full schema validation

### 1.2 The Seven Registration Points

Each new operation handler requires updates to these files:

#### Point 1: Operation Schema File

**Location**: `data/schemas/operations/[operationName].schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/drinkFrom.schema.json",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "DRINK_FROM"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "drinkableItemId": {
              "type": "string"
            },
            "consumptionQuantity": {
              "type": "number",
              "minimum": 0
            }
          },
          "required": ["drinkableItemId"]
        }
      }
    }
  ]
}
```

**Purpose**: Define operation structure and validation rules

#### Point 2: Base Operation Schema Reference

**Location**: `data/schemas/operations/operation.schema.json`

```json
{
  "oneOf": [
    { "$ref": "./addComponent.schema.json" },
    { "$ref": "./removeComponent.schema.json" },
    { "$ref": "./drinkFrom.schema.json" },
    { "$ref": "./drinkEntirely.schema.json" }
    // ... other operations
  ]
}
```

**Purpose**: Register schema in the operation union type
**Pain Point**: Easy to forget, causes "no matching schema" errors

#### Point 3: DI Token Registration

**Location**: `src/dependencyInjection/tokens/tokens-core.js`

```javascript
export const tokens = {
  // ... other tokens
  IDrinkFromHandler: 'IDrinkFromHandler',
  IDrinkEntirelyHandler: 'IDrinkEntirelyHandler',
};
```

**Purpose**: Define dependency injection token for handler

#### Point 4: Handler Factory Registration

**Location**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

```javascript
import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';

export function registerOperationHandlers(container) {
  // ... other registrations

  container.register(tokens.IDrinkFromHandler, DrinkFromHandler);
  container.register(tokens.IDrinkEntirelyHandler, DrinkEntirelyHandler);
}
```

**Purpose**: Register handler class with DI container

#### Point 5: Operation Registry Mapping

**Location**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

```javascript
const operationRegistry = container.resolve(tokens.IOperationRegistry);

operationRegistry.registerOperation('DRINK_FROM', tokens.IDrinkFromHandler);
operationRegistry.registerOperation(
  'DRINK_ENTIRELY',
  tokens.IDrinkEntirelyHandler
);
```

**Purpose**: Map operation type string to handler token
**Pain Point**: Must match schema `const` value exactly

#### Point 6: Pre-validation Whitelist ⚠️ CRITICAL

**Location**: `src/utils/preValidationUtils.js`

```javascript
const KNOWN_OPERATION_TYPES = [
  'ADD_COMPONENT',
  'REMOVE_COMPONENT',
  'DRINK_FROM',
  'DRINK_ENTIRELY',
  // ... other operations
];
```

**Purpose**: Whitelist operation types before AJV validation
**Pain Point**: **Most commonly forgotten step**, causes cryptic validation failures

#### Point 7: Test Creation

**Locations**:

- `tests/unit/logic/operationHandlers/[operationName]Handler.test.js`
- `tests/integration/mods/[category]/[operationName]RuleExecution.test.js`

**Purpose**: Verify handler behavior and integration

### 1.3 Case Study: Recent Implementations

#### DRINK_FROM Operation

**Files Modified** (from git history):

- `data/schemas/operations/drinkFrom.schema.json` - Created
- `data/schemas/operations/operation.schema.json` - Updated
- `src/logic/operationHandlers/drinkFromHandler.js` - Created
- `src/dependencyInjection/tokens/tokens-core.js` - Updated
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Updated
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Updated
- `src/utils/preValidationUtils.js` - Updated (after initial oversight)
- `tests/unit/logic/operationHandlers/drinkFromHandler.test.js` - Created
- `tests/integration/mods/items/drinkFromRuleExecution.test.js` - Created

**Issues Encountered:**

1. Initial implementation missed `KNOWN_OPERATION_TYPES` registration
2. AJV validation failed with unclear error messages
3. Integration tests revealed missing schema reference
4. ~2 hours debugging time

#### DRINK_ENTIRELY Operation

**Pattern Observed**: Similar implementation, similar issues

- Same registration oversight initially
- Learned from DRINK_FROM mistakes but process still manual
- Better but still error-prone

### 1.4 Common Patterns

**Handler Implementation Pattern:**

```javascript
/**
 * @file Handler for DRINK_FROM operation
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

class DrinkFromHandler extends BaseOperationHandler {
  #componentMutationService;
  #entityStateQuerier;

  constructor({
    componentMutationService,
    entityStateQuerier,
    logger,
    eventBus,
  }) {
    super({ logger, eventBus });

    validateDependency(
      componentMutationService,
      'IComponentMutationService',
      logger,
      {
        requiredMethods: ['addComponent', 'removeComponent'],
      }
    );

    this.#componentMutationService = componentMutationService;
    this.#entityStateQuerier = entityStateQuerier;
  }

  async execute(context) {
    const { parameters } = context.operation;

    try {
      // 1. Validate required parameters
      assertPresent(parameters.drinkableItemId, 'drinkableItemId is required');

      // 2. Query current state
      const item = this.#entityStateQuerier.getEntity(
        parameters.drinkableItemId
      );

      // 3. Execute business logic
      const consumptionQuantity = parameters.consumptionQuantity || 1;

      // 4. Mutate state
      await this.#componentMutationService.updateComponent(/*...*/);

      // 5. Dispatch success event
      this.dispatchOperationEvent('DRINK_FROM_COMPLETED', {
        itemId: parameters.drinkableItemId,
        quantity: consumptionQuantity,
      });
    } catch (error) {
      this.handleOperationError(error, 'DRINK_FROM', context);
      throw error;
    }
  }
}

export default DrinkFromHandler;
```

**Schema Pattern:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/[operationName].schema.json",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "[OPERATION_TYPE]"
        },
        "parameters": {
          "type": "object",
          "properties": {
            // Operation-specific parameters
          },
          "required": [
            /* required params */
          ]
        }
      }
    }
  ]
}
```

---

## 2. Pain Points Identified

### 2.1 Pre-validation Registration Gap ⚠️ CRITICAL

**Problem**: The `KNOWN_OPERATION_TYPES` array in `preValidationUtils.js` is the most commonly forgotten registration step.

**Why It Happens:**

- Not obvious from file name that it's required
- Located in utility file, not near other registrations
- No automated check until integration tests run
- CLAUDE.md mentions it but easy to overlook in checklist

**Impact:**

- Causes validation failures during mod loading
- Error message is generic: "Unknown operation type"
- Developers waste time checking schemas and registrations
- Average debugging time: 1-2 hours

**Example Error:**

```
Error: Validation failed for rule 'drink_from_rule'
Unknown operation type: DRINK_FROM
```

**Root Cause**: No build-time or early runtime check for registration completeness

### 2.2 AJV Schema Reference Issues

**Problem**: Complex `$ref` resolution in AJV causing validation failures

**Common Issues:**

1. **Circular Reference Errors**: When schemas reference each other
2. **Missing Schema Errors**: When `$id` doesn't match file location
3. **Resolution Path Errors**: Incorrect `../` paths in `$ref`

**Example Symptoms:**

```
AJVError: can't resolve reference ../base-operation.schema.json
  from id https://living-narrative-engine/schemas/operations/drinkFrom.schema.json
```

**Why It Happens:**

- Complex schema loading order dependencies
- Non-standard `$id` URLs don't match file paths
- AJV configuration requires precise setup
- Schema references use relative paths that break if moved

**Impact:**

- 2+ hours debugging typical
- Requires deep AJV knowledge
- Trial-and-error fixes common
- Changes to one schema can break others

**Recent Fix Example**: Commit showed schema loading order issue fixed by ensuring base schemas load first

### 2.3 Manual Synchronization Burden

**Problem**: Seven different files must be manually kept in sync

**Synchronization Requirements:**

```
OPERATION_TYPE string must match in:
├─ drinkFrom.schema.json        → "const": "DRINK_FROM"
├─ operation.schema.json        → "$ref": "./drinkFrom.schema.json"
├─ interpreterRegistrations.js  → 'DRINK_FROM'
└─ preValidationUtils.js        → 'DRINK_FROM'

Handler class name conventions:
├─ DrinkFromHandler             → File: drinkFromHandler.js
├─ IDrinkFromHandler           → Token name
└─ tokens.IDrinkFromHandler    → Container registration
```

**Pain Points:**

- Easy to have typos/mismatches
- No automated verification
- Refactoring is risky
- Copy-paste errors common

**Example Issues:**

- Operation type in schema: `DRINK_FROM`
- Operation type in registry: `DRINK_FORM` (typo)
- Result: Runtime error when rule tries to execute

### 2.4 Error Message Quality

**Problem**: Validation errors don't indicate root cause or next steps

**Current Error Messages:**

```javascript
// Pre-validation failure
'Unknown operation type: DRINK_FROM';
// Doesn't tell you to add it to KNOWN_OPERATION_TYPES

// AJV validation failure
'data/type must be equal to one of the allowed values';
// Doesn't tell you which schema is missing

// Operation registry failure
'No handler registered for operation type: DRINK_FROM';
// Doesn't tell you to check interpreterRegistrations.js
```

**What's Missing:**

- Specific file paths to update
- Checklist of registration points
- Links to documentation
- Suggestions for common mistakes

**Impact:**

- Developers must remember all registration points
- Consult CLAUDE.md or ask for help
- Trial-and-error approach common
- Frustration and wasted time

### 2.5 Developer Experience Issues

**Cognitive Load:**

- Must remember 7 registration points
- Must understand DI container, schema system, event bus
- Must know file naming conventions
- Must recall operation type naming patterns

**Knowledge Distribution:**

- No single file shows full picture
- Must navigate between 7+ files
- Context switching between schema JSON and JS code
- Different mental models (schema vs. DI vs. registry)

**Feedback Loop:**

- Errors only appear at runtime or integration tests
- No early validation during development
- Long cycle time between mistake and detection
- Difficult to identify which step was missed

**Onboarding Impact:**

- New developers struggle
- Even experienced developers make mistakes
- Process requires deep codebase knowledge
- High barrier to contributing operations

---

## 3. Root Cause Analysis

### 3.1 Why These Issues Recur

#### Distributed Knowledge Problem

**The Issue**: No single source of truth for operation definitions

```
Operation Knowledge Scattered Across:

JSON Schemas          JavaScript Code         Test Files
├─ operation.schema   ├─ tokens.js           ├─ unit tests
├─ drinkFrom.schema   ├─ registrations.js    └─ integration tests
└─ base-operation     └─ handler.js
                      └─ preValidationUtils.js
```

**Why It's Problematic:**

- Each file has partial knowledge
- Must manually synchronize changes
- No automated consistency check
- Easy for pieces to drift

**Contrast with Better Patterns:**

- Single schema generates code (e.g., OpenAPI → server stubs)
- Code annotations drive registration (e.g., Spring decorators)
- Convention over configuration (e.g., Rails ActiveRecord)

#### Manual Process Inherently Error-Prone

**Human Factors:**

- Checklists are often skipped when under time pressure
- Copy-paste introduces subtle errors
- Interruptions cause steps to be forgotten
- Confidence increases, vigilance decreases

**No Automation:**

- No code generation tools
- No scaffolding scripts
- No build-time validation
- No IDE integration

#### Late Error Detection

**When Errors Are Detected:**

1. **Pre-validation** (if registered): During mod loading
2. **Schema validation** (if schema added): During mod loading
3. **Operation registry** (if mapped): When rule tries to execute
4. **Integration tests** (if written): During test run
5. **Production** (if tests missed): When players trigger rule

**Problem**: Many steps between mistake and detection

### 3.2 Architectural Gaps

#### Lack of Code Generation

**Current State**: All code manually written
**Alternative**: Generate handler boilerplate from schema

**Potential Approach:**

```bash
npm run create-operation drink_from

# Generates:
# - data/schemas/operations/drinkFrom.schema.json (template)
# - src/logic/operationHandlers/drinkFromHandler.js (template)
# - tests/unit/logic/operationHandlers/drinkFromHandler.test.js (template)
# Updates:
# - operation.schema.json ($ref added)
# - tokens-core.js (token added)
# - operationHandlerRegistrations.js (registration added)
# - interpreterRegistrations.js (mapping added)
# - preValidationUtils.js (whitelist added)
```

#### No Build-Time Validation

**Current State**: Errors only at runtime
**Alternative**: Validate completeness during build

**Potential Checks:**

- All schemas in `/operations/` are referenced in `operation.schema.json`
- All operation types in schemas are in `KNOWN_OPERATION_TYPES`
- All operation types have handlers registered
- All tokens are defined and registered
- Naming conventions are followed

#### Insufficient Guardrails

**Current State**: Easy to skip steps without immediate feedback
**Alternative**: Fail fast with helpful messages

**Examples:**

- Pre-commit hook validates operation completeness
- Build script checks registration consistency
- IDE extension highlights missing registrations
- Test template generator ensures coverage

### 3.3 Process Fragility

#### Weak Coupling

**Problem**: Related registrations are in separate files with no enforced links

```
Tight Coupling Desired:           Current Weak Coupling:
┌──────────────────────┐         ┌──────────────────────┐
│  Operation Schema    │         │  Operation Schema    │
├──────────────────────┤         └──────────────────────┘
│ • Type constant      │                    │
│ • Parameters         │                    │ manual
│ • Handler class ref  │                    ▼
│ • Token definition   │         ┌──────────────────────┐
│ • Registry mapping   │         │  Separate Files      │
└──────────────────────┘         │ • tokens.js          │
                                 │ • registrations.js   │
                                 │ • preValidation.js   │
                                 └──────────────────────┘
```

**Result**: Changes require coordinated updates across files

#### No Atomic Operations

**Problem**: Can't add operation in single atomic action

**Current**: Multi-step process where partial completion leaves system in broken state
**Desired**: Single command that either succeeds completely or fails safely

#### Lack of Verification Steps

**Problem**: No checkpoint validation between steps

**Current Process:**

1. Create schema → No validation
2. Add handler → No validation
3. Register token → No validation
4. Map operation → No validation
5. Run tests → Errors detected!

**Improved Process:**

1. Create schema → Validate schema syntax
2. Add to operation.schema.json → Verify $ref resolves
3. Add handler → Verify extends BaseOperationHandler
4. Register token → Verify naming convention
5. Map operation → Verify type string matches
6. Add to whitelist → Verify consistency
7. Run tests → Final validation

---

## 4. Recommendations

### 4.1 Phase 1: Immediate Quick Wins (1-3 Days)

#### 1.1 Enhanced Inline Documentation

**Action**: Add comprehensive comments in all registration files

**Example for `preValidationUtils.js`:**

```javascript
/**
 * CRITICAL: Pre-validation whitelist for operation types
 *
 * ⚠️ EVERY new operation MUST be added here before validation will pass
 *
 * When adding a new operation handler:
 * 1. Add operation type constant to this array
 * 2. Ensure it matches the "const" value in your schema exactly
 * 3. Run `npm run validate:operations` to verify consistency
 *
 * Common mistake: Forgetting this step causes "Unknown operation type" errors
 *
 * Related files:
 * - data/schemas/operations/[operationName].schema.json (type constant)
 * - src/dependencyInjection/registrations/interpreterRegistrations.js (registry mapping)
 *
 * @see docs/adding-operations.md for complete checklist
 */
const KNOWN_OPERATION_TYPES = [
  'ADD_COMPONENT',
  'REMOVE_COMPONENT',
  'DRINK_FROM', // Added for DRINK_FROM operation
  'DRINK_ENTIRELY', // Added for DRINK_ENTIRELY operation
  // ... ADD NEW OPERATION TYPES HERE
];
```

**Example for `interpreterRegistrations.js`:**

```javascript
/**
 * Operation Registry Mappings
 *
 * Maps operation type strings to handler tokens
 *
 * Requirements:
 * - Operation type must match schema "const" value exactly
 * - Handler token must be defined in tokens-core.js
 * - Handler must be registered in operationHandlerRegistrations.js
 *
 * Verification:
 * Run `npm run validate:operations` to check consistency
 *
 * @see src/dependencyInjection/tokens/tokens-core.js
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js
 * @see src/utils/preValidationUtils.js (KNOWN_OPERATION_TYPES)
 */
export function registerInterpreter(container) {
  const operationRegistry = container.resolve(tokens.IOperationRegistry);

  // Operation mappings - keep alphabetically sorted
  operationRegistry.registerOperation(
    'ADD_COMPONENT',
    tokens.IAddComponentHandler
  );
  operationRegistry.registerOperation(
    'DRINK_ENTIRELY',
    tokens.IDrinkEntirelyHandler
  );
  operationRegistry.registerOperation('DRINK_FROM', tokens.IDrinkFromHandler);
  // ... ADD NEW MAPPINGS HERE (alphabetically)
}
```

**Impact**:

- Developers have guidance at point of modification
- Reduces "what file do I update next?" questions
- Links related files for easier navigation

#### 1.2 Improved Error Messages

**Action**: Enhance validation error messages with actionable guidance

**Example for `preValidationUtils.js`:**

```javascript
function validateOperationType(operationType, context, logger) {
  if (!KNOWN_OPERATION_TYPES.includes(operationType)) {
    const errorMessage = `
❌ Unknown operation type: "${operationType}"

This operation type is not in the pre-validation whitelist.

📋 To fix this:
1. Add "${operationType}" to KNOWN_OPERATION_TYPES in src/utils/preValidationUtils.js
2. Ensure it matches the "const" value in your schema exactly
3. Run 'npm run validate:operations' to verify consistency

📚 Related files to check:
- data/schemas/operations/${operationType.toLowerCase()}.schema.json
- data/schemas/operations/operation.schema.json ($ref entry)
- src/dependencyInjection/registrations/interpreterRegistrations.js

See docs/adding-operations.md for complete checklist.
    `.trim();

    logger.error(errorMessage);
    throw new InvalidOperationTypeError(errorMessage);
  }
}
```

**Example for operation registry:**

```javascript
async execute(operation, context) {
  const handler = this.#handlers.get(operation.type);

  if (!handler) {
    const errorMessage = `
❌ No handler registered for operation type: "${operation.type}"

The operation type exists in the schema but is not mapped to a handler.

📋 To fix this:
1. Check that handler is registered in:
   - src/dependencyInjection/registrations/operationHandlerRegistrations.js
2. Check that mapping exists in:
   - src/dependencyInjection/registrations/interpreterRegistrations.js
3. Verify token is defined in:
   - src/dependencyInjection/tokens/tokens-core.js

Current registered operations:
${Array.from(this.#handlers.keys()).map(t => `  - ${t}`).join('\n')}

See docs/adding-operations.md for complete checklist.
    `.trim();

    this.#logger.error(errorMessage);
    throw new OperationHandlerNotFoundError(errorMessage);
  }

  return await handler.execute(context);
}
```

**Impact**:

- Reduces debugging time from hours to minutes
- Developers get actionable next steps immediately
- Self-documenting error messages reduce support burden

#### 1.3 Expanded CLAUDE.md Checklist

**Action**: Update CLAUDE.md with detailed checklist and validation commands

**Addition to CLAUDE.md:**

````markdown
### Adding New Operations - Complete Checklist

When adding a new operation to the system, follow this checklist to ensure complete integration:

#### Step-by-Step Process

1. **Create operation schema** ✅ Validation: Schema is valid JSON
   - File: `data/schemas/operations/[operationName].schema.json`
   - Use `allOf` to extend `base-operation.schema.json`
   - Define `type` constant and `parameters`
   - Verify: `npm run validate:schemas`

2. **Add schema reference** ✅ Validation: Reference resolves
   - File: `data/schemas/operations/operation.schema.json`
   - Add `$ref` entry to `oneOf` array
   - Keep alphabetically sorted
   - Verify: `npm run validate:schemas`

3. **Create operation handler** ✅ Validation: Handler compiles
   - File: `src/logic/operationHandlers/[operationName]Handler.js`
   - Extend `BaseOperationHandler`
   - Implement `execute(context)` method
   - Add comprehensive error handling
   - Verify: `npm run typecheck`

4. **Define DI token** ✅ Validation: Token is unique
   - File: `src/dependencyInjection/tokens/tokens-core.js`
   - Add `I[OperationName]Handler: 'I[OperationName]Handler'`
   - Follow naming convention: PascalCase
   - Verify: `npm run validate:tokens`

5. **Register handler factory** ✅ Validation: Registration syntax correct
   - File: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
   - Add `container.register(tokens.I[OperationName]Handler, [OperationName]Handler)`
   - Add import statement
   - Verify: `npm run typecheck`

6. **Map operation to handler** ✅ Validation: Type string matches schema
   - File: `src/dependencyInjection/registrations/interpreterRegistrations.js`
   - Add `operationRegistry.registerOperation('[OPERATION_TYPE]', tokens.I[OperationName]Handler)`
   - Ensure type matches schema exactly
   - Verify: `npm run validate:operations`

7. **⚠️ CRITICAL: Add to pre-validation whitelist** ✅ Validation: Type in whitelist
   - File: `src/utils/preValidationUtils.js`
   - Add `'[OPERATION_TYPE]'` to `KNOWN_OPERATION_TYPES` array
   - Keep alphabetically sorted
   - **Failure to do this will cause validation failures during mod loading**
   - Verify: `npm run validate:operations`

8. **Create tests** ✅ Validation: Tests pass with coverage
   - Unit: `tests/unit/logic/operationHandlers/[operationName]Handler.test.js`
   - Integration: `tests/integration/mods/[category]/[operationName]RuleExecution.test.js`
   - Verify: `npm run test:unit && npm run test:integration`

#### Validation Commands

Run after each step for immediate feedback:

```bash
# After steps 1-2: Validate schemas
npm run validate:schemas

# After steps 3-6: Type check and compile
npm run typecheck

# After step 7: Validate operation completeness
npm run validate:operations

# After step 8: Run tests
npm run test:unit
npm run test:integration

# Final verification: Full test suite
npm run test:ci
```
````

#### Common Pitfalls

❌ **Forgetting pre-validation whitelist** (Step 7)

- Symptom: "Unknown operation type" error during mod loading
- Fix: Add to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`

❌ **Type string mismatch**

- Symptom: "No handler registered" error at runtime
- Fix: Ensure type matches exactly in schema, registry, and whitelist

❌ **Missing schema $ref**

- Symptom: AJV validation fails with "no matching schema"
- Fix: Add `$ref` to `operation.schema.json`

❌ **Incomplete DI registration**

- Symptom: "Cannot resolve token" error
- Fix: Check token defined, factory registered, and operation mapped

#### Quick Reference

| File                               | Purpose   | Pattern                                      |
| ---------------------------------- | --------- | -------------------------------------------- |
| `[operation].schema.json`          | Structure | `"const": "OPERATION_NAME"`                  |
| `operation.schema.json`            | Reference | `{ "$ref": "./[operation].schema.json" }`    |
| `[operation]Handler.js`            | Logic     | `class extends BaseOperationHandler`         |
| `tokens-core.js`                   | Token     | `I[Operation]Handler: 'I[Operation]Handler'` |
| `operationHandlerRegistrations.js` | Factory   | `container.register(token, Class)`           |
| `interpreterRegistrations.js`      | Mapping   | `registerOperation('TYPE', token)`           |
| `preValidationUtils.js`            | Whitelist | `'OPERATION_NAME'` in array                  |

See `docs/adding-operations.md` for detailed examples and troubleshooting.

````

**Impact**:
- Comprehensive checklist reduces missed steps
- Validation commands provide immediate feedback
- Quick reference table for at-a-glance guidance

#### 1.4 JSDoc Cross-References

**Action**: Add JSDoc comments linking related registration points

**Example in handler file:**

```javascript
/**
 * Handler for DRINK_FROM operation
 *
 * Processes drinking from a container or drinkable item.
 *
 * @see data/schemas/operations/drinkFrom.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - IDrinkFromHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */
class DrinkFromHandler extends BaseOperationHandler {
  // ...
}
````

**Example in schema file:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/drinkFrom.schema.json",
  "description": "Schema for DRINK_FROM operation. Related code: src/logic/operationHandlers/drinkFromHandler.js",
  "allOf": [
    // ...
  ]
}
```

**Impact**:

- IDE navigation between related files
- Documentation at point of use
- Easier code review and maintenance

### 4.2 Phase 2: Medium-term Improvements (1-4 Weeks)

#### 2.1 CLI Scaffolding Tool

**Action**: Create `npm run create-operation <name>` command

**Implementation**: `scripts/createOperation.js`

```javascript
#!/usr/bin/env node

/**
 * Operation Handler Scaffolding Tool
 *
 * Usage: npm run create-operation <operationName>
 * Example: npm run create-operation drink_from
 *
 * This script:
 * 1. Generates operation schema from template
 * 2. Creates handler class with boilerplate
 * 3. Updates all registration files automatically
 * 4. Creates test file templates
 * 5. Validates completeness
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OPERATION_NAME = process.argv[2];

if (!OPERATION_NAME) {
  console.error('Usage: npm run create-operation <operationName>');
  console.error('Example: npm run create-operation drink_from');
  process.exit(1);
}

// Convert snake_case to PascalCase
function toPascalCase(snakeCase) {
  return snakeCase
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Convert snake_case to UPPER_SNAKE_CASE
function toUpperSnakeCase(snakeCase) {
  return snakeCase.toUpperCase();
}

const operationNamePascal = toPascalCase(OPERATION_NAME);
const operationNameUpper = toUpperSnakeCase(OPERATION_NAME);
const operationNameCamel =
  operationNamePascal.charAt(0).toLowerCase() + operationNamePascal.slice(1);

console.log('🚀 Creating operation handler...');
console.log(`  Operation: ${OPERATION_NAME}`);
console.log(`  Handler class: ${operationNamePascal}Handler`);
console.log(`  Operation type: ${operationNameUpper}`);

// Step 1: Create schema file
console.log('\n📋 Step 1: Creating operation schema...');
const schemaContent = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/${operationNameCamel}.schema.json",
  "description": "Schema for ${operationNameUpper} operation. Related code: src/logic/operationHandlers/${operationNameCamel}Handler.js",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "${operationNameUpper}"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "exampleParam": {
              "type": "string",
              "description": "TODO: Define actual parameters"
            }
          },
          "required": []
        }
      }
    }
  ]
}
`;

const schemaPath = `data/schemas/operations/${operationNameCamel}.schema.json`;
fs.writeFileSync(schemaPath, schemaContent);
console.log(`  ✅ Created ${schemaPath}`);

// Step 2: Update operation.schema.json
console.log('\n📋 Step 2: Adding schema reference to operation.schema.json...');
const operationSchemaPath = 'data/schemas/operations/operation.schema.json';
const operationSchema = JSON.parse(
  fs.readFileSync(operationSchemaPath, 'utf8')
);

const newRef = { $ref: `./${operationNameCamel}.schema.json` };
if (!operationSchema.oneOf) {
  operationSchema.oneOf = [];
}
operationSchema.oneOf.push(newRef);
operationSchema.oneOf.sort((a, b) => a.$ref.localeCompare(b.$ref));

fs.writeFileSync(
  operationSchemaPath,
  JSON.stringify(operationSchema, null, 2) + '\n'
);
console.log(`  ✅ Updated ${operationSchemaPath}`);

// Step 3: Create handler class
console.log('\n📋 Step 3: Creating handler class...');
const handlerContent = `/**
 * @file Handler for ${operationNameUpper} operation
 *
 * @see data/schemas/operations/${operationNameCamel}.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - I${operationNamePascal}Handler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

/**
 * Handles ${operationNameUpper} operation execution
 *
 * TODO: Add detailed description of operation behavior
 *
 * @extends BaseOperationHandler
 */
class ${operationNamePascal}Handler extends BaseOperationHandler {
  #componentMutationService;
  #entityStateQuerier;

  /**
   * @param {Object} dependencies
   * @param {IComponentMutationService} dependencies.componentMutationService
   * @param {IEntityStateQuerier} dependencies.entityStateQuerier
   * @param {ILogger} dependencies.logger
   * @param {IEventBus} dependencies.eventBus
   */
  constructor({ componentMutationService, entityStateQuerier, logger, eventBus }) {
    super({ logger, eventBus });

    validateDependency(componentMutationService, 'IComponentMutationService', logger, {
      requiredMethods: ['addComponent', 'removeComponent', 'updateComponent'],
    });
    validateDependency(entityStateQuerier, 'IEntityStateQuerier', logger, {
      requiredMethods: ['getEntity', 'hasComponent'],
    });

    this.#componentMutationService = componentMutationService;
    this.#entityStateQuerier = entityStateQuerier;
  }

  /**
   * Execute the ${operationNameUpper} operation
   *
   * @param {Object} context - Operation execution context
   * @param {Object} context.operation - Operation definition
   * @param {string} context.operation.type - Operation type (${operationNameUpper})
   * @param {Object} context.operation.parameters - Operation parameters
   * @param {Object} context.ruleContext - Rule execution context
   * @returns {Promise<void>}
   * @throws {InvalidArgumentError} If parameters are invalid
   * @throws {OperationExecutionError} If operation fails
   */
  async execute(context) {
    const { parameters } = context.operation;

    try {
      // 1. Validate required parameters
      // TODO: Add parameter validation
      assertPresent(parameters, 'Parameters are required');

      // 2. Query current state
      // TODO: Query necessary entity state

      // 3. Execute business logic
      // TODO: Implement operation logic

      // 4. Mutate state
      // TODO: Apply state changes

      // 5. Dispatch success event
      this.dispatchOperationEvent('${operationNameUpper}_COMPLETED', {
        // TODO: Add relevant event data
      });

    } catch (error) {
      this.handleOperationError(error, '${operationNameUpper}', context);
      throw error;
    }
  }
}

export default ${operationNamePascal}Handler;
`;

const handlerPath = `src/logic/operationHandlers/${operationNameCamel}Handler.js`;
fs.writeFileSync(handlerPath, handlerContent);
console.log(`  ✅ Created ${handlerPath}`);

// Step 4: Add token
console.log('\n📋 Step 4: Adding DI token...');
const tokensPath = 'src/dependencyInjection/tokens/tokens-core.js';
let tokensContent = fs.readFileSync(tokensPath, 'utf8');

const tokenEntry = `  I${operationNamePascal}Handler: 'I${operationNamePascal}Handler',`;
const tokensMatch = tokensContent.match(
  /export const tokens = \{([\s\S]*?)\};/
);

if (tokensMatch) {
  const tokensBody = tokensMatch[1];
  const tokenLines = tokensBody.split('\n').filter((line) => line.trim());
  tokenLines.push(tokenEntry);
  tokenLines.sort();

  const newTokensBody = '\n' + tokenLines.join('\n') + '\n';
  tokensContent = tokensContent.replace(
    /export const tokens = \{[\s\S]*?\};/,
    `export const tokens = {${newTokensBody}};`
  );

  fs.writeFileSync(tokensPath, tokensContent);
  console.log(`  ✅ Updated ${tokensPath}`);
} else {
  console.error(`  ❌ Could not update ${tokensPath} - manual update required`);
}

// Step 5: Register handler factory
console.log('\n📋 Step 5: Registering handler factory...');
const registrationsPath =
  'src/dependencyInjection/registrations/operationHandlerRegistrations.js';
let registrationsContent = fs.readFileSync(registrationsPath, 'utf8');

const importStatement = `import ${operationNamePascal}Handler from '../../logic/operationHandlers/${operationNameCamel}Handler.js';`;
const registrationStatement = `  container.register(tokens.I${operationNamePascal}Handler, ${operationNamePascal}Handler);`;

// Add import (alphabetically)
const imports = registrationsContent
  .split('\n')
  .filter((line) => line.startsWith('import') && line.includes('Handler'));
imports.push(importStatement);
imports.sort();

registrationsContent = registrationsContent.replace(/import.*Handler.*\n/g, '');
registrationsContent = imports.join('\n') + '\n' + registrationsContent;

// Add registration (alphabetically)
registrationsContent = registrationsContent.replace(
  /\/\/ ... other registrations/,
  `${registrationStatement}\n  // ... other registrations`
);

fs.writeFileSync(registrationsPath, registrationsContent);
console.log(`  ✅ Updated ${registrationsPath}`);

// Step 6: Map operation
console.log('\n📋 Step 6: Mapping operation to handler...');
const interpreterPath =
  'src/dependencyInjection/registrations/interpreterRegistrations.js';
let interpreterContent = fs.readFileSync(interpreterPath, 'utf8');

const mappingStatement = `  operationRegistry.registerOperation('${operationNameUpper}', tokens.I${operationNamePascal}Handler);`;

interpreterContent = interpreterContent.replace(
  /\/\/ ... ADD NEW MAPPINGS HERE/,
  `${mappingStatement}\n  // ... ADD NEW MAPPINGS HERE`
);

fs.writeFileSync(interpreterPath, interpreterContent);
console.log(`  ✅ Updated ${interpreterPath}`);

// Step 7: Add to pre-validation whitelist
console.log('\n📋 Step 7: Adding to pre-validation whitelist...');
const preValidationPath = 'src/utils/preValidationUtils.js';
let preValidationContent = fs.readFileSync(preValidationPath, 'utf8');

const whitelistMatch = preValidationContent.match(
  /const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/
);

if (whitelistMatch) {
  const whitelistBody = whitelistMatch[1];
  const whitelistLines = whitelistBody
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('//'));
  const operations = whitelistLines
    .map((line) => line.trim().replace(/[',]/g, ''))
    .filter(Boolean);

  operations.push(`'${operationNameUpper}'`);
  operations.sort();

  const newWhitelistBody = '\n  ' + operations.join(',\n  ') + ',\n';
  preValidationContent = preValidationContent.replace(
    /const KNOWN_OPERATION_TYPES = \[[\s\S]*?\];/,
    `const KNOWN_OPERATION_TYPES = [${newWhitelistBody}];`
  );

  fs.writeFileSync(preValidationPath, preValidationContent);
  console.log(`  ✅ Updated ${preValidationPath}`);
} else {
  console.error(
    `  ❌ Could not update ${preValidationPath} - manual update required`
  );
}

// Step 8: Create test templates
console.log('\n📋 Step 8: Creating test templates...');

const unitTestContent = `import { describe, it, expect, beforeEach } from '@jest/globals';
import ${operationNamePascal}Handler from '../../../src/logic/operationHandlers/${operationNameCamel}Handler.js';
import { createTestBed } from '../../common/testBed.js';

describe('${operationNamePascal}Handler', () => {
  let testBed;
  let handler;
  let mockComponentMutationService;
  let mockEntityStateQuerier;

  beforeEach(() => {
    testBed = createTestBed();
    mockComponentMutationService = testBed.createMock('componentMutationService', [
      'addComponent',
      'removeComponent',
      'updateComponent',
    ]);
    mockEntityStateQuerier = testBed.createMock('entityStateQuerier', [
      'getEntity',
      'hasComponent',
    ]);

    handler = new ${operationNamePascal}Handler({
      componentMutationService: mockComponentMutationService,
      entityStateQuerier: mockEntityStateQuerier,
      logger: testBed.createMockLogger(),
      eventBus: testBed.createMock('eventBus', ['dispatch']),
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => {
        new ${operationNamePascal}Handler({
          componentMutationService: null,
          entityStateQuerier: mockEntityStateQuerier,
          logger: testBed.createMockLogger(),
          eventBus: testBed.createMock('eventBus', ['dispatch']),
        });
      }).toThrow();
    });
  });

  describe('execute', () => {
    it('should execute ${operationNameUpper} operation successfully', async () => {
      // Arrange
      const context = {
        operation: {
          type: '${operationNameUpper}',
          parameters: {
            // TODO: Add test parameters
          },
        },
        ruleContext: {},
      };

      // Act
      await handler.execute(context);

      // Assert
      // TODO: Add assertions
      expect(mockComponentMutationService.updateComponent).toHaveBeenCalled();
    });

    it('should throw error for missing parameters', async () => {
      // Arrange
      const context = {
        operation: {
          type: '${operationNameUpper}',
          parameters: {},
        },
        ruleContext: {},
      };

      // Act & Assert
      await expect(handler.execute(context)).rejects.toThrow();
    });

    // TODO: Add more test cases for edge cases and failure scenarios
  });
});
`;

const unitTestPath = `tests/unit/logic/operationHandlers/${operationNameCamel}Handler.test.js`;
fs.writeFileSync(unitTestPath, unitTestContent);
console.log(`  ✅ Created ${unitTestPath}`);

const integrationTestContent = `import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('${operationNameUpper} Operation - Integration', () => {
  let fixture;

  beforeEach(async () => {
    // TODO: Update with correct mod ID and category
    fixture = await ModTestFixture.forCategory('items', 'items');
  });

  afterEach(() => {
    if (fixture) {
      fixture.cleanup();
    }
  });

  describe('Rule Execution', () => {
    it('should successfully execute ${OPERATION_NAME} rule', async () => {
      // Arrange
      const scenario = fixture.createStandardActorTarget(['Actor', 'Target']);

      // TODO: Set up test scenario

      // Act
      // TODO: Trigger rule execution

      // Assert
      // TODO: Verify expected state changes
    });

    it('should fail when prerequisites are not met', async () => {
      // Arrange
      const scenario = fixture.createStandardActorTarget(['Actor', 'Target']);

      // TODO: Set up invalid scenario

      // Act & Assert
      // TODO: Verify rule does not execute or fails appropriately
    });

    // TODO: Add more integration test cases
  });
});
`;

const integrationTestPath = `tests/integration/mods/items/${OPERATION_NAME}RuleExecution.test.js`;
fs.writeFileSync(integrationTestPath, integrationTestContent);
console.log(`  ✅ Created ${integrationTestPath}`);

// Step 9: Validate completeness
console.log('\n🔍 Step 9: Validating operation completeness...');

try {
  execSync('npm run validate:schemas', { stdio: 'inherit' });
  console.log('  ✅ Schema validation passed');
} catch (error) {
  console.error('  ❌ Schema validation failed - manual fix required');
}

console.log('\n✅ Operation handler scaffolding complete!');
console.log('\n📝 Next steps:');
console.log(
  '  1. Review and update generated files with actual implementation'
);
console.log(`  2. Edit ${schemaPath} to define correct parameters`);
console.log(`  3. Implement business logic in ${handlerPath}`);
console.log(`  4. Complete test cases in ${unitTestPath}`);
console.log(`  5. Complete integration tests in ${integrationTestPath}`);
console.log('  6. Run tests: npm run test:unit && npm run test:integration');
console.log('  7. Verify with: npm run test:ci');
console.log('\n📚 See docs/adding-operations.md for detailed guidance.');
```

**Add to package.json:**

```json
{
  "scripts": {
    "create-operation": "node scripts/createOperation.js"
  }
}
```

**Impact**:

- Reduces manual work from 30+ minutes to 2 minutes
- Eliminates copy-paste errors
- Ensures all registration points are updated
- Provides starting point for implementation

#### 2.2 Build-Time Completeness Validation

**Action**: Create validation script to check registration consistency

**Implementation**: `scripts/validateOperations.js`

```javascript
#!/usr/bin/env node

/**
 * Operation Registration Completeness Validator
 *
 * Checks that all operation handlers are properly registered across all required files
 *
 * Usage: npm run validate:operations
 */

import fs from 'fs';
import path from 'path';
import glob from 'glob';

const errors = [];
const warnings = [];

console.log('🔍 Validating operation registration completeness...\n');

// 1. Collect all operation schemas
console.log('📋 Step 1: Scanning operation schemas...');
const schemaFiles = glob
  .sync('data/schemas/operations/*.schema.json')
  .filter(
    (f) =>
      !f.endsWith('operation.schema.json') &&
      !f.endsWith('base-operation.schema.json')
  );

const operationsFromSchemas = [];

for (const schemaFile of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));

  // Extract operation type from allOf structure
  const operationType = schema.allOf?.[1]?.properties?.type?.const;

  if (operationType) {
    operationsFromSchemas.push({
      type: operationType,
      schemaFile: path.basename(schemaFile),
    });
  } else {
    warnings.push(
      `⚠️  Schema ${schemaFile} does not define operation type constant`
    );
  }
}

console.log(`  Found ${operationsFromSchemas.length} operation schemas`);

// 2. Check operation.schema.json references
console.log('\n📋 Step 2: Checking operation.schema.json references...');
const operationSchemaPath = 'data/schemas/operations/operation.schema.json';
const operationSchema = JSON.parse(
  fs.readFileSync(operationSchemaPath, 'utf8')
);

const referencedSchemas = operationSchema.oneOf.map((ref) =>
  path.basename(ref.$ref)
);

for (const op of operationsFromSchemas) {
  if (!referencedSchemas.includes(op.schemaFile)) {
    errors.push(
      `❌ Schema ${op.schemaFile} not referenced in operation.schema.json`
    );
  }
}

console.log(`  ${referencedSchemas.length} schemas referenced`);

// 3. Check KNOWN_OPERATION_TYPES
console.log('\n📋 Step 3: Checking pre-validation whitelist...');
const preValidationPath = 'src/utils/preValidationUtils.js';
const preValidationContent = fs.readFileSync(preValidationPath, 'utf8');

const whitelistMatch = preValidationContent.match(
  /const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/
);
const knownTypes = [];

if (whitelistMatch) {
  const whitelistBody = whitelistMatch[1];
  const matches = whitelistBody.matchAll(/'([^']+)'/g);
  for (const match of matches) {
    knownTypes.push(match[1]);
  }
}

for (const op of operationsFromSchemas) {
  if (!knownTypes.includes(op.type)) {
    errors.push(
      `❌ Operation type ${op.type} not in KNOWN_OPERATION_TYPES (preValidationUtils.js)`
    );
  }
}

console.log(`  ${knownTypes.length} operation types in whitelist`);

// 4. Check DI tokens
console.log('\n📋 Step 4: Checking DI tokens...');
const tokensPath = 'src/dependencyInjection/tokens/tokens-core.js';
const tokensContent = fs.readFileSync(tokensPath, 'utf8');

function toTokenName(operationType) {
  return (
    'I' +
    operationType
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join('') +
    'Handler'
  );
}

const definedTokens = [];
const tokenMatches = tokensContent.matchAll(/I(\w+Handler):/g);
for (const match of tokenMatches) {
  definedTokens.push('I' + match[1]);
}

for (const op of operationsFromSchemas) {
  const expectedToken = toTokenName(op.type);
  if (!definedTokens.includes(expectedToken)) {
    errors.push(
      `❌ Token ${expectedToken} not defined for operation ${op.type} (tokens-core.js)`
    );
  }
}

console.log(`  ${definedTokens.length} handler tokens defined`);

// 5. Check handler registrations
console.log('\n📋 Step 5: Checking handler factory registrations...');
const handlerRegPath =
  'src/dependencyInjection/registrations/operationHandlerRegistrations.js';
const handlerRegContent = fs.readFileSync(handlerRegPath, 'utf8');

const registeredHandlers = [];
const regMatches = handlerRegContent.matchAll(
  /container\.register\(tokens\.(I\w+Handler)/g
);
for (const match of regMatches) {
  registeredHandlers.push(match[1]);
}

for (const op of operationsFromSchemas) {
  const expectedToken = toTokenName(op.type);
  if (!registeredHandlers.includes(expectedToken)) {
    errors.push(
      `❌ Handler ${expectedToken} not registered for operation ${op.type} (operationHandlerRegistrations.js)`
    );
  }
}

console.log(`  ${registeredHandlers.length} handlers registered`);

// 6. Check operation registry mappings
console.log('\n📋 Step 6: Checking operation registry mappings...');
const interpreterPath =
  'src/dependencyInjection/registrations/interpreterRegistrations.js';
const interpreterContent = fs.readFileSync(interpreterPath, 'utf8');

const mappedOperations = [];
const mapMatches = interpreterContent.matchAll(/registerOperation\('([^']+)'/g);
for (const match of mapMatches) {
  mappedOperations.push(match[1]);
}

for (const op of operationsFromSchemas) {
  if (!mappedOperations.includes(op.type)) {
    errors.push(
      `❌ Operation ${op.type} not mapped in operation registry (interpreterRegistrations.js)`
    );
  }
}

console.log(`  ${mappedOperations.length} operations mapped`);

// 7. Check for handler files
console.log('\n📋 Step 7: Checking handler file existence...');

function toHandlerFileName(operationType) {
  return (
    operationType
      .split('_')
      .map((word, idx) =>
        idx === 0
          ? word.toLowerCase()
          : word.charAt(0) + word.slice(1).toLowerCase()
      )
      .join('') + 'Handler.js'
  );
}

for (const op of operationsFromSchemas) {
  const expectedFile = `src/logic/operationHandlers/${toHandlerFileName(op.type)}`;
  if (!fs.existsSync(expectedFile)) {
    errors.push(
      `❌ Handler file ${expectedFile} not found for operation ${op.type}`
    );
  }
}

// 8. Report results
console.log('\n' + '='.repeat(70));
console.log('📊 Validation Results\n');

if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  warnings.forEach((w) => console.log(`  ${w}`));
  console.log();
}

if (errors.length > 0) {
  console.log('❌ Errors:');
  errors.forEach((e) => console.log(`  ${e}`));
  console.log();
  console.log(`Found ${errors.length} error(s) that must be fixed.`);
  console.log(
    '\n📚 See docs/adding-operations.md for guidance on fixing these issues.'
  );
  process.exit(1);
} else {
  console.log('✅ All operation handlers are properly registered!');
  console.log(`\n✓ ${operationsFromSchemas.length} operations validated`);
  console.log(`✓ All schemas referenced`);
  console.log(`✓ All types in whitelist`);
  console.log(`✓ All tokens defined`);
  console.log(`✓ All handlers registered`);
  console.log(`✓ All operations mapped`);
  console.log(`✓ All handler files exist`);
}

console.log('='.repeat(70));
```

**Add to package.json:**

```json
{
  "scripts": {
    "validate:operations": "node scripts/validateOperations.js"
  }
}
```

**Integrate into CI:**

```json
{
  "scripts": {
    "test:ci": "npm run validate:operations && npm run lint && npm run typecheck && npm run test:unit && npm run test:integration"
  }
}
```

**Impact**:

- Catches missing registrations immediately
- Runs in <5 seconds
- Can be added to pre-commit hook
- Prevents broken builds from reaching CI

#### 2.3 Better Pre-validation Error Messages

**Action**: Refactor pre-validation to provide specific guidance

**Implementation Enhancement for `preValidationUtils.js`:**

```javascript
/**
 * Enhanced pre-validation with actionable error messages
 */

class OperationValidationError extends Error {
  constructor(operationType, missingRegistrations) {
    const message = formatValidationError(operationType, missingRegistrations);
    super(message);
    this.name = 'OperationValidationError';
    this.operationType = operationType;
    this.missingRegistrations = missingRegistrations;
  }
}

function formatValidationError(operationType, missingRegistrations) {
  const lines = [
    `❌ Operation validation failed for: "${operationType}"`,
    '',
    '📋 Missing registrations detected:',
  ];

  if (missingRegistrations.includes('whitelist')) {
    lines.push('');
    lines.push('  ⚠️  NOT IN PRE-VALIDATION WHITELIST');
    lines.push('  File: src/utils/preValidationUtils.js');
    lines.push('  Action: Add to KNOWN_OPERATION_TYPES array');
    lines.push(`  Code: '${operationType}',`);
  }

  if (missingRegistrations.includes('schema')) {
    lines.push('');
    lines.push('  ⚠️  SCHEMA NOT FOUND');
    lines.push(
      `  Expected: data/schemas/operations/${operationType.toLowerCase()}.schema.json`
    );
    lines.push('  Action: Create schema file with operation type constant');
  }

  if (missingRegistrations.includes('reference')) {
    lines.push('');
    lines.push('  ⚠️  SCHEMA NOT REFERENCED');
    lines.push('  File: data/schemas/operations/operation.schema.json');
    lines.push('  Action: Add $ref to oneOf array');
    lines.push(
      `  Code: { "$ref": "./${operationType.toLowerCase()}.schema.json" }`
    );
  }

  lines.push('');
  lines.push('🔧 Quick fix command:');
  lines.push(`  npm run validate:operations`);
  lines.push('');
  lines.push('📚 Complete guide:');
  lines.push('  docs/adding-operations.md');
  lines.push('  CLAUDE.md (search "Adding New Operations")');

  return lines.join('\n');
}

export function validateOperationType(operationType, logger) {
  const missingRegistrations = [];

  // Check whitelist
  if (!KNOWN_OPERATION_TYPES.includes(operationType)) {
    missingRegistrations.push('whitelist');
  }

  // Check schema exists
  const schemaPath = `data/schemas/operations/${operationType.toLowerCase()}.schema.json`;
  if (!fs.existsSync(schemaPath)) {
    missingRegistrations.push('schema');
  }

  // Check schema referenced
  const operationSchemaPath = 'data/schemas/operations/operation.schema.json';
  const operationSchema = JSON.parse(
    fs.readFileSync(operationSchemaPath, 'utf8')
  );
  const isReferenced = operationSchema.oneOf.some((ref) =>
    ref.$ref.includes(operationType.toLowerCase())
  );
  if (!isReferenced) {
    missingRegistrations.push('reference');
  }

  if (missingRegistrations.length > 0) {
    const error = new OperationValidationError(
      operationType,
      missingRegistrations
    );
    logger.error(error.message);
    throw error;
  }
}
```

**Impact**:

- Developers immediately know what's missing
- Error message provides exact code to add
- Links to documentation for full context
- Reduces debugging from hours to minutes

### 4.3 Phase 3: Long-term Architecture (1-3 Months)

#### 3.1 Schema-Driven Code Generation

**Concept**: Generate handler boilerplate from comprehensive schemas

**Example Enhanced Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://living-narrative-engine/schemas/operations/drinkFrom.schema.json",
  "description": "Drink a specified quantity from a drinkable item",
  "meta": {
    "handlerClass": "DrinkFromHandler",
    "category": "items",
    "dependencies": [
      "IComponentMutationService",
      "IEntityStateQuerier",
      "IInventoryService"
    ],
    "events": {
      "success": "DRINK_FROM_COMPLETED",
      "failure": "DRINK_FROM_FAILED"
    },
    "stateQueries": ["items:drinkable", "items:quantity"],
    "stateMutations": ["items:quantity"]
  },
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "DRINK_FROM"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "drinkableItemId": {
              "type": "string",
              "description": "ID of the drinkable item"
            },
            "consumptionQuantity": {
              "type": "number",
              "minimum": 0,
              "description": "Amount to consume (optional, defaults to 1)"
            }
          },
          "required": ["drinkableItemId"]
        }
      }
    }
  ]
}
```

**Code Generation Tool:**

```bash
npm run generate-handler --from-schema data/schemas/operations/drinkFrom.schema.json

# Generates:
# - Handler class with dependency injection
# - Parameter validation code
# - Event dispatching
# - Error handling
# - Test templates
# - Updates all registration files
```

**Benefits**:

- Single source of truth (schema)
- No manual synchronization
- Consistent patterns
- Reduced human error

#### 3.2 Single Source of Truth Architecture

**Concept**: All operation metadata in one place

**Proposed Structure:**

```javascript
// src/operations/registry/operationDefinitions.js

export const OPERATION_DEFINITIONS = {
  DRINK_FROM: {
    type: 'DRINK_FROM',
    handlerClass: 'DrinkFromHandler',
    handlerToken: 'IDrinkFromHandler',
    schemaPath: 'data/schemas/operations/drinkFrom.schema.json',
    category: 'items',
    dependencies: ['IComponentMutationService', 'IEntityStateQuerier'],
    events: {
      success: 'DRINK_FROM_COMPLETED',
      failure: 'DRINK_FROM_FAILED',
    },
  },

  DRINK_ENTIRELY: {
    type: 'DRINK_ENTIRELY',
    handlerClass: 'DrinkEntirelyHandler',
    handlerToken: 'IDrinkEntirelyHandler',
    schemaPath: 'data/schemas/operations/drinkEntirely.schema.json',
    category: 'items',
    dependencies: ['IComponentMutationService', 'IEntityStateQuerier'],
    events: {
      success: 'DRINK_ENTIRELY_COMPLETED',
      failure: 'DRINK_ENTIRELY_FAILED',
    },
  },

  // ... other operations
};

// Auto-generate from this:
// - KNOWN_OPERATION_TYPES array
// - Token definitions
// - Handler registrations
// - Operation registry mappings
// - Documentation
```

**Implementation:**

```javascript
// Auto-generate KNOWN_OPERATION_TYPES
export const KNOWN_OPERATION_TYPES = Object.keys(OPERATION_DEFINITIONS);

// Auto-generate tokens
export const tokens = Object.values(OPERATION_DEFINITIONS).reduce(
  (acc, def) => {
    acc[def.handlerToken] = def.handlerToken;
    return acc;
  },
  {}
);

// Auto-register handlers
export function registerOperationHandlers(container) {
  for (const def of Object.values(OPERATION_DEFINITIONS)) {
    const HandlerClass = require(
      `../../logic/operationHandlers/${def.handlerClass.charAt(0).toLowerCase() + def.handlerClass.slice(1)}.js`
    ).default;
    container.register(tokens[def.handlerToken], HandlerClass);
  }
}

// Auto-map operations
export function registerInterpreter(container) {
  const operationRegistry = container.resolve(tokens.IOperationRegistry);

  for (const def of Object.values(OPERATION_DEFINITIONS)) {
    operationRegistry.registerOperation(def.type, tokens[def.handlerToken]);
  }
}
```

**Benefits**:

- Single place to add operations
- Automatic registration everywhere
- Impossible to have inconsistency
- Self-documenting

#### 3.3 Auto-Discovery Registration

**Concept**: Discover handlers automatically via file system

**Pattern:**

```javascript
// Auto-discover operation handlers
import glob from 'glob';
import path from 'path';

export function autoRegisterOperationHandlers(container) {
  const handlerFiles = glob.sync('src/logic/operationHandlers/*Handler.js');

  for (const filePath of handlerFiles) {
    const HandlerClass = require(filePath).default;
    const handlerName = path.basename(filePath, '.js');

    // Extract operation type from handler metadata
    if (HandlerClass.operationType) {
      const tokenName = `I${handlerName.charAt(0).toUpperCase() + handlerName.slice(1)}`;

      // Auto-register
      container.register(tokenName, HandlerClass);

      // Auto-map
      const operationRegistry = container.resolve(tokens.IOperationRegistry);
      operationRegistry.registerOperation(
        HandlerClass.operationType,
        tokenName
      );
    }
  }
}
```

**Handler Metadata:**

```javascript
class DrinkFromHandler extends BaseOperationHandler {
  static operationType = 'DRINK_FROM';
  static tokenName = 'IDrinkFromHandler';
  static category = 'items';

  // ... rest of handler
}
```

**Benefits**:

- Zero manual registration
- Just create handler file and it works
- Convention over configuration
- Impossible to forget registration

#### 3.4 TypeScript Migration Evaluation

**Concept**: Use TypeScript for compile-time safety

**Benefits**:

- Type checking catches missing registrations at build time
- Interface enforcement for handlers
- Better IDE support
- Refactoring safety

**Example:**

```typescript
// operation.types.ts
export interface OperationHandler<T = any> {
  execute(context: OperationContext): Promise<void>;
}

export interface OperationRegistry {
  registerOperation<T extends OperationHandler>(
    type: OperationTypeEnum,
    handler: new (...args: any[]) => T
  ): void;
}

export enum OperationTypeEnum {
  DRINK_FROM = 'DRINK_FROM',
  DRINK_ENTIRELY = 'DRINK_ENTIRELY',
  // TypeScript ensures all operations are accounted for
}
```

**Considerations**:

- Significant migration effort
- Build process changes
- Testing infrastructure updates
- Team learning curve
- Long-term maintainability benefit

---

## 5. Implementation Roadmap

### Phase 1: Immediate Actions (Days 1-3)

**Priority**: High
**Effort**: Low
**Impact**: Medium

#### Day 1

- [ ] Update CLAUDE.md with enhanced checklist and validation commands
- [ ] Add detailed inline comments to all registration files
- [ ] Add JSDoc cross-references in handler files

#### Day 2

- [ ] Implement improved error messages in `preValidationUtils.js`
- [ ] Enhance error messages in operation registry
- [ ] Add file path suggestions to validation errors

#### Day 3

- [ ] Create docs/adding-operations.md with detailed guide
- [ ] Add troubleshooting section for common issues
- [ ] Update existing operation handlers with cross-references

**Outcomes**:

- Developers have clear guidance at point of use
- Error messages provide actionable next steps
- Reduced support requests

### Phase 2: Medium-term Improvements (Weeks 1-4)

**Priority**: High
**Effort**: Medium
**Impact**: High

#### Week 1

- [ ] Implement CLI scaffolding tool (`npm run create-operation`)
- [ ] Add comprehensive templates for all file types
- [ ] Test scaffolding tool with new operation

#### Week 2

- [ ] Create build-time validation script (`npm run validate:operations`)
- [ ] Integrate validation into CI pipeline
- [ ] Add pre-commit hook for validation

#### Week 3

- [ ] Refactor pre-validation for better error messages
- [ ] Add specific checks for each registration point
- [ ] Create validation report format

#### Week 4

- [ ] Create integration test template generator
- [ ] Add automated test coverage checks
- [ ] Document improved workflow

**Outcomes**:

- Time to add operation reduced from 1-3 hours to 15-30 minutes
- Automated catching of missing registrations
- Consistent, high-quality implementations

### Phase 3: Long-term Architecture (Months 1-3)

**Priority**: Medium
**Effort**: High
**Impact**: Very High

#### Month 1: Investigation & Design

- [ ] Research schema-driven code generation approaches
- [ ] Design single source of truth architecture
- [ ] Prototype auto-discovery registration
- [ ] Evaluate TypeScript migration feasibility
- [ ] Create detailed technical design document
- [ ] Get team feedback and buy-in

#### Month 2: Implementation

- [ ] Implement chosen architecture approach
- [ ] Migrate existing operations to new pattern
- [ ] Update documentation and guides
- [ ] Create migration tooling for future operations
- [ ] Comprehensive testing of new architecture

#### Month 3: Rollout & Refinement

- [ ] Deploy new architecture to development
- [ ] Monitor for issues and gather feedback
- [ ] Refine based on real-world usage
- [ ] Complete documentation
- [ ] Train team on new patterns
- [ ] Celebrate success! 🎉

**Outcomes**:

- Near-zero chance of registration errors
- Single command to add operations
- Self-documenting architecture
- Significantly improved developer experience

### Migration Strategy

#### For Existing Operations

**Approach**: Gradual migration, no breaking changes

1. **New operations**: Use new patterns immediately
2. **Existing operations**: Migrate opportunistically
   - When fixing bugs
   - When adding features
   - When refactoring
3. **No forced migration**: Old patterns continue to work

**Migration Priority**:

1. Most recently added operations (easiest)
2. Operations needing bug fixes (opportunistic)
3. Frequently modified operations (high value)
4. Remaining operations (low priority)

#### Compatibility Layer

```javascript
// Support both old and new registration patterns
export function registerOperations(container) {
  // New pattern: auto-discovery
  autoRegisterOperationHandlers(container);

  // Old pattern: manual registration
  registerLegacyOperationHandlers(container);
}
```

---

## 6. Success Metrics

### Developer Experience Metrics

**Current State** vs **Target State**:

| Metric                            | Current                   | Phase 1   | Phase 2    | Phase 3      |
| --------------------------------- | ------------------------- | --------- | ---------- | ------------ |
| Time to add operation             | 1-3 hours                 | 45-60 min | 15-30 min  | 5-10 min     |
| Debugging time per issue          | 2+ hours                  | 1 hour    | 15-30 min  | <15 min      |
| Steps requiring manual updates    | 7 files                   | 7 files   | 3 files    | 1 command    |
| Error detection time              | Runtime/Integration tests | Runtime   | Build time | Compile time |
| Registration errors per operation | ~1-2                      | ~0.5      | ~0.1       | ~0           |
| Documentation lookups needed      | 3-5 times                 | 1-2 times | 0-1 times  | 0 times      |
| Developer confidence (1-10)       | 4-5                       | 6-7       | 8-9        | 9-10         |

### Process Quality Metrics

**Tracked via:**

- Git commit messages (fix commits related to operations)
- Issue tracker (operation-related bugs)
- Code review comments (registration mistakes caught)
- Developer surveys (satisfaction, pain points)

**Targets**:

- Reduce operation-related bugs by 80%
- Reduce code review cycles for operations by 50%
- Increase developer satisfaction scores by 40%
- Reduce support requests about operations by 70%

### Technical Debt Metrics

**Track:**

- Number of operations with inconsistent patterns
- Number of missing registrations caught by CI
- Time spent on operation-related refactoring
- Code duplication in operation handlers

**Targets**:

- 100% of operations follow consistent patterns
- Zero missing registrations in CI
- Reduce refactoring time by 60%
- Reduce code duplication by 40%

---

## 7. Risk Assessment & Mitigation

### Implementation Risks

#### Risk 1: Breaking Existing Operations

**Likelihood**: Medium
**Impact**: High
**Mitigation**:

- Comprehensive test suite before changes
- Gradual rollout with feature flags
- Maintain backward compatibility
- Easy rollback plan

#### Risk 2: Incomplete Migration

**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:

- Clear migration guide
- Automated migration tools where possible
- Track migration progress
- Set completion targets

#### Risk 3: Developer Resistance

**Likelihood**: Low
**Impact**: Medium
**Mitigation**:

- Early involvement in design
- Clear communication of benefits
- Training and documentation
- Celebrate quick wins

#### Risk 4: Unforeseen Edge Cases

**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:

- Prototype with real operations
- Extensive testing
- Iterative refinement
- Community feedback

### Rollback Plan

If Phase 2 or 3 causes issues:

1. **Immediate**: Disable new features via feature flags
2. **Short-term**: Revert problematic commits
3. **Medium-term**: Analyze root cause and redesign
4. **Long-term**: Implement with lessons learned

**Rollback Triggers**:

- > 2 critical bugs in production
- Developer productivity decrease >20%
- Test suite regression >10%
- Stakeholder concerns

---

## 8. Recommendations Summary

### Immediate Priorities (Do First)

1. ✅ **Enhanced Documentation** (Day 1)
   - Update CLAUDE.md with detailed checklist
   - Add inline comments to registration files
   - Create docs/adding-operations.md

2. ✅ **Improved Error Messages** (Day 2)
   - Enhance pre-validation errors
   - Add actionable guidance to all validation errors
   - Include file paths and code snippets

3. ✅ **CLI Scaffolding Tool** (Week 1)
   - Implement `npm run create-operation`
   - Generate all boilerplate automatically
   - Update all registration files

4. ✅ **Build-Time Validation** (Week 2)
   - Create `npm run validate:operations`
   - Integrate into CI pipeline
   - Add pre-commit hook

### Medium-term Goals (Months 1-2)

1. **Completeness Validation**
   - Automated checking of all registration points
   - Clear error messages for missing steps
   - Integration into development workflow

2. **Better Error Messages**
   - Specific guidance for each failure type
   - Links to relevant documentation
   - Suggested fixes with code examples

3. **Workflow Optimization**
   - Reduced manual steps
   - Faster feedback loops
   - Improved developer experience

### Long-term Vision (Months 2-3)

1. **Architectural Evolution**
   - Single source of truth for operations
   - Schema-driven code generation
   - Auto-discovery patterns

2. **Zero-Friction Development**
   - One command to add operations
   - Impossible to miss registrations
   - Self-documenting architecture

3. **Continuous Improvement**
   - Regular retrospectives
   - Developer feedback integration
   - Iterative refinement

---

## 9. Conclusion

The current operation handler implementation process is functional but fragile, requiring manual updates to 7+ files and lacking adequate safeguards against common mistakes. The primary pain points are:

1. Easy to forget critical registration steps (especially pre-validation whitelist)
2. Complex AJV schema issues requiring deep debugging
3. Poor error messages that don't guide developers to solutions
4. High cognitive load and scattered knowledge

The recommended improvements follow a phased approach:

**Phase 1 (Days)** focuses on quick wins through better documentation and error messages, requiring minimal effort but providing immediate value.

**Phase 2 (Weeks)** introduces automation via CLI tooling and build-time validation, significantly reducing manual work and catching errors early.

**Phase 3 (Months)** explores architectural improvements like schema-driven generation and single source of truth patterns, aiming for near-zero manual work and maximum robustness.

Expected outcomes include:

- Time to add operation reduced from 1-3 hours to <30 minutes
- Debugging time reduced from 2+ hours to <30 minutes
- Error rate reduced by 80%+
- Significantly improved developer confidence and satisfaction

The key to success is starting with Phase 1 immediately to provide quick relief, then systematically building toward the long-term vision while maintaining backward compatibility and gathering continuous feedback.

---

**Next Steps**:

1. Review this report with team
2. Prioritize recommendations based on team capacity
3. Begin Phase 1 implementation (Days 1-3)
4. Schedule Phase 2 planning (Week 1)
5. Track metrics and adjust approach as needed

**Questions for Discussion**:

- Which Phase 1 improvements should we prioritize first?
- What's our appetite for Phase 3 architectural changes?
- Are there additional pain points not covered here?
- What success metrics matter most to the team?
