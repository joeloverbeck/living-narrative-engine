# GOAP-TIER1-001: Schema Design and DI Setup

**Phase:** 1 (Effects Auto-Generation)
**Timeline:** Weeks 1-2
**Status:** Not Started
**Dependencies:** None

## Overview

Design and implement the foundational architecture for GOAP Tier 1, including JSON schemas for planning effects and dependency injection setup. This ticket establishes the infrastructure that all other GOAP components will build upon.

## Workflow Validation Notes

**Last Validated:** 2025-11-10
**Validated Against:** Production codebase at commit a40ee23

**Key Corrections Made:**
1. **Container Integration:** Updated references from non-existent `containerFactory.js` to actual `baseContainerConfig.js`
2. **Token Pattern:** Added proper `freeze()` utility usage and JSDoc annotations matching project standards
3. **Token Export:** Added step to integrate goapTokens into central `tokens.js` export
4. **Schema Flexibility:** Clarified that action schema already supports additionalProperties, making explicit field definition optional

**Verified Patterns:**
- DI token structure matches existing pattern (tokens-ai.js, tokens-core.js, etc.)
- Registration bundle pattern matches existing registrations (aiRegistrations.js, etc.)
- Operation schema structure verified against existing operations (addComponent, etc.)
- Integration flow verified in baseContainerConfig.js

## Objectives

1. Create planning effects JSON schema
2. Design and document effects analyzer architecture
3. Set up DI tokens for GOAP services
4. Set up DI registrations for GOAP services
5. Document operation mapping table

## Technical Details

### 1. Planning Effects Schema

**File:** `data/schemas/planning-effects.schema.json`

Create a JSON schema defining the structure of planning effects:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "schema://living-narrative-engine/planning-effects.schema.json",
  "title": "Planning Effects",
  "description": "Planning metadata for GOAP planner (not execution code)",
  "type": "object",
  "properties": {
    "effects": {
      "type": "array",
      "description": "List of world state changes for planning",
      "items": {
        "oneOf": [
          { "$ref": "#/definitions/addComponentEffect" },
          { "$ref": "#/definitions/removeComponentEffect" },
          { "$ref": "#/definitions/modifyComponentEffect" },
          { "$ref": "#/definitions/conditionalEffect" }
        ]
      }
    },
    "cost": {
      "description": "Planning cost (default 1.0)",
      "oneOf": [
        { "type": "number", "minimum": 0 },
        { "$ref": "#/definitions/dynamicCost" }
      ]
    },
    "abstractPreconditions": {
      "type": "object",
      "description": "Abstract precondition functions used in conditional effects (optional)",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "parameters": {
            "type": "array",
            "items": { "type": "string" }
          },
          "simulationFunction": { "type": "string" }
        },
        "required": ["description", "parameters", "simulationFunction"]
      }
    }
  },
  "required": ["effects"],
  "definitions": {
    "addComponentEffect": {
      "type": "object",
      "properties": {
        "operation": { "const": "ADD_COMPONENT" },
        "entity": { "type": "string", "enum": ["actor", "target", "tertiary_target"] },
        "component": { "type": "string", "pattern": "^[a-z0-9_]+:[a-z0-9_]+$" },
        "data": { "type": "object" }
      },
      "required": ["operation", "entity", "component"]
    },
    "removeComponentEffect": {
      "type": "object",
      "properties": {
        "operation": { "const": "REMOVE_COMPONENT" },
        "entity": { "type": "string", "enum": ["actor", "target", "tertiary_target"] },
        "component": { "type": "string", "pattern": "^[a-z0-9_]+:[a-z0-9_]+$" }
      },
      "required": ["operation", "entity", "component"]
    },
    "modifyComponentEffect": {
      "type": "object",
      "properties": {
        "operation": { "const": "MODIFY_COMPONENT" },
        "entity": { "type": "string", "enum": ["actor", "target", "tertiary_target"] },
        "component": { "type": "string", "pattern": "^[a-z0-9_]+:[a-z0-9_]+$" },
        "updates": { "type": "object" }
      },
      "required": ["operation", "entity", "component", "updates"]
    },
    "conditionalEffect": {
      "type": "object",
      "properties": {
        "operation": { "const": "CONDITIONAL" },
        "condition": { "type": "object", "description": "JSON Logic condition" },
        "then": { "type": "array" }
      },
      "required": ["operation", "condition", "then"]
    },
    "dynamicCost": {
      "type": "object",
      "properties": {
        "base": { "type": "number", "minimum": 0 },
        "factors": { "type": "array" }
      },
      "required": ["base"]
    }
  }
}
```

### 2. Update Action Schema (Optional)

**File:** `data/schemas/action.schema.json`

**Note:** The action schema currently has `"additionalProperties": true` (line 261), which already allows adding `planningEffects` without explicit schema definition. However, for better documentation and type safety, you may optionally add an explicit field definition.

**Option A:** Use existing `additionalProperties` support (recommended for initial implementation)
- No schema changes needed
- Actions can include `planningEffects` field immediately
- Validates against planning-effects.schema.json when present

**Option B:** Explicitly define the field (recommended for production)

Add to the `properties` section:

```json
{
  "properties": {
    // ... existing properties ...

    "planningEffects": {
      "$ref": "schema://living-narrative-engine/planning-effects.schema.json",
      "description": "Auto-generated planning metadata for GOAP planner (optional, not used during execution)"
    }
  }
}
```

### 3. DI Tokens File

**File:** `src/dependencyInjection/tokens/tokens-goap.js`

```javascript
import { freeze } from '../../utils/cloneUtils.js';

