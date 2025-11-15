# RECVALREF-014: Create New CLI Entry Point

**Phase:** 4 - Pipeline Orchestration
**Priority:** P0 - Critical
**Estimated Effort:** 4 hours
**Dependencies:** RECVALREF-012, RECVALREF-013

## Context

Current CLI (`scripts/validate-recipe.js`) already wires Commander to the existing `RecipePreflightValidator`, which in turn drives the `ValidationPipeline`/`ValidatorRegistry` chain described in the anatomy docs. However, the entry point still:
- Hardcodes the minimal mod list and manually runs Schema/Manifest/Content phases instead of deferring to configuration (`scripts/validate-recipe.js`, lines 14-210)【F:scripts/validate-recipe.js†L14-L239】
- Never loads `config/validation-config.json`, so pipeline toggles, severity overrides, and output format metadata defined there are ignored (`config/validation-config.json`, lines 1-92)【F:config/validation-config.json†L1-L92】
- Passes no `validationPipelineConfig` into `RecipePreflightValidator`, so the `ValidationPipeline` always runs with default settings despite supporting overrides (`src/anatomy/validation/RecipePreflightValidator.js`, lines 13-220)【F:src/anatomy/validation/RecipePreflightValidator.js†L13-L220】
- Keeps documentation-stated CLI options limited to `--verbose`, `--json`, and `--fail-fast`, leaving no pathway for configuration files or alternative output targets noted in the refactor plan (`docs/anatomy/anatomy-testing-guide.md`, lines 158-175)【F:docs/anatomy/anatomy-testing-guide.md†L158-L175】
- Spreads container bootstrapping, mod loading, validation, and formatting across a 250-line script rather than extracting a testable runner

## Objectives

1. Create a new `scripts/validate-recipe-v2.js` entry point that delegates to a focused runner function (mirroring `scripts/validateRecipeCore.js` usage) instead of keeping all orchestration logic inline.
2. Wire the entry point to the existing `ConfigurationLoader` (`src/anatomy/validation/core/ConfigurationLoader.js`) so default + user configs are validated and merged before being passed into `RecipePreflightValidator`/`ValidationPipeline`.【F:src/anatomy/validation/core/ConfigurationLoader.js†L1-L200】
3. Respect the documentation-backed CLI surface area by preserving `-v/--verbose`, `-j/--json`, and `--fail-fast`, while adding `-c/--config` plus opt-in `--format <text|json|junit>` overrides that funnel into the config's `output` block.
4. Support CLI overrides for pipeline toggles (e.g., fail-fast, severity, format) by merging flags into the loader's `overrides` argument so downstream validators receive a populated `validationPipelineConfig`.
5. Maintain backward-compatible console and JSON output (per `docs/anatomy/anatomy-system-guide.md` and current CLI behaviour) while optionally emitting machine-readable formats.【F:docs/anatomy/anatomy-system-guide.md†L117-L144】
6. Ensure `scripts/validate-recipe.js` becomes a thin wrapper that forwards `process.argv` to the new module so existing npm scripts and docs remain accurate.

## Implementation

### File to Create
`scripts/validate-recipe-v2.js`

### Features
- Commander-based CLI that mirrors the current command signature while adding `--config` and `--format` flags.
- Configuration loading via `ConfigurationLoader.load(customPath, overrides)` so we can consume `config/validation-config.json` by default and allow per-invocation overrides.
- Recipe file loading/parsing that reuses `loadRecipeFile`+`validateRecipeCore` helpers where possible instead of duplicating formatting logic.
- Container/bootstrap orchestration that still calls `configureMinimalContainer` but now derives mod lists (essential, optional, auto-detect) from the loaded config rather than a hardcoded array.
- Pass the resolved `{ pipelineConfig }` into `new RecipePreflightValidator({ ..., validationPipelineConfig: pipelineConfig })` so the embedded `ValidationPipeline` honors validator enablement, priorities, and severity overrides defined in configuration.
- Result formatting that keeps legacy text + `--json` output intact while optionally serializing to JSON/JUnit when requested via config/CLI overrides.

### CLI Options
```bash
validate-recipe [recipes...] [options]

Options:
  -v, --verbose           Verbose output
  -j, --json              Emit per-recipe JSON (existing behaviour)
  -c, --config <path>     Custom configuration file
  --fail-fast             Stop on first error
  --format <type>         Override output format (text|json|junit)
```

## Testing
- Integration tests: `tests/integration/cli/validate-recipe-v2.integration.test.js`
- Test all CLI options
- Test configuration loading
- Test output formatting
- Test error scenarios

## Acceptance Criteria
- [ ] New CLI entry point created
- [ ] Uses ValidationPipeline
- [ ] Supports configuration files
- [ ] All CLI options implemented
- [ ] Output format matches original
- [ ] Integration tests pass
- [ ] Documentation updated

## Backward Compatibility

Wrapper script to maintain old CLI:
```javascript
// scripts/validate-recipe.js
import { runValidation } from './validate-recipe-v2.js';
await runValidation(process.argv);
```

## References
- **Recommendations:** Phase 4.3
- **Analysis:** Section "Manual Phase Orchestration"
