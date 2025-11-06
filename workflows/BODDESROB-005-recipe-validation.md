# BODDESROB-005: Migrate AnatomyRecipeLoader to Enhanced Validator

**Status**: TODO
**Priority**: MEDIUM
**Phase**: 3 (Integration)
**Estimated Effort**: 0.5 days
**Dependencies**: BODDESROB-001, BODDESROB-002, BODDESROB-004

---

## WORKFLOW VALIDATION SUMMARY

**Validated**: 2025-11-06
**Validator**: Claude Code Agent

### Key Corrections Made:

1. **Implementation Status**
   - CORRECTED: Validation IS already implemented (added in BODDESROB-004 commit 2f7df1c)
   - CORRECTED: Uses WRONG validator (`src/anatomy/utils/bodyDescriptorValidator.js` with static methods)
   - CORRECTED: Needs MIGRATION to `src/anatomy/validators/bodyDescriptorValidator.js` (instance methods)
   - This is a REPLACEMENT task, not an integration task

2. **AnatomyRecipeLoader Structure**
   - CORRECTED: Extends `SimpleItemLoader`, not standalone class
   - CORRECTED: Constructor takes 6 positional params: `(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger)`
   - CORRECTED: Main method is `_processFetchedItem(modId, filename, resolvedPath, data, registryKey)` NOT `loadRecipe()`
   - CONFIRMED: Validation already called at lines 88-90
   - CONFIRMED: Method `_validateBodyDescriptors()` exists at lines 235-248

3. **Validator Situation**
   - CONFIRMED: TWO validators exist
   - OLD (currently used): `/home/user/living-narrative-engine/src/anatomy/utils/bodyDescriptorValidator.js` (static `validate()`, throws errors)
   - NEW (target): `/home/user/living-narrative-engine/src/anatomy/validators/bodyDescriptorValidator.js` (instance `validateRecipeDescriptors()`, returns `{ valid, errors, warnings }`)
   - Task is to migrate from OLD to NEW

4. **Test Files**
   - CORRECTED: Test file is `tests/unit/loaders/anatomyRecipeLoader.processFetchedItem.test.js` (not generic name)
   - CONFIRMED: Multiple test files exist for anatomyRecipeLoader
   - Need to update existing test mocks

5. **Recipe Structure**
   - CONFIRMED: Recipes DO have `bodyDescriptors` property
   - CONFIRMED: Structure matches workflow assumptions

All code examples updated to reflect MIGRATION approach and actual codebase structure.

---

## Overview

Migrate the anatomy recipe loader from the old static validator (`src/anatomy/utils/bodyDescriptorValidator.js`) to the new enhanced validator (`src/anatomy/validators/bodyDescriptorValidator.js`). This enables structured error/warning reporting, environment-specific behavior, and better integration with the centralized registry.

## Problem Context

Currently, body descriptor validation is implemented in `AnatomyRecipeLoader` (added in BODDESROB-004), but it uses the old validator which:
- Uses static methods that throw errors immediately
- Cannot collect multiple errors and warnings
- Lacks environment-specific behavior (dev vs production)
- Does not provide structured validation results
- Prevents implementing sophisticated error reporting

The new validator from BODDESROB-002 provides:
- Structured results: `{ valid, errors, warnings }`
- Ability to collect multiple issues
- Integration with centralized registry
- Better error messages with suggestions
- Support for warnings (unknown descriptors)

This migration will enable proper error collection, warnings for unknown descriptors, and environment-aware behavior.

## Acceptance Criteria

- [ ] Import changed from old validator (utils/) to new validator (validators/)
- [ ] Validator instance creation added (with logger)
- [ ] `_validateBodyDescriptors()` method replaced to use new validator
- [ ] Invalid descriptor values are detected and reported
- [ ] Unknown descriptors trigger warnings
- [ ] Clear error messages with recipe ID and file path
- [ ] Development mode fails fast on critical errors
- [ ] Production mode logs warnings and continues
- [ ] Validation results logged appropriately
- [ ] Performance impact minimal (< 10ms per recipe)
- [ ] Existing tests updated for new validator interface
- [ ] All tests pass with new validator

