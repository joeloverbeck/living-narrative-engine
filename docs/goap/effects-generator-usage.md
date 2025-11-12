# Effects Generator Usage Guide

## ⚠️ Important: Current Status

**The EffectsGenerator is NOT currently used in production.** This document describes an available design pattern and API, not active functionality.

### Reality Check

- ✅ **What exists**: EffectsGenerator and EffectsAnalyzer classes with full API for generating planning effects from rules
- ✅ **What's registered**: Services are registered in the DI container (`goapTokens.IEffectsGenerator`)
- ❌ **What's missing**: No integration with mod loading or runtime workflow
- ❌ **What's missing**: No automatic generation of planning effects

### Current Workflow

1. **For production actions**: Manually add `planningEffects` property to action JSON files
2. **For tests**: Create mock action objects with `planningEffects` defined programmatically
3. **GOAP system**: Expects actions to already have `planningEffects` when they reach ActionSelector

## Overview

The EffectsGenerator can analyze rules and automatically generate planning effects for actions. This guide documents the EffectsGenerator API for potential future integration, manual usage scenarios, or as a reference for understanding the intended design.

## Quick Start

### Basic Usage (Programmatic)

Since EffectsGenerator is not integrated into the mod loading workflow, you would use it programmatically:

```javascript
import { goapTokens } from './dependencyInjection/tokens/tokens-goap.js';

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

## Generating Effects for a Single Action

### Method: `generateForAction(actionId)`

Generates planning effects for a specific action by analyzing its associated rule(s).

**Parameters:**
- `actionId` (string): Full action ID in format `modId:actionName`

**Returns:**
- Planning effects object or `null` if no rules found

**Example:**

```javascript
const effects = effectsGenerator.generateForAction('positioning:sit_down');

if (effects) {
  console.log(`Generated ${effects.effects.length} effects`);
  console.log(`Action cost: ${effects.cost}`);

  if (effects.abstractPreconditions) {
    console.log('Abstract preconditions:',
      Object.keys(effects.abstractPreconditions));
  }
}
```

**Generated Effects Structure:**

```javascript
{
  effects: [
    {
      operation: 'REMOVE_COMPONENT',
      entity: 'actor',
      component: 'positioning:standing'
    },
    {
      operation: 'ADD_COMPONENT',
      entity: 'actor',
      component: 'positioning:sitting',
      data: {}
    }
  ],
  cost: 1.2
}
```

## Generating Effects for an Entire Mod

### Method: `generateForMod(modId)`

Generates planning effects for all actions in a specific mod.

**Parameters:**
- `modId` (string): Mod identifier (e.g., 'positioning', 'items')

**Returns:**
- Map of actionId → effects

**Example:**

```javascript
const effectsMap = effectsGenerator.generateForMod('positioning');

console.log(`Generated effects for ${effectsMap.size} actions`);

// Iterate over generated effects
for (const [actionId, effects] of effectsMap.entries()) {
  console.log(`${actionId}: ${effects.effects.length} effects`);
}
```

**Summary Logging:**

The generator automatically logs a summary:
```
Generating effects for mod: positioning
✓ positioning:sit_down - 2 effects
✓ positioning:stand_up - 1 effects
⊘ positioning:wave - No state-changing effects
✗ positioning:invalid - Failed to generate effects
Effects generation complete for positioning: 2 success, 1 skipped, 1 failed
```

## Validating Generated Effects

### Method: `validateEffects(actionId, effects)`

Validates generated effects against the planning-effects schema and semantic rules.

**Parameters:**
- `actionId` (string): Full action ID
- `effects` (object): Generated effects to validate

**Returns:**
- Validation result object

**Example:**

```javascript
const effects = {
  effects: [
    {
      operation: 'ADD_COMPONENT',
      entity: 'actor',
      component: 'positioning:sitting'
    }
  ],
  cost: 1.0
};

const validation = effectsGenerator.validateEffects('test:action', effects);

