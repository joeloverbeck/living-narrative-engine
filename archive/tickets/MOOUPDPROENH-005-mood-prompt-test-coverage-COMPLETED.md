# MOOUPDPROENH-005: Add unit and integration coverage for mood prompt changes

## Summary

Confirm existing unit coverage for mood prompt enhancements, then add missing integration coverage for mood update prompt generation and action prompt regression (no mood axes/sex variables).

## Background

The spec's behavior changes are already implemented in production code and most unit tests. This ticket now focuses on validating the end-to-end prompt output for mood updates and ensuring action prompts do not leak mood axes/sex variables.

## Reassessment (Current State vs Original Assumptions)

- The spec changes are already implemented in `data/prompts/corePromptText.json` and the prompt assembly pipeline.
- Unit coverage already exists for core prompt text, mood update task definition, portrayal guidelines, thoughts formatting, identity comment, and mood axes XML inclusion.
- The missing coverage is an integration-level prompt generation test for mood update prompts and a regression assertion for action prompts (no mood axes/sex variables).

## File List (Expected to Touch)

### Existing Files
- `tests/unit/prompting/corePromptText.test.js`
- `tests/unit/prompting/characterDataXmlBuilder.test.js`
- `tests/unit/prompting/promptDataFormatter.test.js`
- `tests/unit/prompting/AIPromptContentProvider.getMoodUpdatePromptData.test.js`
- `tests/unit/prompting/promptTemplateService.test.js`

### New Files
- `tests/integration/prompting/moodUpdatePromptGeneration.integration.test.js`

## Out of Scope (MUST NOT Change)

- Production prompt assembly code outside of test fixtures or helpers
- Game content or JSON packs under `data/mods/`
- Snapshot baselines unrelated to prompt content changes

## Implementation Details

- Unit coverage is already present for:
  - core prompt text fields, mood portrayal guidelines, and instruction text
  - mood axes + sex variables inclusion/omission in XML builder
  - mood-specific thoughts formatting and notes guidance omission
  - mood update task definition + portrayal guidelines usage
  - mood update template omission of notes/actions sections
- Add an integration test that generates a mood update prompt and asserts:
  - Mood system constraints include CHARACTER LENS guidance.
  - Task definition is mood-specific with name substitution.
  - `<mood_axes>` and `<sex_variables>` appear in `<inner_state>`.
  - Notes guidance and available actions are omitted.
  - Identity priming includes "emotion".
  - Mood prompt thoughts section omits action prompt guidance.
- Add action prompt integration coverage to confirm no mood axes or sex variables are present.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPattern="prompting"`
2. `npm run test:integration -- --runInBand --testPathPattern="prompting"`

### Invariants That Must Remain True

1. Integration tests remain deterministic with stable fixtures.
2. Mood prompt tests do not introduce new schema expectations for LLM responses.

## Status

Completed.

## Outcome

- Added integration coverage for mood update prompt generation and action prompt regression (no mood axes/sex variables).
- Updated prompt builder and prompt content provider test expectations to include the mood prompt formatting options.
- No production code changes were required; existing unit coverage already matched the spec updates.
