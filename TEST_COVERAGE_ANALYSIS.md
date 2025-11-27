# Non-Deterministic Action System: Test Coverage Analysis

## Overview

This document analyzes the existing test suite for the non-deterministic action system, specifically for the `swing_at_target` action with chance-based mechanics. The analysis covers:

1. Action discovery and definition tests
2. Rule execution and outcome resolution tests
3. Chance calculation services (unit tests)
4. Schema validation tests
5. Integration tests across the pipeline

---

## 1. ACTION DISCOVERY TESTS

### File: `tests/integration/mods/weapons/swing_at_target_action_discovery.test.js`

**Purpose**: Validates the structure and configuration of the `swing_at_target` action definition.

**Test Coverage**:

#### Action Structure (6 tests)
- ✅ Correct action ID: `weapons:swing_at_target`
- ✅ Correct name: "Swing at Target"
- ✅ Has description (non-empty string)
- ✅ Enables combination generation (`generateCombinations: true`)
- ✅ Template matches expected pattern: `'swing {weapon} at {target} ({chance}%)'`
- ✅ Template includes `{chance}` placeholder

#### Required Components (3 tests)
- ✅ Actor requires `positioning:wielding`
- ✅ Primary target requires `weapons:weapon`
- ✅ Primary target requires `damage-types:can_cut`

#### Target Configuration (5 tests)
- ✅ Primary target defined with `weapons:wielded_cutting_weapons` scope
- ✅ Primary target uses `{weapon}` placeholder
- ✅ Secondary target defined with `core:actors_in_location` scope
- ✅ Secondary target uses `{target}` placeholder
- ✅ Both targets have descriptions

#### chanceBased Configuration (9 tests)
- ✅ `chanceBased.enabled = true`
- ✅ `contestType = 'opposed'`
- ✅ `actorSkill.component = 'skills:melee_skill'`
- ✅ `targetSkill.component = 'skills:defense_skill'`
- ✅ Both use `property: 'value'`
- ✅ Default values: actor=10, target=0
- ✅ `formula = 'ratio'`
- ✅ Probability bounds: min=5%, max=95%
- ✅ Critical thresholds: success=5%, failure=95%

#### Schema Compliance (2 tests)
- ✅ Correct schema reference
- ✅ All required action properties present

**Missing Tests**: Action metadata is well-covered. Tests are structural, not behavioral.

---

## 2. RULE EXECUTION & OUTCOME RESOLUTION TESTS

### File: `tests/integration/mods/weapons/swingAtTargetOutcomeResolution.test.js`

**Purpose**: Tests the handle_swing_at_target rule structure and event handling integration.

**Note**: Comments state "Actual outcome determination is tested in unit tests for ResolveOutcomeHandler and OutcomeDeterminerService."

**Test Coverage**:

#### Rule Structure (13 tests)
- ✅ Correct rule_id and event_type
- ✅ Correct condition reference
- ✅ GET_NAME operations for actor, target, weapon
- ✅ QUERY_COMPONENT for actor position
- ✅ RESOLVE_OUTCOME operation with correct parameters
- ✅ Outcome branching with IF operations
- ✅ CRITICAL_SUCCESS, SUCCESS, FUMBLE, FAILURE branches
- ✅ Proper macro usage (logSuccess/logFailure)
- ✅ Variable resolution consistency
- ✅ Schema compliance

**Missing Tests**: 
- ❌ No tests for actual rule execution with real entities
- ❌ No tests for variable substitution in outcome messages
- ❌ No tests for RESOLVE_OUTCOME operation execution (out of scope)

---

## 3. CHANCE DISPLAY FORMATTING TESTS

### File: `tests/integration/mods/weapons/swingAtTargetChanceDisplay.test.js`

**Purpose**: Tests that `{chance}` placeholder is correctly replaced with calculated probability.

**Test Coverage**:

#### Basic Injection (11 tests)
- ✅ {chance} placeholder replaced with percentage
- ✅ Original template cache not modified
- ✅ Service called with correct parameters
- ✅ Opposed skill check display
- ✅ Missing skill fallback
- ✅ No placeholder handling
- ✅ Non-chance action handling
- ✅ Backward compatibility
- ✅ Target extraction from resolvedTargets
- ✅ Fallback to targetContexts
- ✅ Formula and bounds passing

#### Logging (1 test)
- ✅ Debug message when injecting chance

**Critical Issues Identified**:
- ✅ Tests verify percentage formatting (e.g., "67%")
- ✅ Tests use mock service returning specific percentages
- ⚠️ Tests don't verify actual calculation logic (relies on service mock)
- ⚠️ No tests for percentage rounding/truncation edge cases
- ⚠️ No tests for bound clamping verification in display