if (validation.valid) {
  console.log('Effects are valid');
} else {
  console.error('Validation errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.warn('Validation warnings:', validation.warnings);
}
```

**Validation Result Structure:**

```javascript
{
  valid: true,           // Overall validation status
  warnings: [            // Non-critical issues
    {
      type: 'empty',
      message: 'No effects generated'
    }
  ],
  errors: [              // Critical issues that fail validation
    {
      type: 'schema',
      message: 'Effects do not match schema',
      details: [...]
    },
    {
      type: 'invalid_component',
      message: 'Invalid component reference: invalid_component',
      effect: {...}
    }
  ]
}
```

### Validation Checks

The validator performs the following checks:

1. **Schema Validation**: Ensures effects match `planning-effects.schema.json`
2. **Component References**: Validates `modId:componentId` format
3. **Abstract Preconditions**: Validates precondition structure
4. **Empty Effects**: Warns if no effects generated

## Injecting Effects into Actions

### Method: `injectEffects(effectsMap)`

Injects generated planning effects into action definitions in the data registry.

**Parameters:**
- `effectsMap` (Map): Map of actionId → effects

**Returns:**
- Number of actions updated

**Example:**

```javascript
// Generate effects for mod
const effectsMap = effectsGenerator.generateForMod('positioning');

// Inject into action definitions
const count = effectsGenerator.injectEffects(effectsMap);

console.log(`Injected effects into ${count} actions`);

// Actions now have planningEffects property
const action = dataRegistry.get('actions', 'positioning:sit_down');
console.log(action.planningEffects);
```

**Note**: This method updates the in-memory action object only. It does not write changes back to action JSON files. Since this generator is not integrated into the production workflow, this method's practical use is limited to testing or one-off script scenarios.

## Working with Abstract Preconditions

Abstract preconditions represent runtime conditions that can't be evaluated during analysis.

**Example with Preconditions:**

```javascript
const effects = effectsGenerator.generateForAction('items:give_item');

// Effects with conditional based on abstract precondition
{
  effects: [
    {
      operation: 'CONDITIONAL',
      condition: {
        abstractPrecondition: 'targetHasInventorySpace',
        params: ['target']
      },
      then: [
        {
          operation: 'REMOVE_COMPONENT',
          entity: 'actor',
          component: 'items:in_inventory',
          componentId: '{itemId}'
        },
        {
          operation: 'ADD_COMPONENT',
          entity: 'target',
          component: 'items:in_inventory',
          componentId: '{itemId}'
        }
      ]
    }
  ],
  abstractPreconditions: {
    targetHasInventorySpace: {
      description: 'Checks if target has inventory space',
      parameters: ['target'],
      simulationFunction: 'assumeTrue'
    }
  },
  cost: 1.0
}
```

**Simulation Functions:**

- `assumeTrue`: Optimistic - assume condition is true
- `assumeFalse`: Pessimistic - assume condition is false
- `assumeRandom`: Probabilistic - random outcome
- `evaluateAtRuntime`: Defer evaluation to runtime

## Error Handling

### Common Errors

**1. Action Not Found**

```javascript
try {
  const effects = effectsGenerator.generateForAction('nonexistent:action');
} catch (error) {
  console.error(error.message); // "Action not found: nonexistent:action"
}
```

**2. No Rules Found**

```javascript
const effects = effectsGenerator.generateForAction('orphan:action');
// Returns null
// Logs warning: "No rules found for action: orphan:action"
```

**3. Rule Analysis Failure**

```javascript
try {
  const effects = effectsGenerator.generateForAction('broken:action');
} catch (error) {
  console.error(error.message); // "Failed to generate effects for action..."
}
```

**4. Validation Failure**

```javascript
try {
  const effects = effectsGenerator.generateForAction('invalid:action');
} catch (error) {
  console.error(error.message); // "Invalid planning effects for invalid:action"
}
```

## Current Integration Status

**Not Integrated**: The EffectsGenerator is **not** called during mod loading or anywhere in the production codebase. It exists as a standalone service registered in the DI container but is not used.

### Actual Current Workflow

In the current system:
1. **Planning effects are manually defined** in action JSON files using the `planningEffects` property (which is allowed by `additionalProperties: true` in the action schema)
2. **For testing**, mock actions with `planningEffects` are created programmatically
3. The GOAP system expects actions to already have `planningEffects` when they reach the ActionSelector

### Hypothetical Integration Example

If the EffectsGenerator were to be integrated into mod loading, it might look like this:

```javascript
// HYPOTHETICAL - NOT CURRENTLY IMPLEMENTED
// In mod loader
const mods = ['core', 'positioning', 'items'];

for (const modId of mods) {
  try {
    // Generate effects for mod
    const effectsMap = effectsGenerator.generateForMod(modId);

    // Inject into actions
    const count = effectsGenerator.injectEffects(effectsMap);

    logger.info(`Processed ${modId}: ${count} actions with effects`);
  } catch (error) {
    logger.error(`Failed to generate effects for ${modId}`, error);
  }
}
```

**Note**: This integration does not exist. The above code is illustrative only.

## Troubleshooting

### No Effects Generated for Action

**Symptoms:**
- `generateForAction` returns `null`
- Warning: "No rules found for action: modId:actionName"

**Possible Causes:**

1. **Rule not found**: Check rule naming convention
   - Expected: `modId:handle_actionName`
   - Example: `positioning:handle_sit_down`

2. **Rule doesn't reference action**: Check rule event conditions
   - Rule event should be `ACTION_DECIDED`
   - Rule conditions should include `event-is-action` with matching actionId

**Solution:**

```javascript
// Option 1: Use standard naming convention
const rule = {
  id: 'positioning:handle_sit_down',
  event: { type: 'ACTION_DECIDED' },
  actions: [...]
};

// Option 2: Reference action in conditions
const rule = {
  id: 'positioning:custom_rule_name',
  event: { type: 'ACTION_DECIDED' },
  conditions: [
    { type: 'event-is-action', actionId: 'positioning:sit_down' }
  ],
  actions: [...]
};
```

### Validation Errors

**Invalid Component Reference:**

```
Error: Invalid component reference: positioning_sitting
```

**Solution:** Use colon separator in component IDs
```javascript
// ✗ Wrong
component: 'positioning_sitting'

// ✓ Correct
component: 'positioning:sitting'
```

**Invalid Abstract Precondition:**

```
Error: Invalid abstract precondition: targetHasSpace
```

**Solution:** Ensure all required fields are present
```javascript
// ✗ Wrong
abstractPreconditions: {
  targetHasSpace: {
    description: 'Checks space'
  }
}

// ✓ Correct
abstractPreconditions: {
  targetHasSpace: {
    description: 'Checks if target has space',
    parameters: ['target'],
    simulationFunction: 'assumeTrue'
  }
}
```

### Multiple Rules per Action

When an action has multiple rules, effects are merged:

```javascript
// Rule 1: positioning:handle_sit_down
{
  effects: [
    { operation: 'REMOVE_COMPONENT', entity: 'actor', component: 'positioning:standing' }
  ]
}

// Rule 2: positioning:handle_sit_down_alt (references same action)
{
  effects: [
    { operation: 'ADD_COMPONENT', entity: 'actor', component: 'positioning:sitting' }
  ]
}

// Merged result
{
  effects: [
    { operation: 'REMOVE_COMPONENT', entity: 'actor', component: 'positioning:standing' },
    { operation: 'ADD_COMPONENT', entity: 'actor', component: 'positioning:sitting' }
  ]
}
```

## Best Practices for Potential Integration

If you were to integrate EffectsGenerator into a production workflow:

### 1. Generate at Build Time, Not Runtime

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

### 2. Validate Generated Effects

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

### 3. Handle Failures Gracefully

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

## API Reference

### EffectsGenerator Class

#### Constructor

```javascript
new EffectsGenerator({ logger, effectsAnalyzer, dataRegistry, schemaValidator })
```

#### Methods

- `generateForAction(actionId: string): object | null`
- `generateForMod(modId: string): Map<string, object>`
- `validateEffects(actionId: string, effects: object): object`
- `injectEffects(effectsMap: Map<string, object>): number`

### Dependencies

- **ILogger**: Logging service
- **IEffectsAnalyzer**: Rule analysis service
- **IDataRegistry**: Data access service
- **IAjvSchemaValidator**: Schema validation service

## How Planning Effects Actually Work in the Codebase

### E2E Test Behavior

The e2e tests in `tests/e2e/goap/` verify the GOAP system by:

1. **Creating mock actions** with manually-defined `planningEffects` properties
2. **Passing these actions** to the GOAP decision system
3. **Verifying** that the ActionSelector uses the planning effects for simulation
4. **Comparing** simulated effects against actual rule execution outcomes

Example from `AbstractPreconditionConditionalEffects.e2e.test.js`:
```javascript
const conditionalAction = {
  id: 'test:conditional_action',
  actionId: 'test:conditional_action',
  planningEffects: {
    effects: [/* manually defined effects */],
    abstractPreconditions: {/* manually defined preconditions */}
  }
};
```

### Production Workflow Gap

**Key Finding**: There is currently no automatic generation of planning effects from rules in the production workflow. The EffectsGenerator exists but is unused.

For planning effects to work in production:
- **Option 1**: Manually add `planningEffects` to action JSON files
- **Option 2**: Integrate EffectsGenerator into mod loading (requires implementation)
- **Option 3**: Generate effects via a build/preprocessing step

## Architecture Context

### Components Involved

- **EffectsAnalyzer** (`src/goap/analysis/effectsAnalyzer.js`): Analyzes individual rule operations and extracts state-changing effects
- **EffectsGenerator** (`src/goap/generation/effectsGenerator.js`): Orchestrates effect generation across actions and mods
- **EffectsValidator** (`src/goap/validation/effectsValidator.js`): Validates generated or manually-defined effects
- **ActionSelector** (`src/goap/selection/actionSelector.js`): **Actually uses** planning effects during GOAP decision-making

### Data Flow (If Integrated)

```
Rule Definitions
      ↓
EffectsAnalyzer.analyzeRule()
      ↓
EffectsGenerator.generateForAction()
      ↓
EffectsValidator.validateEffects()
      ↓
Action.planningEffects (in-memory)
      ↓
ActionSelector.simulateEffects()
```

**Current Reality**: The system jumps directly from manually-defined `Action.planningEffects` to `ActionSelector.simulateEffects()`.

## Related Documentation

- [GOAP System Overview](./README.md)
- [Effects Analyzer Architecture](./effects-analyzer-architecture.md)
- [Operation Mapping](./operation-mapping.md)
- [Planning Effects Schema](../../data/schemas/planning-effects.schema.json)

## Support

For issues or questions:
- Review e2e test examples in `tests/e2e/goap/` to see how planning effects are actually used
- Check unit tests in `tests/unit/goap/` for EffectsGenerator and EffectsAnalyzer usage patterns
- Check GOAP documentation in `docs/goap/`
- Open a GitHub issue with the `goap` label
