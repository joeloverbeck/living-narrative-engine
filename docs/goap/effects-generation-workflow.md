# Effects Generation Workflow Guide

## Overview

This guide provides step-by-step instructions for generating and validating planning effects for GOAP actions. The effects generation workflow automates the creation of planning metadata from action rules, ensuring consistency and reducing manual errors.

## Prerequisites

- Node.js 16+ installed
- Project dependencies installed (`npm install`)
- Basic understanding of GOAP concepts (see [GOAP README](./README.md))
- Familiarity with the project's mod system

## Quick Start

### Generate Effects for All Mods

```bash
npm run generate:effects
```

This generates planning effects for all actions across all mods and writes them to action files.

### Generate Effects for a Specific Mod

```bash
npm run generate:effects -- --mod=positioning
```

### Generate Effects for a Single Action

```bash
npm run generate:effects -- --action=positioning:sit_down
```

### Validate Generated Effects

```bash
npm run validate:effects
```

### Validate Effects for a Specific Mod

```bash
npm run validate:effects -- --mod=positioning
```

### Generate Validation Report

```bash
npm run validate:effects -- --report=effects-validation.json
```

## Detailed Workflow

### Step 1: Understanding the Generation Process

The effects generator analyzes action rules to automatically extract planning effects. For each action:

1. **Finds Associated Rules**: Looks for rules named `{modId}:handle_{actionName}`
2. **Analyzes Operations**: Examines rule operations to identify state changes
3. **Generates Effects**: Creates planning effects that describe how the action changes world state
4. **Validates Effects**: Ensures generated effects match the planning-effects schema
5. **Writes to File**: Updates action files with the `planningEffects` field

### Step 2: Generating Effects

#### For a Single Action

Use this for testing or when working on a specific action:

```bash
npm run generate:effects -- --action=positioning:sit_down
```

**Output:**
```
📚 Loading schemas...
✅ Schemas loaded
📦 Loading mod data...
✅ Mod data loaded
Generating effects for action: positioning:sit_down
Generated 2 effects
{
  "effects": [
    {
      "operation": "REMOVE_COMPONENT",
      "entity": "actor",
      "component": "positioning:standing"
    },
    {
      "operation": "ADD_COMPONENT",
      "entity": "actor",
      "component": "positioning:sitting",
      "data": {}
    }
  ],
  "cost": 1.2
}
✓ Updated data/mods/positioning/actions/sit_down.action.json
✓ Effects generation complete
```

#### For a Mod

Use this when you've made changes to multiple actions in a mod:

```bash
npm run generate:effects -- --mod=positioning
```

**Output:**
```
📚 Loading schemas...
✅ Schemas loaded
📦 Loading mod data...
✅ Mod data loaded
Generating effects for mod: positioning
Effects generation complete for positioning: 12 success, 3 skipped, 0 failed
Generated effects for 12 actions
✓ Effects generation complete
```

#### For All Mods

Use this when doing a bulk regeneration:

```bash
npm run generate:effects
```

**Output:**
```
📚 Loading schemas...
✅ Schemas loaded
📦 Loading mod data...
✅ Mod data loaded
Generating effects for all mods...
Generated effects for 156 actions across 8 mods
✓ Effects generation complete
```

### Step 3: Reviewing Generated Effects

After generation, check the updated action files:

```bash
cat data/mods/positioning/actions/sit_down.action.json
```

**Example Output:**
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:sit_down",
  "name": "Sit down",
  "description": "Sit down on available furniture",
  "targets": "positioning:available_furniture",
  "planningEffects": {
    "effects": [
      {
        "operation": "REMOVE_COMPONENT",
        "entity": "actor",
        "component": "positioning:standing"
      },
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "positioning:sitting",
        "data": {}
      }
    ],
    "cost": 1.2
  }
}
```

### Step 4: Validating Effects

Always validate after generation to ensure consistency:

```bash
npm run validate:effects
```

**Output:**
```
📚 Loading schemas...
✅ Schemas loaded
📦 Loading mod data...
✅ Mod data loaded

=== Validation Results ===

✓ positioning:sit_down - effects match rule operations
✓ positioning:stand_up - effects match rule operations
⚠ positioning:wave - 1 warnings
  - No planning effects defined
✗ positioning:invalid_action - 1 errors
  - Missing effect: {"operation":"ADD_COMPONENT","entity":"actor","component":"positioning:waving"}

