# POSMIG-10: Migrate Positioning Scopes

## Overview

Migrate positioning-related scopes from the intimacy mod to the positioning mod. Scopes that specifically deal with closeness circles and facing directions belong in the positioning mod, while complex scopes that combine positioning with intimacy features should remain in the intimacy mod but be updated to reference the new positioning components.

## Priority

**Medium** - Scopes are query definitions that need positioning component references updated.

## Dependencies

- POSMIG-01: Create Positioning Mod Infrastructure (completed)
- POSMIG-02: Update Build and Test Infrastructure (completed)
- POSMIG-03: Migrate Closeness Component (completed)
- POSMIG-04: Migrate Facing Away Component (completed)

## Estimated Effort

**2-3 hours** (careful analysis of which scopes to migrate vs update)

## Acceptance Criteria

1. ✅ Core positioning scopes moved to positioning mod
2. ✅ Scope definitions updated to use positioning component references
3. ✅ Complex intimacy scopes updated to reference positioning components
4. ✅ Scope validation passing
5. ✅ Mod manifests updated
6. ✅ No broken scope references
7. ✅ Migration documented

## Implementation Steps

### Step 1: Analyze Scopes for Migration

**Scopes to MIGRATE to positioning mod** (pure positioning logic):

- `close_actors.scope` - Returns actors in closeness circle
- `actors_im_facing_away_from.scope` - Returns actors entity is facing away from

**Scopes to UPDATE in intimacy mod** (mixed positioning + intimacy):

- `close_actors_facing_away.scope`
- `close_actors_facing_each_other.scope`
- `actors_with_arms_facing_each_other_or_behind_target.scope`
- `actors_with_arms_in_intimacy.scope`
- `close_actors_facing_each_other_with_torso_clothing.scope`
- `actors_with_arms_facing_each_other.scope`
- `actors_with_ass_cheeks_in_intimacy.scope`
- `actors_with_muscular_arms_facing_each_other_or_behind_target.scope`
- `close_actors_facing_each_other_or_behind_target.scope`
- `actors_with_ass_cheeks_facing_each_other_or_behind_target.scope`
- `actors_with_ass_cheeks_facing_each_other.scope`
- `actors_with_mouth_facing_each_other.scope`

### Step 2: Migrate Core Positioning Scopes

```bash
# Create backups
cp data/mods/intimacy/scopes/close_actors.scope \
   data/mods/intimacy/scopes/close_actors.scope.backup

cp data/mods/intimacy/scopes/actors_im_facing_away_from.scope \
   data/mods/intimacy/scopes/actors_im_facing_away_from.scope.backup

# Copy to positioning mod
cp data/mods/intimacy/scopes/close_actors.scope \
   data/mods/positioning/scopes/close_actors.scope

cp data/mods/intimacy/scopes/actors_im_facing_away_from.scope \
   data/mods/positioning/scopes/actors_im_facing_away_from.scope
```

### Step 3: Update Migrated Scope Definitions

Update `data/mods/positioning/scopes/close_actors.scope`:

```
# Close Actors Scope
# Returns all actors in the same closeness circle as the current actor

actor.components.positioning:closeness.partners[]
```

Update `data/mods/positioning/scopes/actors_im_facing_away_from.scope`:

```
# Actors I'm Facing Away From Scope
# Returns all actors that the current entity is facing away from

actor.components.positioning:facing_away.actors[]
```

### Step 4: Update Intimacy Scopes to Reference Positioning Components

Update `data/mods/intimacy/scopes/close_actors_facing_away.scope`:

```
# Close Actors Facing Away Scope
# Returns close actors who are facing away from each other

actor.components.positioning:closeness.partners[{
  "in": [
    "actor",
    {"var": "item.components.positioning:facing_away.actors"}
  ]
}]
```

Update `data/mods/intimacy/scopes/close_actors_facing_each_other.scope`:

```
# Close Actors Facing Each Other Scope
# Returns close actors who are facing each other (not in each other's facing_away)

actor.components.positioning:closeness.partners[{
  "and": [
    {
      "!": {
        "in": [
          "actor",
          {"var": "item.components.positioning:facing_away.actors"}
        ]
      }
    },
    {
      "!": {
        "in": [
          {"var": "item"},
          {"var": "actor.components.positioning:facing_away.actors"}
        ]
      }
    }
  ]
}]
```

Update `data/mods/intimacy/scopes/actors_with_arms_facing_each_other_or_behind_target.scope`:

