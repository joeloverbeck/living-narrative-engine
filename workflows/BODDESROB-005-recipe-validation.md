# BODDESROB-005: Integrate Recipe Validation in Anatomy Recipe Loader

**Status**: TODO
**Priority**: MEDIUM
**Phase**: 3 (Integration)
**Estimated Effort**: 1 day
**Dependencies**: BODDESROB-001, BODDESROB-002

## Overview

Integrate body descriptor validation into the anatomy recipe loading process. This ensures that recipe body descriptors are validated against the registry when recipes are loaded, catching invalid or unknown descriptors early in the data flow.

## Problem Context

Currently, anatomy recipes can contain:
- Invalid descriptor values (e.g., `height: 'super-mega-tall'` instead of valid enum)
- Unknown descriptors not defined in registry
- Malformed descriptor data

These issues are only discovered when:
- Descriptions are generated (runtime)
- Integration tests run (if covered)
- Users report missing/incorrect descriptions

Recipe validation will catch these issues during recipe loading, providing immediate feedback.

## Acceptance Criteria

- [ ] Validator integrated into anatomy recipe loader
- [ ] Body descriptor validation runs when recipes are loaded
- [ ] Invalid descriptor values are detected and reported
- [ ] Unknown descriptors trigger warnings
- [ ] Clear error messages with recipe ID and file path
- [ ] Development mode fails fast on critical errors
- [ ] Production mode logs warnings and continues
- [ ] Validation results logged appropriately
- [ ] Performance impact minimal (< 10ms per recipe)
- [ ] Integration tests verify validation behavior

## Technical Details

### Integration Point

Modify the anatomy recipe loader to validate body descriptors after loading:

```javascript
// src/loaders/anatomyRecipeLoader.js (enhanced)

import { BodyDescriptorValidator } from '../anatomy/validators/bodyDescriptorValidator.js';

export class AnatomyRecipeLoader {
  #logger;
  #validator;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger, 'AnatomyRecipeLoader');
    this.#validator = new BodyDescriptorValidator({ logger: this.#logger });
  }

  /**
   * Load and validate anatomy recipe
   */
  async loadRecipe(recipeId, recipeData, filePath) {
    // Existing loading logic...
    const recipe = this.#parseRecipe(recipeData);

    // Validate body descriptors if present
    if (recipe.bodyDescriptors) {
      this.#validateBodyDescriptors(recipeId, recipe.bodyDescriptors, filePath);
    }

    return recipe;
  }

  /**
   * Validate body descriptors in recipe
   * @private
   */
  #validateBodyDescriptors(recipeId, bodyDescriptors, filePath) {
    const result = this.#validator.validateRecipeDescriptors(bodyDescriptors);

    // Build context for error messages
    const context = `Recipe: ${recipeId} (${filePath})`;

    // Log errors
    for (const error of result.errors) {
      this.#logger.error(`[Recipe Validation] ${context} - ${error}`);
    }

    // Log warnings
    for (const warning of result.warnings) {
      this.#logger.warn(`[Recipe Validation] ${context} - ${warning}`);
    }

    // In development mode, fail fast on validation errors
    if (process.env.NODE_ENV !== 'production' && !result.valid) {
      throw new Error(
        `Body descriptor validation failed for ${context}:\n${result.errors.join('\n')}`
      );
    }
  }
}
```

### Implementation Steps

1. **Import Validator**
   - Add BodyDescriptorValidator import to recipe loader
   - Initialize validator in constructor

2. **Add Validation Call**
   - Call validator after recipe parsing
   - Only validate if bodyDescriptors present
   - Pass recipe ID and file path for context

3. **Add Error Handling**
   - Log validation errors with context
   - Log warnings for unknown descriptors
   - Fail fast in development mode

4. **Environment Logic**
   - Development: throw on validation errors
   - Production: log warnings, continue loading
   - Use NODE_ENV for detection

5. **Update Tests**
   - Test valid recipe loading
   - Test invalid descriptor values
   - Test unknown descriptors
   - Test environment-specific behavior

## Files to Modify

- `src/loaders/anatomyRecipeLoader.js` (MODIFY)
  - Import BodyDescriptorValidator
  - Add validation during recipe loading
  - Add error/warning logging
  - Add environment-specific behavior

## Testing Requirements

### Unit Tests

**File**: Update `tests/unit/loaders/anatomyRecipeLoader.test.js`

