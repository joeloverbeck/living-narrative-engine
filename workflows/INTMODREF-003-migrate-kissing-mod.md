# INTMODREF-003: Migrate Kissing Mod Content

**Phase**: 2 - File Migration
**Estimated Time**: 2-3 hours
**Dependencies**: INTMODREF-001 (structure must exist)
**Report Reference**: Mod 2: kissing (lines 183-280), File Mapping (lines 383-400, 425-427, 434-436, 462-467)

## Objective

Migrate 50 files from the intimacy mod to the kissing mod, updating all IDs, managing the kissing state component, and maintaining the Rose Pink color scheme for romantic mouth-based interactions.

## Background

The kissing mod contains all mouth-based romantic interactions with explicit state management. It handles kiss initiation, during-kiss actions, and kiss ending with bilateral component management and mouth engagement locking.

## File Inventory

**Total Files**: 50
- 15 actions
- 15 rules
- 17 conditions (includes special `actor-is-kiss-receiver`, `target-is-kissing-partner`)
- 1 component (`kissing.component.json`)
- 2 mod-specific scopes (+ 2 shared to duplicate)

## Tasks

### 1. Migrate Actions (15 files)

Copy and update these action files by category:

#### Kiss Initiation Actions
| Source | Destination | Action Name |
|--------|-------------|-------------|
| `intimacy/actions/kiss_cheek.action.json` | `kissing/actions/kiss_cheek.action.json` | Kiss Cheek |
| `intimacy/actions/peck_on_lips.action.json` | `kissing/actions/peck_on_lips.action.json` | Peck on Lips |
| `intimacy/actions/lean_in_for_deep_kiss.action.json` | `kissing/actions/lean_in_for_deep_kiss.action.json` | Lean in for Deep Kiss |

#### Kiss Response Actions
| Source | Destination | Action Name |
|--------|-------------|-------------|
| `intimacy/actions/kiss_back_passionately.action.json` | `kissing/actions/kiss_back_passionately.action.json` | Kiss Back Passionately |
| `intimacy/actions/accept_kiss_passively.action.json` | `kissing/actions/accept_kiss_passively.action.json` | Accept Kiss Passively |

#### During Kiss Actions
| Source | Destination | Action Name |
|--------|-------------|-------------|
| `intimacy/actions/explore_mouth_with_tongue.action.json` | `kissing/actions/explore_mouth_with_tongue.action.json` | Explore Mouth with Tongue |
| `intimacy/actions/suck_on_tongue.action.json` | `kissing/actions/suck_on_tongue.action.json` | Suck on Tongue |
| `intimacy/actions/nibble_lower_lip.action.json` | `kissing/actions/nibble_lower_lip.action.json` | Nibble Lower Lip |
| `intimacy/actions/cup_face_while_kissing.action.json` | `kissing/actions/cup_face_while_kissing.action.json` | Cup Face While Kissing |

#### Kiss Ending Actions
| Source | Destination | Action Name |
|--------|-------------|-------------|
| `intimacy/actions/break_kiss_gently.action.json` | `kissing/actions/break_kiss_gently.action.json` | Break Kiss Gently |
| `intimacy/actions/pull_back_breathlessly.action.json` | `kissing/actions/pull_back_breathlessly.action.json` | Pull Back Breathlessly |
| `intimacy/actions/pull_back_in_revulsion.action.json` | `kissing/actions/pull_back_in_revulsion.action.json` | Pull Back in Revulsion |

#### Kiss Variation Actions
| Source | Destination | Action Name |
|--------|-------------|-------------|
| `intimacy/actions/kiss_neck_sensually.action.json` | `kissing/actions/kiss_neck_sensually.action.json` | Kiss Neck Sensually |
| `intimacy/actions/suck_on_neck_to_leave_hickey.action.json` | `kissing/actions/suck_on_neck_to_leave_hickey.action.json` | Suck on Neck to Leave Hickey |
| `intimacy/actions/nibble_earlobe_playfully.action.json` | `kissing/actions/nibble_earlobe_playfully.action.json` | Nibble Earlobe Playfully |

**For each action file**:

1. **Update ID**: `"id": "intimacy:action_name"` → `"id": "kissing:action_name"`
2. **Keep Rose Pink color scheme** (current intimacy colors):
   ```json
   "visualProperties": {
     "backgroundColor": "#ad1457",
     "textColor": "#ffffff",
     "hoverBackgroundColor": "#c2185b",
     "hoverTextColor": "#fce4ec"
   }
   ```
3. **Update target scope references**: `"intimacy:scope_name"` → `"kissing:scope_name"`
4. **Update rule reference**: `"rule": "intimacy:rule_name"` → `"rule": "kissing:rule_name"`
5. **Update condition reference**: `"condition": "intimacy:condition_name"` → `"condition": "kissing:condition_name"`

### 2. Migrate Rules (15 files)

Copy and update corresponding rule files (same names as actions):

**For each rule file**:

