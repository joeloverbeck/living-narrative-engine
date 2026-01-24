# Specification: New Mood Axes and Affect Traits

## Problem Statement

The current mood axis system has conceptual gaps that force existing axes to act as proxies for distinct psychological states:

1. **Disgust without social context**: Currently, disgust states use `affiliation−` as a proxy, but visceral disgust (contamination/pathogen/purity violation) is distinct from social coldness. You can feel nauseous at blood while still caring deeply about an injured person.

2. **Rumination without temporal dimension**: The `temporal_orientation` axis captures past-vs-future focus, but not the "stickiness" of thought. A character can be past-focused with easy disengagement (healthy reminiscence) or past-focused with obsessive replay (rumination). Current system cannot distinguish these.

3. **Social evaluation pressure**: Stage fright and being-watched states are currently hacked via `threat` + `self_evaluation`, but confident performers can still feel scrutinized without those axes being accurate proxies.

These gaps lead to "axis hacking" where prototypes and expressions use combinations that conceptually mismatch their intended psychological states.

---

## Proposed Additions

### New Mood Axes (range: -100 to +100)

| Axis | Negative Pole | Neutral | Positive Pole | Psychological Meaning |
|------|---------------|---------|---------------|----------------------|
| `contamination_salience` | Pure/clean/uncontaminated | Neutral | Contaminated/revolting/repulsive | Visceral disgust, pathogen cues, purity violations. Distinct from threat (danger) and affiliation (social distance). |
| `rumination` | Mentally flexible/easy disengagement | Neutral | Sticky repetitive replay | Perseveration, obsessive review, intrusive thoughts. Can't let go of a thought. Distinct from temporal_orientation (direction) and engagement (capture). |
| `evaluation_pressure` | Not scrutinized/unobserved | Neutral | Intensely scrutinized/being judged | Social-evaluative exposure, being watched, performance context. Distinct from threat (danger) and self_evaluation (self-worth). A confident performer can feel high evaluation_pressure without low self_evaluation. |

### New Affect Traits (range: 0 to 100)

| Trait | Low Value | Average | High Value | Psychological Meaning |
|-------|-----------|---------|------------|----------------------|
| `disgust_sensitivity` | Iron stomach (0) | Average (50) | Highly squeamish (100) | Stable proneness for contamination_salience to spike. Modulates disgust responses. |
| `ruminative_tendency` | Mentally flexible (0) | Average (50) | Prone to rumination (100) | Stable proneness for rumination axis to spike. Affects recovery from negative thought loops. |
| `evaluation_sensitivity` | Unaffected by observation (0) | Average (50) | Highly sensitive to scrutiny (100) | Stable proneness for evaluation_pressure to spike. Affects how easily the character feels watched/judged. |

---

## Architecture Overview

The mood/affect system follows a **single source of truth** pattern:

```
Source of Truth (Constants)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ src/constants/moodAffectConstants.js                          │
│ - MOOD_AXES array (currently 11, will be 14)                  │
│ - AFFECT_TRAITS array (currently 4, will be 7)                │
│ - MOOD_AXES_SET, AFFECT_TRAITS_SET (auto-computed)            │
│ - DEFAULT_AFFECT_TRAITS object                                │
│ - isMoodAxis(), isAffectTrait() helper functions              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│ src/constants/prototypeAxisConstants.js                       │
│ - ALL_PROTOTYPE_WEIGHT_AXES (auto-combines via spread)        │
│ - isValidPrototypeWeightAxis(), getAxisCategory()             │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
Component Schemas (Validation)
┌───────────────────────────────────────────────────────────────┐
│ data/mods/core/components/mood.component.json                 │
│ data/mods/core/components/affect_traits.component.json        │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
Consumers (Auto-discover from constants/schemas)
┌───────────────────────────────────────────────────────────────┐
│ - Expression Simulator (reads schema properties dynamically)  │
│ - Expression Diagnostics (uses normalization utils)           │
│ - Prototype Analysis (uses constants for sampling)            │
│ - Emotion Calculator Service (reads from components)          │
└───────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Constants and Schema Updates (Foundation)

These changes establish the single source of truth and must be done atomically.

#### 1.1 Update `src/constants/moodAffectConstants.js`

**Changes**:
```javascript
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'temporal_orientation',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
  'contamination_salience',  // NEW
  'rumination',              // NEW
  'evaluation_pressure',     // NEW
]);

