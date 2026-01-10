# AFFTRAANDAFFAXI-012: Update Expressions Simulator UI

## Status: COMPLETED

## Summary

Add affect traits **input sliders** to the expressions simulator UI to enable testing trait-gated emotions (e.g., low-empathy sociopath scenario). This follows the existing pattern used for mood axes and sexual state inputs.

## Priority: Low | Effort: Low

## Rationale

The expressions simulator is a tool for modders to test how expressions trigger under different conditions. To properly test trait-gated emotions (compassion, guilt, empathic_distress), modders need to adjust trait values via input sliders. The UI should render affect trait sliders using the same `#renderComponentInputs()` pattern as mood and sexual state, and pass trait values to the emotion calculator.

## Assumptions Corrected During Implementation

| Original Assumption | Actual State | Correction |
|---------------------|--------------|------------|
| "Display trait values in witness state panel" | ExpressionsSimulator uses INPUT sliders, not display-only values | Changed to INPUT sliders using `#renderComponentInputs()` |
| References `#displayWitnessState` method | Method doesn't exist in this controller | Follow existing `#renderComponentInputs` pattern |
| References `toClipboardJSON()` clipboard feature | Clipboard is in ExpressionDiagnosticsController (ticket 013) | Removed clipboard references |
| Missing: affiliation mood axis handling | Affiliation already in `core:mood` schema and auto-rendered | No action needed - already works |

## Files to Touch

| File | Change Type |
|------|-------------|
| `expressions-simulator.html` | **Modify** - Add affect traits input section |
| `css/expressions-simulator.css` | **Modify** - Add panel note style |
| `src/domUI/expressions-simulator/ExpressionsSimulatorController.js` | **Modify** - Bind, initialize, render, and use affect traits |

## Out of Scope

- **DO NOT** modify WitnessState model - that's AFFTRAANDAFFAXI-009
- **DO NOT** modify MonteCarloSimulator - that's AFFTRAANDAFFAXI-010
- **DO NOT** modify WitnessStateFinder - that's AFFTRAANDAFFAXI-011
- **DO NOT** modify ExpressionDiagnosticsController - that's AFFTRAANDAFFAXI-013
- **DO NOT** modify backend emotion calculation - already supports affectTraits as 4th parameter

## Implementation Details

### 1. Add HTML for Trait Inputs (expressions-simulator.html)

Add after the sexual state section (line 48), inside `<div class="es-input-column">`:

```html
<section class="es-panel" aria-labelledby="es-traits-title">
  <h3 id="es-traits-title">Affect Traits</h3>
  <div id="es-traits-inputs" class="es-input-list"></div>
  <p class="es-panel-note">
    Stable personality traits (rarely change). Used to gate empathy-based emotions.
  </p>
</section>
```

### 2. Add CSS for Panel Note (css/expressions-simulator.css)

```css
.es-panel-note {
  font-size: 0.85rem;
  color: var(--text-muted, #888);
  margin-top: 0.5rem;
}
```

### 3. Update Controller (ExpressionsSimulatorController.js)

**3a. Update `#bindDom()` - add element reference:**
```javascript
traitsInputs: this.#containerElement.querySelector('#es-traits-inputs'),
```

**3b. Update `#initializeState()` - add affect traits state:**
```javascript
const traitsSchema = this.#getComponentSchema('core:affect_traits');
this.#state = {
  currentMood: this.#buildDefaultState(moodSchema),
  currentSexualState: this.#buildDefaultState(sexualSchema),
  currentAffectTraits: this.#buildDefaultState(traitsSchema),  // NEW
  // ... rest unchanged
};
```

**3c. Update `#renderInputs()` - add third render call:**
```javascript
this.#renderComponentInputs({
  componentId: 'core:affect_traits',
  targetElement: this.#elements?.traitsInputs,
  stateKey: 'currentAffectTraits',
});
```

**3d. Update `#updateDerivedOutputs()` - pass affect traits to calculation:**
```javascript
const affectTraitsData = this.#state?.currentAffectTraits || {};
const emotions = this.#emotionCalculatorService.calculateEmotions(
  moodData,
  null,
  sexualStateData,
  affectTraitsData  // NEW 4th parameter
);
```

## Acceptance Criteria

### Tests That Must Pass

1. **Existing simulator tests pass**:
   ```bash
   npm run test:unit -- --testPathPattern="expressions-simulator" --verbose
   ```

2. **TypeScript type checking passes**:
   ```bash
   npm run typecheck
   ```

3. **ESLint passes on modified files**:
   ```bash
   npx eslint src/domUI/expressions-simulator/ExpressionsSimulatorController.js
   ```

### Manual Verification

1. Open `expressions-simulator.html` in browser
2. Verify "Affect Traits" section appears with 3 sliders (affective_empathy, cognitive_empathy, harm_aversion)
3. Set affective_empathy to 5 (very low)
4. Verify compassion emotion drops to 0 or near-0 (gate blocks it)
5. Set affective_empathy back to 50
6. Verify compassion returns to normal calculation

### Invariants That Must Remain True

1. **UI layout intact**: New section fits naturally in existing layout
2. **Default values**: All traits default to 50 (average human)
3. **Responsive**: Works on different screen sizes
4. **Existing functionality**: Mood and sexual state inputs still work

## Verification Commands

```bash
# Run existing tests
npm run test:unit -- --testPathPattern="expressions-simulator" --verbose

# Type check
npm run typecheck

# Lint
npx eslint src/domUI/expressions-simulator/ExpressionsSimulatorController.js

# Build and serve (manual verification)
npm run build
npm run start
```

## Definition of Done

- [x] Ticket assumptions corrected
- [x] HTML section added for affect traits inputs
- [x] CSS styling for panel note added
- [x] Controller binds to traits input element
- [x] Controller initializes affect traits state
- [x] Controller renders affect traits inputs
- [x] Controller passes affect traits to emotion calculation
- [x] All existing tests pass
- [x] `npm run typecheck` passes
- [x] `npx eslint` passes on modified files

## Outcome

### What Was Originally Planned
The original ticket assumed a display-only approach using non-existent methods (`#displayWitnessState`, `toClipboardJSON()`).

### What Was Actually Changed
1. **Ticket corrected first** - Updated assumptions table documenting 4 discrepancies
2. **HTML** - Added affect traits input section using existing pattern
3. **CSS** - Added `.es-panel-note` style using CSS variables
4. **Controller** - 4 targeted changes:
   - `#bindDom()`: Added `traitsInputs` element binding + warning
   - `#initializeState()`: Added `currentAffectTraits` state
   - `#renderInputs()`: Added third `#renderComponentInputs()` call
   - `#updateDerivedOutputs()`: Pass affect traits as 4th param to `calculateEmotions()`

### Tests
- **Existing tests pass**: 2 expressions-simulator tests, 128 emotionCalculatorService tests
- **No new tests required**: Changes follow existing patterns exactly, and affect traits calculation is already covered by emotionCalculatorService tests

### Affiliation Mood Axis
The affiliation axis (added in tickets 009-011) is automatically rendered via the existing `#renderComponentInputs()` pattern that reads from the `core:mood` schema - no additional changes needed.
