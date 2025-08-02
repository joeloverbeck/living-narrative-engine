# POSMIG-05: Migrate Get Close Action and Rule

## Overview

Migrate the `get_close` action and its associated rule from the intimacy mod to the positioning mod. This action allows actors to move closer to a target, entering their personal space and forming or joining closeness circles. This migration includes updating all references from `intimacy:get_close` to `positioning:get_close` and ensuring the closeness circle merging algorithm continues to function correctly.

## Priority

**Critical** - This is a fundamental positioning action that enables the closeness mechanic.

## Dependencies

- POSMIG-01: Create Positioning Mod Infrastructure (completed)
- POSMIG-02: Update Build and Test Infrastructure (completed)
- POSMIG-03: Migrate Closeness Component (must be completed)
- POSMIG-04: Migrate Facing Away Component (should be completed)

## Estimated Effort

**3-4 hours** (including testing the complex merge algorithm)

## Acceptance Criteria

1. ✅ Get close action file moved to positioning mod
2. ✅ Get close rule file moved to positioning mod
3. ✅ Action ID updated from `intimacy:get_close` to `positioning:get_close`
4. ✅ Rule ID and action reference updated
5. ✅ Associated condition migrated (`event-is-action-get-close`)
6. ✅ All component references in rule updated to positioning namespace
7. ✅ Merge closeness circle operation still works correctly
8. ✅ All tests updated and passing
9. ✅ Schema validation passing for both action and rule
10. ✅ Mod manifests updated
11. ✅ No broken references remaining
12. ✅ Migration documented

## Implementation Steps

### Step 1: Copy Action and Rule Files

```bash
# Create backups
cp data/mods/intimacy/actions/get_close.action.json \
   data/mods/intimacy/actions/get_close.action.json.backup

cp data/mods/intimacy/rules/get_close.rule.json \
   data/mods/intimacy/rules/get_close.rule.json.backup

# Copy to positioning mod
cp data/mods/intimacy/actions/get_close.action.json \
   data/mods/positioning/actions/get_close.action.json

cp data/mods/intimacy/rules/get_close.rule.json \
   data/mods/positioning/rules/get_close.rule.json
```

### Step 2: Update Get Close Action

Update `data/mods/positioning/actions/get_close.action.json`:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:get_close",
  "name": "Get Close",
  "description": "Move closer to the target, entering their personal space.",
  "scope": "core:actors_in_location",
  "required_components": {},
  "template": "get close to {target}",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "core:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    }
  ]
}
```

### Step 3: Update Get Close Rule

Update `data/mods/positioning/rules/get_close.rule.json`:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "positioning_handle_get_close",
  "comment": "Handles the 'positioning:get_close' action. Implements algorithm §5.1 from the spec. It merges actor, target, and their existing partners into a new, single, fully-connected closeness circle, then locks movement for all members.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-get-close"
  },
  "actions": [
    {
      "type": "MERGE_CLOSENESS_CIRCLE",
      "comment": "Steps 1-6: Merge actor and target closeness circles and lock movement.",
      "parameters": {
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.targetId}"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Step 7: Get names for the UI message.",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get location for perceptible event.",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPos"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} and {context.targetName} are now close."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPos.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "state_change_observable"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Step 4: Migrate Associated Condition

Copy and update the condition:

```bash
cp data/mods/intimacy/conditions/event-is-action-get-close.condition.json \
   data/mods/positioning/conditions/event-is-action-get-close.condition.json
```

Update `data/mods/positioning/conditions/event-is-action-get-close.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-get-close",
  "description": "Checks if the triggering event is for the 'positioning:get_close' action.",
  "logic": {
    "==": [
      {
        "var": "event.payload.actionId"
      },
      "positioning:get_close"
    ]
  }
}
```

### Step 5: Update Positioning Mod Manifest

Update `data/mods/positioning/mod-manifest.json`:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "positioning",
  "version": "1.0.0",
  "name": "Positioning System",
  "description": "Provides physical positioning and spatial relationship mechanics for actors, including closeness circles, facing directions, and movement actions.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "components": [
      "closeness.component.json",
      "kneeling_before.component.json",
      "facing_away.component.json"
    ],
    "actions": ["kneel_before.action.json", "get_close.action.json"],
    "conditions": [
      "event-is-action-kneel-before.condition.json",
      "event-is-action-get-close.condition.json"
    ],
    "rules": ["kneel_before.rule.json", "get_close.rule.json"],
    "entities": {
      "definitions": [],
      "instances": []
    },
    "events": [],
    "macros": [],
    "scopes": []
  }
}
```

