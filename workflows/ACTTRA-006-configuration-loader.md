# ACTTRA-006: Integrate ActionTraceConfigLoader with Dependency Injection

## Overview

The ActionTraceConfigLoader class has already been implemented with advanced functionality including performance optimization, enhanced wildcard patterns, TTL-based caching, and comprehensive validation. This workflow focuses on integrating the existing implementation with the dependency injection system to make it available for use throughout the application.

## Priority

**MEDIUM** - Foundation for action tracing system

## Dependencies

- **Blocked by**: ACTTRA-002 (extend existing trace configuration) ✅
- **Enables**: ACTTRA-007 (configuration validation), integration with other action tracing components
- **Related**: ACTTRA-003 (ActionTraceFilter class)

## Current Implementation Status

The ActionTraceConfigLoader is **already implemented** in `src/configuration/actionTraceConfigLoader.js` with 605 lines of advanced functionality:

- ✅ Performance optimization with Set-based lookups and pre-compiled regex patterns
- ✅ Enhanced wildcard pattern support (general wildcards beyond just mod-specific)
- ✅ TTL-based caching (60-second default, configurable)
- ✅ Comprehensive performance statistics and monitoring
- ✅ Advanced pattern validation and testing utilities
- ✅ Extensive test suite (1069 lines with comprehensive coverage)

**Missing Integration**: The class exists but is not registered in the dependency injection system, making it unavailable for use by other components.

## Acceptance Criteria

- [x] ActionTraceConfigLoader class implemented ✅ (already exists)
- [x] Loads action tracing configuration from trace-config.json ✅ (already implemented)
- [x] Validates configuration against schema during load ✅ (already implemented)  
- [x] Handles missing or malformed configuration gracefully ✅ (already implemented)
- [x] Exposes clean API for accessing action tracing config ✅ (already implemented)
- [x] Includes comprehensive error handling and logging ✅ (already implemented)
- [x] 80%+ test coverage with unit tests ✅ (extensive test suite exists)
- [x] Documentation and JSDoc comments ✅ (already implemented)
- [ ] **Create dependency injection tokens for action tracing services**
- [ ] **Register ActionTraceConfigLoader in DI container**
- [ ] **Integration testing to verify DI setup works correctly**

## Current Configuration Structure

The trace configuration file already exists and contains the actionTracing section:

**File**: `config/trace-config.json` ✅ (already contains actionTracing section)

```json
{
  "traceAnalysisEnabled": false,
  "performanceMonitoring": {
    // ... existing config ...
  },
  "actionTracing": {
    "enabled": false,
    "tracedActions": [],
    "outputDirectory": "./traces/actions",
    "verbosity": "standard",
    "includeComponentData": true,
    "includePrerequisites": true,
    "includeTargets": true,
    "maxTraceFiles": 100,
    "rotationPolicy": "age",
    "maxFileAge": 86400,
    "cacheTtl": 60  // Actual implementation uses 60-second cache, not 5 minutes
  }
}
```

## Current Implementation API

The actual ActionTraceConfigLoader provides these methods (different from original workflow assumptions):

```javascript
// Core configuration methods
async loadConfig()
async reloadConfig()
async isEnabled()
async getConfigValue(key)
async getVerbosityLevel()

// Advanced querying methods
async getInclusionConfig()
async getOutputDirectory()
async getRotationConfig()
async shouldTraceAction(actionId)
async filterDataByVerbosity(data)

// Performance and monitoring methods
getPerformanceStats()
getCacheInfo()
validatePatterns(patterns)
testPattern(pattern, actionId)
```

**Dependencies**: 
- `traceConfigLoader` (TraceConfigLoader class)
- `validator` (ISchemaValidator interface)

**Note**: The implementation does not use a generic `IConfigLoader` interface as originally assumed, but uses the specific TraceConfigLoader class.

## Implementation Steps

### Step 1: Verify Current Implementation ✅

The ActionTraceConfigLoader is already implemented with advanced features:

