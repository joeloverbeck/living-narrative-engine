# INHCONAXIANDSELCONTRA-007: Unit Tests - emotionalStatePanel Constants

## Summary

Update existing unit tests for `emotionalStatePanel.js` to verify that the new `inhibitory_control` mood axis is properly included in UI constants and renders correctly.

## Priority: Medium | Effort: Low

## Dependencies

- **Requires**: INHCONAXIANDSELCONTRA-001 (schema updates)
- **Requires**: INHCONAXIANDSELCONTRA-003 (UI updates)

## Rationale

The existing tests verify mood axis rendering using hardcoded counts and assertions. With the addition of `inhibitory_control`, we need to:
1. Update `createDefaultMoodData()` test helper to include the new axis
2. Update axis count assertions (8 → 9)
3. Add explicit tests that verify the new axis colors, label, and order

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/domUI/emotionalStatePanel.test.js` | **Modify** - Update helper function and axis count assertions |

## Out of Scope

- **DO NOT** modify source code - that's INHCONAXIANDSELCONTRA-003
- **DO NOT** create integration tests - that's INHCONAXIANDSELCONTRA-008
- **DO NOT** modify Monte Carlo tests - that's INHCONAXIANDSELCONTRA-006
- **DO NOT** modify any other test files

## Implementation Details

### Modify: tests/unit/domUI/emotionalStatePanel.test.js

#### Update createDefaultMoodData() helper function

The helper at approximately line 73-82 creates mock mood data. Add `inhibitory_control`:

```javascript
const createDefaultMoodData = () => ({
  valence: 0,
  arousal: 0,
  agency_control: 0,
  threat: 0,
  engagement: 0,
  future_expectancy: 0,
  self_evaluation: 0,
  affiliation: 0,
  inhibitory_control: 0,  // NEW - 9th axis
});
```

#### Update axis count assertion in "renders all mood axes"

Find the test at approximately line 461:
```javascript
it('renders all 8 mood axes', () => {
```

Change to:
```javascript
it('renders all 9 mood axes', () => {
```

And update the expectation:
```javascript
expect(container.querySelectorAll('.mood-axis').length).toBe(9);  // Updated from 8
```

#### Update position test for inhibitory_control

Add new test case to verify position (after "affiliation axis in correct position" test around line 777):

```javascript
it('inhibitory_control axis in correct position (9th)', () => {
  const moodData = createDefaultMoodData();
  emotionalStatePanel.render(moodData, mockSexualState);

  const axisContainers = container.querySelectorAll('.mood-axis');
  expect(axisContainers.length).toBe(9);

  const ninthAxis = axisContainers[8];
  expect(ninthAxis.querySelector('.axis-label').textContent).toBe('Inhib. Control');
});
```

#### Add explicit test for inhibitory_control colors

Add new test in the "Mood Axis Rendering" describe block:

```javascript
it('should render inhibitory_control with correct colors', () => {
  const moodData = createDefaultMoodData();
  moodData.inhibitory_control = 50;  // Positive value
  emotionalStatePanel.render(moodData, mockSexualState);

  const inhibControlAxis = container.querySelector('[data-axis="inhibitory_control"]');
  expect(inhibControlAxis).toBeTruthy();

  // Verify positive color is purple (#7E57C2)
  const positiveBar = inhibControlAxis.querySelector('.positive-bar');
  expect(positiveBar.style.backgroundColor).toMatch(/rgb\(126,\s*87,\s*194\)|#7[eE]57[cC]2/i);
});

it('should render inhibitory_control negative with correct color', () => {
  const moodData = createDefaultMoodData();
  moodData.inhibitory_control = -50;  // Negative value
  emotionalStatePanel.render(moodData, mockSexualState);

  const inhibControlAxis = container.querySelector('[data-axis="inhibitory_control"]');
  expect(inhibControlAxis).toBeTruthy();

  // Verify negative color is orange (#FF7043)
  const negativeBar = inhibControlAxis.querySelector('.negative-bar');
  expect(negativeBar.style.backgroundColor).toMatch(/rgb\(255,\s*112,\s*67\)|#[fF]{2}7043/i);
});
```

#### Add explicit test for inhibitory_control label

Add new test:

```javascript
it('should display correct label for inhibitory_control axis', () => {
  const moodData = createDefaultMoodData();
  emotionalStatePanel.render(moodData, mockSexualState);

  const inhibControlAxis = container.querySelector('[data-axis="inhibitory_control"]');
  expect(inhibControlAxis).toBeTruthy();

  const label = inhibControlAxis.querySelector('.axis-label');
  expect(label.textContent).toBe('Inhib. Control');
});
```

#### Update any hardcoded axis iteration tests

Search for any loops or iterations that expect 8 axes and update to 9:
- Tests checking `Object.keys(AXIS_COLORS).length`
- Tests checking `AXIS_ORDER.length`
- Any forEach loops with assertions about axis count

## Acceptance Criteria

### Specific Tests That Must Pass

1. **emotionalStatePanel tests pass:**
   ```bash
   npm run test:unit -- tests/unit/domUI/emotionalStatePanel.test.js --verbose
   ```

2. **All domUI tests pass:**
   ```bash
   npm run test:unit -- --testPathPattern="domUI" --verbose
   ```

### Invariants That Must Remain True

1. **Existing Test Coverage**: All existing assertions continue to pass
2. **Axis Count**: Panel now renders 9 axes (was 8)
3. **Axis Order**: `inhibitory_control` renders as 9th axis (last position)
4. **Color Verification**: Purple (#7E57C2) for positive, Orange (#FF7043) for negative
5. **Label Format**: Label displays as "Inhib. Control" (abbreviated)
6. **No Source Modifications**: Tests verify behavior, don't change source code

## Verification Commands

```bash
# Run specific test file
npm run test:unit -- tests/unit/domUI/emotionalStatePanel.test.js --verbose

# Run all domUI tests
npm run test:unit -- --testPathPattern="domUI" --verbose

# Lint test file
npx eslint tests/unit/domUI/emotionalStatePanel.test.js
```

## Definition of Done

- [x] `createDefaultMoodData()` helper includes `inhibitory_control: 0`
- [x] "renders all X mood axes" test updated from 8 to 9
- [x] Position test added verifying `inhibitory_control` is 9th
- [x] Color tests added for positive (purple) and negative (orange) values
- [x] Label test added verifying "Inhib. Control" display
- [x] All hardcoded axis counts updated from 8 to 9
- [x] All existing tests pass
- [x] Linting passes

## Completion Notes

**Status: COMPLETED** (2026-01-15)

All work described in this ticket was found to be already implemented when reviewed. The tests and source code already include full support for the `inhibitory_control` mood axis. This work was likely completed as part of INHCONAXIANDSELCONTRA-003 (UI updates).

## Outcome

### What Was Originally Planned
- Update `createDefaultMoodData()` helper to include `inhibitory_control`
- Update axis count from 8 to 9 in tests
- Add position, color, and label tests for `inhibitory_control`

### What Actually Changed
**No code changes required** - all functionality was already present:
- `createDefaultMoodData()` already includes `inhibitory_control: 0` (line 82)
- Test already says "renders all 9 mood axes" (line 462)
- Position test exists at lines 830-842
- Color tests exist at lines 800-827
- Label tests exist at lines 782-798

### Verification
All 64 tests in `tests/unit/domUI/emotionalStatePanel.test.js` pass with the following relevant tests confirming `inhibitory_control` coverage:
- `renders all 9 mood axes` ✓
- `renders inhibitory_control axis with correct labels` ✓
- `renders inhibitory_control positive value with correct color` ✓
- `renders inhibitory_control negative value with correct color` ✓
- `renders inhibitory_control axis in correct position (9th/last)` ✓
