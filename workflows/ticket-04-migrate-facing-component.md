# Ticket 04: Migrate facing_away Component

## Overview
**Phase**: 2 - Core Logic Migration  
**Priority**: Critical  
**Estimated Time**: 1-2 hours  
**Dependencies**: Tickets 01-03 (Foundation Setup Complete)  
**Implements**: Report section "Component Migration" - facing_away component

## Objective
Migrate the `facing_away` component from the intimacy mod to the posturing mod, updating its namespace from `intimacy:facing_away` to `posturing:facing_away` and making it domain-agnostic for use across multiple mods.

## Background
**Current Component Location**: `data/mods/intimacy/components/facing_away.component.json`  
**Target Location**: `data/mods/posturing/components/facing_away.component.json`  
**Namespace Change**: `intimacy:facing_away` → `posturing:facing_away`

**From Migration Analysis**:
- Component is fundamentally domain-agnostic
- Used by 25 direct references + 8 Scope DSL usages + 34 test cases = 67 total references
- Currently has intimate context in description but logic is generic
- Core spatial relationship tracking suitable for violence, social, and other contexts

## Implementation Tasks

### Task 4.1: Read and Analyze Current Component
**Source File**: `data/mods/intimacy/components/facing_away.component.json`

**Expected Current Content** (based on report):
```json
{
  "id": "intimacy:facing_away",
  "description": "Tracks which actors this entity is facing away from in an intimate context",
  "dataSchema": {
    "type": "object",
    "required": ["facing_away_from"],
    "properties": {
      "facing_away_from": {
        "type": "array",
        "description": "Entity IDs this actor is facing away from",
        "items": { "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId" }
      }
    }
  }
}
```

### Task 4.2: Create Domain-Agnostic Version
**Target File**: `data/mods/posturing/components/facing_away.component.json`

**Updated Content**:
```json
{
  "id": "posturing:facing_away",
  "description": "Tracks which actors this entity is facing away from for spatial positioning. Used across multiple contexts including intimate, combat, and social interactions.",
  "dataSchema": {
    "type": "object",
    "required": ["facing_away_from"],
    "properties": {
      "facing_away_from": {
        "type": "array",
        "description": "Entity IDs this actor is facing away from",
        "items": { "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId" }
      }
    }
  }
}
```

**Key Changes**:
1. **ID**: `intimacy:facing_away` → `posturing:facing_away`
2. **Description**: Removed "intimate context" restriction, added multi-context usage
3. **Schema**: Unchanged - already domain-agnostic
4. **Intent**: Made explicitly clear this is for spatial positioning across domains

### Task 4.3: Validate Component Schema
**Schema Validation Requirements**:
1. Component ID follows posturing namespace pattern
2. Description is domain-agnostic and comprehensive
3. DataSchema structure remains identical (no breaking changes)
4. Required fields and properties match exactly
5. Reference to common schema is preserved

### Task 4.4: Test Component Registration
**Testing Steps**:
1. Copy component to posturing mod
2. Start development server
3. Verify component registers under posturing namespace
4. Confirm no validation errors
5. Test that component structure is recognized

## Implementation Steps

### Step 1: Backup and Prepare
```bash
# Ensure intimacy component exists and read current content
cat data/mods/intimacy/components/facing_away.component.json

# Verify posturing components directory exists
ls -la data/mods/posturing/components/
```

### Step 2: Create Posturing Component
```bash
# Copy component to posturing mod with namespace update
cp data/mods/intimacy/components/facing_away.component.json data/mods/posturing/components/facing_away.component.json

# Edit the new file to update namespace and description
# Update ID: intimacy:facing_away → posturing:facing_away
# Update description to be domain-agnostic
```

### Step 3: Validate New Component
```bash
# Test component loading
npm run dev

# Check console for:
# - posturing:facing_away component registration
# - No schema validation errors
# - Component appears in posturing mod content
```

### Step 4: Cross-Reference Validation
```bash
# Verify component structure matches expectations
# Test that component can be referenced by posturing: namespace
# Confirm schema validation passes
```

## Acceptance Criteria

### ✅ Component Migration
- [ ] Component copied to `data/mods/posturing/components/facing_away.component.json`
- [ ] Component ID updated to `posturing:facing_away`
- [ ] Description updated to be domain-agnostic
- [ ] Schema structure preserved exactly

### ✅ Namespace Validation
- [ ] Component registers under posturing namespace
- [ ] No namespace conflicts exist
- [ ] Component can be referenced as `posturing:facing_away`
- [ ] Schema validation passes for new namespace

### ✅ Functional Validation
- [ ] Component loads without errors
- [ ] Schema validation succeeds
- [ ] Component appears in posturing mod content inventory
- [ ] No regression in component functionality

### ✅ Integration Testing
- [ ] Development server starts successfully
- [ ] Component registration logged correctly
- [ ] No dependency resolution issues
- [ ] Component available for use by other mods

## Risk Assessment

### 🚨 Potential Issues
1. **Schema Validation Errors**: Namespace change could cause validation failures
2. **Reference Breaking**: Existing intimacy references to component will break
3. **Duplicate Registration**: Both intimacy and posturing versions might register
4. **Component Loading Failures**: New component might not load properly

### 🛡️ Risk Mitigation
1. **Schema Testing**: Validate schema before and after migration
2. **Phased Approach**: Keep intimacy version until all references updated
3. **Registration Monitoring**: Check for duplicate component warnings
4. **Loading Verification**: Test component loading independently

## Validation Testing

### Test Case 1: Component Registration
```bash
# Start server and check logs
npm run dev

# Expected: "posturing:facing_away component registered"
# Expected: No schema validation errors
# Expected: Component appears in posturing mod inventory
```

### Test Case 2: Schema Validation
```bash
# Validate component schema structure
# Expected: Schema matches common.schema.json requirements
# Expected: No validation warnings or errors
```

### Test Case 3: Namespace Resolution
```bash
# Test that posturing:facing_away is available
# Expected: Component can be referenced by new namespace
# Expected: No namespace collision warnings
```

## File Changes Summary

### New Files Created
- `data/mods/posturing/components/facing_away.component.json`

### Files Modified
- None (intimacy version kept until later ticket)

### Key Content Changes
- **Namespace**: `intimacy:facing_away` → `posturing:facing_away`
- **Description**: Domain-specific → Domain-agnostic
- **Schema**: No changes (preserved compatibility)

## Success Metrics
- **Zero** component loading errors
- **Successful** registration under posturing namespace
- **Clean** schema validation
- **Available** for cross-mod references

## Dependencies for Next Tickets
- **Ticket 05**: Events may reference this component
- **Ticket 06-07**: Actions will use this component
- **Ticket 08**: Conditions will check this component
- **Ticket 09**: Scopes will query this component
- **Tickets 10-13**: Intimacy updates will change references to posturing:facing_away

## Post-Migration Validation
After completion:
1. **Component Available**: `posturing:facing_away` can be referenced
2. **Schema Valid**: Component passes all validation checks
3. **Registration Clean**: No duplicate or conflicting registrations
4. **Ready for Use**: Other mods can depend on this component

## Rollback Procedure
If issues occur:
1. Remove `data/mods/posturing/components/facing_away.component.json`
2. Restart development server
3. Verify intimacy version still works
4. Investigate and resolve issues
5. Re-attempt migration with fixes

---

**Status**: Ready for Implementation  
**Assignee**: Developer  
**Epic**: Posturing Mod Migration  
**Sprint**: Core Migration Phase