# TEMORIAXI-004: UI Layer - Add temporal_orientation to EmotionalStatePanel

**Status: ✅ COMPLETED**

## Summary

Add `temporal_orientation` to the EmotionalStatePanel UI component so it displays in the game's emotional state panel with proper colors, labels, and ordering.

## Priority: High | Effort: Low

## Rationale

The EmotionalStatePanel renders mood axes as visual bars. Without this update, the new axis won't be displayed to users in the game UI.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/emotionalStatePanel.js` | **Modify** - Add temporal_orientation to colors, labels, and order arrays |
| `tests/unit/domUI/emotionalStatePanel.test.js` | **Modify** - Update test helper and assertions for 11 axes |

## Out of Scope

- **DO NOT** modify `data/mods/core/components/mood.component.json` - that's TEMORIAXI-001
- **DO NOT** modify `src/constants/moodAffectConstants.js` - that's TEMORIAXI-002
- **DO NOT** modify `src/turns/schemas/llmOutputSchemas.js` - that's TEMORIAXI-003
- **DO NOT** modify `data/prompts/corePromptText.json` - that's TEMORIAXI-005
- **DO NOT** modify CSS files (the existing CSS should handle 11 bars)
- **DO NOT** modify any other UI components

## In Scope (Updated)

- **UPDATE** `tests/unit/domUI/emotionalStatePanel.test.js` - Tests must be updated to reflect 11 axes:
  - Update `createDefaultMoodData()` helper to include `temporal_orientation: 0`
  - Update tests that assert exactly 10 axes to assert 11 axes
  - Add tests for `temporal_orientation` axis labels, colors, and position
  - This is required because the UI changes would break existing tests

## Implementation Details

### Modify: src/domUI/emotionalStatePanel.js

#### Change 1: Update JSDoc comment (lines 3-9)
```javascript
// BEFORE:
/**
 * @file Widget displaying character's current emotional state as 10 mood axes.
 *
 * Subscribes to TURN_STARTED_ID to refresh the current actor's emotional state.
 ...

// AFTER:
/**
 * @file Widget displaying character's current emotional state as 11 mood axes.
 *
 * Subscribes to TURN_STARTED_ID to refresh the current actor's emotional state.
 ...
```

#### Change 2: Add to AXIS_COLORS constant (around line 32-43)
Insert after `future_expectancy` entry:
```javascript
// BEFORE:
const AXIS_COLORS = {
  valence: { negative: '#dc3545', positive: '#28a745' },
  arousal: { negative: '#6c757d', positive: '#ffc107' },
  agency_control: { negative: '#17a2b8', positive: '#0d6efd' },
  threat: { negative: '#28a745', positive: '#dc3545' },
  engagement: { negative: '#adb5bd', positive: '#0dcaf0' },
  future_expectancy: { negative: '#6f42c1', positive: '#20c997' },
  self_evaluation: { negative: '#fd7e14', positive: '#6610f2' },
  affiliation: { negative: '#4e73df', positive: '#e83e8c' },
  inhibitory_control: { negative: '#FF7043', positive: '#7E57C2' },
  uncertainty: { negative: '#4FC3F7', positive: '#7B1FA2' },
};

// AFTER:
const AXIS_COLORS = {
  valence: { negative: '#dc3545', positive: '#28a745' },
  arousal: { negative: '#6c757d', positive: '#ffc107' },
  agency_control: { negative: '#17a2b8', positive: '#0d6efd' },
  threat: { negative: '#28a745', positive: '#dc3545' },
  engagement: { negative: '#adb5bd', positive: '#0dcaf0' },
  future_expectancy: { negative: '#6f42c1', positive: '#20c997' },
  temporal_orientation: { negative: '#8B4513', positive: '#00CED1' },
  self_evaluation: { negative: '#fd7e14', positive: '#6610f2' },
  affiliation: { negative: '#4e73df', positive: '#e83e8c' },
  inhibitory_control: { negative: '#FF7043', positive: '#7E57C2' },
  uncertainty: { negative: '#4FC3F7', positive: '#7B1FA2' },
};
```

**Color rationale:**
- **Negative (past-focused)**: Sepia brown `#8B4513` - evokes old photographs, memories, warmth of the past
- **Positive (future-focused)**: Dark cyan/teal `#00CED1` - evokes forward movement, possibility, technology

