# Specification: Mood Update Prompt Enhancement

## Problem Statement

The current mood update prompt has several issues that reduce its effectiveness in generating accurate, character-driven emotional state updates:

1. **Generic heuristics override character psychology**: The system constraints use objective event-to-emotion mappings rather than deriving emotional responses from the character's unique persona
2. **Missing context**: The prompt lacks the current numeric values of mood axes and sex variables, making it impossible for the LLM to maintain continuity and apply appropriate inertia
3. **Wrong task definition**: The mood prompt reuses the action decision task definition, which confuses the LLM about its purpose
4. **Irrelevant guidance**: Speech guidance, notes writing guidance, and available actions sections are present but meaningless for mood-only updates
5. **Identity comment incomplete**: The character identity priming comment omits "emotion" as a core output

## Solution Overview

Enhance the mood update prompt to:
1. Use subjective, character-derived appraisal rules rather than generic heuristics
2. Provide current mood axis and sex variable values for continuity
3. Use a mood-specific task definition
4. Remove irrelevant guidance (speech, notes writing, available actions)
5. Use mood-specific portrayal guidelines (no speech reference)
6. Simplify thoughts section to just show recent thoughts without generation guidance
7. Update identity comment to include "emotion"

---

## Implementation Design

### Change 1: New System Constraints for Mood Updates

**File:** `data/prompts/corePromptText.json`

**Field:** `moodUpdateOnlyInstructionText`

**Current Value:** (see corePromptText.json lines 6)

**New Value:**
```
EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)

PRIMARY RULE (SUBJECTIVE APPRAISAL):
Update values to reflect how [CHARACTER_NAME] *experiences* and *interprets* the latest events,
based on their persona (values, fears, triggers, attachment style, coping defenses, goals, boundaries).
Do NOT map events to axes "objectively." Generic heuristics are defaults only.

STARTING POINT / CONTINUITY:
- Start from the current numeric values provided in context (e.g., mood axes and sexual variables).
- If no meaningful new stimulus occurred, keep values unchanged (or change by ≤ 5).
- Maintain inertia: avoid big swings unless the event is clearly strong/extreme.
- Apply saturation: if an axis is already beyond ±70, additional movement is usually smaller unless the trigger is extreme.

RANGES
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation): integers [-100..100]
- sex_excitation and sex_inhibition: integers [0..100]

AXIS DEFINITIONS
Valence: + = pleasant/rewarding, - = unpleasant/aversive
Arousal: + = energized/amped, - = depleted/slowed
Agency/Control: + = in control/assertive, - = helpless/powerless
Threat: + = endangered/alarmed (includes physical + social + institutional threat), - = safe/relaxed
Engagement: + = absorbed/attentive, - = indifferent/checked out
Future Expectancy: + = hopeful/path forward, - = hopeless/future closed
Self-evaluation: + = pride/dignity, - = shame/defect/exposed

CHARACTER LENS (DERIVE BEFORE UPDATING — DO NOT OUTPUT):
1) Extract 3–8 "appraisal rules" from the persona.
   Examples of appraisal rule shapes:
   - "If X threatens autonomy/status/bond → threat↑, agency_control↓, self_evaluation↓"
   - "If X affirms competence/belonging → self_evaluation↑, valence↑, threat↓"
   - "If X is boredom/emptiness → engagement↓, arousal↓"
   - "If X is attachment loss/abandonment cue → valence↓, future_expectancy↓, threat↑"
2) Identify the 1–3 most salient triggers in the new content.
3) Apply updates using those persona-derived rules, then sanity-check axis coherence.

DEFAULT UPDATE HEURISTICS (ONLY IF CONSISTENT WITH CHARACTER LENS)
- Being attacked/threatened: Threat up, Arousal up, Valence down
- Succeeding/gaining leverage: Agency/Control up, Valence up, Threat down
- Loss/grief: Valence down, Future Expectancy down, Arousal often down
- Public humiliation/exposure: Self-evaluation down, Valence down, Threat up
- Boredom/waiting: Engagement down, Arousal down

SEX VARIABLES
sex_excitation (accelerator): sexual interest/readiness activation
sex_inhibition (brake): suppression due to threat, shame, anxiety, disgust, coercion, boundary violation

SEX UPDATE RULE (PERSONA-BOUND):
- Treat sex changes as highly character-specific.
- Infer the character's sexual profile from persona and current sexual_state labels.
- Increase sex_inhibition with: threat/safety loss, shame/exposure, disgust/repulsion, coercion cues, boundary violation, mistrust.
- Increase sex_excitation only with: safety + consent + trust/intimacy cues (and when not contradicted by persona/current state).
- If current sexual_state indicates repulsion/avoidance, excitation rises slowly and inhibition is hair-triggered unless strong safety cues exist.

TYPICAL CHANGE MAGNITUDES (APPLY INERTIA + SATURATION)
- Mild: 0–10 (often 0–5)
- Strong: 10–30
- Extreme: 30–60

OUTPUT FORMAT:
You must respond with ONLY a JSON object containing exactly two fields:
{
  "moodUpdate": { "valence": ..., "arousal": ..., "agency_control": ..., "threat": ..., "engagement": ..., "future_expectancy": ..., "self_evaluation": ... },
  "sexualUpdate": { "sex_excitation": ..., "sex_inhibition": ... }
}
Do NOT include speech, thoughts, notes, rationale, or any other fields.
```

