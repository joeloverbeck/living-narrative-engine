# Ticket 06: Migrate turn_around Action and Rule

## Overview
**Phase**: 2 - Core Logic Migration  
**Priority**: Critical  
**Estimated Time**: 2-3 hours  
**Dependencies**: Tickets 04-05 (Component and Events Migration)  
**Implements**: Report section "Actions to Move" and "Rules to Move" - turn_around action/rule pair

## Objective
Migrate the `turn_around` action and its corresponding rule from the intimacy mod to the posturing mod, updating all namespace references and making the positioning logic domain-agnostic for use across combat, social, and intimate contexts.

## Background
**Files to Migrate**:
- `data/mods/intimacy/actions/turn_around.action.json` → `data/mods/posturing/actions/turn_around.action.json`
- `data/mods/intimacy/rules/turn_around.rule.json` → `data/mods/posturing/rules/turn_around.rule.json`

**Namespace Changes Required**:
- Action ID: `intimacy:turn_around` → `posturing:turn_around`
- Rule ID: `intimacy:turn_around` → `posturing:turn_around`
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Event references: `intimacy:actor_*` → `posturing:actor_*`

**From Migration Analysis**:
- Pure positioning logic with no intimacy-specific dependencies
- Generic action suitable for violence mod integration (backstab setups, defensive positioning)
- Referenced in multiple test cases and integration scenarios

## Implementation Tasks

### Task 6.1: Analyze Current turn_around Action
**Source File**: `data/mods/intimacy/actions/turn_around.action.json`

**Expected Structure** (namespace analysis required):
```json
{
  "id": "intimacy:turn_around",
  "name": "Turn Around",
  "description": "Turn the target around so they face away from you",
  "scope": "intimacy:close_actors_facing_each_other",
  "required_components": {
    "actor": ["core:actor"],
    "target": ["core:actor"]
  },
  "effects": {
    "add_components": {
      "target": {
        "intimacy:facing_away": {
          "facing_away_from": ["${actor}"]
        }
      }
    }
  }
}
```

### Task 6.2: Create Domain-Agnostic turn_around Action
**Target File**: `data/mods/posturing/actions/turn_around.action.json`

**Updated Content**:
```json
{
  "id": "posturing:turn_around",
  "name": "Turn Around",
  "description": "Turn the target around so they face away from you. Used for positioning in combat, social, and intimate scenarios.",
  "scope": "posturing:close_actors_facing_each_other",
  "required_components": {
    "actor": ["core:actor"],
    "target": ["core:actor"]
  },
  "effects": {
    "add_components": {
      "target": {
        "posturing:facing_away": {
          "facing_away_from": ["${actor}"]
        }
      }
    }
  }
}
```

### Task 6.3: Analyze Current turn_around Rule
**Source File**: `data/mods/intimacy/rules/turn_around.rule.json`

**Expected Structure** (namespace analysis required):
```json
{
  "id": "intimacy:turn_around",
  "description": "Handles the turn around action",
  "condition": {
    "and": [
      {"==": [{"var": "event.type"}, "core:attempt_action"]},
      {"==": [{"var": "event.payload.action.id"}, "intimacy:turn_around"]}
    ]
  },
  "actions": [
    {
      "type": "dispatch_event",
      "event": {
        "type": "intimacy:actor_turned_around",
        "payload": {
          "actor": {"var": "event.payload.action.target"},
          "turned_by": {"var": "event.payload.action.actor"}
        }
      }
    },
    {
      "type": "dispatch_event", 
      "event": {
        "type": "intimacy:actor_faced_forward",
        "payload": {
          "actor": {"var": "event.payload.action.actor"},
          "facing": {"var": "event.payload.action.target"}
        }
      }
    }
  ]
}
```

### Task 6.4: Create Domain-Agnostic turn_around Rule
**Target File**: `data/mods/posturing/rules/turn_around.rule.json`

**Updated Content**:
```json
{
  "id": "posturing:turn_around",
  "description": "Handles the turn around action for spatial positioning across all game contexts",
  "condition": {
    "and": [
      {"==": [{"var": "event.type"}, "core:attempt_action"]},
      {"==": [{"var": "event.payload.action.id"}, "posturing:turn_around"]}
    ]
  },
  "actions": [
    {
      "type": "dispatch_event",
      "event": {
        "type": "posturing:actor_turned_around",
        "payload": {
          "actor": {"var": "event.payload.action.target"},
          "turned_by": {"var": "event.payload.action.actor"}
        }
      }
    },
    {
      "type": "dispatch_event", 
      "event": {
        "type": "posturing:actor_faced_forward",
        "payload": {
          "actor": {"var": "event.payload.action.actor"},
          "facing": {"var": "event.payload.action.target"}
        }
      }
    }
  ]
}
```

### Task 6.5: Scope Dependency Analysis
**Issue**: Action references `intimacy:close_actors_facing_each_other` scope

**Resolution Options**:
1. **Option A**: Wait for scope migration (Ticket 09) then update reference
2. **Option B**: Create posturing version of scope immediately
3. **Option C**: Use generic scope temporarily

**Recommended**: Option A - Update action in phase 3 when scope is migrated

**Temporary Solution**: Keep intimacy scope reference until ticket 09 completion, then update in ticket 11

## Implementation Steps

