# HARMODREF-014: Refactor Remaining Positioning Operation Handlers

**Priority:** P1 - HIGH
**Effort:** 1 week
**Status:** Not Started

## Report Reference

[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Positioning Mod Violations (~50 references)"

## Problem Statement

Refactor all remaining operation handlers with hardcoded positioning references to use Component Type Registry. Estimated ~10-15 handlers based on 50 total references.

## Scope

Use HARMODREF-003 audit to identify all positioning handlers. Expected handlers include:

- Kneeling-related handlers
- Lying down handlers
- Straddling handlers
- Standing handlers
- Facing/direction handlers

## Pattern

Follow HARMODREF-013 pattern for each handler:

1. Inject IComponentTypeRegistry
2. Replace hardcoded component IDs with registry lookups
3. Update operation schemas for type parameters
4. Update tests

## Acceptance Criteria

- [ ] All positioning handlers use Component Type Registry
- [ ] Zero hardcoded positioning:\* references in handlers
- [ ] All schemas updated
- [ ] All tests pass with >85% coverage
- [ ] Full test suite passes

## Dependencies

HARMODREF-013 (proof-of-concept must be complete)

## Timeline

- Day 1-2: Identify and list all handlers
- Day 3-4: Refactor handlers
- Day 5: Update tests
