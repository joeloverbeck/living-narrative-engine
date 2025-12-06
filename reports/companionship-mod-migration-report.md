# Companionship Mod Migration Report

**Date**: 2025-01-18
**Purpose**: Extract following/leading mechanics from core mod into dedicated companionship mod
**Status**: Planning Phase

## Executive Summary

The following/leading system currently resides in the core mod but represents a distinct gameplay mechanic that should be modularized. This report details the required steps to extract these components into a new `companionship` mod, improving code organization and enabling optional inclusion of this feature set.

## Rationale for Migration

1. **Separation of Concerns**: Following/leading is not a fundamental engine mechanic but a gameplay feature
2. **Modularity**: Games may not want companionship mechanics
3. **Maintainability**: Easier to update and extend when isolated
4. **Clear Dependencies**: Better visibility of what depends on companionship features

## Color Scheme Assignment

**Selected**: Deep Teal (Section 3.3 of WCAG spec)

- Background: `#00695c`
- Text: `#e0f2f1`
- Hover Background: `#00897b`
- Hover Text: `#ffffff`
- **Rationale**: Conveys trust, stability, and depth - perfect for companion relationships

## Files to Migrate

### Actions (3 files)

```
data/mods/core/actions/follow.action.json          → data/mods/companionship/actions/follow.action.json
data/mods/core/actions/stop_following.action.json  → data/mods/companionship/actions/stop_following.action.json
data/mods/core/actions/dismiss.action.json         → data/mods/companionship/actions/dismiss.action.json
```

### Components (2 files)

```
data/mods/core/components/following.component.json → data/mods/companionship/components/following.component.json
data/mods/core/components/leading.component.json   → data/mods/companionship/components/leading.component.json
```

### Conditions (5 files)

```
data/mods/core/conditions/event-is-action-follow.condition.json         → data/mods/companionship/conditions/event-is-action-follow.condition.json
data/mods/core/conditions/event-is-action-stop-following.condition.json → data/mods/companionship/conditions/event-is-action-stop-following.condition.json
data/mods/core/conditions/event-is-action-dismiss.condition.json        → data/mods/companionship/conditions/event-is-action-dismiss.condition.json
data/mods/core/conditions/entity-is-following-actor.condition.json      → data/mods/companionship/conditions/entity-is-following-actor.condition.json
data/mods/core/conditions/actor-is-following.condition.json             → data/mods/companionship/conditions/actor-is-following.condition.json
```

### Rules (4 files)

```
data/mods/core/rules/follow.rule.json           → data/mods/companionship/rules/follow.rule.json
data/mods/core/rules/stop_following.rule.json   → data/mods/companionship/rules/stop_following.rule.json
data/mods/core/rules/dismiss.rule.json          → data/mods/companionship/rules/dismiss.rule.json
data/mods/core/rules/follow_auto_move.rule.json → data/mods/companionship/rules/follow_auto_move.rule.json
```

**Note**: `follow_auto_move.rule.json` responds to `core:entity_moved` event which will remain in core

### Scopes (2 files)

```
data/mods/core/scopes/followers.scope        → data/mods/companionship/scopes/followers.scope
data/mods/core/scopes/potential_leaders.scope → data/mods/companionship/scopes/potential_leaders.scope
```

### Macros (1 file)

```
data/mods/core/macros/autoMoveFollower.macro.json → data/mods/companionship/macros/autoMoveFollower.macro.json
```

**Total JSON Files to Migrate**: 17 files

## JavaScript Files to Update

### Operation Handlers (5 files)

These handlers implement the core logic for following mechanics and need namespace updates:

```
src/logic/operationHandlers/establishFollowRelationHandler.js
src/logic/operationHandlers/breakFollowRelationHandler.js
src/logic/operationHandlers/checkFollowCycleHandler.js
src/logic/operationHandlers/autoMoveFollowersHandler.js
src/logic/operationHandlers/rebuildLeaderListCacheHandler.js
```

### Utility Files (2 files)

```
src/utils/followUtils.js - Contains follow-specific utility functions
src/constants/componentIds.js - Exports FOLLOWING_COMPONENT_ID and LEADING_COMPONENT_ID constants
```

### Changes Required:

- Update all references from `'core:following'` to `'companionship:following'`
- Update all references from `'core:leading'` to `'companionship:leading'`
- Update constant definitions to use new namespace

**Total JavaScript Files to Update**: 7 files

