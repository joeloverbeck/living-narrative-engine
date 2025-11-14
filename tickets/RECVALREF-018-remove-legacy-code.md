# RECVALREF-018: Remove Legacy Validation Code

**Phase:** Migration Strategy
**Priority:** P1 - High
**Estimated Effort:** 2 hours
**Dependencies:** RECVALREF-017 (after 1 month deprecation period)

## Context

After 1-month deprecation period, remove all legacy validation code to:
- Reduce codebase complexity
- Eliminate maintenance burden
- Complete migration to refactored architecture

## Files to Remove

### Primary Deletion
1. **RecipePreflightValidator.js** (1,207 lines) - The God class 🎉
2. Legacy CLI flags and wrapper code
3. Deprecated documentation

### Keep These Files (Updated)
- `ComponentExistenceValidationRule.js` - Migrated to validator
- `PropertySchemaValidationRule.js` - Migrated to validator
- External validators (now integrated into pipeline)

## Implementation

### Step 1: Verify Migration Complete
- [ ] All comparison tests passing
- [ ] No --use-v1 usage in codebase
- [ ] 1 month deprecation period elapsed

### Step 2: Code Removal
```bash
# Remove God class
rm src/anatomy/validation/RecipePreflightValidator.js

# Remove legacy CLI wrapper code
# (Update scripts/validate-recipe.js to only use v2)

# Remove deprecated flags
```

### Step 3: Update References
- [ ] Update imports throughout codebase
- [ ] Remove legacy test fixtures
- [ ] Update documentation

### Step 4: Verification
- [ ] All tests pass after removal
- [ ] No broken imports
- [ ] No references to removed code
- [ ] Build succeeds

## Celebration Metrics

**Before Refactoring:**
- RecipePreflightValidator.js: 1,207 lines
- Boolean flags: 7 (128 configurations)
- Code duplication: 5 instances
- Unit test coverage: 0%

**After Refactoring:**
- Largest validator file: <200 lines
- Configuration: JSON file (infinite flexibility)
- Code duplication: 0 instances
- Unit test coverage: 80%+ 🎉

## Acceptance Criteria
- [ ] RecipePreflightValidator.js deleted
- [ ] Legacy CLI code removed
- [ ] All references updated
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Documentation updated
- [ ] Git history preserved

## Final Cleanup

```bash
# Run full test suite
npm run test:ci

# Verify build
npm run build

# Run linting
npm run lint

# Create cleanup PR
git checkout -b chore/remove-legacy-validation
git add .
git commit -m "feat: Remove legacy validation system

BREAKING CHANGE: Legacy RecipePreflightValidator removed.
Use new validation pipeline (default since vX.X.X).

- Removed RecipePreflightValidator.js (1,207 lines)
- Removed --use-v1 CLI flag
- Updated all documentation

Refs: RECVALREF-018"
```

## References
- **Migration Strategy:** Step 5 (Removal)
- **Analysis:** Full document (showing what we've overcome)
- **Recommendations:** Full document (implementation complete)
