# ANABLUNONHUM: Non-Human Anatomy Architecture Implementation Roadmap

**Source**: `reports/anatomy-blueprint-non-human-architecture.md`
**Total Tickets**: 25
**Estimated Total Effort**: 160-200 hours (~4-5 months at 1 developer)

## Overview

Implementation roadmap for modular anatomy architecture supporting non-human body structures. Enables declarative body structure definitions through parameterized templates instead of exhaustive socket/slot enumeration, reducing effort for non-humanoid creatures by 60-70%.

## Implementation Phases

### Phase 1: Schema Extensions (Tickets 001-005)
**Duration**: 2-3 weeks | **Effort**: 32-42 hours

Foundation schemas enabling template-based architecture:

- **ANABLUNONHUM-001**: Create Structure Template Schema
  - Define topology, limbSets, appendages
  - Socket pattern templates with variables
  - Orientation schemes (bilateral, radial, indexed, custom)

- **ANABLUNONHUM-002**: Extend Blueprint Schema for V2
  - Add schemaVersion, structureTemplate, additionalSlots
  - Conditional validation for v1/v2 separation
  - Full backward compatibility

- **ANABLUNONHUM-003**: Extend Recipe Schema for Patterns
  - matchesGroup, matchesPattern, matchesAll
  - Mutually exclusive matcher validation
  - Wildcard and property-based filtering

- **ANABLUNONHUM-004**: Schema Validation Test Suite
  - Comprehensive validation tests (90%+ coverage)
  - Valid/invalid examples for all schemas
  - Integration tests for cross-schema relationships

- **ANABLUNONHUM-005**: Schema Documentation
  - Complete documentation for all three schemas
  - Migration guides (v1 → v2)
  - Quick start guide for non-human creatures

**Deliverables**:
- 3 schema files (new/extended)
- 5 test files (unit + integration)
- 4 documentation files

---

### Phase 2: Structure Template Processor (Tickets 006-012)
**Duration**: 3-4 weeks | **Effort**: 52-68 hours

Core services for template processing:

- **ANABLUNONHUM-006**: StructureTemplateLoader Service
  - Load and cache templates
  - Schema validation integration
  - Error handling

- **ANABLUNONHUM-007**: SocketGenerator Service
  - Generate socket definitions from patterns
  - Template variable resolution ({{index}}, {{orientation}})
  - All orientation schemes implemented

- **ANABLUNONHUM-008**: SlotGenerator Service
  - Generate blueprint slots from templates
  - Slot/socket ID matching
  - Merge with additionalSlots

- **ANABLUNONHUM-009**: Integrate into BodyBlueprintFactory
  - Version detection and routing
  - Template processing pipeline
  - V1 path unchanged

- **ANABLUNONHUM-010**: Unit Tests
  - 90%+ coverage for all three services
  - 15-20 test cases per service

- **ANABLUNONHUM-011**: Integration Tests
  - End-to-end template → blueprint workflow
  - Real data files
  - Multiple body structures

- **ANABLUNONHUM-012**: Performance Benchmarks
  - Template expansion <5ms overhead
  - Cache performance
  - Load testing

**Deliverables**:
- 3 new service classes
- 1 modified service (BodyBlueprintFactory)
- 6 test files
- Performance baseline established

---

### Phase 3: Recipe Pattern Enhancement (Tickets 013-017)
**Duration**: 2-3 weeks | **Effort**: 34-44 hours

Enhanced pattern matching for recipes:

- **ANABLUNONHUM-013**: Slot Group Resolution
  - Resolve limbSet:type and appendage:type patterns
  - Template lookup integration
  - Generate slot keys from patterns

- **ANABLUNONHUM-014**: Wildcard Pattern Matching
  - Implement matchesPattern with wildcards
  - Regex conversion (leg_* → /^leg_.*$/)
  - Performance optimization

- **ANABLUNONHUM-015**: Property-Based Filtering
  - Implement matchesAll filters
  - slotType, orientation, socketId filtering
  - Combine multiple filters