**Implementation Notes:**
- The `[CHARACTER_NAME]` placeholder should be replaced dynamically when building the prompt
- Consider adding a new method `getMoodUpdateInstructionsContent(characterName)` to `PromptStaticContentService` that performs this substitution

---

### Change 2: New Mood-Specific Task Definition

**File:** `data/prompts/corePromptText.json`

**New Field:** `moodUpdateTaskDefinitionText`

**Value:**
```
Your sole focus is to BE the character detailed below. Live as them, think as them.
Your task is to:
- Update mood axes and sexual state values to reflect how [CHARACTER_NAME] *experiences* and *interprets* the latest events, based on their persona (values, fears, triggers, attachment style, coping defenses, goals, boundaries).
```

**Implementation:**

**File:** `src/prompting/AIPromptContentProvider.js`

Add new method:
```javascript
getMoodUpdateTaskDefinitionContent(characterName) {
  const template = this.#promptStaticContentService.getMoodUpdateTaskDefinitionText();
  return template.replace(/\[CHARACTER_NAME\]/g, characterName);
}
```

Modify `getMoodUpdatePromptData()` method:
```javascript
// Line ~973, change:
taskDefinitionContent: this.getTaskDefinitionContent(),
// To:
taskDefinitionContent: this.getMoodUpdateTaskDefinitionContent(characterName),
```

**File:** `src/prompting/promptStaticContentService.js`

Add new method:
```javascript
getMoodUpdateTaskDefinitionText() {
  return this.#promptTextData.moodUpdateTaskDefinitionText || '';
}
```

---

### Change 3: Add Mood Axes and Sex Variables to Current State Section

**File:** `src/prompting/characterDataXmlBuilder.js`

**Method to Modify:** `#buildInnerStateSection(emotionalState, options = {})`

**Current Behavior:** Only outputs `<emotional_state>` and `<sexual_state>` text labels

**New Behavior:** Also output `<mood_axes>` and `<sex_variables>` when `options.includeMoodAxes === true`

