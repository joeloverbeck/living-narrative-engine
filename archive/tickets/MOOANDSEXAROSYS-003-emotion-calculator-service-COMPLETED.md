# MOOANDSEXAROSYS-003: EmotionCalculatorService Implementation

## Summary

Implement the core service that calculates emotion intensities from mood axes using weighted prototype matching, including sexual arousal calculation and prompt text formatting.

## Files to Touch

### CREATE

- `src/emotions/emotionCalculatorService.js` (new directory)

### MODIFY

- `src/dependencyInjection/tokens/tokens-ai.js` - Add DI token (AI tokens belong here, not tokens-core.js)
- `src/dependencyInjection/registrations/aiRegistrations.js` - Add singletonFactory registration

## Out of Scope

- ActorDataExtractor integration (uses this service) - see MOOANDSEXAROSYS-004
- CharacterDataXmlBuilder changes - see MOOANDSEXAROSYS-005
- UI panels - see MOOANDSEXAROSYS-009, MOOANDSEXAROSYS-010
- LLM response schema changes - see MOOANDSEXAROSYS-006
- MoodUpdateWorkflow - see MOOANDSEXAROSYS-007

## Technical Specification

### Service Interface

```javascript
class EmotionCalculatorService {
  constructor({ logger, dataRegistry })

  // Core calculations
  calculateSexualArousal(sexualState) // Returns [0..1] or null
  calculateEmotions(moodData, sexualArousal) // Returns Map<string, number>
  calculateSexualStates(moodData, sexualArousal) // Returns Map<string, number>

  // Formatting
  getIntensityLabel(intensity) // Returns string label
  formatEmotionsForPrompt(emotions, maxCount = 5) // Returns formatted string
  formatSexualStatesForPrompt(sexualStates, maxCount = 3) // Returns formatted string

  // Internal
  #normalizeMoodAxes(moodData) // Normalize [-100..100] to [-1..1]
  #checkGates(gates, normalizedAxes, sexualArousal) // Check gate conditions
  #calculatePrototypeIntensity(prototype, normalizedAxes, sexualArousal) // Single prototype
}
```

### Key Formulas

#### Sexual Arousal Calculation

```javascript
sexual_arousal = clamp01((sex_excitation - sex_inhibition + baseline_libido) / 100)
```

Where `clamp01(x) = Math.max(0, Math.min(1, x))`

#### Emotion Intensity Calculation

```javascript
// Step 1: Normalize axes to [-1..1]
normalized_axis = axis_value / 100

// Step 2: Check all gates (if any gate fails, intensity = 0)
if (!allGatesPass(prototype.gates, normalizedAxes, sexualArousal)) {
  return 0;
}

// Step 3: Weighted sum
rawSum = sum(normalized_axis[i] * weight[i] for each axis in prototype.weights)

// Step 4: Normalize by max possible (sum of absolute weights)
maxPossible = sum(|weight[i]| for each axis in prototype.weights)
normalizedIntensity = rawSum / maxPossible

// Step 5: Clamp negatives to 0
intensity = max(0, normalizedIntensity)
```

#### Gate Checking

Gates use format: `"axis_name operator value"`

Supported operators: `>=`, `<=`, `>`, `<`, `==`

Special axis name: `sexual_arousal` (uses calculated SA value, not mood axis)

### Intensity Labels (10-level)

```javascript
const INTENSITY_LEVELS = [
  { max: 0.05, label: 'absent' },
  { max: 0.15, label: 'faint' },
  { max: 0.25, label: 'slight' },
  { max: 0.35, label: 'mild' },
  { max: 0.45, label: 'noticeable' },
  { max: 0.55, label: 'moderate' },
  { max: 0.65, label: 'strong' },
  { max: 0.75, label: 'intense' },
  { max: 0.85, label: 'powerful' },
  { max: 0.95, label: 'overwhelming' },
  { max: 1.00, label: 'extreme' }
];
```

### DI Token

```javascript
// In tokens-ai.js (AI-related tokens)
IEmotionCalculatorService: 'IEmotionCalculatorService'
```

### DI Registration

```javascript
// In aiRegistrations.js, inside registerAIGameStateProviders()
registrar.singletonFactory(tokens.IEmotionCalculatorService, (c) => {
  return new EmotionCalculatorService({
    logger: c.resolve(tokens.ILogger),
    dataRegistry: c.resolve(tokens.IDataRegistry),
  });
});
```

## Acceptance Criteria

### Service Implementation

- [x] Service created in new `src/emotions/` directory
- [x] Constructor validates `logger` and `dataRegistry` dependencies
- [x] Loads `core:emotion_prototypes` lookup on first use (lazy loading)
- [x] Loads `core:sexual_prototypes` lookup on first use (lazy loading)

### calculateSexualArousal()

- [x] Returns `null` if `sexualState` is null/undefined
- [x] Returns value in range `[0, 1]`
- [x] Correctly applies formula: `(excitation - inhibition + baseline) / 100`
- [x] Clamps result to `[0, 1]`

