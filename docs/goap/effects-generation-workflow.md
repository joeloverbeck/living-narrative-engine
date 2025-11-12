# Effects Generation Workflow

## Overview

The effects generation system analyzes action rules to automatically generate planning metadata for GOAP. This ensures consistency between rule execution and planning simulation by extracting effects directly from rule operations.

**Implementation Status:**
- ✅ EffectsAnalyzer: Analyzes rule operations and extracts state changes
- ✅ EffectsGenerator: Generates planning effects from analyzed operations
- ✅ EffectsValidator: Validates consistency between effects and rules
- ✅ CLI scripts: `npm run generate:effects` and `npm run validate:effects`
- ⚠️  Action files: Currently do not have `planningEffects` defined (must be generated)

## Prerequisites

- Node.js 16+ installed
- Project dependencies installed (`npm install`)
- Actions must have corresponding rules named: `{modId}:handle_{actionName}`
- Rules must contain state-changing operations (see [Operation Mapping](./operation-mapping.md))

## How It Works

### 1. Rule Analysis

The EffectsAnalyzer (`src/goap/analysis/effectsAnalyzer.js`) examines rule operations:

**State-Changing Operations Analyzed:**
- Component operations: `ADD_COMPONENT`, `REMOVE_COMPONENT`, `MODIFY_COMPONENT`, `ATOMIC_MODIFY_COMPONENT`
- Movement: `LOCK_MOVEMENT`, `UNLOCK_MOVEMENT`, `SYSTEM_MOVE_ENTITY`
- Closeness: `ESTABLISH_SITTING_CLOSENESS`, `REMOVE_SITTING_CLOSENESS`, etc.
- Items: `TRANSFER_ITEM`, `DROP_ITEM_AT_LOCATION`, `PICK_UP_ITEM_FROM_LOCATION`
- Containers: `OPEN_CONTAINER`, `TAKE_FROM_CONTAINER`, `PUT_IN_CONTAINER`
- Others: See full list in `src/goap/analysis/effectsAnalyzer.js:97-150`

**Analysis Process:**
1. Load rule from data registry
2. Trace execution paths (handle IF/IF_CO_LOCATED conditionals)
3. Identify state-changing operations in each path
4. Convert operations to planning effects
5. Generate abstract preconditions for runtime-dependent conditions

### 2. Effect Generation

Example rule to effect conversion:

```javascript
// Rule: positioning:handle_sit_down
{
  "actions": [
    { "type": "REMOVE_COMPONENT", "parameters": { "entity": "actor", "component": "positioning:standing" } },
    { "type": "ADD_COMPONENT", "parameters": { "entity": "actor", "component": "positioning:sitting", "data": {} } }
  ]
}

// Generated Planning Effects
{
  "planningEffects": {
    "effects": [
      { "operation": "REMOVE_COMPONENT", "entity": "actor", "component": "positioning:standing" },
      { "operation": "ADD_COMPONENT", "entity": "actor", "component": "positioning:sitting", "data": {} }
    ],
    "cost": 1.2
  }
}
```

### 3. Conditional Effects

When rules contain IF/IF_CO_LOCATED operations, the analyzer generates conditional effects:

```javascript
// Generated for conditional branches
{
  "operation": "CONDITIONAL",
  "condition": { /* JSON Logic condition */ },
  "then": [ /* effects for then branch */ ],
  "else": [ /* effects for else branch */ ]
}
```

## Commands

### Generate Effects

```bash
# Generate for all mods
npm run generate:effects

# Generate for specific mod
npm run generate:effects -- --mod=positioning

# Generate for single action
npm run generate:effects -- --action=positioning:sit_down
```

**Process:**
1. Loads schemas and mod data
2. Finds rule(s) for action using naming convention: `{modId}:handle_{actionName}`
3. Analyzes rule operations via EffectsAnalyzer
4. Validates generated effects against `planning-effects.schema.json`
5. Writes effects to action file's `planningEffects` field

### Validate Effects

```bash
# Validate all mods
npm run validate:effects

# Validate specific mod
npm run validate:effects -- --mod=positioning

# Generate JSON report
npm run validate:effects -- --report=validation-report.json
```

**Validation Checks:**
1. Schema compliance
2. Component reference format (`{modId}:{componentId}`)
3. Abstract precondition structure
4. Effect count > 0

## Workflows

### Adding a New Action

1. Create action file: `data/mods/{mod}/actions/{action_name}.action.json`
2. Create rule file: `data/mods/{mod}/rules/handle_{action_name}.rule.json`
3. Implement rule operations (state-changing operations)
4. Generate effects: `npm run generate:effects -- --action={mod}:{action_name}`
5. Verify action file has `planningEffects` field

### Updating Rule Operations

1. Modify operations in `data/mods/{mod}/rules/handle_{action}.rule.json`
2. Regenerate: `npm run generate:effects -- --action={mod}:{action}`
3. Validate: `npm run validate:effects -- --mod={mod}`
4. Review diff in action file to ensure effects match intent

### Bulk Generation

1. Implement/update multiple rules in a mod
2. Generate all: `npm run generate:effects -- --mod={mod}`
3. Validate: `npm run validate:effects -- --mod={mod}`
4. Review validation summary for warnings/errors
5. Fix any issues and regenerate

## Troubleshooting

### No Effects Generated

**Symptoms:**
- Generation succeeds but action file unchanged
- Log shows "No state-changing effects"

