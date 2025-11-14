# MULTARRESSTAREF-007: Implement Result Builder

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Implement `TargetResolutionResultBuilder` class that consolidates all result assembly logic from three locations in `MultiTargetResolutionStage`, removing ~80 lines of duplicated code.

## Background

Result assembly is currently duplicated in:
- Lines 379-399: Main result assembly in `executeInternal`
- Lines 525-556: Legacy result assembly in `#resolveLegacyTarget`
- Lines 903-922: Multi-target result assembly in `#resolveMultiTargets`

This duplication makes backward compatibility maintenance error-prone and increases the risk of inconsistent result formats.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js`

### Implementation Details

**Class Structure:**
```javascript
import { validateDependency } from '../../../../utils/dependencyUtils.js';
import PipelineResult from '../../core/PipelineResult.js';

export default class TargetResolutionResultBuilder {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntity'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  // Implement all 4 interface methods here
}
```

### Methods to Extract and Implement

#### 1. `buildLegacyResult`
**Extract from:** Lines 525-556 in `#resolveLegacyTarget`

**Responsibilities:**
- Build result for legacy single-target actions
- Attach legacy conversion metadata
- Include backward compatibility fields
- Populate `targetContexts` for downstream stages

**Key Logic:**
```javascript
buildLegacyResult(context, resolvedTargets, targetContexts, conversionResult, actionDef) {
  const actionWithTargets = {
    ...actionDef,
    resolvedTargets,
    __legacyConversion: conversionResult,
  };

  // Attach backward compatibility metadata
  this.attachMetadata(actionWithTargets, resolvedTargets, {}, false);

  return actionWithTargets;
}
```

#### 2. `buildMultiTargetResult`
**Extract from:** Lines 903-922 in `#resolveMultiTargets`

**Responsibilities:**
- Build result for multi-target actions
- Attach multi-target metadata
- Include detailed resolution results
- Populate target contexts

**Key Logic:**
```javascript
buildMultiTargetResult(
  context,
  resolvedTargets,
  targetContexts,
  targetDefinitions,
  actionDef,
  detailedResults
) {
  const actionWithTargets = {
    ...actionDef,
    resolvedTargets,
    __detailedResults: detailedResults || {},
  };

  // Attach multi-target metadata
  this.attachMetadata(actionWithTargets, resolvedTargets, targetDefinitions, true);

  return actionWithTargets;
}
```

#### 3. `buildFinalResult`
**Extract from:** Lines 379-399 in `executeInternal`

**Responsibilities:**
- Aggregate all actions with targets
- Build pipeline result with backward compatibility
- Include target contexts for downstream stages
- Preserve last resolved targets (backward compat)

**Key Logic:**
```javascript
buildFinalResult(
  context,
  allActionsWithTargets,
  allTargetContexts,
  lastResolvedTargets,
  lastTargetDefinitions
) {
  const resultData = {
    candidateActions: allActionsWithTargets,
  };

  // Backward compatibility: Include target contexts
  if (allTargetContexts.length > 0) {
    resultData.targetContexts = allTargetContexts;
  }

  // Backward compatibility: Include last resolved targets
  if (lastResolvedTargets && lastTargetDefinitions) {
    resultData.resolvedTargets = lastResolvedTargets;
    resultData.targetDefinitions = lastTargetDefinitions;
  }

  return PipelineResult.success({ data: resultData });
}
```

#### 4. `attachMetadata`
**New helper method** (consolidates metadata attachment logic)

**Responsibilities:**
- Attach consistent metadata to all action results
- Mark legacy vs. multi-target format
- Include resolution timestamps
- Add any debugging metadata

**Key Logic:**
```javascript
attachMetadata(actionWithTargets, resolvedTargets, targetDefinitions, isMultiTarget) {
  actionWithTargets.__metadata = {
    isMultiTarget,
    targetCount: Object.keys(resolvedTargets).length,
    resolvedAt: Date.now(),
    hasTargetDefinitions: Object.keys(targetDefinitions).length > 0,
  };
}
```

### Backward Compatibility Requirements

**Critical Fields to Preserve:**
- `candidateActions` - Array of actions with resolved targets
- `targetContexts` - Array of target contexts (for ActionFormattingStage)
- `resolvedTargets` - Last resolved targets map (backward compat)
- `targetDefinitions` - Last target definitions (backward compat)
- `__legacyConversion` - Legacy conversion metadata
- `__detailedResults` - Detailed resolution results

**Downstream Stage Dependencies:**
- **TargetComponentValidationStage** expects `actionDef.resolvedTargets`
- **ActionFormattingStage** expects `targetContexts` and `placeholder` metadata
- **PrerequisiteEvaluationStage** expects resolved targets in context

## Acceptance Criteria

- [ ] Class created at specified path
- [ ] All 4 interface methods implemented
- [ ] Private `#entityManager` and `#logger` fields with validation
- [ ] Constructor uses dependency injection
- [ ] All result formats match existing implementation exactly
- [ ] Backward compatibility fields preserved
- [ ] Metadata attachment consistent across all paths
- [ ] JSDoc comments for all public methods
- [ ] Follows project coding standards

## Dependencies

- **MULTARRESSTAREF-006** - Interface must exist before implementation

## Testing Strategy

Tests will be created in MULTARRESSTAREF-008. Implementation should be testable with:
- Mock context, actions, and resolved targets
- Verification of result structure
- Backward compatibility field checks
- Metadata attachment validation

## Migration Notes

**Lines to Extract:**
- Legacy result assembly: ~32 lines (525-556)
- Multi-target result assembly: ~19 lines (903-922)
- Final result assembly: ~21 lines (379-399)
- Metadata attachment logic: ~8 lines (scattered)
- **Total:** ~80 lines extracted

## Notes

- This addresses the **Shotgun Surgery** smell (3 assembly locations)
- Centralizes backward compatibility logic
- Ensures consistent result format across all paths
- Makes it easier to modify result structure in future
- Downstream stages must not break after this extraction
