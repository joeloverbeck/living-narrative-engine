# RECVALREF-014: Create New CLI Entry Point

**Phase:** 4 - Pipeline Orchestration
**Priority:** P0 - Critical
**Estimated Effort:** 4 hours
**Dependencies:** RECVALREF-012, RECVALREF-013

## Context

Current CLI (`scripts/validate-recipe.js`) has:
- Hardcoded mod dependencies
- Manual phase orchestration
- No configuration file support
- 248 lines of mixed concerns

## Objectives

1. Create new `validate-recipe-v2.js` CLI entry point
2. Use ValidationPipeline orchestrator
3. Load configuration from file
4. Support CLI configuration overrides
5. Maintain backward-compatible output format

## Implementation

### File to Create
`scripts/validate-recipe-v2.js`

### Features
- Commander.js CLI interface
- Configuration loading (default + custom)
- Recipe file loading and parsing
- ValidationContext creation
- Validator registration
- Pipeline execution
- Result formatting (text, JSON, JUnit)

### CLI Options
```bash
validate-recipe <recipe-path> [options]

Options:
  -v, --verbose           Verbose output
  -c, --config <path>     Custom configuration file
  --fail-fast             Stop on first error
  --format <type>         Output format (text|json|junit)
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
