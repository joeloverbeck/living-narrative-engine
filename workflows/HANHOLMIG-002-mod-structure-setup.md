# HANHOLMIG-002: Mod Structure Setup

**Status**: Ready for Implementation
**Priority**: High
**Estimated Time**: 30-45 minutes
**Risk Level**: Low

## Overview

This ticket creates the complete directory structure and mod-manifest.json for the new `hand_holding` mod. This establishes the foundation for migrating content from the affection mod and ensures proper dependency configuration.

## Prerequisites

- [x] **HANHOLMIG-001 complete**: Scope migration finished, committed, and tested
- [ ] Clean git working directory
- [ ] Feature branch: `feature/hand-holding-mod-migration` active

## Detailed Steps

### Step 1: Create Root Mod Directory

**Command**:
```bash
mkdir -p data/mods/hand_holding
```

**Validation**:
```bash
ls -la data/mods/ | grep hand_holding
# Should show: hand_holding/
```

### Step 2: Create Content Subdirectories

**Command**:
```bash
mkdir -p data/mods/hand_holding/actions
mkdir -p data/mods/hand_holding/components
mkdir -p data/mods/hand_holding/conditions
mkdir -p data/mods/hand_holding/rules
```

**Validation**:
```bash
ls -la data/mods/hand_holding/
# Should show: actions/ components/ conditions/ rules/
```

### Step 3: Create Mod Manifest

**File to create**: `data/mods/hand_holding/mod-manifest.json`

**Content**:
```json
{
  "id": "hand_holding",
  "version": "1.0.0",
  "name": "Hand Holding",
  "description": "Sophisticated state-based hand-holding interactions with bidirectional relationship tracking. Includes actions for establishing, enhancing, and breaking hand-holding state.",
  "author": "Living Narrative Engine Team",
  "license": "MIT",
  "dependencies": [
    {
      "id": "core",
      "version": "^1.0.0"
    },
    {
      "id": "positioning",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "actions": [
      "hold_hand",
      "squeeze_hand_reassuringly",
      "warm_hands_between_yours"
    ],
    "components": [
      "holding_hand",
      "hand_held"
    ],
    "conditions": [
      "actors-are-holding-hands",
      "event-is-action-hold-hand",
      "event-is-action-squeeze-hand-reassuringly",
      "event-is-action-warm-hands-between-yours"
    ],
    "rules": [
      "handle_hold_hand",
      "handle_squeeze_hand_reassuringly",
      "handle_warm_hands_between_yours"
    ],
    "scopes": []
  }
}
```

**Key points**:
- **Mod ID**: `hand_holding` (complies with pattern `^[a-zA-Z0-9_]+$`)
- **Dependencies**: Only `core` and `positioning` (NOT affection - avoids circular coupling)
- **Content arrays**: Pre-populated with all files to be migrated
- **Version**: 1.0.0 for initial release

### Step 4: Verify Mod Manifest Schema Compliance

**Command**:
```bash
node scripts/validateMods.js --mod hand_holding --type manifest
```

**Expected result**: Manifest passes schema validation

**Alternative validation**:
```bash
# Check if manifest is valid JSON
cat data/mods/hand_holding/mod-manifest.json | jq '.'
```

### Step 5: Verify Directory Structure

**Command**:
```bash
tree data/mods/hand_holding/
```

**Expected output**:
```
data/mods/hand_holding/
├── mod-manifest.json
├── actions/
├── components/
├── conditions/
└── rules/
```

**Manual verification**:
```bash
# Check all directories exist
test -d data/mods/hand_holding/actions && echo "✓ actions/" || echo "✗ actions/ missing"
test -d data/mods/hand_holding/components && echo "✓ components/" || echo "✗ components/ missing"
test -d data/mods/hand_holding/conditions && echo "✓ conditions/" || echo "✗ conditions/ missing"
test -d data/mods/hand_holding/rules && echo "✓ rules/" || echo "✗ rules/ missing"
test -f data/mods/hand_holding/mod-manifest.json && echo "✓ mod-manifest.json" || echo "✗ mod-manifest.json missing"
```

## Validation Criteria

### Structure Validation Checklist

