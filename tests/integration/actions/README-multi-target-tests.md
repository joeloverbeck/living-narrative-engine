# Multi-Target Integration Test Scenarios

## Test Coverage Overview

### Core Functionality Tests

- `multiTargetEventPayloadFlow.integration.test.js` - Event payload structure validation
- `MultiTargetResolutionStage.integration.test.js` - Target resolution pipeline
- `multiTargetResolution.integration.test.js` - Resolution logic validation
- `multiTargetContextFrom.integration.test.js` - Context building validation

### Enhanced Coverage (This Ticket)

- `multiTargetComplexScenarios.test.js` - Edge cases and complex scenarios
- `multiTargetErrorPropagation.test.js` - Error handling across components
- `multiTargetPerformance.test.js` - Performance regression tests
- `multiTargetBackwardCompat.test.js` - Compatibility validation

## Key Test Scenarios

### 1. Complex Multi-Target Actions

- **Actions with 4+ targets**: Testing complex rituals, crafting recipes with many components
- **Circular dependencies**: Detection and handling of circular references
- **Context-dependent chains**: Nested containers, social interaction chains
- **Duplicate entity handling**: Same entity in multiple roles
- **Rapid target updates**: Stress testing with 100+ rapid additions/removals
- **Primary target consistency**: Behavior when primary target is removed

### 2. Error Scenarios

- **Formatter failures with fallback**: Multi-target formatter exceptions, fallback to legacy
- **Missing entity handling**: Graceful handling when entities don't exist
- **Invalid configuration recovery**: Recovery from invalid target configurations
- **Network/async failures**: Handling of async formatting errors
- **Null/undefined responses**: Handling of unexpected formatter responses
- **Error event dispatching**: Proper error propagation through event system

### 3. Performance Boundaries

- **Large target sets (50+ targets)**: Setup time <50ms, validation <10ms
- **Very large sets (100+ targets)**: Batch operations <100ms
- **Rapid target updates**: 500 concurrent-like updates <100ms
- **Memory leak prevention**: <10MB growth over 1000 iterations
- **O(1) lookup validation**: Consistent <0.1ms average lookup time
- **Linear scaling**: Performance scales linearly with target count

### 4. Backward Compatibility

- **Legacy action format support**: Pre-multi-target action definitions
- **Single-target compatibility**: getPrimaryTarget() and legacy access patterns
- **Migration path validation**: Gradual upgrade from single to multi-target
- **Event payload consistency**: Backward-compatible event structures
- **API surface preservation**: All legacy methods remain functional
- **Serialization compatibility**: JSON format backward compatibility

## Running Tests

```bash
# Run all multi-target integration tests
npm run test:integration -- multiTarget

# Run specific test suite
npm run test:integration -- multiTargetPerformance

# Run with performance profiling
npm run test:integration -- --detectLeaks multiTargetPerformance

# Run specific test file
npm run test:integration tests/integration/actions/multiTargetComplexScenarios.test.js

# Run with coverage
npm run test:integration:coverage -- multiTarget

# Run in watch mode for development
npm run test:integration -- --watch multiTarget
```

## Performance Benchmarks

### Target Management Operations

- **Single operation**: <1ms per operation
- **Batch operations**: <50ms for 100 operations
- **Large target validation**: <10ms for 50+ targets
- **Memory overhead**: <10MB for 1000 iterations
- **Lookup performance**: O(1) with <0.1ms average
- **Clone operations**: <10ms for 50 targets

### Critical Path Performance

- **Single target lookup**: <0.5ms
- **Primary target determination**: <0.5ms
- **Target count check**: <0.1ms
- **Multi-target check**: <0.1ms

## Adding New Test Scenarios

When adding new integration tests:

1. **Placement**: Place in `/tests/integration/actions/` directory
2. **Naming**: Follow convention: `multiTarget*.test.js`
3. **Structure**: Use existing test utilities and patterns
4. **Documentation**: Document complex scenarios in test comments
5. **Update README**: Add new test coverage to this README

### Test Template

```javascript
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TargetManager } from '../../../src/entities/multiTarget/targetManager.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Multi-Target [Feature Name]', () => {
  let logger;
  let targetManager;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    logger.debug = jest.fn();
    // Setup
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('[Scenario Category]', () => {
    it('should [expected behavior]', async () => {
      // Test implementation
    });
  });
});
```

## CI/CD Integration

These tests are automatically run as part of the CI pipeline:

1. **Pre-commit**: Linting and format checks
2. **Pull Request**: Full test suite execution
3. **Main Branch**: Test coverage reporting
4. **Performance**: Regression detection alerts

## Troubleshooting

### Common Issues

1. **Flaky Tests**:
   - Use `jest.retryTimes(3)` for network-dependent tests
   - Increase timeouts for performance tests
   - Ensure proper cleanup in afterEach

2. **Memory Issues**:
   - Run with `--expose-gc` flag for memory tests
   - Use `--maxWorkers=1` for memory-sensitive tests

3. **Performance Variations**:
   - Run performance tests in isolation
   - Use `--runInBand` for consistent timing
   - Consider system load when benchmarking

## Future Enhancements

- Visual test report generation with performance graphs
- Automated performance trend tracking over commits
- Integration with performance monitoring dashboards
- Automated compatibility checking against legacy systems
- Stress testing with production-like data volumes
