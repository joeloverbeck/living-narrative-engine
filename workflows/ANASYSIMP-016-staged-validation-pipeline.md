# ANASYSIMP-016: Staged Validation Pipeline

**Phase:** 3 (Architectural Enhancements)
**Priority:** P2
**Effort:** High (5-7 days)
**Impact:** High - Fundamental UX improvement
**Status:** Not Started

## Context

Current validation is **already staged** across multiple phases but lacks unified orchestration. The system has:
1. **Stage 1 (Load)**: `AjvSchemaValidator` for JSON schema validation during mod loading
2. **Stage 2 (Pre-flight)**: `RecipePreflightValidator` with 9 comprehensive checks (component existence, property schemas, blueprint validation, socket/slot compatibility, pattern matching, descriptor coverage, part availability, generated slot checks, load failures)
3. **Stage 3 (Generation)**: `blueprintValidator.js` functions (`validateRecipeSlots`, `checkBlueprintRecipeCompatibility`) + `GraphIntegrityValidator` with 6 validation rules (socket limits, recipe constraints, cycle detection, joint consistency, orphan detection, part type compatibility)
4. **No distinct Stage 4**: Body descriptor validation happens during generation, not post-generation

**Current Gap**: These stages exist independently without a unified pipeline orchestrator. Each validator uses its own execution model (AJV, rule chains, sequential checks) rather than a common stage abstraction.

## Solution Overview

**Unify existing staged validation** under a common pipeline orchestrator:

```
┌─────────────────────────────────────────────────────────────┐
│          Staged Validation Pipeline (ACTUAL)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage 1: LOAD (Schema Validation) ✅ IMPLEMENTED          │
│  ├─ Implementation: AjvSchemaValidator                      │
│  ├─ Location: src/validation/ajvSchemaValidator.js         │
│  ├─ Validates: JSON structure, data types, required fields │
│  └─ Timing: Automatic during mod loading                   │
│                                                             │
│  Stage 2: PRE-FLIGHT (Cross-Reference) ✅ IMPLEMENTED      │
│  ├─ Implementation: RecipePreflightValidator               │
│  ├─ Location: src/anatomy/validation/                      │
│  │            RecipePreflightValidator.js                  │
│  ├─ 9 Checks:                                              │
│  │   1. Component existence (ComponentExistenceRule)       │
│  │   2. Property schemas (PropertySchemaRule)              │
│  │   3. Blueprint validation                               │
│  │   4. Socket/slot compatibility                          │
│  │   5. Pattern matching (dry-run)                         │
│  │   6. Descriptor coverage                                │
│  │   7. Part availability                                  │
│  │   8. Generated slot part availability                   │
│  │   9. Entity definition load failures                    │
│  └─ Returns: ValidationReport with errors/warnings/etc.    │
│                                                             │
│  Stage 3: GENERATION (Runtime) ✅ IMPLEMENTED              │
│  ├─ Implementation: Multiple components                     │
│  │   • blueprintValidator.js (validateRecipeSlots,         │
│  │     checkBlueprintRecipeCompatibility)                  │
│  │   • GraphIntegrityValidator (6 rules via               │
│  │     ValidationRuleChain)                                │
│  ├─ Location: src/anatomy/bodyBlueprintFactory/,           │
│  │            src/anatomy/graphIntegrityValidator.js       │
│  ├─ Blueprint Validation:                                  │
│  │   • Recipe slots exist in blueprint                     │
│  │   • Required slots covered                              │
│  │   • Pattern resolution compatibility                    │
│  ├─ Graph Integrity (6 Rules):                             │
│  │   1. SocketLimitRule                                    │
│  │   2. RecipeConstraintRule                               │
│  │   3. CycleDetectionRule                                 │
│  │   4. JointConsistencyRule                               │
│  │   5. OrphanDetectionRule                                │
│  │   6. PartTypeCompatibilityRule                          │
│  └─ Timing: During BodyBlueprintFactory.createAnatomyGraph │
│                                                             │
│  Stage 4: POST-GENERATION ⚠️  MISLEADING                   │
│  ├─ NOTE: No distinct "post-generation" validation stage   │
│  ├─ Body descriptor validation happens DURING generation   │
│  │   (AnatomyGenerationWorkflow.validateBodyDescriptors)  │
│  ├─ Constraint satisfaction checked in Stage 3             │
│  │   (RecipeConstraintEvaluator)                          │
│  └─ "Description completeness" is not a validation stage   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

**Key Insight**: Validation is already staged but lacks:
1. Unified pipeline orchestrator (no ValidationPipeline class exists)
2. Common stage abstraction (no ValidationStage class exists)
3. Consistent execution model across validators
4. Configurable skip/fail-fast at pipeline level
```