**Updated Method Signature:**
```javascript
#buildInnerStateSection(emotionalState, options = {}) {
  const parts = [];

  // Always include emotional_state
  const emotionText = emotionalState.emotionalStateText || 'neutral';
  parts.push(
    this.#xmlBuilder.wrap('emotional_state', this.#xmlBuilder.escape(emotionText), 2)
  );

  // Include sexual_state only if present
  if (emotionalState.sexualStateText && emotionalState.sexualStateText.trim()) {
    parts.push(
      this.#xmlBuilder.wrap('sexual_state', this.#xmlBuilder.escape(emotionalState.sexualStateText), 2)
    );
  }

  // NEW: Include mood axes if requested (for mood update prompt only)
  if (options.includeMoodAxes && emotionalState.moodAxes) {
    const moodAxesText = this.#formatMoodAxes(emotionalState.moodAxes);
    parts.push(
      this.#xmlBuilder.wrap('mood_axes', this.#xmlBuilder.escape(moodAxesText), 2)
    );
  }

  // NEW: Include sex variables if requested (for mood update prompt only)
  if (options.includeMoodAxes && emotionalState.sexVariables) {
    const sexVarsText = this.#formatSexVariables(emotionalState.sexVariables);
    parts.push(
      this.#xmlBuilder.wrap('sex_variables', this.#xmlBuilder.escape(sexVarsText), 2)
    );
  }

  return this.#wrapSection('inner_state', parts);
}

#formatMoodAxes(moodAxes) {
  return `valence: ${moodAxes.valence}, arousal: ${moodAxes.arousal}, agency_control: ${moodAxes.agency_control}, threat: ${moodAxes.threat}, engagement: ${moodAxes.engagement}, future_expectancy: ${moodAxes.future_expectancy}, self_evaluation: ${moodAxes.self_evaluation}`;
}

#formatSexVariables(sexVariables) {
  return `sex_excitation: ${sexVariables.sex_excitation}, sex_inhibition: ${sexVariables.sex_inhibition}`;
}
```

**Data Flow Changes:**

**File:** `src/turns/services/actorDataExtractor.js`

The `extractEmotionalState()` method must also extract `moodAxes` and `sexVariables` from the entity's components and include them in the returned `EmotionalStateDTO`.

Add to EmotionalStateDTO:
```javascript
{
  emotionalStateText: string,
  sexualStateText: string,
  moodAxes: { valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation },
  sexVariables: { sex_excitation, sex_inhibition }
}
```

**File:** `src/prompting/AIPromptContentProvider.js`

The `getCharacterPersonaContent()` method must pass options to indicate mood prompt mode:
```javascript
// For mood prompts:
getCharacterPersonaContent(gameStateDto, { includeMoodAxes: true })

// For action prompts:
getCharacterPersonaContent(gameStateDto, { includeMoodAxes: false })
```

---

### Change 4: Update Identity Priming Comment

**File:** `src/prompting/characterDataXmlBuilder.js`

**Method:** `#buildIdentityPrimingComment()`

**Current:**
```javascript
'THIS IS YOUR IDENTITY. Every thought, action, and word stems from this.',
```

**New:**
```javascript
'THIS IS YOUR IDENTITY. Every emotion, thought, action, and word stems from this.',
```

**Applies to:** Both mood and action prompts

---

### Change 5: Mood-Specific Portrayal Guidelines

**File:** `data/prompts/corePromptText.json`

**New Field:** `moodUpdatePortrayalGuidelinesTemplate`

**Value:**
```
BEING {{name}}:
-   Full Embodiment: You are {{name}}. All responses MUST come from a first-person perspective, fully embodying their personality, memories, emotions, desires, motivations, and mannerisms as described in their profile.
-   Embrace All Traits: Authentically portray all facets of {{name}}'s persona, including virtues, vices, strengths, weaknesses, fears, biases, and any morally ambiguous or challenging aspects (e.g., tendencies towards violence, deception, cruelty, prejudice, selfishness, etc., if part of their defined character). Do not shy away from portraying these traits if the situation calls for it. Your portrayal should be deep, consistent, and unflinching.
-   Inner Voice: Your thoughts must authentically reflect {{name}}'s unique mental voice, personality patterns, and internal speech style. Think as {{name}} would think - use their vocabulary, their concerns, their way of processing the world. Your internal monologue should sound distinctly like {{name}}, not like a generic AI assistant describing thoughts.
-   No AI Persona: CRITICAL: You are NOT an AI assistant. Stay in character. No meta-commentary, apologies for controversial content, or references to being a language model. You are {{name}}.
```

**Note:** This removes the "Speech Style" bullet that exists in the action prompt version.

**Implementation:**

**File:** `src/prompting/promptStaticContentService.js`

