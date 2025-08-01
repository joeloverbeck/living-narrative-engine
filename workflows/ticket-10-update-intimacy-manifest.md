# Ticket 10: Update Intimacy Mod Manifest

## Overview
**Phase**: 3 - Intimacy Mod Refactoring  
**Priority**: Critical  
**Estimated Time**: 1-2 hours  
**Dependencies**: Tickets 04-09 (Core Migration Complete)  
**Implements**: Report section "Intimacy Mod Refactoring" - manifest cleanup

## Objective
Update the intimacy mod manifest to remove all migrated positioning content and ensure the manifest accurately reflects the remaining intimacy-specific content after the posturing mod migration.

## Background
**Current Issue**: Intimacy mod manifest still declares positioning content that has been migrated to posturing mod.

**Content to Remove from Intimacy Manifest**:
- `turn_around.action.json` and `turn_around_to_face.action.json` (migrated to posturing)
- `facing_away.component.json` (migrated to posturing)
- 3 positioning events: `actor_turned_around`, `actor_faced_everyone`, `actor_faced_forward` (migrated to posturing)
- 5 positioning conditions (migrated to posturing)
- 2 positioning rules (migrated to posturing)
- 2 positioning scopes (migrated to posturing, depending on ticket 09 results)

**From Migration Analysis**:
- Intimacy mod should only contain intimate-specific content
- Positioning content has been properly separated to posturing mod
- Manifest cleanup prevents duplicate content registration

## Implementation Tasks

### Task 10.1: Analyze Current Intimacy Manifest Content
**File**: `data/mods/intimacy/mod-manifest.json`

**Current Actions Section** (to be updated):
```json
"actions": [
  "accept_kiss_passively.action.json",
  "adjust_clothing.action.json",
  // ... other intimacy actions ...
  "turn_around.action.json",          // ❌ REMOVE - migrated to posturing
  "turn_around_to_face.action.json"   // ❌ REMOVE - migrated to posturing
]
```

**Current Components Section** (to be updated):
```json
"components": [
  "closeness.component.json",      // ✅ KEEP - intimacy-specific
  "facing_away.component.json",    // ❌ REMOVE - migrated to posturing
  "kissing.component.json"         // ✅ KEEP - intimacy-specific
]
```

**Current Events Section** (to be updated):
```json
"events": [
  "actor_faced_everyone.event.json",   // ❌ REMOVE - migrated to posturing
  "actor_faced_forward.event.json",    // ❌ REMOVE - migrated to posturing
  "actor_turned_around.event.json"     // ❌ REMOVE - migrated to posturing
]
```

### Task 10.2: Create Updated Intimacy Manifest
**Target**: Clean intimacy manifest with only intimate-specific content

**Updated Manifest Structure**:
```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "intimacy",
  "version": "1.0.0",
  "name": "intimacy",
  "description": "This module allows intimacy between characters. Sex is not included.",
  "author": "joeloverbeck",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "anatomy",
      "version": "^1.0.0"
    },
    {
      "id": "posturing",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "actions": [
      "accept_kiss_passively.action.json",
      "adjust_clothing.action.json",
      "break_kiss_gently.action.json",
      "brush_hand.action.json",
      "cup_face_while_kissing.action.json",
      "explore_mouth_with_tongue.action.json",
      "feel_arm_muscles.action.json",
      "fondle_ass.action.json",
      "get_close.action.json",
      "kiss_back_passionately.action.json",
      "kiss_cheek.action.json",
      "kiss_neck_sensually.action.json",
      "lean_in_for_deep_kiss.action.json",
      "lick_lips.action.json",
      "massage_back.action.json",
      "massage_shoulders.action.json",
      "nibble_earlobe_playfully.action.json",
      "nibble_lower_lip.action.json",
      "nuzzle_face_into_neck.action.json",
      "peck_on_lips.action.json",
      "place_hand_on_waist.action.json",
      "pull_back_breathlessly.action.json",
      "pull_back_in_revulsion.action.json",
      "step_back.action.json",
      "suck_on_neck_to_leave_hickey.action.json",
      "suck_on_tongue.action.json",
      "thumb_wipe_cheek.action.json"
      // ❌ REMOVED: "turn_around.action.json",
      // ❌ REMOVED: "turn_around_to_face.action.json"
    ],
    "components": [
      "closeness.component.json",
      "kissing.component.json"
      // ❌ REMOVED: "facing_away.component.json"
    ],
    "conditions": [
      "actor-is-in-closeness.condition.json",
      "actor-is-kiss-receiver.condition.json",
      "target-is-kissing-partner.condition.json",
      // Keep intimacy-specific event conditions
      "event-is-action-accept-kiss-passively.condition.json",
      "event-is-action-adjust-clothing.condition.json",
      // ... all other intimacy action event conditions ...
      // ❌ REMOVED: All positioning conditions (5 conditions migrated)
    ],
    "entities": {
      "definitions": [],
      "instances": []
    },
    "events": [
      // ❌ REMOVED: All positioning events (3 events migrated)
    ],
    "macros": [],
    "rules": [
      "accept_kiss_passively.rule.json",
      "adjust_clothing.rule.json",
      // ... all other intimacy rules ...
      // ❌ REMOVED: "turn_around.rule.json",
      // ❌ REMOVED: "turn_around_to_face.rule.json"
    ],
    "scopes": [
      "actors_with_arms_facing_each_other.scope",
      "actors_with_arms_facing_each_other_or_behind_target.scope",
      "actors_with_arms_in_intimacy.scope",
      "actors_with_ass_cheeks_facing_each_other.scope",
      "actors_with_ass_cheeks_facing_each_other_or_behind_target.scope",
      "actors_with_ass_cheeks_in_intimacy.scope",
      "actors_with_mouth_facing_each_other.scope",
      "actors_with_muscular_arms_facing_each_other_or_behind_target.scope",
      "close_actors.scope",
      "close_actors_facing_each_other.scope",
      "close_actors_facing_each_other_or_behind_target.scope",
      "close_actors_facing_each_other_with_torso_clothing.scope",
      "current_kissing_partner.scope"
      // ❌ CONDITIONALLY REMOVED: "actors_im_facing_away_from.scope" (if migrated in ticket 09)
      // ❌ CONDITIONALLY REMOVED: "close_actors_facing_away.scope" (if migrated in ticket 09)
    ]
  }
}
```

