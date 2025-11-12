# GOAP Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the GOAP effects auto-generation system. Issues are organized by symptom with detailed causes and solutions.

## Table of Contents

1. [Generation Issues](#generation-issues)
2. [Validation Issues](#validation-issues)
3. [Schema Issues](#schema-issues)
4. [Performance Issues](#performance-issues)
5. [Integration Issues](#integration-issues)
6. [Debugging Tips](#debugging-tips)

## Generation Issues

### No Effects Generated

**Symptom:**
- `generateForAction` returns `null`
- Action file has no `planningEffects` field
- Warning: "No rules found for action: modId:actionName"

**Possible Causes:**

1. **No Rule Found for Action**

   The effects generator looks for rules using these methods:
   - Rule ID matches pattern: `{modId}:handle_{actionName}`
   - Rule has condition referencing the action

   **Check:**
   ```bash
   # Verify rule exists
   ls data/mods/{modId}/rules/handle_{actionName}.rule.json

   # Or search for rules referencing the action
   grep -r "actionId.*{modId}:{actionName}" data/mods/{modId}/rules/
   ```

   **Solution:**
   ```json
   // Create rule with standard naming
   {
     "id": "{modId}:handle_{actionName}",
     "event": { "type": "ACTION_DECIDED" },
     "conditions": [
       {
         "$ref": "data/mods/{modId}/conditions/event-is-action-{actionName}.condition.json"
       }
     ],
     "actions": [...]
   }
   ```

2. **Rule Has Only Non-State Operations**

   The rule might contain only operations that don't generate effects:
   - `DISPATCH_EVENT`, `LOG`, `END_TURN`
   - Query operations: `QUERY_COMPONENT`, `HAS_COMPONENT`
   - Validation operations: `VALIDATE_INVENTORY_CAPACITY`

   **Check:**
   ```bash
   cat data/mods/{modId}/rules/handle_{actionName}.rule.json
   ```

   **Solution:**
   Add state-changing operations:
   ```json
   {
     "actions": [
       {"type": "ADD_COMPONENT", "entity": "actor", "component": "..."},
       {"type": "REMOVE_COMPONENT", "entity": "actor", "component": "..."}
     ]
   }
   ```

   See [operation-mapping.md](./operation-mapping.md) for state-changing operations.

3. **Rule Event Type Mismatch**

   Rule may not be triggered by `ACTION_DECIDED` event.

   **Solution:**
   ```json
   {
     "event": { "type": "ACTION_DECIDED" }
   }
   ```

---

### Wrong Effects Generated

**Symptom:**
- Effects don't match expected behavior
- Effects missing expected operations
- Effects include unexpected operations

**Possible Causes:**

1. **Conditional Branch Not Analyzed**

   If operations are in a conditional that's evaluated as false during analysis, they won't be included.

   **Check:**
   ```json
   {
     "type": "IF",
     "condition": {"var": "someCondition"},
     "then": [
       // Operations here may not be analyzed if someCondition is false
     ]
   }
   ```

   **Solution:**
   - Make condition resolvable at analysis time
   - Use abstract preconditions for runtime conditions
   - Ensure condition variables are set before IF operation

2. **Macro Not Resolved**

   Unresolved macros lead to parameterized effects.

   **Example:**
   ```json
   // Rule operation
   {
     "type": "ADD_COMPONENT",
     "component": {"var": "componentType"}
   }

   // Generated effect (if unresolved)
   {
     "operation": "ADD_COMPONENT",
     "component": "{componentType}"
   }
   ```

   **Solution:**
   - Set variable before using it
   - Add to action parameters if static
   - Check variable name for typos

3. **Operation Not Recognized as State-Changing**

   Custom or new operations may not be recognized as state-changing.

   **Check:**
   Look at `src/goap/analysis/effectsAnalyzer.js` in the `isWorldStateChanging()` method to see if your operation is listed.

   **Solution:**
   Add the operation type to the `stateChangingOperations` array in `effectsAnalyzer.js` at line 97. Then implement a corresponding `#convert<OperationName>` method (like `#convertAddComponent`) to handle the conversion to planning effects.

---

### Incorrect Cost Calculated

**Symptom:**
- Generated cost seems too high or too low
- Cost doesn't match action complexity

**Causes:**

Cost is calculated as:
```
cost = 1.0 + (effectCount * 0.1) + (conditionalCount * 0.2)
```

**Solution:**

1. **Accept Auto-Generated Cost** (Recommended)
   - Auto-generated costs are consistent
   - Based on objective complexity measure

2. **Manual Override**
   ```json
   {
     "planningEffects": {
       "effects": [...],
       "cost": 2.5,
       "_manual": true
     }
   }
   ```

---

## Validation Issues

### Effects Don't Match Rules

**Symptom:**
- Validation reports: "Effects don't match rule operations"
- Mismatch between generated effects and rule operations

**Possible Causes:**

1. **Stale Generated Effects**

   Effects were generated, then rule was modified.

   **Solution:**
   ```bash
   npm run generate:effects -- --action={modId}:{actionName}
   npm run validate:effects -- --action={modId}:{actionName}
   ```

2. **Manual Edit to Effects**

   Someone manually edited the `planningEffects` field.

   **Solution:**
   - Remove manual edits
   - Regenerate effects
   - Or add `_manual: true` flag to prevent regeneration

3. **Rule Operations Changed**

   Rule was updated but effects weren't regenerated.

   **Solution:**
   Always regenerate after rule changes:
   ```bash
   # After editing rule
   npm run generate:effects -- --action={modId}:{actionName}
   ```

---

### Missing Required Fields

**Symptom:**
- Validation error: "Missing required field 'X'"
- Schema validation fails

**Common Missing Fields:**

1. **Missing `operation` field:**
   ```json
   // ✗ Wrong
   {
     "entity": "actor",
     "component": "test:component"
   }

   // ✓ Correct
   {
     "operation": "ADD_COMPONENT",
     "entity": "actor",
     "component": "test:component"
   }
   ```

2. **Missing `entity` field:**
   ```json
   // ✗ Wrong
   {
     "operation": "ADD_COMPONENT",
     "component": "test:component"
   }

   // ✓ Correct
   {
     "operation": "ADD_COMPONENT",
     "entity": "actor",
     "component": "test:component"
   }
   ```

3. **Missing abstract precondition fields:**
   ```json
   // ✗ Wrong
   {
     "myPrecondition": {
       "description": "..."
     }
   }

   // ✓ Correct
   {
     "myPrecondition": {
       "description": "...",
       "parameters": ["actor"],
       "simulationFunction": "assumeTrue"
     }
   }
   ```

**Solution:**
Regenerate effects to ensure proper structure.

---

### Invalid Component Reference

**Symptom:**
- Validation error: "Invalid component reference: X"
- Component ID doesn't follow `modId:componentId` format

**Examples:**
```
✗ positioning_sitting
✗ sitting
✗ test.component

✓ positioning:sitting
✓ core:actor
✓ items:inventory_item
```

**Solution:**
Use proper format in rule operations:
```json
{
  "type": "ADD_COMPONENT",
  "component": "positioning:sitting"  // ✓ Correct format
}
```

---

## Schema Issues

### Schema Validation Fails

**Symptom:**
- Error: "Effects do not match schema"
- AJV validation errors

**Common Schema Issues:**

1. **Wrong Type:**
   ```json
   // ✗ Wrong - cost should be number
   {
     "cost": "1.5"
   }

   // ✓ Correct
   {
     "cost": 1.5
   }
   ```

2. **Extra Properties:**
   ```json
   // ✗ Wrong - unknownField not in schema
   {
     "operation": "ADD_COMPONENT",
     "entity": "actor",
     "component": "test:component",
     "unknownField": true
   }

   // ✓ Correct - only known fields
   {
     "operation": "ADD_COMPONENT",
     "entity": "actor",
     "component": "test:component"
   }
   ```

3. **Invalid Enum Value:**
   ```json
   // ✗ Wrong - invalid operation type
   {
     "operation": "INVALID_OP"
   }

   // ✓ Correct - valid operation
   {
     "operation": "ADD_COMPONENT"
   }
   ```

**Solution:**
Check schema at `data/schemas/planning-effects.schema.json` and ensure effects match.

---

### Action Schema Rejects Planning Effects

**Symptom:**
- Error: "Action schema validation failed"
- `planningEffects` field rejected

**Cause:**
Action schema doesn't include `planningEffects` definition.

**Solution:**
Ensure action schema includes:
```json
{
  "properties": {
    "planningEffects": {
      "$ref": "schema://living-narrative-engine/planning-effects.schema.json"
    }
  }
}
```

---

## Performance Issues

### Slow Generation

**Symptom:**
- Generation takes > 5 seconds for 200 actions
- Individual action takes > 100ms

**Possible Causes:**

1. **Complex Rule with Many Operations**

   Rules with hundreds of operations take longer to analyze.

   **Solution:**
   - Break into smaller rules
   - Optimize rule operations
   - Accept slightly longer generation time for complex rules

2. **Circular Macro References**

   Circular dependencies cause retry loops.

   **Check:**
   ```json
   // Circular reference
   {
     "type": "SET_VARIABLE",
     "name": "x",
     "value": {"var": "x"}
   }
   ```

   **Solution:**
   Break circular dependencies.

3. **Deep Conditional Nesting**

   Nested conditionals require exponential path tracing.

   **Solution:**
   - Flatten conditionals
   - Use early returns
   - Simplify condition logic

---

### High Memory Usage

**Symptom:**
- Memory usage grows during batch generation
- Out of memory errors

**Possible Causes:**

1. **No Garbage Collection Between Generations**

   Generated effects not released.

   **Solution:**
   ```javascript
   // In batch generation loop
   for (const actionId of actionIds) {
     const effects = generate(actionId);
     processEffects(effects);
     // Allow GC
     if (i % 100 === 0) {
       global.gc && global.gc();
     }
   }
   ```

2. **Caching Too Much Data**

   Resolution context caches growing unbounded.

   **Solution:**
   Clear caches between action generations.

---

## Integration Issues

### Mod Loading Fails

**Symptom:**
- Mod fails to load with GOAP errors
- Effects generation errors during startup

**Possible Causes:**

1. **Invalid Effects in Action File**

   Action file has malformed `planningEffects`.

   **Solution:**
   ```bash
   # Validate mod
   npm run validate:effects -- --mod={modId}

   # Regenerate if needed
   npm run generate:effects -- --mod={modId}
   ```

2. **Missing Dependencies**

   GOAP services not registered in DI container.

   **Solution:**
   Ensure GOAP registrations are loaded:
   ```javascript
   import { registerGoapServices } from './dependencyInjection/registrations/goapRegistrations.js';

   registerGoapServices(container);
   ```

---

### Effects Not Used by Planner

**Symptom:**
- Effects generated but planner doesn't use them
- Actions not selected despite satisfying goals

**Possible Causes:**

1. **Effects Not Loaded Into Action Definitions**

   Generated effects may not be injected into action objects at runtime.

   **Check:**
   Verify that actions returned by `getAvailableActions()` have the `planningEffects` property populated.

   **Solution:**
   Effects should be auto-loaded during mod loading. If testing in isolation, ensure you call:
   ```javascript
   const effectsMap = effectsGenerator.generateForMod(modId);
   effectsGenerator.injectEffects(effectsMap);
   ```

2. **Goal-Effect Mismatch**

   Effects don't satisfy any goals, so the planner can't find a path.

   **Solution:**
   - Verify that action effects produce components that goals require
   - Check goal relevance conditions are triggering for the actor's state
   - Verify goal state conditions match the components produced by action effects

---

## Debugging Tips

### Enable Debug Logging

Set your logger to debug level to see detailed analysis output:

```javascript
// Use a logger configured for debug level
const logger = container.resolve('ILogger');
// The EffectsAnalyzer will log detailed information at debug level
const analyzer = new EffectsAnalyzer({
  logger: logger,
  dataRegistry: dataRegistry
});
```

Note: The `EffectsAnalyzer` does not have a `verbose` option. Use logger debug level for detailed output.

### Inspect Generated Effects

```javascript
const effects = effectsGenerator.generateForAction('positioning:sit_down');
console.log(JSON.stringify(effects, null, 2));
```

### Trace Rule Execution

Add logging to rule operations:
```json
{
  "actions": [
    {"type": "LOG", "message": "Starting rule execution"},
    {"type": "ADD_COMPONENT", "entity": "actor", "component": "test:component"},
    {"type": "LOG", "message": "Added component"}
  ]
}
```

### Compare Generated vs. Expected

```javascript
const generated = effectsGenerator.generateForAction(actionId);
const expected = {
  effects: [
    {operation: 'ADD_COMPONENT', entity: 'actor', component: 'test:component'}
  ],
  cost: 1.1
};

console.log('Generated:', generated);
console.log('Expected:', expected);
console.log('Match:', JSON.stringify(generated) === JSON.stringify(expected));
```

### Validate Incrementally

```bash
# Generate and validate after each change
npm run generate:effects -- --action=test:action
npm run validate:effects -- --action=test:action
```

### Check if Operation is State-Changing

To verify if an operation is recognized as state-changing:

```javascript
// Check the EffectsAnalyzer source code
// Look at src/goap/analysis/effectsAnalyzer.js:97
// The isWorldStateChanging() method lists all recognized state-changing operations

// Or test directly:
import EffectsAnalyzer from './src/goap/analysis/effectsAnalyzer.js';
const analyzer = new EffectsAnalyzer({ logger, dataRegistry });
const isStateChanging = analyzer.isWorldStateChanging({ type: 'MY_OPERATION' });
console.log('State-changing:', isStateChanging);
```

### Test with Minimal Example

Create minimal test case:
```json
// Minimal action
{
  "id": "test:minimal",
  "name": "Minimal Test"
}

// Minimal rule
{
  "id": "test:handle_minimal",
  "event": {"type": "ACTION_DECIDED"},
  "actions": [
    {"type": "ADD_COMPONENT", "entity": "actor", "component": "test:component"}
  ]
}
```

Generate and validate:
```bash
npm run generate:effects -- --action=test:minimal
npm run validate:effects -- --action=test:minimal
```

### Use GOAP Test Bed

For testing GOAP-specific functionality, use the GOAP test helper:

```javascript
import { createGoapTestBed } from '../../common/goap/goapTestHelpers.js';

const testBed = await createGoapTestBed();
const effectsGenerator = testBed.container.resolve('IEffectsGenerator');

const effects = effectsGenerator.generateForAction('test:action');
console.log(effects);

// Don't forget cleanup
testBed.cleanup();
```

### Check Schema Validity

```bash
# Validate schemas
npm run validate

# Validate specific action
npx ajv validate -s data/schemas/action.schema.json -d data/mods/test/actions/test.action.json
```

## Getting Help

### Before Asking for Help

1. **Check This Guide**: Review relevant sections
2. **Check Documentation**: Read related docs in `docs/goap/`
3. **Check Tests**: Look at test examples in:
   - `tests/unit/goap/` - Unit tests for individual components
   - `tests/integration/goap/` - Integration tests for GOAP workflows
   - `tests/e2e/goap/` - End-to-end tests showing complete GOAP decision-making
4. **Create Minimal Reproduction**: Isolate the issue with minimal example

### When Reporting Issues

Include:

1. **Symptom**: What's wrong?
2. **Expected Behavior**: What should happen?
3. **Actual Behavior**: What actually happens?
4. **Reproduction**: Minimal code to reproduce
5. **Environment**: Node version, OS, etc.
6. **Logs**: Relevant error messages
7. **Context**: What were you trying to do?

### Example Issue Report

```markdown
**Symptom:** No effects generated for action

**Expected:** Effects should be generated from rule operations

**Actual:** generateForAction returns null

**Reproduction:**
1. Create action: data/mods/test/actions/test.action.json
2. Create rule: data/mods/test/rules/handle_test.rule.json
3. Run: npm run generate:effects -- --action=test:test
4. Result: null

**Environment:**
- Node: v18.12.0
- OS: Linux

**Logs:**
```
Warning: No rules found for action: test:test
```

**Context:**
Trying to generate effects for new test action
```

## Related Documentation

- [Effects Auto-Generation](./effects-auto-generation.md)
- [Operation Mapping](./operation-mapping.md)
- [Macro Resolution](./macro-resolution.md)
- [Abstract Preconditions](./abstract-preconditions.md)
- [GOAP README](./README.md)
