# RECVALREF-016: Beta Release and User Feedback

**Phase:** Migration Strategy
**Priority:** P1 - High
**Estimated Effort:** 1 week (includes monitoring period)
**Dependencies:** RECVALREF-015

## Context

Before making the refactored system the default, release as opt-in beta to:
- Gather real-world usage feedback
- Identify edge cases not covered by tests
- Validate performance characteristics
- Build confidence in new system

## Objectives

1. Release `validate-recipe-v2.js` as opt-in beta
2. Add `--use-v2` flag to existing CLI
3. Monitor adoption and issues
4. Gather user feedback
5. Address critical issues before deprecation

## Implementation

### CLI Flag Addition

Update `scripts/validate-recipe.js`:
```javascript
program
  .option('--use-v2', 'Use refactored validation system (beta)')
  .action(async (recipePath, options) => {
    if (options.useV2) {
      await runV2Validation(recipePath, options);
    } else {
      await runLegacyValidation(recipePath, options);
    }
  });
```

### Documentation

Create `docs/validation/v2-beta-guide.md`:
- How to enable v2
- What's new/different
- Known limitations
- How to report issues

### Monitoring Metrics

Track:
- Adoption rate (v1 vs v2 usage)
- Error reports
- Performance metrics
- User feedback

## Acceptance Criteria
- [ ] --use-v2 flag implemented
- [ ] Beta documentation created
- [ ] Monitoring system in place
- [ ] Feedback collection mechanism ready
- [ ] Critical issues addressed during beta period

## Beta Period

**Duration:** 1-2 weeks minimum
**Success Criteria:**
- No critical bugs reported
- Positive user feedback
- Performance acceptable
- Ready for default promotion

## References
- **Migration Strategy:** Step 3 (Beta Release)
