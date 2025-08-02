# POSMIG-07: Migrate Turn Around Actions and Rules

## Overview

Migrate both turn-around actions and their associated rules from the intimacy mod to the positioning mod. This includes `turn_around` (turn another actor around) and `turn_around_to_face` (turn to face someone you're facing away from). These actions manipulate the `facing_away` component and are essential for orientation mechanics.

## Priority

**High** - These actions complete the core positioning mechanics for orientation.

## Dependencies

- POSMIG-01: Create Positioning Mod Infrastructure (completed)
- POSMIG-02: Update Build and Test Infrastructure (completed)
- POSMIG-03: Migrate Closeness Component (completed)
- POSMIG-04: Migrate Facing Away Component (must be completed)

## Estimated Effort

**3-4 hours** (two actions and rules with complex orientation logic)

## Acceptance Criteria

1. ✅ Both turn around actions moved to positioning mod
2. ✅ Both turn around rules moved to positioning mod
3. ✅ Action IDs updated to positioning namespace
4. ✅ Rule IDs and action references updated
5. ✅ Associated conditions migrated
6. ✅ Component references updated to positioning namespace
7. ✅ Facing away manipulation operations work correctly
8. ✅ All tests updated and passing
9. ✅ Schema validation passing
10. ✅ Mod manifests updated
11. ✅ No broken references remaining
12. ✅ Migration documented

## Implementation Steps

### Step 1: Copy Action and Rule Files

```bash
# Create backups
cp data/mods/intimacy/actions/turn_around.action.json \
   data/mods/intimacy/actions/turn_around.action.json.backup

cp data/mods/intimacy/actions/turn_around_to_face.action.json \
   data/mods/intimacy/actions/turn_around_to_face.action.json.backup

cp data/mods/intimacy/rules/turn_around.rule.json \
   data/mods/intimacy/rules/turn_around.rule.json.backup

cp data/mods/intimacy/rules/turn_around_to_face.rule.json \
   data/mods/intimacy/rules/turn_around_to_face.rule.json.backup

# Copy to positioning mod
cp data/mods/intimacy/actions/turn_around.action.json \
   data/mods/positioning/actions/turn_around.action.json

cp data/mods/intimacy/actions/turn_around_to_face.action.json \
   data/mods/positioning/actions/turn_around_to_face.action.json

cp data/mods/intimacy/rules/turn_around.rule.json \
   data/mods/positioning/rules/turn_around.rule.json

cp data/mods/intimacy/rules/turn_around_to_face.rule.json \
   data/mods/positioning/rules/turn_around_to_face.rule.json
```

### Step 2: Update Turn Around Action

Update `data/mods/positioning/actions/turn_around.action.json`:

```json
{
  "$schema": "http://example.com/schemas/action.schema.json",
  "id": "positioning:turn_around",
  "name": "Turn Around",
  "description": "Turn the target around or have them face you again",
  "icon": "🔄",
  "requiredConditions": [],
  "forbiddenConditions": [],
  "requiredComponents": [],
  "forbiddenComponents": [],
  "parameters": {
    "target": {
      "type": "entity",
      "description": "The entity to turn around"
    }
  },
  "cost": {
    "energy": 3
  },
  "cooldown": 0,
  "priority": 20,
  "tags": ["positioning", "orientation", "social"],
  "visibility": "public"
}
```

### Step 3: Update Turn Around To Face Action

Update `data/mods/positioning/actions/turn_around_to_face.action.json`:

```json
{
  "$schema": "http://example.com/schemas/action.schema.json",
  "id": "positioning:turn_around_to_face",
  "name": "Turn Around to Face",
  "description": "Turn around to face someone you are currently facing away from",
  "icon": "↩️",
  "requiredConditions": [],
  "forbiddenConditions": [],
  "requiredComponents": [
    "positioning:closeness", // Updated from intimacy:closeness
    "positioning:facing_away" // Updated from intimacy:facing_away
  ],
  "forbiddenComponents": [],
  "parameters": {
    "target": {
      "type": "entity",
      "description": "The entity to turn around and face"
    }
  },
  "cost": {
    "energy": 2
  },
  "cooldown": 0,
  "priority": 25,
  "tags": ["positioning", "orientation", "social"],
  "visibility": "public"
}
```

### Step 4: Update Turn Around Rule

Update `data/mods/positioning/rules/turn_around.rule.json`:

```json
{
  "$schema": "http://example.com/schemas/rule.schema.json",
  "id": "positioning:turn_around",
  "name": "Turn Around Rule",
  "description": "Handles the turn_around action by manipulating facing_away component",
  "trigger": {
    "conditions": ["positioning:event-is-action-turn-around"]
  },
  "operations": [
    {
      "type": "conditional",
      "condition": {
        "in": [
          { "var": "event.payload.actor" },
          {
            "var": "event.payload.entity.components.positioning:facing_away.actors"
          }
        ]
      },
      "then": [
        {
          "type": "remove_from_array",
          "entity": { "var": "event.payload.entity" },
          "component": "positioning:facing_away",
          "property": "actors",
          "value": { "var": "event.payload.actor" }
        },
        {
          "type": "dispatch_event",
          "event": {
            "type": "ACTOR_FACED_FORWARD",
            "payload": {
              "actor": { "var": "event.payload.entity" },
              "facedActor": { "var": "event.payload.actor" }
            }
          }
        }
      ],
      "else": [
        {
          "type": "add_to_array",
          "entity": { "var": "event.payload.entity" },
          "component": "positioning:facing_away",
          "property": "actors",
          "value": { "var": "event.payload.actor" }
        },
        {
          "type": "dispatch_event",
          "event": {
            "type": "ACTOR_TURNED_AROUND",
            "payload": {
              "actor": { "var": "event.payload.entity" },
              "turnedAwayFrom": { "var": "event.payload.actor" }
            }
          }
        }
      ]
    }
  ],
  "priority": 100,
  "active": true
}
```

### Step 5: Update Turn Around To Face Rule

Update `data/mods/positioning/rules/turn_around_to_face.rule.json`:

```json
{
  "$schema": "http://example.com/schemas/rule.schema.json",
  "id": "positioning:turn_around_to_face",
  "name": "Turn Around To Face Rule",
  "description": "Handles the turn_around_to_face action by removing target from facing_away",
  "trigger": {
    "conditions": ["positioning:event-is-action-turn-around-to-face"]
  },
  "operations": [
    {
      "type": "remove_from_array",
      "entity": { "var": "event.payload.actor" },
      "component": "positioning:facing_away",
      "property": "actors",
      "value": { "var": "event.payload.entity" }
    },
    {
      "type": "dispatch_event",
      "event": {
        "type": "ACTOR_FACED_FORWARD",
        "payload": {
          "actor": { "var": "event.payload.actor" },
          "facedActor": { "var": "event.payload.entity" }
        }
      }
    }
  ],
  "priority": 100,
  "active": true
}
```

### Step 6: Migrate Associated Conditions

Copy and update the conditions:

```bash
cp data/mods/intimacy/conditions/event-is-action-turn-around.condition.json \
   data/mods/positioning/conditions/event-is-action-turn-around.condition.json

cp data/mods/intimacy/conditions/event-is-action-turn-around-to-face.condition.json \
   data/mods/positioning/conditions/event-is-action-turn-around-to-face.condition.json
```

Update `data/mods/positioning/conditions/event-is-action-turn-around.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:event-is-action-turn-around",
  "name": "Event is Action Turn Around",
  "description": "Checks if the event is for the turn_around action",
  "logic": {
    "and": [
      {
        "==": [{ "var": "event.type" }, "ACTION_PERFORMED"]
      },
      {
        "==": [
          { "var": "event.payload.actionId" },
          "positioning:turn_around" // Updated from intimacy:turn_around
        ]
      }
    ]
  }
}
```

Update `data/mods/positioning/conditions/event-is-action-turn-around-to-face.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:event-is-action-turn-around-to-face",
  "name": "Event is Action Turn Around To Face",
  "description": "Checks if the event is for the turn_around_to_face action",
  "logic": {
    "and": [
      {
        "==": [{ "var": "event.type" }, "ACTION_PERFORMED"]
      },
      {
        "==": [
          { "var": "event.payload.actionId" },
          "positioning:turn_around_to_face" // Updated from intimacy:turn_around_to_face
        ]
      }
    ]
  }
}
```

### Step 7: Update Positioning Mod Manifest

Update `data/mods/positioning/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    "components": ["closeness.component.json", "facing_away.component.json"],
    "actions": [
      "get_close.action.json",
      "step_back.action.json",
      "turn_around.action.json", // Add this
      "turn_around_to_face.action.json" // Add this
    ],
    "rules": [
      "get_close.rule.json",
      "step_back.rule.json",
      "turn_around.rule.json", // Add this
      "turn_around_to_face.rule.json" // Add this
    ],
    "conditions": [
      "event-is-action-get-close.condition.json",
      "event-is-action-step-back.condition.json",
      "actor-is-in-closeness.condition.json",
      "event-is-action-turn-around.condition.json", // Add this
      "event-is-action-turn-around-to-face.condition.json" // Add this
    ],
    "events": [],
    "scopes": [],
    "entities": []
  },
  "metadata": {
    // ... existing metadata ...
    "lastModified": "2024-01-02T04:00:00Z" // Update timestamp
  }
}
```

### Step 8: Update Test Files

Update `tests/integration/rules/turnAroundRule.integration.test.js`:

```javascript
// Update action and component IDs
const TURN_AROUND_ACTION_ID = 'positioning:turn_around';
const FACING_AWAY_COMPONENT_ID = 'positioning:facing_away';

// Update test setup
beforeEach(() => {
  // ... existing setup ...

  // Set up facing away component
  testBed.addComponent(targetId, {
    id: FACING_AWAY_COMPONENT_ID,
    data: { actors: [actorId] },
  });
});

// Update event creation
const turnAroundEvent = {
  type: 'ACTION_PERFORMED',
  payload: {
    actionId: TURN_AROUND_ACTION_ID,
    actor: actorId,
    entity: targetId,
  },
};
```

Update `tests/integration/rules/turnAroundToFaceRule.integration.test.js`:

```javascript
// Update IDs and setup similar to above
const TURN_AROUND_TO_FACE_ACTION_ID = 'positioning:turn_around_to_face';
const FACING_AWAY_COMPONENT_ID = 'positioning:facing_away';
const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

// Update test to include both components in setup
```

### Step 9: Create Migration Validation Script

Create `scripts/validate-turn-around-migration.js`:

```javascript
#!/usr/bin/env node

/**
 * @file Validates turn around actions and rules migration
 * @description Ensures all references have been updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const OLD_REFS = [
  'intimacy:turn_around',
  'intimacy:turn_around_to_face',
  'intimacy:facing_away',
  'intimacy:closeness',
];

const NEW_REFS = [
  'positioning:turn_around',
  'positioning:turn_around_to_face',
  'positioning:facing_away',
  'positioning:closeness',
];

async function validateMigration() {
  console.log('🔍 Validating turn around actions/rules migration...\n');

  const errors = [];

  // Check new files exist and have correct content
  const newFiles = [
    'data/mods/positioning/actions/turn_around.action.json',
    'data/mods/positioning/actions/turn_around_to_face.action.json',
    'data/mods/positioning/rules/turn_around.rule.json',
    'data/mods/positioning/rules/turn_around_to_face.rule.json',
    'data/mods/positioning/conditions/event-is-action-turn-around.condition.json',
    'data/mods/positioning/conditions/event-is-action-turn-around-to-face.condition.json',
  ];

  for (const file of newFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const data = JSON.parse(content);

      // Check for old references
      for (const oldRef of OLD_REFS) {
        if (content.includes(oldRef)) {
          errors.push(`${path.basename(file)} still contains ${oldRef}`);
        }
      }

      // Specific validations
      if (
        file.includes('turn_around.action.json') &&
        !file.includes('to_face')
      ) {
        if (data.id !== 'positioning:turn_around') {
          errors.push(`Turn around action has wrong ID: ${data.id}`);
        }
      }

      if (file.includes('turn_around_to_face.action.json')) {
        if (data.id !== 'positioning:turn_around_to_face') {
          errors.push(`Turn around to face action has wrong ID: ${data.id}`);
        }
        if (!data.requiredComponents.includes('positioning:closeness')) {
          errors.push('Turn around to face missing closeness requirement');
        }
        if (!data.requiredComponents.includes('positioning:facing_away')) {
          errors.push('Turn around to face missing facing_away requirement');
        }
      }

      console.log(`✅ ${path.basename(file)} migrated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${file}: ${error.message}`);
    }
  }

  // Check rule operations
  try {
    const turnAroundRule = JSON.parse(
      await fs.readFile(
        'data/mods/positioning/rules/turn_around.rule.json',
        'utf8'
      )
    );

    if (!turnAroundRule.operations[0].type === 'conditional') {
      errors.push('Turn around rule missing conditional operation');
    }

    const turnToFaceRule = JSON.parse(
      await fs.readFile(
        'data/mods/positioning/rules/turn_around_to_face.rule.json',
        'utf8'
      )
    );

    if (!turnToFaceRule.operations[0].type === 'remove_from_array') {
      errors.push('Turn to face rule missing remove operation');
    }

    console.log('✅ Rule operations are correct');
  } catch (error) {
    errors.push(`Failed to validate rule operations: ${error.message}`);
  }

  // Check for remaining old references
  const patterns = [
    'data/mods/intimacy/**/*.json',
    'src/**/*.js',
    'tests/**/*.js',
  ];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/*.backup'],
    });

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      for (const oldRef of OLD_REFS.slice(0, 2)) {
        // Only check action IDs
        if (content.includes(oldRef)) {
          errors.push(`${file} still contains ${oldRef}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Turn around migration validation passed!');
  }
}

