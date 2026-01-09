# MOOUPDPROENH-003: Add mood-specific prompt data formatting

## Summary

Introduce mood-specific thoughts rendering and suppress notes guidance when building mood update prompt data.

## Status

Completed

## Background

Mood prompts should include only recent thoughts without guidance and omit notes guidance entirely. This requires new formatter behavior gated by an `isMoodUpdatePrompt` option.

## Assumptions & Scope Notes

- This ticket only updates the prompt data formatter and its unit tests; mood prompt wiring into the builder/template is handled elsewhere.
- The `isMoodUpdatePrompt` flag is introduced here for use by the mood prompt pipeline once it is wired to pass the option.

## File List (Expected to Touch)

### Existing Files
- `src/prompting/promptDataFormatter.js`
- `tests/unit/prompting/promptDataFormatter.test.js`

## Out of Scope (MUST NOT Change)

- Prompt templates or template service logic
- Prompt builder routing or pipeline decisions
- `corePromptText.json` content
- Character XML formatting or data extraction
- Unrelated tests or snapshots

## Implementation Details

- Add `formatMoodUpdateThoughtsSection(thoughtsArray)` to return a minimal `<thoughts>` section without guidance.
- Update `formatPromptData(promptData, options = {})` to accept `options.isMoodUpdatePrompt` and:
  - Use `formatMoodUpdateThoughtsSection()` when true.
  - Return an empty string for `notesVoiceGuidance` when true.
- Keep existing behavior unchanged when `isMoodUpdatePrompt` is false or unset.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="promptDataFormatter"`

### Invariants That Must Remain True

1. Action prompt formatting remains unchanged when `isMoodUpdatePrompt` is false.
2. Mood prompts do not include notes guidance text.
3. The thoughts section always renders valid XML tags even when there are no recent thoughts.

## Outcome

- Added mood-specific thoughts formatting and gated notes guidance suppression behind `isMoodUpdatePrompt`.
- Updated formatter unit tests to cover mood-specific output and placeholder behavior.
