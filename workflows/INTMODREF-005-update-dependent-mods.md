# INTMODREF-005: Update Dependent Mods

**Phase**: 3 - Update References
**Estimated Time**: 2-3 hours
**Dependencies**: INTMODREF-002, INTMODREF-003, INTMODREF-004 (all content migrations complete)
**Report Reference**: Dependency Impact Analysis (lines 584-635), Update References (lines 527-545)

## Objective

Update all mods that depend on intimacy mod to reference the new affection, kissing, and caressing mods. This includes updating dependency declarations and all action/component/scope references.

## Background

Three mods are known to potentially depend on intimacy content:
1. **sex** - Likely uses intimacy actions as prerequisites/related actions
2. **seduction** - Likely uses intimacy actions in seduction flows
3. **p_erotica** - May reference intimacy for adult content paths

All `intimacy:*` references must be updated to the appropriate new mod namespace (`affection:`, `kissing:`, `caressing:`).

## Tasks

### 1. Identify All Intimacy References

Run comprehensive search across dependent mods:

```bash
# Find all intimacy action references
grep -r "intimacy:" data/mods/sex/ > intimacy-refs-sex.txt
grep -r "intimacy:" data/mods/seduction/ > intimacy-refs-seduction.txt
grep -r "intimacy:" data/mods/p_erotica/ > intimacy-refs-p_erotica.txt

# Find component references
grep -r "intimacy:kissing" data/mods/*/

# Count total references to understand scope
echo "Sex mod references:"
grep -r "intimacy:" data/mods/sex/ | wc -l
echo "Seduction mod references:"
grep -r "intimacy:" data/mods/seduction/ | wc -l
echo "P_erotica mod references:"
grep -r "intimacy:" data/mods/p_erotica/ | wc -l
```

### 2. Create Reference Mapping

Based on search results, categorize each `intimacy:*` reference to its new mod:

**Affection Mod Actions** → Replace with `affection:*`:
- `intimacy:hold_hand` → `affection:hold_hand`
- `intimacy:hug_tight` → `affection:hug_tight`
- `intimacy:brush_hand` → `affection:brush_hand`
- `intimacy:massage_back` → `affection:massage_back`
- `intimacy:massage_shoulders` → `affection:massage_shoulders`
- `intimacy:sling_arm_around_shoulders` → `affection:sling_arm_around_shoulders`
- `intimacy:wrap_arm_around_waist` → `affection:wrap_arm_around_waist`
- `intimacy:place_hand_on_waist` → `affection:place_hand_on_waist`

**Kissing Mod Actions** → Replace with `kissing:*`:
- `intimacy:kiss_cheek` → `kissing:kiss_cheek`
- `intimacy:peck_on_lips` → `kissing:peck_on_lips`
- `intimacy:lean_in_for_deep_kiss` → `kissing:lean_in_for_deep_kiss`
- `intimacy:kiss_back_passionately` → `kissing:kiss_back_passionately`
- `intimacy:accept_kiss_passively` → `kissing:accept_kiss_passively`
- `intimacy:explore_mouth_with_tongue` → `kissing:explore_mouth_with_tongue`
- `intimacy:suck_on_tongue` → `kissing:suck_on_tongue`
- `intimacy:nibble_lower_lip` → `kissing:nibble_lower_lip`
- `intimacy:cup_face_while_kissing` → `kissing:cup_face_while_kissing`
- `intimacy:break_kiss_gently` → `kissing:break_kiss_gently`
- `intimacy:pull_back_breathlessly` → `kissing:pull_back_breathlessly`
- `intimacy:pull_back_in_revulsion` → `kissing:pull_back_in_revulsion`
- `intimacy:kiss_neck_sensually` → `kissing:kiss_neck_sensually`
- `intimacy:suck_on_neck_to_leave_hickey` → `kissing:suck_on_neck_to_leave_hickey`
- `intimacy:nibble_earlobe_playfully` → `kissing:nibble_earlobe_playfully`

**Caressing Mod Actions** → Replace with `caressing:*`:
- `intimacy:run_thumb_across_lips` → `caressing:run_thumb_across_lips`
- `intimacy:thumb_wipe_cheek` → `caressing:thumb_wipe_cheek`
- `intimacy:nuzzle_face_into_neck` → `caressing:nuzzle_face_into_neck`
- `intimacy:lick_lips` → `caressing:lick_lips`
- `intimacy:adjust_clothing` → `caressing:adjust_clothing`
- `intimacy:fondle_ass` → `caressing:fondle_ass`
- `intimacy:caress_abdomen` → `caressing:caress_abdomen`
- `intimacy:feel_arm_muscles` → `caressing:feel_arm_muscles`
- `intimacy:run_fingers_through_hair` → `caressing:run_fingers_through_hair`

