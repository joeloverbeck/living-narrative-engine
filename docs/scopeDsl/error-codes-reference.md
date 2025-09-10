# ScopeDSL Error Codes Reference

## Overview

This document provides a comprehensive reference for all error codes used in the ScopeDSL system. Error codes follow a hierarchical numbering scheme with category-based prefixes for easy identification and handling.

## Error Code Format

All ScopeDSL error codes follow the pattern: `SCOPE_XXXX`

- **SCOPE\_**: Prefix identifying ScopeDSL system errors
- **XXXX**: Four-digit code with category-based ranges

## Quick Reference Table

| Range | Category            | Description                       |
| ----- | ------------------- | --------------------------------- |
| 1xxx  | Context Errors      | Missing or invalid context data   |
| 2xxx  | Data Validation     | Invalid data format or structure  |
| 3xxx  | Resolution Failures | Failed resolution operations      |
| 4xxx  | System Errors       | System limits and resource issues |
| 5xxx  | Parse Errors        | Syntax and parsing failures       |
| 6xxx  | Configuration       | Configuration and setup issues    |
| 9xxx  | Unknown             | Unclassified or fallback errors   |

## Context Errors (1xxx)

Errors related to missing or invalid context during scope resolution.

| Code           | Name                    | Description                           | Common Causes                                | Resolution                                 |
| -------------- | ----------------------- | ------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| **SCOPE_1000** | MISSING_CONTEXT_GENERIC | Generic missing context error         | Context object is null or undefined          | Ensure context is properly initialized     |
| **SCOPE_1001** | MISSING_ACTOR           | Actor not found in context            | Actor entity not passed to resolver          | Pass valid actor entity in context         |
| **SCOPE_1002** | INVALID_ACTOR_ID        | Invalid actor ID format               | Actor ID is null, undefined, or not a string | Validate actor ID before resolution        |
| **SCOPE_1003** | MISSING_DISPATCHER      | Event dispatcher missing from context | Dispatcher not provided to resolver          | Include dispatcher in resolver context     |
| **SCOPE_1004** | MISSING_REGISTRY        | Entity registry missing from context  | Registry not available for entity lookup     | Ensure registry is initialized             |
| **SCOPE_1005** | MISSING_RUNTIME_CONTEXT | Runtime context missing or incomplete | Required runtime data not available          | Provide complete runtime context           |
| **SCOPE_1006** | MISSING_LOCATION        | Location context missing              | Location entity not in context               | Include location entity when required      |
| **SCOPE_1007** | MISSING_TARGET          | Target entity missing from context    | Target required but not provided             | Pass target entity for target-based scopes |

### Example Context Error

```javascript
// Causes SCOPE_1001
const context = {
  // actorEntity is missing!
  dispatcher: resolveDispatcher,
};

// Fix:
const context = {
  actorEntity: getActor(actorId), // Include actor
  dispatcher: resolveDispatcher,
};
```

## Data Validation Errors (2xxx)

Errors related to invalid data format, structure, or type mismatches.

| Code           | Name                      | Description                            | Common Causes                      | Resolution                                 |
| -------------- | ------------------------- | -------------------------------------- | ---------------------------------- | ------------------------------------------ |
| **SCOPE_2000** | INVALID_DATA_GENERIC      | Generic invalid data error             | Data doesn't match expected format | Validate data against schema               |
| **SCOPE_2001** | INVALID_NODE_TYPE         | Invalid node type in scope expression  | Unknown or unsupported node type   | Use valid node types only                  |
| **SCOPE_2002** | MISSING_NODE_PARENT       | Node missing required parent reference | Filter or step node without parent | Ensure nodes have proper parent references |
| **SCOPE_2003** | INVALID_NODE_STRUCTURE    | Invalid node structure or format       | Malformed AST node                 | Validate node structure                    |
| **SCOPE_2004** | MALFORMED_EXPRESSION      | Malformed scope expression syntax      | Syntax errors in scope DSL         | Check expression syntax                    |
| **SCOPE_2005** | INVALID_COMPONENT_ID      | Invalid component ID format            | Component ID missing namespace     | Use format: `mod:component`                |
| **SCOPE_2006** | INVALID_ENTITY_ID         | Invalid entity ID format               | Entity ID is not a valid string    | Ensure entity IDs are strings              |
| **SCOPE_2007** | INVALID_FILTER_EXPRESSION | Invalid JSON Logic filter expression   | Malformed JSON Logic syntax        | Validate JSON Logic structure              |
| **SCOPE_2008** | DATA_TYPE_MISMATCH        | Data type mismatch in operation        | Comparing incompatible types       | Ensure type compatibility                  |

