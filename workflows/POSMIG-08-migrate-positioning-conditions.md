# POSMIG-08: Migrate Positioning Conditions

## Overview

Migrate all remaining positioning-related conditions from the intimacy mod to the positioning mod. This includes conditions that check entity relationships, facing directions, and positioning states. Many of these conditions were partially migrated in previous tickets, but this task ensures all positioning-related conditions are consolidated in the positioning mod.

## Priority

**Medium** - These are supporting conditions for positioning mechanics that should be centralized.

## Dependencies

- POSMIG-01: Create Positioning Mod Infrastructure (completed)
- POSMIG-02: Update Build and Test Infrastructure (completed)
- POSMIG-03: Migrate Closeness Component (completed)
- POSMIG-04: Migrate Facing Away Component (completed)

## Estimated Effort

**2-3 hours** (mostly straightforward condition migration with reference updates)

## Acceptance Criteria

1. ✅ All positioning-related conditions moved to positioning mod
2. ✅ Condition IDs updated to positioning namespace
3. ✅ Component references updated to positioning namespace
4. ✅ Logic updated to use new component paths
5. ✅ All references in intimacy mod updated
6. ✅ Schema validation passing
7. ✅ Tests updated and passing
8. ✅ Mod manifests updated
9. ✅ No broken references remaining
10. ✅ Migration documented

## Implementation Steps

### Step 1: Identify Remaining Conditions

The following conditions need to be migrated (some may have been partially migrated in previous tickets):

**Already Migrated** (verify and skip if already done):

- `event-is-action-get-close.condition.json`
- `event-is-action-step-back.condition.json`
- `event-is-action-turn-around.condition.json`
- `event-is-action-turn-around-to-face.condition.json`
- `actor-is-in-closeness.condition.json`

**To Be Migrated**:

- `entity-in-facing-away.condition.json`
- `entity-not-in-facing-away.condition.json`
- `actor-in-entity-facing-away.condition.json`
- `actor-is-behind-entity.condition.json`
- `both-actors-facing-each-other.condition.json`

### Step 2: Copy Remaining Condition Files

```bash
# Create backups
cp data/mods/intimacy/conditions/entity-in-facing-away.condition.json \
   data/mods/intimacy/conditions/entity-in-facing-away.condition.json.backup

cp data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json \
   data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json.backup

cp data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json \
   data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json.backup

cp data/mods/intimacy/conditions/actor-is-behind-entity.condition.json \
   data/mods/intimacy/conditions/actor-is-behind-entity.condition.json.backup

cp data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json \
   data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json.backup

# Copy to positioning mod
cp data/mods/intimacy/conditions/entity-in-facing-away.condition.json \
   data/mods/positioning/conditions/entity-in-facing-away.condition.json

cp data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json \
   data/mods/positioning/conditions/entity-not-in-facing-away.condition.json

cp data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json \
   data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json

cp data/mods/intimacy/conditions/actor-is-behind-entity.condition.json \
   data/mods/positioning/conditions/actor-is-behind-entity.condition.json

cp data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json \
   data/mods/positioning/conditions/both-actors-facing-each-other.condition.json
```

### Step 3: Update Condition IDs and Component References

Update `data/mods/positioning/conditions/entity-in-facing-away.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:entity-in-facing-away",
  "name": "Entity in Facing Away",
  "description": "Checks if entity is in actor's facing_away list",
  "logic": {
    "in": [
      { "var": "entity" },
      { "var": "actor.components.positioning:facing_away.actors" }
    ]
  }
}
```

Update `data/mods/positioning/conditions/entity-not-in-facing-away.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:entity-not-in-facing-away",
  "name": "Entity Not in Facing Away",
  "description": "Checks if entity is NOT in actor's facing_away list",
  "logic": {
    "!": {
      "in": [
        { "var": "entity" },
        { "var": "actor.components.positioning:facing_away.actors" }
      ]
    }
  }
}
```

Update `data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:actor-in-entity-facing-away",
  "name": "Actor in Entity Facing Away",
  "description": "Checks if actor is in entity's facing_away list",
  "logic": {
    "in": [
      { "var": "actor" },
      { "var": "entity.components.positioning:facing_away.actors" }
    ]
  }
}
```

Update `data/mods/positioning/conditions/actor-is-behind-entity.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:actor-is-behind-entity",
  "name": "Actor is Behind Entity",
  "description": "Checks if actor is behind entity (in their facing_away list)",
  "logic": {
    "in": [
      { "var": "actor" },
      { "var": "entity.components.positioning:facing_away.actors" }
    ]
  }
}
```

Update `data/mods/positioning/conditions/both-actors-facing-each-other.condition.json`:

