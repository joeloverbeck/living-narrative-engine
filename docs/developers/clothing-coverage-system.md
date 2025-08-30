# Clothing Coverage System Developer Guide

## Architecture Overview

The Intelligent Clothing Coverage System consists of:

1. **Coverage Mapping Component** (`clothing:coverage_mapping`)
2. **Enhanced SlotAccessResolver** (scope DSL integration)
3. **Priority Calculation System** (configurable priority rules)
4. **Tracing System** (debugging and monitoring)

## Implementation Details

### SlotAccessResolver Enhancement

The `SlotAccessResolver` in `src/scopeDsl/nodes/slotAccessResolver.js` now includes:

- `resolveCoverageAwareSlot()`: Core coverage resolution logic
- `calculateCoveragePriority()`: Priority scoring system
- `filterByMode()`: Mode-aware candidate filtering
- Comprehensive tracing for debugging

### Priority System

Priority calculation uses a two-tier system:

```javascript
const COVERAGE_PRIORITY = {
  outer: 100, // Outer layer coverage
  base: 200, // Base layer coverage
  underwear: 300, // Underwear layer coverage
  accessories: 350, // Accessory layer coverage
  direct: 400, // Direct slot equipment (fallback)
};

const LAYER_PRIORITY_WITHIN_COVERAGE = {
  outer: 10, // Within same coverage, outer wins
  base: 20,
  underwear: 30,
  accessories: 40,
};
```

Final priority = Coverage Priority + Layer Priority (lower = higher priority)

### Performance Optimizations

- **Priority Caching**: Pre-calculated scores cached for reuse
- **Strategy Selection**: Legacy path for simple cases
- **Lazy Evaluation**: Skip expensive operations when possible
- **Trace Optimization**: Minimal overhead when tracing disabled

## Configuration

### Feature Flags

```javascript
const COVERAGE_FEATURES = {
  enableCoverageResolution: true, // Enable/disable system
  fallbackToLegacy: true, // Fallback on errors
  enablePerformanceLogging: false, // Performance monitoring
  enableErrorRecovery: true, // Error recovery
};
```

### Performance Configuration

```javascript
const PRIORITY_CONFIG = {
  enableCaching: true, // Priority calculation caching
  maxCacheSize: 1000, // Cache size limit
  enableTieBreaking: true, // Deterministic tie-breaking
  logInvalidPriorities: true, // Warning for invalid data
};
```

## Adding New Clothing Items

1. **Create base clothing item** with `clothing:wearable` component
2. **Add coverage mapping** if item covers additional regions:
   ```json
   "clothing:coverage_mapping": {
     "covers": ["region_name"],
     "coveragePriority": "outer|base|underwear|accessories"
   }
   ```
3. **Test coverage resolution** with realistic equipment combinations
4. **Validate performance impact** if adding many new items

## Testing Guidelines

### Unit Testing

- Test priority calculation edge cases
- Validate mode filtering behavior
- Check error handling and recovery
- Performance tests for complex scenarios

### Integration Testing

- Test with real clothing data
- Validate action text generation
- Check cross-system integration
- Performance testing with realistic loads

## Debugging

### Tracing

Enable comprehensive tracing for debugging:

```javascript
const trace = {};
resolver.resolve(node, context, trace);
console.log(formatCoverageTrace(trace.coverageResolution));
```

Trace output includes:

- Candidate collection details
- Priority calculations
- Mode filtering results
- Final selection reasoning
- Performance metrics

### Common Issues

**Incorrect Resolution**:

- Check coverage mapping data
- Verify priority assignments
- Review mode filtering logic
- Use tracing to understand decision process

**Performance Issues**:

- Monitor cache efficiency
- Check for expensive operations
- Validate optimization paths
- Use performance profiling

## Future Enhancements

The system is designed for extensibility:

- **Contextual Modifiers**: Weather, social context, item condition
- **Partial Coverage**: Percentage-based coverage system
- **Dynamic Priorities**: Runtime priority adjustments
- **Advanced Filtering**: More sophisticated filtering rules

## Migration Guide

### From Legacy System

Existing functionality continues to work unchanged:

- Items without coverage mapping use legacy resolution
- All existing scopes and actions work normally
- No breaking changes to existing APIs

### Adding Coverage to Existing Items

1. Identify items that should have coverage (pants, coats, etc.)
2. Add coverage mapping component with appropriate priority
3. Test with existing action text generation
4. Validate no regressions in existing functionality

## Support

For issues or questions:

- Check tracing output for resolution details
- Review performance metrics for optimization needs
- Consult test suites for usage examples
- Follow established patterns for new implementations
