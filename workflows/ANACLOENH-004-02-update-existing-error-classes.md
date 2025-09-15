# ANACLOENH-004-02: Update Existing Error Classes to Extend BaseError

## Overview
Update all existing error classes in the codebase to extend the new BaseError class, adding severity and recoverability metadata.

## Parent Ticket
- ANACLOENH-004: Establish Error Handling Framework

## Depends On
- ANACLOENH-004-01: Create BaseError Class

## Current State
- 40+ error classes exist in `src/errors/`
- Each implements Error independently
- No consistent metadata or structure

## Objectives
1. Update all existing error classes to extend BaseError
2. Add appropriate severity levels to each error type
3. Define recoverability for each error type
4. Maintain backward compatibility

## Technical Requirements

### Error Categories and Updates

#### Validation Errors (Recoverable, Severity: WARNING)
```javascript
// src/errors/validationError.js
import BaseError from './BaseError.js';

export class ValidationError extends BaseError {
  constructor(message, componentTypeId = null, validationErrors = null) {
    super(message, 'VALIDATION_ERROR', { componentTypeId, validationErrors });
    this.componentTypeId = componentTypeId; // Backward compatibility
    this.validationErrors = validationErrors; // Backward compatibility
  }

  getSeverity() { return 'warning'; }
  isRecoverable() { return true; }
}
```

#### Entity Errors (Non-Recoverable, Severity: ERROR)
```javascript
// src/errors/entityNotFoundError.js
import BaseError from './BaseError.js';

export class EntityNotFoundError extends BaseError {
  constructor(message, entityId = null) {
    super(message, 'NOT_FOUND_ERROR', { entityId });
    this.entityId = entityId; // Backward compatibility
  }

  getSeverity() { return 'error'; }
  isRecoverable() { return false; }
}
```

#### Configuration Errors (Non-Recoverable, Severity: CRITICAL)
```javascript
// src/errors/configurationError.js
import BaseError from './BaseError.js';

export class ConfigurationError extends BaseError {
  constructor(message, configKey = null) {
    super(message, 'CONFIG_ERROR', { configKey });
    this.configKey = configKey; // Backward compatibility
  }

  getSeverity() { return 'critical'; }
  isRecoverable() { return false; }
}
```

### Error Classification Table

| Error Class | Severity | Recoverable | Notes |
|------------|----------|-------------|-------|
| ValidationError | warning | true | Can retry with corrected data |
| EntityNotFoundError | error | false | Entity doesn't exist |
| DuplicateEntityError | warning | true | Can use existing entity |
| ConfigurationError | critical | false | System misconfiguration |
| InitializationError | critical | false | Startup failure |
| FetchError | warning | true | Network retry possible |
| PromptTooLongError | warning | true | Can truncate prompt |
| ModDependencyError | error | false | Missing dependencies |
| InvalidArgumentError | warning | true | Can provide valid args |
| ActorError | error | false | Actor system failure |
| AnatomyDataError | error | true | Can regenerate anatomy |
| ClothingSlotErrors | warning | true | Can adjust clothing |
| CacheError | warning | true | Can bypass cache |
| LLMInteractionErrors | warning | true | Can retry LLM call |

## Implementation Steps

1. **Update Core Error Classes** (Priority 1)
   - validationError.js
   - entityNotFoundError.js
   - invalidArgumentError.js
   - configurationError.js
   - InitializationError.js

2. **Update Domain Error Classes** (Priority 2)
   - clothingSlotErrors.js
   - anatomyDataError.js
   - anatomyStateError.js
   - actorError.js
   - llmInteractionErrors.js

3. **Update Mod System Errors** (Priority 3)
   - modDependencyError.js
   - modValidationError.js
   - modSecurityError.js
   - modCorruptionError.js
   - modAccessError.js

4. **Update Remaining Errors** (Priority 4)
   - All other error classes in src/errors/

## File Changes

### Modified Files
All files in `src/errors/`:
- validationError.js
- entityNotFoundError.js
- duplicateEntityError.js
- configurationError.js
- InitializationError.js
- fetchError.js
- promptTooLongError.js
- promptError.js
- modsLoaderError.js
- modDependencyError.js
- invalidArgumentError.js
- actorError.js
- clothingSlotErrors.js
- anatomyDataError.js
- anatomyStateError.js
- llmInteractionErrors.js
- cacheError.js
- And 25+ more...

## Dependencies
- **Prerequisites**: ANACLOENH-004-01 (BaseError class must exist)
- **Blocks**: Central error handler implementation

## Acceptance Criteria
1. ✅ All error classes extend BaseError
2. ✅ Each error has appropriate severity level
3. ✅ Each error has correct recoverability setting
4. ✅ Backward compatibility maintained (existing properties preserved)
5. ✅ All existing tests still pass
6. ✅ No breaking changes to error handling code

## Testing Requirements

### Unit Tests
Update existing tests for each error class:
- Verify error instanceof BaseError
- Verify severity level is correct
- Verify recoverability is correct
- Verify backward compatibility properties exist
- Verify serialization works

### Integration Tests
- Test that existing error handling code still works
- Verify error context is preserved
- Test error chains work correctly

## Estimated Effort
- **Development**: 4 hours (40+ files to update)
- **Testing**: 2 hours
- **Total**: 6 hours

## Risk Assessment
- **Medium Risk**: Many files to update, potential for missing some
- **Mitigation**: Use grep to find all Error extensions
- **Mitigation**: Run full test suite after updates

## Implementation Script
```bash
# Find all error files to update
grep -r "extends Error" src/errors/ --include="*.js"

# Verify all updated
grep -r "extends BaseError" src/errors/ --include="*.js" | wc -l
# Should match previous count
```

## Success Metrics
- All error classes extend BaseError
- No test failures
- Error handling code continues to work
- Consistent error metadata across system

## Notes
- Maintain backward compatibility by preserving existing properties
- Use consistent severity levels across similar error types
- Document the reasoning for each error's recoverability setting
- Consider creating an error catalog documentation