### Example Data Validation Error

```javascript
// Causes SCOPE_2005
const componentId = 'actor'; // Missing namespace!

// Fix:
const componentId = 'core:actor'; // Proper format

// Causes SCOPE_2007
const filter = { '>': ['not', 'valid'] }; // Invalid JSON Logic

// Fix:
const filter = { '>': [{ var: 'value' }, 5] }; // Valid JSON Logic
```

## Resolution Errors (3xxx)

Errors that occur during the resolution process.

| Code           | Name                        | Description                           | Common Causes                   | Resolution             |
| -------------- | --------------------------- | ------------------------------------- | ------------------------------- | ---------------------- |
| **SCOPE_3000** | RESOLUTION_FAILED_GENERIC   | Generic resolution failure            | Unable to resolve scope         | Check scope definition |
| **SCOPE_3001** | SCOPE_NOT_FOUND             | Scope definition not found            | Referenced scope doesn't exist  | Verify scope ID exists |
| **SCOPE_3002** | FILTER_EVAL_FAILED          | JSON Logic filter evaluation failed   | Error during filter evaluation  | Check filter logic     |
| **SCOPE_3003** | ENTITY_RESOLUTION_FAILED    | Entity resolution failed              | Cannot resolve entity reference | Verify entity exists   |
| **SCOPE_3004** | COMPONENT_RESOLUTION_FAILED | Component resolution failed           | Component not found on entity   | Check component exists |
| **SCOPE_3005** | STEP_RESOLUTION_FAILED      | Step resolution failed in scope chain | Error in navigation step        | Validate step path     |
| **SCOPE_3006** | UNION_RESOLUTION_FAILED     | Union operation resolution failed     | Error combining scope results   | Check union operands   |
| **SCOPE_3007** | ARRAY_ITERATION_FAILED      | Array iteration resolution failed     | Error iterating array elements  | Ensure array is valid  |
| **SCOPE_3008** | SLOT_ACCESS_FAILED          | Slot access resolution failed         | Cannot access clothing slot     | Verify slot exists     |
| **SCOPE_3009** | CLOTHING_STEP_FAILED        | Clothing step resolution failed       | Error in clothing resolution    | Check clothing data    |

### Example Resolution Error

```javascript
// Causes SCOPE_3001
const scopeRef = 'my_mod:undefined_scope'; // Scope not defined

// Fix:
// Define the scope in scopes/my_scope.scope:
// my_mod:defined_scope := actor

// Causes SCOPE_3004
const component = entity.components['missing:component'];

// Fix:
// Ensure component exists or handle gracefully:
const component = entity.components['core:stats'] || defaultStats;
```

## System Errors (4xxx)

Errors related to system limits, resources, and runtime constraints.

| Code           | Name                | Description                            | Common Causes                   | Resolution                        |
| -------------- | ------------------- | -------------------------------------- | ------------------------------- | --------------------------------- |
| **SCOPE_4001** | CYCLE_DETECTED      | Circular dependency detected           | Scope references create a cycle | Remove circular references        |
| **SCOPE_4002** | MAX_DEPTH_EXCEEDED  | Maximum resolution depth exceeded      | Nested resolution too deep      | Reduce nesting or increase limit  |
| **SCOPE_4003** | MEMORY_LIMIT        | Memory limit reached during resolution | Large dataset processing        | Optimize scope or increase memory |
| **SCOPE_4004** | RESOURCE_EXHAUSTION | System resource exhaustion             | Out of system resources         | Free resources or optimize        |
| **SCOPE_4005** | EXECUTION_TIMEOUT   | Thread or execution timeout            | Resolution taking too long      | Optimize scope performance        |
| **SCOPE_4006** | STACK_OVERFLOW      | Stack overflow in recursive operations | Infinite recursion              | Fix recursive logic               |

