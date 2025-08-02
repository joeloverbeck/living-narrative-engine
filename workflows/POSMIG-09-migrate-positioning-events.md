# POSMIG-09: Migrate Positioning Events

## Overview

Migrate positioning-related events from the intimacy mod to the positioning mod. These events are dispatched when actors change their facing direction or positioning state. Events are important for notifying other systems about positioning changes and maintaining game state consistency.

## Priority

**Medium** - Events are supporting infrastructure for positioning mechanics.

## Dependencies

- POSMIG-01: Create Positioning Mod Infrastructure (completed)
- POSMIG-02: Update Build and Test Infrastructure (completed)
- POSMIG-07: Migrate Turn Around Actions and Rules (should be completed)

## Estimated Effort

**1-2 hours** (straightforward event migration)

## Acceptance Criteria

1. ✅ All positioning-related events moved to positioning mod
2. ✅ Event IDs updated to positioning namespace
3. ✅ Event references in rules updated
4. ✅ Schema validation passing
5. ✅ Mod manifests updated
6. ✅ No broken references remaining
7. ✅ Migration documented

## Implementation Steps

### Step 1: Identify Events to Migrate

The following events are positioning-related:

- `actor_turned_around.event.json`
- `actor_faced_forward.event.json`
- `actor_faced_everyone.event.json`

### Step 2: Copy Event Files

```bash
# Create backups
cp data/mods/intimacy/events/actor_turned_around.event.json \
   data/mods/intimacy/events/actor_turned_around.event.json.backup

cp data/mods/intimacy/events/actor_faced_forward.event.json \
   data/mods/intimacy/events/actor_faced_forward.event.json.backup

cp data/mods/intimacy/events/actor_faced_everyone.event.json \
   data/mods/intimacy/events/actor_faced_everyone.event.json.backup

# Copy to positioning mod
cp data/mods/intimacy/events/actor_turned_around.event.json \
   data/mods/positioning/events/actor_turned_around.event.json

cp data/mods/intimacy/events/actor_faced_forward.event.json \
   data/mods/positioning/events/actor_faced_forward.event.json

cp data/mods/intimacy/events/actor_faced_everyone.event.json \
   data/mods/positioning/events/actor_faced_everyone.event.json
```

### Step 3: Update Event IDs

Update `data/mods/positioning/events/actor_turned_around.event.json`:

```json
{
  "$schema": "http://example.com/schemas/event.schema.json",
  "id": "positioning:actor_turned_around",
  "name": "Actor Turned Around",
  "description": "Event fired when an actor turns around (faces away from someone)",
  "payload": {
    "type": "object",
    "properties": {
      "actor": {
        "type": "string",
        "description": "The actor who turned around"
      },
      "turnedAwayFrom": {
        "type": "string",
        "description": "The actor they turned away from"
      }
    },
    "required": ["actor", "turnedAwayFrom"]
  }
}
```

Update `data/mods/positioning/events/actor_faced_forward.event.json`:

```json
{
  "$schema": "http://example.com/schemas/event.schema.json",
  "id": "positioning:actor_faced_forward",
  "name": "Actor Faced Forward",
  "description": "Event fired when an actor faces forward (stops facing away)",
  "payload": {
    "type": "object",
    "properties": {
      "actor": {
        "type": "string",
        "description": "The actor who faced forward"
      },
      "facedActor": {
        "type": "string",
        "description": "The actor they are now facing"
      }
    },
    "required": ["actor", "facedActor"]
  }
}
```

Update `data/mods/positioning/events/actor_faced_everyone.event.json`:

```json
{
  "$schema": "http://example.com/schemas/event.schema.json",
  "id": "positioning:actor_faced_everyone",
  "name": "Actor Faced Everyone",
  "description": "Event fired when an actor faces everyone (clears facing_away list)",
  "payload": {
    "type": "object",
    "properties": {
      "actor": {
        "type": "string",
        "description": "The actor who faced everyone"
      }
    },
    "required": ["actor"]
  }
}
```

### Step 4: Update Rule References

Update rules that dispatch these events to use the new event types:

In `data/mods/positioning/rules/turn_around.rule.json`:

```json
{
  // ... existing content ...
  "operations": [
    {
      "type": "conditional",
      // ... condition logic ...
      "then": [
        // ... other operations ...
        {
          "type": "dispatch_event",
          "event": {
            "type": "ACTOR_FACED_FORWARD", // Keep this constant
            "payload": {
              "actor": { "var": "event.payload.entity" },
              "facedActor": { "var": "event.payload.actor" }
            }
          }
        }
      ],
      "else": [
        // ... other operations ...
        {
          "type": "dispatch_event",
          "event": {
            "type": "ACTOR_TURNED_AROUND", // Keep this constant
            "payload": {
              "actor": { "var": "event.payload.entity" },
              "turnedAwayFrom": { "var": "event.payload.actor" }
            }
          }
        }
      ]
    }
  ]
}
```

### Step 5: Update Positioning Mod Manifest

Update `data/mods/positioning/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    // ... other content ...
    "events": [
      "actor_turned_around.event.json",
      "actor_faced_forward.event.json",
      "actor_faced_everyone.event.json"
    ]
    // ... rest of content ...
  },
  "metadata": {
    // ... existing metadata ...
    "lastModified": "2024-01-02T06:00:00Z"
  }
}
```

