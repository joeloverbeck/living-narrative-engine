# UNCMOOAXI-004: Update Existing Epistemic Prototypes

## Summary

Update 4 existing emotion prototypes to include `uncertainty` weights and gates. These prototypes already exist and represent epistemic-adjacent states that should reference the new uncertainty axis.

## Priority: High | Effort: Medium

## Rationale

Four existing prototypes have epistemic components that should be explicitly tied to the uncertainty axis:
- **confusion** - The core epistemic state, needs highest uncertainty weight
- **curiosity** - Engagement with unknown, needs moderate uncertainty
- **suspicion** - Uncertainty about intentions, needs moderate uncertainty
- **awe** - Overwhelming novelty, needs moderate uncertainty

Updating these creates clear separation from frustration/anxiety states that rely on different axis patterns.

## Dependencies

- **UNCMOOAXI-001** must be complete (constants)
- **UNCMOOAXI-003** must be complete (prototype schema allows uncertainty)

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | **Modify** - Update 4 existing entries |

## Out of Scope

- **DO NOT** create new prototypes - that's UNCMOOAXI-005
- **DO NOT** modify the schema section - that's UNCMOOAXI-003
- **DO NOT** modify other non-epistemic prototypes
- **DO NOT** update test files - that's UNCMOOAXI-006

## Implementation Details

### Prototype 1: confusion (line ~1557)

**Current:**
```json
"confusion": {
  "weights": {
    "engagement": 0.3,
    "arousal": 0.2,
    "agency_control": -0.5,
    "valence": -0.2,
    "self_control": -0.3,
    "inhibitory_control": -0.2
  },
  "gates": [
    "agency_control <= 0.20"
  ]
}
```

**Updated:**
```json
"confusion": {
  "weights": {
    "uncertainty": 1.0,
    "engagement": 0.4,
    "arousal": 0.2,
    "agency_control": -0.2,
    "valence": -0.1,
    "inhibitory_control": 0.2
  },
  "gates": [
    "uncertainty >= 0.30"
  ]
}
```

**Changes:**
- Add `uncertainty: 1.0` (primary axis for confusion)
- Reduce `agency_control` weight from -0.5 to -0.2 (no longer primary differentiator)
- Reduce `valence` weight from -0.2 to -0.1 (confusion isn't necessarily unpleasant)
- Change `inhibitory_control` from -0.2 to 0.2 (confusion often involves hesitation/pause)
- Remove `self_control` (not a mood axis, was erroneously included)
- Change gate from `agency_control <= 0.20` to `uncertainty >= 0.30`

### Prototype 2: curiosity (line ~284)

**Current:**
```json
"curiosity": {
  "weights": {
    "engagement": 1.0,
    "arousal": 0.6,
    "threat": -0.2,
    "valence": 0.2,
    "inhibitory_control": -0.1,
    "self_control": 0.1
  },
  "gates": [
    "engagement >= 0.20",
    "threat <= 0.40"
  ]
}
```

**Updated:**
```json
"curiosity": {
  "weights": {
    "uncertainty": 0.7,
    "engagement": 0.9,
    "valence": 0.3,
    "arousal": 0.4,
    "threat": -0.3
  },
  "gates": [
    "engagement >= 0.20",
    "threat <= 0.30"
  ]
}
```

**Changes:**
- Add `uncertainty: 0.7` (curiosity involves engagement with unknown)
- Reduce `engagement` from 1.0 to 0.9 (uncertainty now shares primary weight)
- Adjust `arousal` from 0.6 to 0.4
- Adjust `valence` from 0.2 to 0.3 (curiosity is slightly positive)
- Adjust `threat` gate from 0.40 to 0.30 (tighter constraint)
- Remove `inhibitory_control` and `self_control` (not core to curiosity)

### Prototype 3: suspicion (line ~920)

**Current:**
```json
"suspicion": {
  "weights": {
    "threat": 0.65,
    "engagement": 0.70,
    "arousal": 0.30,
    "valence": -0.25,
    "agency_control": 0.10,
    "future_expectancy": -0.10,
    "self_evaluation": 0.00,
    "affiliation": -0.2
  },
  "gates": [
    "threat >= 0.15",
    "threat <= 0.60",
    "engagement >= 0.25",
    "arousal >= 0.00"
  ]
}
```

**Updated:**
```json
"suspicion": {
  "weights": {
    "uncertainty": 0.6,
    "threat": 0.5,
    "engagement": 0.4,
    "affiliation": -0.4,
    "valence": -0.2,
    "arousal": 0.3
  },
  "gates": [
    "threat >= 0.15",
    "uncertainty >= 0.20"
  ]
}
```

**Changes:**
- Add `uncertainty: 0.6` (suspicion is uncertainty about others' intentions)
- Simplify weights to focus on core axes
- Add `uncertainty >= 0.20` gate
- Simplify gates (remove redundant conditions)

### Prototype 4: awe (line ~224)

**Current:**
```json
"awe": {
  "weights": {
    "valence": 0.4,
    "arousal": 0.9,
    "agency_control": -0.5,
    "engagement": 0.6,
    "inhibitory_control": -0.3,
    "self_control": -0.2
  },
  "gates": [
    "arousal >= 0.30",
    "engagement >= 0.20"
  ]
}
```

**Updated:**
```json
"awe": {
  "weights": {
    "uncertainty": 0.5,
    "engagement": 0.8,
    "arousal": 0.7,
    "valence": 0.4,
    "agency_control": -0.4
  },
  "gates": [
    "arousal >= 0.30",
    "engagement >= 0.20"
  ]
}
```

**Changes:**
- Add `uncertainty: 0.5` (awe involves confronting the vast/unknown)
- Adjust `engagement` from 0.6 to 0.8 (awe is highly engaging)
- Adjust `arousal` from 0.9 to 0.7
- Reduce `agency_control` from -0.5 to -0.4
- Remove `inhibitory_control` and `self_control` (not core to awe)

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
2. **Prototype IDs**: Prototype names unchanged (confusion, curiosity, suspicion, awe)
3. **Weight Range**: All weights in [-1, 1]
4. **Gate Syntax**: Gates use valid comparison syntax
5. **No Other Changes**: Only these 4 prototypes modified

## Verification Commands

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/core/lookups/emotion_prototypes.lookup.json', 'utf8')); console.log('Valid JSON')"

# Run schema validation
npm run validate

# Verify uncertainty weights added
node -e "
  const data = JSON.parse(require('fs').readFileSync('data/mods/core/lookups/emotion_prototypes.lookup.json', 'utf8'));
  const prototypes = ['confusion', 'curiosity', 'suspicion', 'awe'];
  prototypes.forEach(p => {
    const weights = data.entries[p]?.weights || {};
    console.log(p + ': uncertainty=' + (weights.uncertainty ?? 'MISSING'));
  });
"
```

## Definition of Done

- [ ] `confusion` prototype updated with uncertainty weight 1.0 and uncertainty gate
- [ ] `curiosity` prototype updated with uncertainty weight 0.7
- [ ] `suspicion` prototype updated with uncertainty weight 0.6 and uncertainty gate
- [ ] `awe` prototype updated with uncertainty weight 0.5
- [ ] All weights within [-1, 1] range
- [ ] File remains valid JSON
- [ ] `npm run validate` passes
- [ ] `npm run validate:strict` passes
