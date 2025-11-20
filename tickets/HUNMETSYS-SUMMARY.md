# HUNMETSYS: Ticket Breakdown Summary

## Overview

Complete ticket breakdown for implementing the Hunger and Metabolism System as specified in `specs/hunger-metabolism-system.md`.

Total Tickets: 21 (including overview)
Estimated Timeline: 6 weeks
Dependencies: anatomy mod (v1.0.0+)

## Ticket List with Status

### Phase 1: Foundation (Weeks 1-2)

| Ticket | Title | Files | Priority | Status |
|--------|-------|-------|----------|--------|
| HUNMETSYS-000 | Overview & Planning | 1 | High | ✅ Created |
| HUNMETSYS-001 | Component Schemas - Fuel Converter & Source | 2 new | High | ✅ Created |
| HUNMETSYS-002 | Component Schemas - Metabolic Store & Hunger State | 2 new | High | ✅ Created |
| HUNMETSYS-003 | Operation Handler - BURN_ENERGY | 4 new, 4 mod | High | ✅ Created |
| HUNMETSYS-004 | Operation Handler - DIGEST_FOOD | 3 new, 4 mod | High | ✅ Created |
| HUNMETSYS-005 | Operation Handler - CONSUME_ITEM | 3 new, 4 mod | High | ✅ Created |

**Phase 1 Deliverables:**
- 4 component schemas
- 3 operation handlers with full test coverage
- Complete DI integration

### Phase 2: Mod Structure (Weeks 2-3)

| Ticket | Title | Files | Priority | Status |
|--------|-------|-------|----------|--------|
| HUNMETSYS-006 | Mod Structure Setup | 2 new, 1 mod, 7 dirs | High | ✅ Created |
| HUNMETSYS-007 | Turn-Based Processing Rules | 3 new, 1 mod | High | ✅ Created |
| HUNMETSYS-008 | Action Definitions - Eat, Drink, Rest | 3 new, 1 mod | High | 🔲 To Create |
| HUNMETSYS-009 | Action Rule Handlers | 3 new, 1 mod | High | 🔲 To Create |
| HUNMETSYS-010 | Sample Food Entities | 3 new, 1 mod | Medium | 🔲 To Create |

**Phase 2 Deliverables:**
- Complete mod structure with manifest
- Turn-based energy burn and digestion
- 3 actions (eat, drink, rest) with handlers
- 3 sample food entities

### Phase 3: GOAP Integration (Weeks 3-4)

| Ticket | Title | Files | Priority | Status |
|--------|-------|-------|----------|--------|
| HUNMETSYS-011 | JSON Logic Operators - Hunger Detection | 2 new, 1 mod | High | 🔲 To Create |
| HUNMETSYS-012 | JSON Logic Operators - Energy Prediction | 2 new, 1 mod | High | 🔲 To Create |
| HUNMETSYS-013 | GOAP Goals & Conditions | 5 new, 1 mod | High | 🔲 To Create |

**Phase 3 Deliverables:**
- 3 custom JSON Logic operators (is_hungry, predicted_energy, can_consume)
- GOAP hunger satisfaction goal
- 4 conditions for action prerequisites
- 3 scope definitions for finding food

### Phase 4: Visual Integration (Weeks 4-5)

| Ticket | Title | Files | Priority | Status |
|--------|-------|-------|----------|--------|
| HUNMETSYS-014 | Operation Handler - UPDATE_HUNGER_STATE | 3 new, 4 mod | High | 🔲 To Create |
| HUNMETSYS-015 | Operation Handler - UPDATE_BODY_COMPOSITION | 3 new, 4 mod | Medium | 🔲 To Create |

**Phase 4 Deliverables:**
- UPDATE_HUNGER_STATE operation with threshold calculation
- UPDATE_BODY_COMPOSITION operation with anatomy integration
- Event dispatching for state changes
- Gradual body composition updates

### Phase 5: Action Energy Costs (Weeks 5-6)

| Ticket | Title | Files | Priority | Status |
|--------|-------|-------|----------|--------|
| HUNMETSYS-016 | Energy Costs for Movement & Exercise | 6+ mod | Medium | 🔲 To Create |
| HUNMETSYS-017 | Integration Tests & Performance Validation | 5+ new | High | 🔲 To Create |

**Phase 5 Deliverables:**
- Energy costs integrated into movement actions (1.2x)
- Energy costs integrated into exercise actions (3.0x)
- Energy costs integrated into combat actions (2.5x)
- Complete integration test suite
- Performance validation (<100ms per turn for 100 entities)

### Phase 6: Polish & Documentation (Week 6)

| Ticket | Title | Files | Priority | Status |
|--------|-------|-------|----------|--------|
| HUNMETSYS-018 | Edge Cases & Error Handling | 0-5 mod | Medium | 🔲 To Create |
| HUNMETSYS-019 | Complete Test Coverage | 10+ new | High | 🔲 To Create |
| HUNMETSYS-020 | Documentation & Examples | 3+ new | Medium | 🔲 To Create |