---

## 4. UNIT TESTS: CHANCE CALCULATION SERVICE

### File: `tests/unit/combat/services/ChanceCalculationService.test.js`

**Purpose**: Unit tests for the main orchestration service.

**Test Coverage**:

#### Constructor/Dependencies (7 tests)
- ✅ Valid instance creation
- ✅ Throws on missing each dependency
- ✅ Throws on invalid logger methods

#### calculateForDisplay() - Non-Chance (3 tests)
- ✅ Returns 100% when chanceBased not enabled
- ✅ Returns 100% when chanceBased undefined
- ✅ Returns 100% when actionDef null

#### calculateForDisplay() - Simple Checks (7 tests)
- ✅ Calculates display chance for simple skill check
- ✅ Uses default skill value
- ✅ **Rounds final chance to integer** ← **KEY TEST**
- ✅ **Rounds up when chance is .5 or higher** ← **KEY TEST**

#### calculateForDisplay() - Opposed Checks (3 tests)
- ✅ Resolves target skill for opposed checks
- ✅ Handles missing targetId gracefully
- ✅ Skips target skill when appropriate

#### calculateForDisplay() - Formulas (3 tests)
- ✅ Passes logistic formula to calculator
- ✅ Passes linear formula to calculator
- ✅ Defaults to ratio formula

#### calculateForDisplay() - Bounds (2 tests)
- ✅ Passes custom bounds to calculator
- ✅ Uses default bounds (5-95)

#### resolveOutcome() Tests (11 tests)
- ✅ Automatic success for non-chance
- ✅ Resolves outcome using calculated chance
- ✅ Uses custom thresholds
- ✅ Passes forcedRoll for deterministic testing
- ✅ Includes target in opposed checks
- ✅ **Returns CRITICAL_SUCCESS outcome**
- ✅ **Returns FAILURE outcome**
- ✅ **Returns FUMBLE outcome**

#### Integration Tests (2 tests)
- ✅ **Consistent results for same inputs**
- ✅ **Uses same skill resolution for both methods**

---

## 5. UNIT TESTS: PROBABILITY CALCULATOR SERVICE

### File: `tests/unit/combat/services/ProbabilityCalculatorService.test.js`

**Purpose**: Tests the core probability calculation logic.

**Test Coverage**:

#### Ratio Formula (7 tests)
- ✅ 50% for equal skills (50 vs 50)
- ✅ 75% for 75 vs 25
- ✅ 25% for 25 vs 75
- ✅ **Clamps to min (5%) for 0 vs 100**
- ✅ **Clamps to max (95%) for 100 vs 0**
- ✅ 50% when both skills are 0
- ✅ Defaults to ratio formula

#### Logistic Formula (3 tests)
- ✅ ~50% for equal skills
- ✅ **Approaches 95% for large positive difference**
- ✅ **Approaches 5% for large negative difference**

#### Linear Formula (4 tests)
- ✅ 50% when actor equals difficulty
- ✅ 60% when actor 10 above difficulty
- ✅ 40% when actor 10 below difficulty
- ✅ Clamps to bounds for extreme differences

#### Bounds Handling (5 tests)
- ✅ Applies default bounds (5-95)
- ✅ Applies custom bounds correctly
- ✅ Applies custom min bound correctly
- ✅ **Throws error when min > max**
- ✅ Uses default for missing properties

#### Modifiers Application (7 tests)
- ✅ Applies flat modifiers to base chance
- ✅ **Applies percentage modifiers multiplicatively**
- ✅ Applies both flat and percentage modifiers
- ✅ **Clamps modified result to bounds**
- ✅ Ignores invalid modifier values
- ✅ Handles negative flat modifiers
- ✅ Handles percentage modifiers < 1

#### Edge Cases (14 tests)
- ✅ Zero actor skill
- ✅ Zero target skill
- ✅ Negative actor skill
- ✅ Negative target skill
- ✅ Invalid formula throws error
- ✅ Undefined params gracefully
- ✅ Null params gracefully
- ✅ NaN actorSkill gracefully
- ✅ **Decimal skill values**
- ✅ Very large skill values
- ✅ Empty modifiers object
- ✅ Empty bounds object

#### Breakdown Structure (2 tests)
- ✅ Includes all breakdown fields
- ✅ Logs debug message

---

## 6. UNIT TESTS: OUTCOME DETERMINER SERVICE

### File: `tests/unit/combat/services/OutcomeDeterminerService.test.js`

