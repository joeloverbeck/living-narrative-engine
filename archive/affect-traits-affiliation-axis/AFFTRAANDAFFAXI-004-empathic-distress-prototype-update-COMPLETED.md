# AFFTRAANDAFFAXI-004: Update Empathic Distress Emotion Prototype

## Status: COMPLETED

## Summary

Update the `empathic_distress` emotion prototype to incorporate `affective_empathy` as a dominant factor. Empathic distress is being overwhelmed by others' emotions, which requires genuine affective empathy capacity.

## Priority: High | Effort: Low

## Rationale

The current empathic_distress prototype has `engagement: 0.90` as the dominant factor, allowing characters without empathic capacity to experience empathic distress. By adding `affective_empathy: 0.90` and a gate (`>= 0.30`), empathic distress now correctly requires moderate empathic capacity.

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | **Modify** - Update empathic_distress entry only |

## Out of Scope

- **DO NOT** modify other emotions (compassion, guilt, etc.) - those are AFFTRAANDAFFAXI-003/005
- **DO NOT** modify component schemas - those are AFFTRAANDAFFAXI-001/002
- **DO NOT** modify EmotionCalculatorService - that's AFFTRAANDAFFAXI-006/007
- **DO NOT** add tests - prototype changes are data-only
- **DO NOT** change the structure of the lookup file, only the empathic_distress entry

## Implementation Details

### Current Empathic Distress Prototype

```json
"empathic_distress": {
  "weights": {
    "valence": -0.75,
    "arousal": 0.60,
    "engagement": 0.90,
    "agency_control": -0.60,
    "self_evaluation": -0.20,
    "future_expectancy": -0.20,
    "threat": 0.15
  },
  "gates": [
    "engagement >= 0.35",
    "valence <= -0.20",
    "arousal >= 0.10",
    "agency_control <= 0.10"
  ]
}
```

### Updated Empathic Distress Prototype

```json
"empathic_distress": {
  "weights": {
    "valence": -0.75,
    "arousal": 0.60,
    "engagement": 0.75,
    "agency_control": -0.60,
    "self_evaluation": -0.20,
    "future_expectancy": -0.20,
    "threat": 0.15,
    "affective_empathy": 0.90
  },
  "gates": [
    "engagement >= 0.35",
    "valence <= -0.20",
    "arousal >= 0.10",
    "agency_control <= 0.10",
    "affective_empathy >= 0.30"
  ]
}
```

### Changes Explained

| Change | Rationale |
|--------|-----------|
| Reduce `engagement` from 0.90 to 0.75 | Still important but no longer dominant |
| Add `affective_empathy: 0.90` | **Primary factor** - being overwhelmed by others' emotions requires empathic capacity |
| Add gate `affective_empathy >= 0.30` | Requires moderate empathic capacity (30/100 minimum) |

### Effect on Sociopath Scenario

With `affective_empathy: 5` (normalized to 0.05):
- Gate `affective_empathy >= 0.30` **fails** (0.05 < 0.30)
- Empathic distress is **blocked** regardless of other axis values
- A sociopath cannot experience empathic distress, which is psychologically correct

### Psychological Rationale

Empathic distress is the experience of being overwhelmed by vicarious emotional resonance with another's suffering. It requires:
1. **Affective empathy**: The capacity to feel what others feel
2. **Negative valence**: The other person is experiencing something negative
3. **High engagement**: Attention focused on the other person
4. **Low agency**: Feeling unable to help or escape the situation

Without affective empathy, one cannot experience the emotional contagion that causes empathic distress.

## Acceptance Criteria

### Tests That Must Pass

1. **JSON syntax valid**:
   ```bash
   node -e "require('./data/mods/core/lookups/emotion_prototypes.lookup.json')"
   ```

2. **Schema validation passes**:
   ```bash
   npm run validate
   ```

3. **Existing emotion tests pass**:
   ```bash
   npm run test:unit -- --testPathPattern="emotion" --verbose
   ```

### Invariants That Must Remain True

1. **Valid JSON**: File remains syntactically valid
2. **Structure preserved**: `weights` and `gates` structure unchanged
3. **Other emotions untouched**: Only `empathic_distress` modified
4. **Gate syntax valid**: All gates follow `axis operator threshold` format
5. **Weight values in range**: All weights between -1.0 and 1.0
6. **Existing weights preserved**: All 7 original weights remain (only values adjusted)
7. **Existing gates preserved**: All 4 original gates remain

## Verification Commands

```bash
# Validate JSON syntax
node -e "const p = require('./data/mods/core/lookups/emotion_prototypes.lookup.json'); console.log('empathic_distress weights:', Object.keys(p.entries.empathic_distress.weights).length)"
# Should output: empathic_distress weights: 8

# Verify affective_empathy gate exists
grep -A 25 '"empathic_distress"' data/mods/core/lookups/emotion_prototypes.lookup.json | grep "affective_empathy"
# Should show both weight and gate

# Verify engagement weight changed
grep -A 25 '"empathic_distress"' data/mods/core/lookups/emotion_prototypes.lookup.json | grep "engagement"
# Should show 0.75

# Run schema validation
npm run validate
```

## Definition of Done

- [x] `engagement` weight reduced to 0.75
- [x] `affective_empathy` weight added at 0.90
- [x] `affective_empathy >= 0.30` gate added
- [x] All original weights preserved (values may differ)
- [x] All original gates preserved
- [x] JSON is syntactically valid
- [x] No other emotions modified
- [x] `npm run validate` passes

---

## Outcome

### What was actually changed vs originally planned

**Planned changes (all implemented as specified):**
1. ✅ Updated `empathic_distress` prototype in `emotion_prototypes.lookup.json`
2. ✅ Reduced `engagement` weight from 0.90 to 0.75
3. ✅ Added `affective_empathy: 0.90` weight
4. ✅ Added `affective_empathy >= 0.30` gate

**Additional work (per user request, not originally in ticket):**
- Added comprehensive unit tests for `empathic_distress` affect trait integration in `tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js`:
  - Test for affective_empathy weight presence and value (0.9)
  - Test for affective_empathy gate presence
  - Test for reduced engagement weight (0.75)
  - Tests for preservation of all 7 original weights
  - Tests for preservation of all 4 original gates
  - Tests for exactly 8 weights total
  - Tests for exactly 5 gates total

**Validation results:**
- `npm run validate` passes (no schema violations)
- All 972 emotion-related unit tests pass
- JSON syntax verification confirms 8 weights for empathic_distress

**No ticket corrections needed:** The ticket's assumptions about the current state of the `empathic_distress` prototype were accurate.