=== Summary ===
Valid: 150
Warnings: 5
Errors: 1
Total: 156
```

### Step 5: Fixing Validation Errors

When validation reports errors, review and fix them:

#### Error: Missing Effect

**Problem**: The generated effects don't match what the rule operations produce.

**Solution:**
1. Check the rule operations in `data/mods/{mod}/rules/handle_{action}.rule.json`
2. Verify the operations correctly implement the intended behavior
3. Regenerate effects: `npm run generate:effects -- --action={modId}:{actionName}`
4. Validate again

#### Warning: No Planning Effects Defined

**Problem**: Action has no planning effects, likely because it has no associated rule.

**Solution:**
1. If the action should have effects, create a rule for it
2. If the action is intentionally effect-free (e.g., query actions), this is expected

#### Warning: Unexpected Effect

**Problem**: The action has effects that don't match the rule operations.

**Solution:**
1. Check if the `planningEffects` were manually edited
2. Regenerate effects to sync with rule operations
3. If manual effects are intentional, this warning can be ignored

### Step 6: Generating Validation Reports

For detailed analysis, generate a JSON report:

```bash
npm run validate:effects -- --report=validation-report.json
```

**Report Structure:**
```json
{
  "actions": [
    {
      "actionId": "positioning:sit_down",
      "valid": true,
      "warnings": [],
      "errors": []
    },
    {
      "actionId": "positioning:invalid_action",
      "valid": false,
      "warnings": [],
      "errors": [
        {
          "message": "Missing effect: {\"operation\":\"ADD_COMPONENT\",...}"
        }
      ]
    }
  ],
  "summary": {
    "total": 156,
    "valid": 150,
    "warnings": 5,
    "errors": 1
  }
}
```

## Common Scenarios

### Scenario 1: Adding a New Action

1. Create action file: `data/mods/{mod}/actions/{action_name}.action.json`
2. Create rule file: `data/mods/{mod}/rules/handle_{action_name}.rule.json`
3. Generate effects: `npm run generate:effects -- --action={mod}:{action_name}`
4. Validate: `npm run validate:effects -- --mod={mod}`

### Scenario 2: Updating Action Rules

1. Modify rule operations in `data/mods/{mod}/rules/handle_{action}.rule.json`
2. Regenerate effects: `npm run generate:effects -- --action={mod}:{action}`
3. Validate: `npm run validate:effects -- --action={mod}:{action}`
4. Review changes in action file

### Scenario 3: Bulk Mod Update

1. Make changes to multiple actions/rules in a mod
2. Regenerate all effects: `npm run generate:effects -- --mod={mod}`
3. Validate: `npm run validate:effects -- --mod={mod}`
4. Review validation report
5. Fix any errors
6. Validate again

### Scenario 4: CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Validate Effects
  run: |
    npm run generate:effects
    npm run validate:effects -- --report=effects-validation.json
    # Fail if errors > 0
    if [ $(jq '.summary.errors' effects-validation.json) -gt 0 ]; then
      echo "Effects validation failed"
      exit 1
    fi
```

## Troubleshooting

### Generation Fails

**Problem**: `npm run generate:effects` fails with error

**Possible Causes:**
1. Missing or invalid rule file
2. Invalid rule operations
3. Schema validation failure

**Solutions:**
1. Check rule file exists and has correct naming convention
2. Validate rule JSON structure
3. Run schema validation: `npm run validate`

### No Effects Generated

**Problem**: Generation succeeds but no effects in action file

**Possible Causes:**
1. Rule not found (naming mismatch)
2. Rule has no state-changing operations
3. All operations are excluded (e.g., only DISPATCH_EVENT)

**Solutions:**
1. Verify rule name matches convention: `{modId}:handle_{actionName}`
2. Check rule operations include state-changing operations
3. Review [operation mapping](./operation-mapping.md) for state-changing operations

### Validation Always Fails

**Problem**: Validation reports errors even after regeneration

**Possible Causes:**
1. Manual edits to action file after generation
2. Rule operations changed after generation
3. Bug in effects analyzer

**Solutions:**
1. Backup action file, delete `planningEffects`, regenerate
2. Ensure rule operations are correct
3. Report issue with minimal reproduction case

## Best Practices

### 1. Always Regenerate After Rule Changes

Whenever you modify rule operations, regenerate effects:

```bash
# After editing rule
npm run generate:effects -- --action={mod}:{action}
npm run validate:effects -- --action={mod}:{action}
```

### 2. Validate Before Committing

Add pre-commit hook:

```bash
#!/bin/bash
# .git/hooks/pre-commit
npm run validate:effects || exit 1
```

### 3. Review Generated Effects

Don't blindly accept generated effects. Review them to ensure they make sense:

- Do effects match intended action behavior?
- Are costs reasonable?
- Are abstract preconditions necessary?

### 4. Keep Actions and Rules in Sync

Maintain 1:1 relationship between actions and rules when possible:
- Action: `{mod}:{action_name}`
- Rule: `{mod}:handle_{action_name}`

### 5. Use Validation Reports for Tracking

Generate reports before and after changes:

```bash
npm run validate:effects -- --report=before.json
# Make changes
npm run generate:effects
npm run validate:effects -- --report=after.json
# Compare reports
```

## Advanced Usage

### Custom Validation Scripts

Create custom validation scripts for specific needs:

```javascript
// scripts/validate-critical-actions.js
import { effectsValidator, dataRegistry } from './setup.js';

const criticalActions = ['combat:attack', 'items:give_item'];

for (const actionId of criticalActions) {
  const result = await effectsValidator.validateAction(actionId);
  if (!result.valid) {
    console.error(`Critical action ${actionId} has invalid effects!`);
    process.exit(1);
  }
}
```

### Batch Processing with Filtering

Generate effects only for actions matching criteria:

```javascript
// scripts/generate-combat-effects.js
const actions = dataRegistry.getAll('actions');
const combatActions = actions.filter(a => a.id.startsWith('combat:'));

for (const action of combatActions) {
  const effects = effectsGenerator.generateForAction(action.id);
  // Process effects...
}
```

## Related Documentation

- [GOAP System Overview](./README.md)
- [Effects Analyzer Architecture](./effects-analyzer-architecture.md)
- [Effects Generator Usage](./effects-generator-usage.md)
- [Operation Mapping](./operation-mapping.md)

## Support

For issues or questions:
- Check existing documentation in `docs/goap/`
- Review test examples in `tests/unit/goap/` and `tests/integration/goap/`
- Open a GitHub issue with the `goap` label
