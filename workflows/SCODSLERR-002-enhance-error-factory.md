# SCODSLERR-002: Enhance ErrorFactory with Templates

## Overview

Enhance the existing error factory to support templated error messages, standardized error codes, and metadata attachment for consistent error creation across all resolvers.

## Objectives

- Enhance `ScopeDslErrorFactory` with template system
- Implement message interpolation for dynamic values
- Add support for error codes and metadata
- Maintain backward compatibility with existing error creation

## Implementation Details

### Location

`src/scopeDsl/core/errorFactory.js`

### Key Features

1. **Template System**
   - Pre-defined message templates for common errors
   - Template keys for easy reference
   - Support for parameter interpolation

2. **Error Code Support**
   - Attach standardized error codes to errors
   - Codes follow SCOPE_XXXX format
   - Categorized by error type (1xxx, 2xxx, 3xxx, 4xxx)

3. **Metadata Attachment**
   - Support arbitrary metadata on errors
   - Include resolver name, category, context info
   - Preserve for debugging and analysis

4. **Message Interpolation**
   - Replace {placeholder} with actual values
   - Handle missing parameters gracefully
   - Support nested object property access

### Template Examples

```javascript
{
  missingActor: {
    code: 'SCOPE_1001',
    message: '{resolver}: actorEntity is missing from context'
  },
  cycleDetected: {
    code: 'SCOPE_4001',
    message: 'Circular reference detected: {path}'
  },
  depthExceeded: {
    code: 'SCOPE_4002',
    message: 'Maximum depth {maxDepth} exceeded at depth {currentDepth}'
  }
}
```

### Interface

```javascript
class ScopeDslErrorFactory {
  create(code, message, metadata = {})
  fromTemplate(templateKey, params = {})
}
```

## Acceptance Criteria

- [ ] Factory creates errors with codes and metadata
- [ ] Template system with all predefined templates
- [ ] Message interpolation works correctly
- [ ] Backward compatible with existing usage
- [ ] All templates have associated error codes
- [ ] Handles missing template keys gracefully
- [ ] Handles missing interpolation params gracefully
- [ ] Returns ScopeDslError instances

## Testing Requirements

- Test error creation with codes and metadata
- Test all predefined templates
- Test interpolation with various parameters
- Test missing template handling
- Test missing parameter handling
- Test backward compatibility
- Verify error instance types

## Dependencies

- SCODSLERR-001: Requires error handler to consume factory

## Estimated Effort

- Implementation: 3 hours
- Testing: 2 hours
- Total: 5 hours

## Risk Assessment

- **Medium Risk**: Must maintain backward compatibility
- **Mitigation**: Keep existing create method, add new methods alongside

## Related Spec Sections

- Section 3.2: Enhanced Error Factory
- Section 2.3: Error Codes
- Template definitions in spec
