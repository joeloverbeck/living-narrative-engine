# MOOUPDPROENH-001: Add mood prompt text fields and content helpers

**Status**: ✅ COMPLETED (2026-01-09)

## Summary

Introduce mood-specific prompt text fields in `corePromptText.json` and wire content helper methods so mood update prompts use the new task definition, portrayal guidelines, and system constraints with character-name substitution performed in the content provider.

## Background

The mood update prompt needs dedicated instructions, task definition, and portrayal guidance separate from action prompts. The spec adds new JSON fields and helper methods so `AIPromptContentProvider` can generate mood-specific content.

## Assumptions (Rechecked)

- `PromptStaticContentService` currently exposes only `moodUpdateOnlyInstructionText` without character-name substitution.
- `AIPromptContentProvider.getMoodUpdatePromptData()` currently reuses the action task definition and portrayal guidelines.
- Unit tests exist for `PromptStaticContentService` and `AIPromptContentProvider.getMoodUpdatePromptData()` and should be updated to cover the new fields and substitutions.

## File List (Expected to Touch)

### Existing Files
- `data/prompts/corePromptText.json`
- `src/prompting/promptStaticContentService.js`
- `src/prompting/AIPromptContentProvider.js`

## Out of Scope (MUST NOT Change)

- Prompt templates or prompt builder wiring
- Character XML formatting (inner_state, identity comment)
- Prompt data formatter behavior (thoughts/notes/available actions)
- Any changes scoped to other MOOUPDPROENH tickets

## Implementation Details

- Add `moodUpdateTaskDefinitionText` and `moodUpdatePortrayalGuidelinesTemplate` fields to `corePromptText.json`.
- Replace the existing `moodUpdateOnlyInstructionText` value with the new content from the spec (including `[CHARACTER_NAME]`).
- Add `getMoodUpdateTaskDefinitionText()` and `getMoodUpdatePortrayalGuidelines(characterName)` to `PromptStaticContentService`.
- Add `getMoodUpdateTaskDefinitionContent(characterName)` and `getMoodUpdatePortrayalGuidelinesContent(characterName)` to `AIPromptContentProvider`.
- Update `getMoodUpdateInstructionsContent(characterName)` to replace `[CHARACTER_NAME]` in `moodUpdateOnlyInstructionText`.
- Update `getMoodUpdatePromptData()` to use the mood-specific task definition, portrayal guidelines, and substituted mood-only instructions.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="corePromptText"`
2. `npm run test:unit -- --runInBand --testPathPattern="promptStaticContentService"`
3. `npm run test:unit -- --runInBand --testPathPattern="AIPromptContentProvider.getMoodUpdatePromptData"`

### Invariants That Must Remain True

1. Action prompt content still uses the existing action task definition and portrayal guidelines.
2. No new prompt content fields are left blank or unset when accessed through the content service.
3. `[CHARACTER_NAME]` and `{{name}}` placeholders are fully replaced in mood content outputs.

## Outcome

- Added mood-specific task definition and portrayal guidelines fields, plus updated mood-only instructions from the spec.
- Updated content services to substitute `[CHARACTER_NAME]` in mood-only instructions and use mood-specific task/portrayal content.
- Added unit tests for core prompt text presence and mood-specific content service behaviors (tests were originally deferred to MOOUPDPROENH-005).
