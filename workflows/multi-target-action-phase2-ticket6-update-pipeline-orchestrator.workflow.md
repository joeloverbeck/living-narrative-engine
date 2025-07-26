# Ticket: Update Pipeline Orchestrator for Multi-Target Support

## Ticket ID: PHASE2-TICKET6

## Priority: High

## Estimated Time: 4-6 hours

## Dependencies: PHASE2-TICKET4, PHASE2-TICKET5

## Blocks: PHASE2-TICKET7, PHASE4-TICKET14

## Overview

Update the action pipeline orchestrator to use the new MultiTargetResolutionStage instead of the existing TargetResolutionStage, and ensure proper coordination between all pipeline stages for multi-target actions. This includes updating stage registration, configuration, and error handling.

## Key Changes

1. **Stage Replacement**: Replace TargetResolutionStage with MultiTargetResolutionStage
2. **Stage Ordering**: Ensure proper stage execution order
3. **Data Flow**: Verify context data flows correctly between stages
4. **Error Handling**: Update error handling for multi-target scenarios
5. **Configuration**: Update pipeline configuration and registration
6. **Backward Compatibility**: Ensure existing single-target actions continue working

## Current Pipeline Architecture

Based on the existing codebase, the current pipeline likely follows this structure:

```
ComponentFilteringStage → PrerequisiteEvaluationStage → TargetResolutionStage → ActionFormattingStage
```

## Target Pipeline Architecture

The new pipeline should be:

```
ComponentFilteringStage → PrerequisiteEvaluationStage → MultiTargetResolutionStage → ActionFormattingStage
```

## Implementation Steps

### Step 1: Update Pipeline Orchestrator Configuration

Update file: `src/actions/pipeline/Pipeline.js`