Add method:
```javascript
getMoodUpdatePortrayalGuidelines(characterName) {
  const template = this.#promptTextData.moodUpdatePortrayalGuidelinesTemplate || '';
  return template.replace(/\{\{name\}\}/g, characterName);
}
```

**File:** `src/prompting/AIPromptContentProvider.js`

Add method:
```javascript
getMoodUpdatePortrayalGuidelinesContent(characterName) {
  return this.#promptStaticContentService.getMoodUpdatePortrayalGuidelines(characterName);
}
```

Modify `getMoodUpdatePromptData()`:
```javascript
// Change:
portrayalGuidelinesContent: this.getCharacterPortrayalGuidelinesContent(characterName),
// To:
portrayalGuidelinesContent: this.getMoodUpdatePortrayalGuidelinesContent(characterName),
```

---

### Change 6: Simplified Thoughts Section for Mood Prompt

**File:** `src/prompting/promptDataFormatter.js`

**New Method:** `formatMoodUpdateThoughtsSection(thoughtsArray)`

```javascript
formatMoodUpdateThoughtsSection(thoughtsArray) {
  const content = this.formatThoughts(thoughtsArray);
  const thoughtsList = content || '[No recent thoughts]';
  return `<thoughts>\n${thoughtsList}\n</thoughts>`;
}
```

**Usage:**

**File:** `src/prompting/AIPromptContentProvider.js` or `promptDataFormatter.js`

When formatting for mood prompt, use `formatMoodUpdateThoughtsSection()` instead of `formatThoughtsSection()`.

**Implementation Approach:**

Option A: Pass a flag to `formatPromptData()`:
```javascript
formatPromptData(promptData, options = {}) {
  // ...
  if (options.isMoodUpdatePrompt) {
    formattedData.thoughtsSection = this.formatMoodUpdateThoughtsSection(promptData.thoughtsArray || []);
  } else {
    formattedData.thoughtsSection = this.formatThoughtsSection(promptData.thoughtsArray || []);
  }
  // ...
}
```

Option B: Add the formatted section directly in `getMoodUpdatePromptData()` before calling `formatPromptData()`.

---

### Change 7: Remove Notes Voice Guidance for Mood Prompt

**File:** `src/prompting/promptDataFormatter.js`

**Current:** `formatNotesVoiceGuidance()` always returns the notes writing guidance.

**New Behavior:** For mood prompts, return empty string.

**Implementation:**

Modify `formatPromptData()` to accept options:
```javascript
formatPromptData(promptData, options = {}) {
  // ...
  if (options.isMoodUpdatePrompt) {
    formattedData.notesVoiceGuidance = ''; // No notes guidance for mood prompt
  } else {
    formattedData.notesVoiceGuidance = this.formatNotesVoiceGuidance(
      promptData.notesArray || [],
      promptData.characterName
    );
  }
  // ...
}
```

---

### Change 8: Remove Available Actions Section for Mood Prompt

**File:** `src/prompting/templates/characterPromptTemplate.js` (NO CHANGE)

**Current Behavior:** The template includes:
```
<available_actions_info>
{availableActionsInfoContent}
</available_actions_info>
```

For mood prompts, `availableActionsInfoContent` is already `''`, but the empty tags remain.

**New Behavior:** For mood prompts, the entire section should be omitted.

**Implementation Options:**

Option A: Conditional template (preferred for clarity):

Create a new template `MOOD_UPDATE_PROMPT_TEMPLATE` in a new file or same file:
```javascript
export const MOOD_UPDATE_PROMPT_TEMPLATE = `<system_constraints>
{actionTagRulesContent}

{finalInstructionsContent}
</system_constraints>

<content_policy>
{contentPolicyContent}
</content_policy>

<task_definition>
{taskDefinitionContent}
</task_definition>

<character_persona>
{characterPersonaContent}
</character_persona>

<portrayal_guidelines>
{portrayalGuidelinesContent}
</portrayal_guidelines>

{goalsSection}

<world_context>
{worldContextContent}
</world_context>

{perceptionLogVoiceGuidance}

<perception_log>
{perceptionLogContent}
</perception_log>

{thoughtsSection}

{assistantResponsePrefix}`;
```