1. **Update rule_id**: `"rule_id": "intimacy:rule_name"` → `"rule_id": "kissing:rule_name"`
2. **Update action reference**: `"intimacy:action_name"` → `"kissing:action_name"`
3. **Update condition references**: `"intimacy:condition_name"` → `"kissing:condition_name"`
4. **Update scope references**: `"intimacy:scope_name"` → `"kissing:scope_name"`
5. **Update component references**: `"intimacy:kissing"` → `"kissing:kissing"`
6. **Update operation handlers** if they reference `LOCK_MOUTH_ENGAGEMENT` or component operations

**Special Rules Handling**:

- **Kiss Initiation Rules**: Add `kissing:kissing` component to both participants, lock mouth engagement
- **During Kiss Rules**: Maintain kissing state, check for `kissing:kissing` component
- **Kiss Ending Rules**: Remove `kissing:kissing` component, unlock mouth engagement

### 3. Migrate Conditions (17 files)

Copy and update condition files (15 action conditions + 2 special conditions):

#### Standard Conditions (15 files, match actions):
Same filenames as actions (e.g., `kiss_cheek.condition.json`, etc.)

#### Special Conditions (2 files):
| Source | Destination | Purpose |
|--------|-------------|---------|
| `intimacy/conditions/actor-is-kiss-receiver.condition.json` | `kissing/conditions/actor-is-kiss-receiver.condition.json` | Validate actor can receive kiss |
| `intimacy/conditions/target-is-kissing-partner.condition.json` | `kissing/conditions/target-is-kissing-partner.condition.json` | Validate target is current kissing partner |

**For each condition file**:

1. **Update condition ID**: `"id": "intimacy:condition_name"` → `"id": "kissing:condition_name"`
2. **Update action reference**: `"intimacy:action_name"` → `"kissing:action_name"`
3. **Update scope references**: `"intimacy:scope_name"` → `"kissing:scope_name"`
4. **Update component references**: `"intimacy:kissing"` → `"kissing:kissing"`

### 4. Migrate Component (1 file)

Copy and update the kissing state component:

| Source | Destination |
|--------|-------------|
| `intimacy/components/kissing.component.json` | `kissing/components/kissing.component.json` |

**Update component file**:

1. **Update component ID**: `"id": "intimacy:kissing"` → `"id": "kissing:kissing"`
2. **Verify schema structure**:
   ```json
   {
     "id": "kissing:kissing",
     "description": "Tracks an active kissing interaction between two characters",
     "dataSchema": {
       "type": "object",
       "required": ["partner", "initiator"],
       "properties": {
         "partner": {
           "type": "string",
           "description": "Entity ID of kissing partner"
         },
         "initiator": {
           "type": "boolean",
           "description": "Whether this character initiated the kiss"
         }
       }
     }
   }
   ```

### 5. Migrate Scopes (2 mod-specific + 2 shared)

#### Kissing-Specific Scopes

| Source | Destination |
|--------|-------------|
| `intimacy/scopes/current_kissing_partner.scope` | `kissing/scopes/current_kissing_partner.scope` |
| `intimacy/scopes/actors_with_mouth_facing_each_other.scope` | `kissing/scopes/actors_with_mouth_facing_each_other.scope` |

#### Shared Scopes (duplicate from intimacy)

| Source | Destination |
|--------|-------------|
| `intimacy/scopes/close_actors_facing_each_other.scope` | `kissing/scopes/close_actors_facing_each_other.scope` |
| `intimacy/scopes/close_actors_facing_each_other_or_behind_target.scope` | `kissing/scopes/close_actors_facing_each_other_or_behind_target.scope` |

**For each scope file**:

1. **Update scope ID**: `"id": "intimacy:scope_name"` → `"id": "kissing:scope_name"`
2. **Update component references**: `"intimacy:kissing"` → `"kissing:kissing"`

### 6. Update Mod Manifest

Update `data/mods/kissing/mod-manifest.json` with complete file listings:

```json
{
  "actions": [
    "kissing:kiss_cheek",
    "kissing:peck_on_lips",
    "kissing:lean_in_for_deep_kiss",
    "kissing:kiss_back_passionately",
    "kissing:accept_kiss_passively",
    "kissing:explore_mouth_with_tongue",
    "kissing:suck_on_tongue",
    "kissing:nibble_lower_lip",
    "kissing:cup_face_while_kissing",
    "kissing:break_kiss_gently",
    "kissing:pull_back_breathlessly",
    "kissing:pull_back_in_revulsion",
    "kissing:kiss_neck_sensually",
    "kissing:suck_on_neck_to_leave_hickey",
    "kissing:nibble_earlobe_playfully"
  ],
  "conditions": [
    "kissing:kiss_cheek",
    "kissing:peck_on_lips",
    "kissing:lean_in_for_deep_kiss",
    "kissing:kiss_back_passionately",
    "kissing:accept_kiss_passively",
    "kissing:explore_mouth_with_tongue",
    "kissing:suck_on_tongue",
    "kissing:nibble_lower_lip",
    "kissing:cup_face_while_kissing",
    "kissing:break_kiss_gently",
    "kissing:pull_back_breathlessly",
    "kissing:pull_back_in_revulsion",
    "kissing:kiss_neck_sensually",
    "kissing:suck_on_neck_to_leave_hickey",
    "kissing:nibble_earlobe_playfully",
    "kissing:actor-is-kiss-receiver",
    "kissing:target-is-kissing-partner"
  ],
  "components": [
    "kissing:kissing"
  ],
  "scopes": [
    "kissing:current_kissing_partner",
    "kissing:actors_with_mouth_facing_each_other",
    "kissing:close_actors_facing_each_other",
    "kissing:close_actors_facing_each_other_or_behind_target"
  ]
}
```

