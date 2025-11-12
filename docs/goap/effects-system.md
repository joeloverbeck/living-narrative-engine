# GOAP Effects System

## Overview

The GOAP Effects System automatically generates planning metadata from action rules. This system enables the GOAP planner to predict action outcomes without executing them, forming the foundation for intelligent goal-directed behavior.

**Key Concepts:**
- **Planning Effects**: Metadata describing how actions change world state
- **Effects Analyzer**: Analyzes rule operations to extract state changes
- **Runtime Placeholders**: References to values known only at execution time
- **Abstract Preconditions**: Conditions evaluated during planning simulation

**Important**: Planning effects are **metadata only** and are never executed. They describe state changes for planning purposes, while rules contain the actual execution code.

## Table of Contents

1. [Architecture](#architecture)
2. [Effects Analysis Process](#effects-analysis-process)
3. [Runtime Placeholders](#runtime-placeholders)
4. [Generation Workflow](#generation-workflow)
5. [Integration Status](#integration-status)

## Architecture

### System Components

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
│  │  │  - Identifies state-changing operations              │  │
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

### EffectsGenerator

**Location**: `src/goap/generation/effectsGenerator.js`

**Purpose**: Orchestrates generation of planning effects for actions and mods

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

### EffectsAnalyzer

**Location**: `src/goap/analysis/effectsAnalyzer.js`

**Purpose**: Analyzes rule operations and extracts planning effects

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

## Effects Analysis Process

### Operation Categories

The analyzer categorizes operations by their impact on planning:

1. **State-Changing Operations** (51 operations): Modify world state and generate planning effects
   - Component operations: `ADD_COMPONENT`, `REMOVE_COMPONENT`, `MODIFY_COMPONENT`, `ATOMIC_MODIFY_COMPONENT`
   - Movement: `LOCK_MOVEMENT`, `UNLOCK_MOVEMENT`, `SYSTEM_MOVE_ENTITY`
   - Closeness: `ESTABLISH_SITTING_CLOSENESS`, `REMOVE_SITTING_CLOSENESS`, etc.
   - Items: `TRANSFER_ITEM`, `DROP_ITEM_AT_LOCATION`, `PICK_UP_ITEM_FROM_LOCATION`
   - Containers: `OPEN_CONTAINER`, `TAKE_FROM_CONTAINER`, `PUT_IN_CONTAINER`
   - Clothing: `UNEQUIP_CLOTHING`

2. **Context Operations** (13 operations): Produce data for other operations but don't change state
   - Query operations: `QUERY_COMPONENT`, `QUERY_ENTITIES`, `QUERY_LOOKUP`
   - Validation: `VALIDATE_INVENTORY_CAPACITY`, `HAS_COMPONENT`
   - Utilities: `GET_NAME`, `GET_TIMESTAMP`, `SET_VARIABLE`, `MATH`

3. **Control Flow Operations** (3 operations): Structure execution
   - `IF`, `IF_CO_LOCATED`, `SEQUENCE`

4. **Excluded Operations** (24 operations): No planning impact
   - Event dispatching: `DISPATCH_EVENT`, `DISPATCH_SPEECH`, `DISPATCH_THOUGHT`
   - Turn control: `END_TURN`, `REGENERATE_DESCRIPTION`
   - Logging: `LOG`

See [operation-mapping.md](./operation-mapping.md) for complete mapping details.

### Path Tracing

The analyzer traces all possible execution paths through conditional operations:

```json
// Rule with conditional
{
  "type": "IF",
  "parameters": {
    "condition": {"var": "hasSpace"},
    "then_actions": [
      {"type": "ADD_COMPONENT", "entity": "actor", "component": "test:happy"}
    ],
    "else_actions": [
      {"type": "ADD_COMPONENT", "entity": "actor", "component": "test:sad"}
    ]
  }
}

// Generated effect
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "actorHasSpace",
    "params": ["actor"]
  },
  "then": [
    {"operation": "ADD_COMPONENT", "entity": "actor", "component": "test:happy"}
  ]
}
```

**Important**: The analyzer DOES analyze and include else branches (contrary to common assumptions). Both branches are traced and converted to conditional effects.

### Data Flow Analysis

The analyzer tracks data flow through operations to understand state changes:

**Simple Linear Flow:**
```json
{
  "actions": [
    {"type": "SET_VARIABLE", "name": "location", "value": "bedroom"},
    {
      "type": "MODIFY_COMPONENT",
      "entity": "actor",
      "component": "core:position",
      "updates": {"location": {"var": "location"}}
    }
  ]
}
```

**Analysis:**
1. `SET_VARIABLE` creates context: `location = "bedroom"`
2. `MODIFY_COMPONENT` references `location` via variable
3. Analyzer preserves: `"location": "{location}"`
4. At runtime: Resolved to actual value

**Complex Flow with Queries:**
```json
{
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "entity": "target",
      "component": "core:inventory",
      "result_variable": "targetInventory"
    },
    {
      "type": "IF",
      "condition": {"<": [{"var": "targetInventory.itemCount"}, 10]},
      "then": [
        {
          "type": "TRANSFER_ITEM",
          "itemId": {"var": "itemId"},
          "fromEntity": "actor",
          "toEntity": "target"
        }
      ]
    }
  ]
}
```

**Analysis:**
1. `QUERY_COMPONENT` produces context (not a planning effect)
2. `IF` condition references runtime data → **abstract precondition**
3. `TRANSFER_ITEM` in then branch → conditional effects
4. Generated: `CONDITIONAL` effect with abstract precondition

### Effect Conversion Examples

**Simple Component Operation:**
```javascript
// Rule operation
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity": "actor",
    "component": "positioning:sitting",
    "data": {}
  }
}

// Planning effect (direct mapping)
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:sitting",
  "data": {}
}
```

**High-Level Operation Mapped to Component:**
```javascript
// Rule operation
{
  "type": "LOCK_MOVEMENT",
  "parameters": {"entity": "actor"}
}

// Planning effect (mapped)
{
  "operation": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:movement_locked",
  "data": {}
}
```

## Runtime Placeholders

### What Are Runtime Placeholders?

Runtime placeholders are string references that will be resolved during rule execution, not during planning:

```
{actor.id}
{target.location}
{itemId}
{componentType}
```

These appear in rule operations within string values and are resolved at execution time by `resolvePlaceholders()` in `src/utils/contextUtils.js`.

### How Placeholders Work

**During Effects Analysis:**
1. Rule operations are analyzed to identify state-changing operations
2. Runtime placeholders are NOT resolved - they're preserved in generated effects
3. Placeholder notation is used: `"{variableName}"`, `"{actor.location}"`, `"{itemId}"`

**Example from effectsAnalyzer.js:**
```javascript
// Establish closeness operation
{
  operation: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'positioning:sitting_close_to',
  data: {
    targetId: `{${targetEntity}.id}`  // Runtime placeholder preserved
  }
}

// Item transfer operation
const itemId = operation.parameters.item_id || '{itemId}';  // Placeholder if not specified
```

**At Execution Time:**
1. Placeholders are resolved using `resolvePlaceholders()` from `src/utils/contextUtils.js`
2. Context is built from:
   - Action parameters from the action definition
   - Context variables set during execution (SET_VARIABLE operations)
   - Entity data from world state
   - Event data from the triggering event
3. Placeholders replaced with actual runtime values

### Common Placeholder Patterns

**Simple Entity References:**
```javascript
entity: "actor"  // Resolved during execution to actual actor entity ID
entity: "target"  // Resolved to target entity ID from action context
```

**Component ID Placeholders:**
```javascript
{
  operation: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'items:inventory_item',
  data: {itemId: '{itemId}'}  // Resolved at execution time
}
```

**Location Placeholders:**
```javascript
{
  operation: 'ADD_COMPONENT',
  entity: '{itemId}',
  component: 'items:at_location',
  data: {location: '{actor.location}'}  // Actor's current location
}
```

**Entity ID Placeholders:**
```javascript
{
  operation: 'ADD_COMPONENT',
  entity: 'actor',
  component: 'positioning:sitting_close_to',
  data: {targetId: '{target.id}'}  // Target entity's ID
}
```

### Abstract Preconditions

For conditionals that cannot be evaluated during effects analysis, the system uses **abstract preconditions**:

Abstract preconditions represent runtime checks that the planner cannot evaluate statically. They're generated when IF operations have conditions that depend on runtime state.

**Example:**
```javascript
{
  'VALIDATE_INVENTORY_CAPACITY': {
    description: 'Checks if actor can carry the item',
    parameters: ['actorId', 'itemId'],
    simulationFunction: 'assumeTrue'  // Optimistic assumption during planning
  },
  'HAS_COMPONENT': {
    description: 'Checks if entity has component',
    parameters: ['entityId', 'componentId'],
    simulationFunction: 'assumeTrue'
  }
}
```

**How They Work:**
1. **During analysis**: IF operations with runtime-dependent conditions generate CONDITIONAL effects
2. **During simulation**: The planner uses the `simulationFunction` strategy to predict which branch will execute
3. **Simulation strategies**:
   - `assumeTrue`: Optimistically assume condition passes (for capacity checks)
   - `assumeFalse`: Pessimistically assume condition fails
   - `evaluateAtRuntime`: Attempt to evaluate using available entity data

**Example conditional effect:**
```json
{
  "operation": "CONDITIONAL",
  "condition": {
    "abstractPrecondition": "hasComponent",
    "params": ["actor", "positioning:standing"]
  },
  "then": [
    {
      "operation": "REMOVE_COMPONENT",
      "entity": "actor",
      "component": "positioning:standing"
    }
  ],
  "else": []
}
```

See [planning-system.md](./planning-system.md) for more on abstract preconditions.

## Generation Workflow

### Prerequisites

- Node.js 16+ installed
- Project dependencies installed (`npm install`)
- Actions must have corresponding rules named: `{modId}:handle_{actionName}`
- Rules must contain state-changing operations

### Generation Process

**Step 1: Developer runs generation command**
```bash
# Single action
npm run generate:effects -- --action=positioning:sit_down

# Entire mod
npm run generate:effects -- --mod=positioning

# All mods
npm run generate:effects
```

**Step 2: Generator loads action and finds associated rule**
```javascript
// Action: positioning:sit_down
// Rule: positioning:handle_sit_down
{
  "id": "positioning:handle_sit_down",
  "event": {"type": "ACTION_DECIDED"},
  "actions": [
    {"type": "REMOVE_COMPONENT", "entity": "actor", "component": "positioning:standing"},
    {"type": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting"}
  ]
}
```

**Step 3: Analyzer processes operations**
- Identifies state-changing operations (ADD/REMOVE/MODIFY_COMPONENT)
- Skips non-state operations (events, logging, queries)
- Traces conditional branches (IF/THEN/ELSE)
- Resolves placeholders where possible

**Step 4: Generator produces planning effects**
```javascript
{
  "planningEffects": {
    "effects": [
      {"operation": "REMOVE_COMPONENT", "entity": "actor", "component": "positioning:standing"},
      {"operation": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting"}
    ],
    "cost": 1.0
  }
}
```

**Step 5: Developer commits changes**
The generated effects are written to the action file and committed to the repository. At runtime, the planner reads these effects without regeneration.

### Validation

The generator validates effects during generation:

**Schema Validation**: Checks against `planning-effects.schema.json`
- Required fields present
- Correct types
- Valid operation types

**Semantic Validation**:
- Component IDs use `modId:componentId` format
- Entity values are `actor`, `target`, `tertiary_target`, or entity ID
- Abstract preconditions have `description`, `parameters`, `simulationFunction`
- Cost < 100

**Validation Commands:**
```bash
# Validate all mods
npm run validate:effects

# Validate specific mod
npm run validate:effects -- --mod=positioning

# Generate JSON report
npm run validate:effects -- --report=validation-report.json
```

### Workflows

**Adding a New Action:**
1. Create action file: `data/mods/{mod}/actions/{action_name}.action.json`
2. Create rule file: `data/mods/{mod}/rules/handle_{action_name}.rule.json`
3. Implement rule operations (state-changing operations)
4. Generate effects: `npm run generate:effects -- --action={mod}:{action_name}`
5. Verify action file has `planningEffects` field

**Updating Rule Operations:**
1. Modify operations in `data/mods/{mod}/rules/handle_{action}.rule.json`
2. Regenerate: `npm run generate:effects -- --action={mod}:{action}`
3. Validate: `npm run validate:effects -- --mod={mod}`
4. Review diff in action file to ensure effects match intent

**Bulk Generation:**
1. Implement/update multiple rules in a mod
2. Generate all: `npm run generate:effects -- --mod={mod}`
3. Validate: `npm run validate:effects -- --mod={mod}`
4. Review validation summary for warnings/errors
5. Fix any issues and regenerate

## Integration Status

### Current Implementation Status

**⚠️ Important: The EffectsGenerator is NOT currently integrated into the production workflow.**

**What exists:**
- ✅ EffectsGenerator and EffectsAnalyzer classes with full API
- ✅ Services registered in DI container (`goapTokens.IEffectsGenerator`)
- ✅ Schema validation (`planning-effects.schema.json`)
- ❌ No integration with mod loading
- ❌ No automatic generation of planning effects

**Current Workflow:**
1. **For production actions**: Manually add `planningEffects` property to action JSON files
2. **For tests**: Create mock action objects with `planningEffects` defined programmatically
3. **GOAP system**: Expects actions to already have `planningEffects` when they reach ActionSelector

### Programmatic Usage

Since EffectsGenerator is not integrated into the mod loading workflow, you would use it programmatically:

```javascript
import {goapTokens} from './dependencyInjection/tokens/tokens-goap.js';

// Resolve from DI container (in a script or test context)
const effectsGenerator = container.resolve(goapTokens.IEffectsGenerator);

// Generate effects for a single action
const effects = effectsGenerator.generateForAction('positioning:sit_down');

// Generate effects for an entire mod
const effectsMap = effectsGenerator.generateForMod('positioning');

// Optionally inject into in-memory action objects
effectsGenerator.injectEffects(effectsMap);
```

**Note**: This generates effects at runtime but does not persist them to files. For production use, you would need to either:
1. Integrate this into mod loading
2. Run as a preprocessing build step and save to JSON
3. Manually define `planningEffects` in action files

### Best Practices for Potential Integration

If you were to integrate EffectsGenerator into a production workflow:

**1. Generate at Build Time, Not Runtime**

For performance, consider generating effects as a preprocessing step:

```javascript
// Build script (not runtime)
async function generateEffectsForAllMods() {
  const mods = ['core', 'positioning', 'items'];

  for (const modId of mods) {
    const effectsMap = effectsGenerator.generateForMod(modId);

    // Write effects back to action files or to a separate cache file
    await saveEffectsToFiles(modId, effectsMap);
  }
}
```

**2. Validate Generated Effects**

Always validate before using:

```javascript
const effects = effectsGenerator.generateForAction(actionId);

if (effects) {
  const validation = effectsGenerator.validateEffects(actionId, effects);

  if (!validation.valid) {
    logger.error('Invalid effects generated', {
      actionId,
      errors: validation.errors
    });
    return null;
  }

  return effects;
}
```

**3. Handle Failures Gracefully**

```javascript
const effectsMap = effectsGenerator.generateForMod('positioning');

for (const [actionId, effects] of effectsMap.entries()) {
  try {
    processEffects(actionId, effects);
  } catch (error) {
    logger.error(`Failed to process ${actionId}`, error);
    // Continue with other actions
  }
}
```

## Performance Considerations

### Effects Generation (Development Time)
- Analysis happens once during development
- No runtime performance impact
- Generated effects cached in action definitions

### Action Planning (Runtime)
- O(n) action evaluation where n = available actions
- Plan caching significantly reduces repeated planning overhead
- Performance scales with:
  - Number of available actions
  - Number of relevant goals
  - World state complexity
  - Cache hit rate

### Optimization Strategies
- **Plan Reuse**: Cached plans are reused across turns when world state is stable
- **Selective Invalidation**: Only affected plans are cleared when state changes
- **Lazy Evaluation**: Plans are only generated when needed
- **Cache Isolation**: Each actor maintains independent cache to avoid interference

## Best Practices

### Rule Design

- Use descriptive operation parameters
- Follow established patterns from existing rules
- Keep rule complexity manageable (avoid deeply nested conditionals)
- Document non-obvious conditional logic

### Regeneration Discipline

**Always regenerate after:**
- Modifying rule operations
- Adding/removing operations from rules
- Changing conditional branches

**Workflow:**
```bash
# Edit rule
vim data/mods/positioning/rules/handle_sit_down.rule.json

# Regenerate immediately
npm run generate:effects -- --action=positioning:sit_down

# Validate
npm run validate:effects -- --mod=positioning
```

### Documentation

When creating actions with complex effects:
- Document abstract preconditions in rule comments
- Explain simulation strategy choices
- Note any edge cases in conditional effects

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

## Implementation References

### Key Source Files

- **Effects Analysis**: `src/goap/analysis/effectsAnalyzer.js` - Core analysis logic
- **Effects Generation**: `src/goap/generation/effectsGenerator.js` - Orchestration
- **Effects Validation**: `src/goap/validation/effectsValidator.js` - Schema and semantic validation
- **Runtime Resolution**: `src/utils/contextUtils.js` - Resolves placeholders during execution
- **Placeholder Resolver**: `src/utils/executionPlaceholderResolver.js` - Core placeholder resolution logic
- **Schema**: `data/schemas/planning-effects.schema.json` - Planning effects structure

### Test Coverage

The GOAP effects system's handling of analysis and generation is validated by tests in:

**Unit Tests** (`tests/unit/goap/`):
- Effects analyzer, generator, and validator
- Schema validation
- Coverage target: 90%+ branches, 95%+ lines

**Integration Tests** (`tests/integration/goap/`):
- Effects generation workflow
- Schema integration
- Validation pipeline

**E2E Tests** (`tests/e2e/goap/`):
- `CompleteGoapDecisionWithRealMods.e2e.test.js` - Full workflow with real mods
- `AbstractPreconditionConditionalEffects.e2e.test.js` - Conditional effects
- `PlanningEffectsMatchRuleExecution.e2e.test.js` - Verifies effects match execution
- `ActionSelectionWithEffectSimulation.e2e.test.js` - Effect simulation during planning

## Related Documentation

- [GOAP System Overview](./README.md) - Architecture and concepts
- [Operation Mapping](./operation-mapping.md) - Complete operation-to-effect mapping
- [Planning System](./planning-system.md) - Goals, action selection, and abstract preconditions
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
