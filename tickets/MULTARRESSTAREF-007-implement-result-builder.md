# MULTARRESSTAREF-007: Implement Result Builder

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Implement `TargetResolutionResultBuilder` class that consolidates all result assembly logic from the current `MultiTargetResolutionStage` (748 lines as of `src/actions/pipeline/stages/MultiTargetResolutionStage.js`), removing the remaining ~80 lines of duplicated code around legacy, multi-target, and final result assembly.

## Background

Result assembly is currently duplicated in these areas of `src/actions/pipeline/stages/MultiTargetResolutionStage.js`:
- The bottom of `executeInternal`, where the stage aggregates `actionsWithTargets`, merges `targetContexts`, re-attaches the last resolved targets/definitions, and wraps everything in `PipelineResult.success({ data, errors })`.
- `#resolveLegacyTarget`, which builds a success payload that includes `resolvedTargets`, normalized `targetContexts`, and the singular `actionsWithTargets` entry for the legacy action.
- `#resolveMultiTargets`, which builds a payload containing `resolvedTargets`, `targetContexts`, `targetDefinitions`, `detailedResolutionResults`, and an array of enriched `actionsWithTargets` (each action receives `resolvedTargets`, `targetDefinitions`, and `isMultiTarget`).

Keeping these three flows in sync is error-prone and makes backward compatibility fields (especially `targetContexts`, `resolvedTargets`, `targetDefinitions`, and `detailedResolutionResults`) fragile.

## Technical Requirements

### File to Create
- **Path:** `src/actions/pipeline/services/implementations/TargetResolutionResultBuilder.js`

### Implementation Details

**Class Structure:**
```javascript
import { validateDependency } from '../../../../utils/dependencyUtils.js';
import { PipelineResult } from '../../PipelineResult.js';

export default class TargetResolutionResultBuilder {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(logger, 'ILogger', logger);

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  // Implement all 4 interface methods here based on current stage behavior
}
```

### Methods to Extract and Implement

#### 1. `buildLegacyResult`
**Extract from:** Legacy success branch in `#resolveLegacyTarget`

**Responsibilities:**
- Build the single-entry `actionsWithTargets` array that legacy actions currently return.
- Preserve normalized `targetContexts` (placeholders + display names) and `resolvedTargets.primary` entries.
- Provide `targetDefinitions` from the conversion result (fallbacks must match the stage's current defaults when conversion data is missing).
- Ensure the payload mirrors the current `PipelineResult.success({ data })` contract (no `__legacyConversion` field exists today).

**Key Logic:**
```javascript
buildLegacyResult(context, resolvedTargets, targetContexts, conversionResult, actionDef) {
  return PipelineResult.success({
    data: {
      ...context.data,
      resolvedTargets,
      targetContexts,
      actionsWithTargets: [
        {
          actionDef,
          targetContexts,
          resolvedTargets,
          targetDefinitions:
            conversionResult.targetDefinitions || {
              primary: {
                scope:
                  conversionResult.targetDefinitions?.primary?.scope ||
                  actionDef.targets ||
                  actionDef.scope,
                placeholder:
                  conversionResult.targetDefinitions?.primary?.placeholder || 'target',
              },
            },
          isMultiTarget: false,
        },
      ],
    },
  });
}
```

#### 2. `buildMultiTargetResult`
**Extract from:** Success branch in `#resolveMultiTargets`

**Responsibilities:**
- Attach `resolvedTargets`, `targetDefinitions`, and `isMultiTarget` directly to the `actionDef` (as the stage does today before returning).
- Build the `actionsWithTargets` array (currently a single entry) that downstream stages consume.
- Preserve `targetContexts`, `detailedResolutionResults`, and global `resolvedTargets`/`targetDefinitions` in the `PipelineResult.success({ data })` payload.
- Keep backward compatibility behavior identical to the current implementation.

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
  actionDef.resolvedTargets = resolvedTargets;
  actionDef.targetDefinitions = targetDefinitions;
  actionDef.isMultiTarget = true;

  const actionsWithTargets = [
    {
      actionDef,
      targetContexts,
      resolvedTargets,
      targetDefinitions,
      isMultiTarget: true,
    },
  ];

  return PipelineResult.success({
    data: {
      ...context.data,
      resolvedTargets,
      targetContexts,
      targetDefinitions,
      detailedResolutionResults: detailedResults || {},
      actionsWithTargets,
    },
  });
}
```

#### 3. `buildFinalResult`
**Extract from:** Final aggregation block in `executeInternal`

**Responsibilities:**
- Aggregate all actions with targets
- Build pipeline result with backward compatibility
- Include target contexts for downstream stages
- Preserve last resolved targets (backward compat)
- Include collected `errors`

**Key Logic:**
```javascript
buildFinalResult(
  context,
  allActionsWithTargets,
  allTargetContexts,
  lastResolvedTargets,
  lastTargetDefinitions,
  errors
) {
  const resultData = {
    ...context.data,
    actionsWithTargets: allActionsWithTargets,
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

  return PipelineResult.success({ data: resultData, errors });
}
```

#### 4. `attachMetadata`
**New helper method** (consolidates metadata attachment logic)

**Responsibilities:**
- Apply the common metadata the stage currently writes directly on each `actionsWithTargets` entry (`resolvedTargets`, `targetDefinitions`, `isMultiTarget`, and `targetContexts`).
- Ensure both legacy and multi-target flows end up with consistent per-action payloads without sprinkling `isMultiTarget` checks throughout the stage.
- Optionally log or annotate additional diagnostics (e.g., count of resolved targets) without changing the observable payload structure.

**Key Logic:**
```javascript
attachMetadata(actionWithTargets, resolvedTargets, targetDefinitions, isMultiTarget) {
  actionWithTargets.resolvedTargets = resolvedTargets;
  actionWithTargets.targetDefinitions = targetDefinitions;
  actionWithTargets.isMultiTarget = isMultiTarget;
}
```

### Backward Compatibility Requirements

**Critical Fields to Preserve:**
- `actionsWithTargets` - Array of actions with resolved targets (currently provided via `data.actionsWithTargets`)
- `targetContexts` - Array of target contexts (for `ActionFormattingStage`)
- `resolvedTargets` - Last resolved targets map (backward compat)
- `targetDefinitions` - Last target definitions (backward compat)
- `detailedResolutionResults` - Multi-target diagnostics surfaced today

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
- Legacy result assembly: ~30 lines inside `#resolveLegacyTarget`'s success return block (payload + `actionsWithTargets`).
- Multi-target result assembly: ~25 lines at the end of `#resolveMultiTargets` where `actionDef` is mutated and `PipelineResult.success` is returned.
- Final result assembly: ~25 lines at the end of `executeInternal` that aggregate `actionsWithTargets`, target contexts, and errors.
- Metadata attachment logic: ~5-10 scattered lines where `resolvedTargets`, `targetDefinitions`, and `isMultiTarget` get applied directly to action payloads.
- **Total:** ~80 lines extracted

## Notes

- This addresses the **Shotgun Surgery** smell (3 assembly locations)
- Centralizes backward compatibility logic
- Ensures consistent result format across all paths
- Makes it easier to modify result structure in future
- Downstream stages must not break after this extraction
