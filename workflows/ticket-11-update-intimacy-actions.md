# Ticket 11: Update Intimacy Actions to Use Posturing Namespace

## Overview
**Phase**: 3 - Intimacy Mod Refactoring  
**Priority**: High  
**Estimated Time**: 3-4 hours  
**Dependencies**: Ticket 10 (Intimacy Manifest Update)  
**Implements**: Report section "Intimacy Mod Refactoring" - action namespace updates

## Objective
Update all intimacy mod actions to reference the new posturing namespace for positioning components, events, and scopes, ensuring seamless integration between intimacy-specific actions and the migrated positioning system.

## Background
**Namespace Updates Required**:
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Event references: `intimacy:actor_*` → `posturing:actor_*`
- Scope references: `intimacy:*_facing_*` → `posturing:*_facing_*` (conditional based on ticket 09)
- Action references: `intimacy:turn_around*` → `posturing:turn_around*`

**From Migration Analysis**:
- Actions like `massage_back` and `place_hand_on_waist` require behind positioning
- These actions need intimate context but use generic positioning logic
- Actions should use posturing positioning while maintaining intimate behavior

## Implementation Tasks

### Task 11.1: Identify Actions Using Positioning References
**High-Priority Actions** (from report analysis):
- `massage_back.action.json` - Requires behind position + intimate context
- `place_hand_on_waist.action.json` - Intimate behind-position action

**Additional Actions to Analyze**:
- Any action referencing `intimacy:facing_away` component
- Any action using positioning scopes
- Any action dispatching positioning events

### Task 11.2: Update massage_back Action
**File**: `data/mods/intimacy/actions/massage_back.action.json`

**Expected Current References**:
```json
{
  "id": "intimacy:massage_back",
  "name": "Massage Back",
  "scope": "actors_with_back_behind_actor_in_intimacy",
  "required_components": {
    "target": ["anatomy:back", "intimacy:facing_away"]
  },
  "required_conditions": [
    "intimacy:actor-is-behind-entity"
  ]
}
```

**Updated References**:
```json
{
  "id": "intimacy:massage_back",
  "name": "Massage Back",
  "scope": "actors_with_back_behind_actor_in_intimacy",
  "required_components": {
    "target": ["anatomy:back", "posturing:facing_away"]
  },
  "required_conditions": [
    "posturing:actor-is-behind-entity"
  ]
}
```

### Task 11.3: Update place_hand_on_waist Action
**File**: `data/mods/intimacy/actions/place_hand_on_waist.action.json`

**Expected Current References**:
```json
{
  "id": "intimacy:place_hand_on_waist",
  "name": "Place Hand on Waist",
  "scope": "actors_with_waist_behind_actor_in_intimacy",
  "required_components": {
    "target": ["anatomy:waist", "intimacy:facing_away"]
  },
  "required_conditions": [
    "intimacy:actor-is-behind-entity"
  ]
}
```

**Updated References**:
```json
{
  "id": "intimacy:place_hand_on_waist",
  "name": "Place Hand on Waist",
  "scope": "actors_with_waist_behind_actor_in_intimacy",
  "required_components": {
    "target": ["anatomy:waist", "posturing:facing_away"]
  },
  "required_conditions": [
    "posturing:actor-is-behind-entity"
  ]
}
```

### Task 11.4: Comprehensive Action Analysis and Updates
**Search Strategy**:
1. Search all intimacy actions for `intimacy:facing_away` references
2. Search all intimacy actions for positioning condition references
3. Search all intimacy actions for positioning event references
4. Search all intimacy actions for positioning scope references

**Systematic Update Process**:
```bash
# Find all actions with positioning references
grep -r "intimacy:facing_away" data/mods/intimacy/actions/
grep -r "intimacy:actor_turned_around" data/mods/intimacy/actions/
grep -r "intimacy:actor_faced" data/mods/intimacy/actions/
grep -r "intimacy:both-actors-facing" data/mods/intimacy/actions/
grep -r "intimacy:actor-is-behind" data/mods/intimacy/actions/
grep -r "intimacy:entity.*facing" data/mods/intimacy/actions/
```

