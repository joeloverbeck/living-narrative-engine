# Sex-Physical-Control Mod Migration Specification

**Status**: Draft
**Version**: 1.0.0
**Created**: 2025-01-11
**Author**: Living Narrative Engine Team

---

## 1. Executive Summary

### 1.1 Purpose

This specification documents the migration of three sex-related physical control actions from their original mods (`sex-penile-manual` and `sex-penile-oral`) into a new dedicated mod at `data/mods/sex-physical-control/`.

### 1.2 Rationale

These actions share a common theme of **physical guidance and control in a sexual context**, distinct from:
- **Non-sexual physical control** (`physical-control` mod) - forcing to knees, bending over surfaces
- **Sexual acts without control elements** (other sex mods) - consensual/mutual sexual activities

By grouping these actions into a dedicated mod, we achieve:
- ✅ Clear semantic organization
- ✅ Easier content filtering/moderation
- ✅ Consistent visual identity (unified color scheme)
- ✅ Simplified mod dependencies

### 1.3 Migration Complexity

| Action | Complexity | Reason |
|--------|-----------|---------|
| `guide_hand_to_clothed_crotch` | **Low** | Simple narrative-only action |
| `pull_head_to_clothed_crotch` | **Low** | Simple narrative-only action |
| `pull_head_to_bare_penis` | **Medium** | Complex component state management (giving_blowjob/receiving_blowjob) |

---

## 2. Actions to Migrate

### 2.1 Guide Hand to Clothed Crotch

**Source**: `data/mods/sex-penile-manual/actions/guide_hand_to_clothed_crotch.action.json`
**Current ID**: `sex-penile-manual:guide_hand_to_clothed_crotch`
**New ID**: `sex-physical-control:guide_hand_to_clothed_crotch`

**Description**: Take your partner's hand and nestle it against the clothed swell of your crotch.

**Dependencies**:
- Scope: `positioning:close_actors_facing_each_other_or_behind_target`
- Components: `positioning:closeness`
- Logic: `hasPartOfType`, `isSocketCovered`

**Migration Items**:
- ✅ Action file
- ✅ Condition: `event-is-action-guide-hand-to-clothed-crotch.condition.json`
- ✅ Rule: `handle_guide_hand_to_clothed_crotch.rule.json`

---

### 2.2 Pull Head to Bare Penis

**Source**: `data/mods/sex-penile-oral/actions/pull_head_to_bare_penis.action.json`
**Current ID**: `sex-penile-oral:pull_head_to_bare_penis`
**New ID**: `sex-physical-control:pull_head_to_bare_penis`

**Description**: Guide your partner's head down toward your uncovered penis while seated together, initiating oral sex.

**Dependencies**:
- Scope: `positioning:actors_sitting_close`
- Components: `positioning:sitting_on`, `positioning:closeness`
- Components Modified: `positioning:giving_blowjob`, `positioning:receiving_blowjob`
- Logic: `hasPartOfType`, `isSocketCovered`

**Migration Items**:
- ✅ Action file
- ✅ Condition: `event-is-action-pull-head-to-bare-penis.condition.json`
- ✅ Rule: `handle_pull_head_to_bare_penis.rule.json` (⚠️ **complex state management**)

**⚠️ Special Consideration**: This rule manages blowjob component state used by **24 actions** across multiple mods. Thorough testing required.

---

### 2.3 Pull Head to Clothed Crotch

**Source**: `data/mods/sex-penile-oral/actions/pull_head_to_clothed_crotch.action.json`
**Current ID**: `sex-penile-oral:pull_head_to_clothed_crotch`
**New ID**: `sex-physical-control:pull_head_to_clothed_crotch`

**Description**: Guide your partner's head down toward your bulging, still-covered crotch while seated together.

**Dependencies**:
- Scope: `positioning:actors_sitting_close`
- Components: `positioning:sitting_on`, `positioning:closeness`
- Logic: `hasPartOfType`, `isSocketCovered`

**Migration Items**:
- ✅ Action file
- ✅ Condition: `event-is-action-pull-head-to-clothed-crotch.condition.json`
- ✅ Rule: `handle_pull_head_to_clothed_crotch.rule.json`

---

## 3. Dependency Analysis

