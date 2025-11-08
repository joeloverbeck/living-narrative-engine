# OPEHANIMP-006: Create Comprehensive Adding Operations Guide

**Priority**: High
**Effort**: Medium
**Phase**: 1 (Day 3)
**Dependencies**: OPEHANIMP-001, OPEHANIMP-002, OPEHANIMP-003

## Objective

Create a comprehensive `docs/adding-operations.md` guide with detailed examples, troubleshooting steps, and real-world walkthrough of adding an operation handler from start to finish.

## Background

While CLAUDE.md provides a checklist, developers need a detailed guide with:
- Step-by-step walkthrough with actual code examples
- Troubleshooting section for common errors
- Visual diagrams of the registration flow
- Before/after examples for each file
- Testing strategies

## Requirements

### Document Structure

```markdown
# Adding New Operations Guide

Complete guide to adding operation handlers to the Living Narrative Engine

**Last Updated**: [Date]
**Related**: CLAUDE.md (quick reference), reports/operation-handler-implementation-analysis.md (architecture)

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Walkthrough](#step-by-step-walkthrough)
4. [Complete Example: DRINK_FROM](#complete-example-drink_from)
5. [Testing Strategy](#testing-strategy)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Topics](#advanced-topics)
8. [FAQ](#faq)

## Overview

### What is an Operation Handler?

Operation handlers are the execution engine for game logic defined in mod rules. When a rule's conditions are met, its operations are executed by their corresponding handlers.

**Architecture Flow:**
```
Mod Rule Definition
       ↓
Schema Validation (AJV + Pre-validation)
       ↓
Operation Registry Lookup
       ↓
Handler Execution
       ↓
State Mutation + Event Dispatch
```

### Registration Points

Every operation handler requires updates to these files:

1. `data/schemas/operations/[operationName].schema.json` - Operation schema
2. `data/schemas/operation.schema.json` - Schema reference (root schemas directory)
3. `src/logic/operationHandlers/[operationName]Handler.js` - Handler implementation
4. `src/dependencyInjection/tokens/tokens-core.js` - DI token
5. `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Factory registration
6. `src/dependencyInjection/registrations/interpreterRegistrations.js` - Operation mapping
7. `src/utils/preValidationUtils.js` - Pre-validation whitelist ⚠️ CRITICAL

### Time Expectations

- **With this guide**: 15-30 minutes
- **With CLI tool** (`npm run create-operation`): 5-10 minutes
- **Without guide**: 1-3 hours (with debugging)

## Prerequisites

### Required Knowledge

- JavaScript ES6+ syntax
- JSON Schema basics
- Dependency injection concepts
- Async/await patterns

### Required Tools

- Node.js 18+ installed
- Project dependencies installed (`npm install`)
- Editor with JavaScript support (VS Code recommended)

### Recommended Reading

- `CLAUDE.md` - Project overview and conventions
- `docs/architecture/ecs-architecture.md` - ECS pattern
- `docs/architecture/event-bus.md` - Event system

## Step-by-Step Walkthrough

### Step 1: Create Operation Schema

**File**: `data/schemas/operations/drinkFrom.schema.json`

