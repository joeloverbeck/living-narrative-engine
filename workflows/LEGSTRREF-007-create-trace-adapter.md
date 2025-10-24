# LEGSTRREF-007: Create Trace Adapter

## Metadata
- **Ticket ID**: LEGSTRREF-007
- **Phase**: 3 - Duplication Elimination
- **Priority**: Critical
- **Effort**: 0.5-1 day
- **Status**: Not Started
- **Dependencies**: LEGSTRREF-004, LEGSTRREF-005, LEGSTRREF-006
- **Blocks**: LEGSTRREF-008

## Problem Statement

The key difference between `#formatTraced` and `#formatStandard` is trace-related operations. A trace adapter pattern allows polymorphic behavior, enabling unified logic.

## Implementation

### Step 1: Create Trace Adapter Interface

```javascript
/**
 * Creates a trace adapter for polymorphic behavior.
 * @private
 */
#createTraceAdapter(trace, processingStats) {
  const isActionAware = trace && typeof trace.captureActionData === 'function';

  if (isActionAware) {
    return {
      captureStart: (actionDef, targetContexts, isMultiTarget) => {
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: 'formatting',
          formattingPath: 'legacy',
          isMultiTargetInLegacy: isMultiTarget,
          targetContextCount: targetContexts.length,
        });
      },
      captureEnd: (actionDef, result) => {
        trace.captureActionData('formatting', actionDef.id, {
          timestamp: Date.now(),
          status: result.errors.length > 0 ? 'partial' : 'completed',
          formatterMethod: 'format',
          successCount: result.formatted.length,
          failureCount: result.errors.length,
          performance: { duration: Date.now() - result.startTime },
        });
      },
      incrementStat: (statsCollector, key) => {
        if (statsCollector) {
          statsCollector.increment(key);
        }
      },
    };
  }

  // No-op adapter for standard trace
  return {
    captureStart: () => {},
    captureEnd: () => {},
    incrementStat: (statsCollector, key) => {
      if (statsCollector) {
        statsCollector.increment(key);
      }
    },
  };
}
```

### Step 2: Add Unit Tests

Test both action-aware and standard adapters:
- Start event capture
- End event capture
- Statistics increment
- No-op behavior for standard adapter

## Acceptance Criteria

- ✅ Trace adapter created with both implementations
- ✅ Action-aware adapter captures events
- ✅ Standard adapter is no-op
- ✅ Test coverage >95%
- ✅ Documentation complete

## Validation Steps

```bash
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.traceAdapter.test.js
```

## Files Affected

### Modified Files
- `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`

### New Files
- `tests/unit/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.traceAdapter.test.js`

## Related Tickets
- **Depends on**: LEGSTRREF-004, LEGSTRREF-005, LEGSTRREF-006
- **Blocks**: LEGSTRREF-008
- **Part of**: Phase 3 - Duplication Elimination
