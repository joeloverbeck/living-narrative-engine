# Adding New Operations Guide

Complete guide to adding operation handlers to the Living Narrative Engine

**Last Updated**: 2025-11-08
**Related**: [CLAUDE.md](../CLAUDE.md) (quick reference), [reports/operation-handler-implementation-analysis.md](../reports/operation-handler-implementation-analysis.md) (architecture)

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Walkthrough](#step-by-step-walkthrough)
4. [Complete Example: DRINK_FROM](#complete-example-drink_from)
5. [Testing Strategy](#testing-strategy)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Topics](#advanced-topics)
8. [FAQ](#faq)
9. [Quick Reference](#quick-reference)

## Overview

### What is an Operation Handler?

Operation handlers are the execution engine for game logic defined in mod rules. When a rule's conditions are met, its operations are executed by their corresponding handlers. Each handler is responsible for:

- **Validating** operation parameters
- **Querying** current game state
- **Executing** business logic
- **Mutating** game state via the Entity Component System
- **Dispatching** events to notify other systems

**Architecture Flow:**

```
Mod Rule Definition
       ↓
Schema Validation (AJV + Pre-validation)
       ↓
Operation Registry Lookup
       ↓
Handler Execution (via DI Container)
       ↓
State Mutation + Event Dispatch
```

### Registration Points

Every operation handler requires updates to **7 critical files**:

| File                                                                        | Purpose                                  | Validation Command  |
| --------------------------------------------------------------------------- | ---------------------------------------- | ------------------- |
| 1. `data/schemas/operations/[operationName].schema.json`                    | Operation schema                         | `npm run validate`  |
| 2. `data/schemas/operation.schema.json`                                     | Schema reference (root)                  | `npm run validate`  |
| 3. `src/logic/operationHandlers/[operationName]Handler.js`                  | Handler implementation                   | `npm run typecheck` |
| 4. `src/dependencyInjection/tokens/tokens-core.js`                          | DI token                                 | `npm run typecheck` |
| 5. `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Factory registration                     | `npm run typecheck` |
| 6. `src/dependencyInjection/registrations/interpreterRegistrations.js`      | Operation mapping                        | `npm run test:unit` |
| 7. `src/utils/preValidationUtils.js`                                        | **⚠️ CRITICAL** Pre-validation whitelist | `npm run validate`  |

**Forgetting step 7 is the #1 cause of "Unknown operation type" errors during mod loading.**

### Time Expectations

- **With this guide**: 15-30 minutes
- **With CLI tool** (`npm run create-operation`): 5-10 minutes (when available)
- **Without guide**: 1-3 hours (with debugging)

## Prerequisites

### Required Knowledge

- JavaScript ES6+ syntax (classes, async/await, destructuring)
- JSON Schema basics (properties, required, patterns)
- Dependency injection concepts (tokens, factories, singletons)
- Understanding of the Entity Component System pattern

### Required Tools

- Node.js 18+ installed
- Project dependencies installed (`npm install`)
- Editor with JavaScript support (VS Code recommended)

### Recommended Reading

- `CLAUDE.md` - Project overview and conventions
- `docs/architecture/ecs-architecture.md` - ECS pattern (if available)
- `docs/architecture/event-bus.md` - Event system (if available)

## Step-by-Step Walkthrough

### Step 1: Create Operation Schema

**File**: `data/schemas/operations/drinkFrom.schema.json`

**Purpose**: Defines operation structure and parameter validation. This schema is used by AJV to validate operation data before execution.

**Template**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/drinkFrom.schema.json",
  "title": "DRINK_FROM Operation",
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
          "$ref": "#/$defs/Parameters"
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the DRINK_FROM operation. Consumes a single serving from a liquid container, tracking volume and managing empty state transitions.",
      "properties": {
        "actorEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the actor drinking from the container"
        },
        "containerEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the liquid container being consumed from"
        },
        "result_variable": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$",
          "description": "Optional variable name to store the operation result. Result includes {success: boolean, error?: string, volumeConsumed?: number, flavorText?: string}"
        }
      },
      "required": ["actorEntity", "containerEntity"],
      "additionalProperties": false
    }
  }
}
```

**Key Points**:

- `$id` must be unique and follow `schema://living-narrative-engine/operations/[name].schema.json` pattern
- `title` should match operation type for clarity
- **`type.const` is the operation type** - This must be consistent across all files
- Use `allOf` to extend `base-operation.schema.json` (provides common operation structure)
- Define parameters in `$defs/Parameters` section
- Use `pattern: "^\\S(.*\\S)?$"` to ensure no leading/trailing whitespace
- Mark required parameters in `required` array
- Set `additionalProperties: false` to catch typos in mod rules

**Validation**:

```bash
npm run validate
# Or for strict validation with all checks:
npm run validate:strict
```

**Common Errors**:

- ❌ Typo in `$ref` path → "Cannot resolve reference"
- ❌ Missing `type.const` → "Schema validation failed"
- ❌ Invalid JSON syntax → "Parse error at line X"
- ❌ Forgot `minLength: 1` on strings → Empty strings pass validation

---

### Step 2: Add Schema Reference

**File**: `data/schemas/operation.schema.json` (**root schemas directory**, NOT in operations/)

**Purpose**: Register schema in the operation union type so AJV can validate it during mod loading.

**Location**: This file is in `data/schemas/`, **not** in `data/schemas/operations/`

**Before**:

```json
{
  "$defs": {
    "Operation": {
      "anyOf": [
        { "$ref": "./operations/addComponent.schema.json" },
        { "$ref": "./operations/removeComponent.schema.json" }
      ]
    }
  }
}
```

**After**:

```json
{
  "$defs": {
    "Operation": {
      "anyOf": [
        { "$ref": "./operations/addComponent.schema.json" },
        { "$ref": "./operations/drinkFrom.schema.json" },
        { "$ref": "./operations/removeComponent.schema.json" }
      ]
    }
  }
}
```

**Key Points**:

- Add to `anyOf` array in the `Operation` definition within `$defs`
- **Keep alphabetically sorted** (code review standard)
- Path is `./operations/` relative to schema root directory
- File name must match exactly (case-sensitive)

**Validation**:

```bash
npm run validate
# Should now recognize your operation schema
```

**Common Errors**:

- ❌ Wrong path (e.g., `../operations/`) → "Schema not found"
- ❌ Not sorted alphabetically → Code review flag
- ❌ Typo in filename → "Cannot resolve reference"
- ❌ Wrong directory (edited operations/operation.schema.json instead) → Reference not found

---

### Step 3: Create Handler Class

**File**: `src/logic/operationHandlers/drinkFromHandler.js`

**Purpose**: Implements the operation execution logic following the 5-step pattern.

**Template**:

```javascript
/**
 * @file Handler for DRINK_FROM operation
 *
 * Consumes a single serving from a liquid container, tracking volume and managing empty state.
 *
 * Operation flow:
 * 1. Validates operation parameters (actorEntity, containerEntity)
 * 2. Verifies container has liquid_container and drinkable components
 * 3. Checks container is not empty and has sufficient volume for serving size
 * 4. Reduces current volume by serving size, updating liquid_container component
 * 5. If volume reaches zero, adds empty component and removes drinkable component
 * 6. Dispatches items:liquid_consumed event
 *
 * Related files:
 * @see data/schemas/operations/drinkFrom.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - DrinkFromHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/staticErrorDispatcher.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';

// Component and event constants
const LIQUID_CONTAINER_COMPONENT_ID = 'containers-core:liquid_container';
const DRINKABLE_COMPONENT_ID = 'items:drinkable';
const EMPTY_COMPONENT_ID = 'items:empty';
const LIQUID_CONSUMED_EVENT = 'items:liquid_consumed';

/**
 * @typedef {object} DrinkFromParams
 * @property {string} actorEntity - Entity ID of the actor drinking
 * @property {string} containerEntity - Entity ID of the liquid container
 * @property {string} [result_variable] - Optional variable name to store operation result
 */

/**
 * @typedef {object} DrinkFromResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} [error] - Error message if failed
 * @property {number} [volumeConsumed] - Milliliters consumed if successful
 * @property {string} [flavorText] - Flavor text from container if successful
 */

/**
 * Handler for DRINK_FROM operation.
 * Consumes a single serving from a liquid container, tracking volume and managing empty state.
 */
class DrinkFromHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('DrinkFromHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'hasComponent',
          'batchAddComponentsOptimized',
          'removeComponent',
        ],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Validate parameters for execute.
   *
   * @param {DrinkFromParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{actorEntity: string, containerEntity: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'DRINK_FROM')) {
      return null;
    }

    const { actorEntity, containerEntity } = params;

    if (typeof actorEntity !== 'string' || !actorEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DRINK_FROM: actorEntity is required',
        { actorEntity },
        logger
      );
      return null;
    }

    if (typeof containerEntity !== 'string' || !containerEntity.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'DRINK_FROM: containerEntity is required',
        { containerEntity },
        logger
      );
      return null;
    }

    return {
      actorEntity: actorEntity.trim(),
      containerEntity: containerEntity.trim(),
    };
  }

  /**
   * Execute the drink from operation
   *
   * @param {DrinkFromParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<DrinkFromResult>} Operation result
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Step 1: Validate parameters
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return { success: false, error: 'validation_failed' };
    }

    const { actorEntity, containerEntity } = validated;
    const { result_variable } = params;

    try {
      // Step 2: Query current state
      const liquidData = this.#entityManager.getComponentData(
        containerEntity,
        LIQUID_CONTAINER_COMPONENT_ID
      );

      if (!liquidData) {
        log.warn('Container is not a liquid container', { containerEntity });
        return { success: false, error: 'Container is not a liquid container' };
      }

      const hasDrinkable = this.#entityManager.hasComponent(
        containerEntity,
        DRINKABLE_COMPONENT_ID
      );

      if (!hasDrinkable) {
        log.warn('Container is not drinkable', { containerEntity });
        return { success: false, error: 'Container is not drinkable' };
      }

      // Step 3: Execute business logic
      const currentVolume = liquidData.currentVolumeMilliliters || 0;
      const servingSize = liquidData.servingSizeMilliliters || 0;

      if (currentVolume < servingSize) {
        log.debug('Insufficient volume in container', {
          containerEntity,
          currentVolume,
          servingSize,
        });
        return { success: false, error: 'Insufficient volume in container' };
      }

      const volumeConsumed = Math.min(servingSize, currentVolume);
      const newVolume = currentVolume - volumeConsumed;

      // Step 4: Mutate state
      if (newVolume <= 0) {
        // Container becomes empty
        const updates = [
          {
            instanceId: containerEntity,
            componentTypeId: EMPTY_COMPONENT_ID,
            componentData: {},
          },
        ];

        await this.#entityManager.batchAddComponentsOptimized(updates, true);
        await this.#entityManager.removeComponent(
          containerEntity,
          DRINKABLE_COMPONENT_ID
        );

        // Set volume to 0
        await this.#entityManager.batchAddComponentsOptimized(
          [
            {
              instanceId: containerEntity,
              componentTypeId: LIQUID_CONTAINER_COMPONENT_ID,
              componentData: {
                currentVolumeMilliliters: 0,
                maxCapacityMilliliters: liquidData.maxCapacityMilliliters,
                servingSizeMilliliters: liquidData.servingSizeMilliliters,
                isRefillable: liquidData.isRefillable,
                flavorText: liquidData.flavorText || '',
              },
            },
          ],
          true
        );
      } else {
        // Still has liquid
        await this.#entityManager.batchAddComponentsOptimized(
          [
            {
              instanceId: containerEntity,
              componentTypeId: LIQUID_CONTAINER_COMPONENT_ID,
              componentData: {
                currentVolumeMilliliters: newVolume,
                maxCapacityMilliliters: liquidData.maxCapacityMilliliters,
                servingSizeMilliliters: liquidData.servingSizeMilliliters,
                isRefillable: liquidData.isRefillable,
                flavorText: liquidData.flavorText || '',
              },
            },
          ],
          true
        );
      }

      // Step 5: Dispatch events
      this.#dispatcher.dispatch(LIQUID_CONSUMED_EVENT, {
        actorEntity,
        containerEntity,
        volumeConsumed,
      });

      // Return success with flavor text
      const result = {
        success: true,
        volumeConsumed,
        flavorText: liquidData.flavorText || '',
      };

      // Store result in context if result_variable provided
      if (
        result_variable &&
        typeof result_variable === 'string' &&
        result_variable.trim()
      ) {
        tryWriteContextVariable(
          result_variable.trim(),
          result,
          executionContext,
          undefined,
          log
        );
      }

      return result;
    } catch (error) {
      log.error('Drink from operation failed', error, {
        actorEntity,
        containerEntity,
      });
      return { success: false, error: error.message };
    }
  }
}

export default DrinkFromHandler;
```

**Key Points**:

- **Always extend `BaseOperationHandler`**
- Use private fields (`#`) for dependencies
- Pass validation options to `super()` constructor (validates dependencies at construction time)
- Standard constructor signature: `{ logger, entityManager, safeEventDispatcher }`
- Follow 5-step execution pattern:
  1. **Validate** parameters
  2. **Query** state
  3. **Execute** business logic
  4. **Mutate** state (via batchAddComponentsOptimized)
  5. **Dispatch** events
- Use `try-catch` for error handling
- Return structured result object
- Use `getLogger(executionContext)` to get context-aware logger

**Validation**:

```bash
npm run typecheck
npx eslint src/logic/operationHandlers/drinkFromHandler.js
```

**Common Errors**:

- ❌ Not extending BaseOperationHandler → Constructor fails
- ❌ Missing requiredMethods in super() → Runtime validation errors
- ❌ Direct state mutation instead of batch updates → Race conditions
- ❌ Throwing errors instead of returning {success: false} → Unhandled rejections

---

### Step 4: Define DI Token

**File**: `src/dependencyInjection/tokens/tokens-core.js`

**Purpose**: Create a unique token for the dependency injection container to resolve the handler.

**Before**:

```javascript
export const coreTokens = freeze({
  // ... other tokens ...
  DropItemAtLocationHandler: 'DropItemAtLocationHandler',
  // ... other tokens ...
});
```

**After**:

```javascript
export const coreTokens = freeze({
  // ... other tokens ...
  DrinkFromHandler: 'DrinkFromHandler',
  DropItemAtLocationHandler: 'DropItemAtLocationHandler',
  // ... other tokens ...
});
```

**Key Points**:

- Token name: `[OperationName]Handler` (PascalCase)
- **NO "I" prefix** for operation handlers (unlike service interfaces)
- **Keep alphabetically sorted**
- Token value matches token name (string)
- Example: `DrinkFromHandler` for `DRINK_FROM` operation (**not** `IDrinkFromHandler`)

**Validation**:

```bash
npm run typecheck
# Should compile without errors
```

**Common Errors**:

- ❌ Using "I" prefix (`IDrinkFromHandler`) → Inconsistent with pattern
- ❌ Not sorted alphabetically → Code review flag
- ❌ Typo in token name → Token not found during resolution
- ❌ Duplicate token → Container registration fails

---

### Step 5: Register Handler Factory

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

**Purpose**: Register the handler class with the DI container using a factory function.

**Step 5a: Import the handler**

```javascript
// At top of file with other imports (keep alphabetically sorted)
import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';
import DropItemAtLocationHandler from '../../logic/operationHandlers/dropItemAtLocationHandler.js';
```

**Step 5b: Add factory entry**

```javascript
export function registerOperationHandlers(registrar) {
  // Handler factory entries (keep alphabetically sorted by token name)
  const handlerFactories = [
    // ... other handlers ...
    [
      tokens.DrinkFromHandler,
      DrinkFromHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    [
      tokens.DropItemAtLocationHandler,
      DropItemAtLocationHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    // ... other handlers ...
  ];

  // ... rest of registration logic ...
}
```

**Key Points**:

- Array format: `[token, HandlerClass, factoryFunction]`
- Factory function receives `(container, HandlerClass)`
- Resolve dependencies from container using `c.resolve(tokens.TokenName)`
- **Keep alphabetically sorted** by token name
- Standard dependencies: `logger`, `entityManager`, `safeEventDispatcher`
- Add custom dependencies as needed (e.g., specialized services)

**Validation**:

```bash
npm run typecheck
# Should compile and show no import errors
```

**Common Errors**:

- ❌ Missing import → "Handler is not defined"
- ❌ Wrong token → "Cannot resolve token"
- ❌ Missing dependencies → Handler constructor fails at runtime
- ❌ Not sorted → Code review flag

---

### Step 6: Map Operation to Handler

**File**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

**Purpose**: Map the operation type string to the handler token in the operation registry.

**Before**:

```javascript
registrar.singletonFactory(tokens.OperationRegistry, (c) => {
  const registry = new OperationRegistry({
    logger: c.resolve(tokens.ILogger),
  });

  const bind =
    (tkn) =>
    (...args) =>
      c.resolve(tkn).execute(...args);

  // Operation mappings - keep alphabetically sorted
  registry.register('DISPATCH_EVENT', bind(tokens.DispatchEventHandler));
  registry.register(
    'DROP_ITEM_AT_LOCATION',
    bind(tokens.DropItemAtLocationHandler)
  );
  // ... other operations ...

  return registry;
});
```

**After**:

```javascript
registrar.singletonFactory(tokens.OperationRegistry, (c) => {
  const registry = new OperationRegistry({
    logger: c.resolve(tokens.ILogger),
  });

  const bind =
    (tkn) =>
    (...args) =>
      c.resolve(tkn).execute(...args);

  // Operation mappings - keep alphabetically sorted
  registry.register('DISPATCH_EVENT', bind(tokens.DispatchEventHandler));
  registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler));
  registry.register(
    'DROP_ITEM_AT_LOCATION',
    bind(tokens.DropItemAtLocationHandler)
  );
  // ... other operations ...

  return registry;
});
```

**Key Points**:

- **Operation type must match schema `const` value exactly** (e.g., `'DRINK_FROM'`)
- Format: `registry.register('OPERATION_TYPE', bind(tokens.HandlerToken));`
- **Keep alphabetically sorted** by operation type
- The `bind` function defers handler resolution until execution time
- This mapping is how the engine knows which handler to call for each operation

**Validation**:

```bash
npm run typecheck
npm run test:unit
# Unit tests will fail if registry mapping is incorrect
```

**Common Errors**:

- ❌ Type string mismatch with schema → "No handler registered" at runtime
- ❌ Wrong token → "Cannot resolve token"
- ❌ Typo in operation type → Handler never called
- ❌ Not sorted → Code review flag

---

### Step 7: Add to Pre-validation Whitelist ⚠️ CRITICAL

**File**: `src/utils/preValidationUtils.js`

**Purpose**: Add operation type to whitelist so pre-validation passes during mod loading.

**⚠️ This is the most commonly forgotten step and causes "Unknown operation type" errors.**

**Before**:

```javascript
export const KNOWN_OPERATION_TYPES = [
  'DISPATCH_EVENT',
  'DISPATCH_PERCEPTIBLE_EVENT',
  'DROP_ITEM_AT_LOCATION',
  // ... other operations ...
  'VALIDATE_INVENTORY_CAPACITY',
];
```

**After**:

```javascript
export const KNOWN_OPERATION_TYPES = [
  'DISPATCH_EVENT',
  'DISPATCH_PERCEPTIBLE_EVENT',
  'DRINK_FROM',
  'DROP_ITEM_AT_LOCATION',
  // ... other operations ...
  'VALIDATE_INVENTORY_CAPACITY',
];
```

**Key Points**:

- Add operation type to `KNOWN_OPERATION_TYPES` array
- **Must match schema `const` value exactly**
- **Keep alphabetically sorted**
- This whitelist enables fail-fast validation with clear error messages
- Without this, mods using your operation will fail to load

**Validation**:

```bash
npm run validate
npm run validate:strict
# Should pass validation for all mods using your operation
```

**Common Errors**:

- ❌ Forgetting this step → "Unknown operation type" error during mod loading
- ❌ Typo → Different error message than expected
- ❌ Not sorted → Code review flag

---

### Step 8: Create Tests

**Step 8a: Unit Test**

**File**: `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`

See [Testing Strategy](#testing-strategy) section for complete template.

**Step 8b: Integration Test**

**File**: `tests/integration/mods/items/drinkFromRuleExecution.test.js`

See [Testing Strategy](#testing-strategy) section for complete template.

**Validation**:

```bash
npm run test:unit
npm run test:integration
# All tests should pass
```

---

## Complete Example: DRINK_FROM

### File Overview

This section shows all 7 required files side-by-side for the `DRINK_FROM` operation:

#### 1. Operation Schema

**File**: `data/schemas/operations/drinkFrom.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/drinkFrom.schema.json",
  "title": "DRINK_FROM Operation",
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
          "$ref": "#/$defs/Parameters"
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "type": "object",
      "description": "Parameters for the DRINK_FROM operation",
      "properties": {
        "actorEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the actor drinking"
        },
        "containerEntity": {
          "type": "string",
          "minLength": 1,
          "pattern": "^\\S(.*\\S)?$",
          "description": "Entity ID of the liquid container"
        },
        "result_variable": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$",
          "description": "Optional result variable"
        }
      },
      "required": ["actorEntity", "containerEntity"],
      "additionalProperties": false
    }
  }
}
```

#### 2. Schema Reference

**File**: `data/schemas/operation.schema.json` (excerpt showing where to add)

```json
{
  "$defs": {
    "Operation": {
      "anyOf": [
        { "$ref": "./operations/drinkFrom.schema.json" },
        ...
      ]
    }
  }
}
```

#### 3. Handler Implementation

See Step 3 for complete implementation (approximately 200 lines).

#### 4. DI Token

**File**: `src/dependencyInjection/tokens/tokens-core.js` (excerpt)

```javascript
export const coreTokens = freeze({
  DrinkFromHandler: 'DrinkFromHandler',
  // ... other tokens ...
});
```

#### 5. Handler Registration

**File**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (excerpt)

```javascript
import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';

export function registerOperationHandlers(registrar) {
  const handlerFactories = [
    [
      tokens.DrinkFromHandler,
      DrinkFromHandler,
      (c, Handler) =>
        new Handler({
          logger: c.resolve(tokens.ILogger),
          entityManager: c.resolve(tokens.IEntityManager),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        }),
    ],
    // ... other handlers ...
  ];
}
```

#### 6. Operation Mapping

**File**: `src/dependencyInjection/registrations/interpreterRegistrations.js` (excerpt)

```javascript
registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler));
```

#### 7. Pre-validation Whitelist

**File**: `src/utils/preValidationUtils.js` (excerpt)

```javascript
export const KNOWN_OPERATION_TYPES = [
  'DRINK_FROM',
  // ... other operations ...
];
```

### Validation Sequence

```bash
# 1. Validate schemas
npm run validate

# 2. Type check TypeScript definitions
npm run typecheck

# 3. Lint modified files
npx eslint src/logic/operationHandlers/drinkFromHandler.js

# 4. Run unit tests
npm run test:unit

# 5. Run integration tests
npm run test:integration

# 6. Full test suite
npm run test:ci
```

---

## Testing Strategy

### Unit Test Template

**File**: `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import DrinkFromHandler from '../../../src/logic/operationHandlers/drinkFromHandler.js';

describe('DrinkFromHandler', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let executionContext;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      batchAddComponentsOptimized: jest.fn(),
      removeComponent: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    handler = new DrinkFromHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
    });

    executionContext = {
      logger: mockLogger,
    };
  });

  describe('execute', () => {
    it('should consume liquid from container successfully', async () => {
      // Arrange
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
      };

      mockEntityManager.getComponentData.mockReturnValue({
        currentVolumeMilliliters: 500,
        maxCapacityMilliliters: 1000,
        servingSizeMilliliters: 200,
        isRefillable: true,
        flavorText: 'Cool water',
      });

      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.batchAddComponentsOptimized.mockResolvedValue(
        undefined
      );

      // Act
      const result = await handler.execute(params, executionContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.volumeConsumed).toBe(200);
      expect(result.flavorText).toBe('Cool water');
      expect(mockEntityManager.batchAddComponentsOptimized).toHaveBeenCalled();
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'items:liquid_consumed',
        {
          actorEntity: 'actor1',
          containerEntity: 'container1',
          volumeConsumed: 200,
        }
      );
    });

    it('should mark container as empty when volume reaches zero', async () => {
      // Arrange
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
      };

      mockEntityManager.getComponentData.mockReturnValue({
        currentVolumeMilliliters: 200,
        maxCapacityMilliliters: 1000,
        servingSizeMilliliters: 200,
        isRefillable: true,
        flavorText: 'Cool water',
      });

      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.batchAddComponentsOptimized.mockResolvedValue(
        undefined
      );
      mockEntityManager.removeComponent.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(params, executionContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.volumeConsumed).toBe(200);
      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        'container1',
        'items:drinkable'
      );
      // Should add empty component
      expect(
        mockEntityManager.batchAddComponentsOptimized
      ).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentTypeId: 'items:empty',
          }),
        ]),
        true
      );
    });

    it('should return error when container is not drinkable', async () => {
      // Arrange
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
      };

      mockEntityManager.getComponentData.mockReturnValue({
        currentVolumeMilliliters: 500,
      });
      mockEntityManager.hasComponent.mockReturnValue(false); // Not drinkable

      // Act
      const result = await handler.execute(params, executionContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Container is not drinkable');
    });

    it('should return error when insufficient volume', async () => {
      // Arrange
      const params = {
        actorEntity: 'actor1',
        containerEntity: 'container1',
      };

      mockEntityManager.getComponentData.mockReturnValue({
        currentVolumeMilliliters: 100,
        servingSizeMilliliters: 200,
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      // Act
      const result = await handler.execute(params, executionContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient volume in container');
    });

    it('should validate parameters correctly', async () => {
      // Arrange
      const invalidParams = {
        actorEntity: '', // Invalid: empty string
        containerEntity: 'container1',
      };

      // Act
      const result = await handler.execute(invalidParams, executionContext);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('validation_failed');
    });
  });
});
```

### Integration Test Template

**File**: `tests/integration/mods/items/drinkFromRuleExecution.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';

describe('DRINK_FROM Rule Execution', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('items', 'items:drink_from');
  });

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
    }
  });

  it('should successfully execute drink_from action', async () => {
    // Arrange: Create actor with container
    const actor = fixture.createEntity('actor', [
      { type: 'core:actor', data: { name: 'Test Actor' } },
      { type: 'core:position', data: { locationId: 'test-location' } },
      {
        type: 'items:inventory',
        data: { items: ['water-bottle'], capacity: 10 },
      },
    ]);

    const container = fixture.createEntity('water-bottle', [
      { type: 'items:item', data: { name: 'Water Bottle' } },
      { type: 'items:portable', data: {} },
      { type: 'items:drinkable', data: {} },
      {
        type: 'containers-core:liquid_container',
        data: {
          currentVolumeMilliliters: 500,
          maxCapacityMilliliters: 1000,
          servingSizeMilliliters: 200,
          isRefillable: true,
          flavorText: 'Cool refreshing water',
        },
      },
    ]);

    // Act: Execute drink_from action
    const result = await fixture.executeAction(actor.id, container.id);

    // Assert: Verify state changes
    expect(result.success).toBe(true);

    const updatedContainer = fixture.getComponentData(
      container.id,
      'containers-core:liquid_container'
    );
    expect(updatedContainer.currentVolumeMilliliters).toBe(300); // 500 - 200

    // Verify event was dispatched
    const events = fixture.getDispatchedEvents('items:liquid_consumed');
    expect(events).toHaveLength(1);
    expect(events[0].actorEntity).toBe(actor.id);
    expect(events[0].containerEntity).toBe(container.id);
    expect(events[0].volumeConsumed).toBe(200);
  });

  it('should mark container as empty when volume depleted', async () => {
    // Arrange: Create container with exactly one serving left
    const actor = fixture.createEntity('actor', [
      { type: 'core:actor', data: { name: 'Test Actor' } },
      {
        type: 'items:inventory',
        data: { items: ['water-bottle'], capacity: 10 },
      },
    ]);

    const container = fixture.createEntity('water-bottle', [
      { type: 'items:drinkable', data: {} },
      {
        type: 'containers-core:liquid_container',
        data: {
          currentVolumeMilliliters: 200, // Exactly one serving
          servingSizeMilliliters: 200,
        },
      },
    ]);

    // Act
    await fixture.executeAction(actor.id, container.id);

    // Assert
    const hasEmpty = fixture.hasComponent(container.id, 'items:empty');
    const hasDrinkable = fixture.hasComponent(container.id, 'items:drinkable');

    expect(hasEmpty).toBe(true);
    expect(hasDrinkable).toBe(false);
  });
});
```

### Test Coverage Goals

- **Unit Tests**: 100% coverage of handler logic
  - All success paths
  - All error conditions
  - Edge cases (exact volume, zero volume, etc.)
  - Parameter validation

- **Integration Tests**: Real-world scenarios
  - Full rule execution with real entity states
  - Event dispatching verification
  - Component state changes
  - Multi-step workflows

---

## Troubleshooting

### Error: "Unknown operation type"

**Symptom**: During mod loading

```
Error: Unknown operation type: DRINK_FROM
```

**Cause**: Operation not in `KNOWN_OPERATION_TYPES` whitelist

**Fix**:

1. Open `src/utils/preValidationUtils.js`
2. Add `'DRINK_FROM'` to `KNOWN_OPERATION_TYPES` array
3. Keep alphabetically sorted
4. Run `npm run validate`

**Verification**:

```bash
npm run validate
# Should now recognize the operation type
```

---

### Error: "No handler registered"

**Symptom**: When rule tries to execute

```
Error: No handler registered for operation type: DRINK_FROM
```

**Cause**: Handler not mapped in operation registry

**Fix**:

1. Check token defined: `src/dependencyInjection/tokens/tokens-core.js`
   - Ensure `DrinkFromHandler: 'DrinkFromHandler'` exists
2. Check handler registered: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
   - Ensure import statement exists
   - Ensure factory entry exists in `handlerFactories` array
3. Check operation mapped: `src/dependencyInjection/registrations/interpreterRegistrations.js`
   - Ensure `registry.register('DRINK_FROM', bind(tokens.DrinkFromHandler));` exists
4. Run validation

**Verification**:

```bash
npm run typecheck
npm run test:unit
```

---

### Error: "Cannot resolve reference"

**Symptom**: During schema validation

```
Error: Cannot resolve reference ./operations/drinkFrom.schema.json
```

**Cause**: Schema not added to operation.schema.json

**Fix**:

1. Open `data/schemas/operation.schema.json`
2. Add `{ "$ref": "./operations/drinkFrom.schema.json" }` to `anyOf` array
3. Keep alphabetically sorted
4. Verify filename matches exactly (case-sensitive)

**Verification**:

```bash
npm run validate
# Should resolve the schema reference
```

---

### Error: "Schema validation failed"

**Symptom**: When loading mods

```
Error: Schema validation failed for operation
```

**Cause**: Missing or incorrect schema properties

**Common Issues**:

1. Missing `type.const` in schema
2. Missing required parameters in rule
3. Invalid parameter types
4. Typo in parameter names

**Fix**:

1. Check schema has `type.const` property
2. Verify all required parameters are present in rule
3. Check parameter types match schema
4. Compare parameter names (case-sensitive)

**Verification**:

```bash
npm run validate:strict
# Shows detailed validation errors
```

---

### Error: "Cannot resolve token"

**Symptom**: At runtime during handler resolution

```
Error: Cannot resolve token: DrinkFromHandler
```

**Cause**: Token not defined or handler not registered

**Fix**:

1. Verify token in `tokens-core.js`:
   ```javascript
   DrinkFromHandler: 'DrinkFromHandler';
   ```
2. Verify import in `operationHandlerRegistrations.js`:
   ```javascript
   import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';
   ```
3. Verify factory registration:
   ```javascript
   [tokens.DrinkFromHandler, DrinkFromHandler, (c, Handler) => ...]
   ```

**Verification**:

```bash
npm run typecheck
# Should show no import or token errors
```

---

### Error: "Handler is not defined"

**Symptom**: During DI registration

```
ReferenceError: DrinkFromHandler is not defined
```

**Cause**: Missing import statement

**Fix**:

1. Add import at top of `operationHandlerRegistrations.js`:
   ```javascript
   import DrinkFromHandler from '../../logic/operationHandlers/drinkFromHandler.js';
   ```
2. Keep imports alphabetically sorted

**Verification**:

```bash
npm run typecheck
```

---

## Advanced Topics

### Custom Dependencies

If your handler needs additional services beyond the standard `logger`, `entityManager`, and `safeEventDispatcher`:

**Example**: Adding a custom service

```javascript
// In handler constructor
constructor({ logger, entityManager, safeEventDispatcher, customService }) {
  super('DrinkFromHandler', {
    logger: { value: logger },
    entityManager: {
      value: entityManager,
      requiredMethods: ['getComponentData', 'batchAddComponentsOptimized'],
    },
    safeEventDispatcher: {
      value: safeEventDispatcher,
      requiredMethods: ['dispatch'],
    },
    customService: {
      value: customService,
      requiredMethods: ['customMethod'],
    },
  });
  this.#customService = customService;
}
```

**In registration**:

```javascript
[
  tokens.DrinkFromHandler,
  DrinkFromHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      customService: c.resolve(tokens.ICustomService),
    }),
],
```

### Complex Parameter Validation

For complex validation logic:

```javascript
#validateParams(params, logger) {
  if (!assertParamsObject(params, this.#dispatcher, 'DRINK_FROM')) {
    return null;
  }

  const { actorEntity, containerEntity, amount } = params;

  // Custom validation
  if (amount && (typeof amount !== 'number' || amount <= 0)) {
    safeDispatchError(
      this.#dispatcher,
      'DRINK_FROM: amount must be a positive number',
      { amount },
      logger
    );
    return null;
  }

  // Range validation
  if (amount && amount > 10000) {
    safeDispatchError(
      this.#dispatcher,
      'DRINK_FROM: amount exceeds maximum (10000)',
      { amount },
      logger
    );
    return null;
  }

  return {
    actorEntity: actorEntity.trim(),
    containerEntity: containerEntity.trim(),
    amount: amount || undefined,
  };
}
```

### Event Patterns

**Best practices for event dispatching**:

1. **Use constants** for event IDs:

   ```javascript
   const LIQUID_CONSUMED_EVENT = 'items:liquid_consumed';
   ```

2. **Consistent payload structure**:

   ```javascript
   this.#dispatcher.dispatch(LIQUID_CONSUMED_EVENT, {
     actorEntity,
     containerEntity,
     volumeConsumed,
     timestamp: Date.now(),
   });
   ```

3. **Multiple events** for complex operations:

   ```javascript
   // Primary event
   this.#dispatcher.dispatch('items:liquid_consumed', {...});

   // Secondary effect event
   if (newVolume === 0) {
     this.#dispatcher.dispatch('containers-core:container_emptied', {...});
   }
   ```

### Error Handling Strategies

**Graceful degradation**:

```javascript
async execute(params, executionContext) {
  const log = this.getLogger(executionContext);

  try {
    // Attempt primary operation
    const result = await this.#primaryOperation(params);
    return { success: true, ...result };
  } catch (primaryError) {
    log.warn('Primary operation failed, attempting fallback', primaryError);

    try {
      // Attempt fallback
      const fallbackResult = await this.#fallbackOperation(params);
      return { success: true, usedFallback: true, ...fallbackResult };
    } catch (fallbackError) {
      log.error('Both primary and fallback failed', fallbackError);
      return { success: false, error: fallbackError.message };
    }
  }
}
```

---

## FAQ

**Q: Why do I need to update so many files?**

A: Each file serves a specific purpose in the operation lifecycle:

- **Schema**: Validates operation structure
- **Handler**: Implements business logic
- **Token**: Enables dependency injection
- **Registration**: Wires handler to container
- **Mapping**: Links operation type to handler
- **Whitelist**: Enables fail-fast validation

Future improvements will reduce manual work via CLI tooling and code generation.

---

**Q: Can I use async operations in my handler?**

A: Yes, the `execute` method is async. Just be sure to await all promises:

```javascript
async execute(params, executionContext) {
  const data = await this.#entityManager.getComponentData(...);
  await this.#entityManager.batchAddComponentsOptimized(...);
  return { success: true };
}
```

---

**Q: How do I test my handler in isolation?**

A: Use the unit test pattern with mocked dependencies. See [Testing Strategy](#testing-strategy) section for complete examples.

---

**Q: What if my operation needs new events?**

A: Define event type constants in your handler file:

```javascript
const MY_NEW_EVENT = 'items:my_new_event';
```

Then dispatch using the safe event dispatcher:

```javascript
this.#dispatcher.dispatch(MY_NEW_EVENT, {
  /* payload */
});
```

---

**Q: Should I return errors or throw them?**

A: **Return** structured error objects. Don't throw:

```javascript
// ✅ Correct
return { success: false, error: 'Descriptive message' };

// ❌ Wrong
throw new Error('Something failed');
```

The only exceptions should be for truly exceptional conditions (out of memory, etc.).

---

**Q: How do I handle optional parameters?**

A: Check for presence and provide defaults:

```javascript
const { actorEntity, containerEntity, amount } = params;
const finalAmount = amount ?? 200; // Use nullish coalescing
```

In the schema, don't include optional parameters in `required` array.

---

**Q: What's the difference between `entityManager` and `safeEventDispatcher`?**

A:

- **`entityManager`**: Queries and mutates component state (ECS layer)
- **`safeEventDispatcher`**: Dispatches events for inter-system communication (Event layer)

Use `entityManager` for state changes, `safeEventDispatcher` for notifications.

---

**Q: Can I call other operation handlers from my handler?**

A: Generally avoid this. Instead:

1. Use composition (extract shared logic to utility functions)
2. Use events (dispatch event, let other systems react)
3. If necessary, inject the other handler as a dependency

---

**Q: How do I debug my handler?**

A:

1. **Use logging**:

   ```javascript
   log.debug('Current state', { entityId, componentData });
   ```

2. **Enable verbose logging** in tests:

   ```javascript
   NODE_ENV=test npx jest path/to/test.js --no-coverage --verbose
   ```

3. **Use debugger**:
   ```javascript
   debugger; // Place in handler code, run tests with --inspect
   ```

---

## Quick Reference

### File Checklist

- [ ] `data/schemas/operations/[name].schema.json` created
- [ ] `data/schemas/operation.schema.json` updated (root schemas directory)
- [ ] `src/logic/operationHandlers/[name]Handler.js` created
- [ ] `src/dependencyInjection/tokens/tokens-core.js` updated
- [ ] `src/dependencyInjection/registrations/operationHandlerRegistrations.js` updated
- [ ] `src/dependencyInjection/registrations/interpreterRegistrations.js` updated
- [ ] `src/utils/preValidationUtils.js` updated ⚠️
- [ ] Unit tests created
- [ ] Integration tests created
- [ ] All tests passing
- [ ] Validation commands pass

### Naming Conventions

| Item           | Convention                           | Example                |
| -------------- | ------------------------------------ | ---------------------- |
| Operation Type | UPPER_SNAKE_CASE                     | DRINK_FROM             |
| Schema File    | camelCase + .schema.json             | drinkFrom.schema.json  |
| Handler Class  | PascalCase + Handler                 | DrinkFromHandler       |
| Handler File   | camelCase + Handler.js               | drinkFromHandler.js    |
| Token Name     | PascalCase + Handler (NO "I" prefix) | DrinkFromHandler       |
| Event ID       | namespace:snake_case                 | items:liquid_consumed  |
| Component ID   | namespace:snake_case                 | containers-core:liquid_container |

### Validation Command Sequence

```bash
# 1. Schema validation
npm run validate

# 2. Type checking
npm run typecheck

# 3. Linting (only modified files for performance)
npx eslint src/logic/operationHandlers/drinkFromHandler.js

# 4. Unit tests
npm run test:unit

# 5. Integration tests
npm run test:integration

# 6. Full CI pipeline
npm run test:ci
```

### Common Patterns

**Parameter validation**:

```javascript
#validateParams(params, logger) {
  if (!assertParamsObject(params, this.#dispatcher, 'OPERATION_TYPE')) {
    return null;
  }
  // ... validate individual parameters
  return { validatedParam1, validatedParam2 };
}
```

**State query**:

```javascript
const data = this.#entityManager.getComponentData(
  entityId,
  'namespace:component'
);
const hasComponent = this.#entityManager.hasComponent(
  entityId,
  'namespace:component'
);
```

**State mutation**:

```javascript
await this.#entityManager.batchAddComponentsOptimized(
  [
    {
      instanceId: entityId,
      componentTypeId: 'namespace:component',
      componentData: { field: value },
    },
  ],
  true
);
```

**Event dispatch**:

```javascript
this.#dispatcher.dispatch('namespace:event_name', {
  field1: value1,
  field2: value2,
});
```

**Result variable**:

```javascript
if (
  result_variable &&
  typeof result_variable === 'string' &&
  result_variable.trim()
) {
  tryWriteContextVariable(
    result_variable.trim(),
    result,
    executionContext,
    undefined,
    log
  );
}
```

## See Also

- [CLAUDE.md](../CLAUDE.md) - Quick reference checklist
- [reports/operation-handler-implementation-analysis.md](../reports/operation-handler-implementation-analysis.md) - Architecture analysis
- `docs/architecture/ecs-architecture.md` - ECS overview (if available)
- `docs/testing/mod-testing-guide.md` - Mod testing patterns
