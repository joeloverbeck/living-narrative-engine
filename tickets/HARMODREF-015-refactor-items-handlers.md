# HARMODREF-015: Refactor Items Mod Operation Handlers

**Priority:** P1 - HIGH
**Effort:** 1 week
**Status:** Not Started

## Report Reference
[reports/hardcoded-mod-references-analysis.md](../reports/hardcoded-mod-references-analysis.md) - "Items Mod Violations (~40 references)"

## Problem Statement
Refactor operation handlers with hardcoded items mod references (container, locked, inventory, weight) to use Component Type Registry.

## Key Handlers
- `openContainerHandler.js`
- `validateInventoryCapacityHandler.js`
- `takeFromContainerHandler.js`
- `putInContainerHandler.js`
- `transferItemHandler.js`
- Additional handlers from HARMODREF-003 audit

## Pattern
Same as positioning refactoring:
1. Inject IComponentTypeRegistry
2. Replace hardcoded items:* with registry lookups
3. Update operation schemas
4. Update tests

## Acceptance Criteria
- [ ] All items handlers use Component Type Registry
- [ ] Zero hardcoded items:* references in handlers
- [ ] All tests pass with >85% coverage
- [ ] Integration tests validate alternative systems

## Dependencies
HARMODREF-013 (proof-of-concept)
