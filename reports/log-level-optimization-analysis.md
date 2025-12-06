# Log Level Optimization Analysis Report

**Date**: 2025-01-21
**Analyzed Log**: `logs/127.0.0.1-1757518601476.log`
**Total Entries**: 619 lines
**Analysis Scope**: INFO-level log messages during gameplay turns

## Executive Summary

This analysis examines the current logging practices in the Living Narrative Engine and provides recommendations for optimizing log levels to improve signal-to-noise ratio. The current logs contain significant amounts of repetitive debug information that should be moved from INFO to DEBUG level, while preserving essential operational visibility.

### Key Findings

- **68%** of log entries (419/619) originate from `consoleLogger.js:151`
- **~70%** of current INFO-level logs should be demoted to DEBUG level
- Many DEBUG-level entries are already correctly categorized
- LLM prompt logging is appropriately maintained at INFO level (as requested)

## Detailed Analysis by Log Category

### 🟢 KEEP as INFO Level (High-Value Operational Logs)

#### 1. System Bootstrap & Initialization

**Impact**: Critical for startup troubleshooting
**Examples**:

```
consoleLogger.js:72 [ConsoleLogger] Initialized. Log level set to INFO (1).
containerStages.js:39 Bootstrap Stage: setupDIContainerStage starting...
containerConfig.js:49 [ContainerConfig] Starting container configuration...
```

**Justification**: Essential for diagnosing startup issues and configuration problems.

#### 2. Content Loading & Mod Registration

**Impact**: Critical for mod loading diagnostics
**Examples**:

```
consoleLogger.js:151 SchemaLoader: Loaded 77 schemas: [schema list]
consoleLogger.js:151 ComponentLoader: Loading components definitions for mod 'core'.
consoleLogger.js:151 ActionLoader: Loading actions definitions for mod 'core'.
```

**Justification**: Essential for diagnosing content loading failures and mod conflicts.

#### 3. LLM Integration (Specifically Requested)

**Impact**: Critical for AI debugging
**Examples**:

```
consoleLogger.js:151 [PromptLog][Model: anthropic/claude-sonnet-4] Final prompt sent to proxy:
```

**Justification**: Explicitly requested by user for LLM debugging purposes.

#### 4. High-Level Game Operations

**Impact**: Important for gameplay flow understanding
**Examples**:

```
consoleLogger.js:151 ActionIndexingService: 14/14 actions have visual properties for p_erotica:diego_tavares_instance
consoleLogger.js:151 [ActionButtonsRenderer] Actions with visual properties: {total: 29, withVisualProps: 29}
consoleLogger.js:151 IndexedDBStorageAdapter: Database opened successfully
```

**Justification**: Provides essential insight into game state changes and user interactions.

### 🔴 DEMOTE to DEBUG Level (Low-Value Repetitive Logs)

#### 1. Entity System Internals (HIGH PRIORITY)

**Impact**: Extremely repetitive, clutters logs
**Volume**: ~200+ repetitive entries
**Examples**:

```
consoleLogger.js:151 [DEBUG] EntityInstanceData.allComponentTypeIds for park bench: {instanceId: 'p_erotica:park_bench_instance', definitionComponents: Array(4), overrides: Array(1), result: Array(5)}
entity.js:153 [DEBUG] Entity.componentTypeIds for park bench: {entityId: 'p_erotica:park_bench_instance', componentTypeIds: Array(5), hasAllowsSitting: true}
```

**Recommendation**: These are already marked as [DEBUG] but appearing at INFO level - verify log level configuration.

#### 2. Scope Resolution Details (HIGH PRIORITY)

**Impact**: Repetitive internal operations
**Volume**: ~50+ entries per action resolution
**Examples**:

```
consoleLogger.js:151 TargetResolutionService: [DEBUG] TargetResolutionService resolving scope for sit_down
consoleLogger.js:151 [DEBUG] UnifiedScopeResolver: Resolving available_furniture scope
consoleLogger.js:151 [DEBUG] EntityQueryManager detailed search for 'positioning:allows_sitting'
```