### 3.1 Dependencies to KEEP IN PLACE (Shared Across Multiple Actions)

**❌ DO NOT MIGRATE** - These are used by many actions across multiple mods:

| Dependency | Type | Source Mod | Usage Count | Reason |
|------------|------|------------|-------------|--------|
| `positioning:close_actors_facing_each_other_or_behind_target` | Scope | positioning | Multiple | Core positioning scope |
| `positioning:actors_sitting_close` | Scope | positioning | Multiple | Core positioning scope |
| `positioning:closeness` | Component | positioning | Universal | Core positioning state |
| `positioning:sitting_on` | Component | positioning | Universal | Core positioning state |
| `positioning:giving_blowjob` | Component | positioning | **24 actions** | Heavily shared sexual state |
| `positioning:receiving_blowjob` | Component | positioning | **24 actions** | Heavily shared sexual state |
| `hasPartOfType` | Logic Function | anatomy | Universal | Core anatomy validation |
| `isSocketCovered` | Logic Function | clothing | Universal | Core clothing validation |
| `core:logSuccessAndEndTurn` | Macro | core | Universal | Standard turn-ending macro |

### 3.2 Dependencies to MIGRATE (Action-Specific)

**✅ MIGRATE WITH ACTIONS** - These are only used by the migrating actions:

| Dependency | Type | Current Location | Used By |
|------------|------|------------------|---------|
| `handle_guide_hand_to_clothed_crotch.rule.json` | Rule | sex-penile-manual/rules/ | Only guide_hand action |
| `event-is-action-guide-hand-to-clothed-crotch.condition.json` | Condition | sex-penile-manual/conditions/ | Only guide_hand action |
| `handle_pull_head_to_bare_penis.rule.json` | Rule | sex-penile-oral/rules/ | Only pull_head_bare action |
| `event-is-action-pull-head-to-bare-penis.condition.json` | Condition | sex-penile-oral/conditions/ | Only pull_head_bare action |
| `handle_pull_head_to_clothed_crotch.rule.json` | Rule | sex-penile-oral/rules/ | Only pull_head_clothed action |
| `event-is-action-pull-head-to-clothed-crotch.condition.json` | Condition | sex-penile-oral/conditions/ | Only pull_head_clothed action |

---

## 4. Color Scheme Selection

### 4.1 Selected Scheme

**11.3 Velvet Twilight**
- Background: `#2c0e37` (deep purple-violet)
- Text: `#ffebf0` (soft blush white)
- Hover Background: `#3d1449` (lighter deep purple) - calculated 20% lighter
- Hover Text: `#ffffff` (pure white)
- Contrast Ratio: **15.01:1** (AAA compliant)

### 4.2 Rationale

**Thematic Fit**: "Elegant social actions, mysterious story beats, luxurious nightfall, refined intrigue"

This scheme perfectly captures the essence of sexual physical control:
- 🎭 **Mysterious/Luxurious** - Reflects the power dynamics and intimacy
- 💜 **Purple-Violet Tones** - Associated with sensuality, control, and desire
- ✨ **High Contrast** - Ensures excellent readability and accessibility
- 🌙 **Twilight Theme** - Evokes intimate, private moments

**Differentiation**:
- Physical-Control uses **11.2 Ironclad Slate** (grey - authoritative/forceful)
- Sex-Physical-Control uses **11.3 Velvet Twilight** (purple - sensual/controlled)

### 4.3 Color Application

Apply to all three actions in their `visual` property:

```json
"visual": {
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#3d1449",
  "hoverTextColor": "#ffffff"
}
```

### 4.4 Color Scheme Registration

**Update**: `specs/wcag-compliant-color-combinations.spec.md`

Mark scheme **11.3 Velvet Twilight** as:
```markdown
**Status**: ✅ **IN USE** - sex-physical-control mod
```

---

## 5. New Mod Structure

### 5.1 Directory Structure

