# GOAP Tier 1 Implementation Specification

**Version:** 1.1
**Created:** 2025-01-09
**Updated:** 2025-01-09
**Status:** Specification (Revised)
**Related Document:** brainstorming/goap-player-implementation-design.md

---

## Executive Summary

This specification defines the implementation of Tier 1 GOAP (Goal-Oriented Action Planning) features for non-sentient AI agents in the Living Narrative Engine. The implementation follows an incremental approach, building on existing infrastructure while avoiding the complexity of a full A* backward-chaining planner initially.

**Scope:** Tier 1 only - Effects auto-generation, goal system with action selection, and simple one-step planner.

**Target Audience:** Non-sentient creatures (cats, monsters, goblins) that don't warrant LLM-based decision making.

**Timeline:** 3-4 months

---

## Table of Contents

1. [Overview](#overview)
2. [Component 1: Effects Auto-Generation](#component-1-effects-auto-generation)
3. [Component 2: Goal System with Action Selection](#component-2-goal-system-with-action-selection)
4. [Component 3: Simple One-Step GOAP Planner](#component-3-simple-one-step-goap-planner)
5. [Integration Points](#integration-points)
6. [Testing Strategy](#testing-strategy)
7. [Success Criteria](#success-criteria)
8. [Implementation Timeline](#implementation-timeline)
9. [Dependencies](#dependencies)
10. [Risk Mitigation](#risk-mitigation)

---

## Overview

### Goals

1. **Auto-generate planning effects** from existing rule operations without manual authoring
2. **Implement goal selection system** using existing goal loader and schema
3. **Build simple one-step planner** that validates planning infrastructure before full A* implementation

### Non-Goals

- Full A* backward-chaining planner (deferred to Tier 2)
- Custom Effects DSL parser (using JSON-based approach)
- Hierarchical planning (deferred to Tier 3)
- Multi-agent coordination (deferred to Tier 3)

### Design Principles

1. **Reuse existing infrastructure** - Operation handlers, action discovery, validation system
2. **Single source of truth** - Rules remain authoritative, effects are derived
3. **Planning metadata only** - Effects describe state changes for planner, never execute
4. **Incremental adoption** - Works alongside LLM agents, backward compatible
5. **Validation-first** - Validate infrastructure before investing in complex planning

---

## Component 1: Effects Auto-Generation

### 1.1 Overview

Auto-generate planning effects from rule operations to avoid manual authoring and ensure consistency.

### 1.2 Architecture

#### 1.2.1 Effects Analyzer

**Location:** `src/goap/analysis/effectsAnalyzer.js`

**Purpose:** Analyze rule operations and extract state-changing effects for planning.

**Dependencies:**
- `src/loaders/ruleLoader.js` - Access to loaded rules
- `src/validation/ajvSchemaValidator.js` - Schema validation
- `src/utils/validationCore.js` - Parameter validation
- `src/dependencyInjection/tokens/tokens-goap.js` - DI tokens (new file)

**Interface:**
```javascript
class EffectsAnalyzer {
  /**
   * Analyzes a rule and extracts planning effects
   * @param {Object} rule - Rule definition
   * @returns {Object} Planning effects structure
   */
  analyzeRule(rule) {
    // Implementation
  }

  /**
   * Determines if an operation changes world state
   * @param {Object} operation - Operation from rule
   * @returns {boolean} True if state-changing
   */
  isWorldStateChanging(operation) {
    // Implementation
  }

  /**
   * Converts operation to planning effect
   * @param {Object} operation - Operation from rule
   * @returns {Object} Planning effect
   */
  operationToEffect(operation) {
    // Implementation
  }
}
```

**State-Changing Operations:**
- `ADD_COMPONENT`
- `REMOVE_COMPONENT`
- `MODIFY_COMPONENT`
- `ATOMIC_MODIFY_COMPONENT` - Atomic state changes with conflict detection
- Component-based operations that map to component changes:
  - `LOCK_MOVEMENT` → `ADD_COMPONENT` (positioning:movement_locked)
  - `UNLOCK_MOVEMENT` → `REMOVE_COMPONENT` (positioning:movement_locked)
  - `LOCK_MOUTH_ENGAGEMENT` → `ADD_COMPONENT` (relevant mouth engagement marker)
  - `UNLOCK_MOUTH_ENGAGEMENT` → `REMOVE_COMPONENT` (relevant mouth engagement marker)
  - `ESTABLISH_SITTING_CLOSENESS` → `ADD_COMPONENT` (positioning:sitting_close_to)
  - `ESTABLISH_LYING_CLOSENESS` → `ADD_COMPONENT` (positioning:lying_close_to)
  - `REMOVE_SITTING_CLOSENESS` → `REMOVE_COMPONENT` (positioning:sitting_close_to)
  - `REMOVE_LYING_CLOSENESS` → `REMOVE_COMPONENT` (positioning:lying_close_to)
  - `BREAK_CLOSENESS_WITH_TARGET` → `REMOVE_COMPONENT` (closeness components)
  - `TRANSFER_ITEM` → Remove from source, add to destination
  - `DROP_ITEM_AT_LOCATION` → Remove from inventory, add at_location
  - `PICK_UP_ITEM_FROM_LOCATION` → Remove at_location, add to inventory
  - `OPEN_CONTAINER` → `MODIFY_COMPONENT` (container state)
  - `TAKE_FROM_CONTAINER` → Move item from container to inventory
  - `PUT_IN_CONTAINER` → Move item from inventory to container
  - `UNEQUIP_CLOTHING` → `REMOVE_COMPONENT` (clothing equipped state)
  - `DRINK_FROM` → `MODIFY_COMPONENT` (consumable quantity)
  - `DRINK_ENTIRELY` → `REMOVE_COMPONENT` (consumable component)

**Operations Producing Context Data (Critical for Conditional Effects):**
- `QUERY_COMPONENT` - Queries component data, stores in `result_variable`
- `QUERY_COMPONENTS` - Queries multiple components
- `QUERY_ENTITIES` - Queries entities matching criteria
- `QUERY_LOOKUP` - Queries lookup tables
- `GET_NAME` - Gets entity name, stores in `result_variable`
- `GET_TIMESTAMP` - Gets current timestamp, stores in `result_variable`
- `SET_VARIABLE` - Sets context variable for later operations
- `VALIDATE_INVENTORY_CAPACITY` - Returns validation result with reason
- `VALIDATE_CONTAINER_CAPACITY` - Returns validation result with reason
- `HAS_COMPONENT` - Returns boolean result
- `HAS_BODY_PART_WITH_COMPONENT_VALUE` - Returns boolean result
- `RESOLVE_DIRECTION` - Resolves direction string to location ID
- `MATH` - Performs mathematical operations, stores result

**Control Flow Operations:**
- `IF` - Conditional branching with `then_actions` and `else_actions`
- `IF_CO_LOCATED` - Conditional based on location matching
- `FOR_EACH` - Iteration over arrays
- `SEQUENCE` - Sequential operation execution

**Excluded Operations (not relevant for planning):**
- `DISPATCH_EVENT` - Execution-time communication only
- `DISPATCH_PERCEPTIBLE_EVENT` - Execution-time perception logging
- `DISPATCH_SPEECH` - Execution-time output
- `DISPATCH_THOUGHT` - Execution-time output
- `LOG` - Debug/diagnostics only
- `END_TURN` - Execution control only
- `REGENERATE_DESCRIPTION` - UI update only
- `ADD_PERCEPTION_LOG_ENTRY` - Logging only
- `SYSTEM_MOVE_ENTITY` - System-level operation
- `REBUILD_LEADER_LIST_CACHE` - Cache management
- `CHECK_FOLLOW_CYCLE` - Validation only
- `AUTO_MOVE_CLOSENESS_PARTNERS` - Derived movement (not primary action)
- `AUTO_MOVE_FOLLOWERS` - Derived movement (not primary action)
- `MODIFY_ARRAY_FIELD` - Low-level implementation detail
- `MODIFY_CONTEXT_ARRAY` - Context manipulation only
- `REMOVE_FROM_CLOSENESS_CIRCLE` - Internal closeness management
- `MERGE_CLOSENESS_CIRCLE` - Internal closeness management

**Note:** `CREATE_ENTITY` and `DESTROY_ENTITY` operations are not currently implemented in the codebase and should be excluded from Tier 1 scope.

#### 1.2.2 Effects Generator

**Location:** `src/goap/generation/effectsGenerator.js`

**Purpose:** Generate planning effects for all state-changing actions.

**Interface:**
```javascript
class EffectsGenerator {
  /**
   * Generates planning effects for all actions in a mod
   * @param {string} modId - Mod identifier
   * @returns {Promise<Map<string, Object>>} Map of actionId -> effects
   */
  async generateForMod(modId) {
    // Implementation
  }

  /**
   * Generates planning effects for a specific action
   * @param {string} actionId - Full action ID (mod:action)
   * @returns {Promise<Object>} Planning effects
   */
  async generateForAction(actionId) {
    // Implementation
  }

  /**
   * Validates generated effects against action
   * @param {string} actionId - Full action ID
   * @param {Object} effects - Generated effects
   * @returns {Object} Validation result with warnings/errors
   */
  validateEffects(actionId, effects) {
    // Implementation
  }
}
```

#### 1.2.3 Effects Schema

**Location:** `data/schemas/planning-effects.schema.json`

**Purpose:** JSON schema for planning effects structure.

**Schema Structure:**
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

#### 1.2.4 Effects Storage

**Approach:** Store generated effects in action definitions (no separate files).

**Location:** Extend action schema to include optional `planningEffects` field.

**Schema Update:** `data/schemas/action.schema.json`

```json
{
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "targets": { "type": "string" },
    // ... existing fields ...

    "planningEffects": {
      "$ref": "schema://living-narrative-engine/planning-effects.schema.json",
      "description": "Auto-generated planning metadata for GOAP (optional)"
    }
  }
}
```

**Generation Workflow:**
1. Run effects generator: `npm run generate:effects`
2. Generator reads all actions
3. For each action, find corresponding rule
4. **Resolve macros** - Expand all macro references to their constituent operations
5. **Analyze data flow** - Track operations that produce context variables
6. **Trace execution paths** - Identify all conditional branches and execution paths
7. **Extract state changes** - Collect state-changing operations from each path
8. **Generate abstract preconditions** - Convert query/validation operations to abstract conditions
9. Generate planning effects with conditional blocks
10. Inject into action definition (in-memory or write to file)
11. Validate against schema

**Macro Resolution:**
- Rules frequently use macros like `"macro": "core:logSuccessAndEndTurn"`
- Macros expand to multiple operations (queries, logging, events, etc.)
- Effects generator MUST resolve macros before analysis
- Use existing macro loader/resolver from rule loading system
- Document which macros are commonly used and their expanded operations

#### 1.2.5 Validation Tool

**Location:** `src/goap/validation/effectsValidator.js`

**Purpose:** Validate consistency between effects and rules.

**Command:** `npm run validate:effects`

**Checks:**
- All state-changing actions have effects
- Effects accurately reflect rule operations
- No desync between effects and rules
- Component references are valid
- Operation types match schema

**Output:**
```
✓ positioning:sit_down - effects match rule operations
✓ items:pick_up_item - effects match rule operations
⚠ movement:move_to - missing cost estimation
✗ positioning:lie_down - effects don't match rule (missing movement_locked)

Summary: 150 valid, 10 warnings, 2 errors
```

### 1.3 Implementation Details

#### 1.3.0 Data Flow Analysis and Context Variables

**Critical Challenge:** Rules frequently use operations that query data and store results in context variables, which are then used by later operations for conditional branching or as inputs.

**Example Pattern from Real Rules:**
```javascript
// Step 1: Validate capacity and store result
{
  "type": "VALIDATE_INVENTORY_CAPACITY",
  "parameters": {
    "targetEntity": "{event.payload.actorId}",
    "itemEntity": "{event.payload.targetId}",
    "result_variable": "capacityCheck"  // ← Stores result object
  }
}

// Step 2: Branch based on stored result
{
  "type": "IF",
  "parameters": {
    "condition": {
      "==": [{ "var": "context.capacityCheck.valid" }, false]  // ← Uses stored result
    },
    "then_actions": [/* failure path */],
    "else_actions": [/* success path with state changes */]
  }
}
```

**Data Flow Categories:**

1. **Query Operations** (produce context data):
   - `QUERY_COMPONENT` → component data object
   - `GET_NAME` → entity name string
   - `VALIDATE_INVENTORY_CAPACITY` → `{ valid: boolean, reason: string }`
   - `OPEN_CONTAINER` → `{ success: boolean, error: string }`
   - `ATOMIC_MODIFY_COMPONENT` → boolean success/failure
   - `ESTABLISH_SITTING_CLOSENESS` → boolean or structure

2. **Consuming Operations** (use context data):
   - `IF` conditions - reference `context.variableName`
   - `SET_VARIABLE` - copy/transform context data
   - State-changing operations - use context data in parameters

**Effects Generation Strategies:**

**Strategy 1: Final State Only (Recommended for Tier 1)**
- Analyze the complete rule execution flow
- Track all possible execution paths (all IF branches)
- Generate effects representing only the final state changes
- Ignore intermediate query/validation steps
- Simulate queries during planning (not in effects)

**Advantages:**
- Simpler effects structure
- Closer to traditional GOAP effects
- Easier to validate and reason about

**Example:**
```javascript
// Rule has: VALIDATE_INVENTORY_CAPACITY → IF → PICK_UP or fail
// Generated effects (final state only):
{
  "effects": [
    {
      "operation": "CONDITIONAL",
      "condition": { "hasInventoryCapacity": ["actor", "target"] },  // Abstract condition
      "then": [
        { "operation": "ADD_COMPONENT", "entity": "actor", "component": "items:inventory_item" },
        { "operation": "REMOVE_COMPONENT", "entity": "target", "component": "core:at_location" }
      ]
    }
  ]
}
```

**Strategy 2: Explicit Data Flow (Deferred to Tier 2)**
- Model intermediate computational states
- Track data dependencies between operations
- Generate effects with data flow annotations
- Planner simulates complete execution including queries

**Implementation Approach for Tier 1:**

1. **Macro Resolution First**
   - Expand all macros before analyzing operations
   - Macros like `core:logSuccessAndEndTurn` contain operations
   - Cannot generate accurate effects without expansion

2. **Path Analysis**
   - Identify all `IF` operations in rule
   - Trace all possible execution paths
   - For each path, collect state-changing operations

3. **Abstract Preconditions**
   - Convert query operations to abstract preconditions
   - `VALIDATE_INVENTORY_CAPACITY` → `hasInventoryCapacity(actor, item)`
   - `HAS_COMPONENT` → `hasComponent(entity, component)`
   - Store mapping of abstract functions to simulation logic

4. **Effect Generation**
   - For each execution path, generate conditional effect
   - Use abstract preconditions in `CONDITIONAL.condition`
   - List only state-changing operations in `then` block

5. **Simulation Functions**
   - Implement simulation for each abstract function
   - `hasInventoryCapacity(actor, item)` - check weight/count limits
   - `hasComponent(entity, component)` - check component presence
   - Used by planner during action selection

**Example: Complete Analysis of `handle_pick_up_item` Rule**

**Rule Structure:**
```
1. VALIDATE_INVENTORY_CAPACITY → capacityCheck
2. IF capacityCheck.valid == false
   THEN: [QUERY_COMPONENT, GET_NAME, ..., END_TURN (failure)]
   ELSE: [PICK_UP_ITEM_FROM_LOCATION, QUERY_COMPONENT, GET_NAME, SET_VARIABLE, ...]
```

**Generated Effects:**
```javascript
{
  "effects": [
    {
      "operation": "CONDITIONAL",
      "condition": {
        "hasInventoryCapacity": [
          { "ref": "actor" },
          { "ref": "target" }
        ]
      },
      "then": [
        {
          "operation": "ADD_COMPONENT",
          "entity": "actor",
          "component": "items:inventory_item",
          "data": { "item_id": { "ref": "target.id" } }
        },
        {
          "operation": "REMOVE_COMPONENT",
          "entity": "target",
          "component": "core:at_location"
        }
      ],
      "else": []  // No state changes on failure path
    }
  ],
  "cost": 1.0,
  "abstractPreconditions": {
    "hasInventoryCapacity": {
      "description": "Checks if actor can carry the item",
      "parameters": ["actorId", "itemId"],
      "simulationFunction": "simulateInventoryCapacity"
    }
  }
}
```

**Simulation Implementation:**
```javascript
// In SimplePlanner or ActionSelector
simulateInventoryCapacity(actorId, itemId, worldState) {
  const actorInventory = worldState.getComponent(actorId, 'items:inventory');
  const item = worldState.getComponent(itemId, 'items:item');

  const currentWeight = calculateTotalWeight(actorInventory);
  const itemWeight = item.weight || 0;
  const capacity = actorInventory.max_weight || Infinity;

  return (currentWeight + itemWeight) <= capacity;
}
```

**Documentation Requirements:**

1. **Effect Generation Guide** (`docs/goap/effects-auto-generation.md`)
   - Data flow analysis algorithm
   - Path tracing for IF operations
   - Abstract precondition catalog
   - Simulation function implementation guide

2. **Operation Result Structures** (`docs/goap/operation-result-structures.md`)
   - Document result_variable structure for each query operation
   - Example: `VALIDATE_INVENTORY_CAPACITY` → `{ valid: boolean, reason: string }`
   - Used for testing and validation

3. **Abstract Preconditions Reference** (`docs/goap/abstract-preconditions.md`)
   - List all abstract precondition functions
   - Parameters and return types
   - Simulation implementation requirements

#### 1.3.1 Operation Mapping

**Mapping Table:**

| Rule Operation | Planning Effect | Notes |
|---------------|-----------------|-------|
| `ADD_COMPONENT` | `ADD_COMPONENT` | Direct mapping |
| `REMOVE_COMPONENT` | `REMOVE_COMPONENT` | Direct mapping |
| `MODIFY_COMPONENT` | `MODIFY_COMPONENT` | Direct mapping |
| `LOCK_MOVEMENT` | `ADD_COMPONENT` | positioning:movement_locked |
| `UNLOCK_MOVEMENT` | `REMOVE_COMPONENT` | positioning:movement_locked |
| `ESTABLISH_SITTING_CLOSENESS` | `ADD_COMPONENT` | positioning:sitting_close_to |
| `BREAK_CLOSENESS` | `REMOVE_COMPONENT` | positioning:sitting_close_to |
| `TRANSFER_ITEM` | Multiple effects | Remove from source, add to target |
| `DROP_ITEM_AT_LOCATION` | Multiple effects | Remove from inventory, add at_location |
| `PICK_UP_ITEM_FROM_LOCATION` | Multiple effects | Remove at_location, add to inventory |

#### 1.3.2 Conditional Operations

**Challenge:** Rules may have conditional operations using JSON Logic.

**Solution:**
```javascript
// Rule operation:
{
  "if": { ">": [{ "fn": "adjacentActors.length" }, 0] },
  "then": [
    { "type": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting_close_to" }
  ]
}

// Generated effect:
{
  "operation": "CONDITIONAL",
  "condition": { ">": [{ "fn": "adjacentActors.length" }, 0] },
  "then": [
    { "operation": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting_close_to" }
  ]
}
```

#### 1.3.3 Hypothetical Data

**Challenge:** Some effects need placeholder data (e.g., spot_index allocation).

**Solution:** Use special markers for hypothetical values.

```javascript
// Generated effect:
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:sitting_on",
  "data": {
    "furniture_id": { "ref": "target.id" },
    "spot_index": { "hypothetical": "allocateSpot" }  // Planner simulates allocation
  }
}
```

**Hypothetical Functions:**
- `allocateSpot` - Simulate spot allocation
- `generateId` - Simulate ID generation
- `calculateDistance` - Distance between entities

### 1.4 Testing Requirements

**Unit Tests:** `tests/unit/goap/analysis/effectsAnalyzer.test.js`
- Test state-changing operation detection
- Test operation to effect conversion
- Test conditional operation handling
- Test hypothetical data generation

**Unit Tests:** `tests/unit/goap/generation/effectsGenerator.test.js`
- Test effects generation for simple actions
- Test effects generation for complex actions
- Test validation of generated effects
- Test error handling for invalid rules

**Integration Tests:** `tests/integration/goap/effectsGeneration.integration.test.js`
- Test full generation workflow
- Test consistency with actual rules
- Test effects for all mods
- Test validation tool

**Coverage Target:** 90% branches, 95% functions/lines

### 1.5 Documentation

**Location:** `docs/goap/effects-auto-generation.md`

**Topics:**
- How effects are generated from rules
- Operation mapping table
- Running the generator
- Validation tool usage
- Troubleshooting common issues
- Manual overrides (for complex cases)

---

## Component 2: Goal System with Action Selection

### 2.1 Overview

Implement goal selection and greedy action selection toward goals using existing goal loader and schema.

### 2.2 Architecture

#### 2.2.1 Goal Manager

**Location:** `src/goap/goals/goalManager.js`

**Purpose:** Select highest-priority relevant goal for an actor.

**Dependencies:**
- `src/loaders/goalLoader.js` - Access to loaded goals
- `src/logic/jsonLogicEvaluator.js` - Evaluate relevance conditions
- `src/scopeDsl/engine.js` - Scope resolution for goal state (reference: `docs/scopeDsl/README.md`, `docs/scopeDsl/quick-reference.md`)
- DI tokens from `tokens-goap.js`

**Interface:**
```javascript
class GoalManager {
  /**
   * Selects the highest-priority relevant goal for an actor
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {Object|null} Selected goal or null
   */
  selectGoal(actorId, context) {
    // Implementation
  }

  /**
   * Evaluates if a goal is relevant for an actor
   * @param {Object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if relevant
   */
  isRelevant(goal, actorId, context) {
    // Implementation
  }

  /**
   * Evaluates if goal state is satisfied
   * @param {Object} goal - Goal definition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if goal achieved
   */
  isGoalSatisfied(goal, actorId, context) {
    // Implementation
  }

  /**
   * Gets all goals for an actor's mod set
   * @param {string} actorId - Entity ID of actor
   * @returns {Array<Object>} List of goals
   */
  getGoalsForActor(actorId) {
    // Implementation
  }
}
```

**Goal Selection Algorithm:**
```javascript
selectGoal(actorId, context) {
  // 1. Get all goals for actor
  const goals = this.getGoalsForActor(actorId);

  // 2. Filter to relevant goals (relevance condition = true)
  const relevant = goals.filter(goal =>
    this.isRelevant(goal, actorId, context)
  );

  // 3. Filter out already satisfied goals
  const unsatisfied = relevant.filter(goal =>
    !this.isGoalSatisfied(goal, actorId, context)
  );

  // 4. Sort by priority (descending)
  unsatisfied.sort((a, b) => b.priority - a.priority);

  // 5. Return highest priority
  return unsatisfied[0] || null;
}
```

#### 2.2.2 Goal State Evaluator

**Location:** `src/goap/goals/goalStateEvaluator.js`

**Purpose:** Evaluate goal state conditions using ScopeDSL and JSON Logic.

**Reference Documentation:**
- `docs/scopeDsl/README.md` - ScopeDSL fundamentals
- `docs/scopeDsl/quick-reference.md` - Syntax reference
- `docs/scopeDsl/error-handling-guide.md` - Error handling

**Interface:**
```javascript
class GoalStateEvaluator {
  /**
   * Evaluates if goal state condition is met
   * @param {Object} goalState - Goal state condition (JSON Logic or ScopeDSL)
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {boolean} True if goal state satisfied
   */
  evaluate(goalState, actorId, context) {
    // Implementation
  }

  /**
   * Calculates distance to goal state (for heuristic)
   * @param {Object} goalState - Goal state condition
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {number} Distance metric (0 = satisfied)
   */
  calculateDistance(goalState, actorId, context) {
    // Implementation
  }
}
```

**Goal State Formats:**

**Format 1: Component Check (ScopeDSL)**
```json
{
  "id": "core:find_food",
  "goalState": "hasComponent(actor, 'items:has_food')"
}
```

**Format 2: JSON Logic**
```json
{
  "id": "core:low_hunger",
  "goalState": {
    ">=": [{ "var": "actor.hunger" }, 70]
  }
}
```

**Format 3: Composite (multiple conditions)**
```json
{
  "id": "core:rest_safely",
  "goalState": {
    "and": [
      { "hasComponent": ["actor", "positioning:lying_down"] },
      { ">=": [{ "var": "actor.energy" }, 80] },
      { "==": [{ "var": "actor.position.safe" }, true] }
    ]
  }
}
```

#### 2.2.3 Action Selector

**Location:** `src/goap/selection/actionSelector.js`

**Purpose:** Select action that best moves toward goal (greedy selection).

**Interface:**
```javascript
class ActionSelector {
  /**
   * Selects best action to move toward goal
   * @param {Array<Object>} availableActions - Actions from action discovery
   * @param {Object} goal - Selected goal
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {Object|null} Selected action or null
   */
  selectAction(availableActions, goal, actorId, context) {
    // Implementation
  }

  /**
   * Calculates how much an action progresses toward goal
   * @param {Object} action - Action with planningEffects
   * @param {Object} goal - Goal definition
   * @param {Object} context - World state context
   * @returns {number} Progress score (higher = better)
   */
  calculateProgress(action, goal, context) {
    // Implementation
  }

  /**
   * Simulates applying action effects to world state
   * @param {Object} action - Action with planningEffects
   * @param {Object} currentState - Current world state
   * @returns {Object} Simulated future state
   */
  simulateEffects(action, currentState) {
    // Implementation
  }
}
```

**Selection Algorithm (Greedy):**
```javascript
selectAction(availableActions, goal, actorId, context) {
  // 1. Filter to actions with planning effects
  const plannable = availableActions.filter(a => a.planningEffects);

  // 2. Calculate progress score for each action
  const scored = plannable.map(action => ({
    action,
    score: this.calculateProgress(action, goal, context)
  }));

  // 3. Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);

  // 4. Return best action
  return scored[0]?.action || null;
}

calculateProgress(action, goal, context) {
  // 1. Get current distance to goal
  const currentDistance = this.#goalStateEvaluator.calculateDistance(
    goal.goalState,
    actorId,
    context
  );

  // 2. Simulate applying action effects
  const futureState = this.simulateEffects(action, context);

  // 3. Get future distance to goal
  const futureDistance = this.#goalStateEvaluator.calculateDistance(
    goal.goalState,
    actorId,
    futureState
  );

  // 4. Progress = reduction in distance
  return currentDistance - futureDistance;
}
```

### 2.3 Goal Definition Examples

#### 2.3.1 Simple Goal: Find Food (Cat)

```json
{
  "id": "core:find_food",
  "priority": 80,
  "relevance": {
    "and": [
      { "hasComponent": ["actor", "core:actor"] },
      { "<": [{ "var": "actor.hunger" }, 30] },
      { "not": { "hasComponent": ["actor", "items:has_food"] } }
    ]
  },
  "goalState": {
    "hasComponent": ["actor", "items:has_food"]
  }
}
```

**Meaning:**
- Relevant when: Actor is hungry (hunger < 30) and doesn't have food
- Goal satisfied when: Actor has food in inventory

**Applicable Actions (with effects):**
- `items:pick_up_item` (if food at location)
- `items:take_from_container` (if food in container)

#### 2.3.2 Complex Goal: Rest Safely (Cat)

```json
{
  "id": "core:rest_safely",
  "priority": 60,
  "relevance": {
    "and": [
      { "hasComponent": ["actor", "core:actor"] },
      { "<": [{ "var": "actor.energy" }, 40] }
    ]
  },
  "goalState": {
    "and": [
      { "hasComponent": ["actor", "positioning:lying_down"] },
      { ">=": [{ "var": "actor.energy" }, 80] },
      { "==": [{ "var": "actor.position.safe" }, true] }
    ]
  }
}
```

**Meaning:**
- Relevant when: Actor is tired (energy < 40)
- Goal satisfied when: Lying down, energy restored (>= 80), in safe location

**Applicable Actions (with effects):**
- `movement:move_to` (to safe location)
- `positioning:lie_down` (on bed/furniture)

#### 2.3.3 Tactical Goal: Defeat Enemy (Goblin)

```json
{
  "id": "combat:defeat_enemy",
  "priority": 100,
  "relevance": {
    "and": [
      { "hasComponent": ["actor", "core:hostile"] },
      { ">": [{ "fn": "entitiesWithComponent", "args": ["core:enemy"] }, 0] }
    ]
  },
  "goalState": {
    "==": [{ "fn": "entitiesWithComponent", "args": ["core:enemy"] }, 0]
  }
}
```

**Meaning:**
- Relevant when: Actor is hostile and enemies are present
- Goal satisfied when: No enemies remain

**Applicable Actions (with effects):**
- `combat:attack` (damage enemy)
- `movement:flank` (position advantage)
- `items:pick_up_weapon` (improve damage)

### 2.4 Testing Requirements

**Unit Tests:** `tests/unit/goap/goals/goalManager.test.js`
- Test goal selection by priority
- Test relevance evaluation
- Test goal satisfaction check
- Test filtering and sorting

**Unit Tests:** `tests/unit/goap/goals/goalStateEvaluator.test.js`
- Test JSON Logic evaluation
- Test ScopeDSL evaluation (refer to `docs/scopeDsl/quick-reference.md`)
- Test distance calculation
- Test composite conditions

**Unit Tests:** `tests/unit/goap/selection/actionSelector.test.js`
- Test action filtering (planningEffects only)
- Test progress calculation
- Test effect simulation
- Test greedy selection

**Integration Tests:** `tests/integration/goap/goalActionSelection.integration.test.js`
- Test full workflow: goal selection → action selection
- Test with multiple goals
- Test with multiple actions
- Test edge cases (no relevant goals, no applicable actions)

**Coverage Target:** 90% branches, 95% functions/lines

### 2.5 Documentation

**Location:** `docs/goap/goal-system.md`

**Topics:**
- Goal definition format
- Relevance conditions
- Goal state conditions
- ScopeDSL usage in goals (link to `docs/scopeDsl/`)
- Creating goals for creature types
- Priority tuning
- Troubleshooting goal selection

---

## Component 3: Simple One-Step GOAP Planner

### 3.1 Overview

Implement a simple one-step planner that validates planning infrastructure without the complexity of A* backward chaining.

### 3.2 Architecture

#### 3.2.1 Simple Planner

**Location:** `src/goap/planning/simplePlanner.js`

**Purpose:** One-step greedy planner (foundation for future A* planner).

**Interface:**
```javascript
class SimplePlanner {
  /**
   * Finds best single action to move toward goal
   * @param {Object} goal - Selected goal
   * @param {Array<Object>} availableActions - Actions from discovery
   * @param {string} actorId - Entity ID of actor
   * @param {Object} context - World state context
   * @returns {Object|null} Best action or null
   */
  plan(goal, availableActions, actorId, context) {
    // Implementation
  }

  /**
   * Creates a plan object with single action
   * @param {Object} action - Selected action
   * @param {Object} goal - Goal being pursued
   * @returns {Object} Plan object
   */
  createPlan(action, goal) {
    // Implementation
  }

  /**
   * Validates if plan is still applicable
   * @param {Object} plan - Plan object
   * @param {Object} context - Current world state
   * @returns {boolean} True if plan valid
   */
  validatePlan(plan, context) {
    // Implementation
  }
}
```

**Plan Object Structure:**
```javascript
{
  "goalId": "core:find_food",
  "steps": [
    {
      "actionId": "items:pick_up_item",
      "targetId": "entity_123",
      "reasoning": "Action adds items:has_food component, satisfying goal"
    }
  ],
  "createdAt": 1234567890,
  "validUntil": null  // No expiration for simple planner
}
```

#### 3.2.2 Plan Cache

**Location:** `src/goap/planning/planCache.js`

**Purpose:** Cache plans to avoid replanning every turn.

**Interface:**
```javascript
class PlanCache {
  /**
   * Gets cached plan for actor
   * @param {string} actorId - Entity ID of actor
   * @returns {Object|null} Cached plan or null
   */
  get(actorId) {
    // Implementation
  }

  /**
   * Stores plan for actor
   * @param {string} actorId - Entity ID of actor
   * @param {Object} plan - Plan object
   */
  set(actorId, plan) {
    // Implementation
  }

  /**
   * Invalidates cached plan for actor
   * @param {string} actorId - Entity ID of actor
   */
  invalidate(actorId) {
    // Implementation
  }

  /**
   * Clears all cached plans
   */
  clear() {
    // Implementation
  }
}
```

**Cache Strategy:**
- Store plan per actor
- Invalidate on world state changes affecting plan
- Validate plan before use
- Clear on actor destruction

#### 3.2.3 GOAP Decision Provider (Updated)

**Location:** `src/turns/providers/goapDecisionProvider.js` (existing file)

**Purpose:** Integrate GOAP system with turn decision workflow.

**Current State:** Placeholder that extends `DelegatingDecisionProvider` and selects first action.

**Current Interface:**
```javascript
class GoapDecisionProvider extends DelegatingDecisionProvider {
  constructor({ logger, safeEventDispatcher }) {
    const delegate = async (_actor, _context, actions) => {
      // Placeholder implementation: returns first action
      return { index: resolvedIndex };
    };
    super({ delegate, logger, safeEventDispatcher });
  }
}
```

**Updated Implementation:**
```javascript
class GoapDecisionProvider extends DelegatingDecisionProvider {
  #goalManager;
  #simplePlanner;
  #planCache;
  #logger;
  #safeEventDispatcher;

  constructor({ goalManager, simplePlanner, planCache, logger, safeEventDispatcher }) {
    // Create delegate function for GOAP decision logic
    const delegate = async (actor, context, actions) => {
      return this.#decideActionInternal(actor, context, actions);
    };

    super({ delegate, logger, safeEventDispatcher });

    validateDependency(goalManager, 'IGoalManager', logger, {
      requiredMethods: ['selectGoal', 'isGoalSatisfied']
    });
    validateDependency(simplePlanner, 'ISimplePlanner', logger, {
      requiredMethods: ['plan', 'validatePlan']
    });
    validateDependency(planCache, 'IPlanCache', logger, {
      requiredMethods: ['get', 'set', 'invalidate']
    });

    this.#goalManager = goalManager;
    this.#simplePlanner = simplePlanner;
    this.#planCache = planCache;
    this.#logger = logger;
    this.#safeEventDispatcher = safeEventDispatcher;
  }

  /**
   * Internal decision logic for GOAP agent
   * @param {Object} actor - Actor entity object
   * @param {Object} context - Decision context
   * @param {Array<Object>} actions - Available indexed actions
   * @returns {Promise<Object>} Decision result with { index: number|null }
   * @private
   */
  async #decideActionInternal(actor, context, actions) {
    const actorId = actor.id;
    // 1. Validate input
    if (!Array.isArray(actions) || actions.length === 0) {
      this.#logger.debug(`No actions available for ${actorId}`);
      return { index: null };
    }

    // 2. Check cached plan
    let plan = this.#planCache.get(actorId);

    // 3. Validate cached plan
    if (plan && !this.#simplePlanner.validatePlan(plan, context)) {
      this.#logger.debug(`Cached plan for ${actorId} invalid, replanning`);
      this.#planCache.invalidate(actorId);
      plan = null;
    }

    // 4. If no valid plan, create new one
    if (!plan) {
      // Select goal
      const goal = this.#goalManager.selectGoal(actorId, context);

      if (!goal) {
        this.#logger.debug(`No relevant goal for ${actorId}, no action`);
        return { index: null };
      }

      // Check if goal already satisfied
      if (this.#goalManager.isGoalSatisfied(goal, actorId, context)) {
        this.#logger.debug(`Goal ${goal.id} already satisfied for ${actorId}`);
        return { index: null };
      }

      // Plan action - note: actions array contains indexed action objects
      const action = this.#simplePlanner.plan(goal, actions, actorId, context);

      if (!action) {
        this.#logger.debug(`No action found for goal ${goal.id}`);
        return { index: null };
      }

      // Create and cache plan
      plan = this.#simplePlanner.createPlan(action, goal);
      this.#planCache.set(actorId, plan);
    }

    // 5. Execute first step of plan
    const step = plan.steps[0];

    // Find action in indexed actions array
    // Note: actions array from DelegatingDecisionProvider contains objects with { index, ...actionData }
    const actionMatch = actions.find(a => a.id === step.actionId);

    if (!actionMatch) {
      this.#logger.warn(`Planned action ${step.actionId} not in available actions`);
      this.#planCache.invalidate(actorId);
      return { index: null };
    }

    this.#logger.info(`Actor ${actorId} executing ${step.actionId} for goal ${plan.goalId}`);
    return { index: actionMatch.index };
  }
}
```

### 3.3 Implementation Flow

**Decision Workflow:**

```
1. Turn starts for GOAP actor
   ↓
2. Action discovery provides available actions
   ↓
3. GOAP Decision Provider called
   ↓
4. Check plan cache
   ├─ Valid plan? → Use cached plan
   └─ No plan? → Continue
   ↓
5. Goal Manager selects goal
   ├─ No relevant goal? → No action
   └─ Goal found → Continue
   ↓
6. Goal already satisfied?
   ├─ Yes → No action
   └─ No → Continue
   ↓
7. Simple Planner selects best action
   ├─ No applicable action? → No action
   └─ Action found → Continue
   ↓
8. Create plan, cache it
   ↓
9. Return action index
   ↓
10. Action executes normally (via rule → operations)
```

### 3.4 Testing Requirements

**Unit Tests:** `tests/unit/goap/planning/simplePlanner.test.js`
- Test plan creation
- Test plan validation
- Test action selection
- Test edge cases (no actions, no goals)

**Unit Tests:** `tests/unit/goap/planning/planCache.test.js`
- Test cache storage and retrieval
- Test invalidation
- Test clearing

**Unit Tests:** `tests/unit/turns/providers/goapDecisionProvider.test.js`
- Test decision workflow
- Test plan caching
- Test plan validation
- Test goal selection integration
- Test fallback behavior

**Integration Tests:** `tests/integration/goap/goapWorkflow.integration.test.js`
- Test full GOAP workflow end-to-end
- Test with real actions and goals
- Test plan caching across turns
- Test plan invalidation on state changes
- Test multiple actors with different goals

**E2E Tests:** `tests/e2e/goap/catBehavior.e2e.test.js`
- Test cat finding and eating food
- Test cat resting when tired
- Test cat playing when bored

**Coverage Target:** 90% branches, 95% functions/lines

### 3.5 Documentation

**Location:** `docs/goap/simple-planner.md`

**Topics:**
- One-step planning algorithm
- Plan structure
- Plan caching strategy
- Plan validation
- Integration with decision provider
- Limitations vs. full A* planner
- Migration path to Tier 2

---

## Integration Points

### 4.1 Dependency Injection

**New Tokens File:** `src/dependencyInjection/tokens/tokens-goap.js`

```javascript
export const goapTokens = {
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
};
```

**New Registrations File:** `src/dependencyInjection/registrations/goapRegistrations.js`

```javascript
import { goapTokens } from '../tokens/tokens-goap.js';
import { EffectsAnalyzer } from '../../goap/analysis/effectsAnalyzer.js';
import { EffectsGenerator } from '../../goap/generation/effectsGenerator.js';
// ... imports ...

export function registerGoapServices(container) {
  // Analysis
  container.register(goapTokens.IEffectsAnalyzer, EffectsAnalyzer);
  container.register(goapTokens.IEffectsGenerator, EffectsGenerator);
  // ... etc ...

  // Goals
  container.register(goapTokens.IGoalManager, GoalManager);
  container.register(goapTokens.IGoalStateEvaluator, GoalStateEvaluator);

  // Selection
  container.register(goapTokens.IActionSelector, ActionSelector);

  // Planning
  container.register(goapTokens.ISimplePlanner, SimplePlanner);
  container.register(goapTokens.IPlanCache, PlanCache);
}
```

**Update:** `src/dependencyInjection/containerFactory.js`

```javascript
import { registerGoapServices } from './registrations/goapRegistrations.js';

export function createContainer() {
  const container = new Container();

  // ... existing registrations ...
  registerGoapServices(container);

  return container;
}
```

### 4.2 Loader Integration

**Update Goal Loader:** Already exists at `src/loaders/goalLoader.js`

**Ensure Loading:** `src/loaders/modsLoader.js`

```javascript
async function loadMods(modList) {
  // ... existing loaders ...

  // Load goals
  await this.#goalLoader.load(modList);

  // ... continue ...
}
```

### 4.3 Action Discovery Integration

**Update:** `src/data/providers/availableActionsProvider.js`

```javascript
async function getAvailableActions(actor) {
  const validActions = await this.#actionDiscovery.discover(actor);

  const playerType = determineSpecificPlayerType(actor);

  if (playerType === 'goap') {
    // Filter to actions with planning effects only
    return validActions.filter(action => action.planningEffects);
  }

  return validActions;
}
```

### 4.4 Schema Updates

**Action Schema:** Add optional `planningEffects` field (see 1.2.4)

**New Schema:** `data/schemas/planning-effects.schema.json` (see 1.2.3)

**Goal Schema:** Already exists at `data/schemas/goal.schema.json` (no changes needed)

---

## Testing Strategy

### 5.1 Test Structure

```
tests/
├── unit/
│   └── goap/
│       ├── analysis/
│       │   ├── effectsAnalyzer.test.js
│       │   └── effectsAnalyzer.edgeCases.test.js
│       ├── generation/
│       │   ├── effectsGenerator.test.js
│       │   └── effectsGenerator.validation.test.js
│       ├── goals/
│       │   ├── goalManager.test.js
│       │   ├── goalStateEvaluator.test.js
│       │   └── goalStateEvaluator.scopeDsl.test.js
│       ├── selection/
│       │   └── actionSelector.test.js
│       └── planning/
│           ├── simplePlanner.test.js
│           └── planCache.test.js
├── integration/
│   └── goap/
│       ├── effectsGeneration.integration.test.js
│       ├── goalActionSelection.integration.test.js
│       └── goapWorkflow.integration.test.js
└── e2e/
    └── goap/
        ├── catBehavior.e2e.test.js
        ├── goblinBehavior.e2e.test.js
        └── monsterBehavior.e2e.test.js
```

### 5.2 Test Helpers

**Location:** `tests/common/goap/goapTestHelpers.js`

```javascript
/**
 * Creates a mock GOAP actor with specified properties
 */
export function createGoapActor(properties = {}) {
  // Implementation
}

/**
 * Creates a test goal definition
 */
export function createTestGoal(overrides = {}) {
  // Implementation
}

/**
 * Creates an action with planning effects
 */
export function createActionWithEffects(actionId, effects) {
  // Implementation
}

/**
 * Simulates world state for testing
 */
export function createWorldState(entities = {}, components = {}) {
  // Implementation
}

/**
 * Asserts plan structure is valid
 */
export function assertValidPlan(plan) {
  // Implementation
}
```

### 5.3 Coverage Requirements

**Minimum Coverage:**
- Branches: 90%
- Functions: 95%
- Lines: 95%
- Statements: 95%

**Critical Paths (100% coverage):**
- Goal selection algorithm
- Action selection algorithm
- Plan validation
- Effect generation from operations

### 5.4 Performance Tests

**Location:** `tests/performance/goap/`

**Tests:**
- Effects generation for 200 actions: < 5s
- Goal selection from 50 goals: < 10ms
- Action selection from 100 actions: < 50ms
- Plan creation: < 5ms

---

## Success Criteria

### 6.1 Functional Requirements

**Effects Auto-Generation:**
- ✅ Generates effects for ~100-200 state-changing actions
- ✅ Effects accurately reflect rule operations
- ✅ Validation tool catches desync
- ✅ No manual authoring required

**Goal System:**
- ✅ Selects highest-priority relevant goal
- ✅ Evaluates relevance conditions correctly
- ✅ Evaluates goal state correctly
- ✅ Supports JSON Logic and ScopeDSL (reference: `docs/scopeDsl/`)

**Simple Planner:**
- ✅ Selects best action toward goal
- ✅ Creates valid plans
- ✅ Caches plans correctly
- ✅ Validates plans before use

**Integration:**
- ✅ Works with existing action discovery
- ✅ Works with existing turn system
- ✅ Coexists with LLM agents
- ✅ GOAP agents behave correctly

### 6.2 Non-Functional Requirements

**Performance:**
- ✅ Effects generation: < 5s for all actions
- ✅ Goal selection: < 10ms per actor
- ✅ Action selection: < 50ms per actor
- ✅ Total decision time: < 100ms per actor per turn

**Quality:**
- ✅ 90% branch coverage, 95% function/line coverage
- ✅ All tests pass
- ✅ No ESLint errors
- ✅ TypeScript types valid

**Documentation:**
- ✅ Effects generation documented
- ✅ Goal system documented
- ✅ Simple planner documented
- ✅ Examples for 3 creature types (cat, goblin, monster)

### 6.3 Acceptance Criteria

**Scenario 1: Cat Finding Food**
```
Given: Cat actor with hunger < 30, food item at location
When: GOAP decision provider runs
Then: Cat selects goal "find_food"
And: Cat selects action "pick_up_item" targeting food
And: Cat executes action successfully
And: Cat has food in inventory after execution
```

**Scenario 2: Goblin Attacking Enemy**
```
Given: Goblin actor, enemy present, weapon at location
When: GOAP decision provider runs
Then: Goblin selects goal "defeat_enemy"
And: Goblin selects action "pick_up_weapon" (to improve damage)
And: Goblin executes action successfully
And: Next turn, goblin attacks enemy
```

**Scenario 3: Multiple Actors**
```
Given: 5 GOAP actors with different goals
When: All actors take turns
Then: Each actor selects appropriate goal
And: Each actor selects appropriate action
And: No conflicts or errors occur
And: Performance remains < 100ms per actor
```

---

## Implementation Timeline

### 7.1 Phase 1: Effects Auto-Generation (Weeks 1-8)

**Weeks 1-2: Analysis & Design**
- Design effects analyzer architecture
- Define operation mapping table
- Create planning-effects schema
- Set up DI tokens and registrations
- **Deliverable:** Design document, schema

**Weeks 3-4: Core Implementation**
- Implement EffectsAnalyzer
- Implement EffectsGenerator
- Implement operation-to-effect mapping
- Handle conditional operations
- **Deliverable:** Working generators

**Weeks 5-6: Content Generation**
- Auto-generate effects for ~100-200 actions
- Implement validation tool
- Run validation, fix issues
- Manual review of generated effects
- **Deliverable:** Generated effects, validation report

**Weeks 7-8: Testing & Documentation**
- Write unit tests (90%+ coverage)
- Write integration tests
- Write documentation
- Performance testing
- **Deliverable:** Tested, documented system

### 7.2 Phase 2: Goal System (Weeks 9-12)

**Weeks 9-10: Goal Management**
- Implement GoalManager
- Implement GoalStateEvaluator
- Integrate with existing goal loader
- Support JSON Logic and ScopeDSL (reference: `docs/scopeDsl/`)
- **Deliverable:** Working goal system

**Weeks 11-12: Action Selection**
- Implement ActionSelector
- Implement effect simulation
- Implement progress calculation
- Testing and debugging
- **Deliverable:** Working action selector

### 7.3 Phase 3: Simple Planner (Weeks 13-16)

**Weeks 13-14: Planning Core**
- Implement SimplePlanner
- Implement PlanCache
- Implement plan validation
- **Deliverable:** Working planner

**Weeks 15-16: Integration & Testing**
- Update GoapDecisionProvider
- Integration with turn system
- End-to-end testing
- Performance optimization
- **Deliverable:** Fully integrated GOAP Tier 1

### 7.4 Milestone Summary

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 2 | Effects design complete | Schema, architecture |
| 4 | Effects generator working | Code, unit tests |
| 6 | Effects generated | ~100-200 actions with effects |
| 8 | Effects validated | Validation report, docs |
| 10 | Goal system working | Goal management, selection |
| 12 | Action selection working | Greedy selector, tests |
| 14 | Simple planner working | One-step planner, cache |
| 16 | Full integration | GOAP Tier 1 complete |

---

## Dependencies

### 8.1 Existing Systems

**Required (must exist):**
- ✅ Goal loader (`src/loaders/goalLoader.js`)
- ✅ Goal schema (`data/schemas/goal.schema.json`)
- ✅ Player type system (`src/utils/actorTypeUtils.js`)
- ✅ Action discovery system (`src/data/providers/availableActionsProvider.js`)
- ✅ Rule loader (`src/loaders/ruleLoader.js`)
- ✅ Operation handlers (`src/logic/operationHandlers/`)
- ✅ JSON Logic evaluator (`src/logic/jsonLogicEvaluator.js`)
- ✅ ScopeDSL engine (`src/scopeDsl/engine.js`, reference: `docs/scopeDsl/`)
- ✅ Turn system (`src/turns/`)
- ✅ Event bus (`src/events/eventBus.js`)

**Assumed Working:**
- ✅ Action validation (forbidden_components, required_components, prerequisites)
- ✅ Component system (add/remove/modify)
- ✅ Entity system

### 8.2 External Dependencies

**No new npm packages required** - uses existing dependencies:
- `lodash` - Utility functions
- `uuid` - ID generation
- `ajv` - Schema validation

### 8.3 Documentation Dependencies

**ScopeDSL Documentation:**
- `docs/scopeDsl/README.md` - Core concepts
- `docs/scopeDsl/quick-reference.md` - Syntax reference
- `docs/scopeDsl/error-handling-guide.md` - Error handling

**Testing Documentation:**
- `docs/testing/mod-testing-guide.md` - Testing patterns

---

## Risk Mitigation

### 9.1 Technical Risks

**Risk 1: Effects Don't Match Rules**

**Likelihood:** Medium
**Impact:** High
**Mitigation:**
- Automated validation tool
- Manual review of generated effects
- Integration tests comparing effects to actual execution
- Warning system for desync detection

**Risk 2: Goal Selection Too Simplistic**

**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Extensible priority system
- Support for complex relevance conditions
- Easy to add dynamic priority in future
- Test with diverse goals

**Risk 3: Performance Issues**

**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Performance tests in test suite
- Plan caching reduces replanning
- Action filtering reduces search space
- Profile and optimize hotspots

**Risk 4: ScopeDSL Integration Complexity**

**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Comprehensive documentation exists (`docs/scopeDsl/`)
- ScopeDSL engine well-tested
- Use existing error handling patterns
- Start with simple goal states, add complexity gradually

### 9.2 Adoption Risks

**Risk 1: Modders Don't Use GOAP**

**Likelihood:** Low
**Impact:** Low
**Mitigation:**
- Auto-generation requires no manual work
- Clear documentation and examples
- Useful for specific use cases (goblins, cats)
- Optional feature (doesn't affect LLM agents)

**Risk 2: Complex Configuration**

**Likelihood:** Medium
**Impact:** Low
**Mitigation:**
- Provide goal templates for common creature types
- Clear examples in documentation
- Validation tools catch errors early

### 9.3 Project Risks

**Risk 1: Scope Creep**

**Likelihood:** High
**Impact:** High
**Mitigation:**
- **STRICT TIER 1 SCOPE** - No A* planner, no custom DSL
- Clear success criteria
- Phased approach (can stop after Phase 1 if needed)
- Regular milestone reviews

**Risk 2: Timeline Overrun**

**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Buffer built into timeline (16 weeks for 12-14 weeks work)
- Incremental deliverables (can ship partial features)
- Regular progress tracking
- Clear dependencies and blockers

---

## Appendix A: CLI Commands

**Effects Generation:**
```bash
# Generate effects for all actions
npm run generate:effects

# Generate effects for specific mod
npm run generate:effects -- --mod=positioning

# Validate generated effects
npm run validate:effects

# Validate effects for specific mod
npm run validate:effects -- --mod=positioning
```

**Goal Management:**
```bash
# List all loaded goals
npm run goals:list

# Show goals for specific mod
npm run goals:list -- --mod=core

# Validate goal definitions
npm run validate:goals
```

**Testing:**
```bash
# Run all GOAP tests
npm run test:unit -- tests/unit/goap/
npm run test:integration -- tests/integration/goap/
npm run test:e2e -- tests/e2e/goap/

# Run specific GOAP test
npm run test:unit -- tests/unit/goap/analysis/effectsAnalyzer.test.js

# Run with coverage
npm run test:unit -- tests/unit/goap/ --coverage
```

**Development:**
```bash
# Type check GOAP modules
npm run typecheck

# Lint GOAP files
npx eslint src/goap/

# Format GOAP files
npm run format
```

---

## Appendix B: File Checklist

### New Files to Create

**Analysis & Generation:**
- [ ] `src/goap/analysis/effectsAnalyzer.js`
- [ ] `src/goap/generation/effectsGenerator.js`
- [ ] `src/goap/validation/effectsValidator.js`

**Goals:**
- [ ] `src/goap/goals/goalManager.js`
- [ ] `src/goap/goals/goalStateEvaluator.js`

**Selection:**
- [ ] `src/goap/selection/actionSelector.js`

**Planning:**
- [ ] `src/goap/planning/simplePlanner.js`
- [ ] `src/goap/planning/planCache.js`

**DI:**
- [ ] `src/dependencyInjection/tokens/tokens-goap.js`
- [ ] `src/dependencyInjection/registrations/goapRegistrations.js`

**Schemas:**
- [ ] `data/schemas/planning-effects.schema.json`

**Tests (Unit):**
- [ ] `tests/unit/goap/analysis/effectsAnalyzer.test.js`
- [ ] `tests/unit/goap/generation/effectsGenerator.test.js`
- [ ] `tests/unit/goap/validation/effectsValidator.test.js`
- [ ] `tests/unit/goap/goals/goalManager.test.js`
- [ ] `tests/unit/goap/goals/goalStateEvaluator.test.js`
- [ ] `tests/unit/goap/selection/actionSelector.test.js`
- [ ] `tests/unit/goap/planning/simplePlanner.test.js`
- [ ] `tests/unit/goap/planning/planCache.test.js`

**Tests (Integration):**
- [ ] `tests/integration/goap/effectsGeneration.integration.test.js`
- [ ] `tests/integration/goap/goalActionSelection.integration.test.js`
- [ ] `tests/integration/goap/goapWorkflow.integration.test.js`

**Tests (E2E):**
- [ ] `tests/e2e/goap/catBehavior.e2e.test.js`
- [ ] `tests/e2e/goap/goblinBehavior.e2e.test.js`
- [ ] `tests/e2e/goap/monsterBehavior.e2e.test.js`

**Test Helpers:**
- [ ] `tests/common/goap/goapTestHelpers.js`

**Documentation:**
- [ ] `docs/goap/effects-auto-generation.md`
- [ ] `docs/goap/goal-system.md`
- [ ] `docs/goap/simple-planner.md`
- [ ] `docs/goap/README.md`
- [ ] `docs/goap/operation-result-structures.md` (NEW - documents result_variable structures)
- [ ] `docs/goap/abstract-preconditions.md` (NEW - abstract precondition catalog)
- [ ] `docs/goap/macro-resolution.md` (NEW - macro expansion for effects generation)

**Scripts:**
- [ ] `scripts/generateEffects.js`
- [ ] `scripts/validateEffects.js`

### Files to Update

**Existing Files:**
- [ ] `src/turns/providers/goapDecisionProvider.js` - Replace placeholder
- [ ] `src/data/providers/availableActionsProvider.js` - Filter for GOAP
- [ ] `src/loaders/modsLoader.js` - Ensure goal loading
- [ ] `src/dependencyInjection/containerFactory.js` - Register GOAP services
- [ ] `data/schemas/action.schema.json` - Add planningEffects field
- [ ] `package.json` - Add npm scripts

---

## Appendix C: Example Generated Effects

**Action:** `positioning:sit_down`

**Rule Operations:**
```javascript
[
  {
    "type": "ADD_COMPONENT",
    "entity": "actor",
    "component": "positioning:sitting_on",
    "data": {
      "furniture_id": { "ref": "target.id" },
      "spot_index": { "fn": "allocateSpot", "args": ["target"] }
    }
  },
  {
    "type": "LOCK_MOVEMENT",
    "entity": "actor"
  },
  {
    "type": "ESTABLISH_SITTING_CLOSENESS",
    "condition": { ">": [{ "fn": "adjacentActors.length" }, 0] },
    "actor": "actor",
    "furniture": "target"
  }
]
```

**Generated Planning Effects:**
```json
{
  "effects": [
    {
      "operation": "ADD_COMPONENT",
      "entity": "actor",
      "component": "positioning:sitting_on",
      "data": {
        "furniture_id": { "ref": "target.id" },
        "spot_index": { "hypothetical": "allocateSpot" }
      }
    },
    {
      "operation": "ADD_COMPONENT",
      "entity": "actor",
      "component": "positioning:movement_locked"
    },
    {
      "operation": "CONDITIONAL",
      "condition": { ">": [{ "fn": "adjacentActors.length" }, 0] },
      "then": [
        {
          "operation": "ADD_COMPONENT",
          "entity": "actor",
          "component": "positioning:sitting_close_to",
          "data": { "target_id": { "ref": "target.id" } }
        }
      ]
    }
  ],
  "cost": 1.0
}
```

---

## Appendix D: Specification Revisions

**Version:** 1.1
**Date:** 2025-01-09
**Changes:** Corrections based on codebase analysis

### Major Changes

#### 1. Data Flow Analysis and Context Variables (Section 1.3.0 - NEW)

**Issue:** Original spec didn't account for operations that query data and store results in context variables, which are then used by later operations.

**Real Pattern from Rules:**
```javascript
// Query operation stores result
{ "type": "VALIDATE_INVENTORY_CAPACITY", "result_variable": "capacityCheck" }
// Later operations use stored result
{ "type": "IF", "condition": { "==": [{ "var": "context.capacityCheck.valid" }, false] } }
```

**Solution Added:**
- New section 1.3.0 "Data Flow Analysis and Context Variables"
- Strategy 1: Final State Only (Recommended for Tier 1)
- Strategy 2: Explicit Data Flow (Deferred to Tier 2)
- Abstract preconditions concept
- Simulation functions for query operations
- Complete example of `handle_pick_up_item` analysis

**Impact:** Critical - Without this, effects generation cannot handle conditional logic based on runtime queries.

#### 2. Operation Type Corrections (Section 1.2.1)

**Issues Found:**
- ❌ `CREATE_ENTITY` and `DESTROY_ENTITY` listed but don't exist in codebase
- Missing many state-changing operations that DO exist
- Query operations wrongly excluded (needed for conditional effects)

**Corrections:**
- Removed non-existent operations
- Added 10+ missing state-changing operations (ATOMIC_MODIFY_COMPONENT, OPEN_CONTAINER, etc.)
- Created new category: "Operations Producing Context Data"
- Added "Control Flow Operations" category
- Expanded excluded operations list with explanations

**Impact:** High - Ensures effects generator targets the correct operations.

#### 3. GoapDecisionProvider Interface (Section 3.2.3)

**Issue:** Spec didn't match existing `DelegatingDecisionProvider` pattern.

**Corrections:**
- Documented current placeholder implementation
- Updated interface to use delegate pattern
- Fixed parameter names (actor object vs actorId string)
- Added note about indexed actions array structure
- Added `safeEventDispatcher` dependency

**Impact:** Medium - Prevents implementation confusion.

#### 4. Effects Schema Extension (Section 1.2.3)

**Issue:** Original schema didn't support abstract preconditions.

**Addition:**
- Added `abstractPreconditions` field to schema
- Documents simulation function metadata
- Optional field for effects that use abstract conditions

**Impact:** Medium - Enables Strategy 1 approach for data flow.

#### 5. Macro Resolution (Section 1.2.4)

**Issue:** Spec didn't mention macros, but rules extensively use them.

**Addition:**
- Added macro resolution step to generation workflow
- Documented requirement to expand macros before analysis
- Added documentation file: `docs/goap/macro-resolution.md`

**Impact:** High - Cannot generate accurate effects without resolving macros.

### Minor Changes

#### 6. Documentation Files Added

**New Files in Appendix B:**
- `docs/goap/operation-result-structures.md` - Documents result_variable structures for query operations
- `docs/goap/abstract-preconditions.md` - Catalog of abstract precondition functions
- `docs/goap/macro-resolution.md` - Macro expansion guide

**Impact:** Low - Improves documentation completeness.

#### 7. Conditional Operations Expansion (Section 1.3.2)

**Enhancement:**
- Original example was simple
- Added note about nested IF operations
- Referenced real rules with complex branching

**Impact:** Low - Better examples for implementers.

### Assumptions Validated

The following assumptions in the original spec were **CORRECT**:

✅ **File Paths:**
- `src/loaders/goalLoader.js` - EXISTS
- `data/schemas/goal.schema.json` - EXISTS
- `src/turns/providers/goapDecisionProvider.js` - EXISTS
- `src/loaders/ruleLoader.js` - EXISTS (assumed)

✅ **Goal Schema:**
- Structure matches spec (id, priority, relevance, goalState)

✅ **ScopeDSL Documentation:**
- `docs/scopeDsl/README.md` - EXISTS
- `docs/scopeDsl/quick-reference.md` - EXISTS
- `docs/scopeDsl/error-handling-guide.md` - EXISTS

✅ **Basic Architecture:**
- Effects as planning metadata (not execution)
- Single source of truth (rules are authoritative)
- Auto-generation approach

### Implementation Recommendations

Based on codebase analysis, the following priorities are recommended:

**Phase 1 (Weeks 1-4): Foundation**
1. Implement EffectsAnalyzer with data flow tracking
2. Implement macro resolution integration
3. Create abstract precondition catalog

**Phase 1 (Weeks 5-8): Generation**
4. Implement path tracing for IF operations
5. Generate effects for 20-30 simple actions first
6. Test Strategy 1 approach thoroughly before proceeding

**Critical Dependencies:**
- Macro loader/resolver from existing rule system
- Operation handler registry for validating operation types
- Component schema for validating component references

**Risk Mitigation:**
- Start with actions that have no conditionals
- Validate generated effects against manual execution
- Create diff tool to compare effects vs actual rule execution

### Open Questions

The following questions should be resolved during implementation:

1. **Macro Expansion Timing:** Should macros be expanded during effects generation or during rule loading?
2. **Simulation Function Location:** Where should simulation functions live? In SimplePlanner or separate service?
3. **Abstract Precondition Registry:** Should this be a static catalog or dynamically generated?
4. **Effect Validation:** How to validate that generated effects match actual execution without running the action?

### Version History

- **1.0** (2025-01-09) - Initial specification
- **1.1** (2025-01-09) - Corrections based on codebase analysis (this version)

---

**End of Specification**
