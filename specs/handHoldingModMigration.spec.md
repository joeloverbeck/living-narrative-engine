# Hand-Holding Mod Migration Specification

**Version**: 1.1.0 (Corrected)
**Status**: Draft - Validated Against Codebase
**Author**: Living Narrative Engine Team
**Date**: 2025-10-17
**Last Validated**: 2025-10-17

## Validation Summary

This specification has been validated against the actual codebase and corrected for accuracy. Key corrections made:

### ✅ Verified Correct Assumptions
- All 12 files to migrate exist (3 actions, 2 components, 4 conditions, 3 rules)
- All 7 test files exist in correct locations
- Mod ID pattern `^[a-zA-Z0-9_-]+$` allows hyphenated IDs (✅ `hand-holding`)
- Color scheme (Velvet Twilight) details are accurate
- Component schemas match spec descriptions
- Validation scripts exist as referenced
- No external references to hand-holding content

### 🔧 Corrected Assumptions
1. **Dependencies** - Removed `descriptors` (exists but not loaded in game.json)
2. **Scope Strategy** - Changed from "depend on affection" to "move scope to positioning mod"
3. **Circular Coupling** - Eliminated risk by placing shared scope in positioning mod
4. **Game.json** - Updated to show actual current mod list and correct insertion point
5. **Scope Namespace** - Added prerequisite phase to migrate scope first

### 🎯 Architecture Improvements
- Cleaner dependency graph (hand-holding → positioning, not → affection)
- Shared scope in logical location (positioning mod)
- Eliminates potential circular coupling
- Follows single-source-of-truth principle

## Executive Summary

This specification outlines the migration of hand-holding related content from the `affection` mod to a new dedicated `hand-holding` mod. This migration is necessary due to the introduction of state-based components for hand-holding interactions, which will enable future actions that break, modify, or enhance the hand-holding state.

## Rationale

### Current State
The `affection` mod currently contains three hand-holding actions along with state-based components:
- `hold_hand.action.json` - Establishes hand-holding state
- `squeeze_hand_reassuringly.action.json` - Requires existing hand-holding state
- `warm_hands_between_yours.action.json` - Requires existing hand-holding state

These actions use two state components:
- `holding_hand.component.json` - Marks entity actively holding another's hand
- `hand_held.component.json` - Marks entity whose hand is being held

### Migration Justification
1. **State Management**: Hand-holding now uses a sophisticated state system with bidirectional relationships
2. **Future Extensibility**: Planned actions will break/modify hand-holding state (release, pull away, intertwine fingers)
3. **Mod Organization**: Dedicated mod allows focused development without bloating affection mod
4. **Semantic Clarity**: Hand-holding is a specific mechanic distinct from general affectionate gestures

## Mod Naming Convention

### Mod ID Requirements
Per `data/schemas/mod-manifest.schema.json` (line 16), mod IDs must match pattern: `^[a-zA-Z0-9_-]+$`

**✅ Compliant**: `hand-holding` (hyphen separator)
**✅ Compliant**: `hand_holding` (underscore separator)
**❌ Non-Compliant**: `hand holding` (spaces not allowed)

### Mod Structure
```
data/mods/hand-holding/
├── mod-manifest.json
├── actions/
│   ├── hold_hand.action.json
│   ├── squeeze_hand_reassuringly.action.json
│   └── warm_hands_between_yours.action.json
├── components/
│   ├── holding_hand.component.json
│   └── hand_held.component.json
├── conditions/
│   ├── actors-are-holding-hands.condition.json
│   ├── event-is-action-hold-hand.condition.json
│   ├── event-is-action-squeeze-hand-reassuringly.condition.json
│   └── event-is-action-warm-hands-between-yours.condition.json
└── rules/
    ├── handle_hold_hand.rule.json
    ├── handle_squeeze_hand_reassuringly.rule.json
    └── handle_warm_hands_between_yours.rule.json
```

## Color Scheme Selection

### Current Usage
The `affection` mod uses **Soft Purple** (Section 3.1):
```json
{
  "backgroundColor": "#6a1b9a",
  "textColor": "#f3e5f5",
  "hoverBackgroundColor": "#8e24aa",
  "hoverTextColor": "#ffffff"
}
```
- Normal Contrast: 10.89:1 🌟 AAA
- Hover Contrast: 7.04:1 🌟 AAA