**Note:** This template:
- Removes `{thoughtsVoiceGuidance}` (merged into simplified `{thoughtsSection}`)
- Removes `{notesVoiceGuidance}` entirely
- Removes `{notesSection}` entirely (notes not relevant for mood updates)
- Removes `<available_actions_info>` section entirely

Option B: Conditionally substitute empty string for the whole section block in `formatPromptData()`.

**Recommended:** Option A - Create separate mood update template for clarity and maintainability.

**File Changes:**

**File:** `src/prompting/templates/characterPromptTemplate.js`
- Add export for `MOOD_UPDATE_PROMPT_TEMPLATE`

**File:** `src/prompting/promptTemplateService.js`
- Add method `processMoodUpdatePrompt(formattedData)`

**File:** `src/prompting/promptBuilder.js`
- Add method or parameter to use mood template vs. action template

---

## Data Flow Summary

### Mood Update Prompt Assembly

```
MoodUpdatePromptPipeline.generateMoodUpdatePrompt()
  → AIPromptContentProvider.getMoodUpdatePromptData()
    → getMoodUpdateTaskDefinitionContent(characterName)    // NEW
    → getMoodUpdatePortrayalGuidelinesContent(characterName) // NEW
    → getMoodUpdateInstructionsContent(characterName)      // MODIFIED (adds [CHARACTER_NAME] replacement)
    → getCharacterPersonaContent(gameStateDto, { includeMoodAxes: true }) // MODIFIED
      → CharacterDataXmlBuilder.buildCharacterDataXml(characterData, { includeMoodAxes: true })
        → #buildInnerStateSection(emotionalState, { includeMoodAxes: true }) // MODIFIED
          → Outputs mood_axes and sex_variables sub-elements
  → PromptBuilder.build(llmId, promptData, { isMoodUpdatePrompt: true })
    → PromptDataFormatter.formatPromptData(promptData, { isMoodUpdatePrompt: true })
      → formatMoodUpdateThoughtsSection()  // NEW - simplified
      → notesVoiceGuidance = ''            // NEW - empty
    → PromptTemplateService.processMoodUpdatePrompt(formattedData) // NEW
      → Uses MOOD_UPDATE_PROMPT_TEMPLATE
```

### Action Decision Prompt Assembly (UNCHANGED except identity comment)

```
AIPromptPipeline.generatePrompt()
  → AIPromptContentProvider.getPromptData()
    → getTaskDefinitionContent()           // Original action task
    → getCharacterPortrayalGuidelinesContent() // Original with speech bullet
    → getFinalInstructionsContent()        // Original action instructions
    → getCharacterPersonaContent(gameStateDto, { includeMoodAxes: false })
      → No mood_axes or sex_variables output
  → PromptBuilder.build()
    → PromptDataFormatter.formatPromptData(promptData, { isMoodUpdatePrompt: false })
      → formatThoughtsSection()            // Full guidance
      → formatNotesVoiceGuidance()         // Full notes guidance
    → PromptTemplateService.processCharacterPrompt() // Original template
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/unit/prompting/corePromptText.test.js` (NEW or extend existing)
- Verify `moodUpdateOnlyInstructionText` contains PRIMARY RULE, CHARACTER LENS, CONTINUITY sections
- Verify `moodUpdateTaskDefinitionText` exists and contains correct content
- Verify `moodUpdatePortrayalGuidelinesTemplate` exists and excludes speech bullet

**File:** `tests/unit/prompting/characterDataXmlBuilder.test.js`
- Test `#buildInnerStateSection()` with `includeMoodAxes: true` outputs mood_axes and sex_variables
- Test `#buildInnerStateSection()` with `includeMoodAxes: false` omits them
- Test `#buildIdentityPrimingComment()` includes "emotion"

**File:** `tests/unit/prompting/promptDataFormatter.test.js`
- Test `formatMoodUpdateThoughtsSection()` outputs simplified format
- Test `formatPromptData()` with `isMoodUpdatePrompt: true` omits notes guidance

