# SCODSLERR-003: Define Error Codes and Categories

## Overview

Create constant definitions for all error codes and categories used by the ScopeDSL error handling system. These constants will be used throughout the system for consistent error classification.

## Objectives

- Define ErrorCategories enumeration
- Define ErrorCodes enumeration with all standard codes
- Create exportable constants modules
- Ensure consistent naming and organization

## Implementation Details

### Locations

- `src/scopeDsl/constants/errorCategories.js`
- `src/scopeDsl/constants/errorCodes.js`

### Error Categories

```javascript
export const ErrorCategories = Object.freeze({
  MISSING_CONTEXT: 'missing_context',
  INVALID_DATA: 'invalid_data',
  RESOLUTION_FAILURE: 'resolution_failure',
  CYCLE_DETECTED: 'cycle_detected',
  DEPTH_EXCEEDED: 'depth_exceeded',
  PARSE_ERROR: 'parse_error',
  CONFIGURATION: 'configuration',
  UNKNOWN: 'unknown',
});
```

### Error Codes Structure

```javascript
export const ErrorCodes = Object.freeze({
  // Context errors (1xxx)
  MISSING_ACTOR: 'SCOPE_1001',
  INVALID_ACTOR_ID: 'SCOPE_1002',
  MISSING_DISPATCHER: 'SCOPE_1003',
  MISSING_REGISTRY: 'SCOPE_1004',

  // Node errors (2xxx)
  INVALID_NODE_TYPE: 'SCOPE_2001',
  MISSING_NODE_PARENT: 'SCOPE_2002',
  INVALID_NODE_STRUCTURE: 'SCOPE_2003',

  // Resolution errors (3xxx)
  RESOLUTION_FAILED: 'SCOPE_3001',
  SCOPE_NOT_FOUND: 'SCOPE_3002',
  FILTER_EVAL_FAILED: 'SCOPE_3003',

  // System errors (4xxx)
  CYCLE_DETECTED: 'SCOPE_4001',
  MAX_DEPTH_EXCEEDED: 'SCOPE_4002',
  MEMORY_LIMIT: 'SCOPE_4003',

  // Generic fallback (9xxx)
  UNKNOWN_ERROR: 'SCOPE_9999',
});
```

### Code Organization

- Group codes by category (1xxx, 2xxx, etc.)
- Use descriptive constant names
- Include JSDoc comments for each code
- Export as frozen objects to prevent modification

## Acceptance Criteria

- [ ] All error categories defined as constants
- [ ] All error codes from spec included
- [ ] Constants are frozen/immutable
- [ ] JSDoc documentation for each constant
- [ ] Logical grouping and organization
- [ ] Export statements for module usage
- [ ] Consistent naming convention (UPPER_SNAKE_CASE)

## Testing Requirements

- Test that constants are immutable
- Test that all expected values exist
- Test that values match specification
- Verify no duplicate codes
- Verify no duplicate category values

## Dependencies

- None (constants definition)

## Estimated Effort

- Implementation: 1 hour
- Testing: 1 hour
- Total: 2 hours

## Risk Assessment

- **Low Risk**: Simple constant definitions
- **Consideration**: May need to add more codes as system evolves

## Related Spec Sections

- Section 2.2: Error Categories
- Section 2.3: Error Codes

## Future Considerations

- Consider generating documentation from these constants
- May need versioning strategy as codes evolve
- Consider i18n for error messages in future
