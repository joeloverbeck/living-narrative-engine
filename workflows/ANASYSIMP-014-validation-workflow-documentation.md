# ANASYSIMP-014: Validation Workflow Documentation

**Phase:** 2 (Tooling & Documentation)
**Priority:** P1
**Effort:** Low (1 day)
**Impact:** Medium - Improves understanding
**Status:** Not Started

## Context

No clear documentation exists explaining the anatomy system validation pipeline and best practices.

## Solution Overview

Create comprehensive validation workflow documentation at `docs/anatomy/validation-workflow.md` covering:

1. **Validation Stages**
   - Stage 1: Load-Time (Schema)
   - Stage 2: Pre-flight (Cross-Reference)
   - Stage 3: Generation-Time (Runtime)
   - Stage 4: Description-Time (Filtering)

2. **Validation Best Practices**
   - Always run schema validation first
   - Use pre-flight validator before testing
   - Check validation report for all issues
   - Test incrementally

3. **Validation Checklist**
   - Component references exist
   - Property values valid
   - Entity definitions complete
   - Sockets match slots
   - Patterns have matches

4. **Troubleshooting Guide**
   - Read full error messages
   - Check referenced files
   - Use validation tools
   - Consult error catalog

## File Structure

```
docs/anatomy/
└── validation-workflow.md        # Main workflow doc
```

## Acceptance Criteria

- [ ] Documents all validation stages
- [ ] Explains when each stage runs
- [ ] Provides best practices
- [ ] Includes validation checklist
- [ ] Links to validation tools
- [ ] Shows troubleshooting workflow

## Dependencies

**Depends On:** ANASYSIMP-003 (Pre-flight Validator for stage descriptions)

## References

- **Report Section:** Recommendation 3.3
- **Report Pages:** Lines 1050-1148