```
data/mods/sex-physical-control/
├── mod-manifest.json
├── actions/
│   ├── guide_hand_to_clothed_crotch.action.json
│   ├── pull_head_to_bare_penis.action.json
│   └── pull_head_to_clothed_crotch.action.json
├── conditions/
│   ├── event-is-action-guide-hand-to-clothed-crotch.condition.json
│   ├── event-is-action-pull-head-to-bare-penis.condition.json
│   └── event-is-action-pull-head-to-clothed-crotch.condition.json
└── rules/
    ├── handle_guide_hand_to_clothed_crotch.rule.json
    ├── handle_pull_head_to_bare_penis.rule.json
    └── handle_pull_head_to_clothed_crotch.rule.json
```

### 5.2 Mod Manifest

**File**: `data/mods/sex-physical-control/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "sex-physical-control",
  "version": "1.0.0",
  "name": "Sex - Physical Control",
  "description": "Sexual actions involving physical guidance and control of a partner's body.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    { "id": "anatomy", "version": "^1.0.0" },
    { "id": "clothing", "version": "^1.0.0" },
    { "id": "core", "version": "^1.0.0" },
    { "id": "positioning", "version": "^1.0.0" },
    { "id": "sex-core", "version": "^1.0.0" }
  ],
  "content": {
    "actions": [
      "guide_hand_to_clothed_crotch.action.json",
      "pull_head_to_bare_penis.action.json",
      "pull_head_to_clothed_crotch.action.json"
    ],
    "conditions": [
      "event-is-action-guide-hand-to-clothed-crotch.condition.json",
      "event-is-action-pull-head-to-bare-penis.condition.json",
      "event-is-action-pull-head-to-clothed-crotch.condition.json"
    ],
    "rules": [
      "handle_guide_hand_to_clothed_crotch.rule.json",
      "handle_pull_head_to_bare_penis.rule.json",
      "handle_pull_head_to_clothed_crotch.rule.json"
    ]
  }
}
```

**Dependency Rationale**:
- **anatomy**: Required for `hasPartOfType` logic
- **clothing**: Required for `isSocketCovered` logic
- **core**: Required for system operations and macros
- **positioning**: Required for all positioning components and scopes
- **sex-core**: Recommended for consistency with other sex mods

---

## 6. File Operations

### 6.1 Files to CREATE

#### New Mod Files (with updated IDs and colors)

**Actions** (in `data/mods/sex-physical-control/actions/`):
1. `guide_hand_to_clothed_crotch.action.json`
   - Update ID: `sex-physical-control:guide_hand_to_clothed_crotch`
   - Update visual: Velvet Twilight colors

2. `pull_head_to_bare_penis.action.json`
   - Update ID: `sex-physical-control:pull_head_to_bare_penis`
   - Update visual: Velvet Twilight colors

3. `pull_head_to_clothed_crotch.action.json`
   - Update ID: `sex-physical-control:pull_head_to_clothed_crotch`
   - Update visual: Velvet Twilight colors

**Conditions** (in `data/mods/sex-physical-control/conditions/`):
1. `event-is-action-guide-hand-to-clothed-crotch.condition.json`
   - Update ID: `sex-physical-control:event-is-action-guide-hand-to-clothed-crotch`
   - Update action_id check: `sex-physical-control:guide_hand_to_clothed_crotch`

2. `event-is-action-pull-head-to-bare-penis.condition.json`
   - Update ID: `sex-physical-control:event-is-action-pull-head-to-bare-penis`
   - Update action_id check: `sex-physical-control:pull_head_to_bare_penis`

3. `event-is-action-pull-head-to-clothed-crotch.condition.json`
   - Update ID: `sex-physical-control:event-is-action-pull-head-to-clothed-crotch`
   - Update action_id check: `sex-physical-control:pull_head_to_clothed_crotch`

**Rules** (in `data/mods/sex-physical-control/rules/`):
1. `handle_guide_hand_to_clothed_crotch.rule.json`
   - Update condition_ref: `sex-physical-control:event-is-action-guide-hand-to-clothed-crotch`

2. `handle_pull_head_to_bare_penis.rule.json`
   - Update condition_ref: `sex-physical-control:event-is-action-pull-head-to-bare-penis`

3. `handle_pull_head_to_clothed_crotch.rule.json`
   - Update condition_ref: `sex-physical-control:event-is-action-pull-head-to-clothed-crotch`

**Manifest**:
- `mod-manifest.json` (new mod manifest as specified in section 5.2)

---

### 6.2 Files to DELETE