### Step 1: Read and Backup Current Files
```bash
# Read current action and rule
cat data/mods/intimacy/actions/turn_around.action.json
cat data/mods/intimacy/rules/turn_around.rule.json

# Verify posturing directories exist
ls -la data/mods/posturing/actions/
ls -la data/mods/posturing/rules/
```

### Step 2: Create Posturing Action
```bash
# Copy action file
cp data/mods/intimacy/actions/turn_around.action.json data/mods/posturing/actions/

# Edit posturing version:
# - Update id: intimacy:turn_around → posturing:turn_around
# - Update description to be domain-agnostic
# - Update component reference: intimacy:facing_away → posturing:facing_away
# - Keep scope reference as intimacy:close_actors_facing_each_other for now
```

### Step 3: Create Posturing Rule
```bash
# Copy rule file
cp data/mods/intimacy/rules/turn_around.rule.json data/mods/posturing/rules/

# Edit posturing version:
# - Update id: intimacy:turn_around → posturing:turn_around
# - Update description to be domain-agnostic
# - Update action condition: intimacy:turn_around → posturing:turn_around
# - Update event references: intimacy:actor_* → posturing:actor_*
```

### Step 4: Validate Action and Rule Loading
```bash
# Test loading
npm run dev

# Check console for:
# - posturing:turn_around action registered
# - posturing:turn_around rule registered
# - No validation errors
# - Action appears in available actions (if applicable)
```

## Acceptance Criteria

### ✅ Action Migration
- [ ] `turn_around.action.json` copied to posturing mod
- [ ] Action ID updated to `posturing:turn_around`
- [ ] Description updated to be domain-agnostic
- [ ] Component reference updated to `posturing:facing_away`
- [ ] Scope reference documented for later update

### ✅ Rule Migration
- [ ] `turn_around.rule.json` copied to posturing mod
- [ ] Rule ID updated to `posturing:turn_around`
- [ ] Description updated to be domain-agnostic
- [ ] Action condition updated to match new action ID
- [ ] Event references updated to posturing namespace

### ✅ Functional Validation
- [ ] Action registers successfully under posturing namespace
- [ ] Rule registers successfully under posturing namespace
- [ ] No validation errors during loading
- [ ] Action-rule pair properly linked

### ✅ Integration Testing
- [ ] Development server starts without errors
- [ ] Action and rule appear in respective inventories
- [ ] Rule properly triggers on action attempt
- [ ] Events are dispatched correctly

## Risk Assessment

### 🚨 Potential Issues
1. **Scope Reference Broken**: Action references intimacy scope that might not work
2. **Event Reference Errors**: Rule references events that might not be found
3. **Component Reference Issues**: Action uses component that might not be available
4. **Action-Rule Mismatch**: IDs might not match between action and rule

### 🛡️ Risk Mitigation
1. **Scope Dependency**: Keep intimacy scope reference until scope migration complete
2. **Event Verification**: Ensure events from ticket 05 are working
3. **Component Dependency**: Verify component from ticket 04 is available
4. **ID Consistency**: Double-check all ID updates match between action and rule

## Test Cases

### Test Case 1: Action Registration
```bash
npm run dev
# Expected: "posturing:turn_around action registered"
# Expected: No validation errors
```

### Test Case 2: Rule Registration  
```bash
npm run dev
# Expected: "posturing:turn_around rule registered"
# Expected: Rule condition validates correctly
```

### Test Case 3: Action-Rule Integration
```bash
# Test action execution triggers rule
# Expected: Rule processes posturing:turn_around action attempts
# Expected: Correct events dispatched
```

### Test Case 4: Event Dispatching
```bash
# Execute turn around action
# Expected: posturing:actor_turned_around event dispatched
# Expected: posturing:actor_faced_forward event dispatched
```

## File Changes Summary

### New Files Created
- `data/mods/posturing/actions/turn_around.action.json`
- `data/mods/posturing/rules/turn_around.rule.json`

### Namespace Changes Applied
- **Action ID**: `intimacy:turn_around` → `posturing:turn_around`
- **Rule ID**: `intimacy:turn_around` → `posturing:turn_around`
- **Component Reference**: `intimacy:facing_away` → `posturing:facing_away`
- **Event References**: `intimacy:actor_*` → `posturing:actor_*`

### Scope Reference Status
- **Current**: `intimacy:close_actors_facing_each_other` (temporary)
- **Future**: Will be updated to `posturing:close_actors_facing_each_other` in ticket 11

## Success Metrics
- **Zero** action/rule loading errors
- **Successful** registration under posturing namespace
- **Proper** action-rule linkage maintained
- **Correct** event dispatching functionality

## Dependencies for Next Tickets
- **Ticket 07**: turn_around_to_face action/rule migration
- **Ticket 08**: Conditions may reference turn_around action
- **Ticket 09**: Scope migration will enable scope reference update
- **Ticket 11**: Intimacy action updates will handle scope reference

## Known Temporary Dependencies
- **Scope Reference**: Action temporarily references `intimacy:close_actors_facing_each_other`
- **Resolution**: Will be updated in ticket 11 after scope migration (ticket 09)

## Post-Migration Notes
After completion:
1. **Document** temporary scope dependency
2. **Verify** action-rule pair works correctly
3. **Test** that events are properly dispatched
4. **Prepare** for turn_around_to_face migration in ticket 07

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Core Migration Phase