**Causes & Solutions:**
- **Rule not found**: Verify rule name matches `{modId}:handle_{actionName}` convention
- **No state-changing operations**: Ensure rule contains operations from the state-changing list
- **Only non-state operations**: Rules with only DISPATCH_EVENT, QUERY_*, etc. produce no effects

### Validation Errors

**"Missing effect" error:**
- Rule operations changed after effects were generated
- Solution: Regenerate effects for that action

**"No planning effects defined" warning:**
- Action has no associated rule or rule produces no effects
- Expected for query-only actions (no state changes)

**Schema validation failure:**
- Generated effects don't match schema structure
- Check operation parameters match expected format
- Verify component IDs use `{modId}:{componentId}` format

## Schema Structure

Effects must conform to `data/schemas/planning-effects.schema.json`:

```json
{
  "effects": [
    {
      "operation": "ADD_COMPONENT",
      "entity": "actor",           // "actor" | "target" | "tertiary_target"
      "component": "mod:component", // Must match pattern: ^[a-z0-9_]+:[a-z0-9_]+$
      "data": {}                    // Optional
    },
    {
      "operation": "REMOVE_COMPONENT",
      "entity": "actor",
      "component": "mod:component"
    },
    {
      "operation": "MODIFY_COMPONENT",
      "entity": "actor",
      "component": "mod:component",
      "updates": {}                 // Required
    },
    {
      "operation": "CONDITIONAL",
      "condition": {},               // JSON Logic condition
      "then": [],                    // Array of effects
      "else": []                     // Optional
    }
  ],
  "cost": 1.0,                       // Optional, defaults to 1.0
  "abstractPreconditions": {         // Optional
    "hasComponent": {
      "description": "Checks if entity has component",
      "parameters": ["entityId", "componentId"],
      "simulationFunction": "evaluateAtRuntime"  // "assumeTrue" | "assumeFalse" | "evaluateAtRuntime"
    }
  }
}
```

## Implementation Details

### EffectsAnalyzer

**Location:** `src/goap/analysis/effectsAnalyzer.js`

**Key Methods:**
- `analyzeRule(ruleId)`: Main entry point, returns `{ effects, cost, abstractPreconditions }`
- `isWorldStateChanging(operation)`: Determines if operation modifies world state
- `operationToEffect(operation)`: Converts rule operation to planning effect

**Process Flow:**
1. `#analyzeDataFlow(operations)`: Tracks context variables produced by operations
2. `#traceExecutionPaths(operations, dataFlow)`: Follows conditional branches
3. `#extractEffectsFromPaths(paths)`: Converts operations to effects per path
4. `#generateAbstractPreconditions(dataFlow)`: Creates preconditions for runtime checks
5. `#calculateCost(rule, effects)`: Determines planning cost (default 1.2)

### EffectsGenerator

**Location:** `src/goap/generation/effectsGenerator.js`

**Key Methods:**
- `generateForAction(actionId)`: Generates effects for single action
- `generateForMod(modId)`: Generates for all actions in mod
- `validateEffects(actionId, effects)`: Validates generated effects
- `injectEffects(effectsMap)`: Updates in-memory action definitions (file writing handled by script)

**Dependencies:**
- IEffectsAnalyzer: Analyzes rules
- IDataRegistry: Accesses actions and rules
- IAjvSchemaValidator: Validates against schema

### EffectsValidator

**Location:** `src/goap/validation/effectsValidator.js`

**Key Methods:**
- `validateAction(actionId)`: Validates single action
- `validateMod(modId)`: Validates all actions in mod
- `validateAllMods()`: Full validation across all mods

**Returns:** `{ actionId, valid, warnings, errors }`

## Best Practices

### 1. Rule Design

- Use descriptive operation parameters
- Follow established patterns from existing rules
- Keep rule complexity manageable (avoid deeply nested conditionals)
- Document non-obvious conditional logic

### 2. Regeneration Discipline

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

### 3. Validation Integration

Add to CI/CD:
```yaml
- name: Validate GOAP Effects
  run: |
    npm run validate:effects -- --report=effects-validation.json
    if [ $(jq '.summary.errors' effects-validation.json) -gt 0 ]; then
      exit 1
    fi
```

### 4. Review Generated Effects

- Verify effects match intended behavior
- Check entity references (actor/target/tertiary_target)
- Ensure component IDs are correctly namespaced
- Validate cost is reasonable (typically 1.0-2.0 for simple actions)

### 5. Documentation

When creating actions with complex effects:
- Document abstract preconditions in rule comments
- Explain simulation strategy choices
- Note any edge cases in conditional effects

## Testing

### Integration Tests

**Location:** `tests/integration/goap/effectsGeneration.integration.test.js`

Tests verify:
- Rule operations convert to correct effects
- Conditional branches generate CONDITIONAL effects
- Schema validation passes

### E2E Tests

**Location:** `tests/e2e/goap/PlanningEffectsMatchRuleExecution.e2e.test.js`

Tests prove:
- Planning effects accurately predict actual execution
- ADD_COMPONENT, REMOVE_COMPONENT, MODIFY_COMPONENT effects work
- Conditional effects evaluate correctly during simulation
- No unexpected state changes occur beyond declared effects

## Related Documentation

- [GOAP System Overview](./README.md) - Architecture and concepts
- [Effects Analyzer Architecture](./effects-analyzer-architecture.md) - Technical deep dive
- [Operation Mapping](./operation-mapping.md) - Complete operation → effect mapping
- [Abstract Preconditions](./abstract-preconditions.md) - Runtime condition handling
