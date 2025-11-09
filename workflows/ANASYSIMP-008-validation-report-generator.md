# ANASYSIMP-008: Validation Report Generator

**Phase:** 2 (Tooling & Documentation)
**Priority:** P1
**Effort:** Low (1-2 days)
**Impact:** Medium - Batch error discovery
**Status:** Not Started

## Context

Multiple validation errors require multiple reload cycles to discover all issues. A comprehensive validation report generator enables batch discovery of all issues in a single validation pass.

## Problem Statement

Current workflow:
1. Fix one error
2. Reload
3. Discover next error
4. Repeat

This serial discovery process wastes time and creates frustration.

## Solution Overview

Generate comprehensive validation reports that aggregate all errors, warnings, and suggestions with statistics and fixable issue identification.

## Implementation

Already partially implemented in ANASYSIMP-003 (ValidationReport class). This ticket extends that with:

1. **Enhanced Report Formatting**
   - Console output with colors and symbols
   - JSON export for tooling
   - HTML report generation (optional)
   - Markdown report for documentation

2. **Fixable Issue Detection**
   - Identify auto-fixable issues
   - Suggest batch fix operations
   - Generate fix scripts when possible

3. **Related Files Discovery**
   - Link to all files mentioned in errors
   - Show file paths for manual inspection
   - Suggest file creation commands

## File Structure

```
src/anatomy/validation/
├── ValidationReport.js              # Core report (from ANASYSIMP-003)
├── ReportFormatter.js               # Format for different outputs
├── FixableIssueDetector.js          # Auto-fix detection
└── RelatedFileFinder.js             # File discovery

tools/
└── formatValidationReport.js        # CLI report formatter
```

## Acceptance Criteria

- [ ] Report aggregates all validation results
- [ ] Console output uses colors/symbols (✓, ✗, ⚠, 💡)
- [ ] JSON export available
- [ ] Report identifies fixable issues
- [ ] Report lists all related files
- [ ] Statistics summary included

## Dependencies

**Depends On:** ANASYSIMP-003 (ValidationReport class foundation)
**Integrates With:** ANASYSIMP-009 (CLI Tool uses this)

## References

- **Report Section:** Recommendation 2.3
- **Report Pages:** Lines 763-791
