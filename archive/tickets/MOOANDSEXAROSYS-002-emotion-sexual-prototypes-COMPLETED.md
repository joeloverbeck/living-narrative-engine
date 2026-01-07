# MOOANDSEXAROSYS-002: Emotion and Sexual Prototype Lookups

## Summary

Create the lookup data files containing emotion prototypes (55 entries) and sexual state prototypes (11 entries) that define how emotions are calculated from mood axes.

> **Correction**: Originally stated 50 emotion entries, but brainstorming document contains 55. Corrected per user approval.

## Files to Touch

### CREATE

- `data/mods/core/lookups/emotion_prototypes.lookup.json`
- `data/mods/core/lookups/sexual_prototypes.lookup.json`

## Out of Scope

- EmotionCalculatorService implementation (consumes these lookups) - see MOOANDSEXAROSYS-003
- Component definitions - see MOOANDSEXAROSYS-001
- Any service code or DI registration
- UI panels
- Prompt integration

## Technical Specification

### Lookup IDs

- Emotion prototypes: `core:emotion_prototypes`
- Sexual prototypes: `core:sexual_prototypes`

### emotion_prototypes.lookup.json Structure

Each entry contains:
- `weights`: Object mapping axis names to weight coefficients `[-1.0, 1.0]`
  - Valid keys: `valence`, `arousal`, `agency_control`, `threat`, `engagement`, `future_expectancy`, `self_evaluation`, `sexual_arousal`
- `gates`: Array of prerequisite conditions (optional)
  - Format: `"axis_name operator value"` (e.g., `"valence >= 0.20"`)
  - Valid operators: `>=`, `<=`, `>`, `<`, `==`
  - Values are normalized floats `[-1.0, 1.0]`

### Required Emotion Entries (55 total)

**Low-Arousal Positive (4)**: calm, contentment, relief, confidence

**High-Arousal Positive (5)**: joy, enthusiasm, amusement, awe, inspiration

**Engagement-Based (4)**: interest, curiosity, fascination, flow

**Future-Oriented Positive (4)**: hope, optimism, determination, anticipation

**Low-Arousal Negative (7)**: sadness, grief, disappointment, despair, numbness, fatigue, loneliness

**Disengagement (2)**: boredom, apathy

**Threat-Based (7)**: unease, anxiety, fear, terror, dread, hypervigilance, alarm

**Anger Family (7)**: irritation, frustration, anger, rage, resentment, contempt, disgust

**Self-Evaluation (5)**: pride, shame, embarrassment, guilt, humiliation

**Self-Comparison (2)**: envy, jealousy

**Social/Relational (3)**: trust, admiration, gratitude

**Attachment (3)**: affection, love_attachment, hatred

**Surprise/Confusion (2)**: surprise_startle, confusion

### sexual_prototypes.lookup.json Structure

Same structure as emotion prototypes. All entries use `sexual_arousal` in gates.

### Required Sexual Entries (11 total)

1. `sexual_lust` - High arousal, positive context
2. `sexual_sensual_pleasure` - Arousal with pleasure focus
3. `sexual_playfulness` - Arousal with engagement/fun
4. `romantic_yearning` - Lower arousal, future-focused
5. `sexual_confident` - Arousal with agency
6. `aroused_with_shame` - Arousal conflicting with self-evaluation
7. `fearful_arousal` - Arousal with danger
8. `sexual_performance_anxiety` - Arousal with threat and low agency
9. `sexual_frustration` - Arousal with negative valence
10. `afterglow` - Low arousal, positive state
11. `aroused_with_disgust` - Arousal with strong disgust

## Acceptance Criteria

### Validation

- [x] `npm run validate` passes with no errors
- [x] Both lookup JSON files are valid against `lookup.schema.json`
- [x] Lookup IDs follow namespaced format: `core:emotion_prototypes`, `core:sexual_prototypes`

### Emotion Prototypes Invariants

- [x] Exactly 55 emotion entries defined
- [x] All weight values are in range `[-1.0, 1.0]`
- [x] All gate values are in range `[-1.0, 1.0]` (normalized)
- [x] Gate patterns match regex: `^(valence|arousal|agency_control|threat|engagement|future_expectancy|self_evaluation|sexual_arousal)\s*(>=|<=|>|<|==)\s*-?[0-9]+(\.[0-9]+)?$`
- [x] Each entry has `weights` object (required)
- [x] `gates` array is optional per entry

### Sexual Prototypes Invariants

- [x] Exactly 11 sexual state entries defined
- [x] All weight values are in range `[-1.0, 1.0]`
- [x] All entries that are sexual-specific have `sexual_arousal` in gates
- [x] `afterglow` is the exception (may not require high sexual_arousal gate)

### Entry Verification

```bash
# Count emotion entries
node -e "const d = require('./data/mods/core/lookups/emotion_prototypes.lookup.json'); console.log('Emotion entries:', Object.keys(d.entries).length)"

# Count sexual entries
node -e "const d = require('./data/mods/core/lookups/sexual_prototypes.lookup.json'); console.log('Sexual entries:', Object.keys(d.entries).length)"
```

### Test Commands

```bash
# Validate mod structure
npm run validate

# Verify JSON is parseable
node -e "require('./data/mods/core/lookups/emotion_prototypes.lookup.json')"
node -e "require('./data/mods/core/lookups/sexual_prototypes.lookup.json')"
```

## Dependencies

- None (data-only ticket, but logically follows MOOANDSEXAROSYS-001)

## Dependent Tickets

- MOOANDSEXAROSYS-003 (EmotionCalculatorService loads and processes these lookups)

## Outcome

**Status**: COMPLETED

**Date Completed**: 2026-01-05

### Files Created

- `data/mods/core/lookups/emotion_prototypes.lookup.json` - 55 emotion entries with weights and gates
- `data/mods/core/lookups/sexual_prototypes.lookup.json` - 11 sexual state entries with weights and gates
- `tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js` - Comprehensive unit tests
- `tests/unit/mods/core/lookups/sexualPrototypes.lookup.test.js` - Comprehensive unit tests

### Files Modified

- `data/mods/core/mod-manifest.json` - Added `lookups` section with both lookup files

### Validation Results

- `npm run validate` passed with 0 violations across 119 mods
- All unit tests pass (375+ test cases covering structure, weights, gates, and edge cases)

### Notes

- Ticket originally stated 50 emotion entries but brainstorming document contained 55 - corrected with user approval
- Both lookup files use the same 8-axis model: valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, sexual_arousal
- Gate syntax follows pattern: `"axis operator value"` (e.g., `"valence >= 0.20"`)
- The `afterglow` sexual state is intentionally designed without a high sexual_arousal gate requirement