### Step 6: Update References in Other Files

Search for any references to `intimacy:get_close` in:

1. **Test files** - Update action IDs in test data
2. **Other conditions** - Check if any other conditions reference this action
3. **Documentation** - Update any docs that mention the action

### Step 7: Verify Operation Handler Compatibility

Check that `src/logic/operationHandlers/mergeClosenessCircleHandler.js` works with the new component namespace:

```javascript
// The handler already uses 'positioning:closeness' directly in the code
// at lines 122, 126, and 136 in mergeClosenessCircleHandler.js
// No changes needed - already migrated
```

### Step 8: Update Test Files

Update test imports and references in both files:

`tests/integration/rules/closenessActionAvailability.integration.test.js`:

```javascript
// Update import paths to reference positioning mod
import getCloseRule from '../../../data/mods/positioning/rules/get_close.rule.json';
import eventIsActionGetClose from '../../../data/mods/positioning/conditions/event-is-action-get-close.condition.json';

// Update action ID references throughout
const getCloseAction = {
  id: 'positioning:get_close', // Changed from 'intimacy:get_close'
  // ... rest of action data
};
```

`tests/integration/rules/getCloseRule.integration.test.js`:

```javascript
// Update import paths
import getCloseRule from '../../../data/mods/positioning/rules/get_close.rule.json';
import eventIsActionGetClose from '../../../data/mods/positioning/conditions/event-is-action-get-close.condition.json';

// Update rule ID reference
const RULE_ID = 'positioning_handle_get_close'; // Changed from 'intimacy_handle_get_close'

// Update event payload structure to match core:attempt_action
const actionEvent = {
  type: 'core:attempt_action',
  payload: {
    actionId: 'positioning:get_close',
    actorId: actorId,
    targetId: targetId,
  },
};
```

### Step 9: Create Migration Validation Script

Create `scripts/validate-get-close-migration.js`:

```javascript
#!/usr/bin/env node

/**
 * @file Validates get_close action and rule migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_ACTION_ID = 'intimacy:get_close';
const NEW_ACTION_ID = 'positioning:get_close';

async function validateMigration() {
  console.log('🔍 Validating get_close action/rule migration...\n');

  const errors = [];

  // Check new files exist
  const newFiles = [
    'data/mods/positioning/actions/get_close.action.json',
    'data/mods/positioning/rules/get_close.rule.json',
    'data/mods/positioning/conditions/event-is-action-get-close.condition.json',
  ];

  for (const file of newFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const data = JSON.parse(content);

      // Verify IDs are updated
      if (file.includes('action.json') && data.id !== NEW_ACTION_ID) {
        errors.push(`Action file has wrong ID: ${data.id}`);
      }
      if (
        file.includes('rule.json') &&
        !data.trigger.conditions.includes(
          'positioning:event-is-action-get-close'
        )
      ) {
        errors.push('Rule file has wrong condition reference');
      }

      console.log(`✅ ${file} exists and has correct ID`);
    } catch (error) {
      errors.push(`Failed to read ${file}: ${error.message}`);
    }
  }

  // Check for old references
  const patterns = ['data/mods/**/*.json', 'src/**/*.js', 'tests/**/*.js'];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/*.backup'],
    });

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      if (content.includes(OLD_ACTION_ID)) {
        const lines = content.split('\n');
        const lineNumbers = lines
          .map((line, idx) => (line.includes(OLD_ACTION_ID) ? idx + 1 : null))
          .filter((n) => n !== null);

        errors.push(
          `${file} still contains old reference at lines: ${lineNumbers.join(', ')}`
        );
      }
    }
  }

  // Verify rule operations use correct component
  try {
    const ruleContent = await fs.readFile(
      'data/mods/positioning/rules/get_close.rule.json',
      'utf8'
    );
    const rule = JSON.parse(ruleContent);

    if (rule.operations[0].type !== 'merge_closeness_circle') {
      errors.push('Rule is missing merge_closeness_circle operation');
    }

    console.log('✅ Rule operations are correct');
  } catch (error) {
    errors.push(`Failed to validate rule operations: ${error.message}`);
  }

  // Check old files are removed
  const oldFiles = [
    'data/mods/intimacy/actions/get_close.action.json',
    'data/mods/intimacy/rules/get_close.rule.json',
  ];

  for (const file of oldFiles) {
    try {
      await fs.access(file);
      console.log(`⚠️  Warning: Old file still exists: ${file}`);
    } catch {
      console.log(`✅ Old file removed: ${file}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Migration validation passed!');
  }
}

