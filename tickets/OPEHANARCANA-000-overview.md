# OPEHANARCANA-000: Operation Handler Architecture Migration - Overview

**Namespace:** OPEHANARCANA
**Status:** Planning
**Created:** 2025-11-27
**Source:** reports/operation-handler-architecture-analysis.md

---

## Executive Summary

This ticket series implements composite operation handlers to reduce redundancy across 237 rules in 30+ mods. The migration follows a phased approach with full backward compatibility.

### Impact Summary

| Handler                             | Rules Affected | Line Reduction |
| ----------------------------------- | -------------- | -------------- |
| `PREPARE_ACTION_CONTEXT`            | 194            | 57%            |
| `ESTABLISH_BIDIRECTIONAL_CLOSENESS` | 12             | 88%            |
| `BREAK_BIDIRECTIONAL_CLOSENESS`     | 6              | 85%            |
| `VALIDATED_ITEM_TRANSFER`           | 4              | 92%            |

---

## Ticket Structure

### Phase 1: PREPARE_ACTION_CONTEXT (Highest Priority)

| Ticket           | Title                                         | Dependencies |
| ---------------- | --------------------------------------------- | ------------ |
| OPEHANARCANA-001 | PREPARE_ACTION_CONTEXT Schema                 | None         |
| OPEHANARCANA-002 | PREPARE_ACTION_CONTEXT Handler Implementation | 001          |
| OPEHANARCANA-003 | PREPARE_ACTION_CONTEXT DI Registration        | 001, 002     |
| OPEHANARCANA-004 | PREPARE_ACTION_CONTEXT Unit Tests             | 002          |
| OPEHANARCANA-005 | PREPARE_ACTION_CONTEXT Integration Tests      | 003, 004     |
| OPEHANARCANA-006 | Migrate affection Mod Rules                   | 005          |
| OPEHANARCANA-007 | Migrate caressing Mod Rules                   | 005          |
| OPEHANARCANA-008 | Migrate kissing Mod Rules                     | 005          |

### Phase 2: Bidirectional Closeness Handlers

| Ticket           | Title                                        | Dependencies |
| ---------------- | -------------------------------------------- | ------------ |
| OPEHANARCANA-009 | ESTABLISH_BIDIRECTIONAL_CLOSENESS Schema     | 005          |
| OPEHANARCANA-010 | ESTABLISH_BIDIRECTIONAL_CLOSENESS Handler    | 009          |
| OPEHANARCANA-011 | ESTABLISH_BIDIRECTIONAL_CLOSENESS DI & Tests | 010          |
| OPEHANARCANA-012 | BREAK_BIDIRECTIONAL_CLOSENESS Schema         | 009          |
| OPEHANARCANA-013 | BREAK_BIDIRECTIONAL_CLOSENESS Handler        | 012          |
| OPEHANARCANA-014 | BREAK_BIDIRECTIONAL_CLOSENESS DI & Tests     | 013          |
| OPEHANARCANA-015 | Migrate hugging Mod Rules                    | 011, 014     |
| OPEHANARCANA-016 | Migrate hand-holding Mod Rules               | 011, 014     |

### Phase 3: Inventory Validation Handler

| Ticket           | Title                              | Dependencies |
| ---------------- | ---------------------------------- | ------------ |
| OPEHANARCANA-017 | VALIDATED_ITEM_TRANSFER Schema     | 005          |
| OPEHANARCANA-018 | VALIDATED_ITEM_TRANSFER Handler    | 017          |
| OPEHANARCANA-019 | VALIDATED_ITEM_TRANSFER DI & Tests | 018          |
| OPEHANARCANA-020 | Migrate items Mod Rules            | 019          |

### Phase 4: Remaining Migrations

| Ticket           | Title                            | Dependencies |
| ---------------- | -------------------------------- | ------------ |
| OPEHANARCANA-021 | Migrate seduction Mod Rules      | 005          |
| OPEHANARCANA-022 | Migrate sex-\* Mod Rules (Batch) | 005          |
| OPEHANARCANA-023 | Migrate Remaining Mods           | 005          |
| OPEHANARCANA-024 | Documentation Update             | All          |

---

## Migration Principles

1. **Full backward compatibility** - Old patterns continue to work unchanged
2. **Gradual migration** - Migrate by mod category, lowest risk first
3. **No regressions** - Each migrated rule verified with existing tests
4. **Test-driven** - Unit tests before handler implementation

---

## Success Metrics

| Metric                    | Target              |
| ------------------------- | ------------------- |
| Rule line reduction       | 50%+ average        |
| Operation count reduction | 53%                 |
| Handler test coverage     | 90%+ branches       |
| Zero regressions          | 0 failing tests     |
| Migration completion      | 198/237 rules (84%) |

---

## References

- Source Analysis: `reports/operation-handler-architecture-analysis.md`
- Handler Pattern: `src/logic/operationHandlers/baseOperationHandler.js`
- Closeness Example: `src/logic/operationHandlers/establishSittingClosenessHandler.js`
- Transfer Pattern: `src/logic/operationHandlers/transferItemHandler.js`
