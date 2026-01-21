# PROREDANAV2-016: Integrate Gate Structure Services into PrototypeOverlapAnalyzer

## Description

~~Update the orchestrator to call gate constraint extraction and implication evaluation for each candidate pair.~~

**CORRECTED SCOPE**: The gate constraint extraction and implication evaluation are already integrated into `BehavioralOverlapEvaluator` (done in PROREDANAV2-007 and PROREDANAV2-008). The remaining work is ensuring all v2 behavioral metrics (including `gateImplication`) are passed to the recommendation builder.

## Files to Touch

### Modify
- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` (minor fix)
- `tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.test.js`

### ~~Create~~ (Not needed)
- ~~`tests/unit/expressionDiagnostics/services/prototypeOverlapAnalyzer.gateIntegration.test.js`~~

## Out of Scope

- GateBandingSuggestionBuilder integration (PROREDANAV2-017)
- UI changes
- Config changes
- DI registration changes (already done in PROREDANAV2-013)

## Corrected Analysis (Based on Codebase Review)

### What Was Already Done
| Ticket Assumption | Current Reality |
|---|---|
| "Add gateConstraintExtractor dependency to orchestrator" | **Already injected into BehavioralOverlapEvaluator** |
| "Add gateImplicationEvaluator dependency to orchestrator" | **Already injected into BehavioralOverlapEvaluator** |
| "Pre-extract gate constraints before evaluation loop" | **Already done inside BehavioralOverlapEvaluator.evaluate()** |
| "Create #evaluateGateImplication method" | **Already done inside BehavioralOverlapEvaluator** |
| "Pass gateImplication to classifier" | **Already done (line 202)** |

### What Still Needs To Be Done
| Issue | Status |
|---|---|
| "Pass all v2 metrics to recommendation builder" | **NOT done** - line 250 only passes `gateOverlap` and `intensity` |
| "Update test assertions" | **Needed** - test at line 563 expects incomplete metrics |

## Changes Required

### 1. Fix behaviorMetrics Passed to Recommendation Builder

**Line 250** - Current (incomplete):
```javascript
{ gateOverlap: behaviorResult.gateOverlap, intensity: behaviorResult.intensity },
```

**Line 250** - Fixed (complete):
```javascript
{
  gateOverlap: behaviorResult.gateOverlap,
  intensity: behaviorResult.intensity,
  passRates: behaviorResult.passRates,
  highCoactivation: behaviorResult.highCoactivation,
  gateImplication: behaviorResult.gateImplication,
},
```

### 2. Update Test Assertions

Update test "passes classification to recommendationBuilder when redundant (v2 type)" to expect all v2 metrics.

## Acceptance Criteria

### Tests That Must Pass

1. **All v2 behavioral metrics passed to recommendation builder**:
   - `gateOverlap`, `intensity`, `passRates`, `highCoactivation`, `gateImplication`

2. **Existing tests pass**:
   - All existing orchestrator tests unchanged (except assertion updates)

3. **Handles null gateImplication gracefully**:
   - When gateImplication is null, passes null (not omitted)

## Estimated Size

~5 lines of code changes + ~30 lines of test updates

## Dependencies

- PROREDANAV2-013 (DI registration complete) ✅
- PROREDANAV2-014 (evidence payload accepts gateImplication) ✅
- PROREDANAV2-007 (GateConstraintExtractor implemented) ✅
- PROREDANAV2-008 (GateImplicationEvaluator implemented) ✅

## Verification Commands

```bash
# Run orchestrator tests
npm run test:unit -- --testPathPattern=prototypeOverlapAnalyzer

# Lint
npx eslint src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js
```
