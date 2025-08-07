# INTMIG-006: Schema Validation and Testing

## Overview

Comprehensive validation phase to ensure all 24 migrated intimacy actions conform to the action schema, maintain data integrity, and function correctly within the Living Narrative Engine. This ticket focuses on systematic validation of the migration results.

## Priority

**CRITICAL** - Must validate all migrations before proceeding to integration testing

## Dependencies

- **Blocked by**: INTMIG-002 through INTMIG-005 (all migration batches)
- **Enables**: INTMIG-007 (Integration Testing)
- **Related**: INTMIG-001 (uses validation scripts created in preparation)

## Acceptance Criteria

- [ ] All 24 migrated actions pass JSON schema validation
- [ ] No action contains both `scope` and `targets` properties
- [ ] All action IDs match file names correctly
- [ ] All templates contain proper placeholder syntax
- [ ] All scope references exist and are accessible
- [ ] Required and forbidden components are valid
- [ ] Prerequisites arrays are properly formatted
- [ ] Schema version references are correct
- [ ] Action discovery correctly indexes all actions
- [ ] No duplicate action IDs exist
- [ ] Cross-mod references resolve correctly
- [ ] Validation report generated with 100% pass rate

## Implementation Steps

### Step 1: Complete Migration Verification

**1.1 Verify migration count**

```bash
# Count total intimacy actions (should be 25)
ls -1 data/mods/intimacy/actions/*.action.json | wc -l
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
  if [ "$action" != "adjust_clothing" ]; then
    echo "✓ $action"
  fi
done | sort
```

### Step 2: Schema Validation

**2.1 Individual schema validation**

```bash
# Validate each action file individually
for file in data/mods/intimacy/actions/*.action.json; do
  echo "Validating: $(basename $file)"
  npx ajv validate -s data/schemas/action.schema.json -d "$file" || exit 1
done
```

**2.2 Batch schema validation**

```bash
# Use project's schema validation command
npm run validate:schemas -- --verbose

# Check for any schema errors
if [ $? -ne 0 ]; then
  echo "❌ Schema validation failed!"
  exit 1
fi
```

**2.3 Custom validation script**

```bash
# Run the comprehensive migration validator
node scripts/validate-intmig-migration.js

# Expected output:
# Total actions to migrate: 24
# Successfully migrated: 24
# Schema valid: 24
# Errors found: 0
```

### Step 3: Data Integrity Checks

**3.1 Verify action ID consistency**

```javascript
// Create validation script: scripts/validate-action-integrity.js
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ACTIONS_DIR = 'data/mods/intimacy/actions';
const errors = [];

fs.readdirSync(ACTIONS_DIR).forEach(file => {
  if (!file.endsWith('.action.json')) return;

  const filePath = path.join(ACTIONS_DIR, file);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const expectedId = `intimacy:${file.replace('.action.json', '')}`;

  // Check ID matches filename
  if (content.id !== expectedId) {
    errors.push(`ID mismatch in ${file}: expected ${expectedId}, got ${content.id}`);
  }

  // Check targets exists
  if (!content.targets && file !== 'adjust_clothing.action.json') {
    errors.push(`Missing targets in ${file}`);
  }

  // Check no scope remains
  if (content.scope) {
    errors.push(`Legacy scope still exists in ${file}`);
  }

  // Check template placeholders
  if (content.template && !content.template.includes('{')) {
    errors.push(`Template missing placeholders in ${file}`);
  }
});

if (errors.length > 0) {
  console.error('❌ Integrity check failed:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('✅ All integrity checks passed');
}
```

**3.2 Run integrity validation**

```bash
node scripts/validate-action-integrity.js
```

### Step 4: Scope Reference Validation

**4.1 Verify all referenced scopes exist**

```bash
# Extract all unique scope references
for file in data/mods/intimacy/actions/*.action.json; do
  jq -r '.targets // empty' "$file" 2>/dev/null
done | sort -u > /tmp/scope-refs.txt

# Verify each scope file exists
while read -r scope; do
  mod=$(echo "$scope" | cut -d: -f1)
  name=$(echo "$scope" | cut -d: -f2)
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

**5.1 Verify required/forbidden components**

```javascript
// Add to validation script
const VALID_COMPONENTS = [
  'positioning:closeness',
  'intimacy:kissing',
  // Add all valid component IDs
];

// In validation loop
if (content.required_components) {
  Object.values(content.required_components)
    .flat()
    .forEach((comp) => {
      if (!VALID_COMPONENTS.includes(comp)) {
        errors.push(`Invalid required component ${comp} in ${file}`);
      }
    });
}

