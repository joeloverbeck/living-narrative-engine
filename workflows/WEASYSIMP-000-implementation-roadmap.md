# WEASYSIMP: Weapons System Implementation - Roadmap

**Source Spec:** `specs/weapons-system-implementation.spec.md`
**Total Tickets:** 26
**Estimated Timeline:** 15-20 days across 5 phases

## Executive Summary

This roadmap breaks down the weapons system implementation into actionable, detailed workflow tickets. Each ticket is namespaced with 'WEASYSIMP' (Weapons System Implementation) and organized by implementation phase.

### System Architecture

The weapons system is split into two parts:
1. **Items Mod Extensions** (WEASYSIMP-003 to 007): General aiming for any aimable item
2. **Weapons Mod** (WEASYSIMP-008 to 019): Weapon-specific functionality

### Expected Outcomes

- **Phase 1-2:** Foundation and items mod aiming system (4-5 days)
- **Phase 3:** Weapons mod components and core actions (5-6 days)
- **Phase 4:** Entity definitions and examples (2-3 days)
- **Phase 5:** Testing and validation (3-5 days)

---

## Phase 1: Foundation (1-2 days)

**Goal:** Setup mod structure and dependencies

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-001](WEASYSIMP-001-setup-weapons-mod-directory.md) | Setup Weapons Mod Directory | P0 | 0.5 days | None |
| [WEASYSIMP-002](WEASYSIMP-002-create-weapons-mod-manifest.md) | Create Weapons Mod Manifest | P0 | 0.5 days | WEASYSIMP-001 |

---

## Phase 2: Items Mod Extensions (2-3 days)

**Goal:** Implement general aiming functionality

### Aiming Components & Actions (Day 1)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-003](WEASYSIMP-003-items-aiming-components.md) | Create Items Mod Aiming Components | P0 | 1 day | None |
| [WEASYSIMP-004](WEASYSIMP-004-items-aiming-actions.md) | Create Items Mod Aiming Actions | P0 | 1 day | WEASYSIMP-003 |

### Aiming Scopes & Events (Day 2)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-005](WEASYSIMP-005-items-aiming-scopes.md) | Create Items Mod Aiming Scopes | P0 | 1 day | WEASYSIMP-003 |
| [WEASYSIMP-006](WEASYSIMP-006-items-aiming-events-conditions.md) | Create Items Mod Aiming Events & Conditions | P0 | 1 day | WEASYSIMP-004 |

### Aiming Rules (Day 3)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-007](WEASYSIMP-007-items-aiming-rules.md) | Create Items Mod Aiming Rules | P0 | 1 day | WEASYSIMP-003, 006 |

---

## Phase 3: Weapons Mod Core (5-6 days)

**Goal:** Implement weapon-specific functionality

### Components (Day 4-5)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-008](WEASYSIMP-008-weapons-marker-components.md) | Create Weapons Mod Marker Components | P0 | 0.5 days | WEASYSIMP-002 |
| [WEASYSIMP-009](WEASYSIMP-009-weapons-data-components.md) | Create Weapons Mod Data Components | P0 | 1 day | WEASYSIMP-008 |
| [WEASYSIMP-010](WEASYSIMP-010-weapons-state-component.md) | Create Weapons Mod State Component | P0 | 0.5 days | WEASYSIMP-008 |

### Actions & Rules (Day 5-7)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-011](WEASYSIMP-011-shoot-weapon-action-rule.md) | Create Shoot Weapon Action and Rule | P0 | 1 day | WEASYSIMP-007, 009 |
| [WEASYSIMP-012](WEASYSIMP-012-reload-weapon-action-rule.md) | Create Reload Weapon Action and Rule | P0 | 1 day | WEASYSIMP-009 |
| [WEASYSIMP-013](WEASYSIMP-013-chamber-round-action-rule.md) | Create Chamber Round Action and Rule | P1 | 0.5 days | WEASYSIMP-009 |
| [WEASYSIMP-014](WEASYSIMP-014-clear-jam-action-rule.md) | Create Clear Jam Action and Rule | P1 | 0.5 days | WEASYSIMP-010 |
| [WEASYSIMP-015](WEASYSIMP-015-magazine-management.md) | Create Magazine Management Actions and Rules | P1 | 1 day | WEASYSIMP-009 |

### Scopes & Events (Day 8-9)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-016](WEASYSIMP-016-weapons-scopes.md) | Create Weapons Mod Scopes | P0 | 1 day | WEASYSIMP-009, 010 |
| [WEASYSIMP-017](WEASYSIMP-017-weapons-events.md) | Create Weapons Mod Events | P0 | 1 day | WEASYSIMP-011-015 |

---

## Phase 4: Entity Definitions (2-3 days)

**Goal:** Create example weapons and ammunition

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-018](WEASYSIMP-018-weapon-entities.md) | Create Weapon Entity Definitions | P1 | 1.5 days | WEASYSIMP-009 |
| [WEASYSIMP-019](WEASYSIMP-019-ammunition-entities.md) | Create Ammunition Entity Definitions | P1 | 0.5 days | WEASYSIMP-009 |

---

## Phase 5: Testing & Validation (3-5 days)

**Goal:** Comprehensive testing and documentation

### Unit & Integration Tests (Day 10-12)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-020](WEASYSIMP-020-items-aiming-tests.md) | Create Items Mod Aiming Tests | P0 | 1 day | WEASYSIMP-007 |
| [WEASYSIMP-021](WEASYSIMP-021-weapons-component-tests.md) | Create Weapons Mod Component Tests | P1 | 1 day | WEASYSIMP-009, 010 |
| [WEASYSIMP-022](WEASYSIMP-022-shooting-workflow-tests.md) | Create Shooting Workflow Tests | P0 | 1 day | WEASYSIMP-011 |
| [WEASYSIMP-023](WEASYSIMP-023-reloading-workflow-tests.md) | Create Reloading Workflow Tests | P0 | 1 day | WEASYSIMP-012 |

### E2E & Validation (Day 13-15)

| Ticket | Title | Priority | Effort | Dependencies |
|--------|-------|----------|--------|--------------|
| [WEASYSIMP-024](WEASYSIMP-024-integration-tests.md) | Create Complete Integration Tests | P0 | 1 day | WEASYSIMP-011-015 |
| [WEASYSIMP-025](WEASYSIMP-025-e2e-sentinel-test.md) | Create E2E Sentinel Scenario Test | P1 | 1 day | WEASYSIMP-018, 019 |
| [WEASYSIMP-026](WEASYSIMP-026-validation-documentation.md) | System Validation and Documentation | P0 | 1 day | All previous |

---

## Critical Path

The following tickets form the critical path for MVP functionality:

1. WEASYSIMP-001, 002 (Foundation)
2. WEASYSIMP-003, 004, 005, 007 (Items Mod Aiming)
3. WEASYSIMP-008, 009 (Weapons Components)
4. WEASYSIMP-011, 016, 017 (Shooting System)
5. WEASYSIMP-020, 022, 026 (Core Testing)

**Minimum Viable Product (MVP) Timeline:** 8-10 days

---

## Implementation Strategies

### Parallel Work Streams

**Stream 1: Items Mod Extensions**
- Can be completed independently
- Tickets: WEASYSIMP-003 through WEASYSIMP-007

**Stream 2: Weapons Mod Foundation**
- Depends on Stream 1 completion
- Tickets: WEASYSIMP-008 through WEASYSIMP-010

**Stream 3: Weapons Mod Actions**
- Can be parallelized after Stream 2
- Tickets: WEASYSIMP-011 through WEASYSIMP-015

**Stream 4: Testing**
- Can begin in parallel with Stream 3 (TDD approach)
- Tickets: WEASYSIMP-020 through WEASYSIMP-025

### Validation Checkpoints

**Checkpoint 1 (After Phase 2):**
- Items mod aiming system fully functional
- Actions discoverable in game
- Scopes resolve correctly
- Tests pass: `npm run test:integration -- tests/integration/mods/items/`

**Checkpoint 2 (After Phase 3 Components):**
- All weapon components validate
- Schema validation passes: `npm run validate:mod:weapons`

**Checkpoint 3 (After Phase 3 Actions):**
- All weapon actions discoverable
- Rules execute correctly
- Events dispatch successfully

**Checkpoint 4 (After Phase 5):**
- All tests pass: `npm run test:ci`
- ESLint passes: `npm run lint`
- Full system validated

---

## Content Statistics

### Items Mod Extensions
- **Components:** 2 (aimable, aimed_at)
- **Actions:** 2 (aim_item, lower_aim)
- **Scopes:** 3
- **Events:** 2
- **Conditions:** 2
- **Rules:** 2
- **Total Files:** 13

### Weapons Mod
- **Components:** 6 (weapon, firearm, ammunition, magazine, jammed, ammo_container)
- **Actions:** 7 (shoot, reload, chamber, clear_jam, eject_magazine, insert_magazine, +1)
- **Scopes:** 9
- **Events:** 8
- **Conditions:** 7
- **Rules:** 7
- **Entities:** 6 (3 weapons + 3 ammo types)
- **Total Files:** 43

### Testing
- **Unit Test Files:** ~10
- **Integration Test Files:** ~8
- **E2E Test Files:** 1
- **Total Test Files:** ~19

**Grand Total:** ~75 files to create

---

## Risk Assessment

### High Risk Items

1. **Scope DSL Complexity (WEASYSIMP-016)**
   - Context-aware scopes (weapon compatibility checks)
   - Mitigation: Test scopes thoroughly, use ModTestFixture

2. **Rule Operation Sequences (WEASYSIMP-011, 012)**
   - Complex multi-step operations with math and conditionals
   - Mitigation: Break into smaller operations, test each step

3. **Event Dispatching Timing (WEASYSIMP-017)**
   - Correct event order and payload structure
   - Mitigation: Integration tests verify event sequences

### Medium Risk Items

1. **Component Schema Validation**
   - Ensuring all component schemas are valid
   - Mitigation: Run `npm run validate` after each component

2. **Action Discovery**
   - Actions appearing when expected
   - Mitigation: Use Action Discovery Bed for debugging

### Low Risk Items

1. **Directory Structure (WEASYSIMP-001)**
2. **Manifest Creation (WEASYSIMP-002)**
3. **Documentation (WEASYSIMP-026)**

---

## Success Criteria

### Functional Requirements
- [ ] Actor can aim weapon at target
- [ ] Actor can shoot aimed weapon
- [ ] Ammo decrements correctly
- [ ] Actor can reload weapon from magazine/ammo container
- [ ] Magazine management works (eject/insert)
- [ ] Manual chambering works for bolt-action weapons
- [ ] Jam system works (jam occurs, can be cleared)
- [ ] All events dispatch correctly
- [ ] All actions discoverable when conditions met

### Technical Requirements
- [ ] All schemas validate: `npm run validate`
- [ ] All tests pass: `npm run test:ci`
- [ ] Code lints cleanly: `npm run lint`
- [ ] Test coverage > 80% for new code
- [ ] Scope DSL files lint: `npm run scope:lint`
- [ ] Color schemes meet WCAG AA standards

### Documentation Requirements
- [ ] All tickets have acceptance criteria
- [ ] All tickets have test requirements
- [ ] README updated with weapons mod info
- [ ] Example scenarios documented
- [ ] Color scheme documented

---

## Future Extensions (Post-MVP)

**Phase 2 Enhancements:**
- Burst fire mode
- Suppressive fire
- Weapon attachments (scopes, suppressors)
- Weapon maintenance/cleaning

**Phase 3 Enhancements:**
- Damage system integration
- Cover system
- Weapon skills/proficiency
- Inventory weight/capacity enforcement
- Weapon customization

See spec section "Part 6: Future Extensions" for full details.

---

## Quick Reference

### Color Schemes

**Items Mod (Aiming):**
- Background: #004d61 (Teal)
- Text: #e0f7fa
- Contrast: 12.74:1 (AAA)

**Weapons Mod:**
- Background: #112a46 (Arctic Steel)
- Text: #e6f1ff
- Contrast: 12.74:1 (AAA)

### Key Commands

```bash
# Validation
npm run validate
npm run validate:mod:weapons
npm run scope:lint

# Testing
npm run test:unit -- tests/unit/mods/weapons/
npm run test:integration -- tests/integration/mods/weapons/
npm run test:e2e -- tests/e2e/weapons/

# Linting
npm run lint
npm run format

# Build
npm run build
```

---

## Notes

- All tickets are self-contained with complete implementation details
- No reference to original spec needed to implement tickets
- Follow Living Narrative Engine conventions (CLAUDE.md)
- Use ModTestFixture for all mod tests
- Test coverage must exceed 80%
- Always run validation after each ticket completion
