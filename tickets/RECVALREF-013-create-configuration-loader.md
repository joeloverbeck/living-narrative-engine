# RECVALREF-013: Create Configuration Loader

**Phase:** 4 - Pipeline Orchestration
**Priority:** P0 - Critical
**Estimated Effort:** 3 hours
**Dependencies:** RECVALREF-003, RECVALREF-004

## Context

- `config/validation-config.json` (RECVALREF-004) and `data/schemas/validation-config.schema.json` (RECVALREF-003) exist and are already tested by `tests/unit/config/defaultValidationConfig.test.js`, but no runtime code reads them.
- `RecipePreflightValidator` wires the new `ValidationPipeline` (`src/anatomy/validation/core/ValidationPipeline.js`) via its `validationPipelineConfig` constructor argument, yet `scripts/validate-recipe.js` never supplies a configuration object and instead hard-codes mod loading and legacy skip flags.
- Every validator under `src/anatomy/validation/validators/` exposes a hyphenated `name` (for example `'pattern-matching'`, `'descriptor-coverage'`), so any loader must normalize whatever comes from JSON (currently underscore-delimited) to those runtime identifiers before handing data to the pipeline.
- The anatomy docs (see `docs/anatomy/anatomy-system-guide.md`, validation pipeline section) confirm the pre-flight validation stage already depends on Ajv schema validation and DI-managed services, so the loader has to plug into `ISchemaValidator` (`src/validation/ajvSchemaValidator.js`) rather than instantiate Ajv directly.

## Objectives

1. Create `ConfigurationLoader` class
2. Load and validate configuration from file
3. Support default + user config merging
4. Provide schema validation

## Implementation

### File to Create
`src/anatomy/validation/core/ConfigurationLoader.js`

### Responsibilities
- Accept `{ schemaValidator, logger, defaultConfigPath }` so it can reuse the existing `ISchemaValidator` implementation and the logger pattern used by `ValidationPipeline` and `ValidatorRegistry`.
- `load(configPath, overrides = {})` should read JSON from the provided path (falling back to `defaultConfigPath`), validate it against `schema://living-narrative-engine/validation-config.schema.json`, deep-merge it with any override object, and return an immutable structure `{ rawConfig, pipelineConfig }`.
- `merge(defaultConfig, userConfig)` must combine the top-level sections (`mods`, `validators`, `errorHandling`, `output`) with predictable precedence (user wins) while preserving validator priorities from JSON so downstream consumers (like the CLI) can report them.
- `#mergeValidators(defaultValidators, userValidators)` should deduplicate by validator `name`, normalize identifiers to the hyphenated values defined by the `BaseValidator` subclasses, and retain `enabled`, `failFast`, `priority`, and any nested `config` data.
- Emit `pipelineConfig` in the format that `ValidationPipeline` already expects: `{ validators: { [validatorName]: { enabled, severityOverrides } } }` plus any future knobs (for example, error handling), deriving severity overrides from `errorHandling.severityOverrides` after normalizing the names.
- Surface mod-loading metadata for the CLI (`mods.essential`, `mods.optional`, `mods.autoDetect`) so `scripts/validate-recipe.js` and the upcoming v2 CLI can stop hard-coding the list from inside `createValidationContext`.

### Features
- Schema validation through the existing Ajv-backed `ISchemaValidator`
- Default config fallback with optional override path
- Validator normalization that bridges underscore-delimited JSON entries to the hyphenated runtime names used by `BaseValidator`
- Pipeline configuration output ready for `RecipePreflightValidator`'s `validationPipelineConfig`
- Structured logging plus actionable errors when files are missing, invalid JSON, or schema validation fails

## Testing
- Unit tests: `tests/unit/anatomy/validation/core/ConfigurationLoader.test.js`
- Cover happy-path loading of `config/validation-config.json` and optional override files
- Assert schema validation failures bubble up with logger/error context
- Assert `merge`/`#mergeValidators` normalize validator names (for example, `component_existence` → `component-existence`) and deduplicate correctly
- Verify `pipelineConfig` matches the structure `ValidationPipeline` expects (`validators` map with enablement plus severity overrides)
- Verify loader exposes `mods` data so the CLI can replace the hard-coded arrays in `scripts/validate-recipe.js`

## Acceptance Criteria
- [ ] Loader class created with DI
- [ ] Loads and validates config files
- [ ] Merges default and user configs correctly
- [ ] Schema validation enforced
- [ ] Unit tests achieve 90%+ coverage

## References
- **Recommendations:** Phase 4.2