validateMigration().catch(console.error);
```

### Step 10: Remove Original Files

After validation:

```bash
# Remove original files
rm data/mods/intimacy/actions/turn_around.action.json
rm data/mods/intimacy/actions/turn_around_to_face.action.json
rm data/mods/intimacy/rules/turn_around.rule.json
rm data/mods/intimacy/rules/turn_around_to_face.rule.json
rm data/mods/intimacy/conditions/event-is-action-turn-around.condition.json
rm data/mods/intimacy/conditions/event-is-action-turn-around-to-face.condition.json

# Keep backups
```

## Validation Steps

### 1. Run Migration Validation

```bash
node scripts/validate-turn-around-migration.js
```

### 2. Schema Validation

```bash
# Validate all new files
for file in data/mods/positioning/actions/turn_around*.action.json; do
  npx ajv validate -s data/schemas/action.schema.json -d "$file"
done

for file in data/mods/positioning/rules/turn_around*.rule.json; do
  npx ajv validate -s data/schemas/rule.schema.json -d "$file"
done

for file in data/mods/positioning/conditions/event-is-action-turn-around*.condition.json; do
  npx ajv validate -s data/schemas/condition.schema.json -d "$file"
done
```

### 3. Run Tests

```bash
# Run turn around tests
npm test tests/integration/rules/turnAroundRule.integration.test.js
npm test tests/integration/rules/turnAroundToFaceRule.integration.test.js

