# RECVALREF-011-03: Implement BlueprintExistenceValidator

**Parent Ticket:** RECVALREF-011-refactor-validators-to-standalone-CORRECTED.md  
**Priority:** P0 (Critical - Fail Fast)  
**Estimated Effort:** 1.5 hours  
**Complexity:** Low

## Objective

Extract the production `#checkBlueprintExists` inline method from
`src/anatomy/validation/RecipePreflightValidator.js` (lines 337-369) into a
standalone `BlueprintExistenceValidator` class under
`src/anatomy/validation/validators/`. The new validator must extend
`BaseValidator` (`src/anatomy/validation/validators/BaseValidator.js`) so that it
uses the shared `ValidationResultBuilder` path described in RECVALREF-000.

## Background

This is the gatekeeper validator for all blueprint-dependent work. According to
`docs/anatomy/blueprints-and-recipes.md`, recipes rely on blueprint metadata
(`id`, `root`, optional `structureTemplate`) to resolve slots and socket
relationships. If the blueprint lookup fails, we must halt subsequent
validations and emit the exact remediation guidance currently provided by the
inline method. Priority remains 10 and `failFast` must stay `true` so downstream
validators know to bail out when this step fails.

## Current Implementation (reality check)

**Location:** `src/anatomy/validation/RecipePreflightValidator.js`  
**Method:** `#checkBlueprintExists` (lines 337-369 as of 2025-02-14)

The inline method currently:

- Calls `await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId)`
  on `IAnatomyBlueprintRepository`.
- Pushes the following error object into `results.errors` when the repository
  returns `null`/`undefined`:
  ```js
  {
    type: 'BLUEPRINT_NOT_FOUND',
    blueprintId: recipe.blueprintId,
    message: `Blueprint '${recipe.blueprintId}' does not exist`,
    fix: `Create blueprint at data/mods/*/blueprints/${recipe.blueprintId.split(':')[1]}.blueprint.json`,
    severity: 'error'
  }
  ```
- Pushes a success entry into `results.passed` when a blueprint is found:
  ```js
  {
    check: 'blueprint_exists',
    message: `Blueprint '${recipe.blueprintId}' found`,
    blueprint: {
      id: blueprint.id,
      root: blueprint.root,
      structureTemplate: blueprint.structureTemplate,
    },
  }
  ```
- Catches repository exceptions, logs via
  `this.#logger.error('Blueprint existence check failed', error)`, and records a
  `VALIDATION_ERROR` object with `check: 'blueprint_exists'` plus
  `error: error.message`.

The extracted validator must recreate these payloads via
`ValidationResultBuilder.addError()` / `.addPassed()` so that later integration
can simply consume validator results instead of mutating `results.*` arrays.

## Implementation Tasks

### 1. Create Validator Class (45 min)

**File:** `src/anatomy/validation/validators/BlueprintExistenceValidator.js`

```javascript
import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates that the blueprint referenced by recipe exists and loads successfully.
 *
 * Priority: 10 - Must run before blueprint-dependent validators
 * Fail Fast: true - Missing blueprint blocks the pipeline
 */
export class BlueprintExistenceValidator extends BaseValidator {
  #anatomyBlueprintRepository;
  #logger;

  constructor({ logger, anatomyBlueprintRepository }) {
    super({
      name: 'blueprint-existence',
      priority: 10,
      failFast: true,
      logger,
    });

    validateDependency(anatomyBlueprintRepository, 'IAnatomyBlueprintRepository', logger, {
      requiredMethods: ['getBlueprint'],
    });

    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#logger = logger;
  }

