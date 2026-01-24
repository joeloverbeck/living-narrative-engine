# Specification: Temporal Orientation Mood Axis

**Status**: Draft
**Created**: 2026-01-23
**Spec ID**: TEMPORI-001

## 1. Overview

### 1.1 Problem Statement

The current mood axis system conflates temporal focus (past/present/future orientation) with optimism/pessimism via the `future_expectancy` axis. For example:

- **Nostalgia** currently has `future_expectancy: -0.45`, but nostalgia is fundamentally **past-oriented mental time travel**, not hopelessness. Nostalgia is often bittersweet and can increase optimism/meaning.
- **Regret** currently has `future_expectancy: -0.3`, but regret is about dwelling on past mistakes, not pessimism about the future.

Psychology treats "temporal focus/time perspective" as separable from optimism/pessimism:
- You can be **future-focused and pessimistic** (dread)
- You can be **past-focused and optimistic** (warm nostalgia)

### 1.2 Solution

Add a new mood axis: `temporal_orientation` in [-100, +100]

| Value | Meaning | Examples |
|-------|---------|----------|
| +100 | Strongly future-focused | Planning, anticipation, "what's next" |
| 0 | Present-focused | Flow, mindfulness, task immersion |
| -100 | Strongly past-focused | Reminiscence, rumination, regret, nostalgia |

This keeps `future_expectancy` pure: evaluation of outcomes (hopeful/hopeless), not time direction.

### 1.3 Scope

This specification covers:
- Adding `temporal_orientation` to the mood component schema
- Updating all related constants, schemas, and validation
- Updating the UI display
- Updating LLM prompt instructions
- Revising emotion prototypes that misuse `future_expectancy`
- Comprehensive test coverage

---

## 2. Schema Changes

### 2.1 Mood Component Schema

**File**: `data/mods/core/components/mood.component.json`

**Changes**:

1. Update `description` to reference "11 mood axes" instead of "10 mood axes"

2. Add new property to `dataSchema.properties`:
```json
"temporal_orientation": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Future-focused (+) to past-focused (-). Mental time direction. +100=strongly future-oriented (planning, anticipation), 0=present-focused (flow, mindfulness), -100=strongly past-oriented (reminiscence, rumination, nostalgia)."
}
```

3. Add `"temporal_orientation"` to `required` array

### 2.2 Emotion Prototypes Lookup Schema

**File**: `data/mods/core/lookups/emotion_prototypes.lookup.json`

**Changes**:

Add new weight property to `dataSchema.properties.weights.properties`:
```json
"temporal_orientation": {
  "type": "number",
  "minimum": -1,
  "maximum": 1
}
```

---

## 3. Constants Updates

### 3.1 Mood Affect Constants

**File**: `src/constants/moodAffectConstants.js`

**Changes**:

1. Update JSDoc comment from "10 mood axes" to "11 mood axes"

2. Add `'temporal_orientation'` to `MOOD_AXES` array at position 7 (after `future_expectancy`):
```javascript
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'temporal_orientation',  // NEW
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
]);
```

**Rationale for position**: Grouping temporal-related axes together (`future_expectancy` + `temporal_orientation`).

**Note**: `MOOD_AXES_SET` and `isMoodAxis()` will auto-update since they derive from `MOOD_AXES`.

---

## 4. LLM Response Schema Updates

### 4.1 Schema Files

**File**: `src/turns/schemas/llmOutputSchemas.js`

**Changes** (apply to ALL moodUpdate schema definitions):

1. Add property:
```javascript
temporal_orientation: {
  type: 'integer',
  minimum: -100,
  maximum: 100,
  description: 'Future-focused (+) to past-focused (-). Mental time direction.',
},
```

2. Add `'temporal_orientation'` to `required` array

**Schema objects to update**:
- `LLM_MOOD_UPDATE_RESPONSE_SCHEMA.properties.moodUpdate`
- Any legacy schema versions that include moodUpdate

3. Update descriptions referencing "10 axes" to "11 axes"

---

## 5. UI Updates

### 5.1 Emotional State Panel

**File**: `src/domUI/emotionalStatePanel.js`

**Changes**:

1. Update JSDoc comment from "10 mood axes" to "11 mood axes"

2. Add to `AXIS_ORDER` array at position 6 (after `future_expectancy`):
```javascript
const AXIS_ORDER = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'temporal_orientation',  // NEW
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
];
```

3. Add to `AXIS_COLORS`:
```javascript
temporal_orientation: { negative: '#8B4513', positive: '#00CED1' },
```

