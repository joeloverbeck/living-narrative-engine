# Inner State Integration Prompt Enhancement

**Status**: ✅ IMPLEMENTED

## Goal

Replace the current "INNER STATE EXPRESSION (CRITICAL)" section in the LLM prompt with an enhanced "INNER STATE INTEGRATION" protocol that treats inner state as a primary driver (not flavor) and enforces persona-specific emotional expression across all output fields (thoughts, speech, action, notes).

Additionally, replace the current "THOUGHTS COLORING" section with a simplified version that reinforces the Primary/Secondary driver integration.

## Current State (as observed)

### File Location
- **File**: `data/prompts/corePromptText.json`
- **Field**: `finalLlmInstructionText` (line 9)

### Current Content Being Replaced

**INNER STATE EXPRESSION section** (to be fully replaced):
```
INNER STATE EXPRESSION (CRITICAL)

Your character's <inner_state> shows their current emotional and sexual condition. This MUST influence how you write speech, thoughts, and select actions.

SPEECH COLORING:
- Match emotional intensity to speech patterns:
  • High arousal emotions (anger, excitement, fear): Urgent, clipped, energetic speech
  • Low arousal emotions (sadness, melancholy): Slower, quieter, more hesitant speech
  • Strong positive emotions (joy, love): Warmer tone, more open language
  • Strong negative emotions (disgust, contempt): Harsher word choices, dismissive tone
- Sexual state effects:
  • High romantic/lustful states: More attention to appearance, flirtatiousness or awkwardness
  • High inhibition: Avoidance of intimate topics, increased guardedness
```

**THOUGHTS COLORING section** (to be replaced):
```
THOUGHTS COLORING:
- Your internal monologue must REFLECT the listed emotions
- If feeling "fear: strong", thoughts should show anxiety, worry, threat assessment
- If feeling "curiosity: noticeable", thoughts should show interest, questions, investigation
- Sexual states affect WHAT you notice (who you look at, what details you observe)
```

### Integration Flow
1. Content read by: `AIPromptContentProvider.getFinalInstructionsContent()` (line 957-959)
2. Assembled into PromptData at: `AIPromptContentProvider.getPromptData()` (line 482)
3. Formatted by: `PromptDataFormatter.formatPromptData()` (line 562)
4. Substituted in template: `PromptTemplateService.processCharacterPrompt()` (line 120)
5. Final location in prompt: Within `<system_constraints>` section (line 26 of characterPromptTemplate.js)

## New Content

### Replacement for INNER STATE EXPRESSION

Replace the entire "INNER STATE EXPRESSION (CRITICAL)" section including "SPEECH COLORING" with:

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

### Replacement for THOUGHTS COLORING

Replace the entire "THOUGHTS COLORING" section with:

```
THOUGHTS COLORING:
- The thought MUST visibly carry the Primary/Secondary inner_state drivers (through persona), not just planning.
```

## Primary Risks

1. **Backward compatibility**: The section replacement must maintain proper formatting (no extra newlines, proper escaping for JSON string) to avoid breaking prompt assembly. ✅ VERIFIED
2. **Token budget impact**: The new INNER STATE INTEGRATION section is longer than the original INNER STATE EXPRESSION section; verify total prompt size remains acceptable. ✅ ACCEPTABLE
3. **XML tag handling**: The new content includes `<inner_state_integration>` XML tags which must be preserved correctly in the JSON string. ✅ VERIFIED
4. **Section ordering**: The replacement must maintain the same relative position in the prompt structure (within `<system_constraints>`, before ACTION SELECTION). ✅ VERIFIED

## Implementation Outcome

All implementation steps completed successfully:
- Content replaced in `corePromptText.json`
- Unit tests verify new content present and old content removed
- Integration tests verify prompt assembly
- E2E tests verify full pipeline
- Backward compatibility tests verify all adjacent sections unchanged
- All tests pass: `npm run test:ci`
- Schema validation passes: `npm run validate`
