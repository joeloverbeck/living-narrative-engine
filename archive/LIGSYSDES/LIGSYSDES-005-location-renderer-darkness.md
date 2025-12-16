# LIGSYSDES-005: Add Darkness Handling to LocationRenderer

## Status: ✅ COMPLETED

## Summary

Modify `LocationRenderer` to check lighting state and render appropriate content when a location is in darkness. When dark, the UI should show:
- Location name (kept)
- Darkness description or generic fallback
- No portrait
- No exits
- Presence sensing message (three-tier approximate count)

## Rationale

The UI needs to provide visual feedback that the player is in darkness and cannot see their surroundings. The player should still sense presences but not see specific character details or exit directions.

## Files to Create

| File | Purpose |
|------|---------|
| `src/domUI/location/buildDarknessPayload.js` | Helper function to build payload for dark locations |
| `src/domUI/location/presenceMessageBuilder.js` | Helper to generate three-tier presence messages |
| `tests/unit/domUI/location/buildDarknessPayload.test.js` | Unit tests for darkness payload builder |
| `tests/unit/domUI/location/presenceMessageBuilder.test.js` | Unit tests for presence message builder |
| `tests/integration/locations/darknessRendering.integration.test.js` | Integration tests for darkness UI rendering |

## Files to Modify

| File | Change |
|------|--------|
| `src/domUI/locationRenderer.js` | Add `lightingStateService` dependency (token: `ILightingStateService`), modify `#buildDisplayPayload` to check lighting, add darkness rendering branch |
| `src/domUI/location/buildLocationDisplayPayload.js` | Add `isDark` and `otherActorCount` optional fields to `LocationDisplayPayload` typedef |
| `src/dependencyInjection/registrations/uiRegistrations.js` | Resolve `ILightingStateService` and pass to `LocationRenderer` factory |
| `tests/unit/domUI/locationRenderer.test.js` | Add tests for darkness handling branch |

> **Note**: `src/domUI/location/typedefs.js` was removed from scope - typedefs are in `buildLocationDisplayPayload.js`

## Out of Scope - DO NOT CHANGE

- `AIPromptContentProvider` (handled in LIGSYSDES-006)
- The `LightingStateService` implementation (LIGSYSDES-003)
- Any CSS styling (can be added separately)
- Any mod data files
- Any other renderers or UI components

## Implementation Details

### 1. `buildDarknessPayload.js`

```javascript
// src/domUI/location/buildDarknessPayload.js

/**
 * @typedef {import('./buildLocationDisplayPayload.js').LocationDisplayPayload} LocationDisplayPayload
 */

/**
 * Builds a display payload for a location that is in darkness.
 *
 * @param {object} params
 * @param {string} params.locationName - The location's name
 * @param {string|null} params.darknessDescription - Custom darkness description or null
 * @param {number} params.otherActorCount - Number of other actors at location
 * @returns {LocationDisplayPayload} Payload with darkness-specific values
 */
export function buildDarknessPayload({
  locationName,
  darknessDescription,
  otherActorCount,
}) {
  const DEFAULT_DARKNESS_DESCRIPTION = "You're in pitch darkness.";

  return {
    name: locationName,
    description: darknessDescription || DEFAULT_DARKNESS_DESCRIPTION,
    portraitPath: null,
    portraitAltText: null,
    exits: [],
    characters: [],
    isDark: true,
    otherActorCount,
  };
}
```

### 2. `presenceMessageBuilder.js`

