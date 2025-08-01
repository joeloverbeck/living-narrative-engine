# Ticket 12: Update Intimacy Rules to Use Posturing Namespace

## Overview
**Phase**: 3 - Intimacy Mod Refactoring  
**Priority**: High  
**Estimated Time**: 2-3 hours  
**Dependencies**: Ticket 11 (Intimacy Actions Update)  
**Implements**: Report section "Intimacy Mod Refactoring" - rule namespace updates

## Objective
Update all intimacy mod rules to reference the new posturing namespace for positioning components, events, conditions, and scopes, ensuring intimate rule logic properly integrates with the migrated positioning system.

## Background
**Namespace Updates Required**:
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Event references: `intimacy:actor_*` → `posturing:actor_*` 
- Condition references: `intimacy:positioning-conditions` → `posturing:positioning-conditions`
- Scope references: Conditional based on ticket 09 migration results
- Action references: `intimacy:turn_around*` → `posturing:turn_around*`

**From Migration Analysis**:
- Intimacy rules handle intimate actions that may use positioning logic
- Rules dispatch positioning events as part of intimate interactions
- Rules check positioning conditions for intimate action requirements
- Rules should maintain intimate context while using generic positioning

## Implementation Tasks

### Task 12.1: Identify Rules Using Positioning References
**Search Strategy**:
```bash
# Find rules referencing positioning components
grep -r "intimacy:facing_away" data/mods/intimacy/rules/

# Find rules checking positioning conditions
grep -r "intimacy:.*-facing\|intimacy:.*-behind" data/mods/intimacy/rules/

# Find rules dispatching positioning events
grep -r "intimacy:actor_turned_around\|intimacy:actor_faced" data/mods/intimacy/rules/

# Find rules using positioning scopes
grep -r "facing_away\|close_actors_facing" data/mods/intimacy/rules/

# Find rules referencing positioning actions
grep -r "intimacy:turn_around" data/mods/intimacy/rules/
```

### Task 12.2: Update Component References in Rules
**Pattern to Find and Replace**:
```json
// Current pattern in rules:
{
  "condition": {
    "==": [
      {"var": "target.intimacy:facing_away.facing_away_from"},
      ["${actor}"]
    ]
  }
}

// Updated pattern:
{
  "condition": {
    "==": [
      {"var": "target.posturing:facing_away.facing_away_from"},
      ["${actor}"]
    ]
  }
}
```

### Task 12.3: Update Event References in Rules
**Event Dispatch Updates**:
```json
// Current event dispatching in rules:
{
  "type": "dispatch_event",
  "event": {
    "type": "intimacy:actor_turned_around",
    "payload": {
      "actor": {"var": "event.payload.action.target"},
      "turned_by": {"var": "event.payload.action.actor"}
    }
  }
}

// Updated event dispatching:
{
  "type": "dispatch_event",
  "event": {
    "type": "posturing:actor_turned_around",
    "payload": {
      "actor": {"var": "event.payload.action.target"},
      "turned_by": {"var": "event.payload.action.actor"}
    }
  }
}
```

### Task 12.4: Update Condition References in Rules
**Condition Check Updates**:
```json
// Current condition checks in rules:
{
  "condition": {
    "and": [
      {"==": [{"var": "event.type"}, "core:attempt_action"]},
      {
        "eval_condition": {
          "condition": "intimacy:actor-is-behind-entity",
          "context": {
            "actor": {"var": "event.payload.action.actor"},
            "target": {"var": "event.payload.action.target"}
          }
        }
      }
    ]
  }
}

// Updated condition checks:
{
  "condition": {
    "and": [
      {"==": [{"var": "event.type"}, "core:attempt_action"]},
      {
        "eval_condition": {
          "condition": "posturing:actor-is-behind-entity",
          "context": {
            "actor": {"var": "event.payload.action.actor"},
            "target": {"var": "event.payload.action.target"}
          }
        }
      }
    ]
  }
}
```

### Task 12.5: Update Action References in Rules
**Action Reference Updates**:
```json
// Current action references in rules:
{
  "condition": {
    "==": [{"var": "event.payload.action.id"}, "intimacy:turn_around"]
  }
}

// Updated action references:
{
  "condition": {
    "==": [{"var": "event.payload.action.id"}, "posturing:turn_around"]
  }
}
```

### Task 12.6: Handle Scope References (Conditional)
**Based on Ticket 09 Results**:

