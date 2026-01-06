# EMOSEXSTADISCON-002: Register Emotion Display Config in DI

## Summary

Wire the emotion display config loader into the dependency injection container so the resolved config can be consumed by services.

## Status

Completed

## Priority: High | Effort: Medium

## Rationale

The configuration must be resolved once at startup and made available to services without hardcoding defaults at call sites.

## Assumptions (Updated)

- `src/configuration/emotionDisplayConfigLoader.js` already exists with named + default exports, so no loader shape change is required for DI usage.
- Loader unit tests already exist in `tests/unit/configuration/emotionDisplayConfigLoader.test.js`.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/configuration/emotionDisplayConfigLoader.js` | **No Change** - Export shape already supports DI usage |
| `src/configuration/utils/emotionDisplayConfigUtils.js` | **Create** - Load config and register it in the container |
| `src/dependencyInjection/`* | **Update** - Register config and token |
| `tests/unit/dependencyInjection/`* | **Update/Create** - DI registration tests |
| `tests/unit/configuration/utils/`* | **Update/Create** - Config utility tests |

*Use the existing DI registration pattern used for trace/logger configuration.

## Out of Scope

- **DO NOT** change `EmotionCalculatorService` logic (handled in EMOSEXSTADISCON-003)
- **DO NOT** update UI panels or prompt generation code
- **DO NOT** change config JSON defaults (handled in EMOSEXSTADISCON-001)
- **DO NOT** add new validation rules beyond the loader

## Implementation Details

- Add a new DI token for the config (e.g. `IEmotionDisplayConfiguration`).
- Ensure bootstrap loads the config via the loader and registers the resolved object in the container (mirroring `loadAndApplyTraceConfig`).
- Follow existing `TraceConfigLoader`/`LoggerConfigLoader` patterns.
- DI registration should not throw when loader returns defaults after warning.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/dependencyInjection --runInBand --verbose
```

### Invariants That Must Remain True

1. DI registration still completes when config file is missing or invalid.
2. No DI token name collisions with existing registrations.
3. No new console logging in browser code (use `ILogger`).

## Definition of Done

- [x] Config loader is registered in DI using the existing registration pattern.
- [x] DI tests cover successful registration and fallback-to-defaults behavior.
- [x] No runtime exceptions when config file is missing.

## Outcome

Registered emotion display configuration in the container via a new config utility (no loader shape changes were needed) and added focused config utility tests alongside DI test updates to cover registration and fallback behavior.