#### From sex-penile-manual

**Directory**: `data/mods/sex-penile-manual/`

- ❌ `actions/guide_hand_to_clothed_crotch.action.json`
- ❌ `conditions/event-is-action-guide-hand-to-clothed-crotch.condition.json`
- ❌ `rules/handle_guide_hand_to_clothed_crotch.rule.json`

#### From sex-penile-oral

**Directory**: `data/mods/sex-penile-oral/`

- ❌ `actions/pull_head_to_bare_penis.action.json`
- ❌ `actions/pull_head_to_clothed_crotch.action.json`
- ❌ `conditions/event-is-action-pull-head-to-bare-penis.condition.json`
- ❌ `conditions/event-is-action-pull-head-to-clothed-crotch.condition.json`
- ❌ `rules/handle_pull_head_to_bare_penis.rule.json`
- ❌ `rules/handle_pull_head_to_clothed_crotch.rule.json`

---

### 6.3 Files to UPDATE

#### sex-penile-manual/mod-manifest.json

Remove from `content.actions`:
```json
"guide_hand_to_clothed_crotch.action.json"
```

Remove from `content.conditions`:
```json
"event-is-action-guide-hand-to-clothed-crotch.condition.json"
```

Remove from `content.rules`:
```json
"handle_guide_hand_to_clothed_crotch.rule.json"
```

#### sex-penile-oral/mod-manifest.json

Remove from `content.actions`:
```json
"pull_head_to_bare_penis.action.json",
"pull_head_to_clothed_crotch.action.json"
```

Remove from `content.conditions`:
```json
"event-is-action-pull-head-to-bare-penis.condition.json",
"event-is-action-pull-head-to-clothed-crotch.condition.json"
```

Remove from `content.rules`:
```json
"handle_pull_head_to_bare_penis.rule.json",
"handle_pull_head_to_clothed_crotch.rule.json"
```

---

## 7. ID Update Matrix

### 7.1 Action ID Changes

| Old ID | New ID |
|--------|--------|
| `sex-penile-manual:guide_hand_to_clothed_crotch` | `sex-physical-control:guide_hand_to_clothed_crotch` |
| `sex-penile-oral:pull_head_to_bare_penis` | `sex-physical-control:pull_head_to_bare_penis` |
| `sex-penile-oral:pull_head_to_clothed_crotch` | `sex-physical-control:pull_head_to_clothed_crotch` |

### 7.2 Condition ID Changes

| Old ID | New ID |
|--------|--------|
| `sex-penile-manual:event-is-action-guide-hand-to-clothed-crotch` | `sex-physical-control:event-is-action-guide-hand-to-clothed-crotch` |
| `sex-penile-oral:event-is-action-pull-head-to-bare-penis` | `sex-physical-control:event-is-action-pull-head-to-bare-penis` |
| `sex-penile-oral:event-is-action-pull-head-to-clothed-crotch` | `sex-physical-control:event-is-action-pull-head-to-clothed-crotch` |

### 7.3 Condition References in Rules

Each rule's `condition_ref` field must be updated to reference the new condition ID:

**handle_guide_hand_to_clothed_crotch.rule.json**:
```json
"condition_ref": "sex-physical-control:event-is-action-guide-hand-to-clothed-crotch"
```

**handle_pull_head_to_bare_penis.rule.json**:
```json
"condition_ref": "sex-physical-control:event-is-action-pull-head-to-bare-penis"
```

**handle_pull_head_to_clothed_crotch.rule.json**:
```json
"condition_ref": "sex-physical-control:event-is-action-pull-head-to-clothed-crotch"
```

### 7.4 Action ID References in Conditions

Each condition must check for the new action ID:

**event-is-action-guide-hand-to-clothed-crotch.condition.json**:
```json
{
  "==": [
    { "var": "event.payload.action_id" },
    "sex-physical-control:guide_hand_to_clothed_crotch"
  ]
}
```

**event-is-action-pull-head-to-bare-penis.condition.json**:
```json
{
  "==": [
    { "var": "event.payload.action_id" },
    "sex-physical-control:pull_head_to_bare_penis"
  ]
}
```