## Technical Details

### Migration Point

**IMPORTANT**: AnatomyRecipeLoader extends `SimpleItemLoader` and uses protected fields (not private `#`). The loader already has validation - we're REPLACING the implementation.

**Current Implementation** (lines 235-248):
```javascript
// BEFORE: Uses old static validator that throws
_validateBodyDescriptors(bodyDescriptors, recipeId, filename) {
  try {
    BodyDescriptorValidator.validate(  // ❌ Old validator
      bodyDescriptors,
      `recipe '${recipeId}' from file '${filename}'`
    );
  } catch (error) {
    if (error instanceof BodyDescriptorValidationError) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
}
```

**Target Implementation**:
```javascript
// src/loaders/anatomyRecipeLoader.js (line 7 - change import)

// BEFORE:
// import { BodyDescriptorValidator } from '../anatomy/utils/bodyDescriptorValidator.js';
// import { BodyDescriptorValidationError } from '../anatomy/errors/bodyDescriptorValidationError.js';

// AFTER:
import { BodyDescriptorValidator } from '../anatomy/validators/bodyDescriptorValidator.js';
// BodyDescriptorValidationError import can be removed

// Lines 235-248 - Replace _validateBodyDescriptors method:

/**
 * Validates body descriptors for proper structure and values
 *
 * @param {object} bodyDescriptors - The body descriptors to validate
 * @param {string} recipeId - The recipe ID for error messages
 * @param {string} filename - The filename for error messages
 * @throws {ValidationError} If body descriptors are invalid (dev mode only)
 * @private
 */
_validateBodyDescriptors(bodyDescriptors, recipeId, filename) {
  // Create validator instance with logger
  const validator = new BodyDescriptorValidator({ logger: this._logger });

  // Get structured validation results
  const result = validator.validateRecipeDescriptors(bodyDescriptors);

  // Build context for error messages
  const context = `Recipe: ${recipeId} (${filename})`;

  // Log all errors
  for (const error of result.errors) {
    this._logger.error(`[Recipe Validation] ${context} - ${error}`);
  }

  // Log all warnings (e.g., unknown descriptors)
  for (const warning of result.warnings) {
    this._logger.warn(`[Recipe Validation] ${context} - ${warning}`);
  }

  // In development mode, fail fast on validation errors
  if (process.env.NODE_ENV !== 'production' && !result.valid) {
    throw new ValidationError(
      `Body descriptor validation failed for ${context}:\n${result.errors.join('\n')}`
    );
  }

  // In production mode, log but continue (errors already logged above)
}
```

**Key Changes**:
1. Import from `validators/` instead of `utils/`
2. Create validator instance (not static call)
3. Call `validateRecipeDescriptors()` which returns `{ valid, errors, warnings }`
4. Log ALL errors and warnings (structured iteration)
5. Add environment-specific behavior (dev fails, prod continues)
6. Keep ValidationError throw in dev mode for consistency

### Implementation Steps

1. **Change Validator Import** (Line 7)
   - Replace import from `../anatomy/utils/bodyDescriptorValidator.js`
   - Import from `../anatomy/validators/bodyDescriptorValidator.js`
   - Remove `BodyDescriptorValidationError` import (no longer needed)

2. **Replace _validateBodyDescriptors Method** (Lines 235-248)
   - Remove try/catch block (no longer throws immediately)
   - Create validator instance with logger
   - Call `validateRecipeDescriptors()` to get structured results
   - Iterate and log all errors
   - Iterate and log all warnings

3. **Add Environment Logic**
   - Check `process.env.NODE_ENV !== 'production'`
   - Development: throw ValidationError if `!result.valid`
   - Production: log warnings, continue loading (no throw)

4. **Update Test Mocks** (`tests/unit/loaders/anatomyRecipeLoader.processFetchedItem.test.js`)
   - Change mock path from utils/ to validators/
   - Change from static mock to instance mock
   - Mock `validateRecipeDescriptors()` to return `{ valid, errors, warnings }`
   - Update test expectations for new behavior

