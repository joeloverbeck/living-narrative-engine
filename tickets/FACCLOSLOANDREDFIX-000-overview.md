# FACCLOSLOANDREDFIX: Face Coverage Clothing Slots and Redundancy Fix

## Overview

This ticket series addresses two interrelated issues:
1. **Missing face coverage slots** - No granular way to equip items covering nose, mouth, or teeth
2. **Redundant clothing mappings** - All 6 core part files repeat identical clothing slot definitions

## Ticket Summary

| Ticket | Phase | Description | Files Modified |
|--------|-------|-------------|----------------|
| 001 | 1 | Add face sockets to humanoid head entities | 11 entity files |
| 002 | 1 | Add face sockets to creature head entities | 3 entity files |
| 003 | 1 | Add clothing definitions to slot library | 1 library file |
| 004 | 1 | Update coverage_mapping component enum | 1 component file |
| 005 | 1 | Add face mappings to part files | 6 part files |
| 006 | 2 | Add defaultClothingSlotMappings to schema | 1 schema file |
| 007 | 2 | Modify loader for auto-merge defaults | 1 loader + tests |
| 008 | 2 | Add defaultClothingSlotMappings to slot library | 1 library file |
| 009 | 3 | Remove redundant mappings from part files | 6 part files |

## Dependency Graph

```
Phase 1: Add Face Coverage Slots (Minimal Risk)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌───────┐     ┌───────┐     ┌───────┐                     │
│  │  001  │     │  002  │     │  004  │  ← Can run parallel │
│  │humanoid│    │creature│    │ enum  │                     │
│  │ heads │     │ heads │     │       │                     │
│  └───┬───┘     └───┬───┘     └───────┘                     │
│      │             │                                        │
│      └──────┬──────┘                                        │
│             ↓                                               │
│         ┌───────┐                                           │
│         │  003  │  ← Needs sockets to exist                 │
│         │library│                                           │
│         │ defs  │                                           │
│         └───┬───┘                                           │
│             ↓                                               │
│         ┌───────┐                                           │
│         │  005  │  ← Completes Phase 1                      │
│         │ part  │                                           │
│         │mappings│                                           │
│         └───────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Phase 2: Schema and Loader Changes (Medium Risk)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│         ┌───────┐                                           │
│         │  006  │  ← Schema first                           │
│         │schema │                                           │
│         └───┬───┘                                           │
│             ↓                                               │
│         ┌───────┐                                           │
│         │  007  │  ← Loader depends on schema               │
│         │loader │                                           │
│         └───┬───┘                                           │
│             ↓                                               │
│         ┌───────┐                                           │
│         │  008  │  ← Library uses new property              │
│         │library│                                           │
│         │defaults│                                          │
│         └───────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Phase 3: Simplify Part Files (Low Risk)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│         ┌───────┐                                           │
│         │  009  │  ← Requires all Phase 2 complete          │
│         │remove │                                           │
│         │redund.│                                           │
│         └───────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Execution Order

### Parallel Group A (Phase 1 - Can run simultaneously)
- FACCLOSLOANDREDFIX-001 (humanoid head sockets)
- FACCLOSLOANDREDFIX-002 (creature head sockets)
- FACCLOSLOANDREDFIX-004 (coverage enum)

### Sequential (Phase 1 - Depends on Group A)
- FACCLOSLOANDREDFIX-003 (library definitions) - after 001, 002
- FACCLOSLOANDREDFIX-005 (part mappings) - after 003

### Sequential (Phase 2 - Schema/Loader changes)
- FACCLOSLOANDREDFIX-006 (schema) - can start after Phase 1 or in parallel
- FACCLOSLOANDREDFIX-007 (loader) - after 006
- FACCLOSLOANDREDFIX-008 (library defaults) - after 007

### Final (Phase 3 - Cleanup)
- FACCLOSLOANDREDFIX-009 (remove redundancy) - after 008

## Risk Assessment

| Phase | Risk | Reason | Mitigation |
|-------|------|--------|------------|
| 1 | Low | Purely additive changes | Test each file after modification |
| 2 | Medium | Loader changes affect all anatomy loading | Comprehensive testing, incremental rollout |
| 3 | Low | Only data changes after loader is verified | Backup files, incremental removal |

## Test Milestones

### After Phase 1
```bash
npm run validate
npm run test:unit -- --testPathPattern="anatomy"
npm run test:integration -- --testPathPattern="anatomy"
```
Expected: All pass, face slots available for equipping

### After Phase 2
```bash
npm run validate
npm run test:unit -- --testPathPattern="anatomy"
npm run test:integration -- --testPathPattern="anatomy"
# Plus new loader tests from 007
```
Expected: All pass, library defaults auto-inherited

### After Phase 3
```bash
npm run validate
npm run test:unit
npm run test:integration
npm run test:e2e
```
Expected: All pass, redundancy eliminated, behavior unchanged

## Rollback Strategy

### Phase 1 Rollback
- Revert entity, library, and part file changes
- System returns to pre-face-slot state

### Phase 2 Rollback
- Revert loader changes
- Remove schema property
- System returns to Phase 1 state (face slots work, no auto-inheritance)

### Phase 3 Rollback
- Restore redundant mappings to part files
- System works with either manual or auto-inherited mappings

## Success Criteria

1. ✅ Characters can equip face-covering items to nose, mouth, face_lower slots
2. ✅ Helmet + respirator can be worn simultaneously
3. ✅ All existing clothing functionality unchanged
4. ✅ Part files contain only creature-specific overrides (not standard mappings)
5. ✅ New clothing slots can be added by editing only the slot library
6. ✅ All tests pass
7. ✅ No runtime errors during blueprint loading
