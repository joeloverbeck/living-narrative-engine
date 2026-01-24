# TEMORIAXI-005: LLM Prompt Instructions - Add temporal_orientation to corePromptText.json

## Status: COMPLETED

## Summary

Update the LLM prompt instructions in `corePromptText.json` to include the `temporal_orientation` axis in all relevant sections: ranges, axis definitions, heuristics, and output format.

## Priority: Critical | Effort: Medium

## Rationale

The LLM receives these instructions when generating mood updates. Without updating the prompts, the LLM won't know about the new axis and can't return values for it.

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/prompts/corePromptText.json` | **Modify** - Add temporal_orientation to moodUpdateOnlyInstructionText field |

## Out of Scope

- **DO NOT** modify `data/mods/core/components/mood.component.json` - that's TEMORIAXI-001
- **DO NOT** modify `src/constants/moodAffectConstants.js` - that's TEMORIAXI-002
- **DO NOT** modify `src/turns/schemas/llmOutputSchemas.js` - that's TEMORIAXI-003
- **DO NOT** modify `src/domUI/emotionalStatePanel.js` - that's TEMORIAXI-004
- **DO NOT** update any test files - that's TEMORIAXI-006 and TEMORIAXI-007
- **DO NOT** modify any other fields in corePromptText.json (actionTagRulesContent, coreTaskDescriptionText, etc.)

## Implementation Details

### Modify: data/prompts/corePromptText.json

All changes are within the `moodUpdateOnlyInstructionText` field value (a multi-line string).

#### Change 1: Update RANGES section
Find and replace the axis list in the RANGES section:

```
// BEFORE:
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, affiliation, inhibitory_control, uncertainty): integers [-100..100]

// AFTER:
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, temporal_orientation, self_evaluation, affiliation, inhibitory_control, uncertainty): integers [-100..100]
```

#### Change 2: Add AXIS DEFINITIONS entry
Insert after the Future Expectancy definition line:

```
// BEFORE:
Future Expectancy: + = hopeful/path forward, - = hopeless/future closed
Self-evaluation: + = pride/dignity, - = shame/defect/exposed

// AFTER:
Future Expectancy: + = hopeful/path forward, - = hopeless/future closed
Temporal Orientation: + = future-focused (planning, anticipating, "what's next"), 0 = present-focused (flow, mindfulness, immersion), - = past-focused (reminiscing, ruminating, dwelling on memories). NOTE: This is distinct from Future Expectancy which is about hope/hopelessness, not time direction. A character can be past-focused and hopeful (warm nostalgia) or future-focused and hopeless (dread).
Self-evaluation: + = pride/dignity, - = shame/defect/exposed
```

#### Change 3: Add DEFAULT UPDATE HEURISTICS
Insert after the existing uncertainty heuristics (before SEX VARIABLES section):

```
// ADD these lines after the uncertainty heuristics:
- Reminiscing about the past, recalling memories: Temporal Orientation down
- Planning for future, anticipating events: Temporal Orientation up
- Fully absorbed in current task (flow state): Temporal Orientation toward 0
- Regret or dwelling on past mistakes: Temporal Orientation down, often with negative valence
- Anticipating upcoming event with interest: Temporal Orientation up, engagement often up
- Nostalgic reverie (bittersweet memories): Temporal Orientation down, valence often slightly positive
- Worry about future events: Temporal Orientation up, threat may be up
- Mindfulness/grounding in present moment: Temporal Orientation toward 0
```

#### Change 4: Update OUTPUT FORMAT JSON example
Update the moodUpdate object in the JSON example:

```json
// BEFORE:
{
  "moodUpdate": { "valence": ..., "arousal": ..., "agency_control": ..., "threat": ..., "engagement": ..., "future_expectancy": ..., "self_evaluation": ..., "affiliation": ..., "inhibitory_control": ..., "uncertainty": ... },
  "sexualUpdate": { "sex_excitation": ..., "sex_inhibition": ... }
}

