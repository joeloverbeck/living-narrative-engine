# Additions to LLM prompt

**Status**: ✅ IMPLEMENTED (see INNSTAINTPROENH epic)

Explore the code behind the 'Prompt to LLM' button in game.html . We're going to make modifications to the prompt that specifically requests speech, thoughts, notes, and a chosen action to a LLM.

Currently, that prompt generates a block of text like this:

"INNER STATE EXPRESSION (CRITICAL)

Your character's <inner_state> shows their current emotional and sexual condition. This MUST influence how you write speech, thoughts, and select actions.

SPEECH COLORING:
- Match emotional intensity to speech patterns:
  • High arousal emotions (anger, excitement, fear): Urgent, clipped, energetic speech
  • Low arousal emotions (sadness, melancholy): Slower, quieter, more hesitant speech
  • Strong positive emotions (joy, love): Warmer tone, more open language
  • Strong negative emotions (disgust, contempt): Harsher word choices, dismissive tone
- Sexual state effects:
  • High romantic/lustful states: More attention to appearance, flirtatiousness or awkwardness
  • High inhibition: Avoidance of intimate topics, increased guardedness"

We want to replace it entirely with this:

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

## Thoughts section modification

We currently produce in the prompt text like this:

"THOUGHTS COLORING:
- Your internal monologue must REFLECT the listed emotions
- If feeling "fear: strong", thoughts should show anxiety, worry, threat assessment
- If feeling "curiosity: noticeable", thoughts should show interest, questions, investigation
- Sexual states affect WHAT you notice (who you look at, what details you observe)"

The text should be replaced with:

"THOUGHTS COLORING:
- The thought MUST visibly carry the Primary/Secondary inner_state drivers (through persona), not just planning."
