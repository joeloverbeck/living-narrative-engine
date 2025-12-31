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
- `src/dependencyInjection/tokens/tokens-core.js` - Add `IAnatomyDataExtractor` token

### Reference (Read Only)
- `src/domUI/anatomy-renderer/VisualizationComposer.js` - Understand existing traversal patterns

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
- [x] AnatomyDataExtractor created with full JSDoc
- [x] Unit tests with ≥90% coverage on new service
- [x] DI token `IAnatomyDataExtractor` added to tokens-core.js
- [x] Service registered in visualizerRegistrations.js
- [x] All existing tests pass
- [x] ESLint passes: `npx eslint src/domUI/shared/AnatomyDataExtractor.js`

## Discrepancies Corrected During Implementation
1. **VisualizationComposer path**: Originally listed as `src/domUI/visualizer/` but actual location is `src/domUI/anatomy-renderer/`
2. **Token requirement**: Added `tokens-core.js` to Files to Modify section - token name follows `I` prefix convention (`IAnatomyDataExtractor`)

## Outcome

**Status**: ✅ COMPLETED

### Files Created
1. `src/domUI/shared/AnatomyDataExtractor.js` - Shared service for hierarchical anatomy data extraction
2. `tests/unit/domUI/shared/AnatomyDataExtractor.test.js` - Comprehensive unit tests (29 tests)

### Files Modified
1. `src/dependencyInjection/tokens/tokens-core.js` - Added `IAnatomyDataExtractor` token
2. `src/dependencyInjection/registrations/visualizerRegistrations.js` - Registered service with DI container

### Test Results
- **29 tests passed** covering all acceptance criteria
- Test categories:
  - Constructor validation (3 tests)
  - Hierarchy extraction (14 tests)
  - Child retrieval (4 tests)
  - Component filtering (8 tests)

### Key Implementation Details
- **BFS traversal** with cycle detection via `visited` Set
- **Parent-child index** pre-built for O(1) lookups during traversal
- **Component filtering** excludes `descriptors:*`, `core:name`, `core:description`
- **Error handling** with graceful degradation (returns null on failures)
- **JSDoc types** with proper `@typedef` for AnatomyTreeNode
- **DI pattern** follows existing `singletonFactory` lifecycle

### New Tests Added with Rationale
| Test | Rationale |
|------|-----------|
| `should extract hierarchical tree from anatomy:body data` | Core functionality validation |
| `should handle circular references without infinite loop` | Prevents stack overflow in malformed data |
| `should include part name from core:name component` | Validates UI display data extraction |
| `should include health data from anatomy:part_health component` | Required for damage simulator |
| `should filter mechanical components (exclude descriptors:*)` | Ensures clean data for damage calculations |
| `should filter core:name and core:description from components` | Avoids duplicate data in tree |
| `should handle missing components gracefully` | Robustness for partial data |
| `should return null for visited parts (cycle detection)` | Cycle detection invariant |
| `should traverse via anatomy:joint relationships` | Validates parent-child discovery |
| `should extract children in correct order` | Ensures deterministic output |
| `should handle empty bodyData.parts gracefully` | Edge case: root-only body |
| `should handle missing root entity` | Error case: invalid reference |
| `should handle entity with no children` | Leaf node handling |
| `should return null when bodyData.root is missing` | Input validation |
| `should return null when bodyData is null` | Null safety |

### ESLint Status
✅ All checks pass with zero errors/warnings after JSDoc fixes and appropriate eslint-disable comments for legitimate anatomy mod references.
