# DAMAGESIMULATOR-006: Create DamageSimulatorUI Controller

## Summary
Create the main UI controller class `DamageSimulatorUI` that orchestrates all UI components and handles the overall page lifecycle. This is the central coordinator that wires together recipe selection, anatomy display, damage composer, and analytics.

## Dependencies
- DAMAGESIMULATOR-001 through 005 must be completed

## Files to Touch

### Create
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Main UI controller
- `tests/unit/domUI/damage-simulator/DamageSimulatorUI.test.js` - Unit tests

### Modify
- `src/damage-simulator.js` - Initialize DamageSimulatorUI instead of placeholder
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Register controller

## Out of Scope
- DO NOT implement HierarchicalAnatomyRenderer (separate ticket)
- DO NOT implement DamageCapabilityComposer (separate ticket)
- DO NOT implement DamageExecutionService (separate ticket)
- DO NOT implement analytics panels (separate ticket)
- DO NOT modify shared services

## Acceptance Criteria

### Controller Requirements
1. Bind to DOM elements from HTML structure
2. Initialize RecipeSelectorService and populate entity dropdown
3. Handle entity selection events
4. Coordinate EntityLoadingService for loading
5. Provide hooks for child components (anatomy, composer, analytics)
6. Handle state transitions (loading, loaded, error)
7. Display loading indicators appropriately

### Tests That Must Pass
1. **Unit: DamageSimulatorUI.test.js**
   - `should bind to required DOM elements`
   - `should populate entity selector on initialization`
   - `should call EntityLoadingService on entity selection`
   - `should show loading state while entity loads`
   - `should show error state on load failure`
   - `should emit events for child component coordination`
   - `should handle missing DOM elements gracefully`
   - `should validate dependencies in constructor`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Controller follows existing UI patterns from AnatomyVisualizerUI
2. DI injection for all dependencies (no direct imports of services)
3. Event-based communication for loose coupling
4. No business logic in controller (delegates to services)

## Implementation Notes

### DamageSimulatorUI Interface
```javascript
class DamageSimulatorUI {
  constructor({
    recipeSelectorService,
    entityLoadingService,
    anatomyDataExtractor,
    eventBus,
    logger
  })

  /**
   * Initialize the UI - bind events, populate selectors
   */
  async initialize()

  /**
   * Handle entity selection from dropdown
   * @param {string} definitionId
   */
  async handleEntitySelection(definitionId)

  /**
   * Get current loaded entity data
   * @returns {Object|null}
   */
  getCurrentEntityData()

  /**
   * Refresh anatomy display with current entity
   */
  async refreshAnatomyDisplay()

  /**
   * Set a child component (for later tickets)
   * @param {string} name - 'anatomyRenderer' | 'damageComposer' | 'analytics'
   * @param {Object} component
   */
  setChildComponent(name, component)
}
```

### DOM Element Bindings
```javascript
// Required element IDs from HTML
const ELEMENT_IDS = {
  entitySelect: 'entity-select',
  anatomyTree: 'anatomy-tree',
  damageForm: 'damage-form',
  hitsToDestroy: 'hits-to-destroy',
  hitProbability: 'hit-probability',
  historyLog: 'history-log'
};
```

### State Management
```javascript
// UI states
const UI_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error'
};
```

### Event Types to Emit
```javascript
// Events for child component coordination
const UI_EVENTS = {
  ENTITY_LOADING: 'damage-simulator:entity-loading',
  ENTITY_LOADED: 'damage-simulator:entity-loaded',
  ENTITY_LOAD_ERROR: 'damage-simulator:entity-load-error',
  REFRESH_REQUESTED: 'damage-simulator:refresh-requested'
};
```

## Definition of Done
- [ ] DamageSimulatorUI created with full JSDoc
- [ ] Unit tests with ≥90% coverage
- [ ] Controller registered in DI container
- [ ] Entry point initializes controller
- [ ] Entity dropdown populated on page load
- [ ] Entity selection triggers loading flow
- [ ] Loading/error states displayed appropriately
- [ ] Events emitted for future child components
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/DamageSimulatorUI.js`