**Phase 6 Deliverables:**
- All edge cases handled (negative energy, overeating, invalid fuel, etc.)
- Test coverage >80% branches, 90% functions/lines
- Complete modding documentation
- Example implementations (vampire, robot, etc.)

## Dependency Graph

```
HUNMETSYS-000 (Overview)
    ↓
HUNMETSYS-001, 002 (Component Schemas)
    ↓
HUNMETSYS-003, 004, 005 (Operation Handlers)
    ↓
HUNMETSYS-006 (Mod Structure)
    ↓
HUNMETSYS-007 (Turn Rules) ← depends on 003, 004
    ↓
HUNMETSYS-008, 009, 010 (Actions & Entities) ← depends on 005
    ↓
HUNMETSYS-011, 012, 013 (GOAP Integration)
    ↓
HUNMETSYS-014, 015 (Visual Integration)
    ↓
HUNMETSYS-016 (Energy Costs)
    ↓
HUNMETSYS-017 (Integration Tests)
    ↓
HUNMETSYS-018, 019, 020 (Polish & Docs)
```

## File Impact Summary

### New Files Created (~50-60 files)
- Component schemas: 4
- Operation schemas: 5
- Operation handlers: 5
- Action definitions: 3
- Rule definitions: 6
- Condition definitions: 4
- Scope definitions: 3
- Entity definitions: 3+
- JSON Logic operators: 3
- GOAP goals: 1
- Config files: 1-2
- Unit tests: 20+
- Integration tests: 5+
- Documentation: 3+

### Modified Files (~10-15 files)
- data/schemas/operation.schema.json (5x - add operation refs)
- data/mods/metabolism/mod-manifest.json (multiple updates)
- data/game.json (add metabolism mod)
- src/dependencyInjection/tokens/tokens-core.js (5x - tokens)
- src/dependencyInjection/registrations/operationHandlerRegistrations.js (5x - factories)
- src/dependencyInjection/registrations/interpreterRegistrations.js (5x - mappings)
- src/utils/preValidationUtils.js (5x - whitelist)
- src/logic/jsonLogicCustomOperators.js (3x - operator registration)
- Movement/exercise mod rules (3-6 files - add energy costs)

## Success Metrics

### Code Quality
- ✅ All schemas validate
- ✅ Test coverage >80% branches, 90% functions/lines
- ✅ All handlers follow DI patterns
- ✅ Type checking passes
- ✅ Linting passes

### Functionality
- ✅ Turn-based processing works reliably
- ✅ AI makes intelligent eating decisions
- ✅ Body composition updates realistically
- ✅ Performance <100ms per turn for 100 entities
- ✅ All edge cases handled gracefully

### Integration
- ✅ Compatible with anatomy mod
- ✅ Compatible with movement mod
- ✅ Compatible with exercise mod
- ✅ GOAP planners work correctly
- ✅ No breaking changes to existing mods

## Risk Areas

### High Risk
- Turn processing performance with many entities
- GOAP planner integration and preventing overeating
- Atomicity of multi-component operations

### Medium Risk
- Body composition update timing and thresholds
- Fuel tag compatibility validation
- Event dispatching overhead

### Low Risk
- Schema validation
- Component data structure
- Error message clarity

## Testing Strategy

### Unit Tests (Per Handler)
- Expected use cases
- Edge cases (boundary conditions)
- Error scenarios
- Event dispatching

### Integration Tests
- Complete hunger cycle (eat → digest → burn → state update)
- Multi-entity turn processing
- GOAP planning with hunger
- Action execution with energy costs

### E2E Tests
- Full gameplay scenarios
- Different entity types (human, vampire, robot)
- Extended starvation scenarios
- Performance under load

### Performance Tests
- 100 entities per turn (<100ms target)
- Linear scaling verification
- Memory usage monitoring
- Event dispatch overhead

## Documentation Requirements

### For Modders
- How to create custom food items
- How to create custom fuel converters (new entity types)
- How to add energy costs to actions
- Fuel tag system explanation
- Threshold configuration

### For Developers
- Architecture overview
- Operation handler patterns
- Event flow diagrams
- Performance optimization notes
- Future extension points

## Next Steps

1. Review HUNMETSYS-000 through HUNMETSYS-007 (created tickets)
2. Create remaining tickets HUNMETSYS-008 through HUNMETSYS-020
3. Begin implementation with HUNMETSYS-001
4. Follow dependency graph for sequential implementation
5. Validate each phase before proceeding to next

## Notes

- All tickets include explicit "Files to Touch" and "Out of Scope" sections
- Each ticket is reviewable independently (3-10 files max)
- Test requirements specified per ticket
- Invariants documented for validation
- Clear acceptance criteria for each deliverable
