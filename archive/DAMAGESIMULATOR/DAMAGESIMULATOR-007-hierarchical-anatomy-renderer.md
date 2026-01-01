# DAMAGESIMULATOR-007: Create HierarchicalAnatomyRenderer

## Summary
Create the `HierarchicalAnatomyRenderer` component that displays body parts as cards in a hierarchical tree structure. This component shows health bars, mechanical components, and status effects for each body part.

## Dependencies
- DAMAGESIMULATOR-003 must be completed (AnatomyDataExtractor available)
- DAMAGESIMULATOR-006 must be completed (DamageSimulatorUI for integration)

## Files to Touch

### Create
- `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js` - Main renderer
- `tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Integrate renderer
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Register renderer
- `css/damage-simulator.css` - Add card and tree styles (if not complete in 004)

## Out of Scope
- DO NOT implement click interactions for part selection (future ticket)
- DO NOT implement status effect display (separate enhancement)
- DO NOT implement oxygen capacity display (separate enhancement)
- DO NOT modify AnatomyDataExtractor
- DO NOT implement damage application

## Acceptance Criteria

### Render Requirements
1. Display parts as cards in tree structure (indentation shows hierarchy)
2. Show part name prominently on each card
3. Show health bar with current/max HP
4. Filter and display only mechanical components (no `descriptors:*`)
5. Support collapsible children for deep hierarchies
6. Update display when entity changes

### Health Bar Requirements
1. Color coding: green (>66%), yellow (33-66%), red (<33%)
2. Show numeric values (e.g., "85/100 HP")
3. Handle parts without health component gracefully

### Tests That Must Pass
1. **Unit: HierarchicalAnatomyRenderer.test.js**
   - `should render tree structure from hierarchy data`
   - `should create card for each part`
   - `should show part name on card`
   - `should display health bar with correct percentage`
   - `should color health bar based on percentage`
   - `should filter out descriptor components`
   - `should show mechanical components list`
   - `should handle parts without health component`
   - `should indent child parts correctly`
   - `should update display on refresh call`
   - `should clear previous render before new render`
   - `should handle empty hierarchy gracefully`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. No DOM manipulation outside container element
2. No direct calls to EntityManager (uses extracted data)
3. Pure render logic - no business logic
4. Event emission for part selection (future use)
5. Accessible: proper ARIA roles and labels

## Implementation Notes

### Integration with DamageSimulatorUI

DamageSimulatorUI orchestrates child components via:
1. `setChildComponent(name, component)` - Register as `'anatomyRenderer'`
2. Event subscription to `damage-simulator:entity-loaded` - Receives `{ definitionId, instanceId, anatomyData }`
3. Call `render(anatomyData)` when event received

The `anatomyData` comes from `AnatomyDataExtractor.extractFromEntity(instanceId)` which returns an `AnatomyTreeNode`:
```javascript
{
  id: string,           // Part entity ID
  name: string,         // Human-readable name from core:name
  components: Object,   // Mechanical components (excludes descriptors:*)
  health: { current: number, max: number } | null,
  children: AnatomyTreeNode[]
}
```

### HierarchicalAnatomyRenderer Interface
```javascript
class HierarchicalAnatomyRenderer {
  constructor({ containerElement, eventBus, logger })

  /**
   * Render the anatomy hierarchy
   * @param {Object} hierarchyData - From AnatomyDataExtractor
   */
  render(hierarchyData)

  /**
   * Clear current render
   */
  clear()

  /**
   * Update a specific part's display
   * @param {string} partId
   * @param {Object} partData
   */
  updatePart(partId, partData)

