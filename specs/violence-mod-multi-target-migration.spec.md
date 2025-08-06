# Violence Mod Multi-Target Action Migration Specification

## Overview

This specification outlines the **planned migration** of violence mod actions from the legacy `scope` format to the new `targets` format. This document serves as a planning guide for future implementation work.

## Background

The Living Narrative Engine supports both legacy and new action formats via `action.schema.json`. While the schema allows both formats through `anyOf` validation, migrating to the new format provides better structure and consistency.

**Current Migration Status Across Codebase:**

- **Core actions**: Partially migrated (5/5 core actions use new format)
- **Other mods**: Mixed status (some mods retain legacy format)
- **Violence mod**: **NOT MIGRATED** - still uses legacy format

### Current State Analysis

**Violence Actions (Legacy Format - Requires Migration):**

- `violence:slap` - uses `"scope": "core:actors_in_location"`, template: `"slap {target}"`
- `violence:sucker_punch` - uses `"scope": "core:actors_in_location"`, template: `"sucker-punch {target}"` (note: hyphenated)

**Associated Files (No Changes Required):**

- `data/mods/violence/rules/handle_slap.rule.json` - event handling logic
- `data/mods/violence/rules/handle_sucker_punch.rule.json` - event handling logic

**Test Coverage Assessment:**

- `tests/integration/mods/violence/slap_action.test.js` - tests rule execution, not action structure
- `tests/integration/mods/violence/sucker_punch_action.test.js` - tests rule execution, not action structure
- `tests/integration/rules/slapRule.integration.test.js` - tests rule logic
- `tests/integration/rules/suckerPunchRule.integration.test.js` - tests rule logic
- **Assessment**: Tests focus on behavior, not structure validation - minimal test updates needed

## Migration Strategy

### 1. Action Format Migration

#### Current State (`violence:slap`):

```json
{
  "id": "violence:slap",
  "name": "Slap",
  "description": "Slap someone across the face",
  "scope": "core:actors_in_location",
  "template": "slap {target}"
}
```

#### Target State (`violence:slap`):

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "violence:slap",
  "name": "Slap",
  "description": "Slap someone across the face",
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Person to slap"
    }
  },
  "template": "slap {target}"
}
```

#### Current State (`violence:sucker_punch`):

```json
{
  "id": "violence:sucker_punch",
  "name": "Sucker Punch",
  "description": "Throw an unexpected punch at someone when they're not looking",
  "scope": "core:actors_in_location",
  "template": "sucker-punch {target}"
}
```

#### Target State (`violence:sucker_punch`):

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "violence:sucker_punch",
  "name": "Sucker Punch",
  "description": "Throw an unexpected punch at someone when they're not looking",
  "targets": {
    "primary": {
      "scope": "core:actors_in_location",
      "placeholder": "target",
      "description": "Person to punch unexpectedly"
    }
  },
  "template": "sucker-punch {target}"
}
```

### 2. Schema Compliance Requirements

Based on `action.schema.json` analysis, the migrated actions must include:

**Schema Support:**
- **Legacy Format**: Uses `scope` property (deprecated but still supported)
- **New Format**: Uses `targets` property 
- **Validation**: Schema uses `anyOf` to support both formats
- **Migration Benefit**: Improved structure and consistency, not functional requirement

**New Format Requirements:**
- `$schema`: Reference to action schema (recommended)
- `targets.primary.scope`: Scope ID defining where to find targets
- `targets.primary.placeholder`: Template variable name without braces
- `targets.primary.description`: Human-readable target description

### 3. Implementation Requirements

#### Action File Changes Required

**File: `data/mods/violence/actions/slap.action.json`**
- Add `$schema` property (recommended)
- Replace `"scope": "core:actors_in_location"` with `"targets": {"primary": {...}}`
- Add `placeholder: "target"` to maintain template compatibility
- Add descriptive target description

**File: `data/mods/violence/actions/sucker_punch.action.json`**
- Add `$schema` property (recommended)
- Replace `"scope": "core:actors_in_location"` with `"targets": {"primary": {...}}`
- Add `placeholder: "target"` to maintain template compatibility
- Add descriptive target description
- **Important**: Maintain existing template `"sucker-punch {target}"` (hyphenated)

#### Files Requiring No Changes