**Component References** → Replace:
- `intimacy:kissing` → `kissing:kissing`

**Scope References** → Replace appropriately:
- Affection scopes → `affection:scope_name`
- Kissing scopes → `kissing:scope_name`
- Caressing scopes → `caressing:scope_name`

### 3. Update Sex Mod

**File**: `data/mods/sex/mod-manifest.json`

**Before**:
```json
{
  "dependencies": [
    { "id": "intimacy", "version": "^1.0.0" }
  ]
}
```

**After**:
```json
{
  "dependencies": [
    { "id": "affection", "version": "^1.0.0" },
    { "id": "kissing", "version": "^1.0.0" },
    { "id": "caressing", "version": "^1.0.0" }
  ]
}
```

**Update all action/component/scope references** in sex mod files based on mapping above.

### 4. Update Seduction Mod

**File**: `data/mods/seduction/mod-manifest.json`

**Before**:
```json
{
  "dependencies": [
    { "id": "intimacy", "version": "^1.0.0" }
  ]
}
```

**After**:
```json
{
  "dependencies": [
    { "id": "affection", "version": "^1.0.0" },
    { "id": "kissing", "version": "^1.0.0" },
    { "id": "caressing", "version": "^1.0.0" }
  ]
}
```

**Update all action/component/scope references** in seduction mod files.

### 5. Update P_Erotica Mod

**File**: `data/mods/p_erotica/mod-manifest.json`

**Before** (if dependency exists):
```json
{
  "dependencies": [
    { "id": "intimacy", "version": "^1.0.0" }
  ]
}
```

**After**:
```json
{
  "dependencies": [
    { "id": "affection", "version": "^1.0.0" },
    { "id": "kissing", "version": "^1.0.0" },
    { "id": "caressing", "version": "^1.0.0" }
  ]
}
```

**Update all action/component/scope references** in p_erotica mod files.

### 6. Automated Reference Updates

Create a script to automate the bulk of reference updates:

```bash
#!/bin/bash
# update-intimacy-refs.sh

# Define mods to update
MODS=("sex" "seduction" "p_erotica")

# Affection action replacements
AFFECTION_ACTIONS=(
  "hold_hand" "hug_tight" "brush_hand" "massage_back"
  "massage_shoulders" "sling_arm_around_shoulders"
  "wrap_arm_around_waist" "place_hand_on_waist"
)

# Kissing action replacements
KISSING_ACTIONS=(
  "kiss_cheek" "peck_on_lips" "lean_in_for_deep_kiss"
  "kiss_back_passionately" "accept_kiss_passively"
  "explore_mouth_with_tongue" "suck_on_tongue" "nibble_lower_lip"
  "cup_face_while_kissing" "break_kiss_gently"
  "pull_back_breathlessly" "pull_back_in_revulsion"
  "kiss_neck_sensually" "suck_on_neck_to_leave_hickey"
  "nibble_earlobe_playfully"
)

# Caressing action replacements
CARESSING_ACTIONS=(
  "run_thumb_across_lips" "thumb_wipe_cheek" "nuzzle_face_into_neck"
  "lick_lips" "adjust_clothing" "fondle_ass" "caress_abdomen"
  "feel_arm_muscles" "run_fingers_through_hair"
)

# Update function
update_references() {
  local mod=$1
  local mod_path="data/mods/$mod"

  # Update affection references
  for action in "${AFFECTION_ACTIONS[@]}"; do
    find "$mod_path" -type f -name "*.json" -exec sed -i "s/intimacy:$action/affection:$action/g" {} \;
  done

  # Update kissing references
  for action in "${KISSING_ACTIONS[@]}"; do
    find "$mod_path" -type f -name "*.json" -exec sed -i "s/intimacy:$action/kissing:$action/g" {} \;
  done

  # Update caressing references
  for action in "${CARESSING_ACTIONS[@]}"; do
    find "$mod_path" -type f -name "*.json" -exec sed -i "s/intimacy:$action/caressing:$action/g" {} \;
  done

  # Update component reference
  find "$mod_path" -type f -name "*.json" -exec sed -i "s/intimacy:kissing/kissing:kissing/g" {} \;

  echo "Updated references in $mod mod"
}

# Run updates
for mod in "${MODS[@]}"; do
  if [ -d "data/mods/$mod" ]; then
    update_references "$mod"
  else
    echo "Warning: $mod mod directory not found"
  fi
done

echo "Reference update complete"
```

