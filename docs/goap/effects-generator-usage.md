# Effects Generator Usage Guide

## Overview

The EffectsGenerator is a core component of the GOAP (Goal-Oriented Action Planning) system that automatically generates planning effects for actions by analyzing their associated rules. This guide explains how to use the EffectsGenerator to generate, validate, and inject planning effects.

## Quick Start

### Basic Usage

```javascript
import { goapTokens } from './dependencyInjection/tokens/tokens-goap.js';

// Resolve from DI container
const effectsGenerator = container.resolve(goapTokens.IEffectsGenerator);

// Generate effects for a single action
const effects = effectsGenerator.generateForAction('positioning:sit_down');

// Generate effects for an entire mod
const effectsMap = effectsGenerator.generateForMod('positioning');
```

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

**Note:** Currently, injection updates the in-memory representation only. File writing is not implemented in this version.

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

## Integration with Mod Loading

The EffectsGenerator can be integrated into the mod loading pipeline to automatically generate effects during startup:

```javascript
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

## Best Practices

### 1. Generate During Mod Loading

Generate effects once during mod loading, not at runtime:

```javascript
// ✓ Good: Generate during initialization
async function loadMods(modIds) {
  for (const modId of modIds) {
    await loadModContent(modId);
    const effectsMap = effectsGenerator.generateForMod(modId);
    effectsGenerator.injectEffects(effectsMap);
  }
}

// ✗ Bad: Generate on every action execution
function executeAction(actionId) {
  const effects = effectsGenerator.generateForAction(actionId); // Too slow!
  // ...
}
```

### 2. Handle Generation Failures Gracefully

```javascript
const effectsMap = effectsGenerator.generateForMod('positioning');

for (const [actionId, effects] of effectsMap.entries()) {
  try {
    // Use effects
    processEffects(actionId, effects);
  } catch (error) {
    logger.error(`Failed to process effects for ${actionId}`, error);
    // Continue with other actions
  }
}
```

### 3. Validate Before Using

```javascript
const effects = effectsGenerator.generateForAction(actionId);

if (effects) {
  const validation = effectsGenerator.validateEffects(actionId, effects);

  if (validation.valid) {
    // Safe to use
    useEffects(effects);
  } else {
    logger.error('Invalid effects', validation.errors);
  }
}
```

### 4. Log Generation Statistics

```javascript
const startTime = Date.now();
const effectsMap = effectsGenerator.generateForMod('positioning');
const duration = Date.now() - startTime;

logger.info({
  mod: 'positioning',
  actionsProcessed: effectsMap.size,
  averageEffectsPerAction:
    Array.from(effectsMap.values())
      .reduce((sum, e) => sum + e.effects.length, 0) / effectsMap.size,
  duration: `${duration}ms`
});
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

## Related Documentation

- [GOAP System Overview](./README.md)
- [Effects Analyzer Architecture](./effects-analyzer-architecture.md)
- [Operation Mapping](./operation-mapping.md)
- [Planning Effects Schema](../../data/schemas/planning-effects.schema.json)

## Support

For issues or questions:
- Review test examples in `tests/unit/goap/generation/` and `tests/integration/goap/`
- Check GOAP documentation in `docs/goap/`
- Open a GitHub issue with the `goap` label
