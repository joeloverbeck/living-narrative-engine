# MOOUPDPROENH-004: Add mood prompt template and routing

## Summary

Wire the already-implemented mood prompt formatting to a dedicated mood update template that omits notes and available actions, and route mood prompts through it while passing the mood formatting flag.

## Status

Completed

## Background

Mood prompt formatting (simplified thoughts and removal of notes guidance) is already implemented in `PromptDataFormatter`, and mood-specific prompt data is assembled in `AIPromptContentProvider`. However, the template routing still uses the character prompt template for all prompts, so mood prompts still render notes and available actions sections.

## File List (Expected to Touch)

### Existing Files
- `src/prompting/templates/characterPromptTemplate.js`
- `src/prompting/promptTemplateService.js`
- `src/prompting/promptBuilder.js`
- `src/prompting/MoodUpdatePromptPipeline.js`
- `tests/unit/prompting/promptTemplateService.test.js`
- `tests/unit/prompting/promptBuilder.test.js`

## Out of Scope (MUST NOT Change)

- Prompt text content in `corePromptText.json`
- Character XML formatting or data extraction
- Prompt data formatter implementation details
- Integration test coverage (handled in MOOUPDPROENH-005)

## Implementation Details

- Add `MOOD_UPDATE_PROMPT_TEMPLATE` to `characterPromptTemplate.js` with no notes or available actions sections.
- Add `processMoodUpdatePrompt(formattedData)` in `promptTemplateService.js` that uses the mood template.
- Update `promptBuilder.js` to accept and route an optional `isMoodUpdatePrompt` option:
  - Pass `isMoodUpdatePrompt` into `PromptDataFormatter.formatPromptData()`.
  - Choose `processMoodUpdatePrompt()` for mood prompts and the existing template for action prompts.
- Update `MoodUpdatePromptPipeline` to pass `isMoodUpdatePrompt: true` into `PromptBuilder.build()`.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="promptTemplateService"`
2. `npm run test:unit -- --runInBand --testPathPattern="promptBuilder"`

### Invariants That Must Remain True

1. Action prompt rendering continues to use the existing template.
2. Mood prompts do not contain `<available_actions_info>` tags or notes sections.
3. PromptBuilder behavior remains deterministic for the same input data.

## Outcome

Implemented a dedicated mood update template, routed mood prompts through it with the mood formatting flag, and extended unit tests for PromptBuilder/PromptTemplateService plus MoodUpdatePromptPipeline to validate routing. This matched the planned scope once test coverage was brought in-scope for this ticket.
