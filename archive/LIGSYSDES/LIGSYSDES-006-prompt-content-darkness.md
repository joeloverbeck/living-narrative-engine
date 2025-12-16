# LIGSYSDES-006: Add Darkness Context to AIPromptContentProvider

**Status: ✅ COMPLETED**

## Summary

Modify `AIPromptContentProvider.getWorldContextContent()` to check lighting state and generate appropriate prompt content when a location is in darkness. When dark, the LLM prompt should convey:
- Location name
- Darkness condition indicator
- Sensory description (if available) or generic darkness message
- No exit information
- Three-tier presence sensing instead of character details

## Rationale

The LLM needs to understand the player's perceptual limitations in darkness to generate appropriate character responses. The AI actor should not "know" details about exits or other characters when they cannot see.

## Outcome

### Ticket Discrepancies Found and Corrected

| Original Ticket Assumption | Actual State | Correction Applied |
|---------------------------|--------------|-------------------|
| Create new `PRESENCE_PROMPT_MESSAGES` constants | `presenceMessageBuilder.js` already exists at `src/domUI/location/` with identical `PRESENCE_MESSAGES` and `getPresenceMessage()` | Reused existing helper instead of duplicating code |
| Add `lightingStateService` dependency to AIPromptContentProvider | Contradicts ticket's own architecture notes recommending DTO approach | Removed from scope - used DTO only |
| Modify `aiRegistrations.js` to add lightingStateService | Unnecessary if using DTO approach | Removed from scope |

### Actual Changes Made

**Files Created:**
- `src/prompting/helpers/darknessWorldContextBuilder.js` (~60 lines)
- `tests/unit/prompting/helpers/darknessWorldContextBuilder.test.js` (~215 lines)
- `tests/integration/prompting/darknessPromptGeneration.integration.test.js` (~300 lines)

**Files Modified:**
- `src/turns/dtos/AIGameStateDTO.js` - Added `isLit` and `descriptionInDarkness` to `AILocationSummaryDTO` typedef (+2 lines)
- `src/prompting/AIPromptContentProvider.js` - Added import and darkness handling logic in `getWorldContextContent()` (+15 lines)
- `tests/unit/prompting/AIPromptContentProvider.test.js` - Added darkness handling test suite (+40 lines)

**Files NOT Modified (removed from scope):**
- ~~`src/dependencyInjection/registrations/aiRegistrations.js`~~ - Not needed with DTO approach

### Estimated vs Actual

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Total lines | 350-400 | ~310 |
| New helper | ~70 lines | ~60 lines (reused existing presenceMessageBuilder) |
| aiRegistrations.js changes | ~3 lines | 0 lines (not needed) |

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/prompting/helpers/darknessWorldContextBuilder.js` | Helper to build world context for dark locations |
| `tests/unit/prompting/helpers/darknessWorldContextBuilder.test.js` | Unit tests for the builder |
| `tests/integration/prompting/darknessPromptGeneration.integration.test.js` | Integration tests for darkness prompt generation |

## Files to Modify

| File | Change |
|------|--------|
| `src/prompting/AIPromptContentProvider.js` | Modify `getWorldContextContent` to branch on lighting state from DTO |
| `src/turns/dtos/AIGameStateDTO.js` | Add `isLit` boolean and `descriptionInDarkness` optional string to `AILocationSummaryDTO` |
| `tests/unit/prompting/AIPromptContentProvider.test.js` | Add tests for darkness branch |

## Out of Scope - DO NOT CHANGE

- `LocationRenderer` (handled in LIGSYSDES-005)
- The `LightingStateService` implementation (LIGSYSDES-003)
- Any other prompt generation methods besides `getWorldContextContent`
- The structure of `ActorPromptDataDTO` (actor's own knowledge unaffected)
- Any mod data files
- Any schemas
- `aiRegistrations.js` (DTO approach doesn't require service injection)

## Implementation Details

### 1. Update `AILocationSummaryDTO` typedef

Add to `src/turns/dtos/AIGameStateDTO.js`:

```javascript
/**
 * @typedef {object} AILocationSummaryDTO
 * @property {string} name - The name of the location.
 * @property {string} description - A textual description of the location.
 * @property {AILocationExitDTO[]} exits - An array of available exits.
 * @property {AICharacterInLocationDTO[]} characters - An array of other characters in the location.
 * @property {string[]} [items] - Optional. Summary of notable items. (Future consideration)
 * @property {boolean} [isLit] - Whether the location is lit (undefined means lit for backward compat)
 * @property {string} [descriptionInDarkness] - Optional sensory description for darkness
 */
```

### 2. `darknessWorldContextBuilder.js`

```javascript
// src/prompting/helpers/darknessWorldContextBuilder.js

import { getPresenceMessage } from '../../domUI/location/presenceMessageBuilder.js';

/**
 * Builds world context markdown for a dark location.
 *
 * @param {object} params
 * @param {string} params.locationName - Location name
 * @param {string|null} params.darknessDescription - Custom sensory description or null
 * @param {number} params.characterCount - Number of other characters present
 * @returns {string} Markdown-formatted world context
 */
