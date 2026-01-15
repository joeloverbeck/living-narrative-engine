# INHCONAXIANDSELCONTRA-003: UI Updates - Update emotionalStatePanel Constants

**STATUS: COMPLETED**

## Summary

Update the `emotionalStatePanel.js` UI constants to include `inhibitory_control` axis colors, labels, and display order. This enables the in-game emotional state panel to render the new regulatory axis.

## Priority: Medium | Effort: Low

## Dependencies

- **Requires**: INHCONAXIANDSELCONTRA-001 (schema updates must be complete first)

## Rationale

The emotional state panel displays mood axis sliders for the current actor. Without updating the UI constants, the `inhibitory_control` axis will:
- Not have associated display colors
- Not have a human-readable label
- Not appear in the correct position in the panel

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/emotionalStatePanel.js` | **Modify** - Update `AXIS_COLORS`, `AXIS_LABELS`, `AXIS_ORDER` constants |
| `tests/unit/domUI/emotionalStatePanel.test.js` | **Modify** - Update existing assertions and test helper |

## Out of Scope

- **DO NOT** modify component schemas - that's INHCONAXIANDSELCONTRA-001
- **DO NOT** modify Monte Carlo code - that's INHCONAXIANDSELCONTRA-002
- **DO NOT** modify LLM prompts - that's INHCONAXIANDSELCONTRA-004
- **DO NOT** modify entity definitions - that's INHCONAXIANDSELCONTRA-005
- **DO NOT** modify ExpressionsSimulatorController.js (it reads from schema dynamically)

## Implementation Details

### Modify: src/domUI/emotionalStatePanel.js

#### Update AXIS_COLORS constant

**CORRECTED**: The actual structure uses `{ negative: ..., positive: ... }` format (negative first), not `{ positive: ..., negative: ... }`.

Add `inhibitory_control` to the `AXIS_COLORS` object:

```javascript
inhibitory_control: { negative: '#FF7043', positive: '#7E57C2' }, // orange for impulsive, purple for restrained
```

**Color Rationale:**
- **Positive (restrained)**: `#7E57C2` - Deep purple suggesting control, discipline, composure
- **Negative (impulsive)**: `#FF7043` - Deep orange suggesting heat, impulse, release

#### Update AXIS_LABELS constant

**CORRECTED**: The actual structure uses `{ negative: string, positive: string }` pairs for each axis, not simple string values.

Actual structure:
```javascript
const AXIS_LABELS = {
  valence: { negative: 'Unpleasant', positive: 'Pleasant' },
  arousal: { negative: 'Depleted', positive: 'Energized' },
  // etc.
};
```

Add `inhibitory_control` to the `AXIS_LABELS` object:

```javascript
inhibitory_control: { negative: 'Impulsive', positive: 'Restrained' },
```

#### Update AXIS_ORDER constant

Add `'inhibitory_control'` to the end of the `AXIS_ORDER` array:

```javascript
const AXIS_ORDER = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',  // NEW - displayed last in the panel
];
```

### Update Tests (Required to Maintain Existing Coverage)

**Note:** Existing tests have hardcoded assertions (axis count = 8, last axis = 'affiliation') that will fail without updates. This is maintenance of existing tests, not new test coverage.

Changes required:
1. `createDefaultMoodData()` helper: add `inhibitory_control: 0`
2. Update `expect(axes.length).toBe(8)` → `expect(axes.length).toBe(9)` (2 locations)
3. Update last-axis assertion from `'affiliation'` to `'inhibitory_control'`
4. Add minimal tests for new axis labels and colors (following existing patterns)

## Acceptance Criteria

### Specific Tests That Must Pass

1. **emotionalStatePanel tests pass:**
   ```bash
   npm run test:unit -- --testPathPattern="emotionalStatePanel" --verbose
   ```

2. **All domUI tests pass:**
   ```bash
   npm run test:unit -- --testPathPattern="domUI" --verbose
   ```

3. **Type checking passes:**
   ```bash
   npm run typecheck
   ```