validateMigration().catch(console.error);
```

### Step 10: Remove Original Files

After validation passes:

```bash
# Remove original files
rm data/mods/intimacy/actions/get_close.action.json
rm data/mods/intimacy/rules/get_close.rule.json
rm data/mods/intimacy/conditions/event-is-action-get-close.condition.json

# Keep backups for safety
```

## Validation Steps

### 1. Run Migration Validation Script

```bash
node scripts/validate-get-close-migration.js
```

### 2. Schema Validation

```bash
# Note: The project uses a custom schema validation system through AjvSchemaValidator
# These schemas use custom URI schemes like "schema://living-narrative-engine/"
# Run the application's built-in validation instead of direct AJV commands

# Test schema validation through the application
npm test tests/unit/schemas/ # Run schema validation tests
npm run build # Build will validate all mod files including schemas
```

### 3. Run Integration Tests

```bash
# Test action availability
npm test tests/integration/rules/closenessActionAvailability.integration.test.js

# Test rule execution
npm test tests/integration/rules/getCloseRule.integration.test.js

# Run all integration tests
npm run test:integration
```

### 4. Manual Testing

1. Start the application:

   ```json
   {
     "mods": ["core", "positioning", "intimacy"]
   }
   ```

2. Test the get close action:
   - Action should appear in available actions
   - Executing action should create/merge closeness circles
   - Multiple actors getting close should all join same circle

### 5. Test Closeness Circle Algorithm

Create a test scenario with multiple actors:

1. Actor A gets close to Actor B (creates circle)
2. Actor C gets close to Actor A (joins circle)
3. Actor D gets close to Actor E (creates separate circle)
4. Actor E gets close to Actor B (merges both circles)

Verify all actors end up in one closeness circle.

## Common Issues and Solutions

### Issue 1: Action Not Available

**Problem**: Get close action doesn't appear in UI.

**Solution**:

1. Check mod load order (positioning before intimacy)
2. Verify action visibility is "public"
3. Check required conditions are met

### Issue 2: Rule Not Triggering

**Problem**: Rule doesn't execute when action is performed.

**Solution**:

1. Verify condition logic matches new action ID
2. Check rule is active
3. Verify event bus is dispatching ACTION_PERFORMED events

### Issue 3: Merge Operation Fails

**Problem**: Closeness circles don't merge correctly.

**Solution**:

1. Verify operation handler uses updated component ID
2. Check that both actors have proper entity IDs
3. Review merge algorithm logic

## Rollback Plan

If critical issues arise:

1. Restore original files:

   ```bash
   cp data/mods/intimacy/actions/get_close.action.json.backup \
      data/mods/intimacy/actions/get_close.action.json

   cp data/mods/intimacy/rules/get_close.rule.json.backup \
      data/mods/intimacy/rules/get_close.rule.json
   ```

2. Revert manifest changes

3. Re-run tests to verify stability

## Completion Checklist

- [ ] Action file copied and updated
- [ ] Rule file copied and updated
- [ ] Condition file copied and updated
- [ ] All IDs updated to positioning namespace
- [ ] Mod manifests updated
- [ ] Test files updated
- [ ] Validation script created and passing
- [ ] Schema validation passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Closeness circle merging verified
- [ ] Original files removed
- [ ] Migration documented

## Next Steps

After successful migration:

- POSMIG-06: Migrate Step Back Action and Rule
- Continue with remaining action migrations

## Notes for Implementer

- **CRITICAL**: The operation is `MERGE_CLOSENESS_CIRCLE` (uppercase) in handlers, not `merge_closeness_circle`
- The rule uses a complex legacy format with multiple actions and macro system, not simple operations
- The rule ID should be `positioning_handle_get_close`, not `positioning:get_close`
- Event type is `core:attempt_action`, not `ACTION_PERFORMED`
- Schema URLs use custom format: `schema://living-narrative-engine/`
- Test thoroughly with the exact action/rule structure from the original files
- Pay attention to the event condition logic using JSON Logic format
- The action uses legacy format with `scope`, `template`, `prerequisites` structure
- Test with multiple actors to ensure the complex macro system scales properly
- Document any edge cases found during testing