export function buildDarknessWorldContext({
  locationName,
  darknessDescription,
  characterCount,
}) {
  const segments = [];

  // Main header
  segments.push('## Current Situation');
  segments.push('');

  // Location section
  segments.push('### Location');
  segments.push(locationName);
  segments.push('');

  // Conditions section
  segments.push('### Conditions');
  segments.push('**Pitch darkness.** You cannot see anything.');
  segments.push('');

  // Sensory impressions if available
  if (darknessDescription) {
    segments.push('### Sensory Impressions');
    segments.push(darknessDescription);
    segments.push('');
  }

  // Navigation section - cannot see exits
  segments.push('## Exits from Current Location');
  segments.push('You cannot see any exits in the darkness.');
  segments.push('');

  // Other presences section - reuses existing presenceMessageBuilder
  segments.push('## Other Presences');
  segments.push(getPresenceMessage(characterCount));

  return segments.join('\n');
}
```

### 3. Modifications to `AIPromptContentProvider.js`

**Import addition:**
```javascript
import { buildDarknessWorldContext } from './helpers/darknessWorldContextBuilder.js';
```

**`getWorldContextContent` modification:**

```javascript
getWorldContextContent(gameState) {
  const { currentLocation } = gameState;

  if (!currentLocation) {
    return PROMPT_FALLBACK_UNKNOWN_LOCATION;
  }

  // Check if location is lit
  // If isLit is undefined, treat as lit (backward compatibility)
  const isLit = currentLocation.isLit !== false;

  if (!isLit) {
    this.#logger.debug(
      'AIPromptContentProvider: Location is in darkness, using darkness world context builder.'
    );
    return buildDarknessWorldContext({
      locationName: currentLocation.name || DEFAULT_FALLBACK_LOCATION_NAME,
      darknessDescription: currentLocation.descriptionInDarkness || null,
      characterCount: currentLocation.characters?.length || 0,
    });
  }

  // Existing lit location logic follows...
  // ... rest of existing code
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit tests for `darknessWorldContextBuilder.js`:**
   - Test: Returns correct markdown structure ✅
   - Test: Includes location name ✅
   - Test: Includes "Pitch darkness" condition ✅
   - Test: Includes custom darkness description when provided ✅
   - Test: Omits sensory section when no description ✅
   - Test: Returns NONE presence message for 0 characters ✅
   - Test: Returns ONE presence message for 1 character ✅
   - Test: Returns FEW presence message for 2-3 characters ✅
   - Test: Returns SEVERAL presence message for 4+ characters ✅
   - Test: Says "cannot see any exits" ✅

2. **Unit tests for `AIPromptContentProvider` darkness handling:**
   - Test: Uses darkness builder when `currentLocation.isLit === false` ✅
   - Test: Uses standard builder when `currentLocation.isLit === true` ✅
   - Test: Uses standard builder when `currentLocation.isLit` is undefined (backward compat) ✅
   - Test: Passes correct character count to darkness builder ✅

3. **Integration test:**
   - Test: Complete prompt generation for dark location ✅
   - Test: Verify no character details leak into darkness prompt ✅
   - Test: Verify no exit information in darkness prompt ✅
   - Test: Verify presence message is included ✅

4. **Existing tests:**
   ```bash
   npm run test:unit -- tests/unit/prompting/
   npm run test:integration -- tests/integration/prompting/
   ```
   All existing tests continue to pass. ✅ (559 tests passing)

### Invariants That Must Remain True

1. **Backward compatibility**: Prompts for lit locations must be identical to previous behavior ✅
2. **No character information leak**: Character names/descriptions must NOT appear in darkness context ✅
3. **No exit information leak**: Exit directions/targets must NOT appear in darkness context ✅
4. **Actor knowledge unaffected**: The actor's own data (`actorPromptData`) is not filtered ✅
5. **Consistent message format**: Presence messages match those used in UI (LIGSYSDES-005) ✅

### Manual Verification

1. `npm run typecheck` passes ✅ (pre-existing errors in unrelated files)
2. `npm run test:unit -- tests/unit/prompting/` passes ✅
3. `npm run test:integration -- tests/integration/prompting/` passes ✅

## Dependencies

- LIGSYSDES-003 (LightingStateService - though this ticket uses DTO data, not the service directly)
- LIGSYSDES-004 (DI registration)

## Blocked By

- LIGSYSDES-004

## Blocks

- None directly (but should complete before LIGSYSDES-007 for full integration testing)

## Notes on Architecture

The prompt provider receives lighting state via the DTO (`currentLocation.isLit`) rather than querying `LightingStateService` directly. This is because:
1. The DTO is populated by the game state gathering component, which already has access to the service
2. This keeps the prompt provider decoupled from entity management
3. The DTO serves as the contract between game state and prompt generation

**Key Design Decision**: Reused existing `presenceMessageBuilder.js` from `src/domUI/location/` instead of duplicating the presence message constants and logic. This ensures consistency between the UI layer (LIGSYSDES-005) and the prompt layer.