/**
 * @file Dependency injection tokens for GOAP system
 * @typedef {string} DiToken
 */

/**
 * Tokens used by the GOAP planning system.
 *
 * @type {Readonly<Record<string, DiToken>>}
 */
export const goapTokens = freeze({
  // Analysis
  IEffectsAnalyzer: 'IEffectsAnalyzer',
  IEffectsGenerator: 'IEffectsGenerator',
  IEffectsValidator: 'IEffectsValidator',

  // Goals
  IGoalManager: 'IGoalManager',
  IGoalStateEvaluator: 'IGoalStateEvaluator',

  // Selection
  IActionSelector: 'IActionSelector',

  // Planning
  ISimplePlanner: 'ISimplePlanner',
  IPlanCache: 'IPlanCache'
});
```

### 3a. Update Central Tokens Export

**File:** `src/dependencyInjection/tokens.js`

Add import and spread goapTokens into the main tokens object:

```javascript
import { goapTokens } from './tokens/tokens-goap.js';

export const tokens = freeze({
  ...coreTokens,
  ...uiTokens,
  ...aiTokens,
  ...testingTokens,
  ...pipelineTokens,
  ...actionTracingTokens,
  ...monitoringTokens,
  ...goapTokens,  // Add this line
});
```

### 4. DI Registrations File

**File:** `src/dependencyInjection/registrations/goapRegistrations.js`

```javascript
/**
 * @file Dependency injection registrations for GOAP system
 */

import { goapTokens } from '../tokens/tokens-goap.js';

/**
 * Registers GOAP services in the DI container
 * @param {Container} container - DI container
 */
export function registerGoapServices(container) {
  // Analysis (to be implemented in later tickets)
  // container.register(goapTokens.IEffectsAnalyzer, EffectsAnalyzer);
  // container.register(goapTokens.IEffectsGenerator, EffectsGenerator);
  // container.register(goapTokens.IEffectsValidator, EffectsValidator);

  // Goals (to be implemented in later tickets)
  // container.register(goapTokens.IGoalManager, GoalManager);
  // container.register(goapTokens.IGoalStateEvaluator, GoalStateEvaluator);

  // Selection (to be implemented in later tickets)
  // container.register(goapTokens.IActionSelector, ActionSelector);

  // Planning (to be implemented in later tickets)
  // container.register(goapTokens.ISimplePlanner, SimplePlanner);
  // container.register(goapTokens.IPlanCache, PlanCache);
}
```

### 5. Update Base Container Configuration

**File:** `src/dependencyInjection/baseContainerConfig.js`

Add GOAP registrations to the base container configuration:

```javascript
// Add import at the top with other registration imports
import { registerGoapServices } from './registrations/goapRegistrations.js';

