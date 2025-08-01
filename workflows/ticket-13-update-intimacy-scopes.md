# Ticket 13: Update Intimacy Scopes to Use Posturing Namespace

## Overview
**Phase**: 3 - Intimacy Mod Refactoring  
**Priority**: Medium  
**Estimated Time**: 2-3 hours  
**Dependencies**: Ticket 12 (Intimacy Rules Update)  
**Implements**: Report section "Intimacy Mod Refactoring" - scope namespace updates and completion

## Objective
Update all remaining intimacy mod scopes to reference the new posturing namespace for positioning components and complete the intimacy mod refactoring by ensuring all positioning references use the migrated posturing system.

## Background
**Namespace Updates Required**:
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Scope references: References to migrated positioning scopes
- Cross-scope dependencies: Intimacy scopes using positioning logic

**Scope Status After Tickets 09-12**:
- Some positioning scopes migrated to posturing (ticket 09)
- Intimacy actions and rules updated to use posturing (tickets 11-12)
- Remaining intimacy scopes need positioning reference updates

**From Migration Analysis**:
- Intimacy scopes combine intimacy-specific logic with positioning logic
- Scopes like `close_actors_facing_away` may have stayed in intimacy if they had complex dependencies
- All scopes need consistent namespace usage for positioning components

## Implementation Tasks

### Task 13.1: Analyze Remaining Intimacy Scopes
**Current Intimacy Scopes** (from manifest analysis):
```
actors_with_arms_facing_each_other.scope
actors_with_arms_facing_each_other_or_behind_target.scope
actors_with_arms_in_intimacy.scope
actors_with_ass_cheeks_facing_each_other.scope
actors_with_ass_cheeks_facing_each_other_or_behind_target.scope
actors_with_ass_cheeks_in_intimacy.scope
actors_with_mouth_facing_each_other.scope
actors_with_muscular_arms_facing_each_other_or_behind_target.scope
close_actors.scope
close_actors_facing_each_other.scope
close_actors_facing_each_other_or_behind_target.scope
close_actors_facing_each_other_with_torso_clothing.scope
current_kissing_partner.scope
actors_im_facing_away_from.scope  (conditional - may have migrated)
close_actors_facing_away.scope    (conditional - may have migrated)
```

**Analysis Required**:
1. Identify scopes using `intimacy:facing_away` component
2. Identify scopes referencing positioning logic
3. Determine which scopes can use posturing positioning
4. Update component references appropriately

### Task 13.2: Update Component References in Intimacy Scopes
**Pattern Search**:
```bash
# Find scopes referencing facing_away component
grep -r "intimacy:facing_away" data/mods/intimacy/scopes/

# Find scopes with facing/behind positioning logic
grep -r "facing_away\|behind" data/mods/intimacy/scopes/
```

**Expected Updates**:
```
# Current component reference in scopes:
actor.intimacy:facing_away.facing_away_from[]

# Updated component reference:
actor.posturing:facing_away.facing_away_from[]
```

### Task 13.3: Scope-by-Scope Analysis and Updates

#### High-Priority Scopes (Likely to Need Updates)
**1. actors_with_arms_facing_each_other.scope**
- **Expected Content**: May reference facing away logic
- **Update**: Component references to posturing namespace

**2. actors_with_arms_facing_each_other_or_behind_target.scope**
- **Expected Content**: Combines facing logic with behind positioning
- **Update**: Use posturing positioning logic for spatial relationships

**3. actors_with_ass_cheeks_facing_each_other.scope**
- **Expected Content**: May use facing away component for positioning
- **Update**: Component references to posturing namespace

**4. close_actors_facing_each_other.scope**
- **Expected Content**: Combines closeness with facing logic
- **Update**: Keep intimacy closeness, use posturing facing logic

**5. close_actors_facing_each_other_or_behind_target.scope**
- **Expected Content**: Complex scope combining closeness, facing, and behind positioning
- **Update**: Integrate posturing positioning with intimacy closeness

#### Conditional Scopes (Based on Ticket 09)
**6. actors_im_facing_away_from.scope**
- **If migrated**: Remove from intimacy or update references to posturing version
- **If not migrated**: Update component references to posturing namespace

**7. close_actors_facing_away.scope**
- **If migrated**: Remove from intimacy or update references to posturing version
- **If not migrated**: Update component references to posturing namespace