- **ANABLUNONHUM-016**: Recipe Pattern Validation
  - Validate group references
  - Ensure patterns match slots
  - Helpful error messages

- **ANABLUNONHUM-017**: Test Suite
  - 90%+ coverage for pattern methods
  - Integration tests with real recipes
  - Performance tests (<5ms for 100 slots)

**Deliverables**:
- RecipeProcessor extended with 3 new methods
- 5 test files (unit + integration)
- Pattern matching fully functional

---

### Phase 4: Backward Compatibility (Tickets 018-019)
**Duration**: 1-2 weeks | **Effort**: 12-16 hours

Ensure seamless v1/v2 coexistence:

- **ANABLUNONHUM-018**: Schema Version Detection
  - Implement version routing logic
  - Feature flag support
  - Strict v1/v2 separation

- **ANABLUNONHUM-019**: Regression Test Suite
  - All existing tests pass
  - V1 blueprints unchanged
  - Feature flag tested
  - No performance regression

**Deliverables**:
- Version detection logic
- Feature flag implementation
- 3 regression test files
- 100% existing test pass rate

---

### Phase 5: Example Content (Tickets 020-023)
**Duration**: 2-3 weeks | **Effort**: 28-36 hours

Complete non-human creature examples:

- **ANABLUNONHUM-020**: Structure Templates
  - Spider (8 legs, radial)
  - Dragon (quadruped + wings)
  - Octopoid (8 tentacles)
  - Centaur (hybrid)

- **ANABLUNONHUM-021**: Blueprints
  - 4 blueprints using templates
  - Demonstrate additionalSlots
  - Proper root entity references

- **ANABLUNONHUM-022**: Entity Definitions
  - Spider parts (legs, pedipalps, abdomen)
  - Dragon parts (wings, scaled legs, tail)
  - Octopoid parts (tentacles)
  - All with proper socket components

- **ANABLUNONHUM-023**: Recipes
  - 2+ recipes per blueprint
  - Demonstrate all pattern types
  - Property-based part selection

**Deliverables**:
- 4 structure templates
- 4 v2 blueprints
- 15+ entity definitions
- 8+ recipes

---

### Phase 6: Validation & Tooling (Tickets 024-025)
**Duration**: 2-3 weeks | **Effort**: 18-24 hours

Enhanced validation and migration tools:

- **ANABLUNONHUM-024**: Enhanced Validation
  - Template validator
  - Blueprint validator (v2-specific)
  - Recipe validator (pattern validation)
  - Helpful error messages with suggestions

- **ANABLUNONHUM-025**: CLI Migration Tools
  - Blueprint migration tool (v1 → v2)
  - Template generator (reverse engineering)
  - Anatomy validation tool
  - Template preview tool

**Deliverables**:
- 3 validation services
- 4 CLI tools
- npm scripts registered
- Tool documentation

---

## Dependency Graph

```
Phase 1 (Schemas)
    ↓
Phase 2 (Services) → Phase 4 (Compatibility)
    ↓                       ↓
Phase 3 (Recipes) ──────→ Phase 5 (Examples)
    ↓                       ↓
Phase 6 (Validation & Tooling)
```

## Critical Path

1. ANABLUNONHUM-001 (Structure Schema) - **BLOCKING**
2. ANABLUNONHUM-002 (Blueprint Schema) - **BLOCKING**
3. ANABLUNONHUM-006 (Template Loader) - **BLOCKING**
4. ANABLUNONHUM-007 (Socket Generator) - **BLOCKING**
5. ANABLUNONHUM-009 (Blueprint Integration) - **BLOCKING**

## Success Metrics

### Functionality
- ✅ All v1 blueprints work unchanged
- ✅ V2 blueprints load and process correctly
- ✅ Recipe patterns resolve correctly
- ✅ Examples validate and work

### Quality
- ✅ 90%+ test coverage for new code
- ✅ 100% existing test pass rate
- ✅ No performance regression in v1 path
- ✅ <10ms overhead for v2 blueprint expansion

