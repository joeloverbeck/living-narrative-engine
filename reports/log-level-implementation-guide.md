# Log Level Implementation Guide

**Date**: 2025-01-21
**Related Report**: `log-level-optimization-analysis.md`

## Critical Discovery: DEBUG-Marked Logs Appearing at INFO Level

The analysis revealed a critical issue: many log entries are marked with `[DEBUG]` but are still appearing when the log level is set to INFO. This suggests a configuration or implementation problem in the logging system.

## Immediate Investigation Required

### Primary Issue: Logger Configuration Problem

**Evidence**:

```
consoleLogger.js:151 [DEBUG] EntityInstanceData.allComponentTypeIds for park bench: {...}
entity.js:153 [DEBUG] Entity.componentTypeIds for park bench: {...}
consoleLogger.js:151 [DEBUG] UnifiedScopeResolver: Resolving available_furniture scope {...}
```

**Problem**: These entries are marked `[DEBUG]` but visible in INFO-level logs.

### Source Files Requiring Investigation

#### 1. consoleLogger.js:151 (CRITICAL - 419 entries)

**Location**: `src/*/consoleLogger.js` around line 151
**Issue**: Primary logging implementation
**Investigation needed**:

- Verify log level checking logic
- Ensure `[DEBUG]` tagged messages respect log level settings
- Check if there's a format vs level mismatch

#### 2. entity.js:153 (HIGH PRIORITY - 55 entries)

**Location**: `src/*/entity.js` around line 153
**Issue**: Entity system debug logs visible at INFO
**Investigation needed**:

- Check entity logging implementation
- Verify logger instance configuration
- Ensure debug logs use proper log level

## Specific Code Changes Required

### Phase 1: Fix Core Logging Infrastructure

#### consoleLogger.js Investigation Points

1. **Line 151 area**: Check log method implementations
2. **Log level enforcement**: Ensure DEBUG messages are filtered
3. **Message formatting**: Verify `[DEBUG]` tag handling

#### entity.js Investigation Points

1. **Line 153 area**: Check entity debug logging calls
2. **Logger usage**: Verify correct log method usage (debug vs info)
3. **Component query logging**: Review repetitive logging patterns

### Phase 2: Service-Level Changes

#### clothingAccessibilityService.js

**Lines to modify**: 515, 518, 529, 543, 547, 555
**Current pattern**:

```javascript
// Likely current implementation (INFO level)
logger.info('ClothingAccessibilityService: Equipment state', data);
```

**Recommended change**:

```javascript
// Should be (DEBUG level)
logger.debug('ClothingAccessibilityService: Equipment state', data);
```

#### Scope Resolution Services

**Files to investigate**:

- TargetResolutionService implementation
- UnifiedScopeResolver implementation
- EntityQueryManager implementation

**Pattern to fix**:

```javascript
// Current (showing as INFO despite [DEBUG] tag)
logger.info('[DEBUG] UnifiedScopeResolver: ...', data);

// Should be
logger.debug('UnifiedScopeResolver: ...', data);
```

### Phase 3: Initialization Logging

#### Service Registration Patterns

**Look for patterns like**:

```javascript
logger.info('Registered facade: ' + facadeName);
logger.info('AnatomyQueryCache: Initialized with maxSize=' + maxSize);
```

**Consider changing to**:

```javascript
logger.info('Registered facade: ' + facadeName); // Keep high-level
logger.debug('AnatomyQueryCache: Initialized with maxSize=' + maxSize); // Detailed config
```

## Implementation Strategy

### Step 1: Diagnostic Investigation

1. **Locate consoleLogger.js**: Find the main logging implementation
2. **Check log level configuration**: Verify "INFO (1)" setting is working correctly
3. **Test DEBUG filtering**: Ensure DEBUG-level logs are properly filtered

### Step 2: Quick Wins

1. **Fix entity.js**: Convert debug logs to use proper debug level
2. **Fix service details**: Move detailed service logs to debug level
3. **Preserve essentials**: Keep high-level operational logs at INFO

### Step 3: Validation

1. **Test with same scenario**: Run identical gameplay session
2. **Verify log reduction**: Confirm ~70% reduction in INFO logs
3. **Check DEBUG access**: Ensure debug logs available when log level changed

## Search Commands for Implementation

### Finding Relevant Files

```bash
# Find logger implementations
find src -name "*.js" -exec grep -l "consoleLogger\|Logger" {} \;

# Find specific line numbers
grep -rn "INFO (1)" src/
grep -rn "\[DEBUG\]" src/

# Find clothing service logging
grep -rn "ClothingAccessibilityService:" src/

# Find scope resolution logging
grep -rn "UnifiedScopeResolver\|TargetResolutionService" src/
```

### Validation Commands

```bash
# Count DEBUG-marked entries in logs
grep -c "\[DEBUG\]" logs/127.0.0.1-1757518601476.log

# Check logger configuration
grep -rn "Log level set to INFO" src/
```

## Expected File Modifications

### High Priority Files

1. **consoleLogger.js** - Fix core logging level enforcement
2. **entity.js** - Convert entity debug logs to proper level
3. **Logger configuration** - Ensure DEBUG filtering works

### Medium Priority Files

1. **clothingAccessibilityService.js** - Move detailed steps to DEBUG
2. **Scope resolution services** - Ensure internal operations are DEBUG
3. **Service initialization** - Review facade registration logging

### Test Files

- Verify test logging doesn't interfere with production logging
- Ensure test scenarios can still access DEBUG logs when needed

## Success Criteria

1. **[DEBUG] tagged logs disappear** from INFO-level output
2. **Essential operations remain visible** at INFO level
3. **LLM prompt logging preserved** at INFO level (as requested)
4. **Debug information accessible** when log level changed to DEBUG
5. **Performance improvement** from reduced log processing

---

**Next Action**: Investigate `consoleLogger.js:151` to understand why DEBUG-tagged logs appear at INFO level.
