# RECVALREF-000: Recipe Validation Refactoring - Master Overview

**Status:** Planning Complete
**Total Estimated Effort:** 10-12 weeks
**Created:** 2025-01-14

## Executive Summary

Comprehensive refactoring of the recipe validation system to transform it from a monolithic patchwork architecture into a robust, flexible, and maintainable validation pipeline.

## Current State Analysis

### Critical Issues
- **God Class:** `RecipePreflightValidator.js` violates project guideline (1,207 lines vs 500 max)
- **Boolean Flag Proliferation:** 7 flags = 128 test configurations
- **Code Duplication:** 5 instances of duplicated logic
- **Zero Test Coverage:** No unit tests for core validator
- **Hardcoded Dependencies:** Inflexible mod loading and configuration

### Key Metrics
| Metric | Current | Target |
|--------|---------|--------|
| Max File Size | 1,207 lines | <500 lines |
| Test Coverage | 0% | 80%+ |
| Code Duplication | 5 instances | 0 instances |
| Validation Configs | 128 (2^7) | ∞ (JSON config) |

## Refactoring Phases

### Phase 1: Foundation & Interfaces (Week 1-2)
**Goal:** Establish core abstractions without breaking existing system

**Tickets:**
- RECVALREF-001: Create IValidator Interface
- RECVALREF-002: Create ValidationContext Class
- RECVALREF-003: Create Configuration Schema
- RECVALREF-004: Create Default Configuration

**Deliverables:**
- Core interfaces defined
- Configuration system established
- Zero breaking changes

---

### Phase 2: Shared Services & Utilities (Week 3-4)
**Goal:** Eliminate code duplication and create reusable components

**Tickets:**
- RECVALREF-005: Create String Utilities (eliminates 3 duplications)
- RECVALREF-006: Create Entity Matcher Service (eliminates 2 duplications)
- RECVALREF-007: Create Blueprint Processor Service
- RECVALREF-008: Create Validation Result Builder

**Deliverables:**
- All code duplication eliminated
- Shared services available
- Test coverage for utilities

---

### Phase 3: Validator Implementations (Week 5-7)
**Goal:** Refactor inline validation methods to standalone validators

**Tickets:**
- RECVALREF-009: Create BaseValidator Class
- RECVALREF-010: Create Validator Registry
- RECVALREF-011: Refactor 11 Validators to Standalone Classes
  - Component Existence
  - Property Schemas
  - Body Descriptors
  - Blueprint Existence
  - Socket/Slot Compatibility
  - Pattern Matching
  - Descriptor Coverage
  - Part Availability
  - Generated Slot Parts
  - Load Failures
  - Recipe Usage

**Deliverables:**
- All validators as standalone classes
- 80%+ test coverage per validator
- Plugin architecture established

---

### Phase 4: Pipeline Orchestration (Week 8-10)
**Goal:** Replace monolithic orchestrator with configurable pipeline

**Tickets:**
- RECVALREF-012: Create Validation Pipeline
- RECVALREF-013: Create Configuration Loader
- RECVALREF-014: Create New CLI Entry Point

**Deliverables:**
- Pipeline orchestrator
- Configuration loading system
- New CLI with backward compatibility

---

### Migration Strategy (Week 9-14)
**Goal:** Safely migrate from legacy to refactored system

**Tickets:**
- RECVALREF-015: Create Comparison Test Suite (Week 9)
- RECVALREF-016: Beta Release and Feedback (Week 10-11)
- RECVALREF-017: Deprecate Legacy System (Week 12-13)
- RECVALREF-018: Remove Legacy Code (Week 14)

**Deliverables:**
- 100% output parity verified
- Successful beta period
- Legacy code removed

---

## Success Metrics

### Code Quality
- ✅ All files <500 lines (guideline compliant)
- ✅ Zero code duplication
- ✅ 80%+ unit test coverage
- ✅ Cyclomatic complexity <10 per function

### Functionality
- ✅ 100% output parity with legacy system
- ✅ Configuration flexibility (disable any validator)
- ✅ Plugin system for custom validators
- ✅ Clear, actionable error messages