### Usability
- ✅ 60-70% effort reduction for non-humanoid creatures
- ✅ Clear error messages with suggestions
- ✅ Complete documentation
- ✅ Migration tools functional

## Risk Mitigation

### Breaking Changes
- **Risk**: V2 processing breaks existing content
- **Mitigation**: Strict version checking, feature flag, isolated code paths
- **Rollback**: Feature flag disables v2 instantly

### Performance Regression
- **Risk**: Template expansion slows blueprint loading
- **Mitigation**: Performance tests, caching, profiling
- **Target**: <10ms overhead acceptable

### Complexity Increase
- **Risk**: System harder to understand
- **Mitigation**: Comprehensive docs, examples, tutorials, video guides

### Modder Confusion
- **Risk**: Uncertain which format to use
- **Mitigation**: Clear upgrade guide, decision flowchart, Discord support

## Implementation Order

### Critical First (Can't Proceed Without)
1. ANABLUNONHUM-001, 002, 003 (Schemas)
2. ANABLUNONHUM-004 (Schema Tests)
3. ANABLUNONHUM-006, 007, 008 (Core Services)
4. ANABLUNONHUM-009 (Integration)

### Can Proceed in Parallel
- Phase 1 tickets (001-005) - Parallel after schemas done
- Phase 3 tickets (013-017) - Can start after Phase 2 services
- Phase 5 tickets (020-023) - Parallel within phase

### Can Defer
- ANABLUNONHUM-012 (Performance) - After basic functionality works
- ANABLUNONHUM-025 (CLI Tools) - After v2 proven working

## Testing Strategy

### Unit Tests
- Every service has dedicated test file
- 90%+ line coverage, 85%+ branch coverage
- Mock dependencies, isolated tests

### Integration Tests
- Cross-service workflows
- Real data files from data/mods/
- End-to-end scenarios

### Performance Tests
- Baseline v1 performance
- Measure v2 overhead
- Target: <10ms additional

### Regression Tests
- All existing anatomy tests
- V1 blueprints unchanged
- No breaking changes

## Documentation Requirements

### Technical Docs
- Schema reference documentation
- Service API documentation
- Integration patterns

### User Docs
- Quick start guide (non-human creatures)
- Migration guide (v1 → v2)
- Pattern matching reference
- Best practices

### Examples
- Complete creature examples (spider, dragon, octopoid, centaur)
- Before/after migration examples
- Common patterns cookbook

## Delivery Milestones

### Milestone 1: Foundation (Weeks 1-3)
- All schemas complete and validated
- Schema tests passing
- Documentation started

### Milestone 2: Core Services (Weeks 4-7)
- Template loader, socket/slot generators working
- Integration with BodyBlueprintFactory
- Unit + integration tests passing

### Milestone 3: Recipe Enhancement (Weeks 8-10)
- Pattern matching fully functional
- Recipe validation working
- Tests passing

### Milestone 4: Examples & Compatibility (Weeks 11-14)
- All example content created
- Backward compatibility proven
- Regression tests passing

### Milestone 5: Polish & Tools (Weeks 15-17)
- Enhanced validation with great error messages
- CLI migration tools working
- Documentation complete

## Notes

### Design Philosophy
- **Declarative over imperative**: Describe structure, not implementation
- **Backward compatible**: All existing content works unchanged
- **Progressive enhancement**: Opt-in to new features
- **Modder-friendly**: Lower barrier to entry

### Future Extensions
- Nested limb sets (fingers on hands)
- Conditional socket patterns
- Metamorphic structures
- Visual template editor

### Long-term Vision
- Community template library
- Standard body structures emerge
- Easier modding ecosystem
- More diverse creature content

---

## Quick Reference

**Total Tickets**: 25
**Phases**: 6
**Estimated Duration**: 17 weeks
**Estimated Effort**: 160-200 hours

**Status**: Ready for implementation
**Last Updated**: 2025-10-26
**Source Document**: `reports/anatomy-blueprint-non-human-architecture.md`