```bash
# View the existing implementation
ls -la src/configuration/actionTraceConfigLoader.js  # 605 lines of code
ls -la tests/unit/configuration/actionTraceConfigLoader.test.js  # 1069 lines of tests
```

**Current Status**: 
- ✅ Implementation complete with advanced performance optimization
- ✅ Comprehensive test coverage
- ❌ **Missing**: DI integration (tokens and container registration)

### Step 2: Create Dependency Injection Tokens 

**Status**: ❌ **Missing** - Need to create DI tokens

The ActionTraceConfigLoader class already exists with advanced functionality. The remaining work is DI integration.

### Step 3: Create Dependency Injection Tokens

**File**: `src/dependencyInjection/tokens/actionTracingTokens.js`

```javascript
/**
 * @file Dependency injection tokens for action tracing system
 */

export const actionTracingTokens = {
  IActionTraceConfigLoader: Symbol('IActionTraceConfigLoader'),
  IActionTraceFilter: Symbol('IActionTraceFilter'),
  IActionTraceOutputService: Symbol('IActionTraceOutputService'),
};

// Export individual tokens for convenience
export const {
  IActionTraceConfigLoader,
  IActionTraceFilter,
  IActionTraceOutputService,
} = actionTracingTokens;

export default actionTracingTokens;
```

### Step 4: Register Configuration Loader

**File**: `src/dependencyInjection/containers/actionTracingContainer.js`

**Note**: The existing ActionTraceConfigLoader uses `traceConfigLoader` and `validator` dependencies, not generic `IConfigLoader`. The container registration needs to match the actual implementation.

```javascript
/**
 * @file Dependency injection container setup for action tracing
 */

import { ServiceSetup } from '../../utils/serviceInitializerUtils.js';
import { actionTracingTokens } from '../tokens/actionTracingTokens.js';
import { tokens } from '../tokens.js';
import ActionTraceConfigLoader from '../../configuration/actionTraceConfigLoader.js';

/**
 * Register action tracing services with the DI container
 * @param {Container} container - DI container instance
 */
export function registerActionTracing(container) {
  const setup = new ServiceSetup();

  // Register ActionTraceConfigLoader
  container.register(
    actionTracingTokens.IActionTraceConfigLoader,
    (deps) => {
      const logger = setup.setupService(
        'ActionTraceConfigLoader',
        deps.logger,
        {
          traceConfigLoader: {
            value: deps.traceConfigLoader,
            requiredMethods: ['load', 'get'], // Based on actual TraceConfigLoader interface
          },
        }
      );

      return new ActionTraceConfigLoader({
        traceConfigLoader: deps.traceConfigLoader, // Correct dependency name
        validator: deps.validator, // ISchemaValidator
        logger,
      });
    },
    {
      lifetime: 'singleton',
      dependencies: {
        traceConfigLoader: tokens.ITraceConfigLoader, // Correct token
        validator: tokens.ISchemaValidator,
        logger: tokens.ILogger,
      },
    }
  );
}
```

### Step 5: Update Main Tokens Export

**File**: `src/dependencyInjection/tokens.js` (add to existing exports)

```javascript
// ... existing token exports ...

// Action tracing tokens
import { actionTracingTokens } from './tokens/actionTracingTokens.js';

export const tokens = {
  // ... existing tokens ...
  
  // Action tracing
  ...actionTracingTokens,
};
```

### Step 6: Integration with Main Container

**File**: `src/dependencyInjection/container.js` (add to existing setup)

```javascript
// ... existing imports ...
import { registerActionTracing } from './containers/actionTracingContainer.js';

// ... existing container setup ...

// Register action tracing services
registerActionTracing(container);

// ... rest of setup ...
```

## Testing Strategy

### Step 7: Integration Testing

**Status**: ✅ **Unit tests already exist** - Need integration tests for DI

The ActionTraceConfigLoader already has a comprehensive 1069-line test suite. The remaining testing work is to verify the DI integration works correctly.

**New Test Required**: `tests/integration/configuration/actionTraceConfigLoaderDI.test.js`

