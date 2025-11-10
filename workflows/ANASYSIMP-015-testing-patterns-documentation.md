# ANASYSIMP-015: Testing Patterns Documentation

**Phase:** 2 (Tooling & Documentation)
**Priority:** P2
**Effort:** Low (1 day)
**Impact:** Low - Better testing practices
**Status:** Not Started

## Context

No guidance exists on testing anatomy recipes, leading to inconsistent testing approaches.

## Solution Overview

Create testing patterns documentation at `docs/anatomy/testing-recipes.md` covering:

1. **Unit Testing Approach**
   - Test structure (Jest with `describe`, `it`, `expect`, `beforeEach`, `afterEach`)
   - Test helpers location: `tests/common/anatomy/`
     - `AnatomyIntegrationTestBed` - Primary test bed for integration tests
     - `SimplifiedAnatomyTestBed` - Lightweight alternative
     - `EnhancedAnatomyTestBed` - Extended functionality variant
   - Mock factories: `tests/common/mockFactories/`
     - `createMockLogger()`, `createMockEventDispatcher()`, `createMockSchemaValidator()`
   - Mocking strategies: Jest mocks for services, in-memory implementations for data stores

2. **Integration Testing**
   - Test bed pattern: `AnatomyIntegrationTestBed` with `loadAnatomyModData()` and `createActor()`
   - Manual browser testing: `/anatomy-visualizer.html` for visual validation
   - CLI validation testing: `npm run validate:recipe` and `npm run validate:body-descriptors`
   - Example: `tests/integration/anatomy/giantSpiderGeneration.test.js`

3. **Test Checklist**
   - Schema validation passes (automatic via `AjvSchemaValidator` during mod loading)
   - Pre-flight validation passes (`RecipePreflightValidator` with 9 validation checks)
   - Graph generates without errors (integration tests with `AnatomyGenerationService`)
   - All parts appear in description (verify via `anatomy:body` component inspection)
   - Pattern matching works (`RecipePatternResolver` integration)
   - Constraints validate (`RecipeConstraintEvaluator` validation)

## File Structure

```
docs/anatomy/
└── testing-recipes.md           # Testing guide

tests/common/anatomy/
├── anatomyIntegrationTestBed.js # Primary test bed
├── simplifiedAnatomyTestBed.js  # Lightweight alternative
├── enhancedAnatomyTestBed.js    # Extended functionality
└── anatomyVisualizerTestBed.js  # Visualizer-specific tests

tests/common/mockFactories/
└── index.js                     # Mock creation helpers

scripts/
├── validate-recipe.js           # CLI recipe validator
└── validate-body-descriptors.js # Body descriptor validator
```

## Acceptance Criteria

- [ ] Documents unit testing patterns with Jest structure
- [ ] Documents integration testing with `AnatomyIntegrationTestBed` usage
- [ ] Provides test checklist with validation stages (Schema, Pre-flight, Runtime, Descriptors)
- [ ] Includes code examples from existing tests (e.g., `giantSpiderGeneration.test.js`)
- [ ] References test utilities with locations and usage patterns
- [ ] Documents mock factory usage patterns
- [ ] Links to relevant anatomy documentation:
  - `docs/anatomy/validation-workflow.md` - Validation pipeline details
  - `docs/anatomy/anatomy-system-guide.md` - System architecture
  - `docs/testing/mod-testing-guide.md` - General mod testing patterns (for reference)

## Implementation Notes

**Key Testing Patterns to Document:**

1. **Unit Test Pattern:**
   ```javascript
   import { describe, it, expect, beforeEach } from '@jest/globals';

   describe('AnatomyService', () => {
     let service;
     let mockDependency;

     beforeEach(() => {
       mockDependency = { method: jest.fn() };
       service = new AnatomyService({ dependency: mockDependency });
     });

     it('should validate behavior', () => {
       // Arrange, Act, Assert
     });
   });
   ```

2. **Integration Test Pattern:**
   ```javascript
   import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

   describe('Recipe Generation', () => {
     let testBed;

     beforeEach(async () => {
       testBed = new AnatomyIntegrationTestBed();
       await testBed.loadAnatomyModData();
     });

     afterEach(() => testBed.cleanup());

     it('should generate anatomy', async () => {
       const entity = await testBed.createActor({ recipeId: 'anatomy:my_recipe' });
       // Assertions
     });
   });
   ```

3. **CLI Validation Pattern:**
   ```bash
   # Pre-development validation
   npm run validate:recipe data/mods/anatomy/recipes/my_recipe.recipe.json

   # Body descriptor validation
   npm run validate:body-descriptors

   # Full mod validation
   npm run validate
   ```

## References

- **Report Section:** Recommendation 3.4
- **Report Pages:** Lines 1149-1234
- **Related Docs:**
  - `docs/anatomy/validation-workflow.md` - Complete validation pipeline
  - `docs/anatomy/recipe-creation-checklist.md` - Recipe development workflow
  - `docs/testing/mod-testing-guide.md` - General mod testing patterns