### Example System Error

```javascript
// Causes SCOPE_4001
// scope1.scope: my_mod:a := my_mod:b
// scope2.scope: my_mod:b := my_mod:a  // Circular!

// Fix: Remove circular dependency
// scope1.scope: my_mod:a := actor
// scope2.scope: my_mod:b := location

// Causes SCOPE_4002
const MAX_DEPTH = 10;
function resolve(node, depth = 0) {
  if (depth > MAX_DEPTH) {
    // Throws SCOPE_4002
  }
  // Fix: Reduce nesting or increase MAX_DEPTH
}
```

## Parse Errors (5xxx)

Errors that occur during parsing of scope expressions.

| Code           | Name                    | Description                            | Common Causes              | Resolution                  |
| -------------- | ----------------------- | -------------------------------------- | -------------------------- | --------------------------- |
| **SCOPE_5000** | PARSE_ERROR_GENERIC     | Generic parse error                    | Unable to parse expression | Check expression syntax     |
| **SCOPE_5001** | SYNTAX_ERROR            | Invalid syntax in scope expression     | Syntax violations          | Fix syntax errors           |
| **SCOPE_5002** | UNEXPECTED_TOKEN        | Unexpected token in expression         | Invalid character or token | Remove invalid tokens       |
| **SCOPE_5003** | UNCLOSED_DELIMITER      | Unclosed brackets or quotes            | Missing closing delimiter  | Balance delimiters          |
| **SCOPE_5004** | INVALID_OPERATOR        | Invalid operator usage                 | Unsupported operator       | Use valid operators         |
| **SCOPE_5005** | MISSING_EXPRESSION_PART | Missing required expression components | Incomplete expression      | Complete the expression     |
| **SCOPE_5006** | INVALID_SCOPE_REFERENCE | Invalid scope reference format         | Malformed scope reference  | Use proper reference format |

### Example Parse Error

```javascript
// Causes SCOPE_5001
const expression = 'actor..stats'; // Double dot syntax error

// Fix:
const expression = 'actor.stats';

// Causes SCOPE_5003
const expression = 'entities(core:actor[{'; // Unclosed brackets

// Fix:
const expression = 'entities(core:actor)[{}]';

// Causes SCOPE_5006
const scopeRef = 'invalid scope ref'; // Spaces not allowed

// Fix:
const scopeRef = 'my_mod:valid_scope_ref';
```

## Configuration Errors (6xxx)

Errors related to system configuration and setup.

| Code           | Name                     | Description                     | Common Causes                | Resolution              |
| -------------- | ------------------------ | ------------------------------- | ---------------------------- | ----------------------- |
| **SCOPE_6000** | CONFIGURATION_GENERIC    | Generic configuration error     | Invalid configuration        | Check configuration     |
| **SCOPE_6001** | INVALID_RESOLVER_CONFIG  | Invalid resolver configuration  | Resolver setup incorrect     | Fix resolver config     |
| **SCOPE_6002** | MISSING_CONFIG           | Missing required configuration  | Required config not provided | Provide configuration   |
| **SCOPE_6003** | CONFIG_VALIDATION_FAILED | Configuration validation failed | Config doesn't match schema  | Validate against schema |
| **SCOPE_6004** | INVALID_PARSER_CONFIG    | Invalid parser configuration    | Parser setup incorrect       | Fix parser config       |
| **SCOPE_6005** | REGISTRY_CONFIG_ERROR    | Registry configuration error    | Registry misconfigured       | Check registry setup    |
| **SCOPE_6006** | ENGINE_CONFIG_INVALID    | Engine configuration invalid    | Engine setup problems        | Validate engine config  |

### Example Configuration Error

