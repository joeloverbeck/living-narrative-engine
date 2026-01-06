# EMOSEXSTADISCON-003: Use Configured Defaults in EmotionCalculatorService

## Summary

Wire `EmotionCalculatorService` to use the already-registered emotion display configuration defaults when `maxCount` is not provided, and update unit tests to reflect the new default limits.

## Priority: High | Effort: Medium

## Rationale

The UI panels and prompt generation use formatter defaults. To keep call sites unchanged while honoring configuration, the service must source its defaults from the injected config (which is already loaded and registered via EMOSEXSTADISCON-001/002).

## Updated Assumptions

- `config/emotion-display-config.json`, `EmotionDisplayConfigLoader`, and `loadAndApplyEmotionDisplayConfig` already exist and register `IEmotionDisplayConfiguration`.
- No existing UI registration tests construct `EmotionCalculatorService` directly; wiring updates should focus on AI registrations and `EmotionCalculatorService` unit tests.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/emotions/emotionCalculatorService.js` | **Update** - Accept optional config and apply defaults |
| `src/dependencyInjection/registrations/aiRegistrations.js` | **Update** - Provide config dependency |
| `tests/unit/emotions/emotionCalculatorService.test.js` | **Update** - New default expectations + config default coverage |

*Only update tests that directly assert default max counts.

## Out of Scope

- **DO NOT** change any UI panel formatting text or layout.
- **DO NOT** override explicit `maxCount` behavior; per-call overrides must still win.
- **DO NOT** change prompt formatting beyond the default max count.
- **DO NOT** alter config loader behavior (handled in EMOSEXSTADISCON-001).

## Implementation Details

- Extend `EmotionCalculatorService` constructor to accept `displayConfig` (optional).
- Store default maxima on the service instance (fallback to 7/5 when config is missing).
- Update `formatEmotionsForPrompt` and `formatSexualStatesForPrompt`:
  - If `maxCount` is `undefined`/`null`, use configured defaults.
  - If a `maxCount` argument is provided, it takes precedence.
- Update AI DI registration to pass `IEmotionDisplayConfiguration` when available.
- Update tests to assert new defaults: `7` emotions, `5` sexual states, and that configured defaults are honored.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/emotions/emotionCalculatorService.test.js --verbose
npm run test:unit -- tests/unit/dependencyInjection/registrations/aiRegistrations.test.js --runInBand --verbose
```

### Invariants That Must Remain True

1. Explicit `maxCount` arguments still override defaults.
2. Formatters still return stable output ordering and content.
3. UI panels and prompt generation continue to call the same formatter methods.

## Definition of Done

- [x] Service uses configured defaults when `maxCount` is omitted.
- [x] Unit tests updated for new defaults and configured defaults.
- [x] AI DI wiring updated to pass display config.
- [x] No new regressions in existing formatter behavior.

## Outcome

- Wired `EmotionCalculatorService` to use configured defaults with 7/5 fallbacks and updated AI DI to pass `IEmotionDisplayConfiguration` when present.
- Updated formatter unit tests to the new defaults and added coverage for configured default usage; no UI registration test changes were needed.