#### Change 3: Add to AXIS_LABELS constant (around line 50-61)
Insert after `future_expectancy` entry:
```javascript
// BEFORE:
const AXIS_LABELS = {
  valence: { negative: 'Unpleasant', positive: 'Pleasant' },
  arousal: { negative: 'Depleted', positive: 'Energized' },
  agency_control: { negative: 'Helpless', positive: 'In Control' },
  threat: { negative: 'Safe', positive: 'Endangered' },
  engagement: { negative: 'Indifferent', positive: 'Absorbed' },
  future_expectancy: { negative: 'Hopeless', positive: 'Hopeful' },
  self_evaluation: { negative: 'Shame', positive: 'Pride' },
  affiliation: { negative: 'Detached', positive: 'Connected' },
  inhibitory_control: { negative: 'Impulsive', positive: 'Restrained' },
  uncertainty: { negative: 'Certain', positive: 'Uncertain' },
};

// AFTER:
const AXIS_LABELS = {
  valence: { negative: 'Unpleasant', positive: 'Pleasant' },
  arousal: { negative: 'Depleted', positive: 'Energized' },
  agency_control: { negative: 'Helpless', positive: 'In Control' },
  threat: { negative: 'Safe', positive: 'Endangered' },
  engagement: { negative: 'Indifferent', positive: 'Absorbed' },
  future_expectancy: { negative: 'Hopeless', positive: 'Hopeful' },
  temporal_orientation: { negative: 'Past-focused', positive: 'Future-focused' },
  self_evaluation: { negative: 'Shame', positive: 'Pride' },
  affiliation: { negative: 'Detached', positive: 'Connected' },
  inhibitory_control: { negative: 'Impulsive', positive: 'Restrained' },
  uncertainty: { negative: 'Certain', positive: 'Uncertain' },
};
```

#### Change 4: Add to AXIS_ORDER array (around line 68-79)
Insert `'temporal_orientation'` after `'future_expectancy'`:
```javascript
// BEFORE:
const AXIS_ORDER = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
];

// AFTER:
const AXIS_ORDER = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'temporal_orientation',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
];
```

#### Change 5: Update class JSDoc comment (around line 82-89)
```javascript
// BEFORE:
/**
 * Widget displaying character's current emotional state as 10 mood axis bars.
 *
 * Displays:
 * - 10 horizontal bars representing mood axes
 ...

// AFTER:
/**
 * Widget displaying character's current emotional state as 11 mood axis bars.
 *
 * Displays:
 * - 11 horizontal bars representing mood axes
 ...
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run typecheck` passes
- `npx eslint src/domUI/emotionalStatePanel.js` passes
- `npm run build` completes without errors

### Invariants That Must Remain True
- All three constants (AXIS_COLORS, AXIS_LABELS, AXIS_ORDER) have exactly 11 entries
- All three constants have `temporal_orientation` at the same relative position (after future_expectancy)
- Existing axis colors and labels are unchanged
- The panel rendering logic doesn't require changes (it iterates AXIS_ORDER)
- The CSS flexbox layout should handle 11 bars automatically

### Verification Commands
```bash
npm run typecheck
npx eslint src/domUI/emotionalStatePanel.js
npm run build
```

## Dependencies

- **TEMORIAXI-001** must be completed first (schema foundation)
- **TEMORIAXI-002** must be completed first (code constants)
- **TEMORIAXI-003** should be completed (LLM schemas)

## Notes

- The color choice follows the spec's rationale: sepia for past (memories/photographs), teal for future (technology/possibility)
- Labels "Past-focused" and "Future-focused" are clear and match spec
- Position after future_expectancy groups temporal-related axes together
- No CSS changes needed - the existing flexbox layout should accommodate 11 bars

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made Before Implementation:**
- The original ticket marked tests as "Out of Scope" but this was incorrect - tests assert exactly 10 axes and specific axis positions, so they would break without updates
- Added "In Scope (Updated)" section to include test file modifications
- Updated "Files to Touch" table to include `tests/unit/domUI/emotionalStatePanel.test.js`

**Implementation Changes (as planned):**

1. **`src/domUI/emotionalStatePanel.js`** - All 5 planned changes implemented:
   - Updated file-level JSDoc from "10 mood axes" to "11 mood axes"
   - Added `temporal_orientation` to `AXIS_COLORS` with sepia (#8B4513) / teal (#00CED1)
   - Added `temporal_orientation` to `AXIS_LABELS` with "Past-focused" / "Future-focused"
   - Added `temporal_orientation` to `AXIS_ORDER` at position 7 (after future_expectancy)
   - Updated class-level JSDoc from "10 mood axis bars" to "11 mood axis bars"

2. **`tests/unit/domUI/emotionalStatePanel.test.js`** - Required updates made:
   - Added `temporal_orientation: 0` to `createDefaultMoodData()` helper
   - Updated axis count tests from 10 to 11
   - Updated position tests for affiliation (8th→9th), inhibitory_control (9th→10th), uncertainty (10th→11th)
   - Added 4 new tests for temporal_orientation: labels, positive color, negative color, position (7th)

**Verification:**
- All unit tests pass (`npm run test:unit -- --testPathPatterns="emotionalStatePanel"`)
- ESLint passes (only pre-existing warnings, no new errors)
- Typecheck passes (only pre-existing errors in unrelated files)

**Deviation Summary:**
- The only deviation from the original ticket was adding tests to scope, which was necessary to prevent test failures. All implementation details matched the specification exactly.
