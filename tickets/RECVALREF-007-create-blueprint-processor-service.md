# RECVALREF-007: Create Blueprint Processor Service

**Phase:** 2 - Shared Services & Utilities
**Priority:** P1 - High
**Estimated Effort:** 3 hours
**Dependencies:** None

## Context

Blueprint processing logic is duplicated:
- Production code has V1/V2 blueprint handling
- `RecipePreflightValidator.js` has inline `#ensureBlueprintProcessed` method (lines 400-445)
- Uses magic field `_generatedSockets` to track processing state

## Objectives

1. Create centralized `BlueprintProcessorService`
2. Handle V1 (direct slots) and V2 (structure templates) formats
3. Eliminate magic field dependency
4. Provide clear processing state API

## Implementation

### File to Create
`src/anatomy/services/blueprintProcessorService.js`

### Key Methods
- `processBlueprint(rawBlueprint)` - Process V1 or V2 blueprint
- `isProcessed(blueprint)` - Check if already processed
- `#processV1Blueprint(blueprint)` - Handle V1 format
- `#processV2Blueprint(blueprint)` - Handle V2 with structure templates

### Migration
- Remove `#ensureBlueprintProcessed` from RecipePreflightValidator
- Use service in validators

## Testing
- Unit tests: `tests/unit/anatomy/services/blueprintProcessorService.test.js`
- Test V1 and V2 formats
- Test already-processed blueprints
- Test structure template resolution

## Acceptance Criteria
- [ ] Service created with proper DI
- [ ] Handles V1 and V2 formats correctly
- [ ] No magic field dependencies
- [ ] Inline method replaced with service usage
- [ ] Unit tests achieve 90%+ coverage

## References
- **Analysis:** Section "Inline Blueprint Processing"
- **Recommendations:** Phase 2.3