```javascript
/**
 * @file Enhanced Pipeline with multi-target support
 */

// Type imports
/** @typedef {import('./PipelineStage.js').PipelineStage} PipelineStage */
/** @typedef {import('./PipelineResult.js').PipelineResult} PipelineResult */
/** @typedef {import('../tracing/traceContext.js').TraceContext} TraceContext */

import { validateDependency } from '../../utils/validationUtils.js';
import { ComponentFilteringStage } from './stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from './stages/PrerequisiteEvaluationStage.js';
import { MultiTargetResolutionStage } from './stages/MultiTargetResolutionStage.js';
import { ActionFormattingStage } from './stages/ActionFormattingStage.js';

/**
 * Action processing pipeline with multi-target support
 */
export class Pipeline {
  #stages;
  #logger;

  /**
   * @param {Object} deps
   * @param {Array<PipelineStage>} deps.stages - Pipeline stages in execution order
   * @param {ILogger} deps.logger
   */
  constructor({ stages, logger }) {
    validateDependency(logger, 'ILogger');

    this.#stages = stages || [];
    this.#logger = logger;

    // Validate stage order
    this.#validateStageOrder();
  }

  /**
   * Execute the pipeline with given context
   * @param {Object} context - Pipeline execution context
   * @param {TraceContext} [trace] - Optional trace context
   * @returns {Promise<PipelineResult>}
   */
  async execute(context, trace) {
    trace?.step('Starting action pipeline execution', 'Pipeline');

    let currentContext = { ...context };
    let stageIndex = 0;

    try {
      for (const stage of this.#stages) {
        trace?.step(
          `Executing stage ${stageIndex + 1}: ${stage.constructor.name}`,
          'Pipeline'
        );

        const result = await stage.executeInternal(currentContext, trace);

        if (result.isError) {
          trace?.failure(
            `Stage ${stage.constructor.name} failed: ${result.error.message}`,
            'Pipeline'
          );
          return result;
        }

        if (!result.shouldContinue) {
          trace?.info(
            `Pipeline stopped at stage ${stage.constructor.name}: ${result.reason}`,
            'Pipeline'
          );
          return result;
        }

        // Update context with stage results
        currentContext = result.data;
        stageIndex++;

        trace?.success(
          `Stage ${stage.constructor.name} completed successfully`,
          'Pipeline'
        );
      }

      trace?.success('Pipeline execution completed successfully', 'Pipeline');
      return PipelineResult.success(currentContext);
    } catch (error) {
      this.#logger.error(
        `Pipeline execution failed at stage ${stageIndex}:`,
        error
      );
      trace?.failure(`Pipeline execution failed: ${error.message}`, 'Pipeline');
      return PipelineResult.error(error, 'Pipeline');
    }
  }

  /**
   * Add a stage to the pipeline
   * @param {PipelineStage} stage
   * @param {number} [index] - Optional index to insert at
   */
  addStage(stage, index) {
    validateDependency(stage, 'IPipelineStage');

    if (index !== undefined) {
      this.#stages.splice(index, 0, stage);
    } else {
      this.#stages.push(stage);
    }

    this.#validateStageOrder();
  }

  /**
   * Remove a stage from the pipeline
   * @param {number|Function} stageOrIndex - Stage index or constructor
   */
  removeStage(stageOrIndex) {
    if (typeof stageOrIndex === 'number') {
      this.#stages.splice(stageOrIndex, 1);
    } else {
      const index = this.#stages.findIndex(
        (stage) => stage instanceof stageOrIndex
      );
      if (index >= 0) {
        this.#stages.splice(index, 1);
      }
    }
  }

  /**
   * Get pipeline stage information
   */
  getStageInfo() {
    return this.#stages.map((stage, index) => ({
      index,
      name: stage.constructor.name,
      type: this.#getStageType(stage),
    }));
  }

  /**
   * Validate that stages are in correct order
   * @private
   */
  #validateStageOrder() {
    const expectedOrder = [
      'ComponentFilteringStage',
      'PrerequisiteEvaluationStage',
      'MultiTargetResolutionStage',
      'ActionFormattingStage',
    ];

    const actualOrder = this.#stages.map((stage) => stage.constructor.name);

    // Check for deprecated TargetResolutionStage
    if (actualOrder.includes('TargetResolutionStage')) {
      throw new Error(
        'TargetResolutionStage is deprecated. Use MultiTargetResolutionStage instead.'
      );
    }

    // Validate core stages are present
    const missingStages = expectedOrder.filter(
      (expected) => !actualOrder.includes(expected)
    );

    if (missingStages.length > 0) {
      this.#logger.warn(
        `Missing expected pipeline stages: ${missingStages.join(', ')}`
      );
    }

    // Check ordering of present stages
    let lastExpectedIndex = -1;
    for (const stageName of actualOrder) {
      const expectedIndex = expectedOrder.indexOf(stageName);
      if (expectedIndex >= 0) {
        if (expectedIndex < lastExpectedIndex) {
          this.#logger.warn(
            `Stage ${stageName} appears out of order. Expected order: ${expectedOrder.join(' → ')}`
          );
        }
        lastExpectedIndex = expectedIndex;
      }
    }
  }

  /**
   * Get stage type for categorization
   * @private
   */
  #getStageType(stage) {
    const name = stage.constructor.name;

    if (name.includes('Filtering')) return 'filtering';
    if (name.includes('Prerequisite')) return 'validation';
    if (name.includes('Resolution')) return 'resolution';
    if (name.includes('Formatting')) return 'formatting';

    return 'custom';
  }
}

export default Pipeline;
```

### Step 2: Create Pipeline Factory

Create file: `src/actions/pipeline/pipelineFactory.js`