```
# Actors with Arms Facing Each Other or Behind Target
# Complex scope combining positioning with body part detection

actor.components.positioning:closeness.partners[{
  "and": [
    {"==": [{"var": "item.components.intimacy:arms.state"}, "visible"]},
    {
      "or": [
        {
          "and": [
            {
              "!": {
                "in": [
                  "actor",
                  {"var": "item.components.positioning:facing_away.actors"}
                ]
              }
            },
            {
              "!": {
                "in": [
                  {"var": "item"},
                  {"var": "actor.components.positioning:facing_away.actors"}
                ]
              }
            }
          ]
        },
        {
          "in": [
            "actor",
            {"var": "item.components.positioning:facing_away.actors"}
          ]
        }
      ]
    }
  ]
}]
```

Update all other intimacy scopes similarly, replacing:

- `intimacy:closeness` → `positioning:closeness`
- `intimacy:facing_away` → `positioning:facing_away`

### Step 5: Update Positioning Mod Manifest

Update `data/mods/positioning/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    // ... other content ...
    "scopes": ["close_actors.scope", "actors_im_facing_away_from.scope"]
    // ... rest of content ...
  },
  "metadata": {
    // ... existing metadata ...
    "lastModified": "2024-01-02T07:00:00Z"
  }
}
```

### Step 6: Update Intimacy Mod Manifest

Remove migrated scopes from `data/mods/intimacy/mod-manifest.json`:

```json
{
  // ... existing content ...
  "content": {
    // ... other content ...
    "scopes": [
      // Remove "close_actors.scope" and "actors_im_facing_away_from.scope"
      // Keep all other scopes that use positioning + intimacy features
      "close_actors_facing_away.scope",
      "close_actors_facing_each_other.scope"
      // ... other scopes ...
    ]
  }
}
```

### Step 7: Create Scope Migration Validation Script

Create `scripts/validate-scopes-migration.js`:

````javascript
#!/usr/bin/env node

