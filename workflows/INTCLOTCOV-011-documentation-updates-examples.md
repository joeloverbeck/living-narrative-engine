# INTCLOTCOV-011: Documentation Updates and Examples

**Phase**: 4 - Documentation & Polish  
**Priority**: Medium  
**Effort**: 1 day  
**Dependencies**: All core implementation complete (INTCLOTCOV-001 through INTCLOTCOV-010)

## Summary

Update project documentation to include comprehensive information about the Intelligent Clothing Coverage System, including usage examples, configuration guidelines, and developer documentation for mod creators and system maintainers.

## Problem Statement

The new coverage mapping system introduces significant new functionality that needs to be properly documented for developers, mod creators, and maintainers. Clear documentation ensures proper usage and facilitates future development and troubleshooting.

## Technical Requirements

### 1. Component Documentation Updates

**File to Update**: `docs/components/clothing-coverage-mapping.md`

````markdown
# Clothing Coverage Mapping Component

## Overview

The `clothing:coverage_mapping` component defines which body regions clothing items cover when equipped, enabling intelligent clothing resolution for action text generation.

## Component Schema

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_lower"],
    "coveragePriority": "base"
  }
}
```
````

## Properties

### covers

- **Type**: Array of strings
- **Required**: Yes
- **Description**: Body regions this item covers when worn
- **Valid Values**: `torso_upper`, `torso_lower`, `legs`, `feet`, `head_gear`, `hands`, `left_arm_clothing`, `right_arm_clothing`

### coveragePriority

- **Type**: String
- **Required**: Yes
- **Description**: Priority level for coverage resolution
- **Valid Values**:
  - `outer`: Outer layer coverage (coats, jackets)
  - `base`: Base layer coverage (pants, shirts)
  - `underwear`: Underwear layer coverage (bras, panties)

## Usage Examples

### Basic Pants Coverage

```json
{
  "id": "clothing:denim_jeans",
  "components": {
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": { "primary": "legs" }
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "base"
    }
  }
}
```

### Multi-Region Coverage (Winter Coat)

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_upper", "torso_lower", "legs"],
    "coveragePriority": "outer"
  }
}
```

### Underwear Coverage (Thigh-High Socks)

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_lower"],
    "coveragePriority": "underwear"
  }
}
```

## Priority System

Coverage resolution uses a two-tier priority system:

1. **Coverage Priority** (Primary): `outer` < `base` < `underwear` < `direct`
2. **Layer Priority** (Secondary): `outer` < `base` < `underwear` < `accessories`

### Resolution Examples

| Scenario        | Items                                         | Result  | Reasoning              |
| --------------- | --------------------------------------------- | ------- | ---------------------- |
| Jeans + Panties | Jeans (base coverage) + Panties (direct)      | Jeans   | Base coverage > Direct |
| Coat + Jeans    | Coat (outer coverage) + Jeans (base coverage) | Coat    | Outer > Base           |
| Only Panties    | Panties (direct)                              | Panties | Direct fallback        |

## Best Practices

1. **Logical Coverage**: Only cover regions that make real-world sense
2. **Appropriate Priority**: Match priority to item's typical usage layer
3. **Consistent Patterns**: Follow established patterns for similar items
4. **Performance**: Avoid unnecessary coverage mappings for items that don't need them

## Troubleshooting

### Common Issues

**Coverage Not Working**:

- Verify component schema is correct
- Check that `covers` array includes target slot
- Ensure `coveragePriority` is valid

**Wrong Item Selected**:

- Review priority system rules
- Check for conflicting coverage mappings
- Verify layer assignments match expectations

**Performance Issues**:

- Limit coverage mappings to items that need them
- Use appropriate priority levels
- Consider caching implications for frequently accessed items

````

### 2. Scope DSL Documentation Updates

**File to Update**: `docs/scope-dsl/clothing-resolution.md`

```markdown
# Clothing Resolution in Scope DSL

## Enhanced Coverage Resolution

The Scope DSL now supports intelligent clothing coverage resolution that considers items from other slots that cover the target region.

## How It Works

When resolving clothing slots like `torso_lower`, the system:

1. **Collects covering items** from all slots that cover the target region
2. **Collects direct items** from the target slot
3. **Calculates priorities** based on coverage and layer
4. **Applies mode filtering** (e.g., excludes accessories in `no_accessories` mode)
5. **Selects highest priority item** after filtering

## Resolution Examples

### Basic Coverage Resolution
````

Query: actor.clothing.torso_lower
Equipment:

- legs: jeans (covers torso_lower, priority: base)
- torso_lower: panties (direct, priority: underwear)
  Result: jeans (base coverage > direct underwear)

```

### Complex Layering
```

Query: actor.clothing.torso_lower
Equipment:

- torso_upper: winter_coat (covers torso_lower, priority: outer)
- legs: jeans (covers torso_lower, priority: base)
- torso_lower: thermal_underwear (direct, priority: underwear)
  Result: winter_coat (outer > base > underwear)

````

## Modes and Coverage

Coverage resolution respects all existing resolution modes:

- **`topmost`**: All layers considered, highest priority selected
- **`topmost_no_accessories`**: Accessories excluded from coverage resolution
- **Other modes**: Layer filtering applied after coverage resolution

## Tracing Coverage Resolution

Enable tracing to debug coverage resolution:

