# LEGSTRREF-004: Extract Single-Target Formatting

## Metadata
- **Ticket ID**: LEGSTRREF-004
- **Phase**: 2 - Method Extraction
- **Priority**: High
- **Effort**: 1 day
- **Status**: Not Started
- **Dependencies**: LEGSTRREF-001, LEGSTRREF-002, LEGSTRREF-003
- **Blocks**: LEGSTRREF-007, LEGSTRREF-008

## Problem Statement

The single-target formatting logic (lines 275-332 in `#formatTraced` and lines 516-570 in `#formatStandard`) is duplicated and embedded in large methods. Extracting it will:
- Reduce cyclomatic complexity
- Enable better testing
- Prepare for duplication elimination in Phase 3

### Current State
- Logic duplicated in two methods
- Try-catch error handling embedded
- Mixed concerns (formatting + statistics + error handling)
- 50+ lines per implementation

## Implementation Steps

### Step 1: Extract `#formatSingleTargetAction` Method

Add to `LegacyStrategy.js`:

```javascript
/**
 * Formats a single-target action with error handling.
 * @private
 */
async #formatSingleTargetAction({
  actionDef,
  targetContexts,
  formatterOptions,
  actor,
  trace,
  statsCollector,
  errorHandler,
}) {
  const formatted = [];
  const errors = [];
  let successCount = 0;
  let failureCount = 0;
  const startTime = Date.now();

  for (const targetContext of targetContexts) {
    const result = this.#formatSingleTarget({
      actionDef,
      targetContext,
      formatterOptions,
      actor,
      trace,
      errorHandler,
    });

    if (result.success) {
      formatted.push(result.formatted);
      successCount++;
    } else {
      errors.push(result.error);
      failureCount++;
    }
  }

  if (successCount > 0 && statsCollector) {
    statsCollector.increment('successful');
    statsCollector.increment('legacy');
  }
  if (failureCount > 0 && statsCollector) {
    statsCollector.increment('failed');
  }

  return {
    formatted,
    errors,
    successCount,
    failureCount,
    startTime,
  };
}

/**
 * Formats a single target with error handling.
 * @private
 */
#formatSingleTarget({
  actionDef,
  targetContext,
  formatterOptions,
  actor,
  trace,
  errorHandler,
}) {
  try {
    const formatResult = this.#commandFormatter.format(
      actionDef,
      targetContext,
      this.#entityManager,
      formatterOptions,
      { displayNameFn: this.#getEntityDisplayNameFn }
    );

    if (formatResult.ok) {
      return {
        success: true,
        formatted: {
          id: actionDef.id,
          name: actionDef.name,
          command: formatResult.value,
          description: actionDef.description || '',
          params: { targetId: targetContext.entityId },
          visual: actionDef.visual || null,
        },
      };
    }

    return {
      success: false,
      error: errorHandler.handleFormattingError({
        error: formatResult,
        actionDef,
        actorId: actor.id,
        targetContext,
        trace,
      }),
    };
  } catch (error) {
    return {
      success: false,
      error: errorHandler.handleException({
        exception: error,
        actionDef,
        actorId: actor.id,
        targetContext,
        trace,
        operation: 'single-target formatting',
      }),
    };
  }
}
```

### Step 2: Integrate into Existing Methods

Update `#formatTraced` and `#formatStandard` to use the new methods:

```javascript
// Replace inline single-target logic with:
const singleTargetResult = await this.#formatSingleTargetAction({
  actionDef,
  targetContexts,
  formatterOptions,
  actor,
  trace,
  statsCollector: new StatisticsCollector(processingStats),
  errorHandler: this.#errorHandler,
});

formattedActions.push(...singleTargetResult.formatted);
errors.push(...singleTargetResult.errors);
```

### Step 3: Add Unit Tests

**File**: `tests/unit/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.singleTarget.test.js`

Test scenarios:
- Successful formatting for single target
- Successful formatting for multiple targets
- Format result failure
- Exception during formatting
- Error handler integration
- Statistics collector integration

### Step 4: Update Existing Tests

Ensure all existing tests still pass with the refactored code.

## Acceptance Criteria

- ✅ `#formatSingleTargetAction` method extracted
- ✅ `#formatSingleTarget` method extracted
- ✅ Both `#formatTraced` and `#formatStandard` use new methods
- ✅ All existing tests pass
- ✅ New unit tests added with >90% coverage
- ✅ Cyclomatic complexity reduced
- ✅ No behavioral changes

## Testing Requirements

### Unit Tests
- Test both success and failure paths
- Test error handler integration
- Test statistics collector integration
- Test multiple targets iteration

### Integration Tests
- Verify no behavioral changes
- Test with real formatters
- Test with trace enabled/disabled

## Validation Steps

```bash
# Run unit tests
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/

# Run integration tests
npm run test:integration -- tests/integration/actions/

# Verify no regressions
npm run test:ci
```

## Files Affected

### Modified Files
- `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`

### New Files
- `tests/unit/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.singleTarget.test.js`

## Risk Assessment

### Risk Level: Medium

**Potential Issues**:
- Behavioral changes in edge cases
- Error handling differences

**Mitigation**:
- Comprehensive test suite
- Code review
- Integration testing

## Related Tickets
- **Depends on**: LEGSTRREF-001, LEGSTRREF-002, LEGSTRREF-003
- **Blocks**: LEGSTRREF-007, LEGSTRREF-008
- **Part of**: Phase 2 - Method Extraction
