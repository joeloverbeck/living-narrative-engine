# RECVALREF-006: Create Entity Matcher Service

**Phase:** 2 - Shared Services & Utilities
**Priority:** P1 - High
**Estimated Effort:** 3 hours
**Dependencies:** RECVALREF-005

## Context

Entity matching logic is duplicated in 2 locations in `RecipePreflightValidator.js`:
- `#findMatchingEntities` (lines 661-692)
- `#findMatchingEntitiesForSlot` (lines 873-916)

95% of the logic is identical, with only the `allowedTypes` check differing.

## Objectives

1. Create centralized `EntityMatcherService` class
2. Unify entity matching criteria (partType, allowedTypes, tags, properties)
3. Replace both duplicated implementations
4. Improve testability through dependency injection

## Implementation

### File to Create
`src/anatomy/services/entityMatcherService.js`

### Key Methods
- `findMatchingEntities(criteria)` - Match entities by criteria object
- `#matchesEntity(entityDef, criteria)` - Internal matching logic

### Migration
- Update `RecipePreflightValidator` to use service
- Remove `#findMatchingEntities` method
- Remove `#findMatchingEntitiesForSlot` method

## Testing
- Unit tests: `tests/unit/anatomy/services/entityMatcherService.test.js`
- Coverage target: 90%+
- Test all criteria combinations (partType, allowedTypes, tags, properties)

## Acceptance Criteria
- [ ] Service created with DI pattern
- [ ] Both duplicate methods replaced
- [ ] All existing tests pass
- [ ] Unit tests achieve 90%+ coverage

## References
- **Analysis:** Section "Duplicated Entity Matching Logic"
- **Recommendations:** Phase 2.2