// Inside configureBaseContainer function, after core registrations:
export async function configureBaseContainer(container, options = {}) {
  // ... existing code ...

  // After registerInterpreters(container)
  if (logger) logger.debug('[BaseContainerConfig] Registering GOAP services...');
  try {
    registerGoapServices(container);
  } catch (error) {
    const errorMessage = `Failed to register GOAP services: ${error.message}`;
    if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
    throw new Error(errorMessage);
  }

  // ... rest of existing code ...
}
```

**Note:** The project uses `baseContainerConfig.js` for registration bundles, not a separate `containerFactory.js`.

### 6. Operation Mapping Document

**File:** `docs/goap/operation-mapping.md`

Create comprehensive operation mapping table documenting:

- **State-Changing Operations:** `ADD_COMPONENT`, `REMOVE_COMPONENT`, `MODIFY_COMPONENT`, `ATOMIC_MODIFY_COMPONENT`, plus component-based operations like `LOCK_MOVEMENT`, `UNLOCK_MOVEMENT`, `ESTABLISH_SITTING_CLOSENESS`, `TRANSFER_ITEM`, `DROP_ITEM_AT_LOCATION`, `PICK_UP_ITEM_FROM_LOCATION`, `OPEN_CONTAINER`, `TAKE_FROM_CONTAINER`, `PUT_IN_CONTAINER`, `UNEQUIP_CLOTHING`, `DRINK_FROM`, `DRINK_ENTIRELY`

- **Operations Producing Context Data:** `QUERY_COMPONENT`, `QUERY_COMPONENTS`, `QUERY_ENTITIES`, `QUERY_LOOKUP`, `GET_NAME`, `GET_TIMESTAMP`, `SET_VARIABLE`, `VALIDATE_INVENTORY_CAPACITY`, `VALIDATE_CONTAINER_CAPACITY`, `HAS_COMPONENT`, `HAS_BODY_PART_WITH_COMPONENT_VALUE`, `RESOLVE_DIRECTION`, `MATH`

- **Control Flow Operations:** `IF`, `IF_CO_LOCATED`, `FOR_EACH`, `SEQUENCE`

- **Excluded Operations:** `DISPATCH_EVENT`, `DISPATCH_PERCEPTIBLE_EVENT`, `DISPATCH_SPEECH`, `DISPATCH_THOUGHT`, `LOG`, `END_TURN`, `REGENERATE_DESCRIPTION`, etc.

Include mapping from rule operations to planning effects with examples.

### 7. Effects Analyzer Architecture Design

**Document:** `docs/goap/effects-analyzer-architecture.md`

Design document covering:
- Component responsibilities (EffectsAnalyzer, EffectsGenerator, EffectsValidator)
- Data flow analysis approach
- Macro resolution strategy
- Path tracing algorithm for conditionals
- Abstract precondition concept
- Simulation function requirements

## Files to Create

- [ ] `data/schemas/planning-effects.schema.json`
- [ ] `src/dependencyInjection/tokens/tokens-goap.js`
- [ ] `src/dependencyInjection/registrations/goapRegistrations.js`
- [ ] `docs/goap/operation-mapping.md`
- [ ] `docs/goap/effects-analyzer-architecture.md`
- [ ] `docs/goap/README.md` (overview of GOAP system)

## Files to Update

- [ ] `data/schemas/action.schema.json` - Add `planningEffects` field (optional - schema already allows additionalProperties)
- [ ] `src/dependencyInjection/tokens.js` - Import and spread goapTokens
- [ ] `src/dependencyInjection/baseContainerConfig.js` - Register GOAP services

## Testing Requirements

### Schema Validation Tests

**File:** `tests/unit/goap/schemas/planningEffects.schema.test.js`

- Test valid planning effects structures
- Test invalid structures (missing required fields)
- Test all effect types (ADD, REMOVE, MODIFY, CONDITIONAL)
- Test abstract preconditions structure

### Integration Tests

**File:** `tests/integration/goap/schemaIntegration.test.js`

- Test action schema accepts planningEffects field
- Test schema validation in action loader
- Test backward compatibility (actions without planningEffects)

**Coverage Target:** 95%+ (schemas are critical)

## Documentation Requirements

- [ ] Create `docs/goap/README.md` with overview of GOAP Tier 1 system
- [ ] Document operation mapping table with examples
- [ ] Document effects analyzer architecture
- [ ] Include diagrams for data flow and component interactions
- [ ] Add JSDoc comments to all created files

## Acceptance Criteria

- [ ] Planning effects schema validates correct effect structures
- [ ] Planning effects schema rejects invalid effect structures
- [ ] Action schema accepts optional planningEffects field
- [ ] DI tokens file defines all GOAP service tokens
- [ ] DI registrations file prepared for service registration
- [ ] Container factory integrates GOAP registrations
- [ ] Operation mapping document complete with 30+ operations categorized
- [ ] Architecture design document complete and reviewed
- [ ] All tests pass with 95%+ coverage
- [ ] Documentation is clear and includes examples
- [ ] ESLint passes on all new files
- [ ] TypeScript type checking passes

## Success Metrics

- ✅ Schema validation works correctly
- ✅ DI infrastructure ready for GOAP services
- ✅ Clear architecture design documented
- ✅ Operation mapping complete and accurate
- ✅ Team understands GOAP architecture

## Notes

- **No execution code yet** - This ticket is purely infrastructure and design
- **Schema-first approach** - Ensures type safety from the start
- **Clear separation** - Planning effects are metadata only, never executed
- **Foundation for Phase 1** - All subsequent tickets depend on this work

## Related Tickets

- Blocks: GOAP-TIER1-002 (Effects Analyzer Implementation)
- Blocks: GOAP-TIER1-003 (Effects Generator Implementation)
