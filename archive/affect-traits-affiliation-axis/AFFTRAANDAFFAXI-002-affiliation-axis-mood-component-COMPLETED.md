# AFFTRAANDAFFAXI-002: Add Affiliation Axis to Mood Component

## Status: COMPLETED

## Summary

Add an 8th mood axis (`affiliation`) to the existing `core:mood` component. This axis captures momentary social warmth and connectedness, representing the "communion" dimension from interpersonal circumplex theory.

## Priority: High | Effort: Low

## Rationale

The current 7 mood axes lack a dimension for interpersonal orientation. A sociopath can have high `affiliation` (performing warmth) with low `affective_empathy` (not feeling it). This distinction is crucial for psychologically accurate emotion modeling.

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/components/mood.component.json` | **Modify** - Add affiliation property |

## Out of Scope

- **DO NOT** modify `affect_traits.component.json` - that's AFFTRAANDAFFAXI-001
- **DO NOT** modify `emotion_prototypes.lookup.json` - that's AFFTRAANDAFFAXI-003/004/005
- **DO NOT** modify `EmotionCalculatorService` - that's AFFTRAANDAFFAXI-006/007
- **DO NOT** update any existing entity data files - this is schema only
- ~~**DO NOT** create any test files - schema validation is sufficient~~ **[CORRECTED]**: Existing test file `tests/unit/mods/core/components/mood.component.test.js` required updates to include `affiliation` in test data, since schema uses `additionalProperties: false` and `affiliation` is now required.

## Implementation Details

### Modify: data/mods/core/components/mood.component.json

#### 1. Update description to mention 8 axes

Change line 4 from:
```json
"description": "Tracks the 7 emotional axes that define a character's current mood state. Each axis ranges from -100 to +100.",
```

To:
```json
"description": "Tracks the 8 emotional axes that define a character's current mood state. Each axis ranges from -100 to +100.",
```

#### 2. Add affiliation property to dataSchema.properties

Add after `self_evaluation` (before the closing brace of `properties`):

```json
"affiliation": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Social warmth and connectedness. Captures momentary interpersonal orientation. (-100=cold/detached/hostile, 0=neutral, +100=warm/connected/affiliative)"
}
```

#### 3. Update required array

Change:
```json
"required": ["valence", "arousal", "agency_control", "threat", "engagement", "future_expectancy", "self_evaluation"],
```

To:
```json
"required": ["valence", "arousal", "agency_control", "threat", "engagement", "future_expectancy", "self_evaluation", "affiliation"],
```

### Complete Updated File

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:mood",
  "description": "Tracks the 8 emotional axes that define a character's current mood state. Each axis ranges from -100 to +100.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "valence": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pleasant (+) to unpleasant (-). Overall hedonic tone."
      },
      "arousal": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Energized (+) to depleted (-). Activation level."
      },
      "agency_control": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Dominant/in-control (+) to helpless (-). Felt power."
      },
      "threat": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Endangered (+) to safe (-). Perceived danger."
      },
      "engagement": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Absorbed (+) to indifferent (-). Attentional capture."
      },
      "future_expectancy": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Hopeful (+) to hopeless (-). Belief in positive outcomes."
      },
      "self_evaluation": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pride (+) to shame (-). Momentary self-worth."
      },
      "affiliation": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Social warmth and connectedness. Captures momentary interpersonal orientation. (-100=cold/detached/hostile, 0=neutral, +100=warm/connected/affiliative)"
      }
    },
    "required": ["valence", "arousal", "agency_control", "threat", "engagement", "future_expectancy", "self_evaluation", "affiliation"],
    "additionalProperties": false
  }
}
```

### Design Notes

- **Bipolar axis `[-100, +100]`**: Matches other mood axes pattern
- **Default 0 (neutral)**: Consistent with other axes
- **Interpersonal circumplex theory**: Affiliation is orthogonal to agency (dominance)
- **Momentary state**: Unlike `affective_empathy` (stable trait), this captures current warmth
- **Backwards compatibility concern**: Adding to `required` means existing entities with `core:mood` will need the new axis. Consider implications for entity data files.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation passes**:
   ```bash
   npm run validate
   ```

2. **Existing mood-related tests still pass**:
   ```bash
   npm run test:unit -- --testPathPatterns="mood.component" --verbose
   ```

3. **Typecheck passes**:
   ```bash
   npm run typecheck
   ```

### Invariants That Must Remain True

1. **Axis follows pattern**: Same structure as existing 7 axes (type, min, max, default, description)
2. **Bipolar range**: Uses [-100, +100] like other mood axes
3. **Default is neutral**: 0 is the default value
4. **Schema valid**: Passes validation against component.schema.json
5. **No breaking changes**: Existing emotion calculations that don't use `affiliation` continue to work

## Verification Commands

```bash
# Validate all schemas
npm run validate

# Verify JSON is valid
node -e "require('./data/mods/core/components/mood.component.json')"

# Run mood-related tests
npm run test:unit -- --testPathPatterns="mood.component" --verbose

# Check the component has 8 properties
node -e "const m = require('./data/mods/core/components/mood.component.json'); console.log(Object.keys(m.dataSchema.properties).length)"
# Should output: 8
```

## Definition of Done

- [x] `affiliation` property added with correct structure
- [x] Description updated to say "8 emotional axes"
- [x] `required` array includes `affiliation`
- [x] `npm run validate` passes
- [x] JSON is syntactically valid
- [x] No other files modified (except test file - see Outcome)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Modify only `data/mods/core/components/mood.component.json`
- No test file changes needed (assumed schema validation was sufficient)

**What Was Actually Changed:**

1. **`data/mods/core/components/mood.component.json`** - Modified as planned:
   - Updated description from "7 emotional axes" to "8 emotional axes"
   - Added `affiliation` property with integer type, range [-100, 100], default 0
   - Added `affiliation` to the `required` array

2. **`tests/unit/mods/core/components/mood.component.test.js`** - Required update (not in original scope):
   - Added `affiliation: 0` to all test data objects (valid data tests, required fields tests, range validation tests, type validation tests, additionalProperties tests, edge cases)
   - Added `'affiliation'` to the `requiredFields` and `axes` arrays
   - Updated file description comment from "7-axis" to "8-axis"
   - **Rationale**: The schema uses `additionalProperties: false` and `affiliation` is now a required field. Without adding `affiliation` to all test data, the schema validation tests would fail because the test data would be missing a required field.

### Verification Results

- `npm run validate` - Passes
- `node -e "require('./data/mods/core/components/mood.component.json')"` - No errors (valid JSON)
- `npm run test:unit -- --testPathPatterns="mood.component" --verbose` - All 34 tests pass
- Property count verification: 8 properties (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, affiliation)
- `npm run typecheck` - Pre-existing type annotation issues in unrelated files; no new issues introduced by these changes

### Ticket Assumption Correction

The ticket's "Out of Scope" section stated "DO NOT create any test files - schema validation is sufficient." This assumption was incorrect because:
- The existing test file (`mood.component.test.js`) creates test data objects that must include all required fields
- Since `affiliation` was added to the `required` array, test data without `affiliation` would fail schema validation
- The test file needed to be **updated** (not created) to include `affiliation: 0` in all test data objects

This is a distinction between "creating new test files" (correctly out of scope) vs "updating existing test files to maintain compatibility" (required).
