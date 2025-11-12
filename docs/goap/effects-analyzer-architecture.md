# Effects Analyzer Architecture

## Overview

The Effects Analyzer is a core component of GOAP Tier 1 that automatically generates planning metadata from action rules. It analyzes rule operations, traces execution paths through conditionals, and outputs planning effects that describe how actions change world state.

**Important**: Macros are expanded during rule loading by `RuleLoader` before rules reach the analyzer. The analyzer works with fully-expanded rule operations.

## Design Principles

1. **Automated Analysis**: No manual effect authoring required
2. **Schema Compliance**: All generated effects validate against planning-effects.schema.json
3. **Conservative**: When uncertain, preserve runtime placeholders (e.g., `{itemId}`) rather than making incorrect assumptions
4. **Efficient**: Analysis happens once during mod loading, not at runtime

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Effects Generation System                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              EffectsGenerator                        │  │
│  │  (Orchestrator for mod/action effect generation)    │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                      │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              EffectsAnalyzer                         │  │
│  │  - Analyzes rule operations                          │  │
│  │  - Traces conditional execution paths                │  │
│  │  - Identifies state-changing operations              │  │
│  │  - Generates abstract preconditions                  │  │
│  │  - Converts operations to planning effects           │  │
│  │  - Calculates action costs                           │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                      │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
       ┌────────────────────────────────┐
       │    Schema Validator (AJV)      │
       │  Validates planning effects    │
       └────────────────────────────────┘
                       │
                       ▼
       ┌────────────────────────────────┐
       │     Planning Effects (JSON)    │
       │  Attached to action definition │
       └────────────────────────────────┘
```

**Note**: During GOAP planning (runtime), `AbstractPreconditionSimulator` evaluates abstract preconditions against simulated world state.

## Component Responsibilities

### EffectsGenerator

**Location**: `src/goap/generation/effectsGenerator.js`

**Purpose**: Orchestrates generation of planning effects for actions and mods

**Responsibilities:**
- Iterates through actions in a mod
- Finds rules associated with each action
- Delegates rule analysis to EffectsAnalyzer
- Merges effects from multiple rules (if applicable)
- Validates generated effects against schema
- Injects planning effects into action definitions

**Key Methods:**
- `generateForMod(modId)` - Generates effects for all actions in a mod
- `generateForAction(actionId)` - Generates effects for a single action
- `validateEffects(actionId, effects)` - Validates effects against schema
- `injectEffects(effectsMap)` - Injects effects into action definitions

**Dependencies:**
- `ILogger`: Logging service
- `IEffectsAnalyzer`: Rule operation analyzer
- `IDataRegistry`: Access to actions and rules
- `IAjvSchemaValidator`: Schema validation

---

### EffectsAnalyzer

**Location**: `src/goap/analysis/effectsAnalyzer.js`

**Purpose**: Analyzes rule operations and extracts planning effects

**Responsibilities:**
- Analyzes data flow (operations that produce context variables)
- Traces execution paths through conditionals (IF, IF_CO_LOCATED)
- Extracts state-changing operations from each path
- Converts operations to planning effect format
- Generates abstract preconditions for runtime-dependent conditions
- Calculates action cost based on effect complexity

**Key Methods:**
- `analyzeRule(ruleId)` - Main entry point, returns planning effects
- `isWorldStateChanging(operation)` - Checks if operation changes state
- `isContextProducing(operation)` - Checks if operation produces data
- `operationToEffect(operation)` - Converts operation to planning effect

**Internal Process:**
1. Load rule from data registry
2. Analyze data flow (track context-producing operations)
3. Trace execution paths (handle IF/IF_CO_LOCATED recursively)
4. Extract state-changing effects from paths
5. Generate abstract preconditions
6. Calculate cost
7. Return planning effects object

**Dependencies:**
- `ILogger`: Logging service
- `IDataRegistry`: Access to rules

---

### AbstractPreconditionSimulator

**Location**: `src/goap/simulation/abstractPreconditionSimulator.js`

**Purpose**: Simulates abstract preconditions during GOAP planning (runtime)

**Note**: This component is used during planning to evaluate abstract preconditions against simulated world state, NOT during effect generation.

**Responsibilities:**
- Simulates abstract preconditions defined in planning effects
- Evaluates conditions against simulated world state
- Supports multiple precondition types (hasInventoryCapacity, hasComponent, etc.)

**Key Methods:**
- `simulate(functionName, parameters, worldState)` - Main simulation entry point

**Supported Preconditions:**
- `hasInventoryCapacity` - Checks if actor has inventory space for an item
- `hasContainerCapacity` - Checks if container has space for an item
- `hasComponent` - Checks if entity has a specific component

**World State Structure:**
```javascript
{
  entities: {
    [entityId]: {
      components: {
        [componentId]: componentData
      }
    }
  }
}
```

**Dependencies:**
- `ILogger`: Logging service

---

## Data Flow

### Effect Generation Flow (Mod Loading Time)

```
1. EffectsGenerator.generateForMod(modId)
        ↓