**Purpose**: Tests outcome classification based on roll vs threshold.

**Test Coverage**:

#### Basic Outcomes (4 tests)
- ✅ SUCCESS when roll <= finalChance
- ✅ FAILURE when roll > finalChance
- ✅ **CRITICAL_SUCCESS when roll <= criticalSuccessThreshold AND success**
- ✅ **FUMBLE when roll >= criticalFailureThreshold AND failure**

#### Margin Calculation (3 tests)
- ✅ Negative margin for success
- ✅ Positive margin for failure
- ✅ Zero margin for exact match

#### Custom Thresholds (5 tests)
- ✅ Uses custom criticalSuccess threshold
- ✅ Not critical above custom threshold
- ✅ Uses custom criticalFailure threshold
- ✅ Not fumble below custom threshold
- ✅ Works with both custom thresholds

#### Critical Logic Tests (6 tests)
- ✅ **NOT critical success on low roll if fails**
- ✅ **NOT fumble on high roll if succeeds**
- ✅ **IS fumble on high roll AND fails**
- ✅ **IS critical success on low roll AND succeeds**
- ✅ **NOT critical success above threshold even if success**
- ✅ **NOT fumble below threshold even if failure**

#### Boundary Roll Values (4 tests)
- ✅ Roll = 1 (minimum)
- ✅ Roll = 100 (maximum)
- ✅ Roll = 5 (critical threshold boundary)
- ✅ Roll = 95 (fumble threshold boundary)

#### Result Structure (3 tests)
- ✅ All required fields present
- ✅ Correct types
- ✅ Valid outcome types only

---

## 7. UNIT TESTS: MODIFIER COLLECTOR SERVICE

### File: `tests/unit/combat/services/ModifierCollectorService.test.js`

**Purpose**: Tests modifier collection (Phase 5 stub).

**Test Coverage**:

#### Current Behavior (5 tests)
- ✅ Returns empty collection (stub phase)
- ✅ Handles undefined/empty configs
- ⚠️ **Phase 5 stub: Returns empty even with modifiers configured**

#### Totals Calculation (3 tests)
- ✅ Zero totals for empty modifiers
- ✅ Proper structure with required properties
- ✅ Correct types

**Note**: Full modifier evaluation is deferred to Phase 5+.

---

## 8. SCHEMA VALIDATION TESTS

### File: `tests/unit/schemas/action.chanceBased.schema.test.js`

**Purpose**: Validates the chanceBased property schema for actions.

**Test Coverage**:

#### Backward Compatibility (2 tests)
- ✅ Action without chanceBased validates
- ✅ Action with visual but no chanceBased validates

#### Valid Configurations (9 tests)
- ✅ Minimal chanceBased configuration
- ✅ Full configuration with all properties
- ✅ fixed_difficulty contestType
- ✅ logistic formula
- ✅ linear formula
- ✅ chanceBased with enabled:false
- ✅ With difficultyModifier
- ✅ With modifiers array
- ✅ With inline JSON Logic

#### Bounds Validation (3 tests)
- ✅ Min values (0) validate
- ✅ Max values (100) validate
- ✅ Custom thresholds validate

#### Invalid Configurations (14 tests)
- ✅ Missing required fields validation
- ✅ Invalid enum values validation
- ✅ **bounds.min below 0 fails**
- ✅ **bounds.max above 100 fails**
- ✅ **criticalSuccessThreshold validation**
- ✅ **criticalFailureThreshold validation**
- ✅ Type validation (enabled as boolean)
- ✅ Unknown property validation

---

## 9. INTEGRATION TEST: CHANCE CALCULATION SERVICE

### File: `tests/integration/combat/chanceCalculationService.integration.test.js`

**Purpose**: Integration tests with real sub-services (not mocked).

**Test Coverage**:

#### calculateForDisplay() (4 tests)
- ✅ Calculate chance for actor with skill
- ✅ Use default skill when missing
- ✅ Calculate opposed check with target
- ✅ **Respect bounds constraints**

#### resolveOutcome() (5 tests)
- ✅ Resolve outcome with deterministic roll
- ✅ **Detect critical success**
- ✅ **Detect failure**
- ✅ **Detect fumble**
- ✅ Return automatic success for non-chance

#### Consistency Tests (2 tests)
- ✅ **Produce matching thresholds**
- ✅ **Handle opposed checks consistently**

#### Formula Variations (3 tests)
- ✅ Calculate with ratio formula
- ✅ Calculate with logistic formula
- ✅ Calculate with linear formula