## Operation Schemas

### Schema Files (5 files)

These schemas define the operation structures. Consider whether to migrate or keep in core:

```
data/schemas/operations/establishFollowRelation.schema.json
data/schemas/operations/breakFollowRelation.schema.json
data/schemas/operations/checkFollowCycle.schema.json
data/schemas/operations/autoMoveFollowers.schema.json
data/schemas/operations/rebuildLeaderListCache.schema.json
```

**Architectural Decision Required**: These operations are engine-level handlers. Options:

1. Keep schemas in core but update component references to companionship
2. Move schemas to companionship mod (may affect engine architecture)
3. Create companionship-specific operations that wrap core operations

**Recommendation**: Keep in core, update component references only

## Required Changes During Migration

### 1. Namespace Updates

All file IDs must be updated from `core:` to `companionship:`:

**Examples**:

- `"id": "core:follow"` → `"id": "companionship:follow"`
- `"condition_ref": "core:actor-is-following"` → `"condition_ref": "companionship:actor-is-following"`
- `"macro": "core:autoMoveFollower"` → `"macro": "companionship:autoMoveFollower"`

### 2. Color Scheme Updates

Update visual properties in all three action files:

**From** (Classic Blue-Grey):

```json
{
  "backgroundColor": "#455a64",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#37474f",
  "hoverTextColor": "#ffffff"
}
```

**To** (Deep Teal):

```json
{
  "backgroundColor": "#00695c",
  "textColor": "#e0f2f1",
  "hoverBackgroundColor": "#00897b",
  "hoverTextColor": "#ffffff"
}
```

### 3. Cross-Module References

Identify and update references from other modules:

**Potential References to Check**:

- Any AI/NPC behavior systems that check following status
- Movement system integration points
- Save/load system if it specifically handles following relationships
- UI components that display follower information

### 4. Dependency Updates

**Files that need updates**:

- `data/mods/core/mod-manifest.json` - Remove companionship-related entries
- Other mod manifests that depend on following mechanics - Add `companionship` to dependencies
- Operation handlers in JavaScript - Update component ID references
- Constants file - Update exported component ID values

### 5. Test File Updates

**Affected Test Categories** (49+ test files):

- Unit tests for operation handlers (`tests/unit/logic/operationHandlers/`)
- Schema validation tests (`tests/unit/schemas/`)
- Action discovery tests (`tests/e2e/actions/`, `tests/performance/actions/`)
- Scope definition tests (`tests/unit/scopeDsl/`, `tests/integration/scopeDsl/`)
- Rule execution tests (`tests/integration/core/rules/`)
- Command processor tests (`tests/unit/commands/`)
- DOM UI rendering tests (`tests/unit/domUI/`)

**Major Test Files Requiring Updates**:

```
tests/integration/core/rules/followRule.integration.test.js
tests/integration/core/rules/dismissRule.integration.test.js
tests/integration/core/rules/stopFollowingRule.integration.test.js
tests/unit/logic/operationHandlers/rebuildLeaderListCacheHandler.test.js
tests/unit/schemas/follow.schema.test.js
tests/unit/schemas/dismiss.schema.test.js
tests/unit/schemas/followAutoMove.schema.test.js
```

## New Files to Create

### 1. Mod Manifest