2. For each action in mod:
   - Find associated rules
        ↓
3. EffectsAnalyzer.analyzeRule(ruleId)
   a. Load rule operations from data registry
   b. Analyze data flow (identify context-producing operations)
   c. Trace execution paths (recursively handle IF/IF_CO_LOCATED)
   d. Extract state-changing operations from each path
   e. Convert operations to planning effects
   f. Generate abstract preconditions from context operations
   g. Calculate cost
   h. Return planning effects object
        ↓
4. Merge effects from multiple rules (if applicable)
        ↓
5. Validate effects against schema (AJV)
        ↓
6. Inject planning effects into action definition
        ↓
7. Planning effects now available for GOAP planning
```

### Planning Flow (Runtime)

```
1. ActionSelector receives available actions
        ↓
2. Filter actions to those with planningEffects
        ↓
3. For each action:
   a. Clone current world state
   b. Simulate action effects:
      - Apply each effect in sequence
      - For CONDITIONAL effects:
        * Evaluate condition (may use AbstractPreconditionSimulator)
        * Apply then or else branch
      - Update simulated world state
   c. Calculate distance to goal state
   d. Compute progress score
        ↓
4. Select action with highest positive progress
```

### Abstract Precondition Evaluation Flow

```
When evaluating CONDITIONAL effect during planning:

1. Effect has condition with abstractPrecondition
        ↓
2. Extract precondition name and parameters
        ↓
3. Check simulation strategy:
   - assumeTrue: return true
   - assumeFalse: return false
   - evaluateAtRuntime: call AbstractPreconditionSimulator
        ↓
4. If evaluateAtRuntime:
   AbstractPreconditionSimulator.simulate(name, params, worldState)
   - hasComponent: check simulated world state
   - hasInventoryCapacity: calculate weight and compare
   - hasContainerCapacity: check container contents
        ↓
5. Apply appropriate effect branch (then/else)
```

---

## Operation Analysis Examples

### Simple Component Operation

```json
// Input: Rule operation
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity": "actor",
    "component": "positioning:sitting",
    "data": {}
  }
}

// Output: Planning effect (direct mapping)
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:sitting",
  "data": {}
}
```

### Conditional Operation with Branches

```json
// Input: Rule IF operation
{
  "type": "IF",
  "parameters": {
    "condition": { "var": "hasSpace" },
    "then_actions": [
      { "type": "ADD_COMPONENT", "parameters": {...} }
    ],
    "else_actions": [
      { "type": "ADD_COMPONENT", "parameters": {...} }
    ]
  }
}

// Output: Conditional planning effect
{
  "operation": "CONDITIONAL",
  "condition": { "var": "hasSpace" },
  "then": [
    { "operation": "ADD_COMPONENT", ... }
  ],
  "else": [
    { "operation": "ADD_COMPONENT", ... }
  ]
}
```

### Operation Mapped to Component Effect

```json
// Input: High-level operation
{
  "type": "LOCK_MOVEMENT",
  "parameters": { "entity": "actor" }
}

// Output: Mapped to component operation
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:movement_locked",
  "data": {}
}
```

**Note**: EffectsAnalyzer contains conversion methods (`#convertLockMovement`, `#convertUnlockMovement`, etc.) that map high-level operations to component-level effects.

---

## Error Handling

### Unknown Operations

When EffectsAnalyzer encounters an unknown state-changing operation:
- Logs warning: `"Unknown or unhandled state-changing operation: {type}"`
- Returns `null` from `operationToEffect()`
- Continues analyzing remaining operations
- Operation is excluded from planning effects

### Schema Validation Failures

When generated effects fail schema validation (in EffectsGenerator):
- Logs error with validation details
- Throws exception to prevent invalid effects
- Action generation fails
- Requires fix before mod can load successfully