#### Error Handling (2 tests)
- ✅ Handle missing entity gracefully
- ✅ Handle null targetId gracefully

---

## SUMMARY: WHAT'S WELL TESTED

### ✅ Core Logic Coverage

1. **Action Definition Structure** - Metadata validation ✅
2. **Probability Calculation** - All formulas, bounds, modifiers ✅
3. **Rounding** - Integer conversion, .5 behavior ✅
4. **Outcome Determination** - Roll vs threshold, criticality logic ✅
5. **Service Integration** - Orchestra coordination ✅
6. **Schema Validation** - Structure and constraints ✅

### Test Statistics

- **Unit tests for services**: 5 files (ModifierCollector, SkillResolver, Chance, Probability, Outcome)
- **Integration tests**: 2 files (ChanceCalculation, Action pipeline)
- **Schema tests**: 1 file
- **Rule/action tests**: 2 files
- **Total tests focused on non-deterministic system**: ~200+ tests

---

## CRITICAL GAPS: WHAT'S NOT TESTED

### ❌ Priority 1: Display Percentage Accuracy

**The core issue**: User sees "67%" but actual calculations might produce different displayed value.

**Missing Tests**:
```
- Rounding 67.4% → displays as 67%? (not 67.4%)
- Rounding 67.5% → displays as 68%? (rounding behavior)
- Bounds clamping (100 skill → shows 95%, not 100%)
- Percentage display precision edge cases
```

### ❌ Priority 2: Decimal to Percentage Conversion

**The core issue**: Raw calculation (0.67) displayed as percentage (67%).

**Missing Tests**:
```
- Verify display format is "67%" not "0.67"
- Verify 1-100 scale not 0-1 scale
- Verify Math.round() vs Math.floor() vs Math.ceil()
- Verify no decimal points in percentage display
```

### ❌ Priority 3: Roll-Outcome Accuracy

**The core issue**: Displayed 67% but roll threshold is different.

**Missing Tests**:
```
- If display shows 67%, verify roll ≤ 67 succeeds
- If display shows 67%, verify roll > 67 fails
- Off-by-one boundary: roll 67 on 67% chance
- Threshold boundary behaviors
```

### ❌ Priority 4: Pipeline Integration

**The core issue**: No end-to-end test from action → display → outcome.

**Missing Tests**:
```
- Action discovery → ActionFormattingStage → display percentage
- Calculated percentage → template rendering → displayed text
- Displayed percentage → roll determination → outcome
- Full "swing_at_target" action execution end-to-end
```

### ❌ Priority 5: Template Rendering

**The core issue**: Template might have wrong percentage or format issues.

**Missing Tests**:
```
- Template with multiple placeholders: "{actor} swings {weapon} ({chance}%)"
- Multiple {chance} placeholders
- Percentage display with modifiers applied
- Percentage display with different formulas
- Malformed or invalid templates
```

---

## DETAILED ANALYSIS: HIGH-RISK AREAS

### 1. Percentage Display Format

**Current Testing**:
- ✅ ActionFormattingStage test mocks service returning `{displayText: '67%'}`
- ✅ Service test verifies `displayText: '55%'` format

**Missing**:
- ❌ No test of actual ProbabilityCalculatorService output format
- ❌ No test showing how `finalChance: 67` becomes `displayText: '67%'`
- ❌ No test for edge cases: 0%, 100%, 5%, 95%

**Risk**: If service returns `55` instead of `'55%'`, it won't be caught.

### 2. Rounding Consistency

**Current Testing**:
- ✅ ChanceCalculationService rounds to integer: `expect(result.chance).toBe(55)`
- ✅ ProbabilityCalculatorService shows modifiers after calculation

**Missing**:
- ❌ No test showing: 55.4 → 55, 55.5 → 56, 55.6 → 56
- ❌ No test for rounding in multiple steps (skill resolution → probability → display)
- ❌ No test showing Math.round() is used consistently
- ❌ No test showing rounding doesn't affect bounds clamping

**Risk**: 55.6% displayed as "55%" but roll threshold is 56%.

### 3. Bounds Clamping in Display

**Current Testing**:
- ✅ ProbabilityCalculatorService clamps: `finalChance: 95` when raw is 100
- ✅ Test shows 100 skill → 95 finalChance

**Missing**:
- ❌ No test showing display is "95%", not "100%"
- ❌ No test for calculation that results in exactly 95% or 5%
- ❌ No test showing unclamped vs clamped visual difference
- ❌ No test for "should never show >95% or <5%"

**Risk**: Display shows "100%" but roll threshold is clamped to 95%.