```javascript
// Causes SCOPE_6002
const errorHandler = new ScopeDslErrorHandler({
  // logger is missing!
});

// Fix:
const errorHandler = new ScopeDslErrorHandler({
  logger: validLogger,
  config: { maxBufferSize: 100 },
});

// Causes SCOPE_6003
const config = {
  maxDepth: 'ten', // Should be number!
};

// Fix:
const config = {
  maxDepth: 10,
};
```

## Unknown/Fallback Errors (9xxx)

Errors that don't fit into other categories or are unclassified.

| Code           | Name                    | Description                  | Common Causes              | Resolution               |
| -------------- | ----------------------- | ---------------------------- | -------------------------- | ------------------------ |
| **SCOPE_9000** | UNKNOWN_GENERIC         | Generic unknown error        | Unclassified error         | Check logs for details   |
| **SCOPE_9001** | UNHANDLED_EXCEPTION     | Unhandled exception          | Unexpected error condition | Add error handling       |
| **SCOPE_9002** | INTERNAL_ERROR          | Internal system error        | System malfunction         | Report as bug            |
| **SCOPE_9003** | UNEXPECTED_STATE        | Unexpected state encountered | Invalid state transition   | Validate state logic     |
| **SCOPE_9004** | OPERATION_NOT_SUPPORTED | Operation not supported      | Feature not implemented    | Use supported operations |
| **SCOPE_9999** | UNKNOWN_ERROR           | Fallback error code          | Ultimate fallback          | Investigate root cause   |

### Example Unknown Error

```javascript
// Causes SCOPE_9004
const operation = 'unsupported_operation';

// Fix: Use supported operations
const operation = 'resolve' | 'filter' | 'union';

// Causes SCOPE_9999
// This is the ultimate fallback when no other code matches
// Usually indicates a bug or missing error categorization
```

## Error Code Usage Guidelines

### 1. Choose the Most Specific Code

```javascript
// Good: Specific code
ErrorCodes.MISSING_ACTOR; // SCOPE_1001

// Less helpful: Generic code
ErrorCodes.MISSING_CONTEXT_GENERIC; // SCOPE_1000
```

### 2. Use Category-Appropriate Codes

```javascript
// If it's a parsing issue, use 5xxx range
if (syntaxError) {
  throw ErrorCodes.SYNTAX_ERROR; // SCOPE_5001
}

// If it's a missing context issue, use 1xxx range
if (!context.actor) {
  throw ErrorCodes.MISSING_ACTOR; // SCOPE_1001
}
```

### 3. Provide Context with Errors

```javascript
errorHandler.handleError(
  'Detailed error message',
  {
    /* relevant context */
  },
  'ResolverName',
  ErrorCodes.SPECIFIC_CODE
);
```

## Error Recovery Strategies

### For Context Errors (1xxx)

- Validate context before processing
- Provide default values where appropriate
- Fail fast with clear messages

### For Data Validation Errors (2xxx)

- Validate input against schemas
- Sanitize and normalize data
- Provide clear format requirements

### For Resolution Errors (3xxx)

- Implement fallback mechanisms
- Cache successful resolutions
- Log resolution paths for debugging

### For System Errors (4xxx)

- Implement circuit breakers
- Add depth/recursion limits
- Monitor resource usage

### For Parse Errors (5xxx)

- Validate syntax before parsing
- Provide syntax highlighting/checking
- Show error position in expression

### For Configuration Errors (6xxx)

- Validate configuration on startup
- Provide configuration schemas
- Use sensible defaults

## Related Documentation

- [Error Handling Developer Guide](./error-handling-guide.md) - How to implement error handling
- [Migration Guide](../migration/scopedsl-error-handling-migration.md) - Updating existing code
- [ScopeDSL Troubleshooting](./troubleshooting.md) - General troubleshooting guide

## Quick Lookup

Use your browser's search (Ctrl+F / Cmd+F) to quickly find:

- Error codes (e.g., "SCOPE_1001")
- Error names (e.g., "MISSING_ACTOR")
- Categories (e.g., "Context Errors")
- Keywords (e.g., "circular", "parse", "missing")