### Recommended Color Scheme
**Velvet Twilight** (Section 11.3) - Available, thematically appropriate for intimate gestures:

```json
{
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#451952",
  "hoverTextColor": "#f3e5f5"
}
```
- Normal Contrast: 15.01:1 🌟 AAA
- Hover Contrast: 11.45:1 🌟 AAA
- Theme: Luxurious nightfall, refined intrigue, intimate connection

### Alternative Options
If Velvet Twilight doesn't fit the design vision:

1. **Velvet Twilight** (Section 11.3) - Primary recommendation ✅
2. **Starlight Navy** (Section 11.4) - Cool, calm, disciplined (#0f172a)
3. **Arctic Steel** (Section 11.8) - Precise, clear, high-tech (#112a46)

### Color Scheme Documentation Update
After color selection, update `specs/wcag-compliant-color-combinations.spec.md`:

**Section to modify**: Add under selected scheme (e.g., Section 11.3)
```markdown
- ✅ **USED BY**: Hand Holding mod (hand-holding interactions, state-based gestures)
```

## Scope Migration (PREREQUISITE)

**IMPORTANT**: Before migrating hand-holding files, the shared scope must be moved to `positioning` mod.

### Scope to Move
**Source**: `data/mods/affection/scopes/close_actors_facing_each_other_or_behind_target.scope`
**Destination**: `data/mods/positioning/scopes/close_actors_facing_each_other_or_behind_target.scope`

### Required Updates After Scope Move:

1. **Affection mod** - Update all action files that reference:
   - `affection:close_actors_facing_each_other_or_behind_target`
   - Change to: `positioning:close_actors_facing_each_other_or_behind_target`

2. **Hand_holding mod** - Use the new reference:
   - `positioning:close_actors_facing_each_other_or_behind_target`

3. **Affection mod-manifest.json** - Remove scope from content.scopes array

4. **Positioning mod-manifest.json** - Add scope to content.scopes array

### Scope Content (for verification):
```
// Scope for actors in closeness who are either facing each other OR actor is behind the target
affection:close_actors_facing_each_other_or_behind_target := actor.components.positioning:closeness.partners[][{
  "or": [
    {"condition_ref": "positioning:both-actors-facing-each-other"},
    {"condition_ref": "positioning:actor-is-behind-entity"}
  ]
}]
```

**After migration, update to**:
```
positioning:close_actors_facing_each_other_or_behind_target := actor.components.positioning:closeness.partners[][{
  "or": [
    {"condition_ref": "positioning:both-actors-facing-each-other"},
    {"condition_ref": "positioning:actor-is-behind-entity"}
  ]
}]
```

## Files to Migrate

### Actions (3 files)
Source: `data/mods/affection/actions/`
Destination: `data/mods/hand-holding/actions/`

1. **hold_hand.action.json**
   - Current ID: `affection:hold_hand`
   - New ID: `hand-holding:hold_hand`
   - Update visual properties to new color scheme
   - Update targets scope reference: `affection:close_actors_facing_each_other_or_behind_target` → `positioning:close_actors_facing_each_other_or_behind_target`
   - Update forbidden_components references to use `hand-holding:` namespace

2. **squeeze_hand_reassuringly.action.json**
   - Current ID: `affection:squeeze_hand_reassuringly`
   - New ID: `hand-holding:squeeze_hand_reassuringly`
   - Update condition reference: `affection:actors-are-holding-hands` → `hand-holding:actors-are-holding-hands`
   - Update targets scope reference: `affection:close_actors_facing_each_other_or_behind_target` → `positioning:close_actors_facing_each_other_or_behind_target`
   - Update visual properties to new color scheme

3. **warm_hands_between_yours.action.json**
   - Current ID: `affection:warm_hands_between_yours`
   - New ID: `hand-holding:warm_hands_between_yours`
   - Update condition reference: `affection:actors-are-holding-hands` → `hand-holding:actors-are-holding-hands`
   - Update targets scope reference: `affection:close_actors_facing_each_other_or_behind_target` → `positioning:close_actors_facing_each_other_or_behind_target`
   - Update visual properties to new color scheme

### Components (2 files)
Source: `data/mods/affection/components/`
Destination: `data/mods/hand-holding/components/`

1. **holding_hand.component.json**
   - Current ID: `affection:holding_hand`
   - New ID: `hand-holding:holding_hand`
   - No schema changes required

2. **hand_held.component.json**
   - Current ID: `affection:hand_held`
   - New ID: `hand-holding:hand_held`
   - No schema changes required

### Conditions (4 files)
Source: `data/mods/affection/conditions/`
Destination: `data/mods/hand-holding/conditions/`

1. **actors-are-holding-hands.condition.json**
   - Current ID: `affection:actors-are-holding-hands`
   - New ID: `hand-holding:actors-are-holding-hands`
   - Update component references in logic:
     - `affection:holding_hand` → `hand-holding:holding_hand`
     - `affection:hand_held` → `hand-holding:hand_held`

2. **event-is-action-hold-hand.condition.json**
   - Current ID: `affection:event-is-action-hold-hand`
   - New ID: `hand-holding:event-is-action-hold-hand`
   - Update action ID reference: `affection:hold_hand` → `hand-holding:hold_hand`

3. **event-is-action-squeeze-hand-reassuringly.condition.json**
   - Current ID: `affection:event-is-action-squeeze-hand-reassuringly`
   - New ID: `hand-holding:event-is-action-squeeze-hand-reassuringly`
   - Update action ID reference

4. **event-is-action-warm-hands-between-yours.condition.json**
   - Current ID: `affection:event-is-action-warm-hands-between-yours`
   - New ID: `hand-holding:event-is-action-warm-hands-between-yours`
   - Update action ID reference

### Rules (3 files)
Source: `data/mods/affection/rules/`
Destination: `data/mods/hand-holding/rules/`

1. **handle_hold_hand.rule.json**
   - Current rule_id: `handle_hold_hand`
   - New rule_id: `handle_hold_hand` (can remain the same or prefix with mod)
   - Update condition reference: `affection:event-is-action-hold-hand` → `hand-holding:event-is-action-hold-hand`
   - Update component types in all operations:
     - `affection:holding_hand` → `hand-holding:holding_hand`
     - `affection:hand_held` → `hand-holding:hand_held`

2. **handle_squeeze_hand_reassuringly.rule.json**
   - Update condition reference to new mod namespace
   - No component operations in this rule

3. **handle_warm_hands_between_yours.rule.json**
   - Update condition reference to new mod namespace
   - No component operations in this rule

### Scopes (DECISION REQUIRED - CRITICAL)
The affection mod uses `close_actors_facing_each_other_or_behind_target.scope` which may be shared across multiple actions.

**Analysis of scope dependencies**:
- The scope uses only `positioning:closeness` component and positioning conditions
- No affection-specific logic is in the scope
- Both affection and hand-holding need this scope
- Scope logically belongs in `positioning` mod

**Decision Required**:
- **Option A**: ❌ Keep scope in affection mod, hand-holding depends on affection (creates circular coupling risk)
- **Option B**: ⚠️ Duplicate scope in hand-holding mod (maintains independence but duplication)
- **Option C**: ✅ Move scope to `positioning` mod (clean architecture, shared dependency)

**REVISED RECOMMENDATION**: **Option C** - Move scope to `positioning` mod. This:
- Eliminates circular coupling between affection and hand-holding
- Places scope with its logical dependency (positioning components)
- Allows both mods to depend on positioning without cross-dependency
- Follows single-source-of-truth principle

## Dependency Management

### New Mod Dependencies
`hand-holding` mod-manifest.json should declare:

```json
{
  "dependencies": [
    {
      "id": "core",
      "version": "^1.0.0"
    },
    {
      "id": "positioning",
      "version": "^1.0.0"
    }
  ]
}
```

**Rationale**:
- `core`: Required for base systems, position components
- `positioning`: Required for closeness components used in action requirements
- **NOT affection**: Removed to avoid circular coupling; scope should be moved to `positioning` mod instead

### Affection Mod Updates
Update `data/mods/affection/mod-manifest.json`:

1. **Remove migrated files** from content arrays:
   - Remove 3 actions from `content.actions`
   - Remove 2 components from `content.components`
   - Remove 4 conditions from `content.conditions`
   - Remove 3 rules from `content.rules`

2. **Potentially add dependency** on hand-holding if future affection actions reference hand-holding state:
```json
{
  "dependencies": [
    {
      "id": "hand-holding",
      "version": "^1.0.0"
    }
  ]
}
```

### Game Load Order
Update `data/game.json` to include new mod in load order:
```json
{
  "mods": [
    "core",
    "movement",
    "companionship",
    "positioning",
    "items",
    "anatomy",
    "clothing",
    "exercise",
    "distress",
    "violence",
    "seduction",
    "affection",
    "hand-holding",
    "caressing",
    "kissing",
    "p_erotica"
  ]
}
```

**Critical**:
- `hand-holding` must load after its dependencies (core, positioning)
- Placement after `affection` maintains logical grouping
- Note: `descriptors` mod exists but is NOT currently loaded in game.json

## ID Remapping Reference

### Complete Mapping Table

| Old ID (affection) | New ID (hand-holding) | Type |
|-------------------|----------------------|------|
| `affection:hold_hand` | `hand-holding:hold_hand` | Action |
| `affection:squeeze_hand_reassuringly` | `hand-holding:squeeze_hand_reassuringly` | Action |
| `affection:warm_hands_between_yours` | `hand-holding:warm_hands_between_yours` | Action |
| `affection:holding_hand` | `hand-holding:holding_hand` | Component |
| `affection:hand_held` | `hand-holding:hand_held` | Component |
| `affection:actors-are-holding-hands` | `hand-holding:actors-are-holding-hands` | Condition |
| `affection:event-is-action-hold-hand` | `hand-holding:event-is-action-hold-hand` | Condition |
| `affection:event-is-action-squeeze-hand-reassuringly` | `hand-holding:event-is-action-squeeze-hand-reassuringly` | Condition |
| `affection:event-is-action-warm-hands-between-yours` | `hand-holding:event-is-action-warm-hands-between-yours` | Condition |

### Search and Replace Strategy

**Files to search across**:
- All migrated action files
- All migrated component files
- All migrated condition files
- All migrated rule files
- All test files

**Replace patterns**:
```bash
# Component references
"affection:holding_hand" → "hand-holding:holding_hand"
"affection:hand_held" → "hand-holding:hand_held"

# Action references
"affection:hold_hand" → "hand-holding:hold_hand"
"affection:squeeze_hand_reassuringly" → "hand-holding:squeeze_hand_reassuringly"
"affection:warm_hands_between_yours" → "hand-holding:warm_hands_between_yours"

# Condition references
"affection:actors-are-holding-hands" → "hand-holding:actors-are-holding-hands"
"affection:event-is-action-hold-hand" → "hand-holding:event-is-action-hold-hand"
"affection:event-is-action-squeeze-hand-reassuringly" → "hand-holding:event-is-action-squeeze-hand-reassuringly"
"affection:event-is-action-warm-hands-between-yours" → "hand-holding:event-is-action-warm-hands-between-yours"
```

## Test Suite Migration

### Test Files to Migrate (8 identified)

Source: `tests/integration/mods/affection/`
Destination: `tests/integration/mods/hand-holding/`

#### Integration Tests
1. **hold_hand_action.test.js**
   - Move to `tests/integration/mods/hand-holding/`
   - Update all imports: `affection` → `hand-holding`
   - Update component references in assertions
   - Update action ID references

2. **hold_hand_action_discovery.test.js**
   - Move to `tests/integration/mods/hand-holding/`
   - Update test bed configuration for new mod
   - Update action ID expectations

3. **hold_hand_first_time.integration.test.js**
   - Move to `tests/integration/mods/hand-holding/`
   - Update mod loading in test setup
   - Update component and action references

4. **squeeze_hand_reassuringly_action.test.js**
   - Move to `tests/integration/mods/hand-holding/`
   - Update all namespace references

5. **squeeze_hand_reassuringly_action_discovery.test.js**
   - Move to `tests/integration/mods/hand-holding/`
   - Update action discovery expectations

6. **warm_hands_between_yours_action.test.js**
   - Move to `tests/integration/mods/hand-holding/`
   - Update all namespace references

7. **warm_hands_between_yours_action_discovery.test.js**
   - Move to `tests/integration/mods/hand-holding/`
   - Update action discovery expectations

#### Performance Tests (Review)
8. **ModTestHandlerFactory.performance.test.js**
   - Located in `tests/performance/common/mods/`
   - May reference hand_held component in test data
   - Review and update if necessary

### Test Update Checklist
For each test file:
- [ ] Update mod ID in test bed initialization
- [ ] Update all action ID references (`affection:*` → `hand-holding:*`)
- [ ] Update all component ID references
- [ ] Update all condition ID references
- [ ] Update test descriptions to reflect new mod name
- [ ] Verify test still loads correct dependencies
- [ ] Update any mock data with new IDs
- [ ] Ensure coverage reports correctly attribute to new mod

### Test Execution Commands
```bash
# Run migrated tests
npm run test:integration -- tests/integration/mods/hand-holding/

# Run all integration tests to verify no breaks
npm run test:integration

# Run full test suite
npm run test:ci
```

### Coverage Requirements
- Maintain 80%+ branch coverage
- Maintain 90%+ function and line coverage
- All tests must pass before migration is considered complete

## Validation Requirements

### JSON Schema Validation
All migrated files must pass schema validation:

```bash
# Validate entire mod
npm run validate:mod:hand-holding

# Validate specific file types
node scripts/validateMods.js --mod hand-holding --type actions
node scripts/validateMods.js --mod hand-holding --type components
node scripts/validateMods.js --mod hand-holding --type conditions
node scripts/validateMods.js --mod hand-holding --type rules
```

### Visual Properties Validation
Verify WCAG compliance for new color scheme:

```bash
node scripts/validateVisualContrast.js
```

**Expected results**:
- All actions pass WCAG 2.1 AA (minimum 4.5:1 contrast)
- Velvet Twilight achieves AAA (15.01:1 normal, 11.45:1 hover)

### Dependency Validation
Ensure proper dependency resolution:

```bash
# Check for circular dependencies
npm run depcruise:validate

# Verify mod load order
node scripts/validateModLoadOrder.js
```

### Cross-Reference Validation
Verify no broken references remain:

```bash
# Search for old namespace references
grep -r "affection:hold_hand" data/mods/
grep -r "affection:holding_hand" data/mods/
grep -r "affection:hand_held" data/mods/

# Should return no results after migration
```

## Future Extensibility

### Planned Future Actions

#### State Breaking Actions
1. **release_hand.action.json**
   - Gracefully ends hand-holding state
   - Removes both `holding_hand` and `hand_held` components
   - Neutral emotional context

2. **pull_hand_away.action.json**
   - Abruptly breaks hand-holding state
   - May indicate discomfort or tension
   - Negative emotional context

#### State Modification Actions
3. **intertwine_fingers.action.json**
   - Requires existing hand-holding state
   - Adds new component: `fingers_intertwined`
   - Increases intimacy level

4. **swing_hands.action.json**
   - Requires existing hand-holding state
   - Playful variation
   - Adds temporary animation/descriptor

5. **lift_hand_to_lips.action.json**
   - Requires existing hand-holding state
   - Romantic escalation
   - May transition to kissing actions

### Component State Machine

```
[No State]
    ↓ hold_hand
[holding_hand ⟷ hand_held]
    ↓ intertwine_fingers
[holding_hand + fingers_intertwined ⟷ hand_held + fingers_intertwined]
    ↓ release_hand OR pull_hand_away
[No State]
```

### Component Extensions
Future components to consider:
- `fingers_intertwined` - Enhanced intimacy marker
- `hand_held_reluctantly` - Consent/comfort tracking
- `hand-holding_initiated_at` - Timestamp for duration tracking

## Implementation Checklist

### Phase 0: Scope Migration (PREREQUISITE)
- [ ] Move `close_actors_facing_each_other_or_behind_target.scope` from affection to positioning
- [ ] Update scope content to use `positioning:` namespace instead of `affection:`
- [ ] Update positioning mod-manifest.json to include the scope
- [ ] Update all affection actions that reference the old scope to use new `positioning:` reference
- [ ] Update affection mod-manifest.json to remove the scope from content.scopes
- [ ] Test affection mod still works after scope migration
- [ ] Commit scope migration separately before proceeding

### Phase 1: Preparation
- [ ] Review this specification completely
- [ ] Verify color scheme selection (Velvet Twilight recommended)
- [ ] Create backup of affection mod
- [ ] Create feature branch: `feature/hand-holding-mod-migration`
- [ ] Set up test environment with mod validation enabled

### Phase 2: Mod Structure Creation
- [ ] Create `data/mods/hand-holding/` directory
- [ ] Create subdirectories: `actions/`, `components/`, `conditions/`, `rules/`
- [ ] Create `mod-manifest.json` with proper dependencies
- [ ] Validate directory structure

### Phase 3: File Migration
- [ ] Copy 3 action files to new mod
- [ ] Copy 2 component files to new mod
- [ ] Copy 4 condition files to new mod
- [ ] Copy 3 rule files to new mod
- [ ] Verify all files copied successfully

### Phase 4: ID Remapping
- [ ] Update action IDs and visual properties (new color scheme)
- [ ] Update component IDs
- [ ] Update condition IDs and component references in logic
- [ ] Update rule condition references and component operations
- [ ] Update forbidden_components and required_components in actions
- [ ] Verify all ID references are consistent

### Phase 5: Affection Mod Updates
- [ ] Remove migrated files from affection mod-manifest.json
- [ ] Remove physical files from affection mod directories
- [ ] Validate affection mod still loads correctly
- [ ] Test remaining affection actions work properly

### Phase 6: Color Scheme Documentation
- [ ] Update `specs/wcag-compliant-color-combinations.spec.md`
- [ ] Mark Velvet Twilight as "USED BY: Hand Holding mod"
- [ ] Update usage overview table
- [ ] Commit color scheme documentation

### Phase 7: Test Migration
- [ ] Move 7 integration test files to `tests/integration/mods/hand-holding/`
- [ ] Update all test file references and imports
- [ ] Update test descriptions and mod configurations
- [ ] Review performance test for necessary updates
- [ ] Verify tests can load new mod structure

### Phase 8: Validation
- [ ] Run `npm run validate:mod:hand-holding`
- [ ] Run `node scripts/validateVisualContrast.js`
- [ ] Verify no broken references: `grep -r "affection:hold" data/mods/`
- [ ] Check dependency resolution: `npm run depcruise:validate`
- [ ] Validate mod load order

### Phase 9: Testing
- [ ] Run unit tests: `npm run test:unit`
- [ ] Run hand-holding integration tests: `npm run test:integration -- tests/integration/mods/hand-holding/`
- [ ] Run affection integration tests to verify no breaks
- [ ] Run full integration test suite: `npm run test:integration`
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify 80%+ branch coverage maintained

### Phase 10: Game Integration
- [ ] Update `data/game.json` with new mod in load order
- [ ] Test game loads successfully
- [ ] Test hand-holding actions in-game
- [ ] Verify action buttons display with correct colors
- [ ] Test action execution creates correct components

### Phase 11: Documentation
- [ ] Update main README.md if necessary
- [ ] Create mod-specific README in `data/mods/hand-holding/README.md`
- [ ] Document state machine and future extensibility
- [ ] Update CHANGELOG.md with migration notes

### Phase 12: Final Review
- [ ] Code review with team
- [ ] Manual testing of all hand-holding scenarios
- [ ] Performance testing (no regression)
- [ ] Accessibility testing (color contrast verification)
- [ ] Cross-browser compatibility testing

### Phase 13: Deployment
- [ ] Merge feature branch to main
- [ ] Tag release with version number
- [ ] Deploy to staging environment
- [ ] Smoke test in staging
- [ ] Deploy to production
- [ ] Monitor for issues

## Risk Assessment

### High Risk Areas
1. **Scope Migration**: Moving the shared scope to positioning mod affects multiple affection actions
2. **Component Reference Updates**: Missing a component reference in rules could cause runtime errors
3. **Test Coverage Gaps**: If tests don't fully exercise state transitions, bugs may slip through
4. **Dependency Ordering**: Incorrect mod load order could break hand-holding functionality
5. **Namespace Updates**: Missing scope reference updates (`affection:` → `positioning:`) will break actions

### Mitigation Strategies
1. Migrate scope to positioning mod FIRST, in separate commit
2. Test affection mod after scope migration before proceeding
3. Use automated search/replace with verification for namespace updates
4. Comprehensive test suite execution before merge
5. Explicit validation of dependency graph
6. Full codebase search for old namespace references

### Rollback Plan
If critical issues discovered post-migration:
1. Revert to backup of affection mod
2. Remove hand-holding mod from game.json
3. Restore original test files
4. Investigate issues and re-plan migration

## Success Criteria

Migration is considered successful when:
- ✅ All files migrated and properly namespaced
- ✅ All test suites pass (80%+ coverage)
- ✅ All validation scripts pass
- ✅ No broken references in codebase
- ✅ Hand-holding actions work correctly in-game
- ✅ Color scheme properly applied and accessible
- ✅ Mod loads in correct dependency order
- ✅ Documentation complete and accurate

## Appendix A: File Locations Quick Reference

### Source Files (Affection Mod)
```
data/mods/affection/
├── actions/
│   ├── hold_hand.action.json
│   ├── squeeze_hand_reassuringly.action.json
│   └── warm_hands_between_yours.action.json
├── components/
│   ├── holding_hand.component.json
│   └── hand_held.component.json
├── conditions/
│   ├── actors-are-holding-hands.condition.json
│   ├── event-is-action-hold-hand.condition.json
│   ├── event-is-action-squeeze-hand-reassuringly.condition.json
│   └── event-is-action-warm-hands-between-yours.condition.json
└── rules/
    ├── handle_hold_hand.rule.json
    ├── handle_squeeze_hand_reassuringly.rule.json
    └── handle_warm_hands_between_yours.rule.json
```

### Destination Files (Hand Holding Mod)
```
data/mods/hand-holding/
├── mod-manifest.json (NEW)
├── actions/
│   ├── hold_hand.action.json (MIGRATED + UPDATED)
│   ├── squeeze_hand_reassuringly.action.json (MIGRATED + UPDATED)
│   └── warm_hands_between_yours.action.json (MIGRATED + UPDATED)
├── components/
│   ├── holding_hand.component.json (MIGRATED + UPDATED)
│   └── hand_held.component.json (MIGRATED + UPDATED)
├── conditions/
│   ├── actors-are-holding-hands.condition.json (MIGRATED + UPDATED)
│   ├── event-is-action-hold-hand.condition.json (MIGRATED + UPDATED)
│   ├── event-is-action-squeeze-hand-reassuringly.condition.json (MIGRATED + UPDATED)
│   └── event-is-action-warm-hands-between-yours.condition.json (MIGRATED + UPDATED)
└── rules/
    ├── handle_hold_hand.rule.json (MIGRATED + UPDATED)
    ├── handle_squeeze_hand_reassuringly.rule.json (MIGRATED + UPDATED)
    └── handle_warm_hands_between_yours.rule.json (MIGRATED + UPDATED)
```

### Test Files
```
tests/integration/mods/hand-holding/
├── hold_hand_action.test.js (MIGRATED + UPDATED)
├── hold_hand_action_discovery.test.js (MIGRATED + UPDATED)
├── hold_hand_first_time.integration.test.js (MIGRATED + UPDATED)
├── squeeze_hand_reassuringly_action.test.js (MIGRATED + UPDATED)
├── squeeze_hand_reassuringly_action_discovery.test.js (MIGRATED + UPDATED)
├── warm_hands_between_yours_action.test.js (MIGRATED + UPDATED)
└── warm_hands_between_yours_action_discovery.test.js (MIGRATED + UPDATED)
```

## Appendix B: Color Scheme Visual Reference

### Velvet Twilight (Recommended)
```
Normal State:
┌─────────────────────────────────────┐
│ #ffebf0 (text)                      │
│                                     │
│   Action: Hold Hand                 │
│                                     │
│ #2c0e37 (background)                │
└─────────────────────────────────────┘

Hover State:
┌─────────────────────────────────────┐
│ #f3e5f5 (text)                      │
│                                     │
│   Action: Hold Hand                 │
│                                     │
│ #451952 (background)                │
└─────────────────────────────────────┘
```

**Psychological Association**: Luxurious, intimate, elegant nightfall - perfect for the tender gesture of hand-holding

## Appendix C: Validation Commands Summary

```bash
# Complete validation suite
npm run validate:mod:hand-holding
node scripts/validateVisualContrast.js
npm run depcruise:validate
npm run test:ci

# Quick validation during development
npx eslint data/mods/hand-holding/**/*.json
npm run test:integration -- tests/integration/mods/hand-holding/

# Search for broken references
grep -r "affection:hold_hand" data/mods/ tests/
grep -r "affection:holding_hand" data/mods/ tests/
grep -r "affection:hand_held" data/mods/ tests/
```

---

**Document Status**: Ready for Implementation
**Estimated Effort**: 4-6 hours
**Risk Level**: Medium (manageable with proper testing)
**Priority**: Medium (enables future hand-holding enhancements)