Test cases:
1. Recipe with valid descriptors loads successfully
2. Recipe with invalid descriptor values triggers errors
3. Recipe with unknown descriptors triggers warnings
4. Validation errors include recipe ID and file path
5. Development mode fails on invalid descriptors
6. Production mode logs warnings but continues
7. Recipes without bodyDescriptors skip validation

### Integration Tests

**File**: `tests/integration/loaders/anatomyRecipeValidation.test.js`

Test cases:
1. Load real anatomy recipes and validate
2. Create test recipe with invalid descriptors
3. Verify validation errors are logged
4. Verify warnings for unknown descriptors
5. Test complete loading flow with validation

### Test Template

```javascript
describe('AnatomyRecipeLoader - Descriptor Validation', () => {
  let loader;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    loader = new AnatomyRecipeLoader({ logger: mockLogger });
  });

  describe('Valid Descriptors', () => {
    it('should load recipe with valid body descriptors', async () => {
      const recipeData = {
        id: 'test:recipe',
        bodyDescriptors: {
          height: 'tall',
          skinColor: 'tan',
          build: 'athletic',
        },
      };

      await expect(
        loader.loadRecipe('test:recipe', recipeData, 'test/path.json')
      ).resolves.not.toThrow();
    });

    it('should not log errors or warnings for valid descriptors', async () => {
      const recipeData = {
        id: 'test:recipe',
        bodyDescriptors: { height: 'tall' },
      };

      await loader.loadRecipe('test:recipe', recipeData, 'test/path.json');

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Descriptors', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should reject recipe with invalid descriptor values', async () => {
      const recipeData = {
        id: 'test:recipe',
        bodyDescriptors: {
          height: 'super-mega-tall', // Invalid
        },
      };

      await expect(
        loader.loadRecipe('test:recipe', recipeData, 'test/path.json')
      ).rejects.toThrow('Body descriptor validation failed');
    });

    it('should log error with recipe context', async () => {
      const recipeData = {
        id: 'test:recipe',
        bodyDescriptors: { height: 'invalid' },
      };

      try {
        await loader.loadRecipe('test:recipe', recipeData, 'test/path.json');
      } catch (err) {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error.mock.calls[0][0]).toContain('test:recipe');
      expect(mockLogger.error.mock.calls[0][0]).toContain('test/path.json');
    });
  });

  describe('Unknown Descriptors', () => {
    it('should log warning for unknown descriptors', async () => {
      const recipeData = {
        id: 'test:recipe',
        bodyDescriptors: {
          unknownDescriptor: 'value',
        },
      };

      await loader.loadRecipe('test:recipe', recipeData, 'test/path.json');

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.warn.mock.calls[0][0]).toContain('Unknown body descriptor');
    });
  });

  describe('Environment Behavior', () => {
    it('should fail fast in development mode', async () => {
      process.env.NODE_ENV = 'development';
      const recipeData = {
        bodyDescriptors: { height: 'invalid' },
      };

      await expect(
        loader.loadRecipe('test:recipe', recipeData, 'test/path.json')
      ).rejects.toThrow();
    });

    it('should not fail in production mode', async () => {
      process.env.NODE_ENV = 'production';
      const recipeData = {
        bodyDescriptors: { height: 'invalid' },
      };

      await expect(
        loader.loadRecipe('test:recipe', recipeData, 'test/path.json')
      ).resolves.not.toThrow();
    });
  });

  describe('Recipes Without Body Descriptors', () => {
    it('should skip validation if bodyDescriptors not present', async () => {
      const recipeData = {
        id: 'test:recipe',
        // No bodyDescriptors
      };

      await loader.loadRecipe('test:recipe', recipeData, 'test/path.json');

      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
```

## Success Criteria

- [ ] Validation integrated into recipe loader
- [ ] Invalid descriptors detected during loading
- [ ] Unknown descriptors trigger warnings
- [ ] Error messages include recipe ID and file path
- [ ] Development mode fails fast on errors
- [ ] Production mode logs warnings only
- [ ] All tests pass
- [ ] ESLint passes with no errors
- [ ] Performance impact < 10ms per recipe
- [ ] Existing recipe loading still works

## Related Tickets

- Depends on: BODDESROB-001 (Centralized Registry)
- Depends on: BODDESROB-002 (Enhanced Validator)
- Related to: BODDESROB-004 (Bootstrap Validation)
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

- Keep validation focused on body descriptors only
- Don't duplicate schema validation
- Performance is important - recipes loaded frequently
- Consider caching validation results if needed
- Make error messages actionable with fix suggestions
- Test with real anatomy recipes
- Document validation behavior in loader comments