export const AFFECT_TRAITS = Object.freeze([
  'affective_empathy',
  'cognitive_empathy',
  'harm_aversion',
  'self_control',
  'disgust_sensitivity',     // NEW
  'ruminative_tendency',     // NEW
  'evaluation_sensitivity',  // NEW
]);

export const DEFAULT_AFFECT_TRAITS = Object.freeze({
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,
  disgust_sensitivity: 50,   // NEW
  ruminative_tendency: 50,   // NEW
  evaluation_sensitivity: 50, // NEW
});
```

#### 1.2 Update `data/mods/core/components/mood.component.json`

**Add properties**:
```json
"contamination_salience": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Non-contaminating/neutral (-) to highly contaminating/revolting (+). Visceral repulsion / pathogen-purity salience; distinct from danger (threat) and from social distance (affiliation)."
},
"rumination": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Mentally flexible/easy disengagement (-) to sticky repetitive replay (+). Perseveration, obsessive review, intrusive thoughts."
},
"evaluation_pressure": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Not scrutinized/unobserved (-) to intensely scrutinized/being judged (+). Social-evaluative exposure, being watched, performance context. Distinct from threat (danger) and self_evaluation (self-worth)."
}
```

**Update required array**:
```json
"required": [
  "valence", "arousal", "agency_control", "threat", "engagement",
  "future_expectancy", "temporal_orientation", "self_evaluation",
  "affiliation", "inhibitory_control", "uncertainty",
  "contamination_salience", "rumination", "evaluation_pressure"
]
```

#### 1.3 Update `data/mods/core/components/affect_traits.component.json`

**Add properties**:
```json
"disgust_sensitivity": {
  "type": "integer",
  "minimum": 0,
  "maximum": 100,
  "default": 50,
  "description": "How easily/intensely contamination_salience spikes. 0=iron stomach, 50=average, 100=highly squeamish/contamination-reactive."
},
"ruminative_tendency": {
  "type": "integer",
  "minimum": 0,
  "maximum": 100,
  "default": 50,
  "description": "How easily rumination axis spikes. 0=mentally flexible/recovers quickly, 50=average, 100=prone to getting stuck in thought loops."
},
"evaluation_sensitivity": {
  "type": "integer",
  "minimum": 0,
  "maximum": 100,
  "default": 50,
  "description": "How easily evaluation_pressure spikes. 0=unaffected by observation, 50=average, 100=highly sensitive to scrutiny/being watched."
}
```

**Update required array**:
```json
"required": [
  "affective_empathy", "cognitive_empathy", "harm_aversion", "self_control",
  "disgust_sensitivity", "ruminative_tendency", "evaluation_sensitivity"
]
```

---

### Phase 2: UI Updates (Emotional State Panel)

#### 2.1 Update `src/domUI/emotionalStatePanel.js`

**Add to `AXIS_COLORS` object**:
```javascript
contamination_salience: { negative: '#90EE90', positive: '#8B0000' },
rumination: { negative: '#87CEEB', positive: '#483D8B' },
evaluation_pressure: { negative: '#E6E6FA', positive: '#FF6347' },
```

**Color Rationale**:
- `contamination_salience`: Light green (#90EE90) for pure/clean → Dark red (#8B0000) for contaminated. Evokes pathogen/blood/danger without overlapping threat's green-to-red scheme.
- `rumination`: Sky blue (#87CEEB) for mental flexibility → Dark slate blue (#483D8B) for stuck thoughts. Cool colors suggest mental states; darker = heavier/stuck.
- `evaluation_pressure`: Lavender (#E6E6FA) for unobserved/relaxed → Tomato red (#FF6347) for scrutinized/judged. Social warmth colors; red evokes spotlight/attention.

**Add to `AXIS_LABELS` object**:
```javascript
contamination_salience: { negative: 'Pure/Clean', positive: 'Contaminated' },
rumination: { negative: 'Flexible', positive: 'Ruminating' },
evaluation_pressure: { negative: 'Unobserved', positive: 'Scrutinized' },
```

**Add to `AXIS_ORDER` array** (append at end):
```javascript
const AXIS_ORDER = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'temporal_orientation',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
  'contamination_salience',  // NEW
  'rumination',              // NEW
  'evaluation_pressure',     // NEW
];
```

---

### Phase 3: LLM Prompt System Updates

#### 3.1 Update `data/prompts/corePromptText.json`

**Modify `moodUpdateOnlyInstructionText`**:

**Update RANGES section** (add new axes to list):
```
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, temporal_orientation, self_evaluation, affiliation, inhibitory_control, uncertainty, contamination_salience, rumination, evaluation_pressure): integers [-100..100]
```

**Add to AXIS DEFINITIONS section**:
```
Contamination Salience: + = contaminated/revolting/repulsive (visceral disgust, purity violation, pathogen cue), - = pure/clean/uncontaminated. Note: This is distinct from threat (danger) and affiliation (social distance). High contamination_salience does not require social coldness.
Rumination: + = stuck/perseverating/repetitive replay (can't disengage, obsessive review, intrusive thoughts), - = mentally flexible/easy disengagement. Note: This is distinct from temporal_orientation (time direction) and engagement (attention capture). A character can be highly engaged with the present while low on rumination.
Evaluation Pressure: + = intensely scrutinized/being judged (stage fright, social-evaluative exposure, performance context), - = not scrutinized/unobserved. Note: This is distinct from threat (danger) and self_evaluation (self-worth). A confident performer can feel high evaluation_pressure without low self_evaluation.
```

**Add to DEFAULT UPDATE HEURISTICS section**:
```
- Encountering filth/gore/bodily waste: Contamination Salience up
- Moral violation witnessed (purity dimension): Contamination Salience up
- Disgusting food/smell/texture: Contamination Salience up
- Clean environment, cleansing ritual, bathing: Contamination Salience down
- Distance from contamination source: Contamination Salience down
- Past mistake or regret triggered: Rumination up
- Unresolved conflict recalled: Rumination up
- Obsessing over what-ifs or could-have-beens: Rumination up
- Successful distraction/engagement in present: Rumination down
- Mindfulness/grounding exercise: Rumination down
- Novel engaging stimulus that captures attention: Rumination down
- Completing a closure or resolution: Rumination down
- Being watched, observed, or evaluated by others: Evaluation Pressure up
- Public speaking, performance, or presentation: Evaluation Pressure up
- Interview, audition, or test situation: Evaluation Pressure up
- Being alone or in private: Evaluation Pressure down
- Among trusted friends/family (non-judgmental context): Evaluation Pressure down
- Completing a performance/leaving spotlight: Evaluation Pressure down
- Receiving positive feedback reducing self-consciousness: Evaluation Pressure down
```

**Update OUTPUT FORMAT JSON example**:
```json
{
  "moodUpdate": { "valence": ..., "arousal": ..., "agency_control": ..., "threat": ..., "engagement": ..., "future_expectancy": ..., "temporal_orientation": ..., "self_evaluation": ..., "affiliation": ..., "inhibitory_control": ..., "uncertainty": ..., "contamination_salience": ..., "rumination": ..., "evaluation_pressure": ... },
  "sexualUpdate": { "sex_excitation": ..., "sex_inhibition": ... }
}
```

---

### Phase 4: Verification (No Changes Expected)

These systems should auto-discover new axes from constants/schemas:

| System | Location | Verification Method |
|--------|----------|---------------------|
| Expression Simulator | `src/domUI/expressions-simulator/` | Reads schema properties dynamically; verify sliders appear |
| Expression Diagnostics | `src/expressionDiagnostics/` | Uses normalization utils; verify analysis includes new axes |
| Prototype Analysis | `src/expressionDiagnostics/services/` | Uses MOOD_AXES/AFFECT_TRAITS constants; verify sampling includes new axes |
| Prototype Axis Constants | `src/constants/prototypeAxisConstants.js` | Auto-updates via spread operators; no changes needed |

---

### Phase 5: Test Updates

#### 5.1 Update `tests/unit/constants/moodAffectConstants.test.js`

**Changes**:
- Update MOOD_AXES length expectation: 11 → 14
- Update AFFECT_TRAITS length expectation: 4 → 7
- Add new axes/traits to expected arrays
- Add `contamination_salience`, `rumination`, and `evaluation_pressure` to `isMoodAxis()` tests
- Add `disgust_sensitivity`, `ruminative_tendency`, and `evaluation_sensitivity` to `isAffectTrait()` tests
- Update `DEFAULT_AFFECT_TRAITS` tests

#### 5.2 Create New Test Cases

**Unit tests**:
- Verify new mood axes have correct default value (0)
- Verify new affect traits have correct default value (50)
- Verify `getAxisCategory()` returns correct categories for new axes

**Integration tests to verify still pass**:
- `tests/integration/ai/moodSexualPersistenceListener.integration.test.js`
- `tests/integration/prompting/moodUpdatePromptGeneration.integration.test.js`
- Expression-related integration tests

---

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `src/constants/moodAffectConstants.js` | Modify | Add 3 mood axes, 3 affect traits, update defaults |
| `data/mods/core/components/mood.component.json` | Modify | Add 3 property definitions, update required array |
| `data/mods/core/components/affect_traits.component.json` | Modify | Add 3 property definitions, update required array |
| `src/domUI/emotionalStatePanel.js` | Modify | Add colors, labels, order for 3 new axes |
| `data/prompts/corePromptText.json` | Modify | Add axis definitions and heuristics for 3 new axes |
| `tests/unit/constants/moodAffectConstants.test.js` | Modify | Update expectations for new counts (14 mood, 7 traits) |

---

## Files NOT to Modify (Per Constraints)

- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Prototype modifications deferred
- `data/mods/core/lookups/sexual_prototypes.lookup.json` - Prototype modifications deferred

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 1 (Constants/Schemas) | LOW | Simple additions to frozen arrays; existing tests catch type mismatches |
| Phase 2 (UI) | MEDIUM | Color choices affect UX; can iterate; no breaking changes |
| Phase 3 (LLM Prompts) | HIGH | Affects AI behavior directly; requires end-to-end testing with actual LLM |
| Phase 4 (Verification) | LOW | Read-only verification; no code changes |
| Phase 5 (Tests) | LOW | Straightforward test updates |

---

## Verification Checklist

After implementation, verify:

1. [ ] `npm run typecheck` passes
2. [ ] `npm run lint` passes (or `npx eslint <modified-files>`)
3. [ ] `npm run test:unit` passes
4. [ ] `npm run test:integration` passes
5. [ ] Expression Simulator shows 14 mood axis sliders (not 11)
6. [ ] Expression Simulator shows 7 affect trait sliders (not 4)
7. [ ] game.html Emotional State panel shows 14 bars with correct colors/labels
8. [ ] "Prompt to LLM" button shows new axis definitions in prompt text (all 3 new axes)
9. [ ] Expression Diagnostics reports include new axes in analysis

---

## Future Refactoring Opportunities

### Opportunity 1: Centralized Axis Metadata Registry

**Current State**: Axis colors, labels, and ordering are defined separately in `emotionalStatePanel.js`, duplicating information that could be derived from a single source.

**Proposed Pattern**: Create `src/constants/moodAxisRegistry.js` following the pattern established by `src/anatomy/registries/bodyDescriptorRegistry.js`:

```javascript
export const MOOD_AXIS_REGISTRY = {
  valence: {
    displayOrder: 10,
    negativeLabel: 'Unpleasant',
    positiveLabel: 'Pleasant',
    negativeColor: '#dc3545',
    positiveColor: '#28a745',
    description: 'Pleasant (+) to unpleasant (-). Overall hedonic tone.',
  },
  // ... all axes
};
```

**Benefit**: Single source of truth for all axis metadata; easier to add new axes.

**Prerequisite**: Ensure integration test coverage for `emotionalStatePanel.js` before refactoring.

### Opportunity 2: Schema Generation from Constants

**Current State**: Axis lists must be manually synchronized between `moodAffectConstants.js` and JSON schemas.

**Proposed Solution**: Create a build-time script that generates the JSON schema properties from the constants file, or validate at startup that they match.

**Benefit**: Eliminates synchronization errors.

---

## Constraints

1. **No prototype modifications**: Do not modify `emotion_prototypes.lookup.json` or `sexual_prototypes.lookup.json`. Prototype updates will be handled in a separate follow-up task after deep research determines appropriate weights.

2. **Schema validation**: After modifying component schemas, ensure all existing entity definitions that include mood/affect_traits components still validate. If any entity definitions hardcode specific mood/affect values, they may need default values added for new axes.

3. **Backward compatibility**: The system should gracefully handle entities that don't have the new axes defined yet (using default values).

---

## Implementation Order

1. Phase 1.1: Update constants file
2. Phase 1.2: Update mood component schema
3. Phase 1.3: Update affect_traits component schema
4. Phase 2.1: Update emotional state panel
5. Phase 3.1: Update LLM prompt text
6. Phase 4: Verify auto-discovery systems
7. Phase 5: Update and run tests
