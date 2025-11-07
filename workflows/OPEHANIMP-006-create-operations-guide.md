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

### Seven Registration Points

Every operation handler requires updates to these files:

1. `data/schemas/operations/[operationName].schema.json` - Operation schema
2. `data/schemas/operations/operation.schema.json` - Schema reference
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
  "$id": "https://living-narrative-engine/schemas/operations/drinkFrom.schema.json",
  "description": "Schema for DRINK_FROM operation. Handler: src/logic/operationHandlers/drinkFromHandler.js",
  "allOf": [
    {
      "$ref": "../base-operation.schema.json"
    },
    {
      "properties": {
        "type": {
          "const": "DRINK_FROM",
          "description": "Operation type constant - must match exactly in all registration points"
        },
        "parameters": {
          "type": "object",
          "properties": {
            "drinkableItemId": {
              "type": "string",
              "description": "ID of the drinkable item entity"
            },
            "consumptionQuantity": {
              "type": "number",
              "minimum": 0,
              "description": "Amount to consume (optional, defaults to 1)"
            }
          },
          "required": ["drinkableItemId"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

**Key Points**:
- `$id` must be unique and follow URL pattern
- `type.const` is the operation type - **MUST BE CONSISTENT EVERYWHERE**
- Use `allOf` to extend `base-operation.schema.json`
- Define all parameters with descriptions
- Mark required parameters
- Set `additionalProperties: false` to catch typos

**Validation**:
```bash
npm run validate:schemas
```

**Common Errors**:
- ❌ Typo in `$ref` path → "Cannot resolve reference"
- ❌ Missing `type.const` → "Schema validation failed"
- ❌ Invalid JSON → "Parse error"

---

### Step 2: Add Schema Reference

**File**: `data/schemas/operations/operation.schema.json`

**Purpose**: Register schema in the operation union type so AJV can validate it

**Before**:
```json
{
  "oneOf": [
    { "$ref": "./addComponent.schema.json" },
    { "$ref": "./removeComponent.schema.json" }
  ]
}
```

**After**:
```json
{
  "oneOf": [
    { "$ref": "./addComponent.schema.json" },
    { "$ref": "./drinkFrom.schema.json" },
    { "$ref": "./removeComponent.schema.json" }
  ]
}
```

**Key Points**:
- Add to `oneOf` array
- **Keep alphabetically sorted**
- Path is relative to this file
- File name must match exactly

**Validation**:
```bash
npm run validate:schemas
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
 * Processes drinking from a container or drinkable item.
 * Reduces the quantity of liquid and updates actor state.
 *
 * @see data/schemas/operations/drinkFrom.schema.json
 * @see src/dependencyInjection/tokens/tokens-core.js - IDrinkFromHandler
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js
 * @see src/utils/preValidationUtils.js
 *
 * @extends BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { validateDependency, assertPresent } from '../utils/dependencyUtils.js';

class DrinkFromHandler extends BaseOperationHandler {
  #componentMutationService;
  #entityStateQuerier;

  constructor({ componentMutationService, entityStateQuerier, logger, eventBus }) {
    super({ logger, eventBus });

    // Validate required dependencies
    validateDependency(componentMutationService, 'IComponentMutationService', logger, {
      requiredMethods: ['addComponent', 'removeComponent', 'updateComponent'],
    });
    validateDependency(entityStateQuerier, 'IEntityStateQuerier', logger, {
      requiredMethods: ['getEntity', 'hasComponent'],
    });

    this.#componentMutationService = componentMutationService;
    this.#entityStateQuerier = entityStateQuerier;
  }

  async execute(context) {
    const { parameters } = context.operation;

    try {
      // 1. Validate required parameters
      assertPresent(parameters.drinkableItemId, 'drinkableItemId is required');

      // 2. Query current state
      const item = this.#entityStateQuerier.getEntity(parameters.drinkableItemId);

      if (!this.#entityStateQuerier.hasComponent(parameters.drinkableItemId, 'items:drinkable')) {
        throw new InvalidArgumentError('Item is not drinkable');
      }

      // 3. Calculate consumption
      const consumptionQuantity = parameters.consumptionQuantity || 1;

      // 4. Mutate state
      await this.#componentMutationService.updateComponent(
        parameters.drinkableItemId,
        'items:quantity',
        (current) => ({
          ...current,
          amount: Math.max(0, current.amount - consumptionQuantity),
        })
      );

      // 5. Dispatch success event
      this.dispatchOperationEvent('DRINK_FROM_COMPLETED', {
        itemId: parameters.drinkableItemId,
        quantity: consumptionQuantity,
        actorId: context.ruleContext.actorId,
      });

    } catch (error) {
      this.handleOperationError(error, 'DRINK_FROM', context);
      throw error;
    }
  }
}

export default DrinkFromHandler;
```

**Key Points**:
- Always extend `BaseOperationHandler`
- Use private fields (`#`) for dependencies
- Validate dependencies in constructor
- Follow 5-step execution pattern:
  1. Validate parameters
  2. Query state
  3. Execute business logic
  4. Mutate state
  5. Dispatch events
- Use `try-catch` with `handleOperationError`
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
| Token Name | I + PascalCase + Handler | IDrinkFromHandler |

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