### calculateEmotions()

- [x] Returns `Map<string, number>` of emotion name to intensity
- [x] Intensities are in range `[0, 1]`
- [x] Emotions failing gates have intensity 0 (excluded from map)
- [x] Handles `SA` weight key as alias for `sexual_arousal`

### Gate Checking

- [x] Supports all operators: `>=`, `<=`, `>`, `<`, `==`
- [x] Handles `sexual_arousal` axis name specially (uses calculated SA)
- [x] Returns false if any gate fails
- [x] Handles missing gates array (all gates pass)
- [x] Logs warning for invalid gate format (doesn't crash)

### formatEmotionsForPrompt()

- [x] Returns top N emotions by intensity (default 5)
- [x] Format: `"emotion1: label1, emotion2: label2, ..."`
- [x] Replaces underscores with spaces in emotion names
- [x] Excludes emotions with intensity < 0.05 (absent)
- [x] Returns empty string if no emotions above threshold

### Unit Test Coverage

- [x] 80%+ branch coverage (achieved: 95.5% branch, 97.14% statements)
- [x] Tests for null/undefined inputs
- [x] Tests for boundary values (0, 100, -100)
- [x] Tests for all gate operators
- [x] Tests for intensity label thresholds
- [x] Tests for formatting edge cases

### Test Commands

```bash
# Run unit tests
npm run test:unit -- --testPathPattern="emotions/emotionCalculatorService"

# Check coverage
npm run test:unit -- --testPathPattern="emotions/emotionCalculatorService" --coverage
```

## Example Test Case

```javascript
it('should calculate pride intensity correctly', () => {
  // self_eval=70, agency=20, valence=10
  // Pride weights: self_evaluation=1.0, agency_control=0.4, valence=0.3
  // Gate: self_evaluation >= 0.25 (passes: 0.70 >= 0.25)
  // Raw = 0.70*1.0 + 0.20*0.4 + 0.10*0.3 = 0.81
  // Max = 1.0 + 0.4 + 0.3 = 1.7
  // Intensity = 0.81 / 1.7 ≈ 0.476

  const moodData = {
    valence: 10, arousal: 0, agency_control: 20,
    threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 70
  };

  const emotions = service.calculateEmotions(moodData, null);
  expect(emotions.get('pride')).toBeCloseTo(0.476, 2);
});
```

## Dependencies

- MOOANDSEXAROSYS-002 (lookup files must exist for service to load prototypes)

## Dependent Tickets

- MOOANDSEXAROSYS-004 (ActorDataExtractor injects and uses this service)
- MOOANDSEXAROSYS-009 (EmotionalStatePanel may use formatting methods)
- MOOANDSEXAROSYS-010 (SexualStatePanel may use formatting methods)

## Outcome

**Status**: ✅ COMPLETED

### Files Created

- `src/emotions/emotionCalculatorService.js` (493 lines) - Full service implementation with:
  - Lazy-loaded prototype caching
  - All public methods per specification
  - Complete gate checking with all operators
  - SA/sexual_arousal alias support in weights
  - 11-level intensity labeling system

- `tests/unit/emotions/emotionCalculatorService.test.js` (67 tests) - Comprehensive test suite

### Files Modified

- `src/dependencyInjection/tokens/tokens-ai.js` - Added `IEmotionCalculatorService` token
- `src/dependencyInjection/registrations/aiRegistrations.js` - Added factory registration in `registerAIGameStateProviders()`

### Ticket Corrections Applied

The ticket originally referenced `tokens-core.js` for the DI token. This was corrected to use `tokens-ai.js` since this is an AI-related service (consistent with existing patterns like `IActorDataExtractor`).

### Test Coverage

| Metric     | Coverage |
|------------|----------|
| Statements | 97.14%   |
| Branches   | 95.50%   |
| Functions  | 100%     |
| Lines      | 97.10%   |

All 67 tests passing. Coverage exceeds the 80% branch requirement.

### Test Categories

1. **Constructor validation** (2 tests) - Dependency validation
2. **calculateSexualArousal** (7 tests) - Formula, clamping, null handling
3. **calculateEmotions** (12 tests) - Prototype matching, gate checking, intensity calculation
4. **calculateSexualStates** (6 tests) - Sexual prototype matching
5. **Gate checking** (15 tests) - All operators, edge cases, invalid formats
6. **getIntensityLabel** (13 tests) - All 11 threshold boundaries
7. **formatEmotionsForPrompt** (7 tests) - Formatting, filtering, sorting
8. **formatSexualStatesForPrompt** (5 tests) - Sexual state formatting

### Implementation Notes

- Service uses private class fields (`#logger`, `#dataRegistry`, etc.) for encapsulation
- Lazy loading prevents startup overhead when prototypes aren't immediately needed
- Float comparison for `==` operator uses epsilon (0.0001) for numerical stability
- Invalid gate formats log warnings but don't crash (graceful degradation)