### Task 11.5: Handle Scope Reference Updates
**Scope Update Strategy** (based on ticket 09 results):

**If actors_im_facing_away_from migrated**:
```json
// Update references from:
"scope": "intimacy:actors_im_facing_away_from"
// To:
"scope": "posturing:actors_im_facing_away_from"
```

**If close_actors_facing_away migrated**:
```json
// Update references from:
"scope": "intimacy:close_actors_facing_away" 
// To:
"scope": "posturing:close_actors_facing_away"
```

**If scopes remained in intimacy**:
```json
// Keep existing references:
"scope": "intimacy:close_actors_facing_away"
```

## Implementation Steps

### Step 1: Comprehensive Analysis
```bash
# Search for all positioning references in intimacy actions
cd data/mods/intimacy/actions/

# Find component references
grep -l "intimacy:facing_away" *.json

# Find condition references  
grep -l "intimacy:.*-facing\|intimacy:.*-behind" *.json

# Find event references
grep -l "intimacy:actor_turned_around\|intimacy:actor_faced" *.json

# Find scope references
grep -l "facing_away\|close_actors_facing" *.json
```

### Step 2: Update Component References
```bash
# For each action file found in step 1:
# Replace: "intimacy:facing_away" with "posturing:facing_away"

# Use sed or manual editing:
# sed -i 's/intimacy:facing_away/posturing:facing_away/g' <action-file>
```

### Step 3: Update Condition References
```bash
# For each action file with positioning conditions:
# Replace condition references:
# - "intimacy:both-actors-facing-each-other" → "posturing:both-actors-facing-each-other"
# - "intimacy:actor-is-behind-entity" → "posturing:actor-is-behind-entity"
# - "intimacy:entity-not-in-facing-away" → "posturing:entity-not-in-facing-away"
# - "intimacy:actor-in-entity-facing-away" → "posturing:actor-in-entity-facing-away"
# - "intimacy:entity-in-facing-away" → "posturing:entity-in-facing-away"
```

### Step 4: Update Event References
```bash
# For each action file with positioning events:
# Replace event references:
# - "intimacy:actor_turned_around" → "posturing:actor_turned_around"
# - "intimacy:actor_faced_everyone" → "posturing:actor_faced_everyone"
# - "intimacy:actor_faced_forward" → "posturing:actor_faced_forward"
```

### Step 5: Update Scope References (Conditional)
```bash
# Based on ticket 09 results:
# If scopes migrated to posturing:
# - "intimacy:actors_im_facing_away_from" → "posturing:actors_im_facing_away_from"
# - "intimacy:close_actors_facing_away" → "posturing:close_actors_facing_away"

# If scopes remained in intimacy:
# - Keep existing intimacy namespace references
```

### Step 6: Validate Updated Actions
```bash
# Test action loading
npm run dev

# Check console for:
# - All intimacy actions load successfully
# - No reference resolution errors
# - Posturing components/conditions/events are accessible
# - No namespace conflicts
```

## Acceptance Criteria

### ✅ Component Reference Updates
- [ ] All `intimacy:facing_away` references updated to `posturing:facing_away`
- [ ] No broken component references remain
- [ ] Actions can access posturing facing_away component
- [ ] Component path resolution works correctly

### ✅ Condition Reference Updates
- [ ] All positioning condition references updated to posturing namespace
- [ ] No broken condition references remain
- [ ] Actions can evaluate posturing conditions
- [ ] Condition logic works correctly with updated references

### ✅ Event Reference Updates
- [ ] All positioning event references updated to posturing namespace
- [ ] No broken event references remain
- [ ] Actions can dispatch posturing events
- [ ] Event payloads are correct with updated references

### ✅ Scope Reference Updates
- [ ] Scope references updated based on ticket 09 migration results
- [ ] No broken scope references remain
- [ ] Actions can resolve scope queries correctly
- [ ] Scope DSL evaluation works with updated references