**Usage**:
```bash
chmod +x update-intimacy-refs.sh
./update-intimacy-refs.sh
```

### 7. Manual Verification

After automated updates, manually verify critical files:

1. **Check action lists** in dependent mod actions/rules
2. **Verify condition logic** hasn't been broken by namespace changes
3. **Test scope queries** still resolve correctly
4. **Validate component queries** for kissing state

### 8. Update Game Configuration

**File**: `data/game.json` (or equivalent game configuration)

Update mod load order to include new mods:

**Before**:
```json
{
  "mods": [
    "core",
    "anatomy",
    "positioning",
    "descriptors",
    "clothing",
    "intimacy",
    "sex",
    "seduction",
    "p_erotica"
  ]
}
```

**After**:
```json
{
  "mods": [
    "core",
    "anatomy",
    "positioning",
    "descriptors",
    "clothing",
    "affection",
    "kissing",
    "caressing",
    "sex",
    "seduction",
    "p_erotica"
  ]
}
```

**Note**: Remove `intimacy` from load order (or mark as deprecated).

## Dependency Update Examples

### Sex Mod Example

**Before** (`sex/rules/some_rule.rule.json`):
```json
{
  "rule_id": "sex:some_sexual_action",
  "prerequisites": [
    { "action": "intimacy:lean_in_for_deep_kiss" },
    { "component": "intimacy:kissing" }
  ],
  "relatedActions": [
    "intimacy:fondle_ass",
    "intimacy:caress_abdomen"
  ]
}
```

**After**:
```json
{
  "rule_id": "sex:some_sexual_action",
  "prerequisites": [
    { "action": "kissing:lean_in_for_deep_kiss" },
    { "component": "kissing:kissing" }
  ],
  "relatedActions": [
    "caressing:fondle_ass",
    "caressing:caress_abdomen"
  ]
}
```

## Acceptance Criteria

- [ ] All intimacy references identified and documented
- [ ] Reference mapping created for all 32 actions
- [ ] Sex mod dependency updated to include affection, kissing, caressing
- [ ] Seduction mod dependency updated to include affection, kissing, caressing
- [ ] P_erotica mod dependency updated (if applicable)
- [ ] All action references updated in sex mod
- [ ] All action references updated in seduction mod
- [ ] All action references updated in p_erotica mod
- [ ] Component references updated (`intimacy:kissing` → `kissing:kissing`)
- [ ] Scope references updated appropriately
- [ ] game.json updated with new mod load order
- [ ] No `intimacy:` references remain in dependent mods
- [ ] All JSON files in dependent mods are valid

## Validation Commands

```bash
# Verify no intimacy references remain
grep -r "intimacy:" data/mods/sex/ || echo "Sex mod: Clean ✓"
grep -r "intimacy:" data/mods/seduction/ || echo "Seduction mod: Clean ✓"
grep -r "intimacy:" data/mods/p_erotica/ || echo "P_erotica mod: Clean ✓"

# Verify new mod references exist
grep -r "affection:\|kissing:\|caressing:" data/mods/sex/ | wc -l
grep -r "affection:\|kissing:\|caressing:" data/mods/seduction/ | wc -l

# Check dependency declarations
grep -A5 '"dependencies"' data/mods/sex/mod-manifest.json
grep -A5 '"dependencies"' data/mods/seduction/mod-manifest.json
grep -A5 '"dependencies"' data/mods/p_erotica/mod-manifest.json

# Validate JSON syntax in updated files
find data/mods/sex/ -name "*.json" -exec jq . {} \; > /dev/null
find data/mods/seduction/ -name "*.json" -exec jq . {} \; > /dev/null
find data/mods/p_erotica/ -name "*.json" -exec jq . {} \; > /dev/null
```

## Next Steps

After completion, proceed to:
- **INTMODREF-006**: Create integration tests
- **INTMODREF-007**: Update existing tests

## Notes

- This is a critical phase - broken references will break dependent mods
- Automated script reduces manual error but manual verification essential
- Some mods may not have intimacy dependencies - verify before updating
- Component references (`intimacy:kissing`) only exist in kissing-related rules
- Scope references must match new mod namespaces
- game.json load order matters - new mods must load before dependent mods
- Consider creating migration guide for external/community mods
