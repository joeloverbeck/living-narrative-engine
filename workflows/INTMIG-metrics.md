# INTMIG Success Metrics

## Overview

This document defines the success criteria and measurement methods for the INTMIG intimacy actions migration from `scope` to `targets` format.

## Quantitative Metrics

### Migration Completion

| Metric                            | Target | Current | Status         |
| --------------------------------- | ------ | ------- | -------------- |
| Actions migrated                  | 24/24  | 0/24    | ⏳ Not Started |
| Files with both scope and targets | 0      | 0       | ✅ Valid       |
| Schema validation pass rate       | 100%   | N/A     | ⏳ Pending     |
| Invalid action files              | 0      | 0       | ✅ Valid       |

### Test Coverage

| Test Suite        | Target     | Baseline | Current | Status     |
| ----------------- | ---------- | -------- | ------- | ---------- |
| Unit tests        | 100% pass  | TBD      | TBD     | ⏳ Pending |
| Integration tests | 100% pass  | TBD      | TBD     | ⏳ Pending |
| E2E tests         | 100% pass  | TBD      | TBD     | ⏳ Pending |
| Code coverage     | ≥ baseline | TBD      | TBD     | ⏳ Pending |

### Performance

| Metric                | Target           | Baseline | Current | Status     |
| --------------------- | ---------------- | -------- | ------- | ---------- |
| Action discovery time | ≤ baseline       | TBD      | TBD     | ⏳ Pending |
| Action execution time | ≤ baseline       | TBD      | TBD     | ⏳ Pending |
| Memory usage          | ≤ baseline + 5%  | TBD      | TBD     | ⏳ Pending |
| Bundle size           | ≤ baseline + 1KB | TBD      | TBD     | ⏳ Pending |

### Quality

| Metric                       | Target | Current | Status      |
| ---------------------------- | ------ | ------- | ----------- |
| ESLint errors introduced     | 0      | 0       | ✅ Valid    |
| TypeScript errors introduced | 0      | 0       | ✅ Valid    |
| Prettier formatting issues   | 0      | 0       | ✅ Valid    |
| Action traces validation     | 100%   | N/A     | ⏳ Optional |

## Qualitative Metrics

### Code Quality

- ✅ **Consistent Format**: All migrated files use the same `targets` structure
- ✅ **Clear Git History**: Atomic commits with descriptive messages
- ✅ **Comprehensive Documentation**: All changes documented in tracking files
- ✅ **Backwards Compatibility**: No breaking changes for existing game saves

### Risk Management

- ✅ **Rollback Tested**: Rollback script verified and functional
- ✅ **Backup System**: All original files backed up with timestamps
- ✅ **Progressive Migration**: Changes made in small, testable batches
- ✅ **Clear Communication**: Team notified at key milestones

### Process Quality

- ✅ **Automated Validation**: Scripts to verify migration status
- ✅ **Test Baselines**: Pre-migration test results captured
- ✅ **Trace Analysis**: Optional action tracing for debugging
- ✅ **Recovery Procedures**: Clear rollback and recovery paths

## Measurement Commands

### Pre-Migration Checks

```bash
# Create backup before any changes
./scripts/backup-intimacy-actions.sh

# Capture test baseline
./scripts/capture-test-baseline.sh

# Check current migration status
node scripts/validate-intmig-migration.js
```

### During Migration

```bash
# Validate migration progress
node scripts/validate-intmig-migration.js

# Run focused tests
npm run test:unit -- --testPathPattern=intimacy

# Check for linting issues
npm run lint

# Validate action traces (if enabled)
node scripts/validate-action-traces.js
```

### Post-Migration Validation

```bash
# Full validation
node scripts/validate-intmig-migration.js

# Complete test suite
npm run test:ci

# Performance comparison
# (Manual comparison with baseline logs)

# Final checks
npm run lint
npm run typecheck
```

## Success Criteria Checklist

### Phase 1: Preparation (INTMIG-001) ✅

- [x] Backup system created and tested
- [x] Validation scripts created
- [x] Test baselines captured
- [x] Rollback procedures tested
- [x] Documentation prepared

### Phase 2: Migration (INTMIG-002 to INTMIG-005)

- [ ] Batch 1: 11 kissing actions migrated
- [ ] Batch 2: 6 touch actions migrated
- [ ] Batch 3: 5 neck/face actions migrated
- [ ] Batch 4: 2 remaining actions migrated
- [ ] All files pass schema validation

### Phase 3: Validation (INTMIG-006 to INTMIG-008)

- [ ] Schema validation complete
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Performance metrics maintained
- [ ] No regressions detected

### Phase 4: Cleanup (INTMIG-009)

- [ ] Documentation updated
- [ ] Old code references removed
- [ ] Migration tracking archived
- [ ] Success metrics documented

## Risk Thresholds

| Risk Level  | Criteria                                    | Action Required       |
| ----------- | ------------------------------------------- | --------------------- |
| 🟢 Low      | All tests pass, <5% performance impact      | Continue migration    |
| 🟡 Medium   | 1-2 test failures, 5-10% performance impact | Investigate and fix   |
| 🔴 High     | >2 test failures, >10% performance impact   | Rollback and reassess |
| ⛔ Critical | Schema validation fails, data corruption    | Immediate rollback    |

## Reporting

### Daily Status

- Run validation script: `node scripts/validate-intmig-migration.js`
- Update tracking document: `workflows/INTMIG-tracking.md`
- Note any issues or blockers

### Batch Completion

- Full test suite: `npm run test:ci`
- Update metrics in this document
- Commit with descriptive message
- Team notification if needed

### Final Report

- Complete metrics comparison
- Lessons learned documentation
- Archive migration artifacts
- Close INTMIG tickets

## Notes

- Baseline values will be populated after running `./scripts/capture-test-baseline.sh`
- Performance metrics may vary by ±5% due to system conditions
- Action tracing is optional but recommended for debugging
- All commands assume execution from project root directory