### Missing Rules

When EffectsGenerator can't find a rule for an action:
- Tries standard naming: `{modId}:handle_{actionName}`
- Falls back to searching rules by action reference
- Returns `null` if no rules found
- Action has no planning effects (won't be used by GOAP planner)

---

## Performance Considerations

### When Effects Are Generated

- **Timing**: During mod loading (once per session)
- **Not at runtime**: Effects are pre-generated and cached in action definitions
- **Cost**: One-time cost during initialization

### Optimization

- **Stateless analysis**: EffectsAnalyzer methods are stateless and efficient
- **Hardcoded operation lists**: No registry lookup overhead
- **Simple conversions**: Direct mapping from operations to effects where possible

### Observed Performance

Based on e2e tests (`tests/e2e/goap/`):
- Effects generation completes during mod loading without noticeable delay
- Planning (runtime) operates on pre-generated effects efficiently
- System handles multiple actors with concurrent GOAP decisions

---

## Testing Strategy

### E2E Tests

The GOAP system has comprehensive e2e tests in `tests/e2e/goap/`:

**Core Capabilities Tested:**
- `ActionSelectionWithEffectSimulation.e2e.test.js` - Verifies action filtering and progress calculation
- `AbstractPreconditionConditionalEffects.e2e.test.js` - Tests conditional effects with abstract preconditions (hasComponent, hasInventoryCapacity)
- `CompleteGoapDecisionWithRealMods.e2e.test.js` - Full workflow from mod loading to execution
- `PlanningEffectsMatchRuleExecution.e2e.test.js` - Validates planning effects match actual state changes
- `GoalRelevanceAndSatisfactionEvaluation.e2e.test.js` - Complex JSON Logic evaluation in goals
- `GoalPrioritySelectionWorkflow.e2e.test.js` - Priority-based goal selection
- `ErrorRecoveryAndGracefulDegradation.e2e.test.js` - Error handling and edge cases
- `MultiActorConcurrentGoapDecisions.e2e.test.js` - Concurrent planning
- `GoapPerformanceUnderLoad.e2e.test.js` - Performance characteristics

### Unit Tests

**EffectsAnalyzer** (`tests/unit/goap/analysis/`):
- Test operation identification (state-changing vs context-producing)
- Test path tracing through conditionals
- Test effect conversion for different operation types
- Test abstract precondition generation
- Test cost calculation

**EffectsGenerator** (`tests/unit/goap/generation/`):
- Test mod-level generation
- Test rule finding for actions
- Test effect merging from multiple rules
- Test schema validation integration

**AbstractPreconditionSimulator** (`tests/unit/goap/simulation/`):
- Test inventory capacity simulation
- Test component existence checks
- Test simulated world state evaluation

---

## Implementation Status

### Currently Working

✅ **Effect Generation from Rules**
- State-changing operation identification
- Conditional path tracing (IF, IF_CO_LOCATED)
- Abstract precondition generation
- Schema validation

✅ **Runtime Planning**
- Effect simulation during planning
- Abstract precondition evaluation
- Goal selection and prioritization
- Action selection by progress

✅ **Supported Operations**
- Component operations (ADD, REMOVE, MODIFY)
- Movement and positioning
- Closeness relationships
- Items and inventory
- Containers
- Clothing
- Following and companionship

### Known Limitations

⚠️ **Operation Coverage**
- Some operations map to generic effects
- Complex operations (loops) have limited support
- Custom operation handlers require manual conversion methods

⚠️ **Runtime Placeholders**
- Unresolvable values preserved as `{varName}` strings
- Requires runtime resolution during execution
- Planning simulations use placeholder values

### Potential Future Improvements

- More sophisticated cost estimation based on operation complexity
- Better handling of FOR_EACH and loop operations
- Automatic detection of goal compatibility for actions
- Effect optimization (merging redundant effects)

---

## Related Documentation

- **Planning Effects Schema**: `data/schemas/planning-effects.schema.json`
- **E2E Tests**: `tests/e2e/goap/` - Demonstrates proven capabilities
- **Source Code**:
  - `src/goap/analysis/effectsAnalyzer.js` - Core analysis logic
  - `src/goap/generation/effectsGenerator.js` - Orchestration
  - `src/goap/simulation/abstractPreconditionSimulator.js` - Runtime simulation