**event-is-action-pull-head-to-clothed-crotch.condition.json**:
```json
{
  "==": [
    { "var": "event.payload.action_id" },
    "sex-physical-control:pull_head_to_clothed_crotch"
  ]
}
```

---

## 8. Testing Requirements

### 8.1 Unit Tests

Create test files in `tests/integration/mods/sex-physical-control/`:

#### 8.1.1 Action Discovery Tests

**File**: `guide_hand_to_clothed_crotch_action_discovery.test.js`
- ✅ Action appears when actor has penis and it's covered
- ✅ Action appears when target is in correct positioning scope
- ✅ Action hidden when actor lacks penis
- ✅ Action hidden when penis is uncovered
- ✅ Action hidden when target not in scope

**File**: `pull_head_to_bare_penis_action_discovery.test.js`
- ✅ Action appears when both actors sitting close
- ✅ Action appears when actor has uncovered penis
- ✅ Action hidden when actor has covered penis
- ✅ Action hidden when actors not sitting
- ✅ Action hidden when not close enough
- ✅ Action hidden when already receiving blowjob

**File**: `pull_head_to_clothed_crotch_action_discovery.test.js`
- ✅ Action appears when both actors sitting close
- ✅ Action appears when actor has covered penis
- ✅ Action hidden when penis is uncovered
- ✅ Action hidden when actors not sitting
- ✅ Action hidden when not close enough

#### 8.1.2 Rule Execution Tests

**File**: `guide_hand_to_clothed_crotch_action.test.js`
- ✅ Generates narrative output
- ✅ Ends turn successfully
- ✅ No component state changes

**File**: `pull_head_to_bare_penis_action.test.js`
- ✅ Generates narrative output
- ✅ Adds `giving_blowjob` component to primary target
- ✅ Adds `receiving_blowjob` component to actor
- ✅ Removes previous `giving_blowjob` from other entities
- ✅ Removes previous `receiving_blowjob` from other entities
- ✅ Ends turn successfully

**File**: `pull_head_to_clothed_crotch_action.test.js`
- ✅ Generates narrative output
- ✅ Ends turn successfully
- ✅ No component state changes

### 8.2 Integration Tests

**File**: `sex_physical_control_integration.test.js`

- ✅ All three actions load correctly from new mod
- ✅ Actions resolve correct scopes from positioning mod
- ✅ Actions validate anatomy correctly
- ✅ Actions validate clothing state correctly
- ✅ Color scheme renders correctly in UI
- ✅ No conflicts with other sex mods
- ✅ No conflicts with physical-control mod

### 8.3 Component State Management Tests

**File**: `blowjob_component_state_management.test.js`

Focus on `pull_head_to_bare_penis` action:

**Scenario 1**: Clean slate
- ✅ No prior blowjob components exist
- ✅ Action adds components correctly

**Scenario 2**: Actor already receiving blowjob from different target
- ✅ Previous `giving_blowjob` removed from old target
- ✅ Previous `receiving_blowjob` removed from actor
- ✅ New `giving_blowjob` added to new target
- ✅ New `receiving_blowjob` added to actor

**Scenario 3**: Target already giving blowjob to different actor
- ✅ Previous `giving_blowjob` removed from target
- ✅ Previous `receiving_blowjob` removed from old actor
- ✅ New `giving_blowjob` added to target
- ✅ New `receiving_blowjob` added to actor

### 8.4 Backward Compatibility Tests

**File**: `backward_compatibility.test.js`

- ✅ Old action IDs (`sex-penile-manual:*`, `sex-penile-oral:*`) no longer resolve
- ✅ New action IDs (`sex-physical-control:*`) resolve correctly
- ✅ Existing positioning components still work
- ✅ No breaking changes to shared dependencies

### 8.5 Manual Testing Checklist

#### Scenario A: Guide Hand to Clothed Crotch
1. Create two actors, position them close together facing each other
2. Give actor a penis anatomy
3. Ensure actor's penis is covered (clothing equipped)
4. Open action menu for actor
5. ✅ Verify "Guide Hand to Clothed Crotch" appears with Velvet Twilight colors
6. Execute action
7. ✅ Verify narrative output generated
8. ✅ Verify turn ended
9. ✅ Verify no component changes