5. **Test Environment Behavior**
   - Add/update tests for dev mode (throws on invalid)
   - Add/update tests for prod mode (doesn't throw)
   - Test warning logging for unknown descriptors
   - Test error logging with context

## Files to Modify

- `/home/user/living-narrative-engine/src/loaders/anatomyRecipeLoader.js` (MODIFY)
  - Line 7: Change import from utils/ to validators/
  - Line 8: Remove BodyDescriptorValidationError import
  - Lines 235-248: Replace `_validateBodyDescriptors()` method implementation
  - Add environment-specific behavior (dev vs prod)

- `/home/user/living-narrative-engine/tests/unit/loaders/anatomyRecipeLoader.processFetchedItem.test.js` (MODIFY)
  - Lines 32-36: Update mock from utils/ to validators/
  - Change from static mock to instance mock
  - Update test expectations for new behavior
  - Add tests for environment-specific behavior

## Testing Requirements

### Unit Tests

**File**: `/home/user/living-narrative-engine/tests/unit/loaders/anatomyRecipeLoader.processFetchedItem.test.js` (UPDATE EXISTING)

**Changes Required**:

1. **Update Mock** (lines 32-36):
```javascript
// BEFORE:
jest.mock('../../../src/anatomy/utils/bodyDescriptorValidator.js', () => ({
  BodyDescriptorValidator: { validate: jest.fn() }
}));

// AFTER:
jest.mock('../../../src/anatomy/validators/bodyDescriptorValidator.js', () => ({
  BodyDescriptorValidator: jest.fn().mockImplementation(() => ({
    validateRecipeDescriptors: jest.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: []
    })
  }))
}));
```

2. **Add/Update Test Cases**:
- Recipe with valid descriptors loads successfully (UPDATE - check new mock)
- Recipe with invalid descriptor values triggers errors (UPDATE - new return format)
- Recipe with unknown descriptors triggers warnings (NEW)
- Validation errors include recipe ID and filename (UPDATE)
- Development mode fails on invalid descriptors (NEW)
- Production mode logs warnings but continues (NEW)
- Recipes without bodyDescriptors skip validation (EXISTING - should still work)

### Integration Tests

**File**: `/home/user/living-narrative-engine/tests/integration/loaders/anatomyRecipeLoader.integration.test.js` (UPDATE EXISTING)

Test cases:
1. Load real anatomy recipes with validator
2. Verify warnings for unknown descriptors in test recipes
3. Test complete loading flow with new validator
4. Verify environment behavior (if applicable to integration tests)

### Test Template

**NOTE**: The actual test file uses `_processFetchedItem()` method, not `loadRecipe()`. Update existing tests in the file.

```javascript
// In tests/unit/loaders/anatomyRecipeLoader.processFetchedItem.test.js

// Update the mock at the top of file (around line 32):
jest.mock('../../../src/anatomy/validators/bodyDescriptorValidator.js', () => ({
  BodyDescriptorValidator: jest.fn().mockImplementation(() => ({
    validateRecipeDescriptors: jest.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: []
    })
  }))
}));

import { BodyDescriptorValidator } from '../../../src/anatomy/validators/bodyDescriptorValidator.js';

describe('AnatomyRecipeLoader._processFetchedItem - Body Descriptor Validation', () => {
  let loader;
  let logger;
  let mockValidateRecipeDescriptors;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
    const dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomyRecipeLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    // Get reference to mocked method
    mockValidateRecipeDescriptors = BodyDescriptorValidator.mock.results[0].value.validateRecipeDescriptors;
    jest.clearAllMocks();
  });

  describe('Valid Descriptors', () => {
    it('should process recipe with valid body descriptors', async () => {
      const data = {
        recipeId: 'core:human',
        bodyDescriptors: {
          height: 'tall',
          build: 'athletic',
        },
      };

      mockValidateRecipeDescriptors.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      await loader._processFetchedItem(
        'core',
        'human.recipe.json',
        '/tmp/human.recipe.json',
        data,
        'anatomyRecipes'
      );

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Descriptors', () => {
    it('should log errors and fail in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const data = {
        recipeId: 'core:human',
        bodyDescriptors: { height: 'invalid' },
      };

      mockValidateRecipeDescriptors.mockReturnValue({
        valid: false,
        errors: ['Invalid height descriptor: \'invalid\''],
        warnings: []
      });

      await expect(
        loader._processFetchedItem('core', 'human.recipe.json', '/tmp/human.recipe.json', data, 'anatomyRecipes')
      ).rejects.toThrow('Body descriptor validation failed');

      expect(logger.error).toHaveBeenCalled();
      expect(logger.error.mock.calls[0][0]).toContain('core:human');
      expect(logger.error.mock.calls[0][0]).toContain('human.recipe.json');

      process.env.NODE_ENV = originalEnv;
    });

    it('should log errors but not fail in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const data = {
        recipeId: 'core:human',
        bodyDescriptors: { height: 'invalid' },
      };

      mockValidateRecipeDescriptors.mockReturnValue({
        valid: false,
        errors: ['Invalid height descriptor'],
        warnings: []
      });

      await expect(
        loader._processFetchedItem('core', 'human.recipe.json', '/tmp/human.recipe.json', data, 'anatomyRecipes')
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Unknown Descriptors', () => {
    it('should log warnings for unknown descriptors', async () => {
      const data = {
        recipeId: 'core:human',
        bodyDescriptors: { unknownDescriptor: 'value' },
      };

      mockValidateRecipeDescriptors.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Unknown body descriptor \'unknownDescriptor\'']
      });

      await loader._processFetchedItem('core', 'human.recipe.json', '/tmp/human.recipe.json', data, 'anatomyRecipes');

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn.mock.calls[0][0]).toContain('Unknown body descriptor');
    });
  });
});
```

## Success Criteria

- [ ] Validator import migrated from utils/ to validators/
- [ ] BodyDescriptorValidationError import removed
- [ ] `_validateBodyDescriptors()` method uses new validator instance
- [ ] Method returns structured results `{ valid, errors, warnings }`
- [ ] Invalid descriptors detected and all errors logged
- [ ] Unknown descriptors trigger warnings (logged)
- [ ] Error messages include recipe ID and filename context
- [ ] Development mode fails fast on validation errors
- [ ] Production mode logs warnings but continues
- [ ] Test mocks updated to new validator interface
- [ ] All existing tests still pass
- [ ] New tests added for environment behavior
- [ ] ESLint passes with no errors
- [ ] Performance impact < 10ms per recipe
- [ ] Existing recipe loading still works

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry) ✅ COMPLETED
- Depends on: BODDESROB-002 (Enhanced Validator) ✅ COMPLETED (commit d9fee14)
- Depends on: BODDESROB-004 (Bootstrap Validation) ✅ COMPLETED (commit 2f7df1c)
- Enables: BODDESROB-006 (Migration and Cleanup)
- Related to: Spec Section 4.3 "Phase 3: Integrate Validation"

## Validation Scope

### What Gets Validated
- Body descriptor property names (against registry)
- Body descriptor values (against validValues in registry)
- Data structure integrity

### What Doesn't Get Validated
- Schema validation (handled by JSON schema validator)
- Recipe structure (handled by recipe loader)
- Other recipe properties (out of scope)

## Error Message Guidelines

### Good Error Messages
```
[Recipe Validation] Recipe: anatomy:human_male (data/mods/anatomy/recipes/human_male.json) - Invalid value 'super-tall' for height. Expected one of: gigantic, very-tall, tall, average, short, petite, tiny
```

### Bad Error Messages
```
Invalid descriptor
Validation failed
Error in recipe
```

## Notes

- **This is a MIGRATION task, not new implementation** - validation already exists
- Focus on replacing validator, not adding validation logic
- Keep validation focused on body descriptors only
- Don't duplicate schema validation (already handled by JSON schema)
- Performance is important - recipes loaded frequently
- New validator provides better error collection and warnings
- Environment-specific behavior enables dev/prod differences
- Make error messages actionable with fix suggestions
- Test with real anatomy recipes
- Update comments in loader to reflect new validator usage
- After this migration, BODDESROB-006 can remove the old validator entirely
