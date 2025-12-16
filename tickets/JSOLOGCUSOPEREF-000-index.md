# JSOLOGCUSOPEREF - JsonLogicCustomOperators Refactoring

**Source Document**: `reports/jsonLogicCustomOperators-architectural-analysis.md`
**Total Tickets**: 12
**Estimated Total Effort**: ~24 hours

---

## Overview

This ticket series addresses 12 architectural improvement opportunities identified in the `JsonLogicCustomOperators` module analysis. The refactoring is organized into 4 phases, ordered by priority.

---

## Phase 1: Critical Fixes (Week 1)

| Ticket | Title | Priority | Effort | Status |
|--------|-------|----------|--------|--------|
| [JSOLOGCUSOPEREF-001](../archive/di-dependency-ordering/JSOLOGCUSOPEREF-001-fix-di-dependency-ordering-COMPLETED.md) | Fix DI Dependency Ordering | 🔴 Critical | 15m | ✅ |
| [JSOLOGCUSOPEREF-002](../archive/di-dependency-ordering/JSOLOGCUSOPEREF-002-complete-cache-management.md) | Complete Cache Management | 🟢 Medium | 30m | ✅ |
| [JSOLOGCUSOPEREF-003](../archive/di-dependency-ordering/JSOLOGCUSOPEREF-003-update-failing-tests-COMPLETED.md) | Update Failing Tests | 🔴 Critical | 5m | ✅ |

**Phase 1 Goal**: All tests passing, no DI ordering issues

---

## Phase 2: High-Priority Refactoring (Week 2)

| Ticket | Title | Priority | Effort | Status |
|--------|-------|----------|--------|--------|
| [JSOLOGCUSOPEREF-004](../archive/jsonLogicCustomOperators-refactoring/JSOLOGCUSOPEREF-004-extract-operator-factory-COMPLETED.md) | Extract Operator Factory | 🟡 High | 4h | ✅ |
| [JSOLOGCUSOPEREF-005](../archive/jsonLogicCustomOperators-refactoring/JSOLOGCUSOPEREF-005-centralize-component-ids-COMPLETED.md) | Centralize Component IDs | 🟡 High | 30m | ✅ |
| [JSOLOGCUSOPEREF-006](./JSOLOGCUSOPEREF-006-fix-context-mutation.md) | Fix Context Mutation | 🟡 High | 2h | ⬜ |

**Phase 2 Goal**: `registerOperators()` reduced from 518 lines to <100, no hardcoded IDs

---

## Phase 3: Medium-Priority Improvements (Week 3)

| Ticket | Title | Priority | Effort | Status |
|--------|-------|----------|--------|--------|
| [JSOLOGCUSOPEREF-007](./JSOLOGCUSOPEREF-007-create-base-operator-class.md) | Create BaseOperator Class | 🟢 Medium | 3h | ⬜ |
| [JSOLOGCUSOPEREF-008](./JSOLOGCUSOPEREF-008-standardize-exports.md) | Standardize Exports | 🟢 Medium | 1h | ⬜ |
| [JSOLOGCUSOPEREF-009](./JSOLOGCUSOPEREF-009-unify-operator-storage.md) | Unify Operator Storage | 🟢 Medium | 2h | ⬜ |

**Phase 3 Goal**: Consistent patterns across all 27 operators

---

## Phase 4: Polish (Week 4)

| Ticket | Title | Priority | Effort | Status |
|--------|-------|----------|--------|--------|
| [JSOLOGCUSOPEREF-010](./JSOLOGCUSOPEREF-010-add-typescript-types.md) | Add TypeScript Types | 🔵 Low | 4h | ⬜ |
| [JSOLOGCUSOPEREF-011](./JSOLOGCUSOPEREF-011-clean-up-comments.md) | Clean Up Comments | 🔵 Low | 1h | ⬜ |
| [JSOLOGCUSOPEREF-012](./JSOLOGCUSOPEREF-012-modernize-closures.md) | Modernize Closures | 🔵 Low | 1h | ⬜ |

**Phase 4 Goal**: Improved developer experience and code clarity

---

## Dependency Graph

```
Phase 1 (All independent):
  001 ──┐
  002 ──┼──► Phase 1 Complete
  003 ──┘ (003 depends on 001 completion)

Phase 2 (Mostly independent):
  004 ──┐
  005 ──┼──► Phase 2 Complete
  006 ──┘

Phase 3:
  007 ──┐
  008 ──┼──► Phase 3 Complete
  009 ──┘ (009 should coordinate with 002)

Phase 4 (All independent):
  010 ──┐
  011 ──┼──► Phase 4 Complete
  012 ──┘
```

---

## Key Metrics

| Metric | Before | Target After | Current |
|--------|--------|--------------|---------|
| `registerOperators()` lines | 537 | <100 | 52 ✅ |
| Operators with cache management | 1 | All with caches |
| Cross-module dependencies | 1 | 0 |
| Context mutations | 3+ | 0 |
| Hardcoded component IDs | 5+ | 0 |

---

## Files Affected Summary

**Core Files**:
- `src/logic/jsonLogicCustomOperators.js` - Major refactoring
- `src/logic/operators/isActorLocationLitOperator.js` - Context mutation fix
- `src/logic/operators/base/baseBodyPartOperator.js` - Context mutation fix
- `src/logic/operators/base/baseFurnitureOperator.js` - Context mutation fix

**New Files**:
- `src/logic/operatorRegistryFactory.js` - Operator creation factory
- `src/logic/operators/base/baseOperator.js` - Abstract base class
- `src/constants/componentIds.js` - Component ID constants
- `src/logic/types.d.ts` - TypeScript declarations

**Test Files**:
- `tests/unit/dependencyInjection/registrations/worldAndEntityRegistrations.test.js`
- `tests/unit/logic/operatorRegistryFactory.test.js` (new)
- `tests/unit/logic/operators/base/baseOperator.test.js` (new)

---

## Validation Command

After completing all phases, run:

```bash
npm run test:ci && npm run typecheck && npm run build
```

All tests must pass, no type errors, build succeeds.

---

## Status Legend

- ⬜ Not Started
- 🔄 In Progress
- ✅ Complete
- ❌ Blocked
