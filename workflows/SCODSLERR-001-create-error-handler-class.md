# SCODSLERR-001: Create ScopeDslErrorHandler Class

## Overview

Create the centralized error handling service for the ScopeDSL system that provides environment-aware error processing, context sanitization, and error buffering capabilities.

## Objectives

- Implement the core `ScopeDslErrorHandler` class with all required methods
- Provide environment-aware error handling (development vs production)
- Implement error buffering for analysis
- Ensure proper context sanitization to prevent circular references
- Integrate with existing ILogger infrastructure

## Implementation Details

### Location

`src/scopeDsl/core/scopeDslErrorHandler.js`

### Key Features

1. **Environment Detection**
   - Detect NODE_ENV for development/production behavior
   - Allow configuration override via constructor config

2. **Error Buffering**
   - Maintain circular buffer of recent errors
   - Configurable buffer size (default: 100)
   - Include timestamps and categorization

3. **Context Sanitization**
   - Prevent circular reference errors
   - Extract safe subset of context for logging
   - Preserve essential debugging information

4. **Error Categorization**
   - Automatic categorization based on error codes
   - Pattern matching for uncoded errors
   - Categories: MISSING_CONTEXT, INVALID_DATA, RESOLUTION_FAILURE, etc.

### Interface

```javascript
class ScopeDslErrorHandler {
  constructor({ logger, errorFactory, config = {} })
  handleError(error, context, resolverName, errorCode = null)
  getErrorBuffer()
  clearErrorBuffer()
}
```

### Dependencies

- ILogger for logging
- IScopeDslErrorFactory for error creation
- Process environment for NODE_ENV detection

## Acceptance Criteria

- [ ] Class implements all methods from spec
- [ ] Proper dependency validation in constructor
- [ ] Environment-aware logging behavior
- [ ] Error buffering with size limit enforcement
- [ ] Context sanitization prevents circular references
- [ ] Automatic error categorization works correctly
- [ ] Formatted error messages are consistent
- [ ] Always throws ScopeDslError instances
- [ ] Private methods properly encapsulated with #

## Testing Requirements

- Unit tests for all public methods
- Test environment detection logic
- Test buffer size limit enforcement
- Test circular reference prevention
- Test error categorization logic
- Test development vs production behavior differences
- Mock logger and error factory dependencies

## Dependencies

- None (first ticket in sequence)

## Estimated Effort

- Implementation: 4 hours
- Testing: 2 hours
- Total: 6 hours

## Risk Assessment

- **Low Risk**: Well-defined requirements, clear interface
- **Mitigation**: Follow existing patterns in codebase for service implementation

## Related Spec Sections

- Section 3.1: ScopeDslErrorHandler Class
- Section 2.2: Error Categories
- Section 2.3: Error Codes
