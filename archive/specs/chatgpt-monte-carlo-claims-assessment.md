# ChatGPT Monte Carlo Claims Assessment

**Generated**: 2026-01-11
**Source Document**: brainstorming/assessment-of-current-monte-carlo-implementation.md
**Analysis Focus**: Architecture evaluation of ChatGPT's claims about Monte Carlo implementation

---

## Executive Summary

ChatGPT reviewed the Monte Carlo report output and made several claims about implementation bugs. This assessment validates each claim against the actual codebase.

| Claim | Verdict | Action Required |
|-------|---------|-----------------|
| A. Prototype Math Analysis wrong for upper-bound clauses | ⚠️ **PARTIALLY VALID** | Report format fix needed |
| B. Mood regime filter count inconsistent | ✅ **LIKELY FALSE** | Investigation needed but probably correct |
| C. Prototype constraint ranges use unstated constraints | ✅ **FALSE** | No issue found |
| D. Global sensitivity missing sexualArousal | ❌ **VALID BUG** | Implementation fix needed |
| E. Naive resampling at rare expression levels | ⚠️ **VALID CONCERN** | Low priority enhancement |

---

## Detailed Claim Analysis

### Claim A: Prototype Math Analysis Direction Bug

**ChatGPT's Assertion**:
> "Your 'Prototype Math Analysis' is directionally wrong for every upper-bound clause... clauses like `emotions.rage < 0.55` are analyzed as if they were lower-bounds (`rage >= 0.55`)."

**Investigation Findings**:

1. **Underlying Calculations - CORRECT**:
   - `BranchReachability.js` (lines 108-121) properly distinguishes direction:
     ```javascript
     if (direction === 'high') {
       this.#isReachable = maxPossible >= threshold;
     } else {
       // LOW direction
       this.#isReachable = minPossible < threshold;
     }
     ```
   - `PathSensitiveAnalyzer.js` (lines 939-964) correctly extracts direction from `<=` / `<` operators

2. **Report OUTPUT FORMAT - BUG CONFIRMED**:
   - `MonteCarloReportGenerator.js` line 1740 **hardcodes** `>=`:
     ```javascript
     return `##### ${type === 'emotion' ? '🧠' : '💗'} ${prototypeId} >= ${threshold.toFixed(2)} ...`
     ```
   - This causes upper-bound clauses like `dissociation <= 0.65` to display as `dissociation >= 0.65`

**Verdict**: ⚠️ **PARTIALLY VALID** - The underlying math is correct, but the report format is misleading.

**Fix Required**:
- Pass the operator/direction to `#formatPrototypeAnalysis()`
- Display the correct operator in the report header

---

### Claim B: Mood Regime Filter Count Inconsistency

**ChatGPT's Assertion**:
> "The '31 contexts' mood regime filter is wildly inconsistent... expected ~600 / 100,000, not 31 / 100,000."

**Investigation Findings**:

1. **Filter Logic - CORRECT**:
   - `MonteCarloReportGenerator.js` lines 296-306 correctly filters contexts where ALL mood constraints pass
   - Filter is intentionally strict (uses `every()`)

2. **Why 31 Contexts May Be Valid**:
   - The hurt_anger expression has **8 simultaneous mood constraints**
   - ChatGPT assumed independence, but constraints may be correlated
   - `RandomStateGenerator.js` uses **coupled sampling** with Gaussian deltas (σ=15), not independent uniform
   - With coupling, fewer samples satisfy all 8 constraints simultaneously

3. **Expected Count Calculation Issue**:
   - ChatGPT's math: 0.40 × 0.45 × 0.48 × 0.43 × ... ≈ 0.6%
   - But if arousal affects valence, or threat affects engagement (common in emotional states), correlations reduce joint probability
   - Additionally, the specific hurt_anger constraints are particularly strict (valence ≤ -10 AND arousal in [-5, 55] AND threat in [10, 70] AND...)

**Verdict**: ✅ **LIKELY FALSE** - The filter is correct; the low count likely reflects coupled sampling and strict constraints.

**Recommended Enhancement** (Low Priority):
- Add sanity check comparing observed vs expected mood regime contexts
- Log a warning if divergence exceeds 10x

---