```javascript
const trace = {};
const result = scopeEngine.resolve('clothing:target_topmost_torso_lower_clothing', context, trace);

console.log(trace.coverageResolution);
// Shows: candidates, priorities, filtering, selection reasoning
````

## Performance Considerations

- Coverage resolution adds ~20-50% overhead vs legacy resolution
- Caching optimizes repeated priority calculations
- Simple cases (no covering items) use optimized legacy path
- Complex scenarios (10+ items) complete in <50ms

````

### 3. Developer Guide Updates

**File to Create**: `docs/developers/clothing-coverage-system.md`

```markdown
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
  'outer': 100,      // Outer layer coverage
  'base': 200,       // Base layer coverage
  'underwear': 300,  // Underwear layer coverage
  'direct': 400      // Direct slot equipment (fallback)
};

const LAYER_PRIORITY_WITHIN_COVERAGE = {
  'outer': 10,       // Within same coverage, outer wins
  'base': 20,
  'underwear': 30,
  'accessories': 40
};
````

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
     "coveragePriority": "base|outer|underwear"
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

````

### 4. Mod Creation Guide Updates

**File to Update**: `docs/modding/clothing-items.md`

Add section on coverage mapping:

```markdown
## Coverage Mapping (Advanced)

For clothing items that should cover additional body regions beyond their primary equipment slot, add the `clothing:coverage_mapping` component.

### When to Use Coverage Mapping

- **Pants/Jeans**: Cover `torso_lower` in addition to `legs` slot
- **Long Coats**: Cover multiple regions (`torso_upper`, `torso_lower`, `legs`)
- **Thigh-High Socks**: Cover `torso_lower` from `legs` slot
- **Jackets**: May cover `torso_lower` depending on length

### Example: Adding Coverage to Jeans

```json
{
  "id": "my_mod:stylish_jeans",
  "components": {
    "core:name": { "text": "Stylish Jeans" },
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": { "primary": "legs" }
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "base"
    }
  }
}
````

### Coverage Priority Guidelines

- **`outer`**: Coats, jackets, outer garments
- **`base`**: Regular clothing like pants, shirts
- **`underwear`**: Undergarments, intimate clothing

### Testing Your Coverage

Test coverage resolution with various equipment combinations:

```javascript
// Test character with your item + underwear
const character = createTestCharacter({
  legs: { base: 'my_mod:stylish_jeans' },
  torso_lower: { underwear: 'core:panties' },
});

// Should resolve to your jeans, not panties
const result = resolveScope(
  'clothing:target_topmost_torso_lower_clothing',
  character
);
```

```

## Implementation Details

### File Structure

**Files to Create**:
- `docs/components/clothing-coverage-mapping.md`
- `docs/developers/clothing-coverage-system.md`

**Files to Update**:
- `docs/scope-dsl/clothing-resolution.md`
- `docs/modding/clothing-items.md`
- `README.md` (mention new coverage system)
- `CHANGELOG.md` (add feature description)

### Documentation Standards

- **Clear Examples**: Provide practical, testable examples
- **Troubleshooting**: Common issues and solutions
- **Performance Notes**: Performance characteristics and considerations
- **Best Practices**: Guidelines for effective usage
- **Migration Info**: How to adopt the new system

## Acceptance Criteria

- [ ] Component documentation is comprehensive and includes examples
- [ ] Scope DSL documentation explains coverage resolution clearly
- [ ] Developer guide covers architecture and implementation details
- [ ] Modding guide shows how to create items with coverage mapping
- [ ] All documentation includes practical, testable examples
- [ ] Troubleshooting sections address common issues
- [ ] Performance characteristics are documented
- [ ] Migration guidance is provided for existing systems
- [ ] Documentation follows project style and standards
- [ ] All links and references are correct and working

## Testing Requirements

### Documentation Testing
- All examples should be tested and work correctly
- Code snippets should be valid and executable
- Links and cross-references should be verified
- Documentation should match actual system behavior

### Review Requirements
- Technical accuracy review by development team
- Clarity review for user experience
- Completeness review against system features
- Consistency review with existing documentation

## Files Created

- `docs/components/clothing-coverage-mapping.md`
- `docs/developers/clothing-coverage-system.md`

## Files Modified

- `docs/scope-dsl/clothing-resolution.md`
- `docs/modding/clothing-items.md`
- `README.md`
- `CHANGELOG.md`

## Notes

### Documentation Philosophy

1. **Example-Driven**: Show practical usage with working examples
2. **Progressive Complexity**: Start simple, build to advanced concepts
3. **Troubleshooting Focus**: Help users solve common problems
4. **Performance Aware**: Include performance considerations
5. **Future-Oriented**: Document extensibility and migration paths

### Maintenance Considerations

- Documentation should be updated when system changes
- Examples should be kept current with codebase
- Performance numbers should be verified periodically
- User feedback should inform documentation improvements

### Integration with Existing Docs

- Follow established documentation patterns
- Maintain consistent terminology
- Link appropriately to related documentation
- Update table of contents and navigation

## Next Steps

After completion, this enables:
- INTCLOTCOV-012: Final validation with complete documentation
- Better developer onboarding and system understanding
- Reduced support burden through clear documentation

## Risk Assessment

**Low Risk** - Documentation creation with no code changes.

**Potential Issues**:
- Documentation becoming outdated as system evolves
- Examples not matching actual system behavior
- Insufficient detail for complex use cases
- Documentation not discoverable by users

**Mitigation**:
- Include documentation updates in system change workflows
- Test all examples as part of validation process
- Gather user feedback to identify documentation gaps
- Ensure proper linking and navigation structure
```