#### Scenario B: Pull Head to Bare Penis
1. Create two actors, seat both on same furniture (bench/chair)
2. Give actor a penis anatomy
3. Ensure actor's penis is uncovered (remove clothing)
4. Open action menu for actor
5. ✅ Verify "Pull Head to Bare Penis" appears with Velvet Twilight colors
6. Execute action
7. ✅ Verify narrative output generated
8. ✅ Verify `giving_blowjob` component added to target
9. ✅ Verify `receiving_blowjob` component added to actor
10. ✅ Verify turn ended

#### Scenario C: Pull Head to Clothed Crotch
1. Create two actors, seat both on same furniture
2. Give actor a penis anatomy
3. Ensure actor's penis is covered (clothing equipped)
4. Open action menu for actor
5. ✅ Verify "Pull Head to Clothed Crotch" appears with Velvet Twilight colors
6. Execute action
7. ✅ Verify narrative output generated
8. ✅ Verify turn ended
9. ✅ Verify no component changes

---

## 9. Implementation Checklist

### Phase 1: Preparation

- [ ] Create new mod directory: `data/mods/sex-physical-control/`
- [ ] Create subdirectories: `actions/`, `conditions/`, `rules/`
- [ ] Update color scheme documentation in `specs/wcag-compliant-color-combinations.spec.md`

### Phase 2: Content Migration

#### Actions
- [ ] Copy `guide_hand_to_clothed_crotch.action.json` from sex-penile-manual
- [ ] Copy `pull_head_to_bare_penis.action.json` from sex-penile-oral
- [ ] Copy `pull_head_to_clothed_crotch.action.json` from sex-penile-oral
- [ ] Update all action IDs to `sex-physical-control:*` namespace
- [ ] Apply Velvet Twilight color scheme to all actions

#### Conditions
- [ ] Copy `event-is-action-guide-hand-to-clothed-crotch.condition.json` from sex-penile-manual
- [ ] Copy `event-is-action-pull-head-to-bare-penis.condition.json` from sex-penile-oral
- [ ] Copy `event-is-action-pull-head-to-clothed-crotch.condition.json` from sex-penile-oral
- [ ] Update all condition IDs to `sex-physical-control:*` namespace
- [ ] Update action_id checks in conditions to use new IDs

#### Rules
- [ ] Copy `handle_guide_hand_to_clothed_crotch.rule.json` from sex-penile-manual
- [ ] Copy `handle_pull_head_to_bare_penis.rule.json` from sex-penile-oral
- [ ] Copy `handle_pull_head_to_clothed_crotch.rule.json` from sex-penile-oral
- [ ] Update condition_ref in all rules to use new condition IDs

### Phase 3: Mod Manifest

- [ ] Create `mod-manifest.json` with correct dependencies
- [ ] List all actions in manifest
- [ ] List all conditions in manifest
- [ ] List all rules in manifest

### Phase 4: Source Cleanup

- [ ] Delete migrated files from `data/mods/sex-penile-manual/`
- [ ] Delete migrated files from `data/mods/sex-penile-oral/`
- [ ] Update `sex-penile-manual/mod-manifest.json` (remove deleted content)
- [ ] Update `sex-penile-oral/mod-manifest.json` (remove deleted content)

### Phase 5: Validation

- [ ] Run JSON schema validation on all new files
- [ ] Verify no broken references in remaining mods
- [ ] Check for any hardcoded old IDs in other files
- [ ] Verify mod loads correctly in game

### Phase 6: Testing

- [ ] Write and run unit tests for each action
- [ ] Write and run rule execution tests
- [ ] Write and run component state management tests
- [ ] Write and run integration tests
- [ ] Perform manual testing scenarios A, B, C
- [ ] Verify backward compatibility

### Phase 7: Documentation

- [ ] Update mod list documentation
- [ ] Add migration notes to changelog
- [ ] Document any breaking changes
- [ ] Update developer guides if needed

---

## 10. Risk Assessment

### 10.1 High Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Blowjob component state corruption** | High - affects 24 actions | Extensive testing of `pull_head_to_bare_penis` rule |
| **Broken references from other mods** | Medium | Thorough search for old action IDs in codebase |
| **Save state compatibility** | Medium | Test with existing save files if applicable |

