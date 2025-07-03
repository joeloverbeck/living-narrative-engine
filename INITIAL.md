## FEATURE:

We have the complex anatomy system working in our app. The goal now is to refactor its main pieces. For this feature we will focus on refactoring the complex GraphIntegrityValidator.

5. GraphIntegrityValidator (Lower Priority)

File: /src/anatomy/graphIntegrityValidator.js (446 lines)

Current Issues:

- Large validation methods with multiple responsibilities
- Complex constraint checking logic
- No validation rule abstraction
- Error accumulation without categorization
- Limited extensibility for new validation rules

Recommended Refactoring:

1. Implement Chain of Responsibility for validation rules
2. Create validation rule classes:
   - SocketLimitRule
   - RecipeConstraintRule
   - CycleDetectionRule
   - JointConsistencyRule
3. Add validation context object to track state
4. Categorize errors by severity and type

Expected Benefits:

- Extensible validation system
- Clearer validation logic
- Better error reporting
- Easier to test individual rules

Risk: Low - Validation is well-isolated

Your task: to analyze the module in depth looking to refactor it according to the refactoring principles contained in the file REFACTORING_PRINCIPLES.md, and create a PRP that we rely on later for the implementation. Do not modify any code at this stage.

## EXAMPLES:

The code for the anatomy system is in src/anatomy/ and subdirectories, and in src/services/
You have comprehensive integration suites for the anatomy system in tests/integration/anatomy/

## DOCUMENTATION:

None in particular.

## OTHER CONSIDERATIONS:

After each major refactoring step, run 'npm run test' and fix all failing test suites.