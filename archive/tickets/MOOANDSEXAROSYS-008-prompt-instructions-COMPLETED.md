# MOOANDSEXAROSYS-008: Prompt Instructions Update

## Status: COMPLETED

## Summary

Add LLM prompt instructions explaining the mood and sexual state update system, including axis definitions, ranges, update heuristics, and output format requirements.

## Files to Touch

### MODIFY

- `data/prompts/corePromptText.json` - Append to `finalLlmInstructionText` section

## Out of Scope

- Any code changes
- UI panels - see MOOANDSEXAROSYS-009, MOOANDSEXAROSYS-010
- Schema changes - see MOOANDSEXAROSYS-006
- Service implementation - see MOOANDSEXAROSYS-003
- Component definitions - see MOOANDSEXAROSYS-001

## Technical Specification

### Target File

`data/prompts/corePromptText.json` contains static prompt text. The mood/sexual update instructions should be appended to the `finalLlmInstructionText` section.

### Instruction Content

The following text block should be added (approximately 700-800 tokens):

```
EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)

You are updating the character's internal state after the latest events.
Output the new absolute numeric values (not deltas) in the moodUpdate and sexualUpdate fields.

RANGES
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation): integers [-100..100]
- sex_excitation and sex_inhibition: integers [0..100]

AXIS DEFINITIONS
Valence: + = pleasant/rewarding, - = unpleasant/aversive
Arousal: + = energized/amped, - = depleted/slowed
Agency/Control: + = in control/assertive, - = helpless/powerless
Threat: + = endangered/alarmed, - = safe/relaxed
Engagement: + = absorbed/attentive, - = indifferent/checked out
Future Expectancy: + = hopeful/path forward, - = hopeless/future closed
Self-evaluation: + = pride/dignity, - = shame/defect/exposed

SEX VARIABLES
sex_excitation (accelerator): how activated sexual interest/readiness is
sex_inhibition (brake): how much sexual response is suppressed by danger, shame, anxiety

UPDATE HEURISTICS
- Being attacked/threatened: Threat up, Arousal up, Valence down
- Succeeding/gaining leverage: Agency/Control up, Valence up, Threat down
- Loss/grief: Valence down, Arousal often down
- Public humiliation: Self-evaluation down, Valence down, Threat up
- Boredom/waiting: Engagement down, Arousal down

SEX UPDATE HEURISTICS
- Increase sex_inhibition: high Threat, very negative Self-evaluation, disgust/distress
- Decrease sex_inhibition: low Threat, improved Self-evaluation, calm trust
- Increase sex_excitation: attraction/intimacy cues, positive Valence, high Engagement
- Decrease sex_excitation: danger, disgust, shame, exhaustion

TYPICAL CHANGE MAGNITUDES
- Mild event: 5-15 points
- Strong event: 15-35 points
- Extreme event: 35-60 points
```

### JSON Structure

The instruction text should be added to the JSON structure. Example:

```json
{
  "finalLlmInstructionText": "... existing instructions ...\n\nEMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)\n\nYou are updating the character's internal state after the latest events...[rest of content]"
}
```

### Token Budget

The instruction block should be kept under 800 tokens to avoid excessive prompt bloat. The current specification text is approximately 350-400 words, which translates to roughly 500-700 tokens.

## Acceptance Criteria

### Content Requirements

- [x] RANGES section clearly defines integer bounds
- [x] All 7 mood axes defined with +/- meaning
- [x] Both sex variables (excitation/inhibition) explained
- [x] UPDATE HEURISTICS provide guidance for mood changes
- [x] SEX UPDATE HEURISTICS provide guidance for sexual state changes
- [x] TYPICAL CHANGE MAGNITUDES help LLM calibrate updates

### Format Requirements

- [x] Instructions are clear and concise
- [x] Under 800 tokens total
- [x] Properly escaped for JSON (newlines as `\n`)
- [x] No special characters that would break JSON parsing

### Validation

- [x] `corePromptText.json` remains valid JSON after edit
- [x] Prompt loads successfully in application
- [x] No syntax errors in prompt template

### Integration Testing

- [x] LLM receives the new instructions in prompt
- [ ] LLM produces `moodUpdate` object in response (requires runtime testing with LLM)
- [ ] LLM produces `sexualUpdate` object in response (requires runtime testing with LLM)
- [ ] Update values are within specified ranges (requires runtime testing with LLM)

### Test Commands

```bash
# Validate JSON is parseable
node -e "require('./data/prompts/corePromptText.json')"

# Run application to verify prompt loads
npm run dev
# Check console for prompt-related errors
```

## Example LLM Output After Instructions

Given a scenario where the character is being threatened:

```json
{
  "chosenIndex": 0,
  "speech": "Stay back!",
  "thoughts": "This is dangerous, I need to protect myself.",
  "moodUpdate": {
    "valence": -35,
    "arousal": 55,
    "agency_control": -15,
    "threat": 70,
    "engagement": 40,
    "future_expectancy": -20,
    "self_evaluation": 0
  },
  "sexualUpdate": {
    "sex_excitation": 0,
    "sex_inhibition": 85
  }
}
```

## Dependencies

- None (data-only change)

## Dependent Tickets

- None (this enables LLM to produce updates that other tickets process)

---

## Outcome

### What Was Changed

1. **Modified**: `data/prompts/corePromptText.json`
   - Appended the complete EMOTIONAL + SEXUAL STATE UPDATE instruction block to `finalLlmInstructionText`
   - Instructions placed before the final "Now, based on all the information provided..." paragraph
   - All 7 mood axes defined with ranges and +/- meanings
   - Both sex variables (excitation/inhibition) documented with ranges
   - Update heuristics and typical change magnitudes included

2. **Created**: `tests/integration/ai/moodSexualPromptInstructions.integration.test.js`
   - 36 comprehensive tests validating:
     - Section header presence
     - RANGES section with correct bounds
     - All 7 AXIS DEFINITIONS with +/- meanings
     - SEX VARIABLES section
     - UPDATE HEURISTICS section
     - SEX UPDATE HEURISTICS section
     - TYPICAL CHANGE MAGNITUDES section
     - Token efficiency (under 3200 characters / ~800 tokens)
     - Section ordering validation

### What Was Different From Original Plan

- No differences. Implementation matched the ticket specification exactly.
- All assumptions in the ticket were validated as correct before implementation.

### Test Results

- All existing integration tests pass: `corePromptTextValidation.test.js`, `corePromptInstructions.integration.test.js`
- All 36 new tests pass in `moodSexualPromptInstructions.integration.test.js`
- JSON validation confirmed: `node -e "require('./data/prompts/corePromptText.json')"` succeeds

### Notes

- Runtime testing with actual LLM required to verify:
  - LLM produces `moodUpdate` object in response
  - LLM produces `sexualUpdate` object in response
  - Update values are within specified ranges
- These runtime tests depend on MOOANDSEXAROSYS-006 (schema changes) and MOOANDSEXAROSYS-007 (mood update workflow) being implemented