### 10.2 Medium Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Missing dependency in manifest** | Medium | Verify all logic functions resolve correctly |
| **Color scheme conflicts** | Low | Velvet Twilight is currently unused |
| **Test coverage gaps** | Medium | Follow comprehensive test plan |

### 10.3 Low Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Typos in IDs** | Low | Schema validation catches malformed IDs |
| **Visual rendering issues** | Low | Color scheme is WCAG AAA compliant |

---

## 11. Success Criteria

### 11.1 Functional Requirements

- ✅ All three actions load and execute correctly
- ✅ No errors or warnings during mod loading
- ✅ Actions appear in UI with correct colors
- ✅ Prerequisites validate correctly
- ✅ Component state managed correctly (especially blowjob components)
- ✅ No conflicts with existing mods

### 11.2 Quality Requirements

- ✅ All tests pass (unit, integration, manual)
- ✅ Test coverage ≥80% for new mod files
- ✅ JSON schema validation passes
- ✅ No linting errors
- ✅ Color scheme meets WCAG AAA standards

### 11.3 Documentation Requirements

- ✅ Specification complete and accurate
- ✅ Color scheme documented and registered
- ✅ Migration checklist completed
- ✅ Changelog updated

---

## 12. Related Mods

### 12.1 Source Mods (Migration From)

- **sex-penile-manual** - Hand-based penis stimulation actions
- **sex-penile-oral** - Oral sex actions

### 12.2 Dependency Mods (Required)

- **anatomy** - Anatomy system and validation
- **clothing** - Clothing system and validation
- **core** - Core system operations
- **positioning** - Positioning components and scopes
- **sex-core** - Shared sexual scaffolding

### 12.3 Related Mods (Thematic)

- **physical-control** - Non-sexual physical control (forcing to knees, bending over)
- **sex-anal-penetration** - Anal sex actions
- **sex-breastplay** - Breast-focused sexual actions
- **sex-dry-intimacy** - Grinding/frottage actions
- **sex-vaginal-penetration** - Vaginal sex actions

---

## 13. Appendix

### A. Example Action File (Updated)

**File**: `data/mods/sex-physical-control/actions/guide_hand_to_clothed_crotch.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "sex-physical-control:guide_hand_to_clothed_crotch",
  "name": "Guide Hand to Clothed Crotch",
  "description": "Take your partner's hand and nestle it against the clothed swell of your crotch.",
  "targets": {
    "primary": {
      "scope": "positioning:close_actors_facing_each_other_or_behind_target",
      "placeholder": "primary",
      "description": "Partner whose hand you guide"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["positioning:receiving_blowjob"]
  },
  "template": "guide {primary}'s hand to the bulge of your crotch",
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "penis"]
      },
      "failure_message": "You need a penis to guide someone to your clothed bulge."
    },
    {
      "logic": {
        "isSocketCovered": ["actor", "penis"]
      },
      "failure_message": "Your penis must remain covered to invite their hand."
    }
  ],
  "visual": {
    "backgroundColor": "#2c0e37",
    "textColor": "#ffebf0",
    "hoverBackgroundColor": "#3d1449",
    "hoverTextColor": "#ffffff"
  }
}
```

### B. Example Condition File (Updated)

**File**: `data/mods/sex-physical-control/conditions/event-is-action-guide-hand-to-clothed-crotch.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "sex-physical-control:event-is-action-guide-hand-to-clothed-crotch",
  "description": "Checks if the action is guide_hand_to_clothed_crotch",
  "logic": {
    "==": [
      { "var": "event.payload.action_id" },
      "sex-physical-control:guide_hand_to_clothed_crotch"
    ]
  }
}
```

### C. Example Rule File (Updated)

**File**: `data/mods/sex-physical-control/rules/handle_guide_hand_to_clothed_crotch.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "sex-physical-control:handle_guide_hand_to_clothed_crotch",
  "description": "Handles the guide_hand_to_clothed_crotch action",
  "event": "ACTION_DECIDED",
  "condition_ref": "sex-physical-control:event-is-action-guide-hand-to-clothed-crotch",
  "operations": {
    "$ref": "core:logSuccessAndEndTurn"
  }
}
```

---

## 14. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-11 | LNE Team | Initial specification |

---

**End of Specification**