## Benefits

- **Early error detection** - Catch issues at appropriate stage
- **Better error locality** - Errors tied to specific stage
- **Batch validation** - All issues reported at once
- **Configurable levels** - Skip stages when appropriate
- **Clear separation** - Each stage has single responsibility

## Implementation

### Current Architecture (As-Is)

**Validators are independent without unified orchestration:**

```javascript
// Stage 1: AjvSchemaValidator (automatic during mod loading)
// Location: src/validation/ajvSchemaValidator.js
class AjvSchemaValidator {
  validate(data, schemaId) {
    const validate = this.#ajv.getSchema(schemaId);
    const valid = validate(data);
    return {
      valid,
      errors: valid ? [] : formatAjvErrors(validate.errors)
    };
  }
}

// Stage 2: RecipePreflightValidator (manual invocation)
// Location: src/anatomy/validation/RecipePreflightValidator.js
class RecipePreflightValidator {
  async validate(recipe, options = {}) {
    const results = {
      recipeId: recipe.recipeId,
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
    };

    // Runs 9 validation checks sequentially (not via stage abstraction)
    await this.#runValidationChecks(recipe, results, options);

    return new ValidationReport(results);
  }
}

// Stage 3: GraphIntegrityValidator (during generation)
// Location: src/anatomy/graphIntegrityValidator.js
class GraphIntegrityValidator {
  async validateGraph(entityIds, recipe, socketOccupancy) {
    const context = new ValidationContext({
      entityIds, recipe, socketOccupancy,
      entityManager: this.#entityManager,
    });

    // Uses ValidationRuleChain, not ValidationStage
    await this.#ruleChain.execute(context);

    return context.getResult();
  }
}
```

### Proposed Pipeline Orchestrator (Target)

**Create unified orchestrator to wrap existing validators:**

```javascript
// NEW: Unified pipeline orchestrator
// Location: src/anatomy/validation/ValidationPipeline.js
class ValidationPipeline {
  #stages;
  #logger;

  constructor({ stages, logger }) {
    this.#stages = stages; // Array of ValidationStageAdapter instances
    this.#logger = logger;
  }

  async execute(recipe, options = {}) {
    const results = {
      stages: [],
      overallStatus: 'pending',
      timestamp: new Date().toISOString(),
    };

    for (const stage of this.#stages) {
      if (options.skipStages?.includes(stage.name)) {
        this.#logger.debug(`ValidationPipeline: Skipping stage '${stage.name}'`);
        continue;
      }

      this.#logger.debug(`ValidationPipeline: Executing stage '${stage.name}'`);

      const stageResult = await stage.execute(recipe, results);
      results.stages.push(stageResult);

      if (stageResult.status === 'error' && options.failFast) {
        this.#logger.warn(`ValidationPipeline: Stage '${stage.name}' failed, stopping (failFast=true)`);
        results.overallStatus = 'failed';
        break;
      }
    }

    results.overallStatus = this.#determineOverallStatus(results);
    return results;
  }

  #determineOverallStatus(results) {
    const hasErrors = results.stages.some(s => s.status === 'error');
    return hasErrors ? 'failed' : 'passed';
  }
}
```

### Stage Adapter Interface (Target)

**Adapt existing validators to common interface:**