4. **Manual verification** (visual inspection):
   - Load game.html with a character
   - Verify EMOTIONAL STATE panel shows 9 sliders
   - Verify "Inhib. Control" slider appears at the bottom
   - Verify slider uses purple/orange gradient colors
   - Verify slider responds to mood changes

### Invariants That Must Remain True

1. **Object Property Order**: Add new property at end of objects (convention only, JS objects don't guarantee order)
2. **Array Order**: `inhibitory_control` appended to end of `AXIS_ORDER` array
3. **Label Length**: Label should be short enough to fit UI (use abbreviation "Inhib. Control")
4. **Color Distinctiveness**: Colors should be visually distinct from existing axes
5. **Backward Compatibility**: Entities without `inhibitory_control` should still render (use default 0)

## Verification Commands

```bash
# Run emotionalStatePanel tests
npm run test:unit -- --testPathPattern="emotionalStatePanel" --verbose

# Run all domUI tests
npm run test:unit -- --testPathPattern="domUI" --verbose

# Type check
npm run typecheck

# Lint modified file
npx eslint src/domUI/emotionalStatePanel.js

# Start dev server for manual testing
npm run dev
```

## Manual Verification Checklist

- [ ] Open game.html in browser
- [ ] Load a game with a character that has a mood component
- [ ] EMOTIONAL STATE panel displays 9 axis sliders
- [ ] "Inhib. Control" label is visible and readable
- [ ] Purple color appears for positive values (restraint)
- [ ] Orange color appears for negative values (impulsivity)
- [ ] Slider at 0 shows neutral/baseline state
- [ ] No console errors related to missing axis colors or labels

## Definition of Done

- [x] `AXIS_COLORS.inhibitory_control` defined with positive (#7E57C2) and negative (#FF7043) colors
- [x] `AXIS_LABELS.inhibitory_control` defined with `{ negative: 'Impulsive', positive: 'Restrained' }`
- [x] `AXIS_ORDER` array includes `'inhibitory_control'` as 9th element
- [x] All existing tests pass (with necessary maintenance updates)
- [x] Type checking passes
- [x] Linting passes (no new errors)
- [ ] Manual visual verification (pending user testing)

## Outcome

### Originally Planned vs Actually Changed

**Ticket Corrections Required:**
The original ticket contained incorrect assumptions about code structure:
1. `AXIS_LABELS` was documented as simple strings (`'Valence'`), but actual structure uses bidirectional pairs (`{ negative: 'Unpleasant', positive: 'Pleasant' }`)
2. `AXIS_COLORS` key order was shown as `{ positive, negative }` but actual is `{ negative, positive }`
3. Ticket stated "DO NOT write tests" but existing tests had hardcoded assertions that would fail

**Files Modified:**

| File | Changes |
|------|---------|
| `src/domUI/emotionalStatePanel.js` | Added `inhibitory_control` to `AXIS_COLORS`, `AXIS_LABELS`, `AXIS_ORDER`; updated comments from "8 axes" to "9 axes" |
| `tests/unit/domUI/emotionalStatePanel.test.js` | Updated `createDefaultMoodData()` helper; changed axis count from 8→9; added 4 new tests for inhibitory_control |
| `tickets/INHCONAXIANDSELCONTRA-003-ui-updates.md` | Corrected assumptions, marked complete |

**Test Changes Summary:**

| Test Change | Rationale |
|-------------|-----------|
| `createDefaultMoodData()` added `inhibitory_control: 0` | Helper must return valid mood data for all 9 axes |
| Axis count assertions 8→9 (2 locations) | Panel now renders 9 axes |
| Affiliation position test updated to index 7 | Affiliation is now 8th (index 7), not last |
| NEW: inhibitory_control label rendering test | Validates "Impulsive" / "Restrained" labels |
| NEW: inhibitory_control positive color test | Validates purple (#7E57C2) for restrained |
| NEW: inhibitory_control negative color test | Validates orange (#FF7043) for impulsive |
| NEW: inhibitory_control position test (9th/last) | Validates new axis appears last in order |

**Verification Results:**
- All 66 emotionalStatePanel tests pass ✅
- All 154 domUI test suites pass (4057 tests) ✅
- Linting: No new errors (only pre-existing warnings) ✅