Focus areas for integration testing:
- DI container can resolve ActionTraceConfigLoader with correct dependencies
- Service initialization works with actual TraceConfigLoader and ISchemaValidator
- Integration with existing configuration infrastructure

## Performance Considerations

**Already Implemented ✅**:
- **TTL Caching**: Configuration cached for 60 seconds (configurable, not 5 minutes as originally assumed)
- **Performance Optimization**: Set-based lookups and pre-compiled regex patterns
- **Enhanced Wildcards**: General wildcard support beyond mod-specific patterns
- **Statistics Monitoring**: Comprehensive performance tracking and monitoring
- **Memory Management**: Cache invalidation and resource cleanup on destroy
- **Pattern Testing**: Advanced pattern validation and testing utilities

**DI Performance**: Singleton registration ensures single instance and optimal memory usage.

## Error Handling Strategy

**Already Implemented ✅**:
1. **Configuration Loading Errors**: Fall back to safe defaults, log warnings
2. **Validation Errors**: Advanced pattern validation with detailed error reporting
3. **Performance Degradation**: Comprehensive error handling and graceful degradation
4. **Dependency Errors**: Fail fast during construction with clear messages

**DI Error Handling**: Container will fail fast with clear error messages if dependencies are missing or invalid.

## Integration Points

**Current Implementation ✅**:
- **TraceConfigLoader**: Uses specific TraceConfigLoader class (not generic IConfigLoader)
- **ISchemaValidator**: Integrates with schema validation system  
- **ILogger**: Integrates with project logging system

**Missing Integration ❌**:
- **DI Container**: Needs to be registered in dependency injection system
- **ServiceSetup**: Needs service initialization for DI registration

## Files Status

**Already Exist ✅**:
- [x] `src/configuration/actionTraceConfigLoader.js` ✅ (605 lines, advanced implementation)
- [x] `tests/unit/configuration/actionTraceConfigLoader.test.js` ✅ (1069 lines, comprehensive tests)
- [x] `config/trace-config.json` ✅ (already contains actionTracing section)

**Need to Create ❌**:
- [ ] `src/dependencyInjection/tokens/actionTracingTokens.js`
- [ ] `src/dependencyInjection/containers/actionTracingContainer.js`
- [ ] `tests/integration/configuration/actionTraceConfigLoaderDI.test.js`

**Need to Modify ❌**:
- [ ] `src/dependencyInjection/tokens.js` (add action tracing tokens)
- [ ] `src/dependencyInjection/container.js` (register action tracing services)

## Definition of Done

**Already Complete ✅**:
- [x] ActionTraceConfigLoader class implemented with all methods ✅
- [x] Configuration validation implemented ✅ (advanced pattern validation)
- [x] Error handling covers all failure scenarios ✅
- [x] Unit tests achieve 80%+ coverage ✅ (comprehensive 1069-line test suite)
- [x] JSDoc documentation complete ✅
- [x] Integration with existing configuration system ✅ (TraceConfigLoader + ISchemaValidator)
- [x] Follows project coding standards ✅
- [x] No performance regressions ✅ (includes performance optimizations)

**Remaining Work ❌**:
- [ ] **Dependency injection properly configured** (tokens + container registration)
- [ ] **Integration tests pass** (verify DI setup works)
- [ ] **All tests pass** (including new DI integration tests)
- [ ] **Code review completed** (for DI integration changes)
- [ ] **Code committed with descriptive message** (for DI integration changes)

## Next Steps

After completion of this ticket:

1. **ACTTRA-007**: Add schema validation for configuration (may need updates for DI integration)
2. **ACTTRA-003**: Implement ActionTraceFilter using this config loader via DI
3. Integration testing with other action tracing components

---

**Updated Estimates**:
- **Original Estimate**: 2 hours (full implementation)
- **Revised Estimate**: 30 minutes (DI integration only)
- **Complexity**: Very Low (integration work only)
- **Priority**: Medium  
- **Phase**: 1 - Configuration and Filtering

**Risk Assessment**: Low risk - implementation is complete and tested, only DI wiring remains.