/**
 * @file Validates positioning scopes migration
 * @description Ensures scopes have been migrated and updated correctly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

const MIGRATED_SCOPES = [
  'close_actors.scope',
  'actors_im_facing_away_from.scope'
];

const OLD_COMPONENT_REFS = [
  'intimacy:closeness',
  'intimacy:facing_away'
];

const NEW_COMPONENT_REFS = [
  'positioning:closeness',
  'positioning:facing_away'
];

async function validateMigration() {
  console.log('🔍 Validating positioning scopes migration...\\n');

  const errors = [];

  // Check migrated scopes exist in positioning mod
  for (const scopeName of MIGRATED_SCOPES) {\n    const filePath = `data/mods/positioning/scopes/${scopeName}`;\n    \n    try {\n      const content = await fs.readFile(filePath, 'utf8');\n      \n      // Check for old component references\n      for (const oldRef of OLD_COMPONENT_REFS) {\n        if (content.includes(oldRef)) {\n          errors.push(`${scopeName} still contains ${oldRef}`);\n        }\n      }\n      \n      // Check for new component references\n      let hasNewRef = false;\n      for (const newRef of NEW_COMPONENT_REFS) {\n        if (content.includes(newRef)) {\n          hasNewRef = true;\n          break;\n        }\n      }\n      \n      if (!hasNewRef) {\n        errors.push(`${scopeName} missing positioning component references`);\n      }\n      \n      console.log(`✅ ${scopeName} migrated correctly`);\n    } catch (error) {\n      errors.push(`Failed to read ${scopeName}: ${error.message}`);\n    }\n  }\n  \n  // Check positioning mod manifest\n  try {\n    const manifestContent = await fs.readFile(\n      'data/mods/positioning/mod-manifest.json',\n      'utf8'\n    );\n    const manifest = JSON.parse(manifestContent);\n    \n    for (const scopeName of MIGRATED_SCOPES) {\n      if (!manifest.content.scopes.includes(scopeName)) {\n        errors.push(`Positioning manifest missing ${scopeName}`);\n      }\n    }\n    \n    console.log('✅ Positioning mod manifest updated');\n  } catch (error) {\n    errors.push(`Failed to validate positioning manifest: ${error.message}`);\n  }\n  \n  // Check intimacy scopes are updated\n  const intimacyScopes = await glob('data/mods/intimacy/scopes/*.scope');\n  \n  for (const scopeFile of intimacyScopes) {\n    const content = await fs.readFile(scopeFile, 'utf8');\n    \n    // Check if still using old component references\n    for (const oldRef of OLD_COMPONENT_REFS) {\n      if (content.includes(oldRef)) {\n        errors.push(`${path.basename(scopeFile)} still uses ${oldRef}`);\n      }\n    }\n  }\n  \n  console.log('✅ Intimacy scopes updated to use positioning components');\n  \n  // Check old scope files are removed\n  for (const scopeName of MIGRATED_SCOPES) {\n    const oldPath = `data/mods/intimacy/scopes/${scopeName}`;\n    try {\n      await fs.access(oldPath);\n      console.log(`⚠️  Warning: Old scope file still exists: ${scopeName}`);\n    } catch {\n      console.log(`✅ Old scope file removed: ${scopeName}`);\n    }\n  }\n  \n  if (errors.length > 0) {\n    console.log('\\n❌ Validation failed:');\n    errors.forEach(err => console.log(`  - ${err}`));\n    process.exit(1);\n  } else {\n    console.log('\\n✨ Scopes migration validation passed!');\n  }\n}\n\nvalidateMigration().catch(console.error);\n```\n\n### Step 8: Test Scope Definitions\n\nCreate a scope testing script to validate syntax:\n\n```javascript\n#!/usr/bin/env node\n\n/**\n * @file Test scope definitions\n * @description Validates scope syntax and component references\n */\n\nimport { ScopeResolver } from '../src/scopeDsl/scopeResolver.js';\nimport { promises as fs } from 'fs';\n\nconst resolver = new ScopeResolver();\n\nasync function testScopes() {\n  console.log('🧪 Testing scope definitions...\\n');\n  \n  const scopes = [\n    'data/mods/positioning/scopes/close_actors.scope',\n    'data/mods/positioning/scopes/actors_im_facing_away_from.scope'\n  ];\n  \n  for (const scopeFile of scopes) {\n    try {\n      const definition = await fs.readFile(scopeFile, 'utf8');\n      const parsed = resolver.parse(definition.trim());\n      \n      console.log(`✅ ${path.basename(scopeFile)} syntax valid`);\n      console.log(`   Definition: ${definition.trim()}`);\n    } catch (error) {\n      console.log(`❌ ${path.basename(scopeFile)} syntax error: ${error.message}`);\n    }\n  }\n}\n\ntestScopes().catch(console.error);\n```\n\n### Step 9: Remove Original Scope Files\n\n```bash\n# Remove original files after validation\nrm data/mods/intimacy/scopes/close_actors.scope\nrm data/mods/intimacy/scopes/actors_im_facing_away_from.scope\n\n# Keep backups for safety\n```\n\n## Validation Steps\n\n### 1. Run Migration Validation\n\n```bash\nnode scripts/validate-scopes-migration.js\n```\n\n### 2. Test Scope Syntax\n\n```bash\nnode scripts/test-scope-definitions.js\n```\n\n### 3. Run Scope Linting\n\n```bash\nnpm run scope:lint\n```\n\n### 4. Test Scope Resolution\n\nCreate test data and verify scopes resolve correctly:\n\n```javascript\n// Test with mock actor data\nconst testActor = {\n  id: 'actor1',\n  components: {\n    'positioning:closeness': {\n      partners: ['actor2', 'actor3']\n    },\n    'positioning:facing_away': {\n      actors: ['actor4']\n    }\n  }\n};\n\n// Test close_actors scope\nconst closeActors = resolver.resolve('close_actors', testActor);\nexpect(closeActors).toEqual(['actor2', 'actor3']);\n\n// Test actors_im_facing_away_from scope\nconst facingAway = resolver.resolve('actors_im_facing_away_from', testActor);\nexpect(facingAway).toEqual(['actor4']);\n```\n\n## Common Issues and Solutions\n\n### Issue 1: Scope Syntax Errors\n\n**Problem**: Scope definitions have syntax errors after component reference updates.\n\n**Solution**: Use the scope testing script to validate syntax before deployment.\n\n### Issue 2: Complex Scope Logic\n\n**Problem**: Intimacy scopes with complex positioning + intimacy logic break.\n\n**Solution**: Test each complex scope individually with sample data.\n\n### Issue 3: Missing Component References\n\n**Problem**: Scopes try to access components that don't exist.\n\n**Solution**: Ensure all component migrations are complete before scope migration.\n\n## Rollback Plan\n\nIf migration fails:\n\n1. Restore scope files from backups\n2. Revert manifest changes\n3. Re-run scope linting to verify syntax\n4. Test scope resolution with sample data\n\n## Completion Checklist\n\n- [ ] Core positioning scopes identified\n- [ ] Scope files copied to positioning mod\n- [ ] Scope definitions updated to use positioning components\n- [ ] Intimacy scopes updated to reference positioning components\n- [ ] Positioning mod manifest updated\n- [ ] Intimacy mod manifest updated\n- [ ] Validation script created and passing\n- [ ] Scope syntax testing completed\n- [ ] Scope linting passing\n- [ ] Scope resolution tested\n- [ ] Original files removed\n- [ ] Migration documented\n\n## Next Steps\n\nAfter successful migration:\n- POSMIG-11: Update Operation Handlers and Services\n- Begin final integration updates\n\n## Notes for Implementer\n\n- Scopes use custom DSL syntax - be careful with updates\n- Test scope resolution with realistic actor data\n- Complex scopes may need component references in multiple places\n- Consider the scope query performance implications\n- Update any documentation that shows scope examples\n- Some scopes may be used in AI prompts or descriptions
````