### Task 13.4: Handle Scope Dependencies and Cross-References
**Dependency Analysis**:
```bash
# Find scopes that reference other scopes
grep -r "\+" data/mods/intimacy/scopes/  # Union operators
grep -r "|" data/mods/intimacy/scopes/   # Union operators

# Check for scope composition patterns
```

**Update Strategy**:
- Scopes referencing migrated positioning scopes need namespace updates
- Scopes combining intimacy + positioning logic need careful integration
- Maintain intimacy-specific requirements while using generic positioning

### Task 13.5: Create Updated Scope Files
**Example Update Pattern**:

**Before (actors_with_arms_facing_each_other_or_behind_target.scope)**:
```
actors_with_arms_in_intimacy + actors_with_arms_behind_target[intimacy:facing_away]
```

**After**:
```
actors_with_arms_in_intimacy + actors_with_arms_behind_target[posturing:facing_away]
```

## Implementation Steps

### Step 1: Comprehensive Scope Analysis
```bash
# Navigate to intimacy scopes directory
cd data/mods/intimacy/scopes/

# Create backup
cp -r . ../scopes-backup/

# Analyze all scopes for positioning references
echo "=== Scopes with facing_away component references ==="
grep -l "intimacy:facing_away" *.scope

echo "=== Scopes with facing/behind logic ==="
grep -l "facing\|behind" *.scope

echo "=== Scopes with positioning terms ==="
grep -l "turned\|faced" *.scope

# Read each scope to understand structure
for scope in *.scope; do
  echo "=== $scope ==="
  cat "$scope"
  echo ""
done
```

### Step 2: Check Ticket 09 Migration Results
```bash
# Determine which scopes migrated to posturing
ls data/mods/posturing/scopes/

# Check if actors_im_facing_away_from migrated
if [ -f "data/mods/posturing/scopes/actors_im_facing_away_from.scope" ]; then
  echo "actors_im_facing_away_from migrated to posturing"
fi

# Check if close_actors_facing_away migrated
if [ -f "data/mods/posturing/scopes/close_actors_facing_away.scope" ]; then
  echo "close_actors_facing_away migrated to posturing"
fi
```

### Step 3: Update Component References
```bash
# For each scope file with intimacy:facing_away references:
# Replace with posturing:facing_away

# Example for all scope files:
# find . -name "*.scope" -exec sed -i 's/intimacy:facing_away/posturing:facing_away/g' {} \;
```

### Step 4: Update Scope Cross-References
```bash
# If scopes migrated to posturing, update references:
# - Update any intimacy scopes that reference migrated positioning scopes
# - Change scope names from intimacy: to posturing: where appropriate
```

### Step 5: Handle Complex Scope Logic
```bash
# For scopes with complex positioning + intimacy logic:
# - Preserve intimacy-specific requirements
# - Use posturing positioning logic
# - Ensure proper scope composition syntax
```

### Step 6: Validate Updated Scopes
```bash
# Test scope loading and evaluation
npm run dev

# Check console for:
# - All intimacy scopes load successfully
# - No scope resolution errors
# - Scope DSL parsing works correctly
# - Component references resolve properly
# - Cross-scope references work
```

## Acceptance Criteria

### ✅ Component Reference Updates
- [ ] All `intimacy:facing_away` references updated to `posturing:facing_away`
- [ ] Component paths resolve correctly in scope DSL
- [ ] Scopes can access posturing facing_away component data
- [ ] No broken component reference errors

### ✅ Scope Cross-Reference Updates
- [ ] References to migrated positioning scopes updated appropriately
- [ ] Scope composition syntax remains valid
- [ ] Cross-scope dependencies resolve correctly
- [ ] No broken scope reference errors

### ✅ Intimacy Logic Preservation
- [ ] Intimacy-specific requirements maintained in scopes
- [ ] Closeness logic preserved where appropriate
- [ ] Intimate context requirements not lost in updates
- [ ] Scope functionality remains intimate-specific where needed

### ✅ Integration with Posturing
- [ ] Positioning logic uses generic posturing system
- [ ] Spatial relationships handled by posturing components
- [ ] Clean separation between intimate context and positioning logic
- [ ] Cross-mod positioning system properly utilized

