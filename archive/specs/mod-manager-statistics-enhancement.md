# Mod Manager Statistics Enhancement Specification

## Overview

This specification describes enhancements to the Mod Manager's Configuration Summary panel to provide meaningful statistics and intelligence about the current mod configuration. The goal is to help users understand mod interdependencies, identify potential organizational improvements, and make informed decisions about mod structure.

## Current State

### Existing Configuration Summary
The current "Load Summary" panel displays:
- Active Mods count (total)
- Explicit count (user-selected)
- Dependencies count (auto-activated)
- Conflicts count
- Load Order (ordered list with badges)
- Unsaved changes indicator

### Available Data Infrastructure
The `ModGraphService` already maintains:
- Complete dependency graph with bidirectional tracking
- Topological load order
- Distinction between explicit, dependency, and core statuses
- Direct and transitive dependency resolution
- Blocking detection for deactivation

## Proposed Enhancements

### 1. Dependency Hotspots Ranking

**Purpose**: Identify mods that are most depended upon, indicating potential candidates for modularization.

**Display Format**:
```
┌─ Dependency Hotspots ─────────────────────┐
│ Most Depended-On Mods                     │
│ ─────────────────────────────────────────│
│ 1. core             → 42 dependents       │
│ 2. anatomy          → 28 dependents       │
│ 3. positioning      → 15 dependents       │
│ 4. clothing         → 12 dependents       │
│ 5. items            → 8 dependents        │
└───────────────────────────────────────────┘
```

**Calculation**:
```javascript
// Count unique mods that depend on each mod (direct + transitive)
function getDependencyHotspots(graph) {
  const hotspots = [];
  for (const node of graph.getAllNodes()) {
    const dependentCount = countUniqueDependents(node.id, graph);
    hotspots.push({ modId: node.id, dependentCount });
  }
  return hotspots.sort((a, b) => b.dependentCount - a.dependentCount);
}
```

**Value**: Helps identify mods that might benefit from being split into smaller, more focused modules if many mods depend on only portions of their functionality.

---

### 2. Dependency Depth Analysis

**Purpose**: Show the longest dependency chains to understand complexity and potential load order issues.

**Display Format**:
```
┌─ Dependency Depth ────────────────────────┐
│ Maximum Chain Length: 6 levels            │
│ ─────────────────────────────────────────│
│ Deepest Chain Example:                    │
│   sex-physical-control                    │
│   └─ positioning                          │
│      └─ anatomy                           │
│         └─ core                           │
│                                           │
│ Average Depth: 2.4 levels                 │
└───────────────────────────────────────────┘
```

**Calculation**:
```javascript
function calculateDependencyDepth(modId, graph, visited = new Set()) {
  if (visited.has(modId)) return 0;
  visited.add(modId);

  const node = graph.getNode(modId);
  if (!node.dependencies.length) return 1;

  const maxChildDepth = Math.max(
    ...node.dependencies.map(depId =>
      calculateDependencyDepth(depId, graph, visited)
    )
  );
  return 1 + maxChildDepth;
}
```

**Value**: Identifies complex dependency chains that might indicate tight coupling or opportunities for restructuring.

---

### 3. Orphan Risk Assessment

**Purpose**: Identify mods that would become orphaned (have no explicit dependents) if certain mods were deactivated.

**Display Format**:
```
┌─ Dependency Fragility ────────────────────┐
│ Single-Parent Dependencies                │
│ ─────────────────────────────────────────│
│ These mods are only needed by one mod:    │
│                                           │
│ • movement → only used by: positioning    │
│ • caressing → only used by: intimacy      │
│ • kissing → only used by: intimacy        │
│                                           │
│ Warning: Deactivating the parent mod will │
│ also deactivate these dependencies.       │
└───────────────────────────────────────────┘
```

**Calculation**:
```javascript
function findSingleParentMods(graph, activeExplicitMods) {
  const fragile = [];
  for (const node of graph.getAllNodes()) {
    if (node.status === 'dependency') {
      const explicitDependents = getExplicitDependents(node.id, graph);
      if (explicitDependents.length === 1) {
        fragile.push({
          modId: node.id,
          soleDependent: explicitDependents[0]
        });
      }
    }
  }
  return fragile;
}
```

**Value**: Helps users understand which mods are tightly coupled and would cascade-deactivate together.

---

### 4. Mod Category Distribution

**Purpose**: Show breakdown of active mods by category/type for better understanding of the configuration.