### Task 10.3: Handle Conditional Scope Removals
**Based on Ticket 09 Results**:

**If both scopes migrated to posturing**:
- Remove `actors_im_facing_away_from.scope` from intimacy manifest
- Remove `close_actors_facing_away.scope` from intimacy manifest

**If only actors_im_facing_away_from migrated**:
- Remove `actors_im_facing_away_from.scope` from intimacy manifest
- Keep `close_actors_facing_away.scope` in intimacy manifest

**If neither scope migrated**:
- Keep both scopes in intimacy manifest
- Document for future migration

### Task 10.4: Remove Positioning Conditions
**5 Conditions to Remove** (migrated in ticket 08):
- `both-actors-facing-each-other.condition.json`
- `actor-is-behind-entity.condition.json`
- `entity-not-in-facing-away.condition.json`
- `actor-in-entity-facing-away.condition.json`
- `entity-in-facing-away.condition.json`

**Intimacy-Specific Conditions to Keep**:
- `actor-is-in-closeness.condition.json`
- `actor-is-kiss-receiver.condition.json`
- `target-is-kissing-partner.condition.json`
- All `event-is-action-*` conditions for intimacy actions

## Implementation Steps

### Step 1: Backup Current Manifest
```bash
# Create backup
cp data/mods/intimacy/mod-manifest.json data/mods/intimacy/mod-manifest.json.backup

# Verify current content
cat data/mods/intimacy/mod-manifest.json
```

### Step 2: Remove Migrated Actions
```bash
# Edit intimacy manifest to remove:
# - "turn_around.action.json"
# - "turn_around_to_face.action.json"
```

### Step 3: Remove Migrated Components
```bash
# Edit intimacy manifest to remove:
# - "facing_away.component.json"
```

### Step 4: Remove Migrated Events
```bash
# Edit intimacy manifest to remove:
# - "actor_faced_everyone.event.json"
# - "actor_faced_forward.event.json"
# - "actor_turned_around.event.json"
```

### Step 5: Remove Migrated Rules
```bash
# Edit intimacy manifest to remove:
# - "turn_around.rule.json"
# - "turn_around_to_face.rule.json"
```

### Step 6: Remove Migrated Conditions
```bash
# Edit intimacy manifest to remove 5 positioning conditions:
# - "both-actors-facing-each-other.condition.json"
# - "actor-is-behind-entity.condition.json"
# - "entity-not-in-facing-away.condition.json"
# - "actor-in-entity-facing-away.condition.json"
# - "entity-in-facing-away.condition.json"
```

### Step 7: Handle Scope Removals (Based on Ticket 09)
```bash
# Check ticket 09 results and remove migrated scopes:
# - "actors_im_facing_away_from.scope" (if migrated)
# - "close_actors_facing_away.scope" (if migrated)
```

