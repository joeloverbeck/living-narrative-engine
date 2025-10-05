# INTMODREF-004: Migrate Caressing Mod Content

**Phase**: 2 - File Migration
**Estimated Time**: 1.5-2 hours
**Dependencies**: INTMODREF-001 (structure must exist)
**Report Reference**: Mod 3: caressing (lines 283-365), File Mapping (lines 402-413, 429-432, 438-440, 469-476)

## Objective

Migrate 35 files from the intimacy mod to the caressing mod, updating all IDs, applying Dark Purple color scheme, and handling multi-target actions with clothing integration for sensual touch interactions.

## Background

The caressing mod contains flirtatious and sensual touching that creates or escalates sexual tension. It's more intimate than affection, distinct from kissing through touch-based interaction, and includes clothing-aware intimate touches.

## File Inventory

**Total Files**: 35
- 9 actions
- 8 rules (note: some rules handle multiple related actions)
- 9 conditions
- 9 scopes (mod-specific + 3 shared to duplicate)

## Tasks

### 1. Migrate Actions (9 files)

Copy and update these action files by intimacy level:

| Source | Destination | Intimacy Level |
|--------|-------------|----------------|
| `intimacy/actions/run_thumb_across_lips.action.json` | `caressing/actions/run_thumb_across_lips.action.json` | High |
| `intimacy/actions/thumb_wipe_cheek.action.json` | `caressing/actions/thumb_wipe_cheek.action.json` | Medium |
| `intimacy/actions/nuzzle_face_into_neck.action.json` | `caressing/actions/nuzzle_face_into_neck.action.json` | High |
| `intimacy/actions/lick_lips.action.json` | `caressing/actions/lick_lips.action.json` | Medium |
| `intimacy/actions/adjust_clothing.action.json` | `caressing/actions/adjust_clothing.action.json` | Medium |
| `intimacy/actions/fondle_ass.action.json` | `caressing/actions/fondle_ass.action.json` | Very High |
| `intimacy/actions/caress_abdomen.action.json` | `caressing/actions/caress_abdomen.action.json` | High |
| `intimacy/actions/feel_arm_muscles.action.json` | `caressing/actions/feel_arm_muscles.action.json` | Medium |
| `intimacy/actions/run_fingers_through_hair.action.json` | `caressing/actions/run_fingers_through_hair.action.json` | Medium |

**For each action file**:

1. **Update ID**: `"id": "intimacy:action_name"` → `"id": "caressing:action_name"`
2. **Update visual properties** to Dark Purple scheme:
   ```json
   "visualProperties": {
     "backgroundColor": "#311b92",
     "textColor": "#d1c4e9",
     "hoverBackgroundColor": "#4527a0",
     "hoverTextColor": "#ede7f6"
   }
   ```
3. **Update target scope references**: `"intimacy:scope_name"` → `"caressing:scope_name"`
4. **Update rule reference**: `"rule": "intimacy:rule_name"` → `"rule": "caressing:rule_name"`
5. **Update condition reference**: `"condition": "intimacy:condition_name"` → `"condition": "caressing:condition_name"`

**Special Attention for Multi-Target Actions**:

Actions `fondle_ass` and `caress_abdomen` use multi-target system:
- Primary target: actor
- Secondary target: clothing item (via `clothing:target_topmost_*` scopes)
- Ensure clothing scope references are updated

### 2. Migrate Rules (8 files)

Copy and update corresponding rule files:

| Source | Destination |
|--------|-------------|
| `intimacy/rules/run_thumb_across_lips.rule.json` | `caressing/rules/run_thumb_across_lips.rule.json` |
| `intimacy/rules/thumb_wipe_cheek.rule.json` | `caressing/rules/thumb_wipe_cheek.rule.json` |
| `intimacy/rules/nuzzle_face_into_neck.rule.json` | `caressing/rules/nuzzle_face_into_neck.rule.json` |
| `intimacy/rules/lick_lips.rule.json` | `caressing/rules/lick_lips.rule.json` |
| `intimacy/rules/adjust_clothing.rule.json` | `caressing/rules/adjust_clothing.rule.json` |
| `intimacy/rules/fondle_ass.rule.json` | `caressing/rules/fondle_ass.rule.json` |
| `intimacy/rules/feel_arm_muscles.rule.json` | `caressing/rules/feel_arm_muscles.rule.json` |
| `intimacy/rules/run_fingers_through_hair.rule.json` | `caressing/rules/run_fingers_through_hair.rule.json` |

**Note**: `caress_abdomen` may share a rule with `fondle_ass` or have a separate rule. Verify the rule structure.

**For each rule file**:

1. **Update rule_id**: `"rule_id": "intimacy:rule_name"` → `"rule_id": "caressing:rule_name"`
2. **Update action reference**: `"intimacy:action_name"` → `"caressing:action_name"`
3. **Update condition references**: `"intimacy:condition_name"` → `"caressing:condition_name"`
4. **Update scope references**: `"intimacy:scope_name"` → `"caressing:scope_name"`
5. **Preserve multi-target logic** for fondle_ass/caress_abdomen rules
6. **Preserve clothing integration** scope references

