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
<div class="ds-part-card" data-part-id="uuid" role="treeitem">
  <div class="ds-part-header">
    <span class="ds-part-name">Torso</span>
    <span class="ds-part-expand" aria-label="Toggle children">▼</span>
  </div>
  <div class="ds-part-health">
    <div class="ds-health-bar">
      <div class="ds-health-fill" style="width: 85%"></div>
    </div>
    <span class="ds-health-text">85/100 HP</span>
  </div>
  <div class="ds-part-components">
    <ul>
      <li>anatomy:part</li>
      <li>anatomy:part_health</li>
      <li>anatomy:sockets (3 slots)</li>
    </ul>
  </div>
  <div class="ds-part-children" role="group">
    <!-- Nested cards -->
  </div>
</div>
```

### Health Bar Color Logic
```javascript
function getHealthBarColor(percentage) {
  if (percentage > 66) return 'var(--health-high)';   // green
  if (percentage > 33) return 'var(--health-medium)'; // yellow
  return 'var(--health-low)';                         // red
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
- [ ] HierarchicalAnatomyRenderer created with full JSDoc
- [ ] Unit tests with ≥90% coverage
- [ ] Renderer registered in DI container
- [ ] Integrated with DamageSimulatorUI
- [ ] Tree structure renders correctly
- [ ] Health bars display with color coding
- [ ] Components list excludes descriptors
- [ ] CSS styles complete for cards and tree
- [ ] Accessible (ARIA roles, keyboard navigation stub)
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js`
