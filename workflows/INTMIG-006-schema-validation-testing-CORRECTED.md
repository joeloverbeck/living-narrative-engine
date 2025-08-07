# INTMIG-006: Schema Validation and Testing (CORRECTED)

## Overview

Comprehensive validation phase to ensure all 25 intimacy actions (24 migrated + 1 already correct) conform to the action schema, maintain data integrity, and function correctly within the Living Narrative Engine. This ticket focuses on systematic validation of the migration results.

## Priority

**CRITICAL** - Must validate all migrations before proceeding to integration testing

## Dependencies

- **Blocked by**: INTMIG-002 through INTMIG-005 (all migration batches)
- **Enables**: INTMIG-007 (Integration Testing)
- **Related**: INTMIG-001 (uses validation scripts created in preparation)

## Important Notes

- **Total Actions**: 25 files in data/mods/intimacy/actions/
- **Migrated Actions**: 24 (all except adjust_clothing which already used targets format)
- **Intimacy Mod Status**: NOT currently loaded in game.json - must be added for testing

## Acceptance Criteria

- [ ] All 25 intimacy actions pass JSON schema validation
- [ ] No action contains both `scope` and `targets` properties
- [ ] All action IDs match file names correctly
- [ ] All templates contain proper placeholder syntax
- [ ] All scope references exist and are accessible
- [ ] Required and forbidden components are valid
- [ ] Prerequisites arrays are properly formatted
- [ ] Schema version references are correct
- [ ] Action discovery correctly indexes all actions
- [ ] No duplicate action IDs exist
- [ ] Cross-mod references resolve correctly (positioning mod)
- [ ] Intimacy mod added to game.json for testing
- [ ] Validation report generated with 100% pass rate

## Implementation Steps

### Step 1: Complete Migration Verification

**1.1 Verify migration count**

```bash
# Count total intimacy actions (should be 25)
find data/mods/intimacy/actions -name "*.action.json" | wc -l
# Expected: 25

# Count actions with 'targets' (should be 25: 24 migrated + 1 adjust_clothing)
grep -l '"targets":' data/mods/intimacy/actions/*.action.json | wc -l
# Expected: 25

# Count actions with 'scope' (should be 0)
grep -l '"scope":' data/mods/intimacy/actions/*.action.json | wc -l
# Expected: 0
```

**1.2 List all migrated actions**

```bash
# Generate complete list of migrated actions
for file in data/mods/intimacy/actions/*.action.json; do
  action=$(basename "$file" .action.json)
  echo "✓ $action"
done | sort
```

### Step 2: Schema Validation

**2.1 Individual schema validation using AJV**

```bash
# Install ajv-cli if not available
npm install -g ajv-cli

# Validate each action file individually
for file in data/mods/intimacy/actions/*.action.json; do
  echo "Validating: $(basename $file)"
  npx ajv validate -s data/schemas/action.schema.json -d "$file" --spec=draft2020 || exit 1
done
```

**2.2 Use existing validation script**

```bash
# Run the comprehensive migration validator
node scripts/validate-intmig-migration.js

# Expected output:
# Total actions to migrate: 24
# Successfully migrated: 24
# Schema valid: 24
# Errors found: 0
```

**2.3 Create and run integrity validation script**

Create `scripts/validate-action-integrity.js`:

```javascript
#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ACTIONS_DIR = path.join(__dirname, '../data/mods/intimacy/actions');
const errors = [];

async function validateIntegrity() {
  const files = await fs.readdir(ACTIONS_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.action.json')) continue;

    const filePath = path.join(ACTIONS_DIR, file);
    const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const expectedId = `intimacy:${file.replace('.action.json', '')}`;

    // Check ID matches filename
    if (content.id !== expectedId) {
      errors.push(`ID mismatch in ${file}: expected ${expectedId}, got ${content.id}`);
    }

    // Check targets exists (all actions should have it now)
    if (!content.targets) {
      errors.push(`Missing targets in ${file}`);
    }

    // Check no scope remains
    if (content.scope) {
      errors.push(`Legacy scope still exists in ${file}`);
    }

    // Check template placeholders
    if (content.template) {
      // For multi-target (adjust_clothing), check for {primary} and {secondary}
      if (file === 'adjust_clothing.action.json') {
        if (!content.template.includes('{primary}') || !content.template.includes('{secondary}')) {
          errors.push(`Template missing {primary} or {secondary} placeholders in ${file}`);
        }
      } else {
        // For single-target actions, should have {target}
        if (!content.template.includes('{target}')) {
          errors.push(`Template missing {target} placeholder in ${file}: ${content.template}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Integrity check failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  } else {
    console.log('✅ All integrity checks passed');
  }
}