if (content.forbidden_components) {
  Object.values(content.forbidden_components)
    .flat()
    .forEach((comp) => {
      if (!VALID_COMPONENTS.includes(comp)) {
        errors.push(`Invalid forbidden component ${comp} in ${file}`);
      }
    });
}
```

### Step 6: Cross-Mod Reference Validation

**6.1 Check positioning mod references**

```bash
# Find actions referencing positioning mod
grep -l '"targets": "positioning:' data/mods/intimacy/actions/*.action.json

# Expected files:
# - brush_hand.action.json
# - place_hand_on_waist.action.json

# Verify positioning mod is loaded
grep '"positioning"' data/game.json || echo "WARNING: positioning mod not in game.json"
```

**6.2 Verify cross-mod scope resolution**

```javascript
// Test cross-mod scope resolution
import { ScopeResolver } from '../src/scopeResolver.js';

const resolver = new ScopeResolver(/* dependencies */);
const crossModScopes = ['positioning:close_actors'];

crossModScopes.forEach((scope) => {
  try {
    const result = resolver.resolve(scope, context);
    console.log(`✓ Cross-mod scope ${scope} resolves correctly`);
  } catch (err) {
    console.error(`❌ Failed to resolve ${scope}: ${err.message}`);
  }
});
```

### Step 7: Template Validation

**7.1 Verify template placeholders**

```bash
# Check all templates have correct placeholders
for file in data/mods/intimacy/actions/*.action.json; do
  template=$(jq -r '.template' "$file")

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
| Schema Validation | ✅ PASS | All 24 actions pass schema validation |
| Migration Status | ✅ PASS | 24/24 actions use targets format |
| Legacy Cleanup | ✅ PASS | 0 actions contain scope property |
| ID Consistency | ✅ PASS | All IDs match filenames |
| Scope References | ✅ PASS | All referenced scopes exist |
| Component Validation | ✅ PASS | All components are valid |
| Template Validation | ✅ PASS | All templates have correct placeholders |
| Cross-Mod References | ✅ PASS | positioning:* scopes resolve |
| Duplicate Detection | ✅ PASS | No duplicate IDs found |

## Detailed Results

### By Batch
- Batch 1 (Kissing): 8/8 valid ✅
- Batch 2 (Touch): 5/5 valid ✅
- Batch 3 (Neck/Face): 7/7 valid ✅
- Batch 4 (Remaining): 4/4 valid ✅

### Special Cases
- adjust_clothing: Multi-target format preserved ✅
- Cross-mod refs: 2 actions reference positioning ✅
- Complex scopes: Long scope names preserved ✅

## Validation Commands Run

\`\`\`bash
npm run validate:schemas
npm run scope:lint
node scripts/validate-intmig-migration.js
node scripts/validate-action-integrity.js
\`\`\`

## Test Results

- Unit Tests: ✅ PASS
- Schema Tests: ✅ PASS
- Scope Tests: ✅ PASS
- Discovery Tests: ✅ PASS

## Conclusion

All 24 intimacy actions have been successfully migrated and validated.
Ready to proceed with integration testing (INTMIG-007).

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
```

## Testing Requirements

### Schema Testing

```bash
# Run schema-specific tests
npm run test:unit -- --testPathPattern="schema" --testNamePattern="action.*validation"
```

### Action Discovery Testing

```bash
# Test that all actions are discoverable
npm run test:unit -- --testPathPattern="actionDiscovery" --testNamePattern="intimacy"
```

### Scope Resolution Testing

```bash
# Test scope resolution for all action types
npm run test:unit -- --testPathPattern="scopeResolver" --testNamePattern="intimacy"
```

## Risk Mitigation

| Risk                    | Impact | Mitigation                         |
| ----------------------- | ------ | ---------------------------------- |
| Schema validation fails | High   | Fix issues before proceeding       |
| Missing scope files     | High   | Verify all scopes before testing   |
| Cross-mod issues        | Medium | Test with all required mods loaded |
| Performance impact      | Low    | Benchmark if issues detected       |

## Completion Checklist

- [ ] All 24 actions validated against schema
- [ ] No legacy scope properties remain
- [ ] All action IDs consistent with filenames
- [ ] All scope references verified
- [ ] All component references valid
- [ ] All templates have proper placeholders
- [ ] Cross-mod references work correctly
- [ ] No duplicate IDs exist
- [ ] Validation report generated
- [ ] All validation scripts pass
- [ ] Ready for integration testing

## Next Steps

After successful validation:

1. Proceed to INTMIG-007 (Integration Testing)
2. Archive validation report
3. Update tracking document
4. Notify team of validation success

## Notes

- This validation phase is critical before integration testing
- Any failures must be fixed before proceeding
- Keep validation report for audit trail
- Use validation scripts for future migrations