**If scopes migrated to posturing**:
```json
// Update scope references in rule conditions:
"scope_query": {
  "scope": "posturing:actors_im_facing_away_from",
  "context": {"actor": {"var": "event.payload.action.actor"}}
}
```

**If scopes remained in intimacy**:
```json
// Keep existing scope references:
"scope_query": {
  "scope": "intimacy:actors_im_facing_away_from", 
  "context": {"actor": {"var": "event.payload.action.actor"}}
}
```

## Implementation Steps

### Step 1: Comprehensive Rule Analysis
```bash
# Navigate to intimacy rules directory
cd data/mods/intimacy/rules/

# Create backup
cp -r . ../rules-backup/

# Search for positioning references
echo "=== Component References ==="
grep -l "intimacy:facing_away" *.json

echo "=== Event References ==="
grep -l "intimacy:actor_turned_around\|intimacy:actor_faced" *.json

echo "=== Condition References ==="
grep -l "intimacy:.*-facing\|intimacy:.*-behind" *.json

echo "=== Action References ==="
grep -l "intimacy:turn_around" *.json

echo "=== Scope References ==="
grep -l "facing_away\|actors_im_facing" *.json
```

### Step 2: Update Component References
```bash
# For each rule file with component references:
# Replace all instances of intimacy:facing_away with posturing:facing_away

# Example using sed:
# find . -name "*.json" -exec sed -i 's/intimacy:facing_away/posturing:facing_away/g' {} \;
```

### Step 3: Update Event References
```bash
# Replace event type references in dispatch_event actions:
# - "intimacy:actor_turned_around" → "posturing:actor_turned_around"
# - "intimacy:actor_faced_everyone" → "posturing:actor_faced_everyone"
# - "intimacy:actor_faced_forward" → "posturing:actor_faced_forward"
```

### Step 4: Update Condition References
```bash
# Replace condition evaluation references:
# - "intimacy:both-actors-facing-each-other" → "posturing:both-actors-facing-each-other"
# - "intimacy:actor-is-behind-entity" → "posturing:actor-is-behind-entity"
# - "intimacy:entity-not-in-facing-away" → "posturing:entity-not-in-facing-away"
# - "intimacy:actor-in-entity-facing-away" → "posturing:actor-in-entity-facing-away"
# - "intimacy:entity-in-facing-away" → "posturing:entity-in-facing-away"
```

### Step 5: Update Action References
```bash
# Replace action ID references in rule conditions:
# - "intimacy:turn_around" → "posturing:turn_around"
# - "intimacy:turn_around_to_face" → "posturing:turn_around_to_face"
```

### Step 6: Update Scope References (Conditional)
```bash
# Based on ticket 09 results, update scope references:
# If migrated: intimacy scope references → posturing scope references
# If not migrated: keep existing intimacy scope references
```

### Step 7: Validate Updated Rules
```bash
# Test rule loading and functionality
npm run dev

# Check console for:
# - All intimacy rules load successfully
# - No reference resolution errors
# - Rules can access posturing content
# - Rule conditions evaluate correctly
# - Event dispatching works properly
```

## Acceptance Criteria

### ✅ Component Reference Updates
- [ ] All `intimacy:facing_away` references updated to `posturing:facing_away`
- [ ] Component variable paths resolve correctly in rule conditions
- [ ] Rules can read and modify posturing facing_away component
- [ ] No broken component reference errors

### ✅ Event Reference Updates
- [ ] All positioning event types updated to posturing namespace
- [ ] Event dispatching works correctly with updated references
- [ ] Event payloads are properly formatted
- [ ] No event dispatch errors occur

### ✅ Condition Reference Updates
- [ ] All positioning condition references updated to posturing namespace
- [ ] Condition evaluation works correctly in rule logic
- [ ] Rules can properly gate actions based on positioning conditions
- [ ] No condition evaluation errors occur

### ✅ Action Reference Updates
- [ ] All positioning action references updated to posturing namespace
- [ ] Rules properly recognize posturing actions in event handling
- [ ] Action matching logic works correctly
- [ ] No action reference resolution errors

### ✅ Scope Reference Updates
- [ ] Scope references updated based on ticket 09 migration results
- [ ] Scope queries resolve correctly in rule conditions
- [ ] Rules can properly query positioning-related scopes
- [ ] No scope resolution errors occur