**Rule Files (Confirmed Compatible):**
- `data/mods/violence/rules/handle_slap.rule.json` - References `event.payload.targetId` and `event.payload.actionId`
- `data/mods/violence/rules/handle_sucker_punch.rule.json` - Same payload structure

**Test Files (Minimal Updates Needed):**
- Tests focus on rule execution behavior, not action structure validation
- Existing tests use direct action ID references and event dispatching
- No structural validation tests that would break with format change

### 4. Migration Impact Assessment

#### Actual Test File Analysis

Based on examination of existing test files:

**`tests/integration/mods/violence/slap_action.test.js`:**
- Imports action JSON directly for rule testing
- Tests rule execution and event handling behavior
- Does not validate action structure format
- **Migration Impact**: None - tests will continue working unchanged

**Similar pattern for all other test files** - they focus on behavioral testing, not structural validation

**Low Risk - Migration Impact Minimal:**
- **Rule Logic**: No changes required (confirmed by code analysis)
- **Event Payload**: Structure remains unchanged
- **Template System**: Placeholder names unchanged  
- **Action Discovery**: Uses same scope resolution logic
- **Test Coverage**: Tests focus on behavior, not structure format

### 5. Implementation Checklist

#### Pre-Migration Validation
- [ ] All violence mod tests pass (baseline verification)
- [ ] Action discovery works for violence actions
- [ ] Rules fire correctly for violence actions

#### Migration Steps
- [ ] Update `slap.action.json` to new format
- [ ] Update `sucker_punch.action.json` to new format (preserve hyphenated template)
- [ ] Add `$schema` references to both files
- [ ] Validate JSON structure against schema

#### Post-Migration Validation
- [ ] Actions conform to `action.schema.json`
- [ ] Schema validation passes for both actions
- [ ] Action discovery still finds violence actions
- [ ] Rules still fire correctly
- [ ] All existing test suites pass unchanged
- [ ] No regression in game functionality

### 6. Risk Assessment (Corrected)

#### Very Low Risk Areas (Confirmed by Analysis)
- **Rule Logic**: Event handling unchanged
- **Event Payload**: Same structure maintained
- **Template System**: Placeholder compatibility preserved
- **Action Discovery**: Internal logic unchanged
- **Test Coverage**: Tests focus on behavior, not format

#### No Significant Risk Areas Identified
- Previous assessment of "medium risk" areas was incorrect
- Test files do not require updates based on actual code examination
- Action imports work with either format due to schema flexibility

### 7. Implementation Order (Simplified)

1. **Update `slap.action.json`**
   - Apply new targets format
   - Add $schema reference
   - Preserve existing template `"slap {target}"`

2. **Update `sucker_punch.action.json`**
   - Apply new targets format
   - Add $schema reference
   - **Critical**: Preserve hyphenated template `"sucker-punch {target}"`

3. **Validation**
   - Run existing test suite (no changes needed)
   - Verify schema compliance
   - Test action discovery functionality

### 8. Success Criteria (Realistic)

#### Functional Requirements
- [ ] Violence actions remain discoverable in game
- [ ] Actions execute with same behavior as before
- [ ] Rules continue to fire correctly
- [ ] Event system integration unchanged
- [ ] Template resolution works identically

#### Technical Requirements
- [ ] Both actions validate against `action.schema.json`
- [ ] All existing tests pass without modification
- [ ] No deprecated `scope` property remains
- [ ] JSON structure follows new format
- [ ] No performance impact

#### Quality Requirements
- [ ] Code consistency with other migrated actions
- [ ] Clear target descriptions added
- [ ] Schema references present

## Conclusion (Corrected)

**Current Reality**: This specification documents a **planned migration** that has **not yet occurred**. The violence mod actions currently use the legacy `scope` format and require migration to the new `targets` format.

**Migration Impact**: The migration is **low-risk** and primarily cosmetic, providing better structure without functional changes. The schema supports both formats, making this migration optional but recommended for consistency.

**Key Implementation Notes**:
- Preserve the hyphenated template in `sucker_punch.action.json`
- Test files require no updates due to their behavioral focus
- Rule files require no changes due to identical event payload structure
- Action discovery logic remains unchanged

This migration will align violence mod actions with the modern action format while maintaining all existing functionality and game behavior.
