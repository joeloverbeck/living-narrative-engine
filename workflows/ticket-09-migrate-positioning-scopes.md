# Ticket 09: Migrate Positioning Scopes

## Overview
**Phase**: 2 - Core Logic Migration  
**Priority**: High  
**Estimated Time**: 2-4 hours  
**Dependencies**: Tickets 04-08 (Components, Events, Actions, Conditions Migration)  
**Implements**: Report section "Scopes to Move" - 2 positioning scopes with dependency analysis

## Objective
Migrate two positioning scopes from the intimacy mod to the posturing mod, with careful dependency analysis for `close_actors_facing_away` scope which may have intimacy-specific dependencies that need to be resolved.

## Background
**Scopes to Migrate**:
1. `actors_im_facing_away_from.scope` - Simple scope, direct migration
2. `close_actors_facing_away.scope` - ⚠️ Requires intimacy dependency analysis

**Namespace Changes Required**:
- Scope IDs: `intimacy:*` → `posturing:*`
- Component references: `intimacy:facing_away` → `posturing:facing_away`
- Scope references: Any internal scope dependencies need analysis

**From Migration Analysis**:
- `actors_im_facing_away_from.scope` - Pure positioning logic (✅ safe to migrate)
- `close_actors_facing_away.scope` - ⚠️ Combines positioning with intimacy logic (requires analysis)

## Implementation Tasks

### Task 9.1: Migrate actors_im_facing_away_from Scope
**Source**: `data/mods/intimacy/scopes/actors_im_facing_away_from.scope`  
**Target**: `data/mods/posturing/scopes/actors_im_facing_away_from.scope`

**Expected Current Structure**:
```
actor.intimacy:facing_away.facing_away_from[]
```

**Updated Content**:
```
actor.posturing:facing_away.facing_away_from[]
```

**Analysis**: Simple component reference update, no complex dependencies.

### Task 9.2: Analyze close_actors_facing_away Scope Dependencies
**Source**: `data/mods/intimacy/scopes/close_actors_facing_away.scope`

**Expected Challenges**:
- May reference `intimacy:closeness` component
- May use intimacy-specific scope combinations  
- May have logic that shouldn't be domain-agnostic

**Analysis Steps**:
1. Read current scope content
2. Identify all component and scope references
3. Determine if intimacy-specific logic exists
4. Decide migration strategy

### Task 9.3: Migration Strategy for close_actors_facing_away

**Option A: Direct Migration** (if no intimacy dependencies)
```
# Simple case - just update namespace
close_actors + actors_facing_away
```

**Option B: Dependency Separation** (if intimacy dependencies found)
```
# Split scope:
# - posturing:actors_facing_away (positioning only)
# - intimacy:close_actors_facing_away (keep intimacy version with closeness)
```

**Option C: Postpone Migration** (if complex intimacy coupling)
```
# Keep in intimacy mod until intimacy refactoring phase
# Update in ticket 13 instead
```

### Task 9.4: Read and Analyze Current Scopes
**Investigation Required**: Read actual scope files to determine exact structure and dependencies.

## Implementation Steps

### Step 1: Read and Analyze Current Scopes
```bash
# Read both scope files
cat data/mods/intimacy/scopes/actors_im_facing_away_from.scope
cat data/mods/intimacy/scopes/close_actors_facing_away.scope

# Analyze dependencies in close_actors_facing_away
# Look for:
# - intimacy:closeness references
# - Complex scope combinations
# - Intimacy-specific logic
```

### Step 2: Migrate actors_im_facing_away_from (Simple Case)
```bash
# Verify posturing scopes directory exists
mkdir -p data/mods/posturing/scopes/

# Copy simple scope
cp data/mods/intimacy/scopes/actors_im_facing_away_from.scope data/mods/posturing/scopes/

# Edit posturing version:
# - Update component reference: intimacy:facing_away → posturing:facing_away
```

### Step 3: Handle close_actors_facing_away (Complex Case)
```bash
# Based on analysis from Step 1, choose approach:

# If no intimacy dependencies (Option A):
cp data/mods/intimacy/scopes/close_actors_facing_away.scope data/mods/posturing/scopes/
# Edit to update namespaces

# If intimacy dependencies exist (Option B or C):
# Document findings and implement chosen strategy
```

### Step 4: Test Scope Registration and Usage
```bash
# Test scope loading
npm run dev

# Check console for:
# - posturing:actors_im_facing_away_from scope registered
# - posturing:close_actors_facing_away scope registered (if migrated)
# - No scope resolution errors
# - Actions can use migrated scopes
```

### Step 5: Update Action Scope References
```bash
# Update actions that reference migrated scopes:
# - turn_around_to_face.action.json needs actors_im_facing_away_from
# - turn_around.action.json might need close_actors_facing_away

# Edit action files to use posturing: namespace for scopes
```

## Acceptance Criteria

### ✅ actors_im_facing_away_from Scope Migration
- [ ] Scope copied to `data/mods/posturing/scopes/actors_im_facing_away_from.scope`
- [ ] Component reference updated to `posturing:facing_away`
- [ ] Scope registers under posturing namespace
- [ ] Scope can be used by posturing actions

