# MOOUPDPROENH-002: Include mood axes and sex variables in inner_state

## Summary

Extend emotional state extraction and XML rendering so mood update prompts include current mood axes and sex variables, and update the identity priming comment to mention emotion. Wire this through `CharacterDataXmlBuilder.buildCharacterDataXml()` options so action prompts remain unchanged.

## Status

Completed

## Background

The mood update prompt needs numeric continuity. The spec adds `mood_axes` and `sex_variables` to the `<inner_state>` section for mood prompts only, plus a small identity comment tweak.

## File List (Expected to Touch)

### Existing Files
- `src/turns/services/actorDataExtractor.js`
- `src/prompting/characterDataXmlBuilder.js`
- `src/prompting/AIPromptContentProvider.js`
- `src/turns/dtos/AIGameStateDTO.js` (EmotionalStateDTO docs)
- `tests/unit/turns/services/actorDataExtractor.emotionalState.test.js`
- `tests/unit/prompting/characterDataXmlBuilder.test.js`
- `tests/unit/prompting/AIPromptContentProvider.getMoodUpdatePromptData.test.js`

## Out of Scope (MUST NOT Change)

- Prompt templates or prompt builder wiring
- Prompt text fields in `corePromptText.json`
- Prompt data formatter behavior (thoughts/notes/available actions)
- Mood prompt system constraints, task definitions, or portrayal guidelines (already implemented in MOOUPDPROENH-001)

## Implementation Details

- Extend `extractEmotionalState()` to include `sexVariables` in `EmotionalStateDTO` (derive from the sexual state component values). `moodAxes` are already extracted and should remain unchanged.
- Update `CharacterDataXmlBuilder.buildCharacterDataXml(characterData, options = {})` to forward `{ includeMoodAxes }` into `#buildCurrentStateSection()` and `#buildInnerStateSection()`.
- Update `CharacterDataXmlBuilder.#buildInnerStateSection(emotionalState, options = {})` to output `<mood_axes>` and `<sex_variables>` only when `options.includeMoodAxes` is true.
- Add `#formatMoodAxes()` and `#formatSexVariables()` helpers to keep formatting consistent.
- Update `#buildIdentityPrimingComment()` to include "emotion".
- Ensure `AIPromptContentProvider.getCharacterPersonaContent(gameState, options = {})` passes `{ includeMoodAxes: true }` for mood prompts and `{ includeMoodAxes: false }` for action prompts.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="characterDataXmlBuilder" --coverage=false`
2. `npm run test:unit -- --runInBand --testPathPatterns="actorDataExtractor.emotionalState" --coverage=false`
3. `npm run test:unit -- --runInBand --testPathPatterns="AIPromptContentProvider.getMoodUpdatePromptData" --coverage=false`

### Invariants That Must Remain True

1. Action prompts do not include `<mood_axes>` or `<sex_variables>`.
2. `<emotional_state>` and optional `<sexual_state>` remain unchanged for existing flows.
3. The identity priming comment is updated consistently for both mood and action prompts.

## Outcome

- Added mood axes and sex variables rendering behind `includeMoodAxes`, plus identity comment update.
- Added `sexVariables` extraction, DTO docs, and unit tests to cover the new data flow.
- Updated test commands for Jest CLI and subset coverage behavior.
