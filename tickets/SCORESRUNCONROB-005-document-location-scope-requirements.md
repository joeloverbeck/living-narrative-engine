# SCORESRUNCONROB-005 – Document Location Scope Requirements

## Problem

The mod testing guide (`docs/testing/mod-testing-guide.md`) does not document:
- When `runtimeCtx.location` is required for scope resolution
- How location-based scopes (using `location.*` DSL patterns) work
- The expected behavior when location is missing (empty Set, not error)
- Examples of location-dependent scope patterns

This caused confusion when dimensional-travel action discovery tests failed because the scope resolver was not receiving `runtimeCtx.location`.

## Proposed scope

Add a new documentation section to `docs/testing/mod-testing-guide.md` that explains:
- What location-based scopes are and when they're used
- How `runtimeCtx.location` is populated from `core:position`
- Expected behavior when location is missing
- Cross-reference to `scope-resolver-registry.md` for available scopes

## File list

- `docs/testing/mod-testing-guide.md` (MODIFY — add new section)

## Out of scope

- Any source code files — no changes
- Any test files — no changes
- `docs/testing/scope-resolver-registry.md` — no changes
- Other documentation files — no changes

## Acceptance criteria

### Tests

Manual review of documentation content. No automated tests required.

### Invariants

1. Existing documentation sections remain unchanged
2. No broken markdown links
3. Follows existing documentation style and patterns in `docs/testing/`
4. Examples use real scope names from the codebase

### Content requirements

The new section "Location-Based Scope Resolution" must include:

| Requirement | Description |
|-------------|-------------|
| **Definition** | What location-based scopes are (scopes using `location.*` DSL patterns) |
| **When required** | Explain that `runtimeCtx.location` is required for these scopes |
| **How populated** | Describe resolution from `core:position.locationId` |
| **Empty Set behavior** | Explain graceful degradation when location is missing |
| **Example** | At least one code example showing location scope usage |
| **Cross-reference** | Link to `scope-resolver-registry.md` |

### Placement

Add the new section after the "Testing Custom Mod-Specific Scopes" section (approximately line 1500) and before "Best Practices".
