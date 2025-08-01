# Ticket 07: Migrate turn_around_to_face Action and Rule

## Overview
**Phase**: 2 - Core Logic Migration  
**Priority**: Critical  
**Estimated Time**: 2-3 hours  
**Dependencies**: Ticket 06 (turn_around Action/Rule Migration)  
**Implements**: Report section "Actions to Move" and "Rules to Move" - turn_around_to_face action/rule pair

## Objective
Migrate the `turn_around_to_face` action and its corresponding rule from the intimacy mod to the posturing mod, updating namespace references and making the facing logic domain-agnostic for multiple game contexts.

## Background
**Files to Migrate**:
- `data/mods/intimacy/actions/turn_around_to_face.action.json` → `data/mods/posturing/actions/turn_around_to_face.action.json`
- `data/mods/intimacy/rules/turn_around_to_face.rule.json` → `data/mods/posturing/rules/turn_around_to_face.rule.json`

**Namespace Changes Required**:
- Action ID: `intimacy:turn_around_to_face` → `posturing:turn_around_to_face`
- Rule ID: `intimacy:turn_around_to_face` → `posturing:turn_around_to_face`
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Event references: `intimacy:actor_*` → `posturing:actor_*`

**From Migration Analysis**:
- Generic facing change action applicable to all contexts
- Used in `turn_around_to_face.rule.json` for state transitions
- Critical for combat scenarios (face attackers), social scenarios (acknowledge speakers)
- No intimacy-specific logic in implementation

## Implementation Tasks

### Task 7.1: Analyze Current turn_around_to_face Action
**Source File**: `data/mods/intimacy/actions/turn_around_to_face.action.json`

**Expected Structure** (needs analysis):
```json
{
  "id": "intimacy:turn_around_to_face",
  "name": "Turn Around to Face",
  "description": "Turn around to face everyone you were facing away from",
  "scope": "actors_im_facing_away_from",
  "required_components": {
    "actor": ["core:actor", "intimacy:facing_away"]
  },
  "effects": {
    "remove_components": {
      "actor": ["intimacy:facing_away"]
    }
  }
}
```

### Task 7.2: Create Domain-Agnostic turn_around_to_face Action
**Target File**: `data/mods/posturing/actions/turn_around_to_face.action.json`

**Updated Content**:
```json
{
  "id": "posturing:turn_around_to_face",
  "name": "Turn Around to Face",
  "description": "Turn around to face everyone you were facing away from. Used for combat readiness, social acknowledgment, and intimate engagement.",
  "scope": "posturing:actors_im_facing_away_from",
  "required_components": {
    "actor": ["core:actor", "posturing:facing_away"]
  },
  "effects": {
    "remove_components": {
      "actor": ["posturing:facing_away"]
    }
  }
}
```

### Task 7.3: Analyze Current turn_around_to_face Rule
**Source File**: `data/mods/intimacy/rules/turn_around_to_face.rule.json`

**Expected Structure** (needs analysis):
```json
{
  "id": "intimacy:turn_around_to_face",
  "description": "Handles the turn around to face action",
  "condition": {
    "and": [
      {"==": [{"var": "event.type"}, "core:attempt_action"]},
      {"==": [{"var": "event.payload.action.id"}, "intimacy:turn_around_to_face"]}
    ]
  },
  "actions": [
    {
      "type": "dispatch_event",
      "event": {
        "type": "intimacy:actor_faced_everyone",
        "payload": {
          "actor": {"var": "event.payload.action.actor"},
          "faced": {"var": "event.payload.action.target"}
        }
      }
    }
  ]
}
```

### Task 7.4: Create Domain-Agnostic turn_around_to_face Rule
**Target File**: `data/mods/posturing/rules/turn_around_to_face.rule.json`

**Updated Content**:
```json
{
  "id": "posturing:turn_around_to_face",
  "description": "Handles the turn around to face action for spatial positioning across all game contexts",
  "condition": {
    "and": [
      {"==": [{"var": "event.type"}, "core:attempt_action"]},
      {"==": [{"var": "event.payload.action.id"}, "posturing:turn_around_to_face"]}
    ]
  },
  "actions": [
    {
      "type": "dispatch_event",
      "event": {
        "type": "posturing:actor_faced_everyone",
        "payload": {
          "actor": {"var": "event.payload.action.actor"},
          "faced": {"var": "event.payload.action.target"}
        }
      }
    }
  ]
}
```

### Task 7.5: Scope Dependency Analysis
**Scope Reference**: `posturing:actors_im_facing_away_from`

**Status**: This scope will be migrated in ticket 09. The action needs to reference the posturing version immediately since it directly uses the facing_away component.

**Dependency Chain**:
1. Action requires `posturing:facing_away` component (✅ migrated in ticket 04)
2. Action uses `posturing:actors_im_facing_away_from` scope (⏳ will migrate in ticket 09)
3. Rule dispatches `posturing:actor_faced_everyone` event (✅ migrated in ticket 05)

**Resolution**: Action scope reference will be updated when scope is migrated.

## Implementation Steps

### Step 1: Read and Backup Current Files
```bash
# Read current action and rule
cat data/mods/intimacy/actions/turn_around_to_face.action.json
cat data/mods/intimacy/rules/turn_around_to_face.rule.json

# Verify structure matches expected format
# Note any deviations from expected structure
```

### Step 2: Create Posturing Action
```bash
# Copy action file
cp data/mods/intimacy/actions/turn_around_to_face.action.json data/mods/posturing/actions/

# Edit posturing version:
# - Update id: intimacy:turn_around_to_face → posturing:turn_around_to_face
# - Update description to be domain-agnostic
# - Update scope reference: scope → posturing:actors_im_facing_away_from (temporary)
# - Update component reference: intimacy:facing_away → posturing:facing_away
```

