# TWOPHAEMOSTAUPD-002: Prompt Text Split

## Status: ✅ COMPLETED

**Completed**: 2026-01-08

---

## Outcome

### What Was Changed

**File Modified**: `data/prompts/corePromptText.json`

1. **Added new key `moodUpdateOnlyInstructionText`**:
   - Extracted mood/sexual state update instructions from `finalLlmInstructionText`
   - Contains: EMOTIONAL + SEXUAL STATE UPDATE header, RANGES, AXIS DEFINITIONS, SEX VARIABLES, UPDATE HEURISTICS, SEX UPDATE HEURISTICS, TYPICAL CHANGE MAGNITUDES
   - Added OUTPUT FORMAT section specifying only `moodUpdate` and `sexualUpdate` JSON fields

2. **Modified existing key `finalLlmInstructionText`**:
   - Removed all mood/sexual state update instructions
   - Retained: INNER STATE EXPRESSION, SPEECH COLORING, SPEECH CONTENT RULE, THOUGHTS COLORING, ACTION SELECTION, INTENSITY SCALING, ACTION VARIETY GUIDANCE, NOTES RULES, NOTE SUBJECT TYPES, PRIORITY GUIDELINES, CRITICAL DISTINCTION (thoughts vs speech), VALID/INVALID PATTERNS, final instruction line

### Verification Results

- ✅ JSON syntax valid
- ✅ `npm run validate` passes (0 violations across 128 mods)
- ✅ `moodUpdateOnlyInstructionText` contains valence, arousal, agency_control
- ✅ `moodUpdateOnlyInstructionText` contains sex_excitation, sex_inhibition
- ✅ `moodUpdateOnlyInstructionText` contains numeric ranges
- ✅ `moodUpdateOnlyInstructionText` contains OUTPUT FORMAT section
- ✅ `finalLlmInstructionText` does NOT contain "EMOTIONAL + SEXUAL STATE UPDATE"
- ✅ `finalLlmInstructionText` does NOT contain mood axis range definitions
- ✅ `finalLlmInstructionText` DOES contain "INNER STATE EXPRESSION"
- ✅ `finalLlmInstructionText` DOES contain speech coloring guidance

### Deviation from Original Plan

**None** - Implementation matched ticket requirements exactly.

---

## Summary

Split `finalLlmInstructionText` in `corePromptText.json` into two separate instruction sets: one for mood-only updates (Phase 1) and one for action decisions (Phase 2).

## Files to Touch

| File | Action |
|------|--------|
| `data/prompts/corePromptText.json` | MODIFY |

## Out of Scope

- **DO NOT** modify any JavaScript files
- **DO NOT** create new services or pipelines
- **DO NOT** change prompt template files in `src/prompting/templates/`
- **DO NOT** modify schema files
- **DO NOT** change how prompts are loaded or processed

## Implementation Details

### Add New Key: `moodUpdateOnlyInstructionText`

Extract from `finalLlmInstructionText` the sections related to emotional state updates:

**Must Include:**
- "EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)" section
- All mood axis definitions (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation)
- Sexual state definitions (sex_excitation, sex_inhibition)
- UPDATE HEURISTICS section
- Typical change magnitudes guidance
- Instruction to respond with ONLY `moodUpdate` and `sexualUpdate` JSON fields

**Must Exclude:**
- Speech rules and coloring
- Thought rules and coloring
- Notes rules and subject types
- Action selection guidance
- "INNER STATE EXPRESSION" section (that stays in action prompt)

**Add Output Format Instruction:**
```
OUTPUT FORMAT:
You must respond with ONLY a JSON object containing exactly two fields:
{
  "moodUpdate": { ... all 7 axes ... },
  "sexualUpdate": { ... both fields ... }
}
Do NOT include speech, thoughts, notes, or chosenIndex.
```

### Modify Existing: `finalLlmInstructionText`

Remove the mood/sexual update instructions but keep the behavioral guidance:

**Must Remove:**
- "EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)" section entirely
- Mood axis definitions and ranges
- Sexual state definitions and ranges
- UPDATE HEURISTICS section (move to mood-only)
- Typical change magnitudes

**Must Keep:**
- "INNER STATE EXPRESSION (CRITICAL)" section - how current mood influences behavior
- Speech coloring rules (how mood affects dialogue)
- Thought coloring rules (how mood affects internal monologue)
- Notes rules and subject types
- Action selection guidance
- Intensity scaling guidance (faint/mild/moderate/strong/intense)
- Output format for action response (chosenIndex, speech, thoughts, notes)

### Structure of Modified `corePromptText.json`

```json
{
  "coreTaskDescriptionText": "... (unchanged) ...",
  "characterPortrayalGuidelinesTemplate": "... (unchanged) ...",
  "nc21ContentPolicyText": "... (unchanged) ...",
  "actionTagRulesContent": "... (unchanged) ...",
  "moodUpdateOnlyInstructionText": "... (NEW - mood update instructions) ...",
  "finalLlmInstructionText": "... (MODIFIED - action instructions without mood update) ..."
}
```

## Acceptance Criteria

### Tests that must pass

1. **JSON Validity:**
   ```bash
   npm run validate
   ```
   Must pass without JSON syntax errors.

2. **Manual Inspection - Mood Instructions:**
   - `moodUpdateOnlyInstructionText` contains "valence", "arousal", "agency_control"
   - `moodUpdateOnlyInstructionText` contains "sex_excitation", "sex_inhibition"
   - `moodUpdateOnlyInstructionText` contains numeric ranges (-100 to 100, 0 to 100)
   - `moodUpdateOnlyInstructionText` does NOT contain "chosenIndex"
   - `moodUpdateOnlyInstructionText` does NOT contain "speech"
   - `moodUpdateOnlyInstructionText` does NOT contain "thoughts"

3. **Manual Inspection - Action Instructions:**
   - `finalLlmInstructionText` does NOT contain "EMOTIONAL + SEXUAL STATE UPDATE"
   - `finalLlmInstructionText` does NOT contain mood axis range definitions
   - `finalLlmInstructionText` DOES contain "INNER STATE EXPRESSION"
   - `finalLlmInstructionText` DOES contain speech coloring guidance
   - `finalLlmInstructionText` DOES contain "chosenIndex"

### Invariants that must remain true

1. JSON file remains valid, parseable JSON
2. All existing keys preserved (only content modified, plus one new key added)
3. No JavaScript code changes required
4. Character names in `characterPortrayalGuidelinesTemplate` still use `{{name}}` placeholder
5. All content policy and task description text unchanged

## Verification Commands

```bash
# Validate JSON syntax
node -e "require('./data/prompts/corePromptText.json')"

# Check mood instructions contain expected content
grep -c "moodUpdate" data/prompts/corePromptText.json  # Should increase

# Verify npm validation passes
npm run validate
```

## Estimated Scope

- Single file modification
- ~200-300 lines of JSON content reorganization
- No code changes
- Easily reviewable diff (text movement, one new key)