# Run all tests
npm run test:ci
```

### 4. Manual Testing

Test these scenarios:

1. Turn around action toggles facing away status
2. Turn around to face removes from facing away list
3. Actions appear only when appropriate
4. Events are dispatched correctly

## Common Issues and Solutions

### Issue 1: Complex Rule Logic

**Problem**: Turn around rule has conditional logic that's complex.

**Solution**: Test both branches thoroughly - when actor is in facing_away list and when not.

### Issue 2: Component Dependencies

**Problem**: Turn around to face requires both closeness and facing_away.

**Solution**: Ensure test setup includes both components.

### Issue 3: Event Dispatching

**Problem**: Rules dispatch different events based on actions.

**Solution**: Verify event payloads have correct structure and IDs.

## Completion Checklist

- [ ] Both action files copied and updated
- [ ] Both rule files copied and updated
- [ ] Both condition files copied and updated
- [ ] All IDs updated to positioning namespace
- [ ] Component requirements updated
- [ ] Complex rule logic preserved
- [ ] Mod manifest updated
- [ ] Test files updated
- [ ] Validation script created and passing
- [ ] Schema validation passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Original files removed
- [ ] Migration documented

## Next Steps

After successful migration:

- POSMIG-08: Migrate Positioning Conditions
- Begin migrating remaining supporting files

## Notes for Implementer

- Turn around has complex conditional logic - test both branches
- Pay attention to event dispatching in rules
- Turn around to face requires both components present
- Test the toggle behavior of turn around action
- Verify events have correct payload structure
- Consider adding debug logging for rule execution