```javascript
/**
 * @file Factory for creating configured action pipelines
 */

import { Pipeline } from './Pipeline.js';
import { ComponentFilteringStage } from './stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from './stages/PrerequisiteEvaluationStage.js';
import { MultiTargetResolutionStage } from './stages/MultiTargetResolutionStage.js';
import { ActionFormattingStage } from './stages/ActionFormattingStage.js';
import { validateDependency } from '../../utils/validationUtils.js';

/**
 * Factory for creating action processing pipelines
 */
export class PipelineFactory {
  #dependencies;

  /**
   * @param {Object} deps - All dependencies needed for pipeline stages
   */
  constructor(deps) {
    this.#dependencies = deps;
    this.#validateDependencies();
  }

  /**
   * Create a standard multi-target action pipeline
   * @returns {Pipeline}
   */
  createStandardPipeline() {
    const stages = [
      this.#createComponentFilteringStage(),
      this.#createPrerequisiteEvaluationStage(),
      this.#createMultiTargetResolutionStage(),
      this.#createActionFormattingStage(),
    ];

    return new Pipeline({
      stages,
      logger: this.#dependencies.logger,
    });
  }

  /**
   * Create a pipeline for legacy single-target actions
   * @returns {Pipeline}
   */
  createLegacyCompatiblePipeline() {
    // Same pipeline - MultiTargetResolutionStage handles legacy actions
    return this.createStandardPipeline();
  }

  /**
   * Create a custom pipeline with specified stages
   * @param {Array<string>} stageNames - Names of stages to include
   * @returns {Pipeline}
   */
  createCustomPipeline(stageNames) {
    const stageFactories = {
      ComponentFilteringStage: () => this.#createComponentFilteringStage(),
      PrerequisiteEvaluationStage: () =>
        this.#createPrerequisiteEvaluationStage(),
      MultiTargetResolutionStage: () =>
        this.#createMultiTargetResolutionStage(),
      ActionFormattingStage: () => this.#createActionFormattingStage(),
    };

    const stages = stageNames.map((name) => {
      const factory = stageFactories[name];
      if (!factory) {
        throw new Error(`Unknown stage: ${name}`);
      }
      return factory();
    });

    return new Pipeline({
      stages,
      logger: this.#dependencies.logger,
    });
  }

  /**
   * Create component filtering stage
   * @private
   */
  #createComponentFilteringStage() {
    return new ComponentFilteringStage({
      entityManager: this.#dependencies.entityManager,
      logger: this.#dependencies.logger,
    });
  }

  /**
   * Create prerequisite evaluation stage
   * @private
   */
  #createPrerequisiteEvaluationStage() {
    return new PrerequisiteEvaluationStage({
      prerequisiteEvaluationService:
        this.#dependencies.prerequisiteEvaluationService,
      logger: this.#dependencies.logger,
    });
  }

  /**
   * Create multi-target resolution stage
   * @private
   */
  #createMultiTargetResolutionStage() {
    return new MultiTargetResolutionStage({
      scopeInterpreter: this.#dependencies.scopeInterpreter,
      entityManager: this.#dependencies.entityManager,
      targetResolver: this.#dependencies.targetResolver,
      targetContextBuilder: this.#dependencies.targetContextBuilder,
      logger: this.#dependencies.logger,
    });
  }

  /**
   * Create action formatting stage
   * @private
   */
  #createActionFormattingStage() {
    return new ActionFormattingStage({
      entityManager: this.#dependencies.entityManager,
      displayNameResolver: this.#dependencies.displayNameResolver,
      maxCombinations: this.#dependencies.maxCombinations || 100,
      logger: this.#dependencies.logger,
    });
  }

  /**
   * Validate required dependencies
   * @private
   */
  #validateDependencies() {
    const required = [
      'entityManager',
      'prerequisiteEvaluationService',
      'scopeInterpreter',
      'targetResolver',
      'targetContextBuilder',
      'logger',
    ];

    for (const dep of required) {
      if (!this.#dependencies[dep]) {
        throw new Error(`Missing required dependency: ${dep}`);
      }
    }
  }
}

export default PipelineFactory;
```

### Step 3: Update Dependency Injection Registration

Update file: `src/dependencyInjection/registrations/actionRegistrations.js`

```javascript
// Add new imports
import { PipelineFactory } from '../../actions/pipeline/pipelineFactory.js';
import { Pipeline } from '../../actions/pipeline/Pipeline.js';

// Add new tokens
export const ACTION_TOKENS = {
  // ... existing tokens ...
  IPipelineFactory: Symbol('IPipelineFactory'),
  IActionPipeline: Symbol('IActionPipeline'),
};

// Update registration function
export function registerActionServices(container) {
  // ... existing registrations ...

  // Register pipeline factory
  container.register(ACTION_TOKENS.IPipelineFactory, PipelineFactory, {
    dependencies: [
      tokens.IEntityManager,
      tokens.IPrerequisiteEvaluationService,
      tokens.IScopeInterpreter,
      tokens.ITargetResolutionService,
      ACTION_TOKENS.ITargetContextBuilder,
      tokens.ILogger,
      // Optional dependencies
      { token: 'IDisplayNameResolver', optional: true },
      { token: 'maxCombinations', optional: true, defaultValue: 100 },
    ],
  });

  // Register pipeline instance
  container.register(ACTION_TOKENS.IActionPipeline, (container) => {
    const factory = container.resolve(ACTION_TOKENS.IPipelineFactory);
    return factory.createStandardPipeline();
  });
}
```