```javascript
// src/domUI/location/presenceMessageBuilder.js

/**
 * Three-tier presence sensing messages for darkness.
 */
const PRESENCE_MESSAGES = {
  NONE: "You can't see anything in the dark, but you sense no other presence here.",
  ONE: "You can't see anything in the dark, but you sense a presence here.",
  FEW: "You can't see anything in the dark, but you sense a few presences here.",
  SEVERAL: "You can't see anything in the dark, but you sense several presences here.",
};

/**
 * Returns an appropriate presence message based on count.
 *
 * @param {number} count - Number of other actors sensed
 * @returns {string} Human-readable presence message
 */
export function getPresenceMessage(count) {
  if (count === 0) return PRESENCE_MESSAGES.NONE;
  if (count === 1) return PRESENCE_MESSAGES.ONE;
  if (count <= 3) return PRESENCE_MESSAGES.FEW;
  return PRESENCE_MESSAGES.SEVERAL;
}

export { PRESENCE_MESSAGES };
```

### 3. Modifications to `locationRenderer.js`

**Constructor changes:**
- Add `lightingStateService` to constructor dependencies (token: `ILightingStateService`)
- Store as `this.#lightingStateService` (private field)
- Validate the new dependency with `validateDependency()`

**`#buildDisplayPayload` modification:**
```javascript
#buildDisplayPayload(locationId, actorId) {
  // Check lighting state first
  const { isLit } = this.#lightingStateService.getLocationLightingState(locationId);

  if (!isLit) {
    return this.#buildDarknessPayload(locationId, actorId);
  }

  // Existing lit location logic...
  const locationDetails = this.entityDisplayDataProvider.getLocationDetails(locationId);
  // ... rest of existing code
}

#buildDarknessPayload(locationId, actorId) {
  const locationDetails = this.entityDisplayDataProvider.getLocationDetails(locationId);
  const darknessDescData = this.entityManager.getComponentData(
    locationId,
    'locations:description_in_darkness'
  );

  const charactersInLocation = this.locationDataService.gatherLocationCharacters(
    locationId,
    actorId
  );

  return buildDarknessPayload({
    locationName: locationDetails.name,
    darknessDescription: darknessDescData?.text || null,
    otherActorCount: charactersInLocation.length,
  });
}
```

**Rendering modification:**
```javascript
// In description rendering, check isDark flag:
if (locationDto.isDark) {
  // Render description
  const descElement = this.domElementFactory.p(locationDto.description);
  this.elements.descriptionDisplay.appendChild(descElement);

  // Render presence message
  const presenceMsg = getPresenceMessage(locationDto.otherActorCount);
  const presenceElement = this.domElementFactory.p(presenceMsg);
  presenceElement.className = 'darkness-presence';
  this.elements.descriptionDisplay.appendChild(presenceElement);

  // Hide exits and characters sections
  // ...
}
```

### 4. Update `LocationDisplayPayload` typedef

