# EMOSEXSTADISCON-001: Add Emotion Display Config Loader

## Summary

Create the emotion display config file under `config/` and a resilient loader that validates values and falls back to defaults with warnings. The loader should follow existing configuration loader patterns (fetch-based, safe event dispatching) even though it is not wired into DI yet.

## Priority: High | Effort: Medium

## Rationale

We need a single, explicit configuration source for emotional/sexual display limits and a safe loading path that does not crash the app when the file is missing or invalid.

## Files to Touch

| File | Change Type |
|------|-------------|
| `config/emotion-display-config.json` | **Create** - Default config values |
| `src/configuration/emotionDisplayConfigLoader.js` | **Create** - Config loader |
| `tests/unit/configuration/emotionDisplayConfigLoader.test.js` | **Create** - Loader unit tests |

## Out of Scope

- **DO NOT** register the config in DI (handled in EMOSEXSTADISCON-002)
- **DO NOT** change `EmotionCalculatorService` defaults (handled in EMOSEXSTADISCON-003)
- **DO NOT** update UI panel rendering code (not required)
- **DO NOT** update prompt-generation call sites

## Implementation Details

### New File: config/emotion-display-config.json

```json
{
  "maxEmotionalStates": 7,
  "maxSexualStates": 5
}
```

### New File: src/configuration/emotionDisplayConfigLoader.js

- Load `config/emotion-display-config.json` via `fetchWithRetry` (matching `TraceConfigLoader`/`LoggerConfigLoader`).
- Validate `maxEmotionalStates` and `maxSexualStates` as positive integers.
- Defaults: `maxEmotionalStates = 7`, `maxSexualStates = 5`.
- Log warnings via `ILogger` when:
  - File missing/unreadable.
  - Values invalid (non-integer, <= 0, NaN).
- Return a plain object with validated defaults applied.
- Require a valid `ISafeEventDispatcher` instance in the constructor to satisfy `fetchWithRetry`.

### New File: tests/unit/configuration/emotionDisplayConfigLoader.test.js

Coverage:
- Valid config returns parsed values.
- Missing file logs warning and returns defaults.
- Invalid values log warning and return defaults.
- Partial config uses defaults for missing fields.
- Constructor rejects missing `ISafeEventDispatcher`.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/configuration/emotionDisplayConfigLoader.test.js --verbose
```

### Invariants That Must Remain True

1. Loader never throws for missing/invalid config.
2. Defaults remain `7` (emotional) and `5` (sexual) when config is absent/invalid.
3. Warnings are emitted via `ILogger` for invalid or missing config.

## Definition of Done

- [x] Config JSON exists under `config/` with defaults.
- [x] Loader returns validated configuration and logs warnings.
- [x] Unit tests cover valid, missing, invalid, and partial configs.
- [x] Loader enforces `ISafeEventDispatcher` requirement for fetch-based loading.

## Status

Completed.

## Outcome

- Implemented `config/emotion-display-config.json` defaults (7 emotional, 5 sexual).
- Added fetch-based `EmotionDisplayConfigLoader` with validation, warnings, and `ISafeEventDispatcher` enforcement.
- Added unit tests for valid, missing, invalid, and partial configurations; no DI wiring or service default changes in this ticket.
