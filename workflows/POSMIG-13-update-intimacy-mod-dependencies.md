# POSMIG-13: Update Intimacy Mod Dependencies

## Overview

Update all intimacy mod actions that depend on positioning components to reference the new positioning namespace. This is a critical step to ensure that intimacy actions continue to work after the positioning components have been migrated. The intimacy mod must also be updated to declare its dependency on the positioning mod.

## Priority

**High** - This is essential for maintaining functionality of intimacy actions that require positioning.

## Dependencies

- All component migrations must be completed (POSMIG-03, POSMIG-04)
- All action migrations must be completed (POSMIG-05, POSMIG-06, POSMIG-07)

## Estimated Effort

**3-4 hours** (updating many action files with component dependencies)

## Acceptance Criteria

1. ✅ All intimacy actions updated to reference positioning components
2. ✅ Intimacy mod manifest declares positioning dependency
3. ✅ All forbidden/required component references updated
4. ✅ All condition references in intimacy actions updated
5. ✅ Scope references updated where used in actions
6. ✅ All intimacy actions continue to work correctly
7. ✅ Mod loading order works correctly
8. ✅ No circular dependencies created
9. ✅ All tests passing
10. ✅ Migration documented

## Implementation Steps

### Step 1: Update Intimacy Mod Manifest

Update `data/mods/intimacy/mod-manifest.json` to add positioning dependency:

```json
{
  \"$schema\": \"http://example.com/schemas/mod-manifest.schema.json\",
  \"id\": \"intimacy\",
  \"version\": \"1.0.0\",
  \"name\": \"Intimacy System\",
  \"description\": \"Provides intimate interactions and relationship mechanics\",
  \"author\": \"Living Narrative Engine Team\",
  \"dependencies\": [
    {
      \"id\": \"core\",
      \"version\": \"^1.0.0\"
    },
    {
      \"id\": \"positioning\",  // Add this dependency
      \"version\": \"^1.0.0\"
    }
  ],
  \"content\": {
    // ... existing content (with migrated items removed) ...
  }
}
```

### Step 2: Update Actions That Require Closeness

Based on the migration report, update these actions' `requiredComponents`:

**Actions requiring closeness update:**

1. `lick_lips.action.json`
2. `lean_in_for_deep_kiss.action.json`
3. `thumb_wipe_cheek.action.json`
4. `adjust_clothing.action.json`
5. `massage_back.action.json`
6. `place_hand_on_waist.action.json`
7. `feel_arm_muscles.action.json`
8. `kiss_cheek.action.json`
9. `suck_on_neck_to_leave_hickey.action.json`
10. `massage_shoulders.action.json`
11. `brush_hand.action.json`
12. `fondle_ass.action.json`
13. `nibble_earlobe_playfully.action.json`
14. `nuzzle_face_into_neck.action.json`
15. `kiss_neck_sensually.action.json`
16. `peck_on_lips.action.json`

For each file, update the `requiredComponents` array:

```json
{
  // ... other content ...
  \"requiredComponents\": [
    \"positioning:closeness\",  // Changed from \"intimacy:closeness\"
    // ... other required components ...
  ],
  // ... rest of file ...
}
```

### Step 3: Update Actions With Facing Away Dependencies

Update these actions that reference `facing_away` component:

**`massage_back.action.json`** - Update forbidden components:

```json
{
  // ... other content ...
  \"forbiddenComponents\": [
    {
      \"component\": \"positioning:facing_away\",  // Changed from \"intimacy:facing_away\"
      \"scope\": \"actor.components.positioning:facing_away.actors[]\",
      \"contains\": \"entity\"
    }
  ],
  // ... rest of file ...
}
```

**`place_hand_on_waist.action.json`** - Update forbidden components:

```json
{
  // ... other content ...
  \"forbiddenComponents\": [
    {
      \"component\": \"positioning:facing_away\",  // Changed from \"intimacy:facing_away\"
      \"scope\": \"actor.components.positioning:facing_away.actors[]\",
      \"contains\": \"entity\"
    }
  ],
  // ... rest of file ...
}
```

