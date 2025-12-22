# MODMANSTAENH-000: Mod Manager Statistics Enhancement - Overview

**Status:** Not Started
**Priority:** Epic
**Estimated Effort:** 2-3 weeks total
**Dependencies:** None
**Spec:** `specs/mod-manager-statistics-enhancement.md`

---

## Objective

Enhance the Mod Manager's Configuration Summary panel with meaningful statistics and intelligence about the current mod configuration, helping users understand mod interdependencies, identify potential organizational improvements, and make informed decisions about mod structure.

---

## Ticket Dependency Graph

```
MODMANSTAENH-001 (Infrastructure)
    │
    ├─── MODMANSTAENH-002 (Hotspots Calc)
    │    └─── MODMANSTAENH-005 (Hotspots UI)
    │
    ├─── MODMANSTAENH-003 (Health Calc)
    │    └─── MODMANSTAENH-006 (Health UI)
    │
    ├─── MODMANSTAENH-004 (Quick Stats UI)
    │
    ├─── MODMANSTAENH-007 (Depth Calc)
    │    └─── MODMANSTAENH-010 (Depth UI)
    │
    ├─── MODMANSTAENH-008 (Footprint Calc)
    │    └─── MODMANSTAENH-011 (Footprint UI)
    │
    ├─── MODMANSTAENH-009 (Ratio Calc)
    │    └─── MODMANSTAENH-012 (Profile UI)
    │
    └─── MODMANSTAENH-013 (Orphan Risk Calc)
         └─── MODMANSTAENH-014 (Orphan Risk UI)
```

---

## Phase Breakdown

### Phase 1: High Value, Lower Effort

| Ticket | Title | Status |
|--------|-------|--------|
| MODMANSTAENH-001 | ModStatisticsService Infrastructure | Not Started |
| MODMANSTAENH-002 | Dependency Hotspots Calculation | Not Started |
| MODMANSTAENH-003 | Dependency Health Check Calculation | Completed |
| MODMANSTAENH-004 | Quick Stats UI Enhancement | Completed |
| MODMANSTAENH-005 | Dependency Hotspots UI Section | Not Started |
| MODMANSTAENH-006 | Dependency Health UI Section | Completed |

### Phase 2: Medium Effort

| Ticket | Title | Status |
|--------|-------|--------|
| MODMANSTAENH-007 | Dependency Depth Calculation | Completed |
| MODMANSTAENH-008 | Transitive Footprint Calculation | Not Started |
| MODMANSTAENH-009 | Core vs Optional Ratio Calculation | Not Started |
| MODMANSTAENH-010 | Dependency Depth UI Section | Not Started |
| MODMANSTAENH-011 | Transitive Footprint UI Section | Not Started |
| MODMANSTAENH-012 | Configuration Profile UI Section | Not Started |

### Phase 3: Higher Effort

| Ticket | Title | Status |
|--------|-------|--------|
| MODMANSTAENH-013 | Orphan Risk Calculation | Not Started |
| MODMANSTAENH-014 | Orphan Risk UI Section | Not Started |

---

## Features Included

1. **Dependency Hotspots Ranking** - Most depended-on mods
2. **Dependency Health Check** - Circular deps, missing deps, validation
3. **Quick Stats Enhancement** - Explicit/dependency/conflict counts
4. **Dependency Depth Analysis** - Chain length calculation
5. **Transitive Dependency Breakdown** - Per-explicit mod analysis
6. **Core vs Optional Ratio** - Foundation vs content classification
7. **Orphan Risk Assessment** - Single-parent fragility warnings

---

## Features NOT Included (Deferred)

- **Mod Category Distribution** - Parsing mod IDs for categories (unreliable)
- **Dependency Impact Preview** - Interactive hover/select (can be added later)
- **Interactive Graph Visualization** - Would require additional libraries

---

## Key Files

### New Files
- `src/modManager/services/ModStatisticsService.js`
- `tests/unit/modManager/services/ModStatisticsService.test.js`

### Modified Files
- `src/modManager/ModManagerBootstrap.js`
- `src/modManager/views/SummaryPanelView.js`
- `css/mod-manager.css`
- `tests/unit/modManager/views/SummaryPanelView.test.js`

### Reference Files (Read-Only)
- `src/modManager/services/ModGraphService.js`
- `tests/unit/modManager/services/ModGraphService.test.js`

---

## Success Metrics

1. **User Understanding**: Users can identify mods that might benefit from refactoring
2. **Decision Support**: Statistics help users make informed mod selection choices
3. **Configuration Health**: Users can proactively identify potential issues
4. **Performance**: Statistics calculation doesn't noticeably slow the UI

---

## Parallel Work Opportunities

Once MODMANSTAENH-001 is complete, the following can be worked in parallel:
- All calculation tickets: 002, 003, 007, 008, 009, 013
- Ticket 004 (Quick Stats UI) can proceed independently

UI tickets can be parallelized once their calculation dependency is complete.
