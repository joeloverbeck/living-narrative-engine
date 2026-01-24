# UNCMOOAXI-005: Create New Epistemic Prototypes

## Summary

Create 5 new emotion prototypes that leverage the uncertainty axis to represent distinct epistemic states: perplexity, wonder, doubt, bewilderment, and disorientation.

## Priority: Medium | Effort: Medium

## Rationale

The spec identifies 5 additional epistemic emotions that should be represented in the prototype system:
- **perplexity** - Strong uncertainty focus, similar to confusion but more intense
- **wonder** - Positive uncertainty, engagement with mysterious/beautiful
- **doubt** - Self-directed uncertainty about beliefs/decisions
- **bewilderment** - Intense confusion with disorientation
- **disorientation** - Situational uncertainty, loss of bearings

These prototypes complete the epistemic emotion family and enable rich NPC emotional responses to ambiguous situations.

## Dependencies

- **UNCMOOAXI-001** must be complete (constants)
- **UNCMOOAXI-003** must be complete (prototype schema allows uncertainty)
- **UNCMOOAXI-004** should be complete (establishes patterns for epistemic prototypes)

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | **Modify** - Add 5 new entries to `entries` object |

## Out of Scope

- **DO NOT** modify existing prototypes - that's UNCMOOAXI-004
- **DO NOT** modify the schema section - that's UNCMOOAXI-003
- **DO NOT** update test files - that's UNCMOOAXI-006/007

## Implementation Details

### New Prototype 1: perplexity

Add to `entries` object (alphabetically near existing epistemic emotions):

```json
"perplexity": {
  "weights": {
    "uncertainty": 0.9,
    "engagement": 0.5,
    "arousal": 0.4,
    "agency_control": -0.3,
    "valence": -0.15
  },
  "gates": [
    "uncertainty >= 0.40"
  ]
}
```

**Design rationale:**
- Higher uncertainty (0.9) than confusion (1.0) - perplexity is slightly less extreme
- Moderate engagement - actively trying to understand
- Slightly negative valence - mild frustration component
- Reduced agency - feeling stuck

### New Prototype 2: wonder

```json
"wonder": {
  "weights": {
    "uncertainty": 0.6,
    "engagement": 0.9,
    "valence": 0.6,
    "arousal": 0.5,
    "threat": -0.4
  },
  "gates": [
    "engagement >= 0.30",
    "valence >= 0.10",
    "threat <= 0.25"
  ]
}
```

**Design rationale:**
- Moderate uncertainty (0.6) - wonder embraces the unknown positively
- Very high engagement - wonder is captivating
- Positive valence - wonder is pleasant
- Low threat - wonder requires feeling safe to marvel

### New Prototype 3: doubt

```json
"doubt": {
  "weights": {
    "uncertainty": 0.8,
    "self_evaluation": -0.4,
    "agency_control": -0.3,
    "valence": -0.2,
    "engagement": 0.3,
    "future_expectancy": -0.2
  },
  "gates": [
    "uncertainty >= 0.30",
    "self_evaluation <= 0.30"
  ]
}
```

**Design rationale:**
- High uncertainty (0.8) - doubt is fundamentally about not knowing
- Negative self_evaluation - doubt often involves questioning oneself
- Reduced agency - doubt undermines confidence in action
- Moderate engagement - doubt is mentally active
- Negative future_expectancy - doubt dampens optimism

### New Prototype 4: bewilderment

```json
"bewilderment": {
  "weights": {
    "uncertainty": 0.95,
    "arousal": 0.6,
    "engagement": 0.4,
    "agency_control": -0.5,
    "valence": -0.3,
    "inhibitory_control": 0.3
  },
  "gates": [
    "uncertainty >= 0.50",
    "arousal >= 0.20"
  ]
}
```

**Design rationale:**
- Very high uncertainty (0.95) - bewilderment is intense confusion
- Higher arousal - bewilderment is more activated than simple confusion
- Strong loss of agency - feeling overwhelmed
- Positive inhibitory_control - tendency to freeze/pause
- More negative valence - bewilderment is distressing

### New Prototype 5: disorientation

```json
"disorientation": {
  "weights": {
    "uncertainty": 0.9,
    "agency_control": -0.6,
    "arousal": 0.3,
    "engagement": 0.2,
    "threat": 0.3,
    "valence": -0.25
  },
  "gates": [
    "uncertainty >= 0.45",
    "agency_control <= 0.20"
  ]
}
```

**Design rationale:**
- Very high uncertainty (0.9) - lost sense of situation
- Strong loss of agency - can't orient or act effectively
- Moderate threat - disorientation implies vulnerability
- Lower engagement - withdrawal/disconnection
- Negative valence - distressing state

### Placement in File

Add new entries alphabetically within the `entries` object. Suggested locations:
- `bewilderment` - after "bitterness", before "bliss"
- `disorientation` - after "disappointment", before "disgust"
- `doubt` - after "dread", before "embarrassment"
- `perplexity` - after "passion", before "peace"
- `wonder` - after "wistfulness", before end of entries

## Acceptance Criteria

### Tests That Must Pass

```bash
# Schema validation
npm run validate

# Strict validation
npm run validate:strict
```

### Invariants That Must Remain True

1. **JSON Valid**: File must be valid JSON
2. **Unique Names**: No duplicate prototype names
3. **Weight Range**: All weights in [-1, 1]
4. **Gate Syntax**: Gates use valid comparison syntax
5. **Required Fields**: Each prototype has `weights` object (gates optional)
6. **No Schema Changes**: Only entries section modified

## Verification Commands

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/core/lookups/emotion_prototypes.lookup.json', 'utf8')); console.log('Valid JSON')"

# Run schema validation
npm run validate

# Verify new prototypes exist
node -e "
  const data = JSON.parse(require('fs').readFileSync('data/mods/core/lookups/emotion_prototypes.lookup.json', 'utf8'));
  const newPrototypes = ['perplexity', 'wonder', 'doubt', 'bewilderment', 'disorientation'];
  newPrototypes.forEach(p => {
    const entry = data.entries[p];
    if (entry) {
      console.log(p + ': uncertainty=' + (entry.weights.uncertainty ?? 'MISSING'));
    } else {
      console.log(p + ': NOT FOUND');
    }
  });
  console.log('Total prototypes:', Object.keys(data.entries).length);
"
```

## Definition of Done

- [ ] `perplexity` prototype created with uncertainty weight 0.9
- [ ] `wonder` prototype created with uncertainty weight 0.6
- [ ] `doubt` prototype created with uncertainty weight 0.8
- [ ] `bewilderment` prototype created with uncertainty weight 0.95
- [ ] `disorientation` prototype created with uncertainty weight 0.9
- [ ] All new prototypes have appropriate gates
- [ ] All weights within [-1, 1] range
- [ ] File remains valid JSON
- [ ] Total prototype count increased by 5 (93 → 98)
- [ ] `npm run validate` passes
- [ ] `npm run validate:strict` passes