### ✅ Functional Validation
- [ ] All intimacy rules load without errors
- [ ] Rule logic executes correctly with updated references
- [ ] Cross-mod integration with posturing works properly
- [ ] No regression in rule functionality

## Risk Assessment

### 🚨 Potential Issues
1. **Complex Rule Logic**: Rules may have intricate positioning logic that's hard to update
2. **Nested References**: Component paths in complex JSON Logic conditions
3. **Event Payload Mismatches**: Updated event types might not match expected payloads
4. **Condition Evaluation Failures**: Updated condition references might not evaluate correctly
5. **Scope Dependency Confusion**: Unclear which scopes migrated vs. remained

### 🛡️ Risk Mitigation
1. **Systematic Approach**: Update one type of reference at a time
2. **JSON Validation**: Validate JSON syntax after each batch of changes
3. **Reference Testing**: Test each type of reference update independently
4. **Incremental Testing**: Test rules individually before testing as a group
5. **Backup and Rollback**: Maintain backups for quick rollback if needed

## Test Cases

### Test Case 1: Component Path Resolution
```bash
# Test rules accessing posturing:facing_away component
# Expected: Component paths resolve correctly in rule conditions
# Expected: Rules can read component data properly
```

### Test Case 2: Event Dispatching
```bash
# Test rules dispatching posturing events
# Expected: Events dispatch successfully with correct types
# Expected: Event payloads are properly formatted
```

### Test Case 3: Condition Evaluation
```bash
# Test rules evaluating posturing conditions
# Expected: Conditions evaluate correctly in rule logic
# Expected: Rules properly gate actions based on conditions
```

### Test Case 4: Action Recognition
```bash
# Test rules handling posturing actions
# Expected: Rules recognize posturing action IDs correctly
# Expected: Action matching logic works properly
```

### Test Case 5: Scope Queries
```bash
# Test rules using positioning scopes
# Expected: Scope queries resolve correctly
# Expected: Rules receive expected entity lists from scopes
```

### Test Case 6: Rule Integration
```bash
# Test complete rule workflows with updated references
# Expected: Rules execute end-to-end without errors
# Expected: Intimate behaviors work with generic positioning
```

## File Changes Summary

### Rules Requiring Updates
- Any rule referencing `intimacy:facing_away` component
- Any rule dispatching positioning events
- Any rule evaluating positioning conditions  
- Any rule handling positioning actions
- Any rule using positioning scopes

### Namespace Changes Applied
- **Components**: `intimacy:facing_away` → `posturing:facing_away`
- **Events**: `intimacy:actor_*` → `posturing:actor_*`
- **Conditions**: `intimacy:positioning-*` → `posturing:positioning-*`
- **Actions**: `intimacy:turn_around*` → `posturing:turn_around*`
- **Scopes**: Conditional based on ticket 09 results

### JSON Logic Patterns Updated
- Component variable paths in conditions
- Event type specifications in dispatch actions
- Condition evaluation calls
- Action ID matching in conditions
- Scope query specifications

## Success Metrics
- **Zero** rule loading errors
- **All** intimacy rules function correctly with updated references
- **Proper** cross-mod integration with posturing
- **Maintained** intimate rule behavior with generic positioning

## Cross-Integration Validation

### Intimacy-Posturing Integration Points
- **Component Access**: Rules read/modify `posturing:facing_away`
- **Event Dispatching**: Rules dispatch `posturing:actor_*` events
- **Condition Evaluation**: Rules check `posturing:positioning-*` conditions
- **Action Handling**: Rules process `posturing:turn_around*` actions
- **Scope Queries**: Rules query positioning-related scopes

### Expected Integration Behavior
- Intimate rules maintain intimate context and requirements
- Positioning logic is generic and reusable across contexts
- Clean separation between intimate behavior and spatial mechanics
- Violence mod can use same positioning system for combat

## Dependencies for Next Tickets
- **Ticket 13**: Intimacy scopes updates will complete the namespace migration
- **Tickets 14-16**: Tests will validate the updated rule behavior
- **Future Violence Integration**: Updated rules demonstrate cross-mod positioning patterns

## Post-Implementation Validation
After completion:
1. **Rule Functionality**: All intimacy rules work correctly with posturing references
2. **Cross-Mod Integration**: Seamless integration between intimacy and posturing systems
3. **Behavior Preservation**: Intimate rule logic maintains its intimate context
4. **Generic Positioning**: Spatial positioning logic is properly separated and reusable

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Intimacy Refactoring Phase