### ✅ Functional Validation
- [ ] All intimacy scopes load without errors
- [ ] Scope DSL evaluation works correctly
- [ ] Scopes return expected entity lists
- [ ] No regression in scope functionality

### ✅ Syntax and Structure Validation
- [ ] Scope DSL syntax is valid for all updated scopes
- [ ] Component paths follow correct format
- [ ] Scope composition operators work correctly
- [ ] No parsing errors in scope evaluation

## Risk Assessment

### 🚨 Potential Issues
1. **Complex Scope Logic**: Scopes may have intricate positioning + intimacy logic
2. **Scope Composition Errors**: Union operators and scope references might break
3. **Component Path Issues**: Updated paths might not resolve correctly
4. **Cross-Reference Confusion**: Unclear which scopes migrated vs. remained
5. **Performance Impact**: Updated scopes might be slower to evaluate

### 🛡️ Risk Mitigation
1. **Incremental Updates**: Update and test one scope at a time
2. **Syntax Validation**: Validate scope DSL syntax after each update
3. **Component Testing**: Test component path resolution independently
4. **Cross-Reference Documentation**: Document all scope migration decisions
5. **Performance Testing**: Monitor scope evaluation performance

## Test Cases

### Test Case 1: Component Access
```bash
# Test scopes accessing posturing:facing_away component
# Expected: Component paths resolve correctly
# Expected: Scopes can read component data properly
```

### Test Case 2: Scope Evaluation
```bash
# Test updated scopes return correct entity lists
# Expected: Scopes evaluate without errors
# Expected: Results match expected behavior
```

### Test Case 3: Cross-Scope References
```bash
# Test scopes that reference other scopes
# Expected: Cross-references resolve correctly
# Expected: Scope composition works properly
```

### Test Case 4: Intimacy Context Preservation
```bash
# Test that intimate scopes maintain intimate requirements
# Expected: Closeness requirements preserved
# Expected: Intimate context not lost in positioning updates
```

### Test Case 5: Performance Validation
```bash
# Test scope evaluation performance
# Expected: No significant performance degradation
# Expected: Scopes evaluate in reasonable time
```

## File Changes Summary

### Scopes Requiring Updates (Expected)
- Scopes referencing `intimacy:facing_away` component
- Scopes with facing/behind positioning logic
- Scopes that cross-reference migrated positioning scopes
- Complex scopes combining intimacy and positioning logic

### Namespace Changes Applied
- **Component References**: `intimacy:facing_away` → `posturing:facing_away`
- **Scope References**: Migrated positioning scopes use posturing namespace
- **Cross-References**: Updated based on ticket 09 migration results

### Logic Integration Patterns
- **Intimacy + Positioning**: Intimate context with generic spatial positioning
- **Component Separation**: Closeness (intimacy) + facing_away (posturing)
- **Scope Composition**: Proper DSL syntax for combining scopes

## Success Metrics
- **Zero** scope loading errors
- **All** intimacy scopes function correctly with updated references
- **Proper** integration of intimacy context with posturing positioning
- **Maintained** scope functionality and performance

## Completion of Intimacy Refactoring

### Phase 3 Summary (Tickets 10-13)
- ✅ **Ticket 10**: Intimacy manifest cleaned of migrated content
- ✅ **Ticket 11**: Intimacy actions use posturing positioning
- ✅ **Ticket 12**: Intimacy rules use posturing positioning
- ✅ **Ticket 13**: Intimacy scopes use posturing positioning

### Integration Validation
After this ticket, verify:
1. **Complete Separation**: Positioning logic fully migrated to posturing
2. **Clean Integration**: Intimacy mod cleanly uses posturing positioning
3. **Maintained Functionality**: All intimate behaviors work correctly
4. **Cross-Mod Ready**: System ready for violence mod integration

## Dependencies for Next Tickets
- **Tickets 14-16**: Test migration will validate all namespace updates
- **Future Violence Integration**: Clean posturing system ready for combat use
- **System Stability**: Complete intimacy refactoring provides stable foundation

## Post-Implementation Validation
After completion:
1. **Namespace Consistency**: All intimacy content uses posturing for positioning
2. **Functional Integration**: Seamless integration between intimacy and posturing
3. **Logic Separation**: Clear separation between intimate behavior and spatial positioning
4. **System Readiness**: Complete foundation for cross-mod positioning system

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Intimacy Refactoring Phase