### ✅ Functional Validation
- [ ] All intimacy actions load without errors
- [ ] Actions maintain intimate behavior while using posturing positioning
- [ ] Cross-mod integration works correctly
- [ ] No regression in action functionality

## Risk Assessment

### 🚨 Potential Issues
1. **Reference Resolution Failures**: Updated references might not resolve correctly
2. **Scope Migration Dependencies**: Scope updates depend on ticket 09 results
3. **Cross-Mod Integration Issues**: Actions might not access posturing content properly
4. **Functional Regression**: Actions might lose functionality with namespace changes

### 🛡️ Risk Mitigation
1. **Systematic Testing**: Test each updated action individually
2. **Scope Coordination**: Verify ticket 09 results before scope updates
3. **Cross-Reference Validation**: Test posturing content accessibility
4. **Functional Testing**: Verify action behavior after updates

## Test Cases

### Test Case 1: Component Access
```bash
# Test actions accessing posturing:facing_away
# Expected: Actions can read and modify facing_away component
# Expected: No "component not found" errors
```

### Test Case 2: Condition Evaluation
```bash
# Test actions using posturing positioning conditions
# Expected: Conditions evaluate correctly
# Expected: Actions properly gate on positioning requirements
```

### Test Case 3: Event Dispatching
```bash
# Test actions dispatching posturing events
# Expected: Events dispatch successfully
# Expected: Event payloads are correct and handled properly
```

### Test Case 4: Scope Resolution
```bash
# Test actions using positioning scopes
# Expected: Scopes resolve to correct entity lists
# Expected: No scope resolution errors
```

### Test Case 5: Intimate Action Behavior
```bash
# Test that intimate actions maintain their intimate context
# Expected: massage_back still requires intimate relationship
# Expected: place_hand_on_waist still has intimate requirements
# Expected: Positioning is generic but context remains intimate
```

## File Changes Summary

### Actions Requiring Updates (Minimum Confirmed)
- `data/mods/intimacy/actions/massage_back.action.json`
- `data/mods/intimacy/actions/place_hand_on_waist.action.json`

### Additional Actions (Based on Analysis)
- Any intimacy action referencing `intimacy:facing_away`
- Any intimacy action using positioning conditions
- Any intimacy action dispatching positioning events
- Any intimacy action using positioning scopes

### Namespace Changes Applied
- **Component**: `intimacy:facing_away` → `posturing:facing_away`
- **Conditions**: `intimacy:positioning-conditions` → `posturing:positioning-conditions`
- **Events**: `intimacy:actor_*` → `posturing:actor_*`
- **Scopes**: Conditional based on ticket 09 results

## Success Metrics
- **Zero** reference resolution errors
- **All** intimacy actions load successfully
- **Proper** cross-mod integration with posturing
- **Maintained** intimate behavior with generic positioning

## Cross-Reference with Migration Analysis

**From Report - High-Coupling Actions**:
- ✅ `massage_back.action.json` - Behind position + intimate context
- ✅ `place_hand_on_waist.action.json` - Intimate behind-position action

**Expected Outcome**:
- Actions maintain intimate requirements
- Actions use generic posturing positioning logic
- Clean separation between intimate behavior and spatial positioning

## Dependencies for Next Tickets
- **Ticket 12**: Intimacy rules updates will use the same namespace changes
- **Ticket 13**: Intimacy scopes updates will complete the refactoring
- **Tickets 14-16**: Tests will validate the updated action behavior

## Post-Implementation Validation
After completion:
1. **Cross-Mod Integration**: Intimacy actions successfully use posturing positioning
2. **Behavior Preservation**: Intimate actions maintain their intimate context
3. **Generic Positioning**: Spatial logic is properly separated and reusable
4. **Clean References**: All namespace references are correct and functional

## Violence Mod Preparation
Updated intimacy actions demonstrate the pattern for violence mod integration:
- Use `posturing:facing_away` for positioning requirements
- Use `posturing:actor-is-behind-entity` for positional advantage
- Maintain domain-specific behavior while leveraging generic positioning

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Intimacy Refactoring Phase