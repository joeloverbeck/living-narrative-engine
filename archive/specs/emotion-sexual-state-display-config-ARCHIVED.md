# Emotional/Sexual State Display Config Spec

## Context and Current Behavior

- The EMOTIONAL STATE panel text is rendered in `src/domUI/emotionalStatePanel.js` via `EmotionCalculatorService.formatEmotionsForPrompt()` with no explicit `maxCount`, so the default applies.
- The SEXUAL STATE panel text is rendered in `src/domUI/sexualStatePanel.js` via `EmotionCalculatorService.formatSexualStatesForPrompt()` with no explicit `maxCount`, so the default applies.
- Defaults are hardcoded in `src/emotions/emotionCalculatorService.js`:
  - `formatEmotionsForPrompt(emotions, maxCount = 5)`
  - `formatSexualStatesForPrompt(sexualStates, maxCount = 3)`
- These formatters are also used in prompt generation (e.g. `src/turns/services/actorDataExtractor.js`), so changing defaults will affect LLM prompt output as well as UI panels.

## Goal

Externalize the maximum number of emotional/sexual states shown in the UI text (and any formatter default usage) into a config file under `config/`, and raise the emotional default maximum from 5 to 7 while keeping sexual defaults lower.

## Requirements

1. The maximum number of emotional states and sexual states included in formatted text must be configurable via a JSON file in `config/`.
2. Default values should be 7 for emotional states and 5 for sexual states unless explicitly overridden by config.
3. The change must apply to the UI panels and any other call sites that rely on formatter defaults (e.g. prompt generation).
4. Config loading must be resilient: missing file or invalid values should log warnings and fall back to defaults.
5. All affected tests must be updated, and new tests added where configuration behavior is introduced.

## Proposed Configuration

Create a new config file:

`config/emotion-display-config.json`

Suggested shape:

```json
{
  "maxEmotionalStates": 7,
  "maxSexualStates": 5
}
```

Notes:
- These names are intentionally explicit and match formatter semantics.
- If a different naming scheme exists in the codebase, align with it.

## Implementation Plan (No Code Yet)

### 1) Add a Config Loader

Create a loader similar to `TraceConfigLoader` and `LoggerConfigLoader`:

- New file: `src/configuration/emotionDisplayConfigLoader.js`
- Default path: `config/emotion-display-config.json`
- Validate that `maxEmotionalStates` and `maxSexualStates` are positive integers.
- Provide defaults (7 for emotions, 5 for sexual states) when missing/invalid.
- Log warnings via `ILogger` when the config is missing or invalid, but do not fail the app.

### 2) Register the Config in DI

- Add a new DI token (e.g. `IEmotionDisplayConfiguration` or similar).
- Load the config early in bootstrap and register the resolved config object in the container.
- Follow the pattern used by trace/logger configuration utilities.

### 3) Wire the Config Into EmotionCalculatorService

Preferred approach to minimize call-site changes:

- Extend `EmotionCalculatorService` constructor to accept an optional `displayConfig` object.
- Store defaults in the service and update `formatEmotionsForPrompt` / `formatSexualStatesForPrompt` to use the configured default when `maxCount` is not provided.
- Keep per-call override support: if callers pass `maxCount`, that value wins.

This keeps UI panels unchanged (they rely on defaults), but now defaults come from config.

### 4) Update Call Sites (If Needed)

Only required if any call sites are intended to use different limits than the configured defaults. Otherwise, no changes should be needed in `src/domUI/emotionalStatePanel.js`, `src/domUI/sexualStatePanel.js`, or `src/turns/services/actorDataExtractor.js`.

## Testing Plan

### Update Existing Tests

- `tests/unit/emotions/emotionCalculatorService.test.js`
  - Adjust tests that assume defaults (5 for emotions, 3 for sexual states) to the new defaults (7 emotions, 5 sexual states).
  - Add coverage to verify default counts come from config when provided.
  - Retain tests for explicit `maxCount` overrides.

- DI registration tests that construct `EmotionCalculatorService`:
  - `tests/unit/dependencyInjection/registrations/registerUI.test.js`
  - `tests/unit/config/registrations/uiRegistrations.resolve.test.js`
  - Any other tests that instantiate `EmotionCalculatorService` should supply the new config dependency or use default wiring.

### Add New Tests

- New unit tests for `EmotionDisplayConfigLoader`:
  - Valid config returns parsed values.
  - Missing file returns defaults with warnings.
  - Invalid values (non-integers, negative, NaN) fall back to defaults.

- If a config bootstrap/initializer is added, include a unit test to assert it registers config in the container and does not throw on load failure.

## Open Questions

- Confirmed: `maxSexualStates` should default to 5 (current code uses 3 by default).