```javascript
// NEW: Adapter to wrap existing validators with stage interface
// Location: src/anatomy/validation/ValidationStageAdapter.js
class ValidationStageAdapter {
  #name;
  #validator;
  #logger;

  constructor({ name, validator, logger }) {
    this.#name = name;
    this.#validator = validator;
    this.#logger = logger;
  }

  get name() {
    return this.#name;
  }

  async execute(recipe, context) {
    const result = {
      stage: this.#name,
      status: 'pending',
      errors: [],
      warnings: [],
      suggestions: [],
      timestamp: new Date().toISOString(),
    };

    try {
      // Delegate to existing validator
      const validationResult = await this.#validator.validate(recipe, context);

      // Normalize result format from existing validators
      if (validationResult.errors) {
        result.errors.push(...validationResult.errors);
      }
      if (validationResult.warnings) {
        result.warnings.push(...validationResult.warnings);
      }
      if (validationResult.suggestions) {
        result.suggestions.push(...validationResult.suggestions);
      }

      result.status = result.errors.length > 0 ? 'error' : 'passed';
    } catch (error) {
      this.#logger.error(`ValidationStageAdapter: Stage '${this.#name}' threw error`, error);
      result.errors.push({
        type: 'STAGE_ERROR',
        message: `Stage '${this.#name}' failed: ${error.message}`,
        error: error.message,
      });
      result.status = 'error';
    }

    return result;
  }
}

// Example: Wrapping RecipePreflightValidator
const preflightStage = new ValidationStageAdapter({
  name: 'pre-flight',
  validator: recipePreflightValidator, // Existing RecipePreflightValidator instance
  logger,
});
```

## Acceptance Criteria

### Phase 1: Pipeline Infrastructure
- [ ] ValidationPipeline class created
- [ ] ValidationStageAdapter class created
- [ ] Pipeline executes stages in order
- [ ] Stages can be skipped via configuration
- [ ] Fail-fast mode stops after first error stage
- [ ] Pipeline results aggregated comprehensively
- [ ] Each stage tracks timing
- [ ] Pipeline supports async validators

### Phase 2: Integration with Existing Validators
- [ ] AjvSchemaValidator wrapped in ValidationStageAdapter
- [ ] RecipePreflightValidator wrapped in ValidationStageAdapter
- [ ] GraphIntegrityValidator wrapped in ValidationStageAdapter
- [ ] blueprintValidator functions wrapped in ValidationStageAdapter
- [ ] All stages return normalized result format
- [ ] Existing ValidationReport format preserved
- [ ] No breaking changes to existing validator APIs

### Phase 3: Usage Integration
- [ ] RecipePreflightValidator CLI uses new pipeline (optional)
- [ ] BodyBlueprintFactory uses pipeline for generation validation (optional)
- [ ] Pipeline integration documented
- [ ] Migration guide for consuming code created

## Dependencies

**Leverages Existing Implementation:**
- ✅ ANASYSIMP-001: Component Existence Validation (implemented in RecipePreflightValidator)
- ✅ ANASYSIMP-002: Property Schema Validation (implemented in RecipePreflightValidator)
- ✅ ANASYSIMP-003: Pre-flight Validator (implemented as RecipePreflightValidator)
- ✅ AjvSchemaValidator (existing schema validator)
- ✅ GraphIntegrityValidator (existing graph validator)
- ✅ blueprintValidator functions (existing blueprint validation)

**No New Validators Required**: This ticket creates orchestration layer, not new validators.

## References

### Documentation
- [Anatomy Validation Workflow](../docs/anatomy/validation-workflow.md) - Comprehensive validation guide
- [RecipePreflightValidator](../src/anatomy/validation/RecipePreflightValidator.js) - Stage 2 implementation
- [GraphIntegrityValidator](../src/anatomy/graphIntegrityValidator.js) - Stage 3 implementation
- [AjvSchemaValidator](../src/validation/ajvSchemaValidator.js) - Stage 1 implementation

### Existing Architecture Insights
- **RecipePreflightValidator** already orchestrates 9 validation checks but without stage abstraction
- **GraphIntegrityValidator** uses `ValidationRuleChain` pattern (not stages)
- **ValidationReport** provides unified result format for pre-flight validation
- **blueprintValidator.js** exports standalone validation functions

### Original Report
- **Report Section:** Recommendation 4.1
- **Report Pages:** Lines 1236-1284
