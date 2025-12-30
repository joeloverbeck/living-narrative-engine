# DAMAGESIMULATOR-003: Extract AnatomyDataExtractor Service

## Summary
Create a new `AnatomyDataExtractor` service that provides hierarchical anatomy traversal. This extracts the logic needed to build tree structures from anatomy:body data, which will be used by both the graph-based anatomy visualizer and the card-based damage simulator.

## Dependencies
- DAMAGESIMULATOR-001 must be completed first (establishes shared/ directory pattern)

## Files to Touch

### Create
- `src/domUI/shared/AnatomyDataExtractor.js` - New shared service
- `tests/unit/domUI/shared/AnatomyDataExtractor.test.js` - Unit tests

### Modify
- `src/dependencyInjection/registrations/visualizerRegistrations.js` - Register new service

### Reference (Read Only)
- `src/domUI/visualizer/VisualizationComposer.js` - Understand existing traversal patterns

## Out of Scope
- DO NOT modify `VisualizationComposer.js` (can extract in future ticket)
- DO NOT modify any damage-related code
- DO NOT create the damage-simulator page yet
- DO NOT touch `RecipeSelectorService` or `EntityLoadingService`
- DO NOT modify any files in `data/mods/`
- DO NOT change any schema files
- DO NOT modify AnatomyVisualizerUI (not needed for this service yet)

## Acceptance Criteria

### Tests That Must Pass
1. **Unit: AnatomyDataExtractor.test.js**
   - `should extract hierarchical tree from anatomy:body data`
   - `should handle circular references without infinite loop`
   - `should include part name from core:name component`
   - `should include health data from anatomy:part_health component`
   - `should filter mechanical components (exclude descriptors:*)`
   - `should filter core:name and core:description from components`
   - `should handle missing components gracefully`
   - `should return null for visited parts (cycle detection)`
   - `should traverse via anatomy:joint relationships`
   - `should extract children in correct order`

2. **Existing Tests Must Continue to Pass**
   - All existing `tests/unit/domUI/visualizer/` tests
   - All existing `tests/integration/visualizer/` tests
   - `npm run test:ci` passes

### Invariants
1. No changes to existing visualizer behavior
2. Traversal follows same parent-child relationships as VisualizationComposer
3. Component filtering is consistent with expected damage simulator needs
4. Cycle detection prevents infinite loops
5. DI registration follows existing patterns

## Implementation Notes

### AnatomyDataExtractor Interface
```javascript
class AnatomyDataExtractor {
  constructor({ entityManager, logger })

  /**
   * Extract hierarchical part data from anatomy:body component
   * @param {Object} bodyData - The anatomy:body component data
   * @returns {Object} Tree structure: { id, name, components, health, children: [...] }
   */
  extractHierarchy(bodyData)

  /**
   * Get children of a part via anatomy:joint relationships
   * @param {string} partId
   * @param {Object} bodyData
   * @returns {Array<string>} Child part IDs
   */
  getChildren(partId, bodyData)

  /**
   * Filter to mechanical components only
   * @param {Object} components
   * @returns {Object} Filtered components
   */
  filterMechanicalComponents(components)
}
```

### Component Filtering Rules
```javascript
// Exclude these component patterns:
const excludePatterns = [
  /^descriptors:/,  // All descriptor components
  'core:name',       // Name is extracted separately
  'core:description' // Description not needed
];
```

### Tree Node Structure
```javascript
{
  id: 'part_uuid',
  name: 'Torso',
  components: {
    'anatomy:part': { ... },
    'anatomy:part_health': { current: 100, max: 100 },
    'anatomy:sockets': { ... }
  },
  health: { current: 100, max: 100 },
  children: [
    { id: 'head_uuid', name: 'Head', ... }
  ]
}
```

## Definition of Done
- [ ] AnatomyDataExtractor created with full JSDoc
- [ ] Unit tests with ≥90% coverage on new service
- [ ] DI token added to tokens-core.js
- [ ] Service registered in visualizerRegistrations.js
- [ ] All existing tests pass
- [ ] ESLint passes: `npx eslint src/domUI/shared/AnatomyDataExtractor.js`