**Color Rationale**:
- **Negative (past-focused)**: Sepia brown `#8B4513` - evokes old photographs, memories, warmth of the past
- **Positive (future-focused)**: Dark cyan/teal `#00CED1` - evokes forward movement, possibility, technology

4. Add to `AXIS_LABELS`:
```javascript
temporal_orientation: { negative: 'Past-focused', positive: 'Future-focused' },
```

---

## 6. LLM Prompt Instructions

### 6.1 Core Prompt Text

**File**: `data/prompts/corePromptText.json`

**Field**: `moodUpdateOnlyInstructionText`

**Changes**:

1. **RANGES section** - Update axis list:
```
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, temporal_orientation, self_evaluation, affiliation, inhibitory_control, uncertainty): integers [-100..100]
```

2. **AXIS DEFINITIONS section** - Add after Future Expectancy:
```
Temporal Orientation: + = future-focused (planning, anticipating, "what's next"), 0 = present-focused (flow, mindfulness, immersion), - = past-focused (reminiscing, ruminating, dwelling on memories). NOTE: This is distinct from Future Expectancy which is about hope/hopelessness, not time direction. A character can be past-focused and hopeful (warm nostalgia) or future-focused and hopeless (dread).
```

3. **DEFAULT UPDATE HEURISTICS section** - Add:
```
- Reminiscing about the past, recalling memories: Temporal Orientation↓
- Planning for future, anticipating events: Temporal Orientation↑
- Fully absorbed in current task (flow state): Temporal Orientation→0
- Regret or dwelling on past mistakes: Temporal Orientation↓, often with negative valence
- Anticipating upcoming event with interest: Temporal Orientation↑, engagement often↑
- Nostalgic reverie (bittersweet memories): Temporal Orientation↓, valence often slightly positive
- Worry about future events: Temporal Orientation↑, threat may be↑
- Mindfulness/grounding in present moment: Temporal Orientation→0
```

4. **OUTPUT FORMAT section** - Update JSON example:
```json
{
  "moodUpdate": {
    "valence": ...,
    "arousal": ...,
    "agency_control": ...,
    "threat": ...,
    "engagement": ...,
    "future_expectancy": ...,
    "temporal_orientation": ...,
    "self_evaluation": ...,
    "affiliation": ...,
    "inhibitory_control": ...,
    "uncertainty": ...
  },
  "sexualUpdate": { "sex_excitation": ..., "sex_inhibition": ... }
}
```

---

## 7. Emotion Prototype Updates (DON'T IMPLEMENT)

Note from reviewer of this spec: we will handle updating prototypes as a focused deep research task in the future. So we won't implement this section 7.

### 7.1 Prototypes Requiring Revision

**File**: `data/mods/core/lookups/emotion_prototypes.lookup.json`

The following prototypes misuse `future_expectancy` for temporal focus and need revision:

#### nostalgia (lines 669-684)

**Current** (PROBLEMATIC):
```json
"nostalgia": {
  "weights": {
    "engagement": 1.0,
    "valence": 0.25,
    "future_expectancy": -0.45,  // WRONG: nostalgia isn't hopeless
    "arousal": -0.10,
    "threat": -0.25,
    "agency_control": -0.15,
    "affiliation": 0.5
  }
}
```

**Revised**:
```json
"nostalgia": {
  "weights": {
    "engagement": 1.0,
    "valence": 0.25,
    "future_expectancy": 0.0,       // FIXED: neutral outlook
    "temporal_orientation": -0.85,  // NEW: strongly past-focused
    "arousal": -0.10,
    "threat": -0.25,
    "agency_control": -0.15,
    "affiliation": 0.5
  }
}
```

### 7.2 Additional Prototypes to Update

Search for and update these prototypes (if they exist):

| Prototype | temporal_orientation | future_expectancy adjustment | Rationale |
|-----------|---------------------|------------------------------|-----------|
| regret | -0.75 | Reduce if currently negative | Past-dwelling |
| reminiscence | -0.70 | Neutral | Memory-focused |
| anticipation | +0.70 | Keep positive if present | Future-looking |
| dread | +0.60 | Keep negative | Future worry |
| hope | +0.50 | Keep positive | Future outlook |
| longing | -0.40 | Neutral | Past/absent-oriented |
| grief | -0.40 | May be negative | Processing past loss |
| resentment | -0.50 | Neutral | Dwelling on past wrongs |
| flow | 0.0 | Neutral | Present immersion |
| mindfulness | 0.0 | Neutral | Present-centered |
| worry | +0.40 | May be negative | Future concern |
| planning_focus | +0.60 | Neutral | Forward-thinking |