**Purpose**: Defines operation structure and parameter validation

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
      "description": "Parameters for the DRINK_FROM operation",
      "properties": {
        "actorEntity": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the actor drinking"
        },
        "containerEntity": {
          "type": "string",
          "minLength": 1,
          "description": "Entity ID of the liquid container"
        },
        "result_variable": {
          "type": "string",
          "minLength": 1,
          "description": "Optional variable name to store operation result"
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
- `type.const` is the operation type - **MUST BE CONSISTENT EVERYWHERE**
- Use `allOf` to extend `base-operation.schema.json`
- Define parameters in `$defs/Parameters` section
- Mark required parameters
- Set `additionalProperties: false` to catch typos

**Validation**:
```bash
npm run validate
# Or for strict validation:
npm run validate:strict
```

**Common Errors**:
- ❌ Typo in `$ref` path → "Cannot resolve reference"
- ❌ Missing `type.const` → "Schema validation failed"
- ❌ Invalid JSON → "Parse error"

---

### Step 2: Add Schema Reference

**File**: `data/schemas/operation.schema.json` (root schemas directory, NOT in operations/)

**Purpose**: Register schema in the operation union type so AJV can validate it

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
- **Keep alphabetically sorted**
- Path is `./operations/` relative to schema root directory
- File name must match exactly

**Validation**:
```bash
npm run validate
# Or for strict validation:
npm run validate:strict
```

**Common Errors**:
- ❌ Wrong path → "Schema not found"
- ❌ Not sorted → Code review flag
- ❌ Typo in filename → "Cannot resolve reference"

---

### Step 3: Create Handler Class

**File**: `src/logic/operationHandlers/drinkFromHandler.js`

**Purpose**: Implements the operation execution logic

**Template**:
```javascript
/**
 * @file Handler for DRINK_FROM operation
 *
 * Consumes a single serving from a liquid container, tracking volume and managing empty state.
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

class DrinkFromHandler extends BaseOperationHandler {
  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('DrinkFromHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent', 'batchAddComponentsOptimized', 'removeComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(context) {
    const { parameters } = context.operation;

    try {
      // 1. Validate required parameters
      assertParamsObject(parameters, 'DRINK_FROM');

      // 2. Query current state
      const containerData = this.#entityManager.getComponentData(
        parameters.containerEntity,
        'items:liquid_container'
      );

      if (!this.#entityManager.hasComponent(parameters.containerEntity, 'items:drinkable')) {
        throw new Error('Container is not drinkable');
      }

      // 3. Calculate consumption
      const servingSize = containerData?.servingSize || 200;
      const newVolume = Math.max(0, containerData.currentVolume - servingSize);

      // 4. Mutate state
      const componentsToAdd = [
        {
          entityId: parameters.containerEntity,
          componentType: 'items:liquid_container',
          data: { ...containerData, currentVolume: newVolume },
        },
      ];

      if (newVolume === 0) {
        componentsToAdd.push({
          entityId: parameters.containerEntity,
          componentType: 'items:empty',
          data: {},
        });
        await this.#entityManager.removeComponent(parameters.containerEntity, 'items:drinkable');
      }

      await this.#entityManager.batchAddComponentsOptimized(componentsToAdd);

      // 5. Dispatch success event
      this.#dispatcher.dispatch({
        type: 'items:liquid_consumed',
        actorId: parameters.actorEntity,
        containerId: parameters.containerEntity,
        volumeConsumed: servingSize,
      });

    } catch (error) {
      this.logger.error('DRINK_FROM operation failed', { error, parameters });
      throw error;
    }
  }
}

export default DrinkFromHandler;
```

**Key Points**:
- Always extend `BaseOperationHandler`
- Use private fields (`#`) for dependencies
- Pass validation options to `super()` constructor (new pattern)
- Constructor signature: `{ logger, entityManager, safeEventDispatcher }` (standard dependencies)
- Follow 5-step execution pattern:
  1. Validate parameters
  2. Query state
  3. Execute business logic
  4. Mutate state
  5. Dispatch events
- Use `try-catch` for error handling
- Return `void` (state changes happen via mutations)

**Validation**:
```bash
npm run typecheck
npx eslint src/logic/operationHandlers/drinkFromHandler.js
```

---

[... Continue with steps 4-8 in similar detail ...]

## Complete Example: DRINK_FROM

[Full walkthrough with all files shown side-by-side]

## Testing Strategy

### Unit Test Template

**File**: `tests/unit/logic/operationHandlers/drinkFromHandler.test.js`

[Complete test example with multiple test cases]

### Integration Test Template

**File**: `tests/integration/mods/items/drinkFromRuleExecution.test.js`

[Complete integration test with ModTestFixture]

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
4. Run `npm run validate:operations`

---

### Error: "No handler registered"

**Symptom**: When rule tries to execute
```
Error: No handler registered for operation type: DRINK_FROM
```

**Cause**: Handler not mapped in operation registry

**Fix**:
1. Check token defined: `src/dependencyInjection/tokens/tokens-core.js`
2. Check handler registered: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
3. Check operation mapped: `src/dependencyInjection/registrations/interpreterRegistrations.js`
4. Run `npm run validate:operations`

---

[... More troubleshooting scenarios ...]

## Advanced Topics

### Custom Dependencies

[How to add custom dependencies to handlers]

### Complex Parameter Validation

[How to add custom validation logic]

### Event Patterns

[Best practices for event dispatching]

### Error Handling Strategies

[Advanced error handling patterns]

## FAQ

**Q: Why do I need to update so many files?**

A: Each file serves a specific purpose in the operation lifecycle. Future improvements will reduce manual work via CLI tooling and code generation.

**Q: Can I use async operations in my handler?**

A: Yes, the `execute` method is async. Just be sure to await all promises.

**Q: How do I test my handler in isolation?**

A: Use the unit test pattern with mocked dependencies. See Testing Strategy section.

**Q: What if my operation needs new events?**

A: Add event type constants to `src/events/eventTypes.js` and dispatch using `dispatchOperationEvent`.

[... More FAQs ...]

## Quick Reference

### File Checklist

- [ ] `data/schemas/operations/[name].schema.json` created
- [ ] `data/schemas/operations/operation.schema.json` updated
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

| Item | Convention | Example |
|------|-----------|---------|
| Operation Type | UPPER_SNAKE_CASE | DRINK_FROM |
| Schema File | camelCase + .schema.json | drinkFrom.schema.json |
| Handler Class | PascalCase + Handler | DrinkFromHandler |
| Handler File | camelCase + Handler.js | drinkFromHandler.js |
| Token Name | PascalCase + Handler (NO "I" prefix) | DrinkFromHandler |

## See Also

- `CLAUDE.md` - Quick reference checklist
- `reports/operation-handler-implementation-analysis.md` - Architecture analysis
- `docs/architecture/ecs-architecture.md` - ECS overview
```

## Acceptance Criteria

- [ ] Document is comprehensive (2000+ words)
- [ ] All 8 steps are covered in detail
- [ ] Complete code examples for each step
- [ ] Troubleshooting section covers common errors
- [ ] Testing strategy with full test templates
- [ ] FAQ section addresses common questions
- [ ] Quick reference tables and checklists
- [ ] Document is reviewed for accuracy
- [ ] Links to other documentation are valid
- [ ] Code examples are syntax-checked

## Testing

1. Have a developer follow the guide to add a new operation
2. Track time to completion
3. Note any confusing sections
4. Verify all code examples work as written
5. Test all validation commands

## Implementation Notes

- Use markdown formatting consistently
- Include code syntax highlighting
- Add visual separators between sections
- Keep examples realistic and complete
- Test all bash commands before documenting

## Time Estimate

6-8 hours

## Related Tickets

- OPEHANIMP-001: Update CLAUDE.md with enhanced checklist
- OPEHANIMP-002: Add inline documentation
- OPEHANIMP-003: Add JSDoc cross-references

## Success Metrics

- Guide enables developers to add operations in <30 minutes
- Reduced troubleshooting time to <15 minutes
- Zero questions that require guide clarification