### Claim C: Prototype Constraint Ranges Use Unstated Constraints

**ChatGPT's Assertion**:
> "The report treats constraints like they're coming from emotion gates or other hidden filters. Without a clean list per prototype block, it's easy for this to drift."

**Investigation Findings**:

1. **Constraint Sources Are Documented**:
   - `PrototypeConstraintAnalyzer.js` lines 426-445 show explicit constraint application
   - `#extractConstraintsFromLogic()` recursively extracts from prerequisites only
   - No hidden constraints added

2. **Report Already Shows Source**:
   - Gate constraints are explicitly labeled as "Gates"
   - Mood axis constraints appear in "Constraint" column
   - The report structure is correct, just not as explicitly labeled as ChatGPT wants

**Verdict**: ✅ **FALSE** - Constraints are traceable; no hidden filters detected.

**Optional Enhancement**:
- Add "Source" column to constraint tables (low value)

---

### Claim D: Global Sensitivity Missing sexualArousal

**ChatGPT's Assertion** (from parity-issue document):
> "Most tunable is sexualArousal >= 0.35 (6.54%)" appears in Top Blockers but NOT in Global Expression Sensitivity.

**Investigation Findings**:

1. **sexualArousal IS Marked Tunable**:
   - `advancedMetricsConfig.js` lines 129-130:
     ```javascript
     sexualArousal: /^sexualArousal$/,
     previousSexualArousal: /^previousSexualArousal$/,
     ```

2. **Individual Sensitivity Works**:
   - `SensitivityAnalyzer.computeSensitivityData()` (lines 31-74) correctly processes sexualArousal via `isTunableVariable()`

3. **Global Sensitivity OMITS sexualArousal - BUG**:
   - `computeGlobalSensitivityData()` (lines 84-165) selects top 3 candidates from blockers
   - The selection algorithm at lines 137-144 ranks by `lastMileRate * 0.5 + nearMissRate * 0.3 + failureRate * 0.2`
   - If sexualArousal scores high here, it SHOULD appear

4. **Root Cause Identified**:
   - The issue is that sexualArousal appears in Top Blockers BUT the global sensitivity section filters to only emotion-based clauses implicitly
   - Looking at the parity issue document: nervous_arousal.expression.json has sexualArousal as a blocker, but Global Expression Sensitivity shows only `emotions.awkwardness`, `emotions.freeze`, `emotions.anxiety`
   - The `computeExpressionSensitivity()` method may not properly handle scalar paths like `sexualArousal` vs field paths like `emotions.X`

**Verdict**: ❌ **VALID BUG** - Global sensitivity analysis excludes sexualArousal despite it being marked tunable.

**Fix Required**:
- Ensure `computeGlobalSensitivityData()` includes sexualArousal candidates
- Verify `computeExpressionSensitivity()` handles scalar paths correctly

---

### Claim E: Naive Resampling Not Actionable at Rare Expression Levels

**ChatGPT's Assertion**:
> "The global sensitivity analysis is not actionable at this rarity level using naive resampling (you already warn about it, but then you still present numbers that invite misuse)."

**Investigation Findings**:

1. **Warning Already Present**:
   - Report includes: "⚠️ Low Confidence Warning: All sensitivity analyses below have fewer than 5 baseline expression hits."

2. **Data Presentation Issue**:
   - The sensitivity tables still show "0%" entries that are meaningless with <5 samples
   - ChatGPT is correct that presenting this data "invites misuse"

**Verdict**: ⚠️ **VALID CONCERN** - Warning exists but presentation could be improved.

**Recommended Enhancement** (Medium Priority):
- Suppress global sensitivity section entirely when baseline hits < 5
- Or: Show only "Insufficient data for reliable sensitivity analysis"

---

## Additional Issues Identified

### Issue F: Non-Report Output Parity

The brainstorming/parity-issue-with-monte-carlo-reporting.md identifies that the HTML UI "Top Blockers" section shows sexualArousal as most tunable, but the Global Expression Sensitivity section doesn't include it. This is the same as Claim D but affects both:
1. Report markdown output
2. Non-report HTML output (expression-diagnostics.html)

**Fix Required**:
- Ensure parity between report and non-report sensitivity displays
- Both should include sexualArousal when it's a top tunable candidate

