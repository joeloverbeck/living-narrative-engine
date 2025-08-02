# POSMIG-06: Migrate Step Back Action and Rule

## Overview

Migrate the `step_back` action and its associated rule from the intimacy mod to the positioning mod. This action allows actors to step away from their current closeness circle, ending physical proximity with other actors. This migration includes updating all references from `intimacy:step_back` to `positioning:step_back` and ensuring the remove from closeness circle operation continues to function correctly.

## Priority

**Critical** - This action is the counterpart to get_close and essential for positioning mechanics.

## Dependencies

- POSMIG-01: Create Positioning Mod Infrastructure (completed)
- POSMIG-02: Update Build and Test Infrastructure (completed)
- POSMIG-03: Migrate Closeness Component (must be completed)
- POSMIG-05: Migrate Get Close Action and Rule (should be completed)

## Estimated Effort

**2-3 hours** (simpler than get_close as it doesn't involve merging)

## Acceptance Criteria

1. ✅ Step back action file moved to positioning mod
2. ✅ Step back rule file moved to positioning mod
3. ✅ Action ID updated from `intimacy:step_back` to `positioning:step_back`
4. ✅ Rule ID and action reference updated
5. ✅ Associated condition migrated (`event-is-action-step-back`)
6. ✅ Component requirement updated to `positioning:closeness`
7. ✅ Remove from closeness circle operation works correctly
8. ✅ All tests updated and passing
9. ✅ Schema validation passing
10. ✅ Mod manifests updated
11. ✅ No broken references remaining
12. ✅ Migration documented

## Implementation Steps

### Step 1: Copy Action and Rule Files

```bash
# Create backups
cp data/mods/intimacy/actions/step_back.action.json \
   data/mods/intimacy/actions/step_back.action.json.backup

cp data/mods/intimacy/rules/step_back.rule.json \
   data/mods/intimacy/rules/step_back.rule.json.backup

# Copy to positioning mod
cp data/mods/intimacy/actions/step_back.action.json \
   data/mods/positioning/actions/step_back.action.json

cp data/mods/intimacy/rules/step_back.rule.json \
   data/mods/positioning/rules/step_back.rule.json
```

### Step 2: Update Step Back Action

Update `data/mods/positioning/actions/step_back.action.json`:

```json
{
  "$schema": "http://example.com/schemas/action.schema.json",
  "id": "positioning:step_back",
  "name": "Step Back",
  "description": "Step back from current intimate partner, ending the closeness",
  "icon": "👤",
  "requiredConditions": [],
  "forbiddenConditions": [],
  "requiredComponents": [
    "positioning:closeness" // Changed from "intimacy:closeness"
  ],
  "forbiddenComponents": [],
  "parameters": {},
  "cost": {
    "energy": 2
  },
  "cooldown": 0,
  "priority": 15,
  "tags": ["movement", "social", "positioning", "exit"],
  "visibility": "public"
}
```

### Step 3: Update Step Back Rule

Update `data/mods/positioning/rules/step_back.rule.json`:

```json
{
  "$schema": "http://example.com/schemas/rule.schema.json",
  "id": "positioning:step_back",
  "name": "Step Back Rule",
  "description": "Handles the step_back action by removing actor from closeness circle",
  "trigger": {
    "conditions": [
      "positioning:event-is-action-step-back" // Will create this condition
    ]
  },
  "operations": [
    {
      "type": "remove_from_closeness_circle",
      "actor": { "var": "event.payload.actor" }
    }
  ],
  "priority": 100,
  "active": true
}
```

### Step 4: Migrate Associated Condition

Copy and update the condition:

```bash
cp data/mods/intimacy/conditions/event-is-action-step-back.condition.json \
   data/mods/positioning/conditions/event-is-action-step-back.condition.json
```

Update `data/mods/positioning/conditions/event-is-action-step-back.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:event-is-action-step-back",
  "name": "Event is Action Step Back",
  "description": "Checks if the event is for the step_back action",
  "logic": {
    "and": [
      {
        "==": [{ "var": "event.type" }, "ACTION_PERFORMED"]
      },
      {
        "==": [
          { "var": "event.payload.actionId" },
          "positioning:step_back" // Updated from intimacy:step_back
        ]
      }
    ]
  }
}
```

### Step 5: Migrate Additional Condition

Also migrate the condition that checks if actor is in closeness:

```bash
cp data/mods/intimacy/conditions/actor-is-in-closeness.condition.json \
   data/mods/positioning/conditions/actor-is-in-closeness.condition.json
```

Update `data/mods/positioning/conditions/actor-is-in-closeness.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:actor-is-in-closeness",
  "name": "Actor is in Closeness",
  "description": "Checks if the actor has the closeness component",
  "logic": {
    "!=": [
      { "var": "actor.components.positioning:closeness" }, // Updated path
      null
    ]
  }
}
```

### Step 6: Update Positioning Mod Manifest

Update `data/mods/positioning/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    "components": ["closeness.component.json", "facing_away.component.json"],
    "actions": [
      "get_close.action.json",
      "step_back.action.json" // Add this
    ],
    "rules": [
      "get_close.rule.json",
      "step_back.rule.json" // Add this
    ],
    "conditions": [
      "event-is-action-get-close.condition.json",
      "event-is-action-step-back.condition.json", // Add this
      "actor-is-in-closeness.condition.json" // Add this
    ],
    "events": [],
    "scopes": [],
    "entities": []
  },
  "metadata": {
    // ... existing metadata ...
    "lastModified": "2024-01-02T03:00:00Z" // Update timestamp
  }
}
```

### Step 7: Verify Operation Handler Compatibility

Check that `src/logic/operationHandlers/removeFromClosenessCircleHandler.js` works with the new namespace:

```javascript
// The handler should already use the CLOSENESS_COMPONENT_ID constant
// which was updated in POSMIG-03 to 'positioning:closeness'
// Verify the remove logic handles empty circles correctly
```

### Step 8: Update Test Files

Update `tests/integration/rules/stepBackRule.integration.test.js`:

```javascript
// Update action and component IDs
const STEP_BACK_ACTION_ID = 'positioning:step_back';
const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

// Update test setup
beforeEach(() => {
  // ... existing setup ...

  // Add closeness component to actor
  testBed.addComponent(actorId, {
    id: CLOSENESS_COMPONENT_ID,
    data: { partners: [targetId] },
  });
});

// Update event creation
const stepBackEvent = {
  type: 'ACTION_PERFORMED',
  payload: {
    actionId: STEP_BACK_ACTION_ID,
    actor: actorId,
  },
};

// Update assertions to use new component ID
expect(actorComponents[CLOSENESS_COMPONENT_ID]).toBeUndefined();
```

### Step 9: Create Migration Validation Script

Create `scripts/validate-step-back-migration.js`:

```javascript
#!/usr/bin/env node

/**
 * @file Validates step_back action and rule migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_ACTION_ID = 'intimacy:step_back';
const NEW_ACTION_ID = 'positioning:step_back';
const OLD_COMPONENT_REF = 'intimacy:closeness';
const NEW_COMPONENT_REF = 'positioning:closeness';

async function validateMigration() {
  console.log('🔍 Validating step_back action/rule migration...\n');

  const errors = [];

  // Check new files exist
  const newFiles = [
    'data/mods/positioning/actions/step_back.action.json',
    'data/mods/positioning/rules/step_back.rule.json',
    'data/mods/positioning/conditions/event-is-action-step-back.condition.json',
    'data/mods/positioning/conditions/actor-is-in-closeness.condition.json',
  ];

  for (const file of newFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const data = JSON.parse(content);

      // Verify IDs and references are updated
      if (content.includes(OLD_ACTION_ID)) {
        errors.push(`${file} still contains old action ID`);
      }
      if (content.includes(OLD_COMPONENT_REF)) {
        errors.push(`${file} still contains old component reference`);
      }

      // Check specific validations
      if (file.includes('step_back.action.json')) {
        if (data.id !== NEW_ACTION_ID) {
          errors.push(`Action has wrong ID: ${data.id}`);
        }
        if (!data.requiredComponents.includes(NEW_COMPONENT_REF)) {
          errors.push('Action missing required component');
        }
      }

      console.log(`✅ ${path.basename(file)} migrated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${file}: ${error.message}`);
    }
  }

  // Check for remaining old references
  const patterns = ['data/mods/**/*.json', 'src/**/*.js', 'tests/**/*.js'];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/*.backup', '**/positioning/**'],
    });

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      if (content.includes(OLD_ACTION_ID)) {
        errors.push(`${file} still contains ${OLD_ACTION_ID}`);
      }
    }
  }

  // Verify rule operation
  try {
    const ruleContent = await fs.readFile(
      'data/mods/positioning/rules/step_back.rule.json',
      'utf8'
    );
    const rule = JSON.parse(ruleContent);

    if (rule.operations[0].type !== 'remove_from_closeness_circle') {
      errors.push('Rule missing correct operation type');
    }

    console.log('✅ Rule operation is correct');
  } catch (error) {
    errors.push(`Failed to validate rule: ${error.message}`);
  }

  // Check old files removed
  const oldFiles = [
    'data/mods/intimacy/actions/step_back.action.json',
    'data/mods/intimacy/rules/step_back.rule.json',
    'data/mods/intimacy/conditions/event-is-action-step-back.condition.json',
  ];

  for (const file of oldFiles) {
    try {
      await fs.access(file);
      console.log(`⚠️  Warning: Old file still exists: ${file}`);
    } catch {
      console.log(`✅ Old file removed: ${path.basename(file)}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Step back migration validation passed!');
  }
}