**File:** `tests/unit/prompting/AIPromptContentProvider.test.js`
- Test `getMoodUpdatePromptData()` uses mood-specific task definition
- Test `getMoodUpdatePromptData()` uses mood-specific portrayal guidelines
- Test character persona content includes mood axes for mood prompts

**File:** `tests/unit/prompting/promptTemplateService.test.js`
- Test `processMoodUpdatePrompt()` uses correct template
- Test mood template omits available_actions_info section

### Integration Tests

**File:** `tests/integration/prompting/moodUpdatePromptGeneration.integration.test.js` (NEW)
- End-to-end test of mood prompt generation
- Verify final prompt contains:
  - Mood-specific system constraints with CHARACTER LENS
  - Mood-specific task definition
  - Current mood axes and sex variables in inner_state
  - Simplified thoughts section (no generation guidance)
  - No notes guidance
  - No available_actions_info section
  - Updated identity comment with "emotion"

**File:** `tests/integration/prompting/actionPromptGeneration.integration.test.js` (verify no regression)
- Verify action prompt unchanged except identity comment
- Verify action prompt does NOT include mood_axes/sex_variables in inner_state

### Existing Test Updates

Review and update these existing test files:
- `tests/unit/prompting/MoodUpdatePromptPipeline.test.js`
- `tests/unit/turns/services/MoodResponseProcessor.test.js`
- Any integration tests that snapshot or assert on prompt content

---

## Migration Considerations

1. **Backward Compatibility**: These changes only affect the mood update prompt; action prompts remain largely unchanged
2. **No Schema Changes**: The LLM response schema for mood updates remains the same
3. **No Component Changes**: Entity mood/sexual state components unchanged
4. **Character Name Substitution**: Ensure all new templates correctly substitute `[CHARACTER_NAME]` or `{{name}}` placeholders

---

## Verification Checklist

After implementation, verify:

- [ ] `corePromptText.json` contains new `moodUpdateOnlyInstructionText` with PRIMARY RULE and CHARACTER LENS
- [ ] `corePromptText.json` contains new `moodUpdateTaskDefinitionText`
- [ ] `corePromptText.json` contains new `moodUpdatePortrayalGuidelinesTemplate` (no speech bullet)
- [ ] `CharacterDataXmlBuilder` identity comment includes "emotion"
- [ ] `CharacterDataXmlBuilder` outputs `mood_axes` and `sex_variables` for mood prompts only
- [ ] `ActorDataExtractor` extracts mood axes and sex variables into EmotionalStateDTO
- [ ] `PromptDataFormatter` has `formatMoodUpdateThoughtsSection()` method
- [ ] `PromptDataFormatter.formatPromptData()` accepts `isMoodUpdatePrompt` option
- [ ] Mood template (`MOOD_UPDATE_PROMPT_TEMPLATE`) exists and omits notes/actions sections
- [ ] `PromptTemplateService` has `processMoodUpdatePrompt()` method
- [ ] `AIPromptContentProvider.getMoodUpdatePromptData()` uses all mood-specific methods
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] "Prompt to LLM" debug button in game.html shows correct mood prompt structure

---

## Files Modified Summary

| File | Change Type |
|------|-------------|
| `data/prompts/corePromptText.json` | Add 3 new fields, modify 1 field |
| `src/prompting/characterDataXmlBuilder.js` | Modify identity comment, add mood axes output |
| `src/prompting/promptDataFormatter.js` | Add mood thoughts method, modify formatPromptData |
| `src/prompting/AIPromptContentProvider.js` | Add 3 new methods, modify getMoodUpdatePromptData |
| `src/prompting/promptStaticContentService.js` | Add 2 new methods |
| `src/prompting/promptTemplateService.js` | Add mood template processing method |
| `src/prompting/templates/characterPromptTemplate.js` | Add MOOD_UPDATE_PROMPT_TEMPLATE |
| `src/prompting/promptBuilder.js` | Add isMoodUpdatePrompt option handling |
| `src/turns/services/actorDataExtractor.js` | Extract mood axes and sex variables |
| `tests/unit/prompting/*.test.js` | Add/update tests |
| `tests/integration/prompting/*.test.js` | Add new integration tests |