### 7.3 New Gate Conditions

Consider adding gates for emotions that require specific temporal orientation:

```json
"nostalgia": {
  "gates": [
    "temporal_orientation <= -0.20",  // NEW: must be past-oriented
    "engagement >= 0.20",
    "threat <= 0.40",
    "arousal <= 0.45",
    "valence >= -0.25"
  ]
}
```

---

## 8. Test Coverage Requirements

### 8.1 Unit Tests - Constants

**File**: `tests/unit/constants/moodAffectConstants.test.js`

**New/Updated Tests**:
- [ ] `MOOD_AXES` array has length 11
- [ ] `MOOD_AXES` includes `'temporal_orientation'`
- [ ] `MOOD_AXES_SET.size` equals 11
- [ ] `isMoodAxis('temporal_orientation')` returns `true`
- [ ] `temporal_orientation` is at index 6 (after `future_expectancy`)

### 8.2 Unit Tests - LLM Schema

**File**: `tests/unit/schemas/llmOutputSchemas.test.js` and/or `tests/unit/schemas/llmMoodUpdateResponseSchema.test.js`

**New/Updated Tests**:
- [ ] Valid moodUpdate with all 11 axes passes validation
- [ ] moodUpdate missing `temporal_orientation` fails validation
- [ ] `temporal_orientation` validates range (-100 to 100)
- [ ] `temporal_orientation` must be integer (reject floats)

### 8.3 Unit Tests - Emotional State Panel

**File**: `tests/unit/domUI/emotionalStatePanel.test.js`

**New/Updated Tests**:
- [ ] Panel renders 11 axis bars
- [ ] `temporal_orientation` has correct labels ('Past-focused' / 'Future-focused')
- [ ] `temporal_orientation` has correct colors (sepia/teal)
- [ ] `temporal_orientation` appears at correct position in display order
- [ ] Bidirectional bar renders correctly for temporal_orientation values

### 8.4 Unit Tests - Prompt Instructions

**File**: Create new `tests/unit/prompting/moodUpdateInstructions.temporalOrientationAxis.test.js`

**New Tests**:
- [ ] `temporal_orientation` mentioned in axis definitions
- [ ] Semantic terms present: 'past-focused', 'future-focused', 'present-focused'
- [ ] JSON output format includes `"temporal_orientation"`
- [ ] Update heuristics mention: reminiscing, planning, flow, nostalgia
- [ ] Distinction from `future_expectancy` is documented

### 8.5 Integration Tests

**File**: Create new `tests/integration/expression-diagnostics/temporalOrientationAxis.integration.test.js`

**New Tests**:
- [ ] Emotion prototypes with `temporal_orientation` weights load correctly
- [ ] Monte Carlo simulation handles `temporal_orientation` sampling
- [ ] Prototype analysis includes `temporal_orientation` in vector dimensions
- [ ] Nostalgia prototype triggers with past-focused temporal_orientation

### 8.6 Existing Tests to Update

**Files**:
- `tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js` - Update expected axis count
- `tests/integration/schemas/llmOutputValidation.integration.test.js` - Add temporal_orientation to test fixtures
- `tests/integration/ai/moodPersistencePromptReflection.integration.test.js` - Verify temporal_orientation persists

---

## 9. Implementation Sequence

### Phase 1: Schema Foundation
1. Update `mood.component.json` - add temporal_orientation property
2. Update `emotion_prototypes.lookup.json` schema - add weight property
3. Run `npm run validate` to verify schema changes

### Phase 2: Code Constants
4. Update `moodAffectConstants.js` - add to MOOD_AXES
5. Update `llmOutputSchemas.js` - add to all moodUpdate schemas
6. Run `npm run typecheck`

### Phase 3: UI Layer
7. Update `emotionalStatePanel.js` - colors, labels, order
8. Run `npm run build`

### Phase 4: LLM Integration
9. Update `corePromptText.json` - add instructions
10. Verify prompt assembly includes new axis

### Phase 5: Emotion Prototypes (DON'T IMPLEMENT)
11. Update nostalgia prototype (priority)
12. Update other relevant prototypes (regret, anticipation, etc.)
13. Run prototype analysis to verify no conflicts

### Phase 6: Test Updates
14. Update unit tests (constants, schema, UI)
15. Create prompt instruction tests
16. Create/update integration tests
17. Run full test suite: `npm run test:ci`