**Display Format**:
```
┌─ Configuration Composition ───────────────┐
│ Mod Categories                            │
│ ─────────────────────────────────────────│
│ ████████████████████ Core Systems (6)     │
│ ████████████████ Positioning (5)          │
│ ██████████████ Content Mods (12)          │
│ ████████████ Items & Equipment (4)        │
│ ████████ Anatomy & Body (3)               │
│                                           │
│ Total: 30 active mods                     │
└───────────────────────────────────────────┘
```

**Calculation**:
- Parse mod IDs to extract category prefixes (e.g., `sex-*`, `positioning`, `anatomy`)
- Group and count mods by category
- Display as horizontal bar chart

**Value**: Provides at-a-glance understanding of what types of content are loaded.

---

### 5. Dependency Impact Preview

**Purpose**: Show what would happen if a specific mod were deactivated (preview of cascade effects).

**Display Format** (shown when hovering/selecting a mod):
```
┌─ Deactivation Impact: intimacy ───────────┐
│ ─────────────────────────────────────────│
│ Direct Impact:                            │
│   • Would deactivate: intimacy            │
│                                           │
│ Cascade Effect (orphaned dependencies):   │
│   • caressing (no other explicit needs it)│
│   • kissing (no other explicit needs it)  │
│                                           │
│ Blocked By:                               │
│   • sex-oral (explicitly depends on this) │
│                                           │
│ Total mods affected: 3                    │
└───────────────────────────────────────────┘
```

**Calculation**: Already implemented via `calculateDeactivation()` in `ModGraphService`.

**Value**: Helps users understand consequences before making changes.

---

### 6. Core vs. Optional Ratio

**Purpose**: Show the ratio of essential (core/anatomy/positioning) vs. optional content mods.

**Display Format**:
```
┌─ Configuration Profile ───────────────────┐
│                                           │
│ Foundation: ████████████████ 40% (12)     │
│ Optional:   ████████████████████████ 60% (18) │
│                                           │
│ Foundation mods: core, anatomy,           │
│   positioning, clothing, items            │
│                                           │
│ This configuration is content-heavy.      │
└───────────────────────────────────────────┘
```

**Value**: Helps users understand the balance between essential systems and optional content.

---

### 7. Transitive Dependency Breakdown

**Purpose**: For each explicit mod, show how many transitive dependencies it brings.

**Display Format**:
```
┌─ Dependency Footprint ────────────────────┐
│ Dependencies Brought by Each Explicit Mod │
│ ─────────────────────────────────────────│
│ sex-physical-control  → +5 deps           │
│   (positioning, anatomy, core,            │
│    clothing, items)                       │
│                                           │
│ intimacy              → +3 deps           │
│   (positioning, anatomy, core)            │
│                                           │
│ items                 → +1 dep            │
│   (core)                                  │
│                                           │
│ Overlap: 60% of dependencies are shared   │
└───────────────────────────────────────────┘
```

**Calculation**:
```javascript
function getTransitiveDependencyFootprint(explicitModId, graph) {
  const allDeps = new Set();
  collectAllDependencies(explicitModId, graph, allDeps);
  return Array.from(allDeps);
}

function calculateDependencyOverlap(explicitMods, graph) {
  const footprints = explicitMods.map(id => ({
    modId: id,
    deps: new Set(getTransitiveDependencyFootprint(id, graph))
  }));

  // Calculate shared vs unique
  const allDeps = new Set();
  const sharedDeps = new Set();

  footprints.forEach(f => {
    f.deps.forEach(dep => {
      if (allDeps.has(dep)) sharedDeps.add(dep);
      allDeps.add(dep);
    });
  });

  return {
    total: allDeps.size,
    shared: sharedDeps.size,
    overlapPercentage: (sharedDeps.size / allDeps.size) * 100
  };
}
```

**Value**: Shows which explicit mods are "lightweight" vs. which bring many dependencies, and how much overlap exists.

---

### 8. Circular Dependency Detection

**Purpose**: Warn about potential circular dependencies (currently not possible with the validation, but good for safety).

**Display Format**:
```
┌─ Dependency Health ───────────────────────┐
│ ✓ No circular dependencies detected       │
│ ✓ All dependencies resolved               │
│ ✓ Load order is valid                     │
│                                           │
│ Warnings: 0                               │
│ Errors: 0                                 │
└───────────────────────────────────────────┘
```

Or if issues exist:
```
┌─ Dependency Health ───────────────────────┐
│ ⚠ Missing dependency: 'old-mod'           │
│   Required by: legacy-content             │
│                                           │
│ ✓ No circular dependencies                │
│ ✓ Load order computed successfully        │
│                                           │
│ Warnings: 1                               │
│ Errors: 0                                 │
└───────────────────────────────────────────┘
```

**Value**: Proactive health monitoring of the mod configuration.

