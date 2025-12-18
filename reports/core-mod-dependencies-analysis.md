# Core Mod Dependency Violation Analysis

**Generated**: 2025-10-04
**Validation Tool**: `npm run validate`
**Issue**: Core mod contains 3 cross-reference violations to other mods

---

## Executive Summary

The Living Narrative Engine's core mod, which should serve as the foundational dependency-free base for all other mods, currently contains 3 references to content from other mods (`clothing`, `anatomy`, `movement`). This violates the architectural principle that core should have zero dependencies.

**Violation Breakdown**:

- 2 documentation/example violations (low operational impact)
- 1 operational violation (high priority - event definition in wrong mod)

---

## Detailed Analysis

### Violation 1: `clothing:shirt_uuid` Reference

**File**: `data/mods/core/events/attempt_action.event.json`
**Line**: 67
**Type**: Documentation/Example Violation

#### Context

```json
"examples": [
  {
    "primary": "core:character_instance",
    "secondary": "clothing:shirt_uuid"  // <-- VIOLATION
  }
]
```

#### Analysis

- **Severity**: Low
- **Nature**: This is an example value in the JSON schema's `examples` array
- **Impact**: Documentation only - not used in operational code
- **Purpose**: Demonstrates multi-target action structure with different entity types

#### Root Cause

The example was chosen to demonstrate real-world usage with the clothing system, but this creates an inappropriate dependency reference from core to the clothing mod.

#### Recommended Solution

Replace with a generic core-namespaced example:

```json
"examples": [
  {
    "primary": "core:character_instance",
    "secondary": "core:item_example"  // Generic core example
  }
]
```

**Rationale**: Core examples should use core-namespaced identifiers to avoid mod dependencies while still demonstrating the schema structure effectively.

---

### Violation 2: `movement:go` Reference

**File**: `data/mods/core/events/player_turn_prompt.event.json`
**Line**: 27
**Type**: Documentation/Description Violation

#### Context

```json
"actionId": {
  "$ref": "schema://living-narrative-engine/common.schema.json#/definitions/namespacedId",
  "description": "The underlying action definition ID (e.g. 'movement:go')."  // <-- VIOLATION
}
```

#### Analysis

- **Severity**: Low
- **Nature**: Example within a description string in JSON schema
- **Impact**: Documentation only - illustrative text
- **Purpose**: Shows developers the expected format of namespaced action IDs

#### Root Cause

The documentation uses a concrete example from the movement mod to illustrate the namespaced ID pattern, inadvertently creating a reference violation.

#### Recommended Solution

Replace with a generic core or hypothetical example:

```json
"description": "The underlying action definition ID (e.g. 'core:example_action' or 'mod_name:action_name')."
```

**Rationale**: Documentation examples should be generic or use core-namespaced examples. The pattern can be illustrated just as effectively without referencing specific mods.

---

### Violation 3: `anatomy:limb_detached` Event ID

**File**: `data/mods/core/events/limb_detached.event.json`
**Line**: 3
**Type**: Operational Violation (CRITICAL)

#### Context

```json
{
  "$schema": "../../../schemas/event.schema.json",
  "id": "anatomy:limb_detached", // <-- VIOLATION: anatomy namespace in core mod
  "description": "Dispatched when a body part is detached from its parent anatomy"
}
```

#### Analysis

- **Severity**: High
- **Nature**: Actual event definition with anatomy namespace located in core mod
- **Impact**: Architectural violation - operational code in wrong location
- **Purpose**: Defines event for anatomy system limb detachment

#### Root Cause

The event definition was placed in the core mod's events directory despite being namespaced and functionally belonging to the anatomy mod. This is a file organization error.

#### Recommended Solution (REQUIRED)

1. **Move the file** from `data/mods/core/events/` to `data/mods/anatomy/events/`
2. **Update anatomy mod manifest** (`data/mods/anatomy/mod-manifest.json`):
   ```json
   "events": [
     // ... existing events
     "limb_detached.event.json"
   ]
   ```
3. **Update core mod manifest** (`data/mods/core/mod-manifest.json`):
   - Remove `"limb_detached.event.json"` from the events array

**Rationale**:

- Event definitions should reside in the mod they're namespaced to
- Anatomy-specific functionality belongs in the anatomy mod
- Core mod should only contain truly foundational, mod-agnostic events
- Maintains architectural separation and dependency cleanliness

---

## Architectural Principles

### Why Core Must Be Dependency-Free

1. **Foundation Layer**: Core is the base dependency for all other mods
2. **No Circular Dependencies**: If core depends on other mods, circular dependency risks emerge
3. **Clean Architecture**: Core provides primitives; specialized mods build on them
4. **Mod Loading Order**: Core must load first; it cannot reference later-loading mods

### Current Mod Loading Order

```
1. core         (foundation - should have 0 dependencies)
2. movement     (depends on core)
3. companionship
4. positioning
5. anatomy      (depends on core)
6. clothing     (depends on core)
7. ... (other mods)
```

---

## Implementation Priority

### Phase 1: Critical Fix (IMMEDIATE)

- [ ] Move `limb_detached.event.json` to anatomy mod
- [ ] Update anatomy manifest to include the event
- [ ] Remove from core manifest
- [ ] Verify with `npm run validate`

### Phase 2: Documentation Cleanup (NEXT)

- [ ] Update `attempt_action.event.json` example to use `core:item_example`
- [ ] Update `player_turn_prompt.event.json` description to use generic example
- [ ] Verify with `npm run validate`

### Phase 3: Validation (FINAL)

- [ ] Run full validation suite: `npm run validate`
- [ ] Confirm zero violations for core mod
- [ ] Run integration tests to ensure no breakage
- [ ] Document changes in commit message

---

## Expected Outcomes

### Before Fix

```
Extracted references for mod 'core': clothing, anatomy, movement
Cross-reference validation for core: 3 violations
Mod core has 3 cross-reference violations
```

### After Fix

```
Extracted references for mod 'core':
Cross-reference validation for core: 0 violations
Mod core has 0 cross-reference violations
```

---

## Additional Recommendations

### 1. Validation as Pre-commit Hook

Consider adding ecosystem validation to pre-commit hooks to catch these violations early:

```bash
npm run validate
```

### 2. Documentation Standards

Establish documentation standards that specify:

- Examples in core schemas must use core-namespaced or generic identifiers
- Cross-mod examples should be in integration documentation, not core schemas

### 3. File Organization Audit

Conduct a review to ensure all event/component/action definitions are in the correct mod directory matching their namespace prefix.

---

## Testing Strategy

### Validation Tests

1. Run `npm run validate` - should report 0 violations
2. Check that core mod has no extracted references
3. Verify anatomy mod correctly includes limb_detached event

### Functional Tests

1. Verify limb detachment events still fire correctly from anatomy mod
2. Confirm multi-target actions work with updated examples
3. Test player turn prompts display correctly

### Integration Tests

1. Full game startup with all mods loaded
2. Anatomy system functionality (if implemented)
3. Action system with multi-target examples

---

## Conclusion

The core mod dependency violations are resolvable with targeted fixes:

1. **Critical**: Moving the anatomy event to the correct mod location (operational fix)
2. **Maintenance**: Updating documentation examples to use core/generic references (documentation hygiene)

These changes will restore architectural integrity while maintaining full functionality. The core mod will correctly serve as a dependency-free foundation for the entire mod ecosystem.

---

## References

- Validation script: `scripts/validateMods.js`
- Core mod manifest: `data/mods/core/mod-manifest.json`
- Anatomy mod manifest: `data/mods/anatomy/mod-manifest.json`
- Mod loading configuration: `data/game.json`