### Step 6: Update Intimacy Mod Manifest

Remove migrated events from `data/mods/intimacy/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    // ... other content ...
    "events": [
      // Remove the three migrated events from this array
      // Keep only intimacy-specific events
    ]
  }
}
```

### Step 7: Create Migration Validation Script

Create `scripts/validate-events-migration.js`:

```javascript
#!/usr/bin/env node

/**
 * @file Validates positioning events migration
 * @description Ensures all events have been migrated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';

const MIGRATED_EVENTS = [
  'actor_turned_around',
  'actor_faced_forward',
  'actor_faced_everyone',
];

async function validateMigration() {
  console.log('🔍 Validating positioning events migration...\n');

  const errors = [];

  // Check new event files exist and are correct
  for (const eventName of MIGRATED_EVENTS) {
    const filePath = `data/mods/positioning/events/${eventName}.event.json`;

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const event = JSON.parse(content);

      // Check ID is updated
      if (event.id !== `positioning:${eventName}`) {
        errors.push(`${eventName} has wrong ID: ${event.id}`);
      }

      // Check payload structure
      if (!event.payload || !event.payload.properties) {
        errors.push(`${eventName} missing payload structure`);
      }

      console.log(`✅ ${eventName} migrated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${eventName}: ${error.message}`);
    }
  }

  // Check positioning mod manifest includes all events
  try {
    const manifestContent = await fs.readFile(
      'data/mods/positioning/mod-manifest.json',
      'utf8'
    );
    const manifest = JSON.parse(manifestContent);

    for (const eventName of MIGRATED_EVENTS) {
      const fileName = `${eventName}.event.json`;
      if (!manifest.content.events.includes(fileName)) {
        errors.push(`Positioning manifest missing ${fileName}`);
      }
    }

    console.log('✅ Positioning mod manifest updated');
  } catch (error) {
    errors.push(`Failed to validate positioning manifest: ${error.message}`);
  }

  // Check old event files are removed
  for (const eventName of MIGRATED_EVENTS) {
    const oldPath = `data/mods/intimacy/events/${eventName}.event.json`;
    try {
      await fs.access(oldPath);
      console.log(`⚠️  Warning: Old event file still exists: ${eventName}`);
    } catch {
      console.log(`✅ Old event file removed: ${eventName}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Events migration validation passed!');
  }
}

validateMigration().catch(console.error);
```

### Step 8: Remove Original Event Files

```bash
# Remove original files
rm data/mods/intimacy/events/actor_turned_around.event.json
rm data/mods/intimacy/events/actor_faced_forward.event.json
rm data/mods/intimacy/events/actor_faced_everyone.event.json

# Keep backups for safety
```

## Validation Steps

### 1. Run Migration Validation

```bash
node scripts/validate-events-migration.js
```

### 2. Schema Validation

```bash
# Validate all migrated events
for file in data/mods/positioning/events/*.event.json; do
  echo "Validating $(basename "$file")..."
  npx ajv validate -s data/schemas/event.schema.json -d "$file"
done
```

### 3. Test Event Dispatching

Create a test to verify events are dispatched correctly:

```javascript
// test-event-dispatch.js
import { TestBed } from '../tests/common/testbed.js';

const testBed = new TestBed();
const mockEventBus = testBed.createMockEventBus();

// Test turn around action dispatches correct event
const turnAroundRule = testBed.loadRule('positioning:turn_around');
const testEvent = {
  type: 'ACTION_PERFORMED',
  payload: {
    actionId: 'positioning:turn_around',
    actor: 'actor1',
    entity: 'entity1',
  },
};

// Execute rule and verify event dispatch
turnAroundRule.execute(testEvent);
expect(mockEventBus.dispatch).toHaveBeenCalledWith(
  expect.objectContaining({
    type: 'ACTOR_TURNED_AROUND',
  })
);
```

### 4. Run All Tests

```bash
npm run test:ci
```

## Common Issues and Solutions

### Issue 1: Event Type Constants

**Problem**: Rules use event type constants that may not match event IDs.

**Solution**: Keep event type constants separate from event definition IDs.

### Issue 2: Payload Validation

**Problem**: Event payloads don't match expected structure.

**Solution**: Verify payload schemas match rule dispatch logic.

### Issue 3: Missing Event Listeners

**Problem**: Other systems listening for events can't find them.

**Solution**: Update event listener registrations to use new event types.

## Rollback Plan

If migration fails:

1. Restore event files from backups
2. Revert manifest changes
3. Update rules to use old event references
4. Re-run tests

## Completion Checklist

- [ ] All positioning events identified
- [ ] Event files copied to positioning mod
- [ ] Event IDs updated to positioning namespace
- [ ] Rule references updated
- [ ] Positioning mod manifest updated
- [ ] Intimacy mod manifest updated
- [ ] Validation script created and passing
- [ ] Schema validation passing
- [ ] Event dispatching tested
- [ ] All tests passing
- [ ] Original files removed
- [ ] Migration documented

## Next Steps

After successful migration:

- POSMIG-10: Migrate Positioning Scopes
- Continue with scope migration

## Notes for Implementer

- Events are primarily documentation/schema definitions
- The actual event types used in rules are constants
- Event payload schemas should match rule dispatch payloads
- Consider adding event listeners in tests to verify dispatching
- Update any event monitoring or logging systems
- Events may be used by AI systems for context