  async performValidation(recipe, _options, builder) {
    // 1. Load blueprint exactly like the inline method.
    // 2. If missing, emit BLUEPRINT_NOT_FOUND via builder.addError('BLUEPRINT_NOT_FOUND', ...)
    //    and copy the current fix/blueprintId metadata verbatim.
    // 3. If found, emit builder.addPassed(`Blueprint '${recipe.blueprintId}' found`, {
    //      check: 'blueprint_exists',
    //      blueprint: { id, root, structureTemplate },
    //    }).
    // 4. Catch repository errors, log with this.#logger.error('Blueprint existence check failed', error),
    //    and emit builder.addError('VALIDATION_ERROR', 'Failed to check blueprint existence', {
    //      check: 'blueprint_exists',
    //      error: error.message,
    //    }).
    // NOTE: Guard `recipe.blueprintId?.split(':')[1]` so undefined IDs do not throw.
  }
}
```

Key extraction points:
- `getBlueprint` call at line ~341.
- Error payload fields (`type`, `message`, `blueprintId`, `fix`, severity).
- Success payload fields (`check`, `message`, `blueprint` object with id/root/structureTemplate per docs).
- Exception handling block using `VALIDATION_ERROR` + logger.

### 2. Create Unit Tests (45 min)

**File:** `tests/unit/anatomy/validation/validators/BlueprintExistenceValidator.test.js`

Test coverage should reflect actual BaseValidator behavior:

1. **Constructor validation**
   - Ensures `name`, `priority`, `failFast` getters expose `blueprint-existence`, `10`, `true`.
   - Throws when `anatomyBlueprintRepository` is missing `getBlueprint`.
   - Throws when `logger` is omitted.
2. **Validation scenarios**
   - Pass case: repository resolves blueprint (with/without `structureTemplate`); result contains the `passed` payload described above.
   - Missing blueprint: repository returns `null`; result has a `BLUEPRINT_NOT_FOUND` error, `isValid === false`, and fix string built from the recipe's namespace component.
   - Repository exception: error logged and converted into a `VALIDATION_ERROR` entry with `check: 'blueprint_exists'` + `error` message.
   - Missing `recipe.blueprintId`: ensure the validator still surfaces a clear fix hint without throwing (mock repo call receives `undefined`).
3. **Fail-fast metadata**
   - `failFast` remains `true` and result objects are frozen (via `Object.isFrozen`).
4. **Blueprint metadata edge cases**
   - Handles V1 blueprints that omit `structureTemplate` while still surfacing `id`/`root` (aligns with docs/anatomy/blueprints-and-recipes.md guidance).

Target ≥80% branch coverage by exercising success, missing, and exception paths.

### 3. Integration (15 min)

**No orchestrator changes yet.** This ticket only prepares the validator and its
tests. Wiring it into `RecipePreflightValidator` happens in
RECVALREF-011-10 once all validators exist.

## Dependencies

- `BaseValidator` (`src/anatomy/validation/validators/BaseValidator.js`).
- `ValidationResultBuilder` (`src/anatomy/validation/core/ValidationResultBuilder.js`).
- `validateDependency` helper (`src/utils/dependencyUtils.js`).
- `IAnatomyBlueprintRepository` contract (`src/interfaces/IAnatomyBlueprintRepository.js`).
- Anatomy blueprint docs (`docs/anatomy/blueprints-and-recipes.md`) for metadata context.

## Acceptance Criteria

- [ ] `BlueprintExistenceValidator` class created under `src/anatomy/validation/validators/`.
- [ ] Extends `BaseValidator` with `name: 'blueprint-existence'`, `priority: 10`, `failFast: true`.
- [ ] Constructor validates the `anatomyBlueprintRepository` dependency via `validateDependency` (requires `getBlueprint`).
- [ ] `performValidation` replicates the inline behavior exactly (same error/pass payload fields, same `VALIDATION_ERROR` handling).
- [ ] Blueprint metadata in the pass case includes `id`, `root`, `structureTemplate` even when the latter is `undefined`.
- [ ] Unit tests cover success, missing, exception, and missing-ID paths with ≥80% branch coverage.
- [ ] ESLint passes for the new source file and tests.

## Testing Commands

```bash
# Targeted unit tests
npm run test:unit -- BlueprintExistenceValidator.test.js

# Coverage (optional but recommended during development)
npm run test:unit -- BlueprintExistenceValidator.test.js --coverage

# Lint the new validator
npx eslint src/anatomy/validation/validators/BlueprintExistenceValidator.js
```

## Code Reference

- `src/anatomy/validation/RecipePreflightValidator.js:337-369` — current inline logic to mirror.
- `docs/anatomy/blueprints-and-recipes.md` — explains why `root` and `structureTemplate` metadata must remain intact.

## Critical Notes

- **Fail Fast:** `failFast` must stay `true` so future pipeline orchestration halts if this validator fails.
- **Priority 10:** This validator remains the first standalone validator executed once integration happens.
- **Behavior Parity:** Output objects must remain byte-for-byte compatible with the inline method to avoid breaking tooling that parses validation JSON.
- **Prep Work:** This ticket only delivers the validator + tests; orchestration refactor waits for RECVALREF-011-10.

## Success Metrics

- Validator implementation: ~80-100 LOC.
- Test file: ~150-200 LOC with comprehensive coverage of success/error/exception paths.
- Branch coverage ≥80% for the new tests.
- No regressions in blueprint validation behavior or messaging.