```json
{
  "$schema": "http://example.com/schemas/condition.schema.json",
  "id": "positioning:both-actors-facing-each-other",
  "name": "Both Actors Facing Each Other",
  "description": "Checks if both actors are facing each other (neither in other's facing_away)",
  "logic": {
    "and": [
      {
        "!": {
          "in": [
            { "var": "entity" },
            { "var": "actor.components.positioning:facing_away.actors" }
          ]
        }
      },
      {
        "!": {
          "in": [
            { "var": "actor" },
            { "var": "entity.components.positioning:facing_away.actors" }
          ]
        }
      }
    ]
  }
}
```

### Step 4: Update Positioning Mod Manifest

Update `data/mods/positioning/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    "components": ["closeness.component.json", "facing_away.component.json"],
    "actions": [
      "get_close.action.json",
      "step_back.action.json",
      "turn_around.action.json",
      "turn_around_to_face.action.json"
    ],
    "rules": [
      "get_close.rule.json",
      "step_back.rule.json",
      "turn_around.rule.json",
      "turn_around_to_face.rule.json"
    ],
    "conditions": [
      "event-is-action-get-close.condition.json",
      "event-is-action-step-back.condition.json",
      "actor-is-in-closeness.condition.json",
      "event-is-action-turn-around.condition.json",
      "event-is-action-turn-around-to-face.condition.json",
      "entity-in-facing-away.condition.json", // Add this
      "entity-not-in-facing-away.condition.json", // Add this
      "actor-in-entity-facing-away.condition.json", // Add this
      "actor-is-behind-entity.condition.json", // Add this
      "both-actors-facing-each-other.condition.json" // Add this
    ],
    "events": [],
    "scopes": [],
    "entities": []
  },
  "metadata": {
    // ... existing metadata ...
    "lastModified": "2024-01-02T05:00:00Z" // Update timestamp
  }
}
```

### Step 5: Update References in Intimacy Mod

Search for usage of these conditions in intimacy mod actions and update references:

```bash
# Search for condition references
grep -r "entity-in-facing-away\|entity-not-in-facing-away\|actor-in-entity-facing-away\|actor-is-behind-entity\|both-actors-facing-each-other" data/mods/intimacy/
```

For each file found, update the condition references from `intimacy:condition-name` to `positioning:condition-name`.

### Step 6: Update Intimacy Mod Manifest

Remove migrated conditions from `data/mods/intimacy/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    "conditions": [
      // Remove the migrated conditions from this array
      // Keep only intimacy-specific conditions
    ]
    // ... other content ...
  }
}
```

### Step 7: Create Migration Validation Script

Create `scripts/validate-conditions-migration.js`:

```javascript
#!/usr/bin/env node

/**
 * @file Validates positioning conditions migration
 * @description Ensures all conditions have been migrated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const MIGRATED_CONDITIONS = [
  'entity-in-facing-away',
  'entity-not-in-facing-away',
  'actor-in-entity-facing-away',
  'actor-is-behind-entity',
  'both-actors-facing-each-other',
];

const OLD_COMPONENT_REF = 'intimacy:facing_away';
const NEW_COMPONENT_REF = 'positioning:facing_away';

async function validateMigration() {
  console.log('🔍 Validating positioning conditions migration...\n');

  const errors = [];

  // Check new condition files exist and are correct
  for (const conditionName of MIGRATED_CONDITIONS) {
    const filePath = `data/mods/positioning/conditions/${conditionName}.condition.json`;

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const condition = JSON.parse(content);

      // Check ID is updated
      if (condition.id !== `positioning:${conditionName}`) {
        errors.push(`${conditionName} has wrong ID: ${condition.id}`);
      }

      // Check component references are updated
      if (content.includes(OLD_COMPONENT_REF)) {
        errors.push(`${conditionName} still contains old component reference`);
      }

      if (!content.includes(NEW_COMPONENT_REF)) {
        errors.push(`${conditionName} missing new component reference`);
      }

      console.log(`✅ ${conditionName} migrated correctly`);
    } catch (error) {
      errors.push(`Failed to read ${conditionName}: ${error.message}`);
    }
  }

  // Check positioning mod manifest includes all conditions
  try {
    const manifestContent = await fs.readFile(
      'data/mods/positioning/mod-manifest.json',
      'utf8'
    );
    const manifest = JSON.parse(manifestContent);

    for (const conditionName of MIGRATED_CONDITIONS) {
      const fileName = `${conditionName}.condition.json`;
      if (!manifest.content.conditions.includes(fileName)) {
        errors.push(`Positioning manifest missing ${fileName}`);
      }
    }

    console.log('✅ Positioning mod manifest updated');
  } catch (error) {
    errors.push(`Failed to validate positioning manifest: ${error.message}`);
  }

  // Check for old references in intimacy mod
  const intimacyFiles = await glob('data/mods/intimacy/**/*.json', {
    ignore: ['**/*.backup'],
  });

  for (const file of intimacyFiles) {
    const content = await fs.readFile(file, 'utf8');

    for (const conditionName of MIGRATED_CONDITIONS) {
      const oldRef = `intimacy:${conditionName}`;
      if (content.includes(oldRef)) {
        errors.push(`${file} still references ${oldRef}`);
      }
    }
  }

  // Check old condition files are removed
  for (const conditionName of MIGRATED_CONDITIONS) {
    const oldPath = `data/mods/intimacy/conditions/${conditionName}.condition.json`;
    try {
      await fs.access(oldPath);
      console.log(
        `⚠️  Warning: Old condition file still exists: ${conditionName}`
      );
    } catch {
      console.log(`✅ Old condition file removed: ${conditionName}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌ Validation failed:');
    errors.forEach((err) => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✨ Conditions migration validation passed!');
  }
}