### Step 4: Update Action Candidate Processor

Update file: `src/actions/actionCandidateProcessor.js` to use the new pipeline:

```javascript
/**
 * Enhanced ActionCandidateProcessor using multi-target pipeline
 */

// Add import for pipeline
import { Pipeline } from './pipeline/Pipeline.js';

export class ActionCandidateProcessor {
  #pipeline;
  // ... other dependencies ...

  constructor({
    pipeline, // New dependency
    // ... existing dependencies ...
  }) {
    validateDependency(pipeline, 'IPipeline');
    this.#pipeline = pipeline;
    // ... existing constructor code ...
  }

  /**
   * Process action using pipeline
   */
  async process(actionDef, actorEntity, context, trace = null) {
    // Build pipeline context
    const pipelineContext = {
      actionDef,
      actor: actorEntity,
      actionContext: context,
    };

    // Execute pipeline
    const result = await this.#pipeline.execute(pipelineContext, trace);

    if (result.isError) {
      return ActionResult.failure(result.error);
    }

    if (!result.shouldContinue) {
      return ActionResult.success({
        actions: [],
        errors: [],
        cause: result.reason,
      });
    }

    // Extract formatted actions from pipeline result
    const formattedActions = result.data.formattedActions || [];

    // Convert to DiscoveredActionInfo format
    const discoveredActions = formattedActions.map((formatted) => ({
      id: formatted.actionId,
      name: actionDef.name,
      command: formatted.formattedText,
      description: actionDef.description || '',
      params: {
        targetId: formatted.targetId, // For backward compatibility
        targets: formatted.targets,
      },
    }));

    return ActionResult.success({
      actions: discoveredActions,
      errors: [],
    });
  }
}
```

### Step 5: Create Pipeline Integration Tests

