# RECVALREF-017: Deprecate Legacy Validation System

**Phase:** Migration Strategy
**Priority:** P1 - High
**Estimated Effort:** 1 week
**Dependencies:** RECVALREF-016

## Context

After successful beta period, make refactored system the default while maintaining backward compatibility during deprecation period.

## Objectives

1. Make v2 the default validation system
2. Add deprecation warnings to v1
3. Provide migration guide
4. Set deprecation timeline (1 month)
5. Update documentation

## Implementation

### Default Behavior Change

Update `scripts/validate-recipe.js`:
```javascript
program
  .option('--use-v1', 'Use legacy validation system (deprecated)')
  .action(async (recipePath, options) => {
    if (options.useV1) {
      console.warn('⚠️  WARNING: Legacy validation system is deprecated.');
      console.warn('   It will be removed in 1 month.');
      console.warn('   Please migrate to v2 (default).\n');
      await runLegacyValidation(recipePath, options);
    } else {
      await runV2Validation(recipePath, options);
    }
  });
```

### Migration Guide

Create `docs/validation/migration-guide.md`:
- Why we're migrating
- What's changed
- How to update custom validators
- Configuration file usage
- Troubleshooting common issues

### Deprecation Notice

Add to CHANGELOG.md:
```markdown
## [Version X.X.X] - YYYY-MM-DD

### Deprecated
- Legacy validation system (`RecipePreflightValidator`) is deprecated
- Will be removed in version X.X.X (1 month from now)
- Use new validation pipeline (default) or `--use-v1` flag
- See docs/validation/migration-guide.md for migration instructions
```

## Deprecation Timeline

**Week 1:** Announce deprecation, make v2 default
**Week 2-4:** Deprecation period, support both systems
**Week 4:** Final warning before removal
**Week 5:** Remove legacy code (RECVALREF-018)

## Acceptance Criteria
- [ ] V2 is default validation system
- [ ] V1 accessible via --use-v1 flag
- [ ] Deprecation warnings displayed
- [ ] Migration guide published
- [ ] CHANGELOG updated
- [ ] Documentation updated

## Communication Plan

- Update README.md with migration notice
- Post announcement in project discussions
- Email notification to contributors

## References
- **Migration Strategy:** Step 4 (Deprecation)
