# RECVALREF-013: Create Configuration Loader

**Phase:** 4 - Pipeline Orchestration
**Priority:** P0 - Critical
**Estimated Effort:** 3 hours
**Dependencies:** RECVALREF-003, RECVALREF-004

## Context

Configuration needs to be:
- Loaded from JSON files
- Validated against schema
- Merged with defaults
- Accessible throughout validation system

## Objectives

1. Create `ConfigurationLoader` class
2. Load and validate configuration from file
3. Support default + user config merging
4. Provide schema validation

## Implementation

### File to Create
`src/anatomy/validation/core/ConfigurationLoader.js`

### Key Methods
- `load(configPath)` - Load configuration from file
- `merge(defaultConfig, userConfig)` - Merge configurations
- `#mergeValidators(defaultValidators, userValidators)` - Merge validator configs

### Features
- Schema validation using AJV
- Default config fallback
- Validator priority-based sorting
- Error reporting for invalid configs

## Testing
- Unit tests: `tests/unit/anatomy/validation/core/ConfigurationLoader.test.js`
- Test successful config loading
- Test schema validation failures
- Test config merging
- Test validator priority sorting

## Acceptance Criteria
- [ ] Loader class created with DI
- [ ] Loads and validates config files
- [ ] Merges default and user configs correctly
- [ ] Schema validation enforced
- [ ] Unit tests achieve 90%+ coverage

## References
- **Recommendations:** Phase 4.2