### 4. Modifier + Percentage Interaction

**Current Testing**:
- ✅ ProbabilityCalculatorService applies modifiers
- ✅ Test shows: base 50 + flat 10 → 60

**Missing**:
- ❌ No test showing modified percentage displayed correctly
- ❌ No test for: (baseChance + flatMod) * percentMod → display
- ❌ No test showing modifier effects visible in displayed percentage
- ❌ No test for modifier + bounds interaction in display

**Risk**: Display shows 50% but modifier adds 10, so should show 60%.

### 5. Formula Variation Display

**Current Testing**:
- ✅ Three formulas tested (ratio, logistic, linear)
- ✅ Different formulas produce different chances

**Missing**:
- ❌ No test showing all three formulas display correctly
- ❌ No test that formula differences are visible in display
- ❌ No test for formula selection impact on user-visible percentage
- ❌ No test for switching formulas and seeing different percentages

**Risk**: All formulas display the same percentage despite different calculations.

---

## SPECIFIC TEST CASE: ROLL-PERCENTAGE MISMATCH

### Scenario

1. **Calculation**: skillResolver returns actor=67, target=33
2. **Probability**: 67/(67+33) = 67%
3. **Display**: Shows "67%" to user
4. **Outcome**: 
   - Roll 30 → should be SUCCESS (30 < 67)
   - Roll 67 → should be SUCCESS (67 ≤ 67)
   - Roll 68 → should be FAILURE (68 > 67)

### Current Test Coverage

- ✅ Calculation: `expect(result.baseChance).toBe(67)`
- ✅ Service call: `expect(result.displayText).toBe('67%')`
- ✅ Outcome: `expect(result.outcome).toBe('SUCCESS')` when roll 30

### Missing Test

```javascript
// This test doesn't exist:
it('should resolve success/failure matching displayed percentage', () => {
  const actionDef = createChanceBasedActionDef({...});
  
  // Calculate
  const display = service.calculateForDisplay({
    actorId: 'actor-1',
    actionDef
  });
  
  // Extract percentage from display
  const displayedPercentage = parseInt(display.displayText); // "67%"
  
  // Verify outcomes match the displayed percentage
  const successResult = service.resolveOutcome({
    actorId: 'actor-1',
    actionDef,
    forcedRoll: displayedPercentage // 67
  });
  expect(successResult.outcome).toBe('SUCCESS');
  
  const failureResult = service.resolveOutcome({
    actorId: 'actor-1',
    actionDef,
    forcedRoll: displayedPercentage + 1 // 68
  });
  expect(failureResult.outcome).toBe('FAILURE');
});
```

---

## RECOMMENDATION: NEW TEST FILE

**Create**: `/tests/integration/mods/weapons/swingAtTargetPercentageAccuracy.integration.test.js`

**Tests needed**:

1. ✅ Template rendering with correct percentage
2. ✅ Percentage matches roll threshold
3. ✅ Rounding consistency across pipeline
4. ✅ Modifiers visible in percentage
5. ✅ Bounds affect displayed percentage
6. ✅ Formulas produce different percentages
7. ✅ Percentage never shows as decimal
8. ✅ Percentage always within bounds (5-95%)
9. ✅ Off-by-one errors at thresholds
10. ✅ Full action: discover → format → display → resolve outcome

---

## CONCLUSION

### Coverage Assessment

**Calculation Logic**: ⭐⭐⭐⭐⭐ Excellent
- All formulas tested
- Bounds clamping tested
- Modifiers tested
- Edge cases tested

**Outcome Determination**: ⭐⭐⭐⭐⭐ Excellent
- Roll comparison logic tested
- Critical/fumble thresholds tested
- Boundary conditions tested

**Display Accuracy**: ⭐⭐⭐ Medium
- Percentage format tested (mocked)
- Rounding tested (integer conversion)
- **Missing**: End-to-end display verification
- **Missing**: Display-to-roll threshold matching
- **Missing**: Rounding in full pipeline
- **Missing**: Modifier visibility in display

**Risk Level**: **MEDIUM-HIGH**

The system has excellent test coverage for calculations but lacks critical tests verifying that what the user sees matches the actual game mechanics. The main risks are:

1. **Display Mismatch**: Calculation produces 67% but display shows 66% or 68%
2. **Format Error**: Display shows "0.67" instead of "67%"
3. **Threshold Mismatch**: Display shows 67% but roll threshold is different
4. **Modifier Invisibility**: Modifiers applied but not reflected in display

These gaps could cause **player confusion or perceived unfairness** if percentage display doesn't match actual outcomes.
