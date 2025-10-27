# Workflow Tickets

This directory contains detailed implementation workflow tickets for various features and improvements.

## ANABLUNONHUM Series: Non-Human Anatomy Architecture

**Source**: `reports/anatomy-blueprint-non-human-architecture.md`
**Overview**: `ANABLUNONHUM-000-IMPLEMENTATION-ROADMAP.md`
**Total Tickets**: 25
**Status**: Ready for implementation

### Quick Navigation

#### Phase 1: Schema Extensions (001-005)
Foundation schemas for template-based architecture:
- [001](ANABLUNONHUM-001-create-structure-template-schema.md) - Create Structure Template Schema
- [002](ANABLUNONHUM-002-extend-blueprint-schema.md) - Extend Blueprint Schema for V2
- [003](ANABLUNONHUM-003-extend-recipe-schema.md) - Extend Recipe Schema for Patterns
- [004](ANABLUNONHUM-004-schema-validation-tests.md) - Schema Validation Test Suite
- [005](ANABLUNONHUM-005-schema-documentation.md) - Schema Documentation & Examples

#### Phase 2: Structure Template Processor (006-012)
Core services for template processing:
- [006](ANABLUNONHUM-006-structure-template-loader.md) - StructureTemplateLoader Service
- [007](ANABLUNONHUM-007-socket-generator.md) - SocketGenerator Service
- [008](ANABLUNONHUM-008-slot-generator.md) - SlotGenerator Service
- [009](ANABLUNONHUM-009-integrate-blueprint-factory.md) - Integrate into BodyBlueprintFactory
- [010](ANABLUNONHUM-010-template-processor-unit-tests.md) - Template Processor Unit Tests
- [011](ANABLUNONHUM-011-template-processor-integration-tests.md) - Integration Tests
- [012](ANABLUNONHUM-012-performance-benchmarks.md) - Performance Benchmarks

#### Phase 3: Recipe Pattern Enhancement (013-017)
Enhanced pattern matching for recipes:
- [013](ANABLUNONHUM-013-slot-group-resolution.md) - Slot Group Resolution
- [014](ANABLUNONHUM-014-wildcard-pattern-matching.md) - Wildcard Pattern Matching
- [015](ANABLUNONHUM-015-property-based-filtering.md) - Property-Based Filtering
- [016](ANABLUNONHUM-016-recipe-pattern-validation.md) - Recipe Pattern Validation
- [017](ANABLUNONHUM-017-recipe-enhancement-tests.md) - Recipe Enhancement Test Suite

#### Phase 4: Backward Compatibility (018-019)
Ensure v1/v2 coexistence:
- [018](ANABLUNONHUM-018-schema-version-detection.md) - Schema Version Detection & Routing
- [019](ANABLUNONHUM-019-compatibility-regression-tests.md) - V1/V2 Compatibility Regression Tests

#### Phase 5: Example Content (020-023)
Complete non-human creature examples:
- [020](ANABLUNONHUM-020-example-structure-templates.md) - Example Structure Templates (Spider, Dragon, Octopoid, Centaur)
- [021](ANABLUNONHUM-021-example-blueprints.md) - Example Blueprints Using Templates
- [022](ANABLUNONHUM-022-example-entity-definitions.md) - Example Entity Definitions
- [023](ANABLUNONHUM-023-example-recipes.md) - Example Recipes Demonstrating Patterns

#### Phase 6: Validation & Tooling (024-025)
Enhanced validation and migration tools:
- [024](ANABLUNONHUM-024-enhanced-validation.md) - Enhanced Validation Rules & Error Messages
- [025](ANABLUNONHUM-025-cli-migration-tooling.md) - CLI Migration & Validation Tooling

### Implementation Guidelines

**Start With**:
1. Read the implementation roadmap: `ANABLUNONHUM-000-IMPLEMENTATION-ROADMAP.md`
2. Begin with Phase 1 schemas (tickets 001-003)
3. Validate with tests (ticket 004) before proceeding
4. Follow dependency order specified in tickets

**Critical Path**: 001 → 002 → 006 → 007 → 009

**Parallel Work**: Tickets within same phase can often be done in parallel after dependencies met

### Status Tracking

Update this section as tickets are completed:

- [ ] Phase 1: Schema Extensions (0/5 complete)
- [ ] Phase 2: Structure Template Processor (0/7 complete)
- [ ] Phase 3: Recipe Pattern Enhancement (0/5 complete)
- [ ] Phase 4: Backward Compatibility (0/2 complete)
- [ ] Phase 5: Example Content (0/4 complete)
- [ ] Phase 6: Validation & Tooling (0/2 complete)

**Overall Progress**: 0/25 tickets complete (0%)

### Key Benefits

This architecture enables:
- **60-70% effort reduction** for non-humanoid creatures
- **Declarative configuration** instead of exhaustive enumeration
- **Template reuse** across similar structures
- **Recipe portability** with semantic patterns
- **Complete backward compatibility** with existing content

---

For questions or clarifications, refer to the source document: `reports/anatomy-blueprint-non-human-architecture.md`
