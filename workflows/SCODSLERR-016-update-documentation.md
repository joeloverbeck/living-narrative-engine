# SCODSLERR-016: Update Documentation for Error Handling

## Overview
Update all documentation to reflect the new centralized error handling system, including developer guides, API documentation, and code comments.

## Objectives
- Document new error handling patterns
- Update API documentation
- Create migration guide
- Update inline code documentation
- Document error codes reference

## Implementation Details

### Documentation to Create/Update

#### 1. Error Handling Developer Guide
**Location**: `docs/scopeDsl/error-handling-guide.md`

Content to include:
- Overview of error handling system
- How to use IScopeDslErrorHandler
- Error categories and codes
- Best practices
- Common patterns
- Troubleshooting guide

#### 2. Error Codes Reference
**Location**: `docs/scopeDsl/error-codes-reference.md`

Format:
```markdown
## Error Codes Reference

### Context Errors (1xxx)
| Code | Name | Description | Common Causes |
|------|------|-------------|---------------|
| SCOPE_1001 | MISSING_ACTOR | Actor entity missing from context | ... |
| SCOPE_1002 | INVALID_ACTOR_ID | Actor has invalid ID | ... |

### Node Errors (2xxx)
...
```

#### 3. Migration Guide
**Location**: `docs/migration/scopedsl-error-handling-migration.md`

Content:
- Migration steps for new resolvers
- Pattern examples
- Common pitfalls
- Testing strategies
- Rollback procedures

#### 4. API Documentation Updates

##### IScopeDslErrorHandler Interface
```javascript
/**
 * Centralized error handler for ScopeDSL system
 * @interface IScopeDslErrorHandler
 * @since 2.0.0
 */

/**
 * Handle an error with environment-aware processing
 * @method handleError
 * @param {Error|string} error - The error or message
 * @param {Object} context - Resolution context
 * @param {string} resolverName - Name of the resolver
 * @param {string} [errorCode] - Optional error code from ErrorCodes
 * @throws {ScopeDslError} Always throws formatted error
 * @example
 * errorHandler.handleError(
 *   'Missing required field',
 *   context,
 *   'MyResolver',
 *   ErrorCodes.MISSING_CONTEXT
 * );
 */
```

#### 5. README Updates
**Location**: `src/scopeDsl/README.md`

Add section:
- Error handling overview
- Quick start example
- Link to detailed documentation

### Code Comments Updates

#### Update File Headers
```javascript
/**
 * @file filterResolver.js
 * @description Resolver for filter expressions in ScopeDSL
 * @uses IScopeDslErrorHandler for standardized error handling
 * @see docs/scopeDsl/error-handling-guide.md
 */
```

#### Update Method Comments
```javascript
/**
 * Resolve filter expression
 * @param {Object} node - AST node
 * @param {Object} ctx - Resolution context
 * @returns {Array} Filtered results
 * @throws {ScopeDslError} With standardized error codes
 */
```

## Acceptance Criteria
- [ ] Developer guide created
- [ ] Error codes reference complete
- [ ] Migration guide written
- [ ] API documentation updated
- [ ] README sections added
- [ ] Code comments updated
- [ ] Examples provided
- [ ] Diagrams included where helpful

## Documentation Standards
- Use Markdown format
- Include code examples
- Provide visual diagrams where applicable
- Keep language clear and concise
- Include troubleshooting sections
- Cross-reference related docs

## Dependencies
- SCODSLERR-001 through SCODSLERR-015: Implementation complete
- Error codes and categories defined

## Estimated Effort
- Developer guide: 3 hours
- Error codes reference: 2 hours
- Migration guide: 2 hours
- API docs: 1 hour
- Code comments: 1 hour
- Total: 9 hours

## Risk Assessment
- **Low Risk**: Documentation task
- **Consideration**: Keep synchronized with code

## Related Spec Sections
- Section 7.3: Documentation Standards
- Section 2: Architecture Design
- Section 4: Migration Strategy

## Documentation Template
```markdown
# [Document Title]

## Overview
Brief description of the topic

## Quick Start
Minimal example to get started

## Detailed Guide
### Section 1
Content...

### Section 2
Content...

## API Reference
Detailed API documentation

## Examples
Code examples with explanations

## Troubleshooting
Common issues and solutions

## Related Documents
- Link 1
- Link 2
```

## Review Checklist
- [ ] Technical accuracy verified
- [ ] Code examples tested
- [ ] Links validated
- [ ] Grammar and spelling checked
- [ ] Formatting consistent
- [ ] Diagrams clear and accurate