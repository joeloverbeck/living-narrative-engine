# Modifier Entity Path Validation - Robustness Specification

**Version**: 1.0
**Date**: 2025-12-09
**Status**: ✅ COMPLETED (All phases implemented)
**Related Fix**: Entity path correction in `treat_my_wounded_part.action.json` (`"actor"` → `"entity.actor"`)

---

## Outcome

All four implementation phases completed successfully:

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Validation Utility | ✅ `src/logic/utils/entityPathValidator.js` |
| Phase 2 | Load-Time Integration | ✅ Integrated into action loading |
| Phase 3 | Schema Enhancement | ✅ Pattern added to `action.schema.json` |
| Phase 4 | Tooling | ✅ `scripts/validateModifierPaths.js` + npm script |

---

## Table of Contents

1. [Context](#context)
2. [Problem](#problem)
3. [Truth Sources](#truth-sources)
4. [Desired Behavior](#desired-behavior)
5. [Testing Plan](#testing-plan)

---

## Context

### Location in Codebase

The modifier entity path resolution system spans multiple modules:

| Module                     | File Path                                            | Purpose                                           |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| **Path Resolution**        | `src/logic/utils/entityPathResolver.js`              | Core path resolution logic for dot-separated paths |
| **Context Builder**        | `src/combat/services/ModifierContextBuilder.js`      | Builds evaluation context for modifier conditions |
| **Equipment Operator Base**| `src/logic/operators/base/BaseEquipmentOperator.js`  | Base class for operators requiring entity lookup  |
| **Modifier Collector**     | `src/combat/services/ModifierCollectorService.js`    | Evaluates modifier conditions using JSON Logic    |
| **Custom Operators**       | `src/logic/jsonLogicCustomOperators.js`              | Registers custom JSON Logic operators             |
| **Action Schema**          | `data/schemas/action.schema.json`                    | Schema for action files including modifiers       |

### What the Module Does

The entity path resolution system enables JSON Logic expressions in modifier conditions to reference entities from the evaluation context. It resolves paths like `"entity.actor"` or `"entity.primary.components.anatomy:part_health"` during modifier evaluation.

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Context Building (ModifierContextBuilder.js)       │
│ ├─ Create context: { entity: { actor, primary, secondary,   │
│ │                              tertiary, location } }       │
│ └─ Map action targets to context roles                      │
├─────────────────────────────────────────────────────────────┤
│ Stage 2: Path Resolution (entityPathResolver.js)            │
│ ├─ Parse dot-separated path string                          │
│ ├─ Navigate context object to find entity                   │
│ └─ Return { entity, isValid } result                        │
├─────────────────────────────────────────────────────────────┤
│ Stage 3: Operator Evaluation (BaseEquipmentOperator.js)     │
│ ├─ Resolve entity from path parameter                       │
│ ├─ Log warning if entity not found                          │
│ └─ Return operator-specific result or false on failure      │
└─────────────────────────────────────────────────────────────┘
                        ↓
            Modifier condition evaluated
                        ↓
                Chance calculation adjusted
```

**Key Responsibilities:**

1. **Context Structure**: Provide consistent `{ entity: {...} }` structure for modifier evaluation
2. **Path Resolution**: Navigate dot-separated paths through nested objects
3. **Entity Lookup**: Find entity IDs from context and resolve to actual entity data
4. **Graceful Failure**: Return invalid results without throwing exceptions
5. **Warning Generation**: Log actionable warnings when resolution fails

### Architecture Overview

```
Action File (JSON)
    │
    ├─ chanceBased.modifiers[].condition.logic
    │   └─ Contains entity path references like "entity.actor"
    │
    │
    ▼
Modifier Evaluation Flow:
    │
    ├─→ ModifierContextBuilder.buildContext()
    │   ├─ Input: { actor, targets: { primary, secondary, tertiary }, location }
    │   └─ Output: { entity: { actor, primary, secondary, tertiary, location } }
    │
    ├─→ JSON Logic Evaluation
    │   ├─ Custom operators receive (params, context)
    │   ├─ First param often contains entity path string
    │   └─ Operator calls resolveEntityPath(context, pathString)
    │
    ├─→ Entity Path Resolution
    │   ├─ Split path by "."
    │   ├─ Navigate context object
    │   └─ Return { entity: entityId | null, isValid: boolean }
    │
    └─→ Operator Evaluation
        ├─ Use resolved entity ID for component lookups
        └─ Return evaluation result or false on resolution failure
```

---

## Problem

### What Failed

In `data/mods/first-aid/actions/treat_my_wounded_part.action.json`, modifier conditions used invalid entity paths:

```json
// BEFORE (incorrect)
{ "isSlotExposed": ["actor", { "var": "entity.primary.components..." }] }
{ "isSocketCovered": ["actor", { "var": "entity.primary.components..." }] }

// AFTER (correct)
{ "isSlotExposed": ["entity.actor", { "var": "entity.primary.components..." }] }
{ "isSocketCovered": ["entity.actor", { "var": "entity.primary.components..." }] }
```

### How It Failed

1. `BaseEquipmentOperator.resolveEntity()` called `resolveEntityPath(context, "actor")`
2. `resolveEntityPath` attempted to find `context.actor`
3. Modifier context structure is `{ entity: { actor, primary, ... } }`, not `{ actor, ... }`
4. Resolution returned `{ entity: null, isValid: false }`
5. Operator logged warning: `"isSocketCovered: No entity found at path actor"`
6. Operator returned `false`, causing modifier to not apply correctly

### Why It Failed

**Root Cause: Context Structure Mismatch**

Two different context structures exist in the codebase:

| Context Type        | Structure                                           | Used By                    |
| ------------------- | --------------------------------------------------- | -------------------------- |
| Prerequisite Context| `{ actor: {...}, target: {...}, ... }`             | Action prerequisites       |
| Modifier Context    | `{ entity: { actor, primary, secondary, ... } }`   | Modifier condition logic   |

The action file author used the prerequisite context pattern (`"actor"`) instead of the modifier context pattern (`"entity.actor"`).

**Contributing Factors:**

1. **No Load-Time Validation**: Invalid entity paths not detected during mod loading
2. **No Schema Enforcement**: `action.schema.json` doesn't validate entity path syntax
3. **Silent-ish Failure**: Warning logged but evaluation continues with incorrect result
4. **Documentation Gap**: Context structure difference not clearly documented
5. **No Static Analysis**: No tooling to catch path errors before runtime

### Link to Tests

- **Regression Test**: `tests/integration/mods/first-aid/treat_my_wounded_part_modifier_context.test.js`
- **Coverage Test**: `tests/integration/mods/first-aid/treat_wounded_part_coverage.test.js`

---

## Truth Sources

### Primary Documentation

| Source | Location | Relevance |
| ------ | -------- | --------- |
| Data-Driven Modifier System Spec | `archive/specs/data-driven-modifier-system.md` (lines 204-235) | Documents expected context structure |
| ModifierContextBuilder TypeDefs | `src/combat/services/ModifierContextBuilder.js` (lines 15-22) | Canonical context type definitions |
| Action Schema | `data/schemas/action.schema.json` | Defines modifier condition structure |

### Domain Rules

1. **Context Wrapping Rule**: All entity references in modifier conditions are wrapped under `entity.*`
2. **Role Naming Rule**: Valid roles are `actor`, `primary`, `secondary`, `tertiary`, `location`
3. **Path Resolution Rule**: Dot-separated paths navigate nested object properties
4. **Graceful Degradation Rule**: Resolution failures return `{ entity: null, isValid: false }`, never throw

### External Contracts

| Contract | Stability | Description |
| -------- | --------- | ----------- |
| `resolveEntityPath(context, pathString)` | Stable | Signature and return type unchanged |
| `ModifierContextBuilder.buildContext()` | Stable | Return structure `{ entity: {...} }` unchanged |
| JSON Logic operator parameters | Stable | First parameter as entity path string unchanged |

---

## Desired Behavior

### Normal Cases

| Scenario | Input | Expected Output |
| -------- | ----- | --------------- |
| Valid actor path | `"entity.actor"` | `{ entity: "actor1", isValid: true }` |
| Valid primary target path | `"entity.primary"` | `{ entity: "target1", isValid: true }` |
| Component access | `"entity.actor.components.skills:medicine_skill.value"` | Resolved component value |
| Nested property access | `"entity.primary.components.anatomy:part_health.currentHealth"` | Numeric health value |

### Edge Cases

| Scenario | Input | Expected Behavior |
| -------- | ----- | ----------------- |
| No secondary target | `"entity.secondary"` when secondary is null | Return `{ entity: null, isValid: false }` gracefully |
| Missing component | `"entity.actor.components.nonexistent:component"` | Return `undefined` without error |
| Empty path | `""` | Return `{ entity: null, isValid: false }` with warning |
| Null context | `null` context object | Return `{ entity: null, isValid: false }` with warning |
| Whitespace path | `"  entity.actor  "` | Trim and resolve normally |

### Failure Modes

| Failure | Detection Point | Error/Warning | Recovery |
| ------- | --------------- | ------------- | -------- |
| Invalid root path (e.g., `"actor"`) | Runtime evaluation | Warning: "No entity found at path" | Return false, modifier not applied |
| Unknown role (e.g., `"entity.invalid"`) | Runtime evaluation | Warning: "No entity found at path" | Return false |
| Malformed path (e.g., `"entity..actor"`) | Runtime evaluation | Warning logged | Return `{ entity: null, isValid: false }` |
| **Implemented**: Invalid root path | Load-time validation | Error: "Invalid entity path" | Warning logged |
| **Implemented**: Unknown role | Schema validation | Schema validation error | Warning logged |

### Invariants

Properties that must always hold:

1. **Entity Prefix Invariant**: All modifier entity paths MUST start with `entity.`
2. **Valid Role Invariant**: Second path segment MUST be one of: `actor`, `primary`, `secondary`, `tertiary`, `location`
3. **No-Throw Invariant**: Path resolution NEVER throws exceptions, always returns result object
4. **Idempotency Invariant**: Same path + same context = same result
5. **Context Immutability Invariant**: Path resolution does not modify the context object

### API Contracts (Stable)

These interfaces MUST NOT change without major version bump:

```javascript
// entityPathResolver.js
function resolveEntityPath(context, pathString) {
  // Returns: { entity: string | null, isValid: boolean }
}

// ModifierContextBuilder.js
class ModifierContextBuilder {
  buildContext({ actor, targets, location }) {
    // Returns: { entity: { actor, primary, secondary, tertiary, location } }
  }
}

// BaseEquipmentOperator.js
class BaseEquipmentOperator {
  resolveEntity(params, context) {
    // Returns: string | null (entity ID)
  }
}
```

### What Can Change

Allowed modifications to improve robustness:

| Change | Impact | Approach |
| ------ | ------ | -------- |
| Add load-time path validation | Low | New validation layer in mod loading |
| Add schema patterns for entity paths | Low | Extend `action.schema.json` with regex pattern |
| Add pre-evaluation validation | Low | Wrapper function with early validation |
| Improve warning messages | None | Better error context in log messages |
| Add static analysis tooling | None | New CLI tool for mod validation |
| Add context structure documentation | None | Update JSDoc and markdown docs |

---

## Testing Plan

### Tests Implemented

#### 1. Entity Path Validation Utility ✅

**File**: `tests/unit/logic/utils/entityPathValidator.test.js`

#### 2. Modifier Loading Validation ✅

**File**: `tests/integration/validation/modifierEntityPathValidation.integration.test.js`

#### 3. CLI Tooling ✅

**File**: `tests/integration/scripts/validateModifierPaths.integration.test.js`

### Regression Tests

| Test File | Purpose | Status |
| --------- | ------- | ------ |
| `tests/integration/mods/first-aid/treat_my_wounded_part_modifier_context.test.js` | Verify no "No entity found" warnings during action discovery | ✅ Exists |
| `tests/integration/mods/first-aid/treat_wounded_part_coverage.test.js` | Verify coverage modifiers work correctly | ✅ Exists |

### Validation Script ✅

**File**: `scripts/validateModifierPaths.js`

CLI tool to scan all action files and validate entity paths in modifier conditions:

```bash
npm run validate:modifier-paths
# Output:
# ✅ first-aid:treat_my_wounded_part - All paths valid
# ✅ first-aid:treat_wounded_part - All paths valid
# ❌ example:broken_action - Invalid path "actor" at modifiers[0].condition
```

---

## Appendix: Context Structure Reference

### Prerequisite Context (DO NOT use in modifiers)

```javascript
{
  actor: { id: "actor1", components: {...} },
  target: { id: "target1", components: {...} },
  location: "location1",
  // ... other fields
}
```

### Modifier Context (CORRECT for modifiers)

```javascript
{
  entity: {
    actor: "actor1",      // Entity ID, not full entity
    primary: "target1",   // Primary target entity ID
    secondary: null,      // Secondary target entity ID or null
    tertiary: null,       // Tertiary target entity ID or null
    location: "location1" // Location entity ID
  },
  // ... other evaluation context
}
```

### Valid Entity Path Examples

```javascript
// In modifier condition logic:
"entity.actor"                                           // Actor entity ID
"entity.primary"                                         // Primary target entity ID
"entity.actor.components.skills:medicine_skill.value"   // Actor skill value
"entity.primary.components.anatomy:part_health"         // Target body part health
"entity.secondary.components.core:actor.name"           // Secondary target name
```

### Invalid Entity Path Examples

```javascript
// These will cause "No entity found at path" warnings:
"actor"                    // Missing "entity." prefix
"target"                   // Wrong context pattern
"entity.target"            // Invalid role (should be "primary")
"entity.actorEntity"       // Invalid role name
"primary"                  // Missing "entity." prefix
```
