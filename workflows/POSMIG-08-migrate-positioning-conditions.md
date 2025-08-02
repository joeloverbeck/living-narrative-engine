# POSMIG-08: Migrate Positioning Conditions

## Overview

Migrate remaining positioning-related conditions from the intimacy mod to the positioning mod. This includes conditions that check entity relationships, facing directions, and positioning states. 

**IMPORTANT NOTE**: Many of these conditions already exist in the positioning mod or use correct component references. The main migration work involves namespace changes and updating cross-mod references rather than fixing component paths.

## Current State Analysis (As of Analysis Date)

### ✅ Already Correctly Implemented
- All intimacy mod conditions already use correct `positioning:facing_away.facing_away_from` component references
- `actor-is-behind-entity` and `both-actors-facing-each-other` already exist in positioning mod
- Component data model is consistent (`facing_away_from` array property)

### ⚠️ Needs Attention  
- Namespace changes: conditions still have `intimacy:` IDs, need `positioning:` IDs
- Cross-mod references: intimacy scopes, sex mod scopes reference old `intimacy:` condition IDs
- Manifest coordination: some conditions exist in both mods causing potential conflicts

### 🔧 Migration Focus
- **Primary**: Namespace changes and reference updates
- **Secondary**: Manifest cleanup and coordination  
- **Not Needed**: Component path fixes (already correct)

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

**To Be Migrated** (namespace change from intimacy: to positioning:):

- `entity-in-facing-away.condition.json` ⚠️ Currently uses correct component references
- `entity-not-in-facing-away.condition.json` ⚠️ Currently uses correct component references  
- `actor-in-entity-facing-away.condition.json` ⚠️ Currently uses correct component references
- `actor-is-behind-entity.condition.json` ✅ Already exists in positioning mod
- `both-actors-facing-each-other.condition.json` ⚠️ Exists in BOTH mods - need reference coordination

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
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:entity-in-facing-away",
  "description": "Checks if the entity is in the actor's facing_away_from array (i.e., the actor is facing away from this entity).",
  "logic": {
    "in": [
      { "var": "entity.id" },
      { "var": "actor.components.positioning:facing_away.facing_away_from" }
    ]
  }
}
```

Update `data/mods/positioning/conditions/entity-not-in-facing-away.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:entity-not-in-facing-away",
  "description": "Checks if the actor is not in the entity's facing_away_from array (i.e., the entity is not facing away from the actor).",
  "logic": {
    "not": {
      "in": [
        { "var": "actor.id" },
        { "var": "entity.components.positioning:facing_away.facing_away_from" }
      ]
    }
  }
}
```

Update `data/mods/positioning/conditions/actor-in-entity-facing-away.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:actor-in-entity-facing-away",
  "description": "Checks if the actor is in the entity's facing_away_from array (i.e., the entity is facing away from the actor).",
  "logic": {
    "in": [
      { "var": "actor.id" },
      { "var": "entity.components.positioning:facing_away.facing_away_from" }
    ]
  }
}
```

**NOTE**: `actor-is-behind-entity.condition.json` already exists in positioning mod with correct implementation. Verify it matches:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:actor-is-behind-entity",
  "description": "Checks if the actor is behind the entity (actor's id is in the entity's facing_away_from array).",
  "logic": {
    "in": [
      { "var": "actor.id" },
      { "var": "entity.components.positioning:facing_away.facing_away_from" }
    ]
  }
}
```

