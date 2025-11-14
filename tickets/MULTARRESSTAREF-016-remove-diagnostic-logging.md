# MULTARRESSTAREF-016: Remove Diagnostic Logging

**Status:** Not Started
**Priority:** Low
**Estimated Effort:** 0.5 days
**Phase:** 5 - Cleanup
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Remove temporary diagnostic logging from `MultiTargetResolutionStage` to clean up the code and remove ~30 lines of temporary debugging code.

## Background

The stage contains ~15 `[DIAGNOSTIC]` marked logging statements (lines 171-175, 437-442, 450-475) that were added for debugging during development. These should be removed or converted to proper trace events.

## Technical Requirements

### File to Modify
- **Path:** `src/actions/pipeline/stages/MultiTargetResolutionStage.js`

### Changes Required

#### 1. Identify Diagnostic Logging

**Search for patterns:**
- `[DIAGNOSTIC]` markers in log messages
- Entry/exit logging blocks (lines 118-122)
- Detailed variable dumps throughout resolution
- Temporary debugging statements

**Example diagnostic logs to remove:**
```javascript
// Lines 118-122: Entry/exit logging
this.#logger.debug('\n=== MULTITARGETRESOLUTIONSTAGE ENTRY ===');
this.#logger.debug('Candidate actions count:', candidateActions.length);
// ... 5 more debug statements

// Lines 171-176: Temporary diagnostic markers
this.#logger.debug(`[DIAGNOSTIC] Action ${actionDef.id} resolution path:`, {
  isLegacy, hasStringTargets, targets, scope,
});
```

#### 2. Decision Criteria

**For each diagnostic log, decide:**

**Remove if:**
- Marked with `[DIAGNOSTIC]`
- Temporary debug information
- Redundant with tracing
- Excessive detail not needed for production

**Keep if:**
- Critical for production debugging
- Not redundant with tracing
- Provides value for troubleshooting
- Entry/exit markers (at INFO level)

**Convert to Trace Event if:**
- Useful for performance analysis
- Needed for debugging complex scenarios
- Should be captured in trace output
- Provides insights for optimization

#### 3. Removal Strategy

**Phase 1: Remove Obvious Diagnostics**
- All logs marked `[DIAGNOSTIC]`
- Excessive detail dumps
- Temporary variable logging

**Phase 2: Clean Up Entry/Exit Logging**
- Keep high-level entry/exit at DEBUG level
- Remove detailed variable dumps
- Simplify to essential information only

**Phase 3: Convert Useful Logs to Trace Events**
- Identify logs useful for performance analysis
- Add corresponding trace events via tracing orchestrator
- Remove original diagnostic logs

### Expected Removal
- **Diagnostic markers:** ~15 statements
- **Excessive detail dumps:** ~10 statements
- **Temporary debugging:** ~5 statements
- **Total:** ~30 lines removed

## Acceptance Criteria

- [ ] All `[DIAGNOSTIC]` marked logs removed or converted
- [ ] Excessive detail logging removed
- [ ] Entry/exit logging simplified to essentials
- [ ] Useful diagnostics converted to trace events
- [ ] No temporary debugging code remains
- [ ] Production debugging capability maintained
- [ ] All tests still pass
- [ ] ~30 lines removed

## Dependencies

- **MULTARRESSTAREF-015** - Stage simplification complete
- **Recommended:** MULTARRESSTAREF-005 - Tracing orchestrator available for trace event conversion

## Testing Strategy

### Validation
```bash
# Run all tests to ensure no functionality broken
npm run test:unit -- MultiTargetResolutionStage
npm run test:integration -- --testPathPattern="actions/pipeline"

# Verify tracing still works
npm run test:integration -- --testPathPattern="tracing"
```

### Manual Testing
- Review DEBUG level logs in test output
- Verify production debugging still viable
- Check trace output for converted events
- Ensure no loss of critical debugging info

## Migration Plan

### Step 1: Audit Diagnostic Logs
- [ ] List all `[DIAGNOSTIC]` logs
- [ ] List all entry/exit blocks
- [ ] List all variable dumps
- [ ] Categorize each: Remove, Keep, Convert

### Step 2: Execute Removal
- [ ] Remove marked diagnostics
- [ ] Simplify entry/exit logging
- [ ] Remove excessive details

### Step 3: Convert to Trace Events
- [ ] Identify useful diagnostics for tracing
- [ ] Add trace event captures
- [ ] Remove original diagnostic logs

### Step 4: Verify
- [ ] Run full test suite
- [ ] Review remaining logs
- [ ] Confirm no loss of debugging capability

## Notes

- This is a low-priority cleanup task
- Should be done after major refactoring complete
- Don't remove logs critical for production debugging
- Consider converting useful diagnostics to trace events
- Maintain ability to troubleshoot issues in production
- Focus on removing *temporary* debugging code, not production logging
