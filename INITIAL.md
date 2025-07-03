## FEATURE:

We have the complex anatomy system working in our app. The goal now is to refactor its main pieces. For this feature we will focus on refactoring the complex AnatomyGenerationService.

AnatomyGenerationService (High Priority)

File: /src/anatomy/anatomyGenerationService.js (232 lines)

Current Issues:

- Mixed concerns: Orchestration, validation, description generation, and cache building
- Tight coupling with BodyBlueprintFactory
- Inconsistent error handling: Swallows description generation errors
- Manual transaction management: No rollback on partial failures

Recommended Refactoring:

1. Extract orchestration logic to a dedicated AnatomyOrchestrator
2. Implement Unit of Work pattern for transactional consistency
3. Create dedicated error handlers for different failure scenarios
4. Separate concerns:
   - Generation coordination
   - Post-generation tasks (descriptions, caching)
   - Error recovery

Expected Benefits:

- Clear separation of orchestration from implementation
- Atomic operations with proper rollback
- Better error visibility and handling

Risk: Medium - Central service but well-defined boundaries

Your task: to analyze the code in depth looking to refactor it according to the refactoring principles contained in the file REFACTORING_PRINCIPLES.md, and create a PRP that we rely on later for the implementation. Do not modify any code at this stage.

## EXAMPLES:

The code for the anatomy system is in src/anatomy/
You have comprehensive integration suites for the anatomy system in tests/integration/anatomy/

## DOCUMENTATION:

None in particular.

## OTHER CONSIDERATIONS:

After each major refactoring step, run 'npm run test' and fix all failing test suites.