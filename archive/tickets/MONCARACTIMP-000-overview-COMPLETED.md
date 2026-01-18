# MONCARACTIMP-000: Monte Carlo Actionability Improvements - Overview - COMPLETED

## Summary

Master tracking ticket for implementing Monte Carlo actionability improvements that transform diagnostic reports from statistical observations into concrete, prioritized recommendations with validation.

## Priority

HIGH

## Effort

Total: ~4,500 LOC across 17 implementation tickets

## Source Specification

`specs/monte-carlo-actionability-improvements.md`

## Goals

Transform Monte Carlo simulation reports from diagnostic tools into actionable guides that directly answer: **"What specific changes will move my trigger rate into the target range?"**

## Five Key Improvements

| ID | Improvement | Description |
|----|-------------|-------------|
| A | Minimal Blocker Set | Identify 1-3 dominant blockers from many clauses |
| B | Threshold Suggestions | Auto-generate threshold values from quantile distributions (extension of existing) |
| C | Constructive Witness Search | Optimization search for nearest-feasible state when zero triggers |
| D | OR Block Restructure | Dead alternative detection with restructuring advice |
| E | Recommended Edit Set | Concrete patch proposals targeting rarity bands with importance sampling validation |

## Dependencies

This specification **requires** prior implementation of:
- `specs/monte-carlo-advanced-metrics.md` (provides quantile tracking, last-mile rate)
- `specs/monte-carlo-report-clarity-improvements.md` (provides classification system, quantile display infrastructure)

## Ticket List

### Phase 1: Infrastructure
- [x] MONCARACTIMP-001: Configuration & Type Definitions

### Phase 2: Core Services
- [x] MONCARACTIMP-002: MinimalBlockerSetCalculator Service
- [x] MONCARACTIMP-003: MinimalBlockerSetCalculator Unit Tests
- [x] MONCARACTIMP-004: OrBlockAnalyzer Service
- [x] MONCARACTIMP-005: OrBlockAnalyzer Unit Tests
- [x] MONCARACTIMP-006: ConstructiveWitnessSearcher Service
- [x] MONCARACTIMP-007: ConstructiveWitnessSearcher Unit Tests
- [x] MONCARACTIMP-008: ImportanceSamplingValidator Service
- [x] MONCARACTIMP-009: ImportanceSamplingValidator Unit Tests
- [x] MONCARACTIMP-010: EditSetGenerator Service
- [x] MONCARACTIMP-011: EditSetGenerator Unit Tests

### Phase 3: Report Integration
- [x] MONCARACTIMP-012: Threshold Suggestions Extension
- [x] MONCARACTIMP-013: BlockerSectionGenerator Core Blocker Integration
- [x] MONCARACTIMP-014: ActionabilitySectionGenerator
- [x] MONCARACTIMP-015: MonteCarloReportGenerator Wiring

### Phase 4: Validation
- [x] MONCARACTIMP-016: Integration Tests
- [x] MONCARACTIMP-017: Performance Tests

## Success Criteria

### Functional
- Core blockers correctly identified with >90% accuracy
- Witness search finds candidate with AND score ≥0.8 for 80%+ of near-feasible expressions
- Witness search completes within 5s for typical expressions
- Dead-weight OR alternatives identified with 0% false negatives
- Primary edit recommendation hits target band 70%+ of time
- Confidence intervals calibrated (95% CI contains true rate 90%+ of time)

### Technical
- Test coverage: 80%+ branches, 90%+ lines
- Performance overhead: <10% increase in report generation time
- Memory overhead: <20% increase in peak memory
- All existing tests continue to pass

## Out of Scope

- Per-clause violation percentiles (covered by `monte-carlo-advanced-metrics.md`)
- Near-miss rate tracking (covered by `monte-carlo-advanced-metrics.md`)
- Last-mile blocker rate (covered by `monte-carlo-advanced-metrics.md`)
- Three-tier classification system (covered by `monte-carlo-report-clarity-improvements.md`)
- Plain-English axis conflict explanations (covered by `monte-carlo-report-clarity-improvements.md`)
- SMT solver integration (deferred)
- AI/LLM-powered replacement suggestions for OR alternatives

## Definition of Done

- [x] All 17 tickets completed and merged
- [x] All unit tests passing with ≥80% branch coverage
- [x] All integration tests passing
- [x] Performance tests confirm overhead within limits
- [x] No regressions in existing Monte Carlo functionality
- [x] Report output includes all new actionability sections

## Final Outcome

All 17 MONCARACTIMP tickets have been completed successfully. The Monte Carlo actionability improvement series is now complete with:

- **5 new services**: MinimalBlockerSetCalculator, ConstructiveWitnessSearcher, OrBlockAnalyzer, ImportanceSamplingValidator, EditSetGenerator
- **1 new section generator**: ActionabilitySectionGenerator
- **Comprehensive test coverage**: Unit tests for all services, integration tests for the full pipeline, and performance tests
- **Performance within targets**: All operations complete well within defined thresholds
- **Full DI integration**: All services registered and wired through the dependency injection container