`data/mods/companionship/mod-manifest.json`:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "companionship",
  "version": "1.0.0",
  "name": "Companionship System",
  "description": "Provides following, leading, and companion management mechanics",
  "author": "Living Narrative Engine Team",
  "dependencies": ["core", "movement"],
  "loadOrder": 20,
  "components": ["companionship:following", "companionship:leading"],
  "actions": [
    "companionship:follow",
    "companionship:stop_following",
    "companionship:dismiss"
  ],
  "conditions": [
    "companionship:event-is-action-follow",
    "companionship:event-is-action-stop-following",
    "companionship:event-is-action-dismiss",
    "companionship:entity-is-following-actor",
    "companionship:actor-is-following"
  ],
  "rules": [
    "companionship:follow",
    "companionship:stop_following",
    "companionship:dismiss",
    "companionship:follow_auto_move"
  ],
  "scopes": ["companionship:followers", "companionship:potential_leaders"],
  "macros": ["companionship:autoMoveFollower"]
}
```

## Migration Steps

### Phase 1: Preparation

1. Create `data/mods/companionship/` directory structure
2. Create subdirectories: `actions/`, `components/`, `conditions/`, `rules/`, `scopes/`, `macros/`
3. Create mod manifest file

### Phase 2: File Migration

1. Copy all identified JSON files to new locations
2. Update all namespace references from `core:` to `companionship:`
3. Update color schemes in action files
4. Verify all internal references are correct

### Phase 3: JavaScript Updates

1. Update component ID constants in `src/constants/componentIds.js`
2. Update all operation handlers to use new component IDs
3. Update utility functions in `src/utils/followUtils.js`
4. Search for any additional hardcoded references

### Phase 4: Core Mod Cleanup

1. Remove migrated files from core mod
2. Update `data/mods/core/mod-manifest.json`
3. Verify operation schemas reference correct component namespaces

### Phase 5: Dependency Resolution

1. Search for all references to migrated components across codebase
2. Update mod dependencies where needed
3. Add `companionship` to `data/game.json` mods list if desired

### Phase 6: Testing

1. Run all existing tests to identify breaks (49+ test files affected)
2. Update test imports and references systematically
3. Update test data factories and fixtures
4. Create new tests for companionship mod isolation
5. Verify actions appear correctly in UI with new colors
6. Test save/load functionality with followers
7. Test cross-mod interactions (especially with movement mod)

### Phase 7: Documentation

1. Update README to mention companionship as optional mod
2. Document companionship mod API/components
3. Update CLAUDE.md with new mod information
4. Update any tutorials or guides that reference following mechanics

## Risk Assessment

### Low Risk

- File movement is straightforward
- Namespace updates are systematic
- Color change is cosmetic only

### Medium Risk

- Tests will need extensive updates (49+ files)
- Save game compatibility if following relationships are stored
- Operation schema references need careful handling

### High Risk

- JavaScript operation handlers are tightly integrated with engine
- Component ID constants are used throughout the codebase
- Cross-module dependencies in JavaScript code
- Engine-level operations may not be modularizable

### Mitigation Strategies

1. Comprehensive search for all references before migration
2. Keep backup of original files
3. Create a migration branch for safe experimentation
4. Test thoroughly with existing save games
5. Consider providing a migration script for save game conversion
6. Run full test suite after each migration phase
7. Consider keeping operation handlers in core with namespace-aware logic
8. Document architectural decisions for future reference

## Success Criteria

1. ✅ All companionship JSON files successfully moved to new mod
2. ✅ All namespaces updated correctly in JSON and JavaScript
3. ✅ Actions display with Deep Teal color scheme
4. ✅ All tests pass after updates (49+ test files)
5. ✅ Following/dismissing works as before
6. ✅ Auto-movement of followers still functions
7. ✅ No errors in console during gameplay
8. ✅ Mod can be disabled without breaking core gameplay
9. ✅ Operation handlers work with new component namespaces
10. ✅ Cross-mod dependencies (movement) still function

## Estimated Effort

- **File Migration**: 1-2 hours
- **Namespace Updates (JSON)**: 1-2 hours
- **JavaScript Updates**: 2-3 hours (new)
- **Operation Schema Updates**: 1 hour (new)
- **Testing & Debugging**: 3-5 hours (increased due to 49+ test files)
- **Test File Updates**: 2-3 hours (new)
- **Documentation**: 1 hour
- **Total Estimate**: 12-20 hours (increased from 5-9 hours)

## Notes

- Consider future enhancements like group following, follow distance settings, or follower AI behaviors
- This modularization sets precedent for extracting other optional systems from core
- Deep Teal color choice aligns well with trust-building theme of companionship
- **Critical Discovery**: JavaScript operation handlers and utility files were not initially documented but are essential for the migration
- **Architectural Consideration**: Operation handlers might need to remain in core with mod-aware logic rather than full migration
- **Test Impact**: 49+ test files will need updates, significantly increasing the migration effort

## Key Architectural Decisions Needed

1. **Operation Handler Strategy**: Should operation handlers remain in core with namespace awareness, or attempt full migration?
2. **Schema Location**: Should operation schemas stay in core or migrate to companionship?
3. **Component ID Constants**: How to handle shared constants that may be used by multiple mods?
4. **Test Strategy**: Update tests incrementally or all at once?

---

_Report Generated: 2025-01-18_
_Report Updated: 2025-01-18 - Added JavaScript dependencies, operation schemas, and expanded test impacts_
_Next Step: Review architectural decisions and approve migration plan before execution_