### Step 8: Validate Updated Manifest
```bash
# Test manifest loading
npm run dev

# Check console for:
# - Intimacy mod loads successfully
# - No duplicate content warnings
# - Only intimacy-specific content registered
# - Posturing dependency resolved correctly
```

## Acceptance Criteria

### ✅ Migrated Content Removal
- [ ] 2 positioning actions removed from manifest
- [ ] 1 positioning component removed from manifest
- [ ] 3 positioning events removed from manifest
- [ ] 2 positioning rules removed from manifest
- [ ] 5 positioning conditions removed from manifest
- [ ] Migrated scopes removed (based on ticket 09 results)

### ✅ Intimacy Content Preservation
- [ ] All intimacy-specific actions preserved
- [ ] Intimacy components (closeness, kissing) preserved
- [ ] Intimacy conditions preserved
- [ ] Intimacy rules preserved
- [ ] Intimacy scopes preserved

### ✅ Manifest Structure Validation
- [ ] JSON syntax is valid
- [ ] Schema reference is correct
- [ ] Dependencies section unchanged (anatomy, posturing)
- [ ] Content structure follows established patterns

### ✅ Loading and Registration
- [ ] Intimacy mod loads without errors
- [ ] No duplicate content registration warnings
- [ ] Posturing dependency resolves correctly
- [ ] Only intimacy-specific content registers under intimacy namespace

## Risk Assessment

### 🚨 Potential Issues
1. **Over-Removal**: Accidentally removing intimacy-specific content
2. **Under-Removal**: Leaving migrated content causing duplicates
3. **Dependency Issues**: Breaking posturing dependency resolution
4. **Scope Confusion**: Incorrect scope removal based on ticket 09 results

### 🛡️ Risk Mitigation
1. **Careful Review**: Double-check each content item before removal
2. **Cross-Reference**: Use migration analysis report to verify removals
3. **Dependency Testing**: Test posturing dependency after changes
4. **Scope Coordination**: Check ticket 09 results before scope changes

## Test Cases

### Test Case 1: Manifest Loading
```bash
npm run dev
# Expected: Intimacy mod loads successfully
# Expected: No JSON parsing or schema validation errors
```

### Test Case 2: Content Registration
```bash
npm run dev
# Expected: Only intimacy-specific content registers under intimacy namespace
# Expected: No positioning content (actions, components, events, rules, conditions)
```

### Test Case 3: Dependency Resolution
```bash
npm run dev
# Expected: Posturing dependency resolves correctly
# Expected: Intimacy actions can reference posturing components/scopes
```

### Test Case 4: No Duplicate Content
```bash
npm run dev
# Expected: No "duplicate content" warnings
# Expected: No conflicts between intimacy and posturing content
```

## File Changes Summary

### Files Modified
- `data/mods/intimacy/mod-manifest.json` (major content removal)

### Content Removed
- **2 Actions**: turn_around, turn_around_to_face
- **1 Component**: facing_away
- **3 Events**: actor_turned_around, actor_faced_everyone, actor_faced_forward
- **2 Rules**: turn_around, turn_around_to_face
- **5 Conditions**: all positioning conditions
- **0-2 Scopes**: conditional based on ticket 09 results

### Content Preserved
- **All intimacy-specific actions** (kissing, touching, closeness)
- **Intimacy components** (closeness, kissing)
- **Intimacy events** (none currently, but structure preserved)
- **Intimacy rules** (all intimacy action handlers)
- **Intimacy conditions** (closeness, kissing-related)
- **Intimacy scopes** (all closeness and intimacy-specific scopes)

## Success Metrics
- **Zero** duplicate content registrations
- **All** migrated content removed from intimacy manifest
- **All** intimacy-specific content preserved
- **Successful** mod loading and dependency resolution

## Dependencies for Next Tickets
- **Tickets 11-13**: Intimacy content updates will reference the cleaned manifest
- **Tickets 14-16**: Tests will validate the cleaned content structure
- **Future Development**: Clean separation enables easier intimacy mod maintenance

## Post-Implementation Validation
After completion:
1. **Clean Separation**: Intimacy mod contains only intimate content
2. **Dependency Health**: Posturing dependency works correctly
3. **No Duplicates**: No content conflicts between mods
4. **Maintainable Structure**: Clear mod boundaries established

## Rollback Procedure
If issues occur:
1. Restore intimacy manifest from backup
2. Test that original configuration works
3. Investigate and resolve manifest issues
4. Re-attempt with corrections

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Intimacy Refactoring Phase