## Special Mechanics to Preserve

### 1. Mouth Engagement Locking

Ensure kiss initiation rules include:
```json
{
  "operation": "LOCK_MOUTH_ENGAGEMENT",
  "params": {
    "actor": "self",
    "partner": "target"
  }
}
```

And kiss ending rules include:
```json
{
  "operation": "UNLOCK_MOUTH_ENGAGEMENT",
  "params": {
    "actor": "self"
  }
}
```

### 2. Bilateral Component Management

Kiss initiation adds component to BOTH actors:
```json
{
  "operation": "ADD_COMPONENT",
  "params": {
    "entity": "self",
    "component": "kissing:kissing",
    "data": { "partner": "target", "initiator": true }
  }
},
{
  "operation": "ADD_COMPONENT",
  "params": {
    "entity": "target",
    "component": "kissing:kissing",
    "data": { "partner": "self", "initiator": false }
  }
}
```

### 3. Partner Tracking

The `current_kissing_partner` scope must correctly query the `kissing:kissing` component to find partner entity ID.

## ID Transformation Examples

### Action File Example

**Before** (`intimacy/actions/lean_in_for_deep_kiss.action.json`):
```json
{
  "id": "intimacy:lean_in_for_deep_kiss",
  "name": "Lean in for Deep Kiss",
  "visualProperties": {
    "backgroundColor": "#ad1457",
    "textColor": "#ffffff"
  },
  "rule": "intimacy:handle_lean_in_for_deep_kiss",
  "condition": "intimacy:lean_in_for_deep_kiss",
  "targetScope": "intimacy:actors_with_mouth_facing_each_other"
}
```

**After** (`kissing/actions/lean_in_for_deep_kiss.action.json`):
```json
{
  "id": "kissing:lean_in_for_deep_kiss",
  "name": "Lean in for Deep Kiss",
  "visualProperties": {
    "backgroundColor": "#ad1457",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#c2185b",
    "hoverTextColor": "#fce4ec"
  },
  "rule": "kissing:handle_lean_in_for_deep_kiss",
  "condition": "kissing:lean_in_for_deep_kiss",
  "targetScope": "kissing:actors_with_mouth_facing_each_other"
}
```

## Acceptance Criteria

- [ ] All 15 action files copied and updated with kissing: prefix
- [ ] All 15 rule files copied and updated with kissing: prefix
- [ ] All 17 condition files copied and updated with kissing: prefix
- [ ] kissing.component.json copied and updated with kissing: prefix
- [ ] All 4 scope files copied and updated (2 specific + 2 shared)
- [ ] Rose Pink color scheme (#ad1457) retained in all actions
- [ ] Mouth engagement locking operations preserved in rules
- [ ] Bilateral component management preserved in rules
- [ ] Partner tracking logic preserved in scopes
- [ ] All internal references updated (no intimacy: references remain)
- [ ] mod-manifest.json updated with complete file listings
- [ ] All JSON files are valid (no syntax errors)

## Validation Commands

```bash
# Count migrated files
ls -1 data/mods/kissing/actions/ | wc -l     # Should be 15
ls -1 data/mods/kissing/rules/ | wc -l       # Should be 15
ls -1 data/mods/kissing/conditions/ | wc -l  # Should be 17
ls -1 data/mods/kissing/components/ | wc -l  # Should be 1
ls -1 data/mods/kissing/scopes/ | wc -l      # Should be 4

# Check for intimacy references (should return nothing)
grep -r "intimacy:" data/mods/kissing/

# Verify component references are updated
grep -r "kissing:kissing" data/mods/kissing/

# Check mouth engagement operations
grep -r "LOCK_MOUTH_ENGAGEMENT\|UNLOCK_MOUTH_ENGAGEMENT" data/mods/kissing/rules/

# Validate JSON syntax
find data/mods/kissing/ -name "*.json" -exec jq . {} \;
```

## Next Steps

After completion, proceed to:
- **INTMODREF-004**: Migrate caressing mod content
- **INTMODREF-005**: Update dependent mods (parallel)

## Notes

- Kissing mod is the most complex with state management
- Component tracks bilateral kissing relationship
- Mouth engagement locking prevents multiple simultaneous kisses
- Kiss initiation, during, and ending have distinct rule patterns
- Color scheme intentionally kept from original intimacy mod
- Shared scopes duplicated to maintain mod independence