**NOTE**: `both-actors-facing-each-other.condition.json` already exists in positioning mod with correct implementation. Verify it matches:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:both-actors-facing-each-other",
  "description": "Checks if both actors are facing each other (neither is facing away from the other).",
  "logic": {
    "and": [
      {
        "not": {
          "in": [
            { "var": "entity.id" },
            { "var": "actor.components.positioning:facing_away.facing_away_from" }
          ]
        }
      },
      {
        "not": {
          "in": [
            { "var": "actor.id" },
            { "var": "entity.components.positioning:facing_away.facing_away_from" }
          ]
        }
      }
    ]
  }
}
```

### Step 4: Update Positioning Mod Manifest

**NOTE**: Many conditions already exist. Add only the missing ones:

Update `data/mods/positioning/mod-manifest.json`:

```json
{
  "content": {
    "conditions": [
      "actor-is-behind-entity.condition.json", // Already exists
      "actor-is-in-closeness.condition.json", // Already exists
      "both-actors-facing-each-other.condition.json", // Already exists
      "event-is-action-get-close.condition.json", // Already exists
      "event-is-action-kneel-before.condition.json", // Already exists
      "event-is-action-step-back.condition.json", // Already exists
      "event-is-action-turn-around.condition.json", // Already exists
      "event-is-action-turn-around-to-face.condition.json", // Already exists
      "entity-in-facing-away.condition.json", // ADD THIS
      "entity-not-in-facing-away.condition.json", // ADD THIS
      "actor-in-entity-facing-away.condition.json" // ADD THIS
    ]
    // ... rest of manifest unchanged ...
  }
}
```

### Step 5: Update Cross-Mod References

**CRITICAL**: Multiple mods reference these conditions. Update ALL references:

#### 5.1 Intimacy Mod Scope References
Update references in these files from `intimacy:` to `positioning:`:

- `data/mods/intimacy/scopes/close_actors_facing_away.scope`
- `data/mods/intimacy/scopes/close_actors_facing_each_other.scope` 
- `data/mods/intimacy/scopes/actors_with_arms_facing_each_other_or_behind_target.scope`
- `data/mods/intimacy/scopes/close_actors_facing_each_other_with_torso_clothing.scope`
- `data/mods/intimacy/scopes/actors_with_arms_facing_each_other.scope`
- `data/mods/intimacy/scopes/actors_with_muscular_arms_facing_each_other_or_behind_target.scope`
- `data/mods/intimacy/scopes/actors_with_ass_cheeks_facing_each_other.scope`
- `data/mods/intimacy/scopes/actors_with_mouth_facing_each_other.scope`
- `data/mods/intimacy/scopes/actors_with_ass_cheeks_facing_each_other_or_behind_target.scope`

#### 5.2 Sex Mod References
Update these sex mod scopes from `intimacy:entity-not-in-facing-away` to `positioning:entity-not-in-facing-away`:

- `data/mods/sex/scopes/actors_with_breasts_facing_each_other.scope`
- `data/mods/sex/scopes/actors_with_vagina_facing_each_other_covered.scope`
- `data/mods/sex/scopes/actors_with_penis_facing_each_other_covered.scope`
- `data/mods/sex/scopes/actors_with_penis_facing_each_other.scope`

#### 5.3 Search Command
```bash
# Search for all condition references across mods
grep -r "intimacy:entity-in-facing-away\|intimacy:entity-not-in-facing-away\|intimacy:actor-in-entity-facing-away\|intimacy:both-actors-facing-each-other" data/mods/
```

### Step 6: Update Intimacy Mod Manifest

Remove migrated conditions from `data/mods/intimacy/mod-manifest.json`:

```json
{
  "content": {
    "conditions": [
      // REMOVE these migrated conditions:
      // "actor-in-entity-facing-away.condition.json",
      // "actor-is-behind-entity.condition.json", 
      // "both-actors-facing-each-other.condition.json",
      // "entity-in-facing-away.condition.json",
      // "entity-not-in-facing-away.condition.json",
      
      // KEEP intimacy-specific conditions:
      "actor-is-kiss-receiver.condition.json",
      "event-is-action-accept-kiss-passively.condition.json",
      "event-is-action-adjust-clothing.condition.json",
      // ... all other intimacy-specific conditions ...
      "target-is-kissing-partner.condition.json"
    ]
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

const OLD_COMPONENT_REF = 'intimacy:facing_away.facing_away_from';
const NEW_COMPONENT_REF = 'positioning:facing_away.facing_away_from';

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

      // Check component references are updated (they should already be correct)
      if (!content.includes('positioning:facing_away.facing_away_from')) {
        errors.push(`${conditionName} missing correct component reference`);
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

  // Check for old references across all mods
  const allModFiles = await glob('data/mods/**/*.{json,scope}', {
    ignore: ['**/*.backup'],
  });

  for (const file of allModFiles) {
    const content = await fs.readFile(file, 'utf8');

    for (const conditionName of MIGRATED_CONDITIONS) {
      const oldRef = `intimacy:${conditionName}`;
      if (content.includes(oldRef)) {
        errors.push(`${file} still references ${oldRef}`);
      }
    }
  }

  // Check for cross-mod reference updates in sex mod
  const sexScopeFiles = await glob('data/mods/sex/scopes/*.scope');
  for (const file of sexScopeFiles) {
    const content = await fs.readFile(file, 'utf8');
    if (content.includes('intimacy:entity-not-in-facing-away')) {
      errors.push(`${file} still references intimacy:entity-not-in-facing-away`);
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
    id: 'actor1',
    components: {
      'positioning:facing_away': {
        facing_away_from: ['entity1', 'entity2'],
      },
    },
  },
  entity: {
    id: 'entity1',
    components: {
      'positioning:facing_away': {
        facing_away_from: ['actor1'],
      },
    },
  },
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

**Solution**: Ensure all paths use `positioning:facing_away.facing_away_from` format with proper `.id` references.

### Issue 2: Duplicate Condition Conflicts

**Problem**: Conditions exist in both intimacy and positioning mods.

**Solution**: Remove from intimacy mod only after all references are updated.

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

- **CRITICAL**: Component property is `facing_away_from`, NOT `actors`
- **CRITICAL**: Always use `.id` when referencing entity/actor variables
- Test condition logic thoroughly with realistic data including entity IDs
- Multiple cross-mod references exist - update ALL mods, not just intimacy
- Pay attention to negation logic (`not` vs `!`) - use consistent format
- Sex mod also references these conditions and must be updated
- Consider adding debug logging for condition evaluation
- Update any documentation that references these conditions