Create file: `tests/integration/actions/pipeline/multiTargetPipeline.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../../common/integrationTestBed.js';
import { PipelineFactory } from '../../../../src/actions/pipeline/pipelineFactory.js';

describe('Multi-Target Pipeline Integration', () => {
  let testBed;
  let pipelineFactory;
  let pipeline;

  beforeEach(() => {
    testBed = new IntegrationTestBed();

    // Create pipeline factory with all dependencies
    pipelineFactory = new PipelineFactory({
      entityManager: testBed.getService('entityManager'),
      prerequisiteEvaluationService: testBed.getService(
        'prerequisiteEvaluationService'
      ),
      scopeInterpreter: testBed.getService('scopeInterpreter'),
      targetResolver: testBed.getService('targetResolver'),
      targetContextBuilder: testBed.getService('targetContextBuilder'),
      logger: testBed.getService('logger'),
    });

    pipeline = pipelineFactory.createStandardPipeline();
  });

  describe('Legacy Action Support', () => {
    it('should process legacy single-target action', async () => {
      // Create legacy action
      const legacyAction = {
        id: 'test:eat',
        name: 'Eat',
        description: 'Consume food',
        scope: 'test:food_items', // Legacy property
        template: 'eat {target}',
      };

      // Create entities
      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['apple_001'] },
      });

      const apple = testBed.createEntity('apple_001', {
        'core:item': { name: 'Red Apple', type: 'food' },
      });

      // Register scope
      testBed.registerScope('test:food_items', 'actor.core:inventory.items[]');

      // Execute pipeline
      const context = {
        actionDef: legacyAction,
        actor: player,
        actionContext: { location: null },
      };

      const result = await pipeline.execute(context);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions).toHaveLength(1);
      expect(result.data.formattedActions[0].formattedText).toBe(
        'eat Red Apple'
      );
    });
  });

  describe('Multi-Target Action Processing', () => {
    it('should process throw action with combinations', async () => {
      // Create multi-target action
      const throwAction = {
        id: 'combat:throw',
        name: 'Throw',
        description: 'Throw item at target',
        targets: {
          primary: {
            scope: 'test:throwable_items',
            placeholder: 'item',
          },
          secondary: {
            scope: 'test:hostile_targets',
            placeholder: 'target',
          },
        },
        template: 'throw {item} at {target}',
        generateCombinations: true,
      };

      // Create entities
      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['rock_001', 'knife_002'] },
        'core:position': { locationId: 'arena' },
      });

      const rock = testBed.createEntity('rock_001', {
        'core:item': { name: 'Rock', type: 'throwable' },
      });

      const knife = testBed.createEntity('knife_002', {
        'core:item': { name: 'Knife', type: 'weapon' },
      });

      const goblin = testBed.createEntity('goblin_001', {
        'core:actor': { name: 'Goblin' },
        'core:position': { locationId: 'arena' },
      });

      const orc = testBed.createEntity('orc_001', {
        'core:actor': { name: 'Orc' },
        'core:position': { locationId: 'arena' },
      });

      const arena = testBed.createEntity('arena', {
        'core:location': { name: 'Arena' },
        'core:actors': { actors: ['player', 'goblin_001', 'orc_001'] },
      });

      // Register scopes
      testBed.registerScope(
        'test:throwable_items',
        'actor.core:inventory.items[]'
      );
      testBed.registerScope(
        'test:hostile_targets',
        'location.core:actors[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]'
      );

      // Execute pipeline
      const context = {
        actionDef: throwAction,
        actor: player,
        actionContext: { location: arena },
      };

      const result = await pipeline.execute(context);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions).toHaveLength(4); // 2 items × 2 targets

      const commands = result.data.formattedActions.map((a) => a.formattedText);
      expect(commands).toContain('throw Rock at Goblin');
      expect(commands).toContain('throw Rock at Orc');
      expect(commands).toContain('throw Knife at Goblin');
      expect(commands).toContain('throw Knife at Orc');
    });

    it('should process clothing adjustment with target context', async () => {
      // Create context-dependent action
      const adjustAction = {
        id: 'intimacy:adjust',
        name: 'Adjust Clothing',
        description: "Adjust someone's clothing",
        targets: {
          primary: {
            scope: 'test:nearby_people',
            placeholder: 'person',
          },
          secondary: {
            scope: 'test:adjustable_clothing',
            placeholder: 'garment',
            contextFrom: 'primary',
          },
        },
        template: "adjust {person}'s {garment}",
        generateCombinations: false,
      };

      // Create entities with clothing
      const player = testBed.createEntity('player', {
        'core:position': { locationId: 'room' },
      });

      const npc = testBed.createEntity('npc_001', {
        'core:actor': { name: 'Alice' },
        'core:position': { locationId: 'room' },
        'clothing:equipment': {
          equipped: {
            torso_upper: {
              outer: 'jacket_001',
            },
          },
        },
      });

      const jacket = testBed.createEntity('jacket_001', {
        'core:item': { name: 'Blue Jacket' },
        'clothing:garment': {
          slot: 'torso_upper',
          properties: ['adjustable'],
        },
      });

      const room = testBed.createEntity('room', {
        'core:location': { name: 'Room' },
        'core:actors': { actors: ['player', 'npc_001'] },
      });

      // Register scopes
      testBed.registerScope(
        'test:nearby_people',
        'location.core:actors[][{"!=": [{"var": "entity.id"}, {"var": "actor.id"}]}]'
      );
      testBed.registerScope(
        'test:adjustable_clothing',
        'target.topmost_clothing[][{"in": ["adjustable", {"var": "entity.components.clothing:garment.properties"}]}]'
      );

      // Execute pipeline
      const context = {
        actionDef: adjustAction,
        actor: player,
        actionContext: { location: room },
      };

      const result = await pipeline.execute(context);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.formattedActions).toHaveLength(1);
      expect(result.data.formattedActions[0].formattedText).toBe(
        "adjust Alice's Blue Jacket"
      );
      expect(result.data.formattedActions[0].targets).toEqual({
        primary: {
          id: 'npc_001',
          displayName: 'Alice',
          placeholder: 'person',
        },
        secondary: {
          id: 'jacket_001',
          displayName: 'Blue Jacket',
          placeholder: 'garment',
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle stage failures gracefully', async () => {
      // Create action that will fail prerequisite
      const failingAction = {
        id: 'test:fail',
        name: 'Failing Action',
        description: 'This will fail',
        targets: 'test:targets',
        template: 'fail {target}',
        prerequisites: [
          {
            logic: { '==': [1, 2] }, // Always fails
            failure_message: 'This always fails',
          },
        ],
      };

      const player = testBed.createEntity('player', {});

      const context = {
        actionDef: failingAction,
        actor: player,
        actionContext: { location: null },
      };

      const result = await pipeline.execute(context);

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('prerequisite');
    });

    it('should handle missing targets gracefully', async () => {
      // Create action with scope that returns no targets
      const emptyAction = {
        id: 'test:empty',
        name: 'Empty Action',
        description: 'No targets available',
        targets: 'test:empty_scope',
        template: 'do {target}',
      };

      const player = testBed.createEntity('player', {});

      // Register empty scope
      testBed.registerScope(
        'test:empty_scope',
        'entities(nonexistent:component)[]'
      );

      const context = {
        actionDef: emptyAction,
        actor: player,
        actionContext: { location: null },
      };

      const result = await pipeline.execute(context);

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('targets');
    });
  });

  describe('Performance', () => {
    it('should execute pipeline efficiently', async () => {
      const simpleAction = {
        id: 'test:simple',
        name: 'Simple',
        description: 'Simple action',
        targets: 'test:simple_targets',
        template: 'do {target}',
      };

      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['item_001'] },
      });

      const item = testBed.createEntity('item_001', {
        'core:item': { name: 'Test Item' },
      });

      testBed.registerScope(
        'test:simple_targets',
        'actor.core:inventory.items[]'
      );

      const context = {
        actionDef: simpleAction,
        actor: player,
        actionContext: { location: null },
      };

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await pipeline.execute(context);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(50); // < 50ms average
    });
  });
});
```

