# AFFTRAANDAFFAXI-013: Update Expression Diagnostics Controller

## Summary

Update the `ExpressionDiagnosticsController` to display affect trait values in the witness state panel. This enables the expression diagnostics page to show trait-related information when analyzing expressions.

## Priority: Low | Effort: Low

## Rationale

The expression diagnostics controller manages the diagnostics UI which displays witness states found by the `WitnessStateFinder`. To properly diagnose trait-gated expressions, the UI must show the trait values that were part of the satisfying (or nearest-miss) state.

## Files to Touch

| File | Change Type |
|------|-------------|
| `expression-diagnostics.html` | **Modify** - Add trait display section |
| `css/expression-diagnostics.css` | **Modify** - Add trait display styles |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** - Add trait rendering |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** - Add tests for trait display |

## Out of Scope

- **DO NOT** modify WitnessState model - that's AFFTRAANDAFFAXI-009
- **DO NOT** modify MonteCarloSimulator - that's AFFTRAANDAFFAXI-010
- **DO NOT** modify WitnessStateFinder - that's AFFTRAANDAFFAXI-011
- **DO NOT** modify ExpressionsSimulatorController - that's AFFTRAANDAFFAXI-012
- **DO NOT** modify backend emotion calculation - that's AFFTRAANDAFFAXI-006/007

## Implementation Details

### 1. Add HTML for Trait Display (expression-diagnostics.html)

Add after the sexual display section in the witness state results panel:

```html
<!-- Affect Traits Display -->
<div class="witness-section" id="traits-section">
  <h4>Affect Traits</h4>
  <div id="traits-display" class="axis-grid">
    <div class="axis-item">
      <span class="axis-name">Affective Empathy</span>
      <span class="axis-value" id="trait-affective-empathy">--</span>
    </div>
    <div class="axis-item">
      <span class="axis-name">Cognitive Empathy</span>
      <span class="axis-value" id="trait-cognitive-empathy">--</span>
    </div>
    <div class="axis-item">
      <span class="axis-name">Harm Aversion</span>
      <span class="axis-value" id="trait-harm-aversion">--</span>
    </div>
  </div>
</div>
```

### 2. Add CSS for Trait Display (css/expression-diagnostics.css)

Reuse existing axis-grid styling or add:

```css
/* Trait display section - follows existing witness section pattern */
#traits-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

#traits-section h4 {
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

#traits-display.axis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
}
```

### 3. Add DOM Element References

In `ExpressionDiagnosticsController.js`, add private field references:

```javascript
// After existing witness state DOM elements (~line 70)
#traitsDisplay;
#traitAffectiveEmpathy;
#traitCognitiveEmpathy;
#traitHarmAversion;
```

### 4. Update #bindDomElements Method

Add bindings for trait elements:

```javascript
// In #bindDomElements method, after other witness state bindings
this.#traitsDisplay = document.getElementById('traits-display');
this.#traitAffectiveEmpathy = document.getElementById('trait-affective-empathy');
this.#traitCognitiveEmpathy = document.getElementById('trait-cognitive-empathy');
this.#traitHarmAversion = document.getElementById('trait-harm-aversion');
```

### 5. Update Witness State Display Logic

Find the method that displays witness state results and add trait rendering:

```javascript
/**
 * Display witness state in the UI.
 *
 * @param {WitnessState} state - The witness state to display
 * @private
 */
#displayWitnessState(state) {
  // ... existing mood display code ...

  // ... existing sexual display code ...

  // Display affect traits
  const traits = state.affectTraits;
  if (this.#traitAffectiveEmpathy) {
    this.#traitAffectiveEmpathy.textContent =
      traits?.affective_empathy?.toFixed(0) ?? '--';
  }
  if (this.#traitCognitiveEmpathy) {
    this.#traitCognitiveEmpathy.textContent =
      traits?.cognitive_empathy?.toFixed(0) ?? '--';
  }
  if (this.#traitHarmAversion) {
    this.#traitHarmAversion.textContent =
      traits?.harm_aversion?.toFixed(0) ?? '--';
  }
}
```

### 6. toDisplayString and JSON Display (ALREADY COMPLETE)

**NOTE**: These features were already implemented in AFFTRAANDAFFAXI-009:
- `WitnessState.toDisplayString()` already includes affectTraits
- `WitnessState.toJSON()` and `toClipboardJSON()` already include affectTraits

No additional changes needed for these features.

## Acceptance Criteria

### Tests That Must Pass

1. **All existing controller tests pass**:
   ```bash
   npm run test:unit -- --testPathPattern="ExpressionDiagnosticsController" --verbose
   ```

2. **TypeScript type checking passes**:
   ```bash
   npm run typecheck
   ```

3. **ESLint passes**:
   ```bash
   npx eslint src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js
   ```

### Manual Verification

1. Open `expression-diagnostics.html` in browser
2. Select an expression
3. Run "Find Witness" search
4. Verify "Affect Traits" section appears with three values
5. Verify JSON display includes affectTraits object

### Invariants That Must Remain True

1. **UI layout intact**: New section fits in existing witness state panel
2. **Graceful defaults**: Shows "--" when no state loaded
3. **Existing functionality unchanged**: All other diagnostics features work
4. **Consistent styling**: Matches existing axis display patterns

## Verification Commands

```bash
# Run existing tests
npm run test:unit -- --testPathPattern="ExpressionDiagnosticsController" --verbose

# Type check
npm run typecheck

# Lint
npx eslint src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js

# Build for manual testing
npm run build
```

## Definition of Done

- [x] HTML section added for affect traits in witness panel
- [x] CSS styling applied (consistent with existing patterns - reused `.axis-grid`)
- [x] Controller has DOM element references for trait display
- [x] `#bindDomElements` binds trait elements
- [x] Witness state display includes trait values
- [x] JSON display includes affectTraits (already done in AFFTRAANDAFFAXI-009)
- [x] Graceful handling when traits are undefined
- [x] All existing tests pass (176 tests)
- [x] `npm run typecheck` passes (no new errors)
- [x] `npx eslint` passes on modified files (no new errors)
- [ ] Layout tested manually in browser

## Outcome

**Status**: COMPLETED

**Changes Made**:
1. **HTML** (`expression-diagnostics.html`): Added "Affect Traits" section with `id="traits-display"` after Sexual State section
2. **Controller** (`ExpressionDiagnosticsController.js`):
   - Added `#traitsDisplay` private field
   - Added DOM binding for `traits-display` element
   - Added `#displayAffectTraits()` method mirroring existing axis display pattern
   - Updated `#displayWitnessResult()` to call `#displayAffectTraits(state.affectTraits)`
3. **Tests** (`ExpressionDiagnosticsController.test.js`):
   - Added `traits-display` to HTML fixture
   - Updated mock witness to include `affiliation` mood axis and `affectTraits` object
   - Updated mood axes count expectation from 7 to 8 (includes affiliation)
   - Added test "populates affect traits display" verifying 3 trait axes render
   - Updated JSON/clipboard expectations to include affectTraits

**Scope Corrections**:
- Sections 6-7 (toDisplayString/JSON integration) were already complete from AFFTRAANDAFFAXI-009
- No CSS changes needed - existing `.axis-grid` styles suffice

**Investigation Result (Affiliation)**:
- The affiliation mood axis (added in 009-012) is already in `WitnessState.MOOD_AXES`
- `#displayMoodAxes()` automatically renders it since it iterates over the MOOD_AXES array
- No additional changes required for affiliation display