validateMigration().catch(console.error);
```

### Step 10: Remove Original Files

After validation:

```bash
# Remove original files
rm data/mods/intimacy/actions/step_back.action.json
rm data/mods/intimacy/rules/step_back.rule.json
rm data/mods/intimacy/conditions/event-is-action-step-back.condition.json
rm data/mods/intimacy/conditions/actor-is-in-closeness.condition.json

# Keep backups for safety
```

## Validation Steps

### 1. Run Migration Validation

```bash
node scripts/validate-step-back-migration.js
```

### 2. Schema Validation

```bash
# Validate action
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/positioning/actions/step_back.action.json

# Validate rule
npx ajv validate -s data/schemas/rule.schema.json \
  -d data/mods/positioning/rules/step_back.rule.json

# Validate conditions
npx ajv validate -s data/schemas/condition.schema.json \
  -d data/mods/positioning/conditions/event-is-action-step-back.condition.json

npx ajv validate -s data/schemas/condition.schema.json \
  -d data/mods/positioning/conditions/actor-is-in-closeness.condition.json
```

### 3. Run Tests

```bash
# Run specific test
npm test tests/integration/rules/stepBackRule.integration.test.js

# Run all integration tests
npm run test:integration
```

### 4. Manual Testing

1. Start application with positioning and intimacy mods
2. Test step back action:
   - Get two actors close together
   - Verify step back action is available
   - Execute step back
   - Verify actor is removed from closeness circle
   - Verify other actors remain in circle if 3+ were close

### 5. Edge Case Testing

Test these scenarios:

1. Single actor steps back from 2-person circle (circle should be removed)
2. Actor steps back from 3+ person circle (others remain close)
3. Step back when not in closeness (action shouldn't be available)
4. Multiple actors stepping back simultaneously

## Common Issues and Solutions

### Issue 1: Action Not Available When Expected

**Problem**: Step back doesn't appear even when in closeness.

**Solution**:

1. Verify closeness component has correct ID
2. Check action's requiredComponents array
3. Ensure component data is properly structured

### Issue 2: Circle Not Removed When Empty

**Problem**: Empty closeness circles remain after all actors step back.

**Solution**:

1. Check remove operation handler logic
2. Verify it removes component when partners array is empty
3. Add logging to track circle cleanup

### Issue 3: Test Failures

**Problem**: Integration tests fail after migration.

**Solution**:

1. Update all component IDs in test setup
2. Verify test is adding closeness component with new ID
3. Check assertions use new component namespace

## Rollback Plan

If issues arise:

1. Restore files:

   ```bash
   cp data/mods/intimacy/actions/step_back.action.json.backup \
      data/mods/intimacy/actions/step_back.action.json

   cp data/mods/intimacy/rules/step_back.rule.json.backup \
      data/mods/intimacy/rules/step_back.rule.json
   ```

2. Restore conditions from backups

3. Revert manifest changes

4. Re-run tests

## Completion Checklist

- [ ] Action file copied and updated
- [ ] Rule file copied and updated
- [ ] Both conditions copied and updated
- [ ] All IDs updated to positioning namespace
- [ ] Component requirements updated
- [ ] Mod manifest updated
- [ ] Test files updated
- [ ] Validation script created and passing
- [ ] Schema validation passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Edge cases tested
- [ ] Original files removed
- [ ] Migration documented

## Next Steps

After successful migration:

- POSMIG-07: Migrate Turn Around Actions and Rules
- Continue with remaining positioning mechanics

## Notes for Implementer

- Step back is simpler than get close - no merging logic
- Pay attention to empty circle cleanup
- The action requires closeness component to be present
- Test with multiple actors to ensure proper isolation
- Consider logging for debugging circle membership changes
- Update any UI that shows available actions