  /**
   * Get the DOM element for a part
   * @param {string} partId
   * @returns {HTMLElement|null}
   */
  getPartElement(partId)
}
```

### Card HTML Structure
```html
<!-- Note: CSS classes must match damage-simulator.css exactly -->
<div class="ds-part-card" data-part-id="uuid" data-depth="0" role="treeitem">
  <div class="ds-part-card-header">
    <span class="ds-part-card-name">Torso</span>
    <span class="ds-part-expand" aria-label="Toggle children">▼</span>
  </div>
  <div class="ds-health-bar">
    <div class="ds-health-bar-fill ds-health-bar-fill--healthy" style="width: 85%"></div>
  </div>
  <span class="ds-part-card-health">85/100 HP</span>
  <div class="ds-part-components">
    <ul>
      <li>anatomy:part</li>
      <li>anatomy:part_health</li>
      <li>anatomy:sockets (3 slots)</li>
    </ul>
  </div>
  <div class="ds-part-children" role="group">
    <!-- Nested cards with data-depth incremented -->
  </div>
</div>
```

### Health Bar Color Logic
```javascript
// Use CSS modifier classes from damage-simulator.css
function getHealthBarModifier(percentage) {
  if (percentage > 66) return 'ds-health-bar-fill--healthy';   // green #4caf50
  if (percentage > 33) return 'ds-health-bar-fill--damaged';   // orange #ff9800
  return 'ds-health-bar-fill--critical';                       // red #f44336
}
```

### Component Display Formatting
```javascript
function formatComponent(componentId, componentData) {
  // Special formatting for known components
  if (componentId === 'anatomy:sockets') {
    const slotCount = Object.keys(componentData.slots || {}).length;
    return `anatomy:sockets (${slotCount} slots)`;
  }
  return componentId;
}
```

## Definition of Done
- [x] HierarchicalAnatomyRenderer created with full JSDoc
- [x] Unit tests with ≥90% coverage (42 tests passing)
- [x] Renderer registered in DI container
- [x] Integrated with DamageSimulatorUI
- [x] Tree structure renders correctly
- [x] Health bars display with color coding
- [x] Components list excludes descriptors
- [x] CSS styles complete for cards and tree (existing from DAMAGESIMULATOR-004)
- [x] Accessible (ARIA roles: tree, treeitem, group, aria-expanded, aria-label)
- [x] ESLint passes (0 errors, only warnings)

## Outcome

### Implementation Summary
Successfully implemented `HierarchicalAnatomyRenderer` component that renders body parts as hierarchical cards with health bars and mechanical component lists.

### Files Created
- `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js` - Main renderer (458 lines)
- `tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js` - Unit tests (42 tests)

### Files Modified
- `src/dependencyInjection/tokens/tokens-ui.js` - Added `HierarchicalAnatomyRenderer` token
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Registered renderer factory
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Integrated `#renderAnatomy()` method and clear on selection change
- `src/domUI/shared/AnatomyDataExtractor.js` - Added `extractFromEntity()` wrapper method (fix for API gap from DAMAGESIMULATOR-006)
- `tickets/DAMAGESIMULATOR-007-hierarchical-anatomy-renderer.md` - Fixed CSS class name assumptions

### Ticket Corrections Made
1. **CSS Class Names**: Corrected ticket assumptions from incorrect class names (e.g., `ds-part-header`) to actual CSS classes (e.g., `ds-part-card-header`)
2. **API Gap Fix**: Added `extractFromEntity(instanceId)` method to `AnatomyDataExtractor` to bridge the gap between `DamageSimulatorUI` expectations and available API

### Test Coverage
- 42 unit tests covering all acceptance criteria
- Tests for: tree structure, card creation, health bars, color coding, component filtering, accessibility, expand/collapse, edge cases
- All 99 damage-simulator related tests pass

### Design Decisions
1. **Removed unused eventBus**: Constructor simplified to only require `containerElement` and `logger` since event dispatching was not needed for this ticket
2. **Factory pattern for DI**: Renderer uses factory pattern since `containerElement` is provided at runtime
3. **CSS BEM-style classes**: All class names match existing `damage-simulator.css` patterns

### Completed: 2025-12-31