**Multi-Target Rules Pattern**:

Rules for `fondle_ass` and `caress_abdomen` should include:
- Primary target validation (actor positioning/anatomy)
- Secondary target validation (clothing item selection)
- Multi-target message formatting

### 3. Migrate Conditions (9 files)

Copy and update corresponding condition files:

| Source | Destination |
|--------|-------------|
| `intimacy/conditions/run_thumb_across_lips.condition.json` | `caressing/conditions/run_thumb_across_lips.condition.json` |
| `intimacy/conditions/thumb_wipe_cheek.condition.json` | `caressing/conditions/thumb_wipe_cheek.condition.json` |
| `intimacy/conditions/nuzzle_face_into_neck.condition.json` | `caressing/conditions/nuzzle_face_into_neck.condition.json` |
| `intimacy/conditions/lick_lips.condition.json` | `caressing/conditions/lick_lips.condition.json` |
| `intimacy/conditions/adjust_clothing.condition.json` | `caressing/conditions/adjust_clothing.condition.json` |
| `intimacy/conditions/fondle_ass.condition.json` | `caressing/conditions/fondle_ass.condition.json` |
| `intimacy/conditions/caress_abdomen.condition.json` | `caressing/conditions/caress_abdomen.condition.json` |
| `intimacy/conditions/feel_arm_muscles.condition.json` | `caressing/conditions/feel_arm_muscles.condition.json` |
| `intimacy/conditions/run_fingers_through_hair.condition.json` | `caressing/conditions/run_fingers_through_hair.condition.json` |

**For each condition file**:

1. **Update condition ID**: `"id": "intimacy:condition_name"` → `"id": "caressing:condition_name"`
2. **Update action reference**: `"intimacy:action_name"` → `"caressing:action_name"`
3. **Update scope references**: `"intimacy:scope_name"` → `"caressing:scope_name"`
4. **Update clothing scope references**: `"clothing:target_topmost_*"` (if present)

### 4. Migrate Scopes (9 mod-specific + 3 shared)

#### Caressing-Specific Scopes

| Source | Destination |
|--------|-------------|
| `intimacy/scopes/actors_with_ass_cheeks_facing_each_other.scope` | `caressing/scopes/actors_with_ass_cheeks_facing_each_other.scope` |
| `intimacy/scopes/actors_with_ass_cheeks_facing_each_other_or_behind_target.scope` | `caressing/scopes/actors_with_ass_cheeks_facing_each_other_or_behind_target.scope` |
| `intimacy/scopes/actors_with_ass_cheeks_in_intimacy.scope` | `caressing/scopes/actors_with_ass_cheeks_in_intimacy.scope` |
| `intimacy/scopes/actors_with_muscular_arms_facing_each_other_or_behind_target.scope` | `caressing/scopes/actors_with_muscular_arms_facing_each_other_or_behind_target.scope` |
| `intimacy/scopes/close_actors_facing_each_other_with_torso_clothing.scope` | `caressing/scopes/close_actors_facing_each_other_with_torso_clothing.scope` |

#### Shared Scopes (duplicate from intimacy)

| Source | Destination |
|--------|-------------|
| `intimacy/scopes/close_actors_facing_each_other.scope` | `caressing/scopes/close_actors_facing_each_other.scope` |
| `intimacy/scopes/close_actors_facing_away.scope` | `caressing/scopes/close_actors_facing_away.scope` |
| `intimacy/scopes/close_actors_facing_each_other_or_behind_target.scope` | `caressing/scopes/close_actors_facing_each_other_or_behind_target.scope` |

**Note**: One scope from report (`actors_with_arms_in_intimacy`) appears to be affection-specific, not caressing. Verify actual scope usage.

**For each scope file**:

1. **Update scope ID**: `"id": "intimacy:scope_name"` → `"id": "caressing:scope_name"`
2. **Update any internal references** to other scopes if present
3. **Preserve clothing scope integration** if scope queries clothing items

### 5. Update Mod Manifest

Update `data/mods/caressing/mod-manifest.json` with complete file listings:

```json
{
  "actions": [
    "caressing:run_thumb_across_lips",
    "caressing:thumb_wipe_cheek",
    "caressing:nuzzle_face_into_neck",
    "caressing:lick_lips",
    "caressing:adjust_clothing",
    "caressing:fondle_ass",
    "caressing:caress_abdomen",
    "caressing:feel_arm_muscles",
    "caressing:run_fingers_through_hair"
  ],
  "rules": [
    "caressing:run_thumb_across_lips",
    "caressing:thumb_wipe_cheek",
    "caressing:nuzzle_face_into_neck",
    "caressing:lick_lips",
    "caressing:adjust_clothing",
    "caressing:fondle_ass",
    "caressing:feel_arm_muscles",
    "caressing:run_fingers_through_hair"
  ],
  "conditions": [
    "caressing:run_thumb_across_lips",
    "caressing:thumb_wipe_cheek",
    "caressing:nuzzle_face_into_neck",
    "caressing:lick_lips",
    "caressing:adjust_clothing",
    "caressing:fondle_ass",
    "caressing:caress_abdomen",
    "caressing:feel_arm_muscles",
    "caressing:run_fingers_through_hair"
  ],
  "scopes": [
    "caressing:actors_with_ass_cheeks_facing_each_other",
    "caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target",
    "caressing:actors_with_ass_cheeks_in_intimacy",
    "caressing:actors_with_muscular_arms_facing_each_other_or_behind_target",
    "caressing:close_actors_facing_each_other_with_torso_clothing",
    "caressing:close_actors_facing_each_other",
    "caressing:close_actors_facing_away",
    "caressing:close_actors_facing_each_other_or_behind_target"
  ]
}
```

## Special Mechanics to Preserve

### 1. Multi-Target System

Actions `fondle_ass` and `caress_abdomen` target BOTH actor and clothing:

**Primary Target**: Actor (with appropriate anatomy/positioning)
**Secondary Target**: Clothing item via scopes like:
- `clothing:target_topmost_torso_clothing`
- `clothing:target_topmost_lower_clothing`

Ensure rules maintain this dual-target logic.

### 2. Clothing Integration

The caressing mod uniquely depends on the `clothing` mod for:
- Fondle ass: Targets lower clothing
- Caress abdomen: Targets torso clothing

Verify dependency in mod-manifest.json:
```json
{
  "dependencies": [
    { "id": "clothing", "version": "^1.0.0" }
  ]
}
```

### 3. Prerequisite Checks

Some actions verify closeness state before execution. Preserve these checks in conditions.

## ID Transformation Examples

### Action File Example

**Before** (`intimacy/actions/fondle_ass.action.json`):
```json
{
  "id": "intimacy:fondle_ass",
  "name": "Fondle Ass",
  "visualProperties": {
    "backgroundColor": "#ad1457",
    "textColor": "#ffffff"
  },
  "rule": "intimacy:fondle_ass",
  "condition": "intimacy:fondle_ass",
  "targetScope": "intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target",
  "secondaryTargetScope": "clothing:target_topmost_lower_clothing"
}
```

**After** (`caressing/actions/fondle_ass.action.json`):
```json
{
  "id": "caressing:fondle_ass",
  "name": "Fondle Ass",
  "visualProperties": {
    "backgroundColor": "#311b92",
    "textColor": "#d1c4e9",
    "hoverBackgroundColor": "#4527a0",
    "hoverTextColor": "#ede7f6"
  },
  "rule": "caressing:fondle_ass",
  "condition": "caressing:fondle_ass",
  "targetScope": "caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target",
  "secondaryTargetScope": "clothing:target_topmost_lower_clothing"
}
```

## Acceptance Criteria

- [ ] All 9 action files copied and updated with caressing: prefix
- [ ] All 8 rule files copied and updated with caressing: prefix
- [ ] All 9 condition files copied and updated with caressing: prefix
- [ ] All 9 scope files copied and updated (6 specific + 3 shared)
- [ ] Dark Purple color scheme (#311b92) applied to all actions
- [ ] Multi-target logic preserved for fondle_ass and caress_abdomen
- [ ] Clothing dependency verified in mod-manifest.json
- [ ] Clothing scope references preserved (not updated to caressing:)
- [ ] All internal references updated (no intimacy: references remain)
- [ ] mod-manifest.json updated with complete file listings
- [ ] All JSON files are valid (no syntax errors)

## Validation Commands

```bash
# Count migrated files
ls -1 data/mods/caressing/actions/ | wc -l     # Should be 9
ls -1 data/mods/caressing/rules/ | wc -l       # Should be 8
ls -1 data/mods/caressing/conditions/ | wc -l  # Should be 9
ls -1 data/mods/caressing/scopes/ | wc -l      # Should be 8

# Check for intimacy references (should return nothing)
grep -r "intimacy:" data/mods/caressing/

# Verify color scheme application
grep -r "#311b92" data/mods/caressing/actions/

# Check clothing dependency
grep -r '"clothing"' data/mods/caressing/mod-manifest.json

# Verify clothing scope references preserved
grep -r "clothing:target_topmost" data/mods/caressing/

# Validate JSON syntax
find data/mods/caressing/ -name "*.json" -exec jq . {} \;
```

## Next Steps

After completion, proceed to:
- **INTMODREF-005**: Update dependent mods (sex, seduction, p_erotica)

## Notes

- Caressing actions are stateless (no components needed)
- Multi-target actions are more complex than affection's simple actions
- Clothing integration requires preserving `clothing:` namespace in scope references
- Dark Purple color scheme creates visual hierarchy: lightest (affection) → darkest (caressing)
- Shared scopes duplicated to maintain mod independence
- Some actions have very high intimacy levels (fondle_ass)
