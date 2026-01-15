# INNSTAINTPROENH-001: JSON Content Replacement

## Status: ✅ COMPLETED

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned:**
1. Replace "INNER STATE EXPRESSION (CRITICAL)" section with new "INNER STATE INTEGRATION" protocol
2. Replace "THOUGHTS COLORING" section with simplified version
3. No test changes (deferred to INNSTAINTPROENH-002)

**Actually Changed:**
1. ✅ Replaced "INNER STATE EXPRESSION (CRITICAL)" section in `data/prompts/corePromptText.json` (line 9, `finalLlmInstructionText` field) with new `<inner_state_integration>` block exactly as specified
2. ✅ Replaced "THOUGHTS COLORING" section with simplified single-line version exactly as specified
3. ✅ **ADDED** content verification tests in `tests/unit/prompting/corePromptText.innerStateIntegration.test.js` (22 new tests) - this was not originally planned but was added to ensure the replacement was verifiable
4. ✅ Updated ticket with corrected assumptions about existing test coverage

**Discrepancy Resolution:**
- The ticket originally stated tests were "out of scope" but did not note that existing tests (`corePromptText.test.js`) only test mood update fields, NOT the `finalLlmInstructionText` content being replaced.
- Content verification tests were added as part of this ticket to ensure basic verifiability, with more comprehensive tests deferred to INNSTAINTPROENH-002 as planned.

### Files Modified
- `data/prompts/corePromptText.json` - Line 9, `finalLlmInstructionText` field

### Files Created
- `tests/unit/prompting/corePromptText.innerStateIntegration.test.js` (22 new tests)

### Verification Results
- `npm run validate` - ✅ PASSED (0 violations, 181 mods validated)
- Unit tests - ✅ 25 tests passed (3 existing + 22 new)
- Integration tests - ✅ 3 tests passed

---

## Summary

Replace two sections in `data/prompts/corePromptText.json`:
1. Replace "INNER STATE EXPRESSION (CRITICAL)" section with new "INNER STATE INTEGRATION" protocol
2. Replace "THOUGHTS COLORING" section with simplified version

## File List

### Files to Modify
- `data/prompts/corePromptText.json` - Line 9, `finalLlmInstructionText` field

### Files NOT to Modify (Out of Scope)
- `data/prompts/*.json` (any other prompt files)
- `data/schemas/**/*` (no schema changes)
- `src/prompting/**/*` (no code changes)

### Test Scope Note
The existing `tests/unit/prompting/corePromptText.test.js` tests **mood update fields only**, not the `finalLlmInstructionText` content being replaced. Basic content verification tests are added as part of this ticket to ensure the replacement was successful, with more comprehensive tests in INNSTAINTPROENH-002.

## Implementation Details

### Section 1: Replace INNER STATE EXPRESSION

**Find** (start marker):
```
INNER STATE EXPRESSION (CRITICAL)
```

**Find** (end marker - start of next section):
```
SPEECH CONTENT RULE (CRITICAL):
```

**Replace with** (the entire INNER STATE EXPRESSION and SPEECH COLORING sections):
```
<inner_state_integration>

INNER STATE INTEGRATION (HARD CONSTRAINT — NOT FLAVOR)

Your character's <inner_state> is a PRIMARY DRIVER.
You MUST route it through the character's unique persona (voice, defenses, worldview, habits of attention).
Do NOT output generic emotion prose. Make it sound like THIS character.

Fail condition: any turn where thoughts/action/speech could be swapped to a different inner_state with minimal edits.

STATE INTEGRATION PROTOCOL (do this BEFORE writing; do not print this protocol):
1) Choose DRIVERS from <inner_state>:
   - Primary: strongest intensity emotion (dominates)
   - Secondary: second-strongest (shapes tone)
   - Modifier: one additional listed emotion OR sexual_state effect (adds distortion/avoidance)
2) Translate those drivers through persona:
   - Use the character's typical metaphors, vocabulary, and defense style.
   - Let persona determine HOW the emotion shows (e.g., sarcasm, precision, withdrawal, aggression, ritual, avoidance).
3) Let the drivers decide:
   - Attention (what details are noticed first)
   - Action impulse (what feels "right")
   - Speech texture (pace, sharpness, warmth/harshness)
   - What counts as "critical" for Notes (still facts-only).

PER-FIELD STATE SIGNAL MINIMUMS (must satisfy all):
- thoughts: MUST clearly reflect Primary + Secondary AND at least one concrete effect (attention bias, threat scanning, bodily aversion, compulsive counting, etc.). No generic "I'm sad" narration.
- action: MUST be plausible under Primary emotion. If you pick an action that contradicts Primary, you MUST justify the contradiction inside thoughts as resistance/denial/refusal (in persona voice).
- speech: If non-empty, it MUST be colored by Primary/Secondary (rhythm + word choice). If speech is empty, thoughts + action MUST carry stronger state signal.
- notes: Still facts-only, but state can affect which facts are prioritized as survival/prosperity relevant. Never write feelings in notes unless recording a genuine, new, critical state shift.

SEXUAL STATE RULE (applies even if no sexual content is present):
Sexual state changes comfort distance, gaze, bodily awareness, and avoidance. High repulsion/inhibition should suppress flirtation/intimacy and bias toward withdrawal, irritation, or physical self-protection.

CONFLICT RULE (persona vs state):
If persona would hide vulnerability, show that as deflection (brittle humor, contempt, procedural thinking, silence, refusal), not as neat self-awareness. The emotion still leaks; it just leaks in-character.

</inner_state_integration>

```