---

## Implementation Specifications

### Spec 1: Fix Prototype Math Report Format

**File**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

**Change**:
1. Modify `#formatPrototypeAnalysis()` signature to accept operator/direction
2. Line 1740: Replace hardcoded `>=` with dynamic operator based on direction
3. Update callers to pass the correct operator

**Example**:
```javascript
// Before
return `##### ${type === 'emotion' ? '🧠' : '💗'} ${prototypeId} >= ${threshold.toFixed(2)} ...`

// After
const opSymbol = direction === 'low' ? '<=' : '>=';
return `##### ${type === 'emotion' ? '🧠' : '💗'} ${prototypeId} ${opSymbol} ${threshold.toFixed(2)} ...`
```

### Spec 2: Fix sexualArousal Global Sensitivity Omission

**Files**:
- `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
- `src/expressionDiagnostics/services/MonteCarloSimulator.js` (verify)

**Change**:
1. In `computeGlobalSensitivityData()`, ensure sexualArousal candidates are included in `tunableCandidates`
2. Verify `computeExpressionSensitivity()` correctly handles scalar paths (not just `domain.field` paths)
3. Add test case for expression with sexualArousal as top tunable

### Spec 3: Ensure Report/Non-Report Parity

**Files**:
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

**Change**:
1. Extract sensitivity variable selection logic to shared utility
2. Ensure both report and non-report outputs use same selection algorithm
3. Both should display sexualArousal when applicable

### Spec 4: Improve Low-Confidence Sensitivity Display (Optional)

**Files**:
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`

**Change**:
1. When baseline expression hits < 5, either:
   - Suppress global sensitivity section entirely, OR
   - Show condensed "Insufficient data" message instead of misleading tables
2. Keep individual clause sensitivity (still useful for local pass rate)

---

## Verification Plan

### Unit Tests Required

1. **Prototype Format Direction Test**:
   - Test `#formatPrototypeAnalysis()` with `direction: 'low'`
   - Assert output contains `<=` not `>=`

2. **sexualArousal Sensitivity Test**:
   - Create fixture with sexualArousal as top tunable
   - Assert it appears in global sensitivity output

3. **Parity Test**:
   - Run same expression through report and non-report paths
   - Assert same variables appear in sensitivity sections

### Integration Tests

1. Run `npm run test:integration -- --grep "sensitivity"` after changes
2. Test with existing expressions:
   - nervous_arousal.expression.json (has sexualArousal)
   - hurt_anger.expression.json (has upper-bound clauses)

### Manual Verification

1. Open expression-diagnostics.html
2. Select expression with sexualArousal constraint
3. Verify Global Expression Sensitivity includes sexualArousal if it's top tunable
4. Verify prototype math shows correct operator for upper-bound clauses

---

## Priority Ranking

| Spec | Priority | Effort | Impact |
|------|----------|--------|--------|
| Spec 1: Report Format Fix | HIGH | Low | Correctness - misleading output |
| Spec 2: sexualArousal Omission | HIGH | Medium | Parity bug |
| Spec 3: Report/Non-Report Parity | MEDIUM | Low | Consistency |
| Spec 4: Low-Confidence Display | LOW | Low | UX improvement |

---

## Summary of What Needs to Be Done

### Must Fix (Report)
1. **Prototype math operator display** - Show `<=` for upper-bound clauses instead of always `>=`
2. **sexualArousal in global sensitivity** - Include scalar variables in sensitivity output

### Must Fix (Non-Report Output)
3. **Parity with report** - Ensure Global Expression Sensitivity section in HTML shows same variables as report

### Nice to Have
4. Suppress misleading low-confidence sensitivity tables
5. Add sanity check for mood regime context count

---

## ChatGPT Suggestions NOT Recommended

The following ChatGPT suggestions are **not recommended** for implementation:

1. **"Prototype replacement as a scored hypothesis"** - Too complex for current needs
2. **"Gap z-score calibration"** - Requires prototype-to-prototype distance precomputation
3. **"Suggested new prototype as projection"** - Beyond scope of diagnostics tool
4. **"Importance sampling for rare expressions"** - Complex to implement, marginal benefit

These could be future enhancements but are not necessary for self-sufficient reports.