### Phase 7: Verification
18. Manual testing on game.html - verify EMOTION STATE panel
19. Manual testing on expressions-simulator.html - verify Mood Axes section
20. Manual testing on prototype-analysis.html - verify Run Analysis
21. Manual testing on expression-diagnostics.html - verify analyses

---

## 10. Files to Modify

### 10.1 High Priority (Core Changes)

| File | Change Type | Description |
|------|-------------|-------------|
| `data/mods/core/components/mood.component.json` | Schema | Add temporal_orientation property |
| `src/constants/moodAffectConstants.js` | Constants | Add to MOOD_AXES array |
| `src/turns/schemas/llmOutputSchemas.js` | Schema | Add to moodUpdate schemas |
| `src/domUI/emotionalStatePanel.js` | UI | Add colors, labels, order |
| `data/prompts/corePromptText.json` | Prompt | Add LLM instructions |

### 10.2 Medium Priority (Data Updates)

| File | Change Type | Description |
|------|-------------|-------------|
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | Data | Update nostalgia, add temporal_orientation weights |

### 10.3 Test Files

| File | Change Type | Description |
|------|-------------|-------------|
| `tests/unit/constants/moodAffectConstants.test.js` | Test Update | Update expected count, add axis tests |
| `tests/unit/schemas/llmOutputSchemas.test.js` | Test Update | Add temporal_orientation validation tests |
| `tests/unit/schemas/llmMoodUpdateResponseSchema.test.js` | Test Update | Add temporal_orientation validation tests |
| `tests/unit/domUI/emotionalStatePanel.test.js` | Test Update | Add UI rendering tests |
| `tests/unit/prompting/moodUpdateInstructions.temporalOrientationAxis.test.js` | New Test | Create prompt instruction tests |
| `tests/integration/expression-diagnostics/temporalOrientationAxis.integration.test.js` | New Test | Create integration tests |

---

## 11. Risks and Mitigations

### Risk 1: Breaking Existing Saved Games
**Impact**: Low
**Mitigation**: Default value of 0 means existing entities without temporal_orientation will initialize to neutral (present-focused), which is safe behavior.

### Risk 2: LLM Output Validation Failures
**Impact**: Medium
**Mitigation**: After deployment, LLMs must return all 11 axes. Schema validation will reject incomplete responses. Consider a transition period with backward-compatible validation if needed.

### Risk 3: Emotion Prototype Rebalancing
**Impact**: Low
**Mitigation**: Only modify prototypes where temporal focus was clearly misrepresented. Run prototype analysis tool after changes to verify no unintended conflicts.

### Risk 4: UI Overflow with 11 Axes
**Impact**: Low
**Mitigation**: Current CSS should handle 11 bars. The emotionalStatePanel uses flexbox layout that scales. Verify in testing.

### Risk 5: Pages Not Auto-Updating
**Impact**: Low
**Mitigation**: Most pages (expressions-simulator, expression-diagnostics, prototype-analysis) auto-generate UI from schemas. Manual verification required.

---

## 12. Acceptance Criteria

- [ ] `npm run validate` passes with new schema
- [ ] `npm run typecheck` passes
- [ ] `npm run test:ci` passes (all unit, integration, e2e tests)
- [ ] `npx eslint <modified-files>` passes
- [ ] game.html EMOTION STATE panel shows 11 axes with correct temporal_orientation display
- [ ] expressions-simulator.html shows temporal_orientation slider
- [ ] prototype-analysis.html Run Analysis includes temporal_orientation
- [ ] expression-diagnostics.html analyses include temporal_orientation
- [ ] Nostalgia emotion triggers appropriately with past-focused temporal_orientation
- [ ] LLM mood update responses include temporal_orientation and persist correctly

---

## 13. Future Considerations

### 13.1 Additional Prototypes
After initial implementation, consider adding more temporal-focused emotion prototypes:
- anticipatory_excitement (future + positive valence + high arousal)
- wistfulness (past + neutral valence + low arousal)
- mindful_presence (present + positive valence + calm)

### 13.2 Gate Complexity
The temporal_orientation axis may enable more nuanced gate conditions for emotions that require specific temporal focus.

### 13.3 Interaction with Other Systems
Consider how temporal_orientation might affect:
- Action availability (planning actions require future focus?)
- Memory/note generation (past focus triggers reminiscence?)
- Social interactions (present focus aids connection?)

These are future enhancements, not part of this initial implementation.