### Performance
- ✅ Validation time within 10% of baseline
- ✅ Memory usage within 20% of baseline
- ✅ Startup time within 25% of baseline

## Risk Mitigation

### High-Risk Areas
1. **Blueprint Processing:** V2 handling may differ subtly
2. **Error Messages:** Format changes could break tooling
3. **Performance:** New architecture slower than monolith

### Mitigation Strategies
1. Comprehensive comparison testing
2. Exact error format compatibility
3. Performance benchmarking suite
4. Rollback plan available

## Dependencies Graph

```
Phase 1 (Foundation)
├─ RECVALREF-001 (IValidator)
├─ RECVALREF-002 (ValidationContext) → depends on 001
├─ RECVALREF-003 (Config Schema)
└─ RECVALREF-004 (Default Config) → depends on 003

Phase 2 (Services)
├─ RECVALREF-005 (String Utils)
├─ RECVALREF-006 (Entity Matcher) → depends on 005
├─ RECVALREF-007 (Blueprint Processor)
└─ RECVALREF-008 (Result Builder) → depends on 001

Phase 3 (Validators)
├─ RECVALREF-009 (BaseValidator) → depends on 001, 008
├─ RECVALREF-010 (Registry) → depends on 001
└─ RECVALREF-011 (11 Validators) → depends on 009

Phase 4 (Pipeline)
├─ RECVALREF-012 (Pipeline) → depends on 010, 011
├─ RECVALREF-013 (Config Loader) → depends on 003, 004
└─ RECVALREF-014 (New CLI) → depends on 012, 013

Migration
├─ RECVALREF-015 (Comparison) → depends on 014
├─ RECVALREF-016 (Beta) → depends on 015
├─ RECVALREF-017 (Deprecate) → depends on 016
└─ RECVALREF-018 (Remove) → depends on 017 + 1 month
```

## Implementation Order

### Can Start Immediately (Parallel)
- RECVALREF-001 (IValidator)
- RECVALREF-003 (Config Schema)
- RECVALREF-005 (String Utils)
- RECVALREF-007 (Blueprint Processor)

### Sequential Dependencies
1. Complete Phase 1 → Start Phase 2
2. Complete Phase 2 → Start Phase 3
3. Complete Phase 3 → Start Phase 4
4. Complete Phase 4 → Start Migration

## Testing Strategy

### Unit Tests
- Each validator: 80%+ coverage
- Each service: 90%+ coverage
- Core classes: 95%+ coverage

### Integration Tests
- Pipeline execution
- Configuration loading
- Validator interactions

### Comparison Tests
- Legacy vs refactored output parity
- All validation scenarios
- Performance benchmarks

## Documentation Updates

### Files to Create
- `docs/validation/architecture.md` - New architecture overview
- `docs/validation/configuration.md` - Configuration guide
- `docs/validation/custom-validators.md` - Plugin development guide
- `docs/validation/migration-guide.md` - Legacy → new migration

### Files to Update
- `README.md` - Update validation section
- `CLAUDE.md` - Update validation patterns
- `CHANGELOG.md` - Document breaking changes

## Rollback Plan

If critical issues discovered:
1. Revert CLI to use old implementation
2. Mark new system as experimental
3. Address issues in isolated branch
4. Re-release when validated

```bash
git revert <refactoring-commits>
npm run validate:recipe # Uses old implementation
```

## References

- **Analysis:** `reports/recipe-validation-architecture-analysis.md`
- **Recommendations:** `reports/recipe-validation-refactoring-recommendations.md`
- **Project Guidelines:** `CLAUDE.md`

## Ticket Index

### Phase 1: Foundation
- RECVALREF-001 through RECVALREF-004

### Phase 2: Services
- RECVALREF-005 through RECVALREF-008

### Phase 3: Validators
- RECVALREF-009 through RECVALREF-011

### Phase 4: Pipeline
- RECVALREF-012 through RECVALREF-014

### Migration
- RECVALREF-015 through RECVALREF-018

---

**Total Tickets Created:** 18
**Estimated Total Effort:** 10-12 weeks
**Expected Outcome:** Robust, maintainable, well-tested validation system