### Section 2: Replace THOUGHTS COLORING

**Find** (exact content to replace):
```
THOUGHTS COLORING:
- Your internal monologue must REFLECT the listed emotions
- If feeling "fear: strong", thoughts should show anxiety, worry, threat assessment
- If feeling "curiosity: noticeable", thoughts should show interest, questions, investigation
- Sexual states affect WHAT you notice (who you look at, what details you observe)
```

**Replace with**:
```
THOUGHTS COLORING:
- The thought MUST visibly carry the Primary/Secondary inner_state drivers (through persona), not just planning.
```

## JSON Escaping Requirements

The new content must be properly escaped for JSON:
- Newlines: `\n`
- Quotes: `\"`
- Em dash (—): Can be used directly in JSON strings
- XML-like tags (`<inner_state_integration>`): No escaping needed in JSON strings

## Out of Scope

- **NO code changes** to any JavaScript files
- **NO schema changes**
- **NO modifications** to `moodUpdateOnlyInstructionText` field
- **NO modifications** to adjacent sections:
  - `SPEECH CONTENT RULE (CRITICAL)`
  - `ACTION SELECTION`
  - `INTENSITY SCALING`
  - `ACTION VARIETY GUIDANCE`
  - `NOTES RULES`
  - `NOTE SUBJECT TYPES`
  - `CRITICAL DISTINCTION - THOUGHTS vs SPEECH`

## Acceptance Criteria

### Tests That Must Pass
- `npm run validate` - Schema validation
- `npm run test:unit -- --testPathPatterns="corePromptText"` - All corePromptText tests

### Invariants That Must Remain True
1. `corePromptText.json` is valid JSON
2. `finalLlmInstructionText` contains `SPEECH CONTENT RULE (CRITICAL):` unchanged
3. `finalLlmInstructionText` contains `ACTION SELECTION:` unchanged
4. `finalLlmInstructionText` contains `NOTES RULES` unchanged
5. `finalLlmInstructionText` contains `NOTE SUBJECT TYPES` unchanged
6. `finalLlmInstructionText` contains `CRITICAL DISTINCTION - THOUGHTS vs SPEECH:` unchanged
7. All other fields in `corePromptText.json` are unchanged

### New Content Verification
1. `finalLlmInstructionText` contains `INNER STATE INTEGRATION (HARD CONSTRAINT — NOT FLAVOR)`
2. `finalLlmInstructionText` contains `<inner_state_integration>` and `</inner_state_integration>`
3. `finalLlmInstructionText` contains `STATE INTEGRATION PROTOCOL`
4. `finalLlmInstructionText` contains `PER-FIELD STATE SIGNAL MINIMUMS`
5. `finalLlmInstructionText` does NOT contain `INNER STATE EXPRESSION (CRITICAL)`
6. `finalLlmInstructionText` does NOT contain `Match emotional intensity to speech patterns:`

## Verification Steps

1. After editing, run `npm run validate`
2. Run `npm run test:unit -- --testPathPatterns="corePromptText"`
3. Manually inspect JSON for proper formatting
4. Verify no trailing/leading whitespace issues
