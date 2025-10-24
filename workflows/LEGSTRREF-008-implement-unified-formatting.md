# LEGSTRREF-008: Implement Unified Formatting Method

## Metadata
- **Ticket ID**: LEGSTRREF-008
- **Phase**: 3 - Duplication Elimination
- **Priority**: Critical
- **Effort**: 1-2 days
- **Status**: Not Started
- **Dependencies**: LEGSTRREF-007
- **Blocks**: LEGSTRREF-009

## Problem Statement

This is the core refactoring ticket that eliminates ~80% code duplication by unifying `#formatTraced` and `#formatStandard` into a single method.

## Implementation

### Step 1: Create Unified `#formatActions` Method

```javascript
/**
 * Unified formatting method for all action formatting.
 * @private
 */
async #formatActions({
  actor,
  actionsWithTargets,
  trace,
  formatterOptions,
  processingStats,
  traceSource,
}) {
  const formattedActions = [];
  const errors = [];
  let fallbackInvocations = 0;

  // Create adapters
  const traceAdapter = this.#createTraceAdapter(trace, processingStats);
  const statsCollector = new StatisticsCollector(processingStats);
  const errorHandler = this.#errorHandler;

  for (const { actionDef, targetContexts } of actionsWithTargets) {
    FormattingUtils.validateVisualProperties(actionDef.visual, actionDef.id);

    const isMultiTargetAction = actionDef.targets && typeof actionDef.targets === 'object';

    // Capture start event
    traceAdapter.captureStart(actionDef, targetContexts, isMultiTargetAction);

    if (isMultiTargetAction) {
      const result = await this.#formatMultiTargetAction({
        actionDef,
        targetContexts,
        formatterOptions,
        actor,
        trace,
        statsCollector,
        errorHandler,
      });
      formattedActions.push(...result.formatted);
      errors.push(...result.errors);
      fallbackInvocations += result.fallbackCount;
    } else {
      const result = await this.#formatSingleTargetAction({
        actionDef,
        targetContexts,
        formatterOptions,
        actor,
        trace,
        statsCollector,
        errorHandler,
      });
      formattedActions.push(...result.formatted);
      errors.push(...result.errors);
    }

    // Capture end event
    traceAdapter.captureEnd(actionDef, result);
  }

  this.#logger.debug(
    `Action formatting complete: ${formattedActions.length} actions formatted successfully`
  );

  trace?.info(
    `Action formatting completed: ${formattedActions.length} formatted actions, ${errors.length} errors`,
    traceSource
  );

  return {
    formattedCommands: formattedActions,
    errors,
    fallbackUsed: fallbackInvocations > 0,
    statistics: {
      formatted: formattedActions.length,
      errors: errors.length,
      fallbackInvocations,
    },
    pipelineResult: PipelineResult.success({
      actions: formattedActions,
      errors,
    }),
  };
}
```

### Step 2: Update Public `format` Method

```javascript
/**
 * Formats actions with targets into formatted commands.
 * @public
 */
async format({ actor, actionsWithTargets = [], trace, processingStats, traceSource }) {
  const formatterOptions = this.#buildFormatterOptions();

  return this.#formatActions({
    actor,
    actionsWithTargets,
    trace,
    formatterOptions,
    processingStats,
    traceSource,
  });
}
```

### Step 3: Comprehensive Testing

- Test with action-aware trace
- Test without trace
- Test with processing stats
- Test without processing stats
- Test mixed single/multi-target actions
- Test error paths
- Verify no behavioral changes

## Acceptance Criteria

- ✅ Unified `#formatActions` method created
- ✅ `#formatTraced` and `#formatStandard` replaced with calls to unified method
- ✅ All existing tests pass
- ✅ No behavioral changes verified
- ✅ Code duplication eliminated (0%)
- ✅ Test coverage >95%

## Validation Steps

```bash
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/
npm run test:integration -- tests/integration/actions/
npm run test:ci
```

## Files Affected

### Modified Files
- `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`

## Risk Assessment

### Risk Level: High

**Mitigation**:
- Comprehensive test suite
- Behavior verification tests
- Integration testing
- Code review
- Rollback plan (git commit per change)

## Related Tickets
- **Depends on**: LEGSTRREF-007
- **Blocks**: LEGSTRREF-009
- **Part of**: Phase 3 - Duplication Elimination