### Step 3: Create Posturing Rule
```bash
# Copy rule file
cp data/mods/intimacy/rules/turn_around_to_face.rule.json data/mods/posturing/rules/

# Edit posturing version:
# - Update id: intimacy:turn_around_to_face → posturing:turn_around_to_face
# - Update description to be domain-agnostic
# - Update action condition: intimacy:turn_around_to_face → posturing:turn_around_to_face
# - Update event reference: intimacy:actor_faced_everyone → posturing:actor_faced_everyone
```

### Step 4: Validate Action and Rule Loading
```bash
# Test loading
npm run dev

# Check console for:
# - posturing:turn_around_to_face action registered
# - posturing:turn_around_to_face rule registered
# - No validation errors
# - Scope reference validation (may show warning until scope migration)
```

## Acceptance Criteria

### ✅ Action Migration
- [ ] `turn_around_to_face.action.json` copied to posturing mod
- [ ] Action ID updated to `posturing:turn_around_to_face`
- [ ] Description updated to be domain-agnostic
- [ ] Component reference updated to `posturing:facing_away`
- [ ] Scope reference updated to `posturing:actors_im_facing_away_from`

### ✅ Rule Migration  
- [ ] `turn_around_to_face.rule.json` copied to posturing mod
- [ ] Rule ID updated to `posturing:turn_around_to_face`
- [ ] Description updated to be domain-agnostic
- [ ] Action condition updated to match new action ID
- [ ] Event reference updated to `posturing:actor_faced_everyone`

### ✅ Functional Validation
- [ ] Action registers successfully under posturing namespace
- [ ] Rule registers successfully under posturing namespace
- [ ] No critical validation errors during loading
- [ ] Action-rule pair properly linked

### ✅ Integration Testing
- [ ] Development server starts without errors
- [ ] Action and rule appear in respective inventories
- [ ] Rule properly triggers on action attempt
- [ ] Event is dispatched correctly

## Risk Assessment

### 🚨 Potential Issues
1. **Scope Reference Issues**: Action references scope that may not exist yet
2. **Component Dependency**: Action requires posturing:facing_away component
3. **Event Reference Errors**: Rule references event that might not be available
4. **Action Logic Compatibility**: Component removal effects might not work

### 🛡️ Risk Mitigation
1. **Scope Planning**: Document scope dependency for ticket 09
2. **Component Verification**: Ensure facing_away component from ticket 04 is working
3. **Event Verification**: Confirm actor_faced_everyone event from ticket 05 is available
4. **Effect Testing**: Test component removal effects work correctly

## Test Cases

### Test Case 1: Action Registration
```bash
npm run dev
# Expected: "posturing:turn_around_to_face action registered"
# Expected: No critical validation errors
# May show scope reference warning until ticket 09
```

### Test Case 2: Rule Registration
```bash
npm run dev
# Expected: "posturing:turn_around_to_face rule registered"
# Expected: Rule condition validates correctly
```

### Test Case 3: Component Dependencies
```bash
# Test that action can access posturing:facing_away component
# Expected: Action can query actors with facing_away component
# Expected: Action can remove facing_away component
```

### Test Case 4: Event Dispatching
```bash
# Execute turn around to face action
# Expected: posturing:actor_faced_everyone event dispatched
# Expected: Event payload contains correct actor and faced information
```

## File Changes Summary  

### New Files Created
- `data/mods/posturing/actions/turn_around_to_face.action.json`
- `data/mods/posturing/rules/turn_around_to_face.rule.json`

### Namespace Changes Applied
- **Action ID**: `intimacy:turn_around_to_face` → `posturing:turn_around_to_face`
- **Rule ID**: `intimacy:turn_around_to_face` → `posturing:turn_around_to_face`
- **Component Reference**: `intimacy:facing_away` → `posturing:facing_away`
- **Event Reference**: `intimacy:actor_faced_everyone` → `posturing:actor_faced_everyone`
- **Scope Reference**: `intimacy:actors_im_facing_away_from` → `posturing:actors_im_facing_away_from`

### Domain-Agnostic Enhancements
- **Description**: Added combat readiness, social acknowledgment contexts
- **Use Cases**: Expanded from intimate-only to multi-context positioning
- **Applicability**: Made suitable for violence mod integration

## Success Metrics
- **Zero** critical loading errors
- **Successful** registration under posturing namespace
- **Proper** action-rule linkage maintained  
- **Correct** event dispatching functionality
- **Component** effects work properly (facing_away removal)

## Dependencies and Blockers

### ✅ Dependencies Met
- **Component**: `posturing:facing_away` available from ticket 04
- **Event**: `posturing:actor_faced_everyone` available from ticket 05
- **Infrastructure**: Posturing mod foundation complete from tickets 01-03

### ⏳ Future Dependencies
- **Scope**: `posturing:actors_im_facing_away_from` will be available after ticket 09
- **Integration**: Full functionality after scope migration complete

## Known Temporary Issues
- **Scope Reference**: May show warnings until `actors_im_facing_away_from` scope migrated in ticket 09
- **Resolution**: Warnings are expected and will resolve after scope migration

## Dependencies for Next Tickets
- **Ticket 08**: Conditions may reference turn_around_to_face action
- **Ticket 09**: Scope migration critical for full functionality
- **Ticket 11**: Intimacy updates will handle any remaining scope references

## Post-Migration Notes
After completion:
1. **Document** scope dependency for ticket 09
2. **Test** component removal effects work correctly
3. **Verify** event dispatching functions properly
4. **Prepare** for conditions migration in ticket 08

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Core Migration Phase