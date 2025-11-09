# ANASYSIMP-016: Staged Validation Pipeline

**Phase:** 3 (Architectural Enhancements)
**Priority:** P2
**Effort:** High (5-7 days)
**Impact:** High - Fundamental UX improvement
**Status:** Not Started

## Context

Current validation is all-or-nothing at generation time. A staged pipeline enables progressive validation with clear separation of concerns.

## Solution Overview

Implement multi-stage validation pipeline:

```
┌─────────────────────────────────────────────────────┐
│          Staged Validation Pipeline                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Stage 1: LOAD (Schema Validation)                 │
│  ├─ JSON structure                                 │
│  ├─ Data types                                     │
│  └─ Required fields                                │
│                                                     │
│  Stage 2: PRE-FLIGHT (Cross-Reference)             │
│  ├─ Component existence                            │
│  ├─ Entity compatibility                           │
│  ├─ Property schemas                               │
│  ├─ Socket/slot matching                           │
│  └─ Pattern dry-run                                │
│                                                     │
│  Stage 3: GENERATION (Runtime)                     │
│  ├─ Entity instantiation                           │
│  ├─ Component validation                           │
│  └─ Pattern matching                               │
│                                                     │
│  Stage 4: POST-GENERATION (Verification)           │
│  ├─ Descriptor coverage                            │
│  ├─ Constraint satisfaction                        │
│  └─ Description completeness                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Benefits

- **Early error detection** - Catch issues at appropriate stage
- **Better error locality** - Errors tied to specific stage
- **Batch validation** - All issues reported at once
- **Configurable levels** - Skip stages when appropriate
- **Clear separation** - Each stage has single responsibility

## Implementation

### Pipeline Orchestrator

```javascript
class ValidationPipeline {
  #stages;

  constructor(stages) {
    this.#stages = stages;
  }

  async execute(recipe, options = {}) {
    const results = {
      stages: [],
      overallStatus: 'pending',
    };

    for (const stage of this.#stages) {
      if (options.skipStages?.includes(stage.name)) {
        continue;
      }

      const stageResult = await stage.execute(recipe, results);
      results.stages.push(stageResult);

      if (stageResult.status === 'error' && options.failFast) {
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

### Stage Interface

```javascript
class ValidationStage {
  constructor(name, validators) {
    this.name = name;
    this.validators = validators;
  }

  async execute(recipe, context) {
    const result = {
      stage: this.name,
      status: 'pending',
      errors: [],
      warnings: [],
      timestamp: new Date().toISOString(),
    };

    for (const validator of this.validators) {
      const validationResult = await validator.validate(recipe, context);
      result.errors.push(...validationResult.errors);
      result.warnings.push(...validationResult.warnings);
    }

    result.status = result.errors.length > 0 ? 'error' : 'passed';
    return result;
  }
}
```

## Acceptance Criteria

- [ ] Pipeline executes stages in order
- [ ] Each stage has clear responsibility
- [ ] Stages can be skipped via configuration
- [ ] Fail-fast mode stops after first error stage
- [ ] Pipeline results aggregated comprehensively
- [ ] Each stage tracks timing
- [ ] Pipeline supports async validators
- [ ] Integration with existing validators

## Dependencies

**Depends On:**
- ANASYSIMP-001 through ANASYSIMP-006 (validators for each stage)
- ANASYSIMP-003 (Pre-flight Validator as Stage 2)

## References

- **Report Section:** Recommendation 4.1
- **Report Pages:** Lines 1236-1284