### ✅ close_actors_facing_away Scope Analysis
- [ ] Scope dependencies fully analyzed and documented
- [ ] Migration strategy determined based on analysis
- [ ] Strategy implemented correctly
- [ ] No broken dependencies remain

### ✅ Action Scope Reference Updates
- [ ] `turn_around_to_face` action uses `posturing:actors_im_facing_away_from`
- [ ] Other actions updated as needed based on scope migration
- [ ] No broken scope references remain
- [ ] Actions function correctly with new scope references

### ✅ Registration and Integration Testing
- [ ] All migrated scopes register successfully
- [ ] Scope resolution works correctly
- [ ] Actions can use migrated scopes
- [ ] No scope evaluation errors occur

## Risk Assessment

### 🚨 Potential Issues
1. **close_actors_facing_away Complexity**: May have deep intimacy coupling
2. **Scope Reference Breaking**: Actions referencing old scope names will break
3. **Component Path Issues**: Scope DSL might not resolve new component paths
4. **Circular Dependencies**: Scope might reference other intimacy scopes

### 🛡️ Risk Mitigation
1. **Thorough Analysis**: Read and understand scope content before migration
2. **Incremental Testing**: Test each scope migration independently
3. **Reference Tracking**: Update all scope references immediately after migration
4. **Fallback Plan**: Keep intimacy versions until posturing versions proven working

## Analysis Framework for close_actors_facing_away

### Dependency Detection Checklist
- [ ] References `intimacy:closeness` component
- [ ] Uses `close_actors` scope (from intimacy mod)
- [ ] Combines intimacy-specific logic with positioning
- [ ] Has complex scope composition requiring intimacy context

### Migration Decision Matrix
| Dependency Level | Strategy | Implementation |
|------------------|----------|----------------|
| **No intimacy deps** | Direct migration | Simple namespace update |
| **Light intimacy deps** | Dependency separation | Create posturing version, keep intimacy version |
| **Heavy intimacy deps** | Postpone migration | Handle in intimacy refactoring phase |

## Test Cases

### Test Case 1: Simple Scope Migration (actors_im_facing_away_from)
```bash
npm run dev
# Expected: "posturing:actors_im_facing_away_from scope registered"
# Expected: Scope resolves correctly
```

### Test Case 2: Complex Scope Analysis (close_actors_facing_away)
```bash
# Analyze scope content
# Expected: Clear understanding of dependencies
# Expected: Migration strategy determined
```

### Test Case 3: Action Integration
```bash
# Test actions using migrated scopes
# Expected: turn_around_to_face works with posturing:actors_im_facing_away_from
# Expected: No scope resolution errors
```

### Test Case 4: Scope Evaluation
```bash
# Test scope DSL evaluation with new component paths
# Expected: Scopes return correct entity lists
# Expected: Component references resolve properly
```

## File Changes Summary

### Definite Changes
- `data/mods/posturing/scopes/actors_im_facing_away_from.scope` (direct migration)

### Conditional Changes (based on analysis)
- `data/mods/posturing/scopes/close_actors_facing_away.scope` (if analysis permits)
- Action files using migrated scopes (scope reference updates)

### Namespace Changes
- **actors_im_facing_away_from**: Component reference `intimacy:facing_away` → `posturing:facing_away`
- **close_actors_facing_away**: TBD based on dependency analysis

## Success Metrics
- **At least 1** scope successfully migrated (actors_im_facing_away_from)
- **Clear strategy** determined for close_actors_facing_away
- **All scope** references updated correctly
- **No scope** resolution errors

## Dependencies Resolved for Previous Tickets

### Action Scope References (Tickets 06-07)
- **turn_around_to_face**: Can now use `posturing:actors_im_facing_away_from`
- **turn_around**: Scope reference updated based on close_actors_facing_away analysis

### Temporary Scope References
- Actions with temporary intimacy scope references can be updated
- Cross-mod scope resolution completed

## Expected Outcomes

### Best Case Scenario
- Both scopes migrate successfully
- All action scope references updated
- Complete positioning system available in posturing mod

### Likely Scenario  
- `actors_im_facing_away_from` migrates successfully
- `close_actors_facing_away` requires dependency analysis and possible postponement
- Partial scope migration with documented strategy for remainder

### Contingency Plan
- If `close_actors_facing_away` cannot migrate, document intimacy dependencies
- Update strategy for handling in intimacy refactoring phase
- Ensure `actors_im_facing_away_from` migration is successful

## Dependencies for Next Tickets
- **Tickets 10-13**: Intimacy refactoring will need scope migration results
- **Tickets 14-16**: Tests will need updated scope references
- **Future Violence Integration**: Migrated scopes enable combat positioning

## Post-Migration Documentation
After completion:
1. **Document** all scope migration decisions and rationale
2. **Update** scope reference documentation
3. **Note** any intimacy dependencies that remain
4. **Prepare** scope usage examples for other mods

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Core Migration Phase