---

## UI Design Recommendations

### Panel Organization

The enhanced Configuration Summary should be organized into collapsible sections:

```
┌─ Configuration Summary ───────────────────┐
│                                           │
│ ▼ Quick Stats                             │
│   Active: 30 | Explicit: 12 | Deps: 18    │
│                                           │
│ ▼ Dependency Hotspots                     │
│   [Top 5 most depended-on mods]           │
│                                           │
│ ▼ Dependency Health                       │
│   [Status indicators]                     │
│                                           │
│ ▶ Dependency Depth (collapsed)            │
│                                           │
│ ▶ Dependency Footprint (collapsed)        │
│                                           │
│ ▶ Configuration Profile (collapsed)       │
│                                           │
│ ▼ Load Order                              │
│   [Current load order list]               │
│                                           │
└───────────────────────────────────────────┘
```

### Interaction Patterns

1. **Hover Effects**: Hovering over a mod in any statistic should highlight it in the main mod list
2. **Click Navigation**: Clicking a mod ID scrolls to and selects that mod in the list
3. **Collapsible Sections**: Allow users to focus on statistics they care about
4. **Refresh Button**: Manual refresh for recalculating statistics after changes

### Visual Indicators

- **Color coding**:
  - Green for healthy metrics
  - Yellow for warnings (e.g., single-parent dependencies)
  - Red for errors (e.g., missing dependencies)
- **Bar charts**: For category distribution and ratios
- **Badges**: For counts and status indicators

---

## Implementation Priority

### Phase 1 (High Value, Lower Effort)
1. **Dependency Hotspots Ranking** - Uses existing graph data
2. **Dependency Health Check** - Simple validation
3. **Quick Stats Enhancement** - Extend existing summary

### Phase 2 (Medium Effort)
4. **Transitive Dependency Breakdown** - Per-explicit mod analysis
5. **Dependency Depth Analysis** - Chain length calculation
6. **Core vs. Optional Ratio** - Category classification

### Phase 3 (Higher Effort)
7. **Dependency Impact Preview** - Interactive hover/select
8. **Orphan Risk Assessment** - Fragility analysis
9. **Mod Category Distribution** - Visual bar chart

---

## Technical Considerations

### Performance
- Cache calculated statistics; only recalculate when mods change
- Use lazy evaluation for expensive calculations (only compute on section expand)
- Debounce recalculation during rapid mod toggling

### Data Sources
- `ModGraphService.getAllNodes()` - Complete graph access
- `ModGraphService.getLoadOrder()` - Sorted activation order
- `ModMetadata` objects - Mod details and names
- `ModGraphService.calculateDeactivation()` - Impact analysis

### New Service Requirements
Consider creating a `ModStatisticsService` to encapsulate all statistics calculations:

```javascript
class ModStatisticsService {
  constructor({ modGraphService, logger }) { ... }

  getDependencyHotspots(limit = 5) { ... }
  getDependencyDepthAnalysis() { ... }
  getSingleParentDependencies() { ... }
  getCategoryDistribution() { ... }
  getTransitiveDependencyFootprints() { ... }
  getDependencyOverlap() { ... }
  getHealthStatus() { ... }
}
```

### UI Components
- `StatisticsPanelView` - Container for all statistics sections
- `HotspotsSection` - Dependency hotspots ranking
- `HealthSection` - Dependency health status
- `DepthSection` - Dependency chain analysis
- `FootprintSection` - Transitive dependency breakdown
- `ProfileSection` - Configuration composition

---

## Success Metrics

1. **User Understanding**: Users can identify mods that might benefit from refactoring
2. **Decision Support**: Statistics help users make informed mod selection choices
3. **Configuration Health**: Users can proactively identify potential issues
4. **Performance**: Statistics calculation doesn't noticeably slow the UI

---

## Open Questions

1. Should statistics persist between sessions, or always recalculate?
2. Should there be an "export statistics" feature for documentation?
3. How detailed should the category classification be? (Manual mapping vs. auto-detect from mod ID patterns)
4. Should dependency graphs be visualized as interactive diagrams (higher effort)?

---

## Appendix: Current Mod Count by Category

Based on current codebase analysis (63 total mods):
- **Core/Foundation**: core, anatomy, positioning, clothing, items (~5)
- **Positioning Extensions**: movement, seduction, sitting, lying (~10)
- **Intimacy/Content**: caressing, kissing, affection, intimacy, sex-* mods (~25)
- **Items/Equipment**: weapons, tools, containers (~5)
- **Other**: writing, triggers, various content mods (~18)

This categorization could inform the Category Distribution feature.