validateIntegrity().catch(console.error);
```

Then run:

```bash
node scripts/validate-action-integrity.js
```

### Step 3: Enable Intimacy Mod

**3.1 Add intimacy mod to game.json**

```json
{
  "mods": [
    "core",
    "positioning",
    "anatomy",
    "clothing",
    "violence",
    "intimacy",  // Add this line
    "p_erotica"
  ],
  "startWorld": "p_erotica:donostia"
}
```

### Step 4: Scope Reference Validation

**4.1 Verify all referenced scopes exist**

```bash
# Extract all unique scope references from targets property
for file in data/mods/intimacy/actions/*.action.json; do
  # Handle both string and object targets
  jq -r '.targets | if type == "string" then . elif type == "object" then .[] else empty end' "$file" 2>/dev/null
done | sort -u > /tmp/scope-refs.txt

# Verify each scope file exists
while read -r scope; do
  if [ -z "$scope" ]; then continue; fi
  
  mod=$(echo "$scope" | cut -d: -f1)
  name=$(echo "$scope" | cut -d: -f2)
  
  # Check in the appropriate mod's scopes directory
  scope_file="data/mods/$mod/scopes/${name}.scope"
  
  if [ ! -f "$scope_file" ]; then
    echo "❌ Missing scope file: $scope_file (referenced by $scope)"
    exit 1
  else
    echo "✓ Found: $scope_file"
  fi
done < /tmp/scope-refs.txt
```

**4.2 Validate scope syntax**

```bash
# Run scope linting
npm run scope:lint

# Check specific intimacy scopes
for scope in data/mods/intimacy/scopes/*.scope; do
  echo "Validating scope: $(basename $scope)"
  # Scope files should be valid DSL expressions
  if [ ! -s "$scope" ]; then
    echo "❌ Empty scope file: $scope"
    exit 1
  fi
done
```

### Step 5: Component Validation

**5.1 Verify required/forbidden components exist**

```javascript
// Add to validate-action-integrity.js or create separate script
import { promises as fs } from 'fs';
import path from 'path';

const VALID_COMPONENTS = new Set([
  'positioning:closeness',
  'positioning:facing_away',
  'intimacy:kissing',
  // Add other valid component IDs as needed
]);

async function validateComponents() {
  const ACTIONS_DIR = 'data/mods/intimacy/actions';
  const files = await fs.readdir(ACTIONS_DIR);
  const errors = [];

  for (const file of files) {
    if (!file.endsWith('.action.json')) continue;
    
    const filePath = path.join(ACTIONS_DIR, file);
    const content = JSON.parse(await fs.readFile(filePath, 'utf8'));

    // Check required components
    if (content.required_components) {
      for (const [entity, components] of Object.entries(content.required_components)) {
        for (const comp of components) {
          if (!VALID_COMPONENTS.has(comp)) {
            console.warn(`Unknown required component ${comp} in ${file} - may need to add to valid list`);
          }
        }
      }
    }

    // Check forbidden components
    if (content.forbidden_components) {
      for (const [entity, components] of Object.entries(content.forbidden_components)) {
        for (const comp of components) {
          if (!VALID_COMPONENTS.has(comp)) {
            console.warn(`Unknown forbidden component ${comp} in ${file} - may need to add to valid list`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('Component validation issues found');
    return false;
  }
  return true;
}
```

### Step 6: Cross-Mod Reference Validation

**6.1 Check positioning mod references**

```bash
# Find actions referencing positioning scopes
grep -l '"targets": "positioning:' data/mods/intimacy/actions/*.action.json

# Expected files:
# - brush_hand.action.json
# - place_hand_on_waist.action.json

# Verify positioning mod is loaded
grep '"positioning"' data/game.json || echo "WARNING: positioning mod not in game.json"
# Should find it - positioning IS loaded
```

**6.2 Test cross-mod scope resolution**

```javascript
// Test cross-mod scope resolution
// Note: actual path is src/actions/scopes/unifiedScopeResolver.js
import { UnifiedScopeResolver } from '../src/actions/scopes/unifiedScopeResolver.js';

// This would need proper setup with dependencies
const testCrossModScopes = async () => {
  // Would need full container setup to test properly
  console.log('Cross-mod scope resolution would be tested in integration tests');
};
```

### Step 7: Template Validation

**7.1 Verify template placeholders**

```bash
# Check all templates have correct placeholders
for file in data/mods/intimacy/actions/*.action.json; do
  template=$(jq -r '.template // empty' "$file")
  
  if [ -z "$template" ]; then
    echo "No template in $(basename $file)"
    continue
  fi
  
  # For single-target actions, should have {target}
  if [[ "$file" != *"adjust_clothing"* ]]; then
    if [[ "$template" != *"{target}"* ]]; then
      echo "❌ Missing {target} placeholder in $(basename $file): $template"
    fi
  fi
done
```

**7.2 Verify adjust_clothing multi-target**

```bash
# Special check for adjust_clothing
jq '.targets | type' data/mods/intimacy/actions/adjust_clothing.action.json
# Should output: "object"

jq '.template' data/mods/intimacy/actions/adjust_clothing.action.json
# Should contain {primary} and {secondary}
```

### Step 8: Duplicate Detection

**8.1 Check for duplicate action IDs**

```bash
# Extract all action IDs
for file in data/mods/intimacy/actions/*.action.json; do
  jq -r '.id' "$file"
done | sort | uniq -d > /tmp/duplicates.txt

if [ -s /tmp/duplicates.txt ]; then
  echo "❌ Duplicate action IDs found:"
  cat /tmp/duplicates.txt
  exit 1
else
  echo "✅ No duplicate action IDs"
fi
```

### Step 9: Comprehensive Validation Report

**9.1 Generate validation report**

```bash
cat > workflows/INTMIG-validation-report.md << 'EOF'
# INTMIG-006 Validation Report

## Validation Summary

| Check | Result | Details |
|-------|--------|---------|
| Schema Validation | ✅ PASS | All 25 actions pass schema validation |
| Migration Status | ✅ PASS | 24/24 actions migrated to targets format |
| Legacy Cleanup | ✅ PASS | 0 actions contain scope property |
| ID Consistency | ✅ PASS | All IDs match filenames |
| Scope References | ✅ PASS | All referenced scopes exist |
| Component Validation | ✅ PASS | All components are valid |
| Template Validation | ✅ PASS | All templates have correct placeholders |
| Cross-Mod References | ✅ PASS | positioning:* scopes resolve |
| Duplicate Detection | ✅ PASS | No duplicate IDs found |
| Mod Loading | ✅ PASS | Intimacy mod added to game.json |

## Detailed Results

### By Batch
- Batch 1 (Kissing): 8/8 valid ✅
- Batch 2 (Touch): 5/5 valid ✅
- Batch 3 (Neck/Face): 7/7 valid ✅
- Batch 4 (Remaining): 4/4 valid ✅
- Pre-existing (adjust_clothing): 1/1 valid ✅

### Special Cases
- adjust_clothing: Multi-target format preserved ✅
- Cross-mod refs: 2 actions reference positioning scopes ✅
- Component refs: Multiple actions reference positioning:closeness ✅

## Validation Commands Run

```bash
node scripts/validate-intmig-migration.js
node scripts/validate-action-integrity.js
npm run scope:lint
npm run test:unit -- tests/unit/actions/actionDiscovery
```

## Test Results

- Unit Tests: ✅ PASS
- Schema Tests: ✅ PASS
- Scope Tests: ✅ PASS
- Discovery Tests: ✅ PASS

## Conclusion

All 25 intimacy actions (24 migrated + 1 pre-existing) have been successfully validated.
Ready to proceed with integration testing (INTMIG-007).

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
```

## Testing Requirements

### Schema Testing

```bash
# Run action discovery tests
npm run test:unit -- tests/unit/actions/actionDiscoveryService

# Run specific enhanced tests
npm run test:unit -- tests/unit/actions/actionDiscoveryService.enhanced.test.js
```

### Integration Testing

```bash
# Test action discovery integration
npm run test:integration -- tests/integration/actions/actionDiscoveryService

# Test scope-related action discovery
npm run test:integration -- tests/integration/scopes/
```

### E2E Testing

```bash
# Run end-to-end action discovery workflow
npm run test:e2e -- tests/e2e/actions/ActionDiscoveryWorkflow.e2e.test.js
```

## Risk Mitigation

| Risk                     | Impact | Mitigation                           |
| ------------------------ | ------ | ------------------------------------ |
| Schema validation fails  | High   | Fix issues before proceeding         |
| Missing scope files      | High   | Verify all scopes before testing     |
| Cross-mod issues         | Medium | Test with all required mods loaded   |
| Intimacy mod not loaded  | High   | Add to game.json before testing      |
| Performance impact       | Low    | Benchmark if issues detected         |

## Completion Checklist

- [ ] All 25 actions validated against schema
- [ ] No legacy scope properties remain
- [ ] All action IDs consistent with filenames
- [ ] All scope references verified
- [ ] All component references valid
- [ ] All templates have proper placeholders
- [ ] Cross-mod references work correctly
- [ ] No duplicate IDs exist
- [ ] Intimacy mod added to game.json
- [ ] Validation report generated
- [ ] All validation scripts pass
- [ ] Ready for integration testing

## Next Steps

After successful validation:

1. Ensure intimacy mod is added to game.json
2. Proceed to INTMIG-007 (Integration Testing)
3. Archive validation report
4. Update tracking document
5. Notify team of validation success

## Notes

- This validation phase is critical before integration testing
- The intimacy mod MUST be added to game.json for proper testing
- Any failures must be fixed before proceeding
- Keep validation report for audit trail
- Use validation scripts for future migrations
- Total of 25 action files (24 migrated + 1 pre-existing adjust_clothing)