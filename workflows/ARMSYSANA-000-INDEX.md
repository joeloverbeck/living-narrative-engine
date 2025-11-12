# ARMSYSANA: Armor System Anatomy Integration - Workflow Index

**Source Report**: `reports/armor-system-anatomy-integration-analysis.md`
**Date Created**: 2025-11-12
**Total Tickets**: 10

## Overview

This index provides a complete breakdown of the armor system integration project. The Living Narrative Engine's anatomy system is already prepared for armor as a distinct clothing layer. This migration adds armor support with minimal changes to the existing system.

### Key Finding

Armor can be implemented as a **fifth clothing layer** without modifying the core anatomy architecture. The existing layer system can be extended to include `armor` with minimal changes.

## Migration Phases

### Phase 1: Core System Update (Minimal Risk)
- **Duration**: ~40 minutes
- **Risk**: Minimal
- **Description**: Update component schemas to include armor layer

### Phase 2: Priority System Update (Medium Risk)
- **Duration**: ~95 minutes
- **Risk**: Medium
- **Description**: Update priority constants and coverage resolution logic

### Phase 3: Documentation and Examples (No Risk)
- **Duration**: ~105 minutes
- **Risk**: None
- **Description**: Update documentation and create example armor entities

### Phase 4: Testing with Real Scenarios (Validation)
- **Duration**: ~150 minutes
- **Risk**: Low (validation only)
- **Description**: Test armor in realistic gameplay scenarios and validate performance

**Total Estimated Time**: ~390 minutes (~6.5 hours)

## Workflow Tickets

### Phase 1: Core System Update

#### ARMSYSANA-001: Update Wearable Component Schema
- **File**: `workflows/ARMSYSANA-001-update-wearable-schema.md`
- **Priority**: Critical
- **Estimated Effort**: 15 minutes
- **Description**: Add "armor" to the `clothing:wearable` component schema layer enum
- **Files Changed**: `data/mods/clothing/components/wearable.component.json`
- **Breaking Changes**: None (additive)

#### ARMSYSANA-002: Update Coverage Mapping Schema
- **File**: `workflows/ARMSYSANA-002-update-coverage-mapping-schema.md`
- **Priority**: High (Optional but Recommended)
- **Estimated Effort**: 15 minutes
- **Description**: Add "armor" to the `clothing:coverage_mapping` component coveragePriority enum
- **Files Changed**: `data/mods/clothing/components/coverage_mapping.component.json`
- **Breaking Changes**: None (additive)

#### ARMSYSANA-003: Run Validation Suite
- **File**: `workflows/ARMSYSANA-003-run-validation-suite.md`
- **Priority**: Critical
- **Estimated Effort**: 10 minutes
- **Description**: Validate Phase 1 changes don't introduce regressions
- **Commands**: `npm run validate`, unit tests, integration tests
- **Checkpoint**: Must pass before proceeding to Phase 2

### Phase 2: Priority System Update

#### ARMSYSANA-004: Update Slot Access Resolver Priority System
- **File**: `workflows/ARMSYSANA-004-update-slot-access-resolver.md`
- **Priority**: Critical
- **Estimated Effort**: 30 minutes
- **Description**: Add armor priority constants to `SlotAccessResolver`
- **Files Changed**: `src/scopeDsl/nodes/slotAccessResolver.js`
- **Priority Values**: armor = 150 (between outer: 100 and base: 200)
- **Breaking Changes**: None (behavior addition)

#### ARMSYSANA-005: Update Related Coverage Logic
- **File**: `workflows/ARMSYSANA-005-update-coverage-logic.md`
- **Priority**: High
- **Estimated Effort**: 45 minutes
- **Description**: Discover and update all coverage-related components for armor support
- **Exploratory**: Yes (exact components determined during implementation)
- **Potential Files**: Coverage analyzer, action text generation, clothing state manager

#### ARMSYSANA-006: Run Comprehensive Tests
- **File**: `workflows/ARMSYSANA-006-run-comprehensive-tests.md`
- **Priority**: Critical
- **Estimated Effort**: 20 minutes
- **Description**: Validate Phase 2 changes with comprehensive test suite
- **Commands**: Integration tests, unit tests, `npm run test:ci`
- **Checkpoint**: Must pass before proceeding to Phase 3

### Phase 3: Documentation and Examples

#### ARMSYSANA-007: Update Documentation
- **File**: `workflows/ARMSYSANA-007-update-documentation.md`
- **Priority**: High
- **Estimated Effort**: 60 minutes
- **Description**: Update all documentation to include armor layer information
- **Files Changed**:
  - `docs/modding/clothing-items.md`
  - `docs/developers/clothing-coverage-system.md`
  - `docs/anatomy/anatomy-system-guide.md`
  - `docs/anatomy/clothing-coverage-mapping.md`
  - `CLAUDE.md`

#### ARMSYSANA-008: Create Example Armor Entities
- **File**: `workflows/ARMSYSANA-008-create-armor-examples.md`
- **Priority**: Medium
- **Estimated Effort**: 45 minutes
- **Description**: Create collection of example armor entities
- **Entities Created**:
  - Steel cuirass (heavy armor)
  - Leather bracers (light armor)
  - Chainmail hauberk (medium armor)
  - Iron helmet (head armor)
  - Leather boots (foot armor)
  - Steel gauntlets (hand armor)
- **New Mod**: `data/mods/armor/` OR add to `data/mods/clothing/`

### Phase 4: Testing with Real Scenarios

#### ARMSYSANA-009: Test Armor with Real Scenarios
- **File**: `workflows/ARMSYSANA-009-test-armor-scenarios.md`
- **Priority**: High
- **Estimated Effort**: 90 minutes
- **Description**: Test armor in realistic gameplay scenarios
- **Test Characters**:
  - Fully armored knight
  - Rogue with light armor
  - Mage with armor under robes
  - Warrior without outer garments
  - Ranger with mixed layers
- **Tests**: Action text generation, coverage resolution edge cases, manual testing

#### ARMSYSANA-010: Performance Testing
- **File**: `workflows/ARMSYSANA-010-performance-testing.md`
- **Priority**: Medium
- **Estimated Effort**: 60 minutes
- **Description**: Validate armor system performance
- **Performance Targets**:
  - Coverage resolution: < 5ms per character
  - Performance degradation: < 5% vs 4-layer system
  - Action text generation: < 15ms with armor
  - No memory leaks
- **Tests**: Coverage resolution, priority calculation, action text, multi-character, memory usage

## Dependency Graph

```
ARMSYSANA-001 (Update Wearable Schema)
    ↓
ARMSYSANA-002 (Update Coverage Mapping)
    ↓
ARMSYSANA-003 (Validation Suite) [CHECKPOINT]
    ↓
ARMSYSANA-004 (Update Slot Access Resolver)
    ↓
ARMSYSANA-005 (Update Coverage Logic)
    ↓
ARMSYSANA-006 (Comprehensive Tests) [CHECKPOINT]
    ↓
    ├─→ ARMSYSANA-007 (Update Documentation)
    └─→ ARMSYSANA-008 (Create Armor Examples)
            ↓
        ARMSYSANA-009 (Test Scenarios)
            ↓
        ARMSYSANA-010 (Performance Testing)
```

## Execution Order

Execute tickets in strict numerical order (001 → 010). **Do not skip checkpoints.**

### Critical Checkpoints

1. **After ARMSYSANA-003**: All validation must pass before Phase 2
2. **After ARMSYSANA-006**: All tests must pass before Phase 3

If a checkpoint fails, stop and resolve issues before continuing.

## Quick Reference

### Layer Hierarchy (After Implementation)

```
Innermost to Outermost:
1. underwear (priority 300)
2. base (priority 200)
3. armor (priority 150) ← NEW
4. outer (priority 100)
5. accessories (priority 350)
```

### Files Modified

**Schemas**:
- `data/mods/clothing/components/wearable.component.json`
- `data/mods/clothing/components/coverage_mapping.component.json`

**Code**:
- `src/scopeDsl/nodes/slotAccessResolver.js`
- Potentially: Coverage analyzer, action text generation, validators

**Documentation**:
- `docs/modding/clothing-items.md`
- `docs/developers/clothing-coverage-system.md`
- `docs/anatomy/anatomy-system-guide.md`
- `docs/anatomy/clothing-coverage-mapping.md`
- `CLAUDE.md`

**Content**:
- New armor entities in `data/mods/armor/` or `data/mods/clothing/`

### Test Commands

```bash
# Phase 1 validation
npm run validate
npm run test:unit -- tests/unit/clothing/
npm run test:integration -- tests/integration/clothing/

# Phase 2 validation
npm run test:integration -- tests/integration/scopeDsl/
npm run test:ci

# Phase 3 validation
npm run validate
markdownlint docs/**/*.md

# Phase 4 validation
npm run test:performance -- tests/performance/clothing/armor-*.performance.test.js
```

## Success Criteria

The armor system implementation is complete when:

- [ ] All 10 workflow tickets completed
- [ ] All schemas include armor layer
- [ ] Priority constants updated (armor = 150)
- [ ] All tests pass (unit, integration, e2e)
- [ ] Documentation updated
- [ ] Example armor entities created
- [ ] Real scenario testing complete
- [ ] Performance targets met (< 5% degradation)
- [ ] No memory leaks detected
- [ ] No regressions in existing functionality

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|-----------|------------|
| Phase 1 | Minimal | Additive changes only, full validation |
| Phase 2 | Medium | Checkpoints, comprehensive testing |
| Phase 3 | None | Documentation only |
| Phase 4 | Low | Validation only, no code changes |

**Overall Risk**: Low to Medium

**Recommended Approach**: Follow phases strictly, don't skip checkpoints, validate thoroughly at each step.

## Notes

### Design Decisions

1. **Armor as Fifth Layer**: Provides maximum flexibility for sword & sorcery scenarios
2. **Priority Value (150)**: Between outer (100) and base (200) for realistic layering
3. **Additive Changes**: All changes are non-breaking, backward compatible
4. **Separate Mod**: Recommended to create `data/mods/armor/` for clear separation

### Future Enhancements

After armor system is complete, consider:
- Armor-specific components (protection rating, armor class)
- Damage/durability system for armor
- Special armor properties (magical, enchanted)
- Armor weight affecting movement/fatigue
- Custom armor materials beyond existing ones

### References

- **Original Report**: `reports/armor-system-anatomy-integration-analysis.md`
- **Anatomy System Guide**: `docs/anatomy/anatomy-system-guide.md`
- **Clothing Coverage Mapping**: `docs/anatomy/clothing-coverage-mapping.md`
- **Modding Guide**: `docs/modding/clothing-items.md`
- **CLAUDE.md**: Project instructions and conventions

---

**Migration Status**: Not Started
**Last Updated**: 2025-11-12
**Next Ticket**: ARMSYSANA-001