// AFTER:
{
  "moodUpdate": { "valence": ..., "arousal": ..., "agency_control": ..., "threat": ..., "engagement": ..., "future_expectancy": ..., "temporal_orientation": ..., "self_evaluation": ..., "affiliation": ..., "inhibitory_control": ..., "uncertainty": ... },
  "sexualUpdate": { "sex_excitation": ..., "sex_inhibition": ... }
}
```

## Full Text Diff Reference

The `moodUpdateOnlyInstructionText` field is a large JSON string. Here are the key search/replace patterns:

### Pattern 1: RANGES
```
SEARCH: "valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, affiliation, inhibitory_control, uncertainty"
REPLACE: "valence, arousal, agency_control, threat, engagement, future_expectancy, temporal_orientation, self_evaluation, affiliation, inhibitory_control, uncertainty"
```

### Pattern 2: OUTPUT FORMAT
```
SEARCH: '"future_expectancy": ..., "self_evaluation"'
REPLACE: '"future_expectancy": ..., "temporal_orientation": ..., "self_evaluation"'
```

### Pattern 3: AXIS DEFINITIONS (insert new line)
After line containing "Future Expectancy: + = hopeful/path forward, - = hopeless/future closed"
Insert: "Temporal Orientation: + = future-focused (planning, anticipating, \"what's next\"), 0 = present-focused (flow, mindfulness, immersion), - = past-focused (reminiscing, ruminating, dwelling on memories). NOTE: This is distinct from Future Expectancy which is about hope/hopelessness, not time direction. A character can be past-focused and hopeful (warm nostalgia) or future-focused and hopeless (dread)."

### Pattern 4: DEFAULT UPDATE HEURISTICS (insert new lines)
After the existing uncertainty heuristics, before "SEX VARIABLES", insert the 8 new heuristic lines.

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` passes (JSON is valid)
- `npx eslint data/prompts/` passes (if applicable)

### Invariants That Must Remain True
- JSON remains valid and parseable
- All existing prompt content is preserved
- The moodUpdateOnlyInstructionText field value is a valid string
- Other fields in corePromptText.json (actionTagRulesContent, coreTaskDescriptionText, etc.) are unchanged
- The distinction between temporal_orientation and future_expectancy is clearly documented

### Verification Commands
```bash
npm run validate
node -e "JSON.parse(require('fs').readFileSync('data/prompts/corePromptText.json'))"
```

## Dependencies

- **TEMORIAXI-001** must be completed first (schema foundation)
- **TEMORIAXI-002** must be completed first (code constants)
- **TEMORIAXI-003** must be completed first (LLM schemas)
- **TEMORIAXI-004** should be completed (UI layer)

## Notes

- The axis definition explicitly notes the distinction from future_expectancy to prevent LLM confusion
- Examples like "warm nostalgia" and "dread" illustrate how temporal_orientation and future_expectancy are orthogonal
- The heuristics use "toward 0" phrasing for present-focused states
- The 8 new heuristics cover common temporal-focus scenarios
- JSON escaping: quotes inside the string value must be escaped as `\"`

---

## Outcome

**Completion Date**: 2026-01-23

### What Was Actually Changed vs Originally Planned

The implementation followed the ticket exactly as specified. All 4 changes were applied to `data/prompts/corePromptText.json`:

1. **RANGES section**: Added `temporal_orientation` after `future_expectancy` in the axis list
2. **AXIS DEFINITIONS section**: Added the Temporal Orientation definition with the NOTE about distinction from Future Expectancy
3. **DEFAULT UPDATE HEURISTICS section**: Added all 8 temporal orientation heuristics after the uncertainty heuristics
4. **OUTPUT FORMAT section**: Added `"temporal_orientation": ...` to the moodUpdate JSON example

### Verification Results

- `npm run validate` - PASSED (0 violations across 163 mods)
- JSON parsing verification - PASSED
- All 15 content checks verified:
  - temporal_orientation in RANGES
  - Temporal Orientation axis definition with future-focused, present-focused, past-focused semantics
  - Distinction from Future Expectancy documented
  - Warm nostalgia and dread examples included
  - temporal_orientation in OUTPUT FORMAT
  - All 8 heuristics present (reminiscing, planning, flow, regret, anticipation, nostalgia, worry, mindfulness)

### Test Status

- Existing tests in `moodUpdateInstructions.affiliationAxis.test.js` pass except for one test that expects 10 axes (now 11)
- This test failure is expected and will be fixed in TEMORIAXI-006 (unit tests ticket)

### Files Modified

| File | Change |
|------|--------|
| `data/prompts/corePromptText.json` | Updated `moodUpdateOnlyInstructionText` field with all 4 changes |
