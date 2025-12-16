# LIGSYSDES-003: Create LightingStateService

## Status: COMPLETED ✅

**Completed**: 2025-12-16

## Summary

Create a service class `LightingStateService` that encapsulates the logic for determining whether a location is currently lit or dark based on its components.

## Rationale

The lighting state logic (checking `naturally_dark` marker and `light_sources` array) will be needed by multiple consumers: `LocationRenderer`, `AIPromptContentProvider`, and potentially future operators/conditions. Encapsulating this in a dedicated service ensures consistent behavior and single source of truth.

## Files to Create

| File | Purpose |
|------|---------|
| `src/locations/services/lightingStateService.js` | Service class for lighting state queries |
| `tests/unit/locations/services/lightingStateService.test.js` | Unit tests for the service |

## Files to Modify

None in this ticket (DI registration is LIGSYSDES-004).

## Out of Scope - DO NOT CHANGE

- Any files in `src/domUI/` (renderer changes are LIGSYSDES-005)
- Any files in `src/prompting/` (prompt changes are LIGSYSDES-006)
- DI tokens or registrations (handled in LIGSYSDES-004)
- Any existing services in other directories
- Any mod data files

## Implementation Details

### Service Interface

```javascript
// src/locations/services/lightingStateService.js

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} LightingState
 * @property {boolean} isLit - Whether the location has sufficient light to see
 * @property {string[]} lightSources - Entity IDs of active light sources (empty if ambient light)
 */

/**
 * Service for querying location lighting state.
 */
class LightingStateService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} dependencies
   * @param {IEntityManager} dependencies.entityManager
   * @param {ILogger} dependencies.logger
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'entityManager', logger, {
      requiredMethods: ['hasComponent', 'getComponentData']
    });
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Determines if a location is currently lit.
   *
   * Decision matrix:
   * | naturally_dark | light_sources.sources | Result |
   * |----------------|----------------------|--------|
   * | Absent         | Any                  | Lit (ambient) |
   * | Present        | Empty or missing     | Dark |
   * | Present        | Non-empty array      | Lit (artificial) |
   *
   * @param {string} locationId - Location entity ID
   * @returns {LightingState}
   */
  getLocationLightingState(locationId) {
    const isNaturallyDark = this.#entityManager.hasComponent(
      locationId,
      'locations:naturally_dark'
    );

    if (!isNaturallyDark) {
      return { isLit: true, lightSources: [] };
    }

    const lightSourcesData = this.#entityManager.getComponentData(
      locationId,
      'locations:light_sources'
    );

    const sources = lightSourcesData?.sources || [];
    return {
      isLit: sources.length > 0,
      lightSources: sources
    };
  }

  /**
   * Convenience method for simple boolean check.
   * @param {string} locationId - Location entity ID
   * @returns {boolean}
   */
  isLocationLit(locationId) {
    return this.getLocationLightingState(locationId).isLit;
  }
}

export { LightingStateService };
```

### Directory Structure

Create the directory path if it doesn't exist:
```
src/
└── locations/
    └── services/
        └── lightingStateService.js
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit tests** in `tests/unit/locations/services/lightingStateService.test.js`:

   **Constructor validation:**
   - Test: Throws if `entityManager` is missing
   - Test: Throws if `entityManager` lacks required methods
   - Test: Successfully constructs with valid dependencies

   **getLocationLightingState behavior:**
   - Test: Returns `{ isLit: true, lightSources: [] }` when location has NO `naturally_dark` component
   - Test: Returns `{ isLit: false, lightSources: [] }` when location HAS `naturally_dark` but NO `light_sources` component
   - Test: Returns `{ isLit: false, lightSources: [] }` when location HAS `naturally_dark` AND empty `light_sources.sources` array
   - Test: Returns `{ isLit: true, lightSources: ['entity:1', 'entity:2'] }` when location HAS `naturally_dark` AND non-empty `light_sources.sources`

   **isLocationLit convenience method:**
   - Test: Returns `true` for naturally lit locations
   - Test: Returns `false` for dark locations
   - Test: Returns `true` for artificially lit locations

   **Edge cases:**
   - Test: Handles undefined `lightSourcesData` gracefully (returns empty array)
   - Test: Handles null `sources` property gracefully
   - Test: Logs appropriate debug messages for lighting state queries

2. **TypeScript type checking** (via JSDoc):
   ```bash
   npm run typecheck
   ```

3. **Linting**:
   ```bash
   npx eslint src/locations/services/lightingStateService.js
   ```

### Invariants That Must Remain True

1. **Pure query service**: The service MUST NOT modify any component data - it is read-only
2. **Null safety**: The service must handle missing components gracefully without throwing
3. **Deterministic**: Same inputs must always produce same outputs
4. **No side effects**: No events dispatched, no state mutations

### Manual Verification

1. `npm run typecheck` passes
2. `npm run test:unit -- tests/unit/locations/services/lightingStateService.test.js` passes with 100% coverage

## Dependencies

- LIGSYSDES-002 (component schemas define the data structure)

## Blocked By

- LIGSYSDES-002 (needs to know component IDs and data schemas)

## Blocks

- LIGSYSDES-004 (DI registration needs the service to exist)
- LIGSYSDES-005 (renderer needs the service)
- LIGSYSDES-006 (prompt provider needs the service)

## Estimated Diff Size

- 1 new service file (~60 lines)
- 1 new test file (~150-200 lines)
- Total: ~250 lines

---

## Outcome

### Discrepancies Corrected in Ticket

Before implementation, the following ticket discrepancies were identified and corrected:

1. **Import Path Inconsistency**: Ticket originally referenced `ILogger.js`, but 95%+ of codebase uses `coreServices.js` for ILogger typedef. Updated to match codebase convention.

2. **Missing Import Statement**: Ticket code sample was missing the `import { validateDependency }` statement. Added to ensure completeness.

### Actual vs Planned Changes

| Aspect | Planned | Actual |
|--------|---------|--------|
| Service file | ~60 lines | 113 lines (includes comprehensive JSDoc and ESLint directive) |
| Test file | ~150-200 lines | 254 lines (16 tests with 100% coverage) |
| Logger validation | Not specified | Added full logger method validation (`debug`, `info`, `warn`, `error`) |
| ESLint compliance | Not specified | Added `eslint-disable` for intentional hardcoded mod references |
| TypeScript | Basic types | Added `LightSourcesComponentData` typedef for full type safety |

### Implementation Enhancements

1. **Full Logger Validation**: Added `validateDependency` check for logger with all required methods
2. **Debug Logging**: Added comprehensive debug output for lighting state queries
3. **Type Safety**: Added `LightSourcesComponentData` typedef to fix TypeScript errors with optional `sources` property
4. **Additional Tests**: Created 16 tests (vs ~13 planned) including logger validation tests

### Validation Results

- **ESLint**: 0 errors, 0 warnings
- **TypeScript**: No errors in new file
- **Tests**: 16 passed, 100% coverage on all metrics (statements, branches, functions, lines)

### Files Created

1. `src/locations/services/lightingStateService.js` - Service implementation
2. `tests/unit/locations/services/lightingStateService.test.js` - Unit tests