**Recommendation**: These are correctly marked as [DEBUG] but appearing at INFO level.

#### 3. Component Processing Details (MEDIUM PRIORITY)

**Impact**: Service-level implementation details
**Volume**: ~30+ entries
**Examples**:

```
clothingAccessibilityService.js:515 ClothingAccessibilityService: Equipment state
clothingAccessibilityService.js:518 ClothingAccessibilityService: Parsed items
clothingAccessibilityService.js:529 ClothingAccessibilityService: After layer filter
```

**Recommendation**: Move to DEBUG level - these are internal processing steps.

#### 4. Service Initialization Details (LOW PRIORITY)

**Impact**: Service-level setup information
**Volume**: ~20+ entries
**Examples**:

```
consoleLogger.js:151 Registered facade: ClothingSystemFacade
consoleLogger.js:151 Registered facade: ClothingSystemFacade v1.0.0
consoleLogger.js:151 AnatomyQueryCache: Initialized with maxSize=1000, ttl=300000ms
```

**Recommendation**: Consider DEBUG level for detailed initialization parameters.

## Implementation Recommendations

### Phase 1: Critical Issues (Immediate Action Required)

**Problem**: Many logs marked as `[DEBUG]` are appearing at INFO level.

#### Root Cause Investigation

1. **Verify Logger Configuration**: Check if logger instances are correctly configured
2. **Source Code Review**: Examine `consoleLogger.js:151` and `entity.js:153` implementations
3. **Log Level Propagation**: Ensure DEBUG-marked logs respect log level settings

#### Specific Source Files Requiring Attention

1. **consoleLogger.js:151** (419 entries - 68% of logs)
   - Many entries marked `[DEBUG]` but appearing at INFO
   - Review log level routing logic

2. **entity.js:153** (55 entries - 9% of logs)
   - All entries marked `[DEBUG]` but visible at INFO
   - Check entity logging implementation

### Phase 2: Service-Level Optimizations

#### clothingAccessibilityService.js

**Lines**: 515, 518, 529, 543, 547, 555
**Current**: INFO level
**Recommended**: DEBUG level
**Rationale**: Internal processing steps, not essential for operational visibility

#### Target Resolution Services

**Current**: Mixed INFO/DEBUG
**Recommended**: Ensure all detailed resolution steps are DEBUG only
**Keep INFO**: High-level resolution failures or significant state changes

### Phase 3: Initialization Optimizations

#### Service Registration

**Pattern**: "Registered facade", "initialized", cache configuration
**Current**: INFO level
**Recommended**: Consider DEBUG for detailed parameters, keep INFO for high-level service status

## Expected Impact

### Before Optimization

```
INFO: 619 entries (100%)
- Operational: ~180 entries (30%)
- Debug-worthy: ~430 entries (70%)
- Signal-to-noise ratio: Low
```

### After Optimization

```
INFO: ~185 entries (30%)
- Operational: ~180 entries
- Essential debug: ~5 entries
- Signal-to-noise ratio: High

DEBUG: ~430 entries (70%)
- Available when debugging needed
- Not cluttering operational logs
```

## Next Steps

1. **Immediate**: Investigate why `[DEBUG]` marked logs appear at INFO level
2. **Short-term**: Implement Phase 1 fixes for entity system logging
3. **Medium-term**: Optimize service-level logging (Phase 2)
4. **Long-term**: Establish logging standards and guidelines (Phase 3)

## Validation Approach

### Before/After Comparison

1. Capture logs from identical gameplay session
2. Measure log volume reduction
3. Verify essential information preservation
4. Confirm DEBUG logs still accessible when needed

### Success Metrics

- **Volume Reduction**: 70% reduction in INFO-level log entries
- **Signal Clarity**: Essential operational events clearly visible
- **Debug Accessibility**: Detailed information available via DEBUG level
- **Performance**: Potential improvement in log processing overhead

---

**Note**: This analysis preserves LLM prompt logging at INFO level as specifically requested, while optimizing other logging categories for better operational visibility.