### Step 6: Update ActionCandidateProcessor Registration

Update the ActionCandidateProcessor registration to use the new pipeline:

```javascript
// In actionRegistrations.js
container.register(tokens.IActionCandidateProcessor, ActionCandidateProcessor, {
  dependencies: [
    ACTION_TOKENS.IActionPipeline, // Use pipeline instead of individual services
    tokens.IEntityManager,
    tokens.IActionCommandFormatter,
    tokens.ISafeEventDispatcher,
    'getEntityDisplayNameFn',
    tokens.ILogger,
    tokens.IActionErrorContextBuilder,
  ],
});
```

## Testing Strategy

### Unit Tests

1. Pipeline stage ordering validation
2. Stage execution flow
3. Error handling and propagation
4. Context data flow between stages
5. Factory creation methods

### Integration Tests

1. Full pipeline execution with real actions
2. Legacy action compatibility
3. Multi-target action processing
4. Context-dependent actions
5. Performance benchmarking

### Regression Tests

1. Verify existing single-target actions work
2. Check all error scenarios still work
3. Validate trace logging continues working
4. Ensure dependency injection works

## Acceptance Criteria

1. ✅ Pipeline uses MultiTargetResolutionStage instead of TargetResolutionStage
2. ✅ All pipeline stages execute in correct order
3. ✅ Context data flows properly between stages
4. ✅ Legacy single-target actions continue working
5. ✅ Multi-target actions process correctly
6. ✅ Error handling works for all stage types
7. ✅ Pipeline factory creates configured pipelines
8. ✅ Dependency injection registration updated
9. ✅ Performance targets met (<50ms for simple actions)
10. ✅ All integration tests pass

## Migration Notes

### Breaking Changes

- Replace TargetResolutionStage with MultiTargetResolutionStage
- Update dependency injection registrations
- Pipeline factory required for complex configurations

### Backward Compatibility

- Existing ActionCandidateProcessor interface maintained
- Legacy action format continues working
- Error handling behavior preserved

## Performance Considerations

1. **Stage Caching**: Cache stage instances where possible
2. **Context Optimization**: Minimize context copying between stages
3. **Parallel Execution**: Consider parallel stage execution for independent operations
4. **Memory Management**: Proper cleanup of pipeline contexts

## Security Considerations

1. Validate all pipeline stage configurations
2. Ensure proper error message sanitization
3. Limit pipeline execution time to prevent DoS
4. Validate stage dependencies before execution

## Future Enhancements

1. **Conditional Stages**: Stages that execute based on action properties
2. **Parallel Stage Execution**: Independent stages running in parallel
3. **Pipeline Metrics**: Detailed performance and success metrics
4. **Custom Stage Registration**: Plugin system for custom stages
5. **Pipeline Visualization**: Tools for debugging pipeline execution
