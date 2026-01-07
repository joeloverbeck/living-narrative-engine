# LLM Speech No-Recap Instruction

## Goal
Reduce production issue where LLM speech responses recap prior dialogue instead of advancing the scene.

## Current Prompt Assembly ("Prompt to LLM" path)
- UI button `Prompt to LLM` (game.html) triggers `GameEngine.previewLlmPromptForCurrentActor()` via `setupMenuButtonListenersStage`.
- Prompt preview and actual LLM calls both use `AIPromptPipeline.generatePrompt()`.
- Prompt pipeline flow:
  - `AIPromptPipeline` builds game state + available actions.
  - `AIPromptContentProvider.getPromptData()` assembles prompt fields.
  - `PromptBuilder.build()` formats data via `PromptDataFormatter` and injects into `CHARACTER_PROMPT_TEMPLATE`.
- `CHARACTER_PROMPT_TEMPLATE` places `actionTagRulesContent` and `finalInstructionsContent` inside `<system_constraints>` at the top of the prompt.
- Static prompt text is loaded from `data/prompts/corePromptText.json` via `PromptStaticContentService`:
  - `actionTagRulesContent`
  - `coreTaskDescriptionText`
  - `characterPortrayalGuidelinesTemplate`
  - `nc21ContentPolicyText`
  - `finalLlmInstructionText`

## Observed Issue
The model frequently recaps or rehashes other actors' dialogue in the `speech` field, which slows pacing and creates redundant output.

## Proposed Change (Spec Only)
Add an explicit speech constraint to discourage recap/summary of prior dialogue unless it is narratively required.

### Preferred Location
`data/prompts/corePromptText.json` -> `finalLlmInstructionText` under the existing speech-related guidance. This content is already injected in `<system_constraints>`, so it benefits from early placement and higher adherence.

### Recommended Wording (Primary Option)
Add a short block in `finalLlmInstructionText` after the "SPEECH COLORING" section:

```
SPEECH CONTENT RULE (CRITICAL):
- Do NOT recap or summarize prior dialogue. Your speech should advance the scene with a new contribution.
- Only restate prior dialogue if absolutely necessary for in-character clarification or if another character explicitly requests a recap.
- If a recap is unavoidable, keep it to one short clause and move on.
```

### Alternative Wording (Compact)
If brevity is preferred:

```
SPEECH RULE: Avoid recapping previous dialogue. Speak only new, scene-advancing content unless a recap is explicitly requested or required for clarity.
```

## Rationale
- The prompt already emphasizes action variety and distinct thoughts vs speech. This new rule targets dialogue repetition specifically and does so within the high-priority constraint area.
- "Only if absolutely necessary" combined with "explicitly requested" narrows allowed recap behavior without blocking legitimate clarifications.
- A short clause limit curbs summary drift while still allowing minimal context when needed.

## Acceptance Criteria
- Prompt preview includes the new rule inside `<system_constraints>`.
- In normal turns, `speech` avoids recap unless characters explicitly ask for it or clarity requires it.
- When recap is required, output stays brief and immediately transitions to new dialogue.