Add to the typedef:
```javascript
/**
 * @property {boolean} [isDark] - Whether the location is in darkness
 * @property {number} [otherActorCount] - Count of other actors (for presence sensing in darkness)
 */
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit tests for `buildDarknessPayload.js`:**
   - Test: Returns `isDark: true` always
   - Test: Returns empty `exits` array
   - Test: Returns empty `characters` array
   - Test: Returns `portraitPath: null`
   - Test: Uses custom darkness description when provided
   - Test: Uses default description when no custom provided
   - Test: Preserves location name

2. **Unit tests for `presenceMessageBuilder.js`:**
   - Test: Returns NONE message when count is 0
   - Test: Returns ONE message when count is 1
   - Test: Returns FEW message when count is 2
   - Test: Returns FEW message when count is 3
   - Test: Returns SEVERAL message when count is 4
   - Test: Returns SEVERAL message when count is 10

3. **Unit tests for `locationRenderer.js` darkness handling:**
   - Test: Calls `lightingStateService.getLocationLightingState` with location ID
   - Test: Uses darkness payload builder when `isLit` is false
   - Test: Uses standard payload builder when `isLit` is true
   - Test: Darkness payload includes correct `otherActorCount`

4. **Integration test:**
   - Test: Complete darkness rendering flow with mock services
   - Test: Presence message appears in DOM when location is dark
   - Test: Portrait is hidden when location is dark
   - Test: Exits section is empty when location is dark

5. **Existing tests:**
   ```bash
   npm run test:unit -- tests/unit/domUI/locationRenderer.test.js
   ```
   All existing tests must continue to pass.

### Invariants That Must Remain True

1. **Backward compatibility**: Lit locations must render exactly as before
2. **No breaking changes to payload structure**: Existing consumers of `LocationDisplayPayload` must not break (new fields are optional)
3. **Consistent character counting**: The presence count must match the actual characters gathered by `locationDataService`
4. **DI compliance**: All new dependencies must be properly injected, not imported directly

### Manual Verification

1. `npm run typecheck` passes
2. `npm run test:unit -- tests/unit/domUI/` passes
3. All new tests pass with coverage ≥80%

## Dependencies

- LIGSYSDES-003 (LightingStateService) - ✅ **COMPLETED**: Service exists at `src/locations/services/lightingStateService.js`
- LIGSYSDES-004 (DI registration) - ✅ **COMPLETED**: Registered in `infrastructureRegistrations.js:531-540` as `ILightingStateService` singleton

## Blocked By

- None (all dependencies satisfied)

## Blocks

- None directly (but should complete before LIGSYSDES-007 for full integration testing)

## Estimated Diff Size

- 2 new helper files (~40 lines each)
- 2 new test files (~100 lines each)
- 1 new integration test file (~150 lines)
- Modified `locationRenderer.js` (~40 lines changed/added)
- Modified `buildLocationDisplayPayload.js` (~5 lines typedef update)
- Modified `uiRegistrations.js` (~3 lines)
- Modified existing test file (~30 lines)
- Total: ~500-600 lines

---

## Outcome

### Completed: 2025-12-16

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/domUI/location/buildDarknessPayload.js` | 38 | Helper function to build payload for dark locations |
| `src/domUI/location/presenceMessageBuilder.js` | 33 | Helper to generate three-tier presence messages |
| `tests/unit/domUI/location/buildDarknessPayload.test.js` | 179 | Unit tests for darkness payload builder (17 tests) |
| `tests/unit/domUI/location/presenceMessageBuilder.test.js` | 91 | Unit tests for presence message builder (11 tests) |
| `tests/integration/locations/darknessRendering.integration.test.js` | ~180 | Integration tests for darkness UI rendering (11 tests) |

### Files Modified

| File | Change Summary |
|------|----------------|
| `src/domUI/locationRenderer.js` | Added `lightingStateService` dependency, `#buildDarknessPayload` method, modified `#buildDisplayPayload` to check lighting state, updated `renderDescription` to handle darkness mode |
| `src/domUI/location/buildLocationDisplayPayload.js` | Added `isDark` and `otherActorCount` optional fields to `LocationDisplayPayload` typedef |
| `src/dependencyInjection/registrations/uiRegistrations.js` | Added resolution of `ILightingStateService` and injection into `LocationRenderer` factory |
| `tests/unit/domUI/locationRenderer.test.js` | Added 9 new tests for darkness handling (59 total tests, all passing) |

### Test Results

- **buildDarknessPayload.test.js**: 17 tests ✅
- **presenceMessageBuilder.test.js**: 11 tests ✅
- **locationRenderer.test.js**: 59 tests ✅ (9 new darkness tests)
- **darknessRendering.integration.test.js**: 11 tests ✅

**Total: 98 tests passing**

### Technical Notes

1. **DI Token**: Used existing `ILightingStateService` token (already registered in `infrastructureRegistrations.js`)
2. **Component Access**: Dark description retrieved via `entityManager.getComponentData(locationId, 'locations:description_in_darkness')`
3. **Character Count**: Uses `locationDataService.gatherLocationCharacters()` for consistent counting
4. **Backward Compatibility**: All existing tests continue to pass; lit locations render identically to before

### Deviations from Plan

1. **No CSS changes**: As specified, no CSS styling was added (can be done separately)
2. **Exact implementation matched plan**: All helper functions and modifications followed the planned structure