### Step 4: Update Complex Action Dependencies

Some actions may have complex requirements. For example, actions that require both closeness and specific facing conditions:

```json
{
  // Example complex action
  \"requiredComponents\": [
    \"positioning:closeness\"
  ],
  \"requiredConditions\": [
    \"positioning:both-actors-facing-each-other\"  // Updated condition reference
  ],
  \"forbiddenConditions\": [
    \"positioning:entity-in-facing-away\"  // Updated condition reference
  ]
}
```

### Step 5: Update Action Scope References

Some actions may use scopes in their descriptions or requirements. Update any scope references:

```json
{
  // If actions reference scopes (rare but possible)
  \"description\": \"Perform action on close_actors_facing_each_other\",
  // The scope itself has been updated to use positioning:closeness
}
```

### Step 6: Create Bulk Update Script

Create `scripts/update-intimacy-dependencies.js`:

````javascript
#!/usr/bin/env node

/**
 * @file Updates intimacy mod dependencies to use positioning components
 * @description Bulk updates all intimacy actions to reference positioning components
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';
import path from 'path';

const COMPONENT_UPDATES = {
  'intimacy:closeness': 'positioning:closeness',
  'intimacy:facing_away': 'positioning:facing_away'
};

const CONDITION_UPDATES = {
  'intimacy:both-actors-facing-each-other': 'positioning:both-actors-facing-each-other',
  'intimacy:entity-in-facing-away': 'positioning:entity-in-facing-away',
  'intimacy:entity-not-in-facing-away': 'positioning:entity-not-in-facing-away',
  'intimacy:actor-in-entity-facing-away': 'positioning:actor-in-entity-facing-away',
  'intimacy:actor-is-behind-entity': 'positioning:actor-is-behind-entity',
  'intimacy:actor-is-in-closeness': 'positioning:actor-is-in-closeness'
};

async function updateIntimacyActions() {
  console.log('🔄 Updating intimacy mod dependencies...\\n');

  const actionFiles = await glob('data/mods/intimacy/actions/*.action.json');
  let updatedCount = 0;

  for (const actionFile of actionFiles) {
    let content = await fs.readFile(actionFile, 'utf8');
    let updated = false;

    // Update component references
    for (const [oldRef, newRef] of Object.entries(COMPONENT_UPDATES)) {
      if (content.includes(oldRef)) {
        content = content.replaceAll(oldRef, newRef);
        updated = true;
      }
    }

    // Update condition references
    for (const [oldRef, newRef] of Object.entries(CONDITION_UPDATES)) {
      if (content.includes(oldRef)) {
        content = content.replaceAll(oldRef, newRef);
        updated = true;
      }
    }

    // Update scope paths in component references
    content = content.replace(\n      /actor\\.components\\.intimacy:facing_away/g,\n      'actor.components.positioning:facing_away'\n    );\n    \n    content = content.replace(\n      /entity\\.components\\.intimacy:facing_away/g,\n      'entity.components.positioning:facing_away'\n    );\n    \n    if (updated) {\n      await fs.writeFile(actionFile, content, 'utf8');\n      console.log(`✅ Updated ${path.basename(actionFile)}`);\n      updatedCount++;\n    }\n  }\n  \n  console.log(`\\n📊 Updated ${updatedCount} action files`);\n}\n\nasync function updateIntimacyManifest() {\n  console.log('\\n📋 Updating intimacy mod manifest...');\n  \n  const manifestPath = 'data/mods/intimacy/mod-manifest.json';\n  const manifestContent = await fs.readFile(manifestPath, 'utf8');\n  const manifest = JSON.parse(manifestContent);\n  \n  // Add positioning dependency if not already present\n  const hasPositioningDep = manifest.dependencies.some(dep => dep.id === 'positioning');\n  \n  if (!hasPositioningDep) {\n    manifest.dependencies.push({\n      id: 'positioning',\n      version: '^1.0.0'\n    });\n    \n    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');\n    console.log('✅ Added positioning dependency to intimacy mod manifest');\n  } else {\n    console.log('ℹ️  Positioning dependency already exists in manifest');\n  }\n}\n\nasync function validateUpdates() {\n  console.log('\\n🔍 Validating updates...');\n  \n  const actionFiles = await glob('data/mods/intimacy/actions/*.action.json');\n  const errors = [];\n  \n  for (const actionFile of actionFiles) {\n    const content = await fs.readFile(actionFile, 'utf8');\n    \n    // Check for remaining old references\n    for (const oldRef of Object.keys(COMPONENT_UPDATES)) {\n      if (content.includes(oldRef)) {\n        errors.push(`${path.basename(actionFile)} still contains ${oldRef}`);\n      }\n    }\n    \n    for (const oldRef of Object.keys(CONDITION_UPDATES)) {\n      if (content.includes(oldRef)) {\n        errors.push(`${path.basename(actionFile)} still contains ${oldRef}`);\n      }\n    }\n    \n    // Validate JSON\n    try {\n      JSON.parse(content);\n    } catch (error) {\n      errors.push(`${path.basename(actionFile)} has invalid JSON: ${error.message}`);\n    }\n  }\n  \n  if (errors.length > 0) {\n    console.log('\\n❌ Validation failed:');\n    errors.forEach(err => console.log(`  - ${err}`));\n    process.exit(1);\n  } else {\n    console.log('\\n✨ All updates validated successfully!');\n  }\n}\n\nasync function main() {\n  try {\n    await updateIntimacyActions();\n    await updateIntimacyManifest();\n    await validateUpdates();\n  } catch (error) {\n    console.error('❌ Update failed:', error);\n    process.exit(1);\n  }\n}\n\nmain();\n```\n\n### Step 7: Test Action Availability\n\nCreate a test script to verify actions are still available:\n\n```javascript\n#!/usr/bin/env node\n\n/**\n * @file Test intimacy action availability after dependency updates\n * @description Verifies intimacy actions work with positioning dependencies\n */\n\nimport { TestBed } from '../tests/common/testbed.js';\n\nasync function testActionAvailability() {\n  console.log('🧪 Testing intimacy action availability...\\n');\n  \n  const testBed = new TestBed();\n  \n  try {\n    // Create test actors\n    const actor1Id = testBed.createActor('TestActor1');\n    const actor2Id = testBed.createActor('TestActor2');\n    \n    // Test closeness-dependent actions\n    console.log('Testing actions without closeness...');\n    let actions = await testBed.getAvailableActions(actor1Id, actor2Id);\n    const kissAction = actions.find(a => a.id === 'intimacy:peck_on_lips');\n    \n    if (kissAction) {\n      console.log('❌ Kiss action available without closeness (should not be)');\n    } else {\n      console.log('✅ Kiss action correctly unavailable without closeness');\n    }\n    \n    // Add closeness and test again\n    console.log('\\nTesting actions with closeness...');\n    testBed.createClosenessCircle([actor1Id, actor2Id]);\n    \n    actions = await testBed.getAvailableActions(actor1Id, actor2Id);\n    const kissActionWithCloseness = actions.find(a => a.id === 'intimacy:peck_on_lips');\n    \n    if (kissActionWithCloseness) {\n      console.log('✅ Kiss action available with closeness');\n    } else {\n      console.log('❌ Kiss action not available with closeness (should be)');\n    }\n    \n    // Test facing away restrictions\n    console.log('\\nTesting facing away restrictions...');\n    testBed.setFacingAway(actor1Id, [actor2Id]);\n    \n    actions = await testBed.getAvailableActions(actor1Id, actor2Id);\n    const massageAction = actions.find(a => a.id === 'intimacy:massage_back');\n    \n    if (massageAction) {\n      console.log('❌ Massage back available when facing away (should not be)');\n    } else {\n      console.log('✅ Massage back correctly forbidden when facing away');\n    }\n    \n    console.log('\\n✨ All action availability tests passed!');\n    \n  } catch (error) {\n    console.error('❌ Test failed:', error);\n    process.exit(1);\n  } finally {\n    testBed.cleanup();\n  }\n}\n\ntestActionAvailability();\n```\n\n## Validation Steps\n\n### 1. Run Bulk Update Script\n\n```bash\nnode scripts/update-intimacy-dependencies.js\n```\n\n### 2. Validate JSON Syntax\n\n```bash\n# Validate all updated action files\nfor file in data/mods/intimacy/actions/*.action.json; do\n  echo \"Validating $(basename \"$file\")...\"\n  jq . \"$file\" > /dev/null || echo \"❌ Invalid JSON: $file\"\ndone\n```\n\n### 3. Test Action Availability\n\n```bash\nnode scripts/test-intimacy-action-availability.js\n```\n\n### 4. Run Integration Tests\n\n```bash\n# Test intimacy actions with positioning dependencies\nnpm test tests/integration/mods/intimacy/\n```\n\n### 5. Manual Game Testing\n\n1. Start the game with both mods:\n   ```json\n   {\n     \"mods\": [\"core\", \"positioning\", \"intimacy\"]\n   }\n   ```\n\n2. Test the complete workflow:\n   - Get two actors close\n   - Verify intimate actions become available\n   - Perform intimate actions\n   - Step back and verify actions become unavailable\n   - Test turn around mechanics\n\n## Common Issues and Solutions\n\n### Issue 1: Mod Loading Order\n\n**Problem**: Intimacy mod loads before positioning mod.\n\n**Solution**: Ensure positioning mod has lower loadOrder (50) than intimacy mod (100+).\n\n### Issue 2: Circular Dependencies\n\n**Problem**: Positioning mod somehow references intimacy mod.\n\n**Solution**: Ensure positioning mod has NO dependencies on intimacy mod.\n\n### Issue 3: Action Validation Failures\n\n**Problem**: Actions fail validation due to unknown component references.\n\n**Solution**: Verify all component migrations are complete before updating intimacy actions.\n\n### Issue 4: Complex Component References\n\n**Problem**: Some actions have nested component references in complex conditions.\n\n**Solution**: Search for component references in scope definitions within actions.\n\n## Rollback Plan\n\nIf updates break intimacy functionality:\n\n1. Revert action files:\n   ```bash\n   git checkout -- data/mods/intimacy/actions/\n   ```\n\n2. Revert manifest:\n   ```bash\n   git checkout -- data/mods/intimacy/mod-manifest.json\n   ```\n\n3. Re-run tests to verify system stability\n\n## Completion Checklist\n\n- [ ] Intimacy mod manifest updated with positioning dependency\n- [ ] All actions requiring closeness updated (16 actions)\n- [ ] All actions with facing away dependencies updated (2 actions)\n- [ ] Complex condition references updated\n- [ ] Scope references updated where applicable\n- [ ] Bulk update script created and executed\n- [ ] JSON validation passing\n- [ ] Action availability testing completed\n- [ ] Integration tests passing\n- [ ] Manual game testing completed\n- [ ] No circular dependencies created\n- [ ] Mod loading order verified\n- [ ] Migration documented\n\n## Next Steps\n\nAfter successful dependency updates:\n- POSMIG-14: Comprehensive Testing and Validation\n- Final system validation\n\n## Notes for Implementer\n\n- Use the bulk update script to avoid manual errors\n- Test action availability thoroughly\n- Pay attention to complex component references\n- Verify mod loading order works correctly\n- Update any action descriptions that mention components\n- Consider the user experience - actions should work seamlessly\n- Document any behavior changes for users"

````