- [ ] Root directory `data/mods/hand_holding/` exists
- [ ] `actions/` subdirectory exists
- [ ] `components/` subdirectory exists
- [ ] `conditions/` subdirectory exists
- [ ] `rules/` subdirectory exists
- [ ] `mod-manifest.json` exists
- [ ] Manifest is valid JSON
- [ ] Manifest passes schema validation
- [ ] Mod ID is `hand_holding` (not `hand-holding`)
- [ ] Dependencies include `core` and `positioning`
- [ ] Dependencies do NOT include `affection`
- [ ] Content arrays list all 12 items to be migrated

### Validation Commands

```bash
# Verify structure
ls -R data/mods/hand_holding/

# Validate manifest JSON
cat data/mods/hand_holding/mod-manifest.json | jq '.'

# Validate manifest schema
node scripts/validateMods.js --mod hand_holding --type manifest

# Count content items
cat data/mods/hand_holding/mod-manifest.json | jq '.content.actions | length'    # Should be 3
cat data/mods/hand_holding/mod-manifest.json | jq '.content.components | length'  # Should be 2
cat data/mods/hand_holding/mod-manifest.json | jq '.content.conditions | length'  # Should be 4
cat data/mods/hand_holding/mod-manifest.json | jq '.content.rules | length'       # Should be 3
```

## Files Created

### Directory Structure
```
data/mods/hand_holding/
├── actions/          (empty directory)
├── components/       (empty directory)
├── conditions/       (empty directory)
├── rules/            (empty directory)
└── mod-manifest.json (new file)
```

### Manifest Content Breakdown

**Actions (3)**:
1. hold_hand
2. squeeze_hand_reassuringly
3. warm_hands_between_yours

**Components (2)**:
1. holding_hand
2. hand_held

**Conditions (4)**:
1. actors-are-holding-hands
2. event-is-action-hold-hand
3. event-is-action-squeeze-hand-reassuringly
4. event-is-action-warm-hands-between-yours

**Rules (3)**:
1. handle_hold_hand
2. handle_squeeze_hand_reassuringly
3. handle_warm_hands_between_yours

## Testing

### Verification Tests

**Test 1: Directory existence**
```bash
for dir in actions components conditions rules; do
  test -d "data/mods/hand_holding/$dir" && echo "✓ $dir exists" || echo "✗ $dir missing"
done
```

**Test 2: Manifest validity**
```bash
# Test JSON parsing
cat data/mods/hand_holding/mod-manifest.json | jq '.id, .version, .name'
# Should output: "hand_holding" "1.0.0" "Hand Holding"
```

**Test 3: Dependency structure**
```bash
cat data/mods/hand_holding/mod-manifest.json | jq '.dependencies[].id'
# Should output: "core" "positioning"
```

**Test 4: Content counts**
```bash
echo "Actions: $(cat data/mods/hand_holding/mod-manifest.json | jq '.content.actions | length')"
echo "Components: $(cat data/mods/hand_holding/mod-manifest.json | jq '.content.components | length')"
echo "Conditions: $(cat data/mods/hand_holding/mod-manifest.json | jq '.content.conditions | length')"
echo "Rules: $(cat data/mods/hand_holding/mod-manifest.json | jq '.content.rules | length')"
# Should output: Actions: 3, Components: 2, Conditions: 4, Rules: 3
```

## Rollback Plan

If structure needs to be recreated:

```bash
# Delete entire mod directory
rm -rf data/mods/hand_holding/

# Re-run creation commands from Steps 1-3
```

## Commit Strategy

**Single atomic commit**:
```bash
git add data/mods/hand_holding/
git commit -m "HANHOLMIG-002: Create hand_holding mod structure

- Create mod directory: data/mods/hand_holding/
- Create subdirectories: actions/, components/, conditions/, rules/
- Create mod-manifest.json with proper dependencies
- Manifest includes all 12 items to be migrated (3 actions, 2 components, 4 conditions, 3 rules)
- Dependencies: core, positioning (NOT affection to avoid circular coupling)

Ready for content migration in HANHOLMIG-003."
```

## Success Criteria

Setup is successful when:
- ✅ All directories created correctly
- ✅ mod-manifest.json exists and is valid JSON
- ✅ Manifest passes schema validation
- ✅ Mod ID uses underscore separator (hand_holding)
- ✅ Dependencies include core and positioning only
- ✅ Content arrays list all 12 items to be migrated
- ✅ All validation commands pass without errors

## Next Steps

After this ticket is complete and committed:
1. Verify clean commit with `git status`
2. Proceed to **HANHOLMIG-003** (File Migration)

---

**Note**: Directories are empty at this stage. Files will be migrated in HANHOLMIG-003.