validateMigration().catch(console.error);
```

### Step 8: Remove Original Condition Files

After validation passes:

```bash
# Remove original files
rm data/mods/intimacy/conditions/entity-in-facing-away.condition.json
rm data/mods/intimacy/conditions/entity-not-in-facing-away.condition.json
rm data/mods/intimacy/conditions/actor-in-entity-facing-away.condition.json
rm data/mods/intimacy/conditions/actor-is-behind-entity.condition.json
rm data/mods/intimacy/conditions/both-actors-facing-each-other.condition.json

# Keep backups for safety
```

## Validation Steps

### 1. Run Migration Validation

```bash
node scripts/validate-conditions-migration.js
```

### 2. Schema Validation

```bash
# Validate all migrated conditions
for file in data/mods/positioning/conditions/*.condition.json; do
  echo "Validating $(basename "$file")..."
  npx ajv validate -s data/schemas/condition.schema.json -d "$file"
done
```

### 3. Test Condition Logic

Create a simple test script to verify condition logic:

```javascript
// test-conditions.js
import { JsonLogicEngine } from '../src/logic/jsonLogicEngine.js';

const engine = new JsonLogicEngine();

// Test data
const testData = {
  actor: {
    components: {
      'positioning:facing_away': {
        actors: ['entity1', 'entity2'],
      },
    },
  },
  entity: 'entity1',
};

// Test each condition
const conditions = [
  { name: 'entity-in-facing-away', expected: true },
  { name: 'entity-not-in-facing-away', expected: false },
];

for (const { name, expected } of conditions) {
  const condition = JSON.parse(
    fs.readFileSync(
      `data/mods/positioning/conditions/${name}.condition.json`,
      'utf8'
    )
  );

  const result = engine.apply(condition.logic, testData);
  console.log(`${name}: ${result === expected ? '✅' : '❌'}`);
}
```

### 4. Run All Tests

```bash
npm run test:ci
```

## Common Issues and Solutions

### Issue 1: JSON Logic Path Errors

**Problem**: Condition logic fails due to incorrect component paths.

**Solution**: Ensure all paths use `positioning:facing_away` format.

### Issue 2: Missing Dependencies

**Problem**: Conditions reference components not available.

**Solution**: Verify all component migrations completed first.

### Issue 3: Circular References

**Problem**: Condition references create circular dependencies.

**Solution**: Ensure conditions only reference components, not other conditions.

## Rollback Plan

If migration fails:

1. Restore condition files from backups
2. Revert manifest changes
3. Re-run validation to ensure system stability

## Completion Checklist

- [ ] All remaining positioning conditions identified
- [ ] Condition files copied to positioning mod
- [ ] All condition IDs updated to positioning namespace
- [ ] Component references updated in condition logic
- [ ] Positioning mod manifest updated
- [ ] Intimacy mod manifest updated
- [ ] References in actions updated
- [ ] Validation script created and passing
- [ ] Schema validation passing
- [ ] Logic testing completed
- [ ] All tests passing
- [ ] Original files removed
- [ ] Migration documented

## Next Steps

After successful migration:

- POSMIG-09: Migrate Positioning Events
- Continue with supporting file migrations

## Notes for Implementer

- These conditions use JSON Logic syntax - be careful with path updates
- Test condition logic thoroughly with sample data
- Some conditions may be used in complex action requirements
- Pay attention to negation logic (!) in conditions
- Consider adding debug logging for condition evaluation
- Update any documentation that references these conditions
