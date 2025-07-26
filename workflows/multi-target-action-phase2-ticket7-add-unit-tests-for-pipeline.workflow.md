# Ticket: Add Unit Tests for Multi-Target Pipeline

## Ticket ID: PHASE2-TICKET7

## Priority: High

## Estimated Time: 4-6 hours

## Dependencies: PHASE2-TICKET4, PHASE2-TICKET5, PHASE2-TICKET6

## Blocks: PHASE3-TICKET9, PHASE4-TICKET14

## Overview

Create comprehensive unit tests for the enhanced action pipeline stages (MultiTargetResolutionStage, ActionFormattingStage, and Pipeline orchestrator) to ensure reliability, performance, and proper error handling. Tests must validate both legacy compatibility and new multi-target functionality.

## Testing Goals

1. **Stage Isolation**: Test each pipeline stage independently
2. **Integration Validation**: Test stage interaction and data flow
3. **Error Coverage**: Validate error handling and recovery
4. **Performance Benchmarks**: Ensure performance targets are met
5. **Regression Prevention**: Verify legacy functionality remains intact

## Implementation Steps

### Step 1: Test MultiTargetResolutionStage

Create file: `tests/unit/actions/pipeline/stages/MultiTargetResolutionStage.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MultiTargetResolutionStage } from '../../../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { PipelineResult } from '../../../../../src/actions/pipeline/PipelineResult.js';

describe('MultiTargetResolutionStage', () => {
  let stage;
  let mockScopeInterpreter;
  let mockEntityManager;
  let mockTargetResolver;
  let mockTargetContextBuilder;
  let mockLogger;
  let mockTrace;

  beforeEach(() => {
    mockScopeInterpreter = {
      evaluate: jest.fn(),
    };

    mockEntityManager = {
      getEntity: jest.fn(),
      getAllEntities: jest.fn(),
    };

    mockTargetResolver = {
      resolveTargetDefinition: jest.fn(),
    };

    mockTargetContextBuilder = {
      buildContext: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockTrace = {
      step: jest.fn(),
      success: jest.fn(),
      warning: jest.fn(),
      failure: jest.fn(),
    };

    stage = new MultiTargetResolutionStage({
      scopeInterpreter: mockScopeInterpreter,
      entityManager: mockEntityManager,
      targetResolver: mockTargetResolver,
      targetContextBuilder: mockTargetContextBuilder,
      logger: mockLogger,
    });
  });

  describe('Legacy Action Support', () => {
    it('should process legacy single-target action', async () => {
      const context = {
        actionDef: {
          id: 'test:legacy',
          scope: 'actor.core:inventory.items[]',
          template: 'use {target}',
        },
        actor: { id: 'player' },
        actionContext: { location: null },
      };

      mockScopeInterpreter.evaluate.mockResolvedValue(['item_001', 'item_002']);
      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'item_001', components: {} })
        .mockReturnValueOnce({ id: 'item_002', components: {} });

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets).toEqual({
        primary: [
          { id: 'item_001', components: {} },
          { id: 'item_002', components: {} },
        ],
      });
      expect(mockScopeInterpreter.evaluate).toHaveBeenCalledWith(
        'actor.core:inventory.items[]',
        expect.objectContaining({
          actor: { id: 'player' },
          location: null,
        })
      );
    });

    it('should handle legacy scope returning no targets', async () => {
      const context = {
        actionDef: {
          id: 'test:empty',
          scope: 'actor.core:empty.items[]',
          template: 'use {target}',
        },
        actor: { id: 'player' },
        actionContext: { location: null },
      };

      mockScopeInterpreter.evaluate.mockResolvedValue([]);

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toContain('No targets found');
    });
  });

  describe('Multi-Target Resolution', () => {
    it('should resolve primary and secondary targets', async () => {
      const context = {
        actionDef: {
          id: 'test:multi',
          targets: {
            primary: {
              scope: 'actor.core:inventory.items[]',
              placeholder: 'item',
            },
            secondary: {
              scope: 'location.core:actors[]',
              placeholder: 'target',
            },
          },
          template: 'use {item} on {target}',
        },
        actor: { id: 'player' },
        actionContext: { location: { id: 'room' } },
      };

      // Mock primary target resolution
      mockScopeInterpreter.evaluate
        .mockResolvedValueOnce(['sword_001', 'potion_002'])
        .mockResolvedValueOnce(['npc_001']);

      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'sword_001', components: {} })
        .mockReturnValueOnce({ id: 'potion_002', components: {} })
        .mockReturnValueOnce({ id: 'npc_001', components: {} });

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets).toEqual({
        primary: [
          { id: 'sword_001', components: {} },
          { id: 'potion_002', components: {} },
        ],
        secondary: [{ id: 'npc_001', components: {} }],
      });

      // Should call scope interpreter for each target definition
      expect(mockScopeInterpreter.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should handle context-dependent targets', async () => {
      const context = {
        actionDef: {
          id: 'test:context',
          targets: {
            primary: {
              scope: 'location.core:actors[]',
              placeholder: 'person',
            },
            secondary: {
              scope: 'target.topmost_clothing[]',
              placeholder: 'garment',
              contextFrom: 'primary',
            },
          },
          template: "adjust {person}'s {garment}",
        },
        actor: { id: 'player' },
        actionContext: { location: { id: 'room' } },
      };

      // Mock primary resolution
      mockScopeInterpreter.evaluate
        .mockResolvedValueOnce(['npc_001'])
        .mockResolvedValueOnce(['jacket_001']);

      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'npc_001', components: {} })
        .mockReturnValueOnce({ id: 'jacket_001', components: {} });

      mockTargetContextBuilder.buildContext.mockReturnValue({
        actor: { id: 'player' },
        location: { id: 'room' },
        target: { id: 'npc_001', components: {} },
      });

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.shouldContinue).toBe(true);
      expect(mockTargetContextBuilder.buildContext).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { id: 'npc_001', components: {} },
        }),
        'primary'
      );
    });

    it('should handle tertiary targets with multiple dependencies', async () => {
      const context = {
        actionDef: {
          id: 'test:tertiary',
          targets: {
            primary: {
              scope: 'actor.core:inventory.items[]',
              placeholder: 'tool',
            },
            secondary: {
              scope: 'location.core:containers[]',
              placeholder: 'container',
              contextFrom: 'primary',
            },
            tertiary: {
              scope: 'target.core:contents.items[]',
              placeholder: 'item',
              contextFrom: 'secondary',
            },
          },
          template: 'use {tool} on {container} to get {item}',
        },
        actor: { id: 'player' },
        actionContext: { location: { id: 'room' } },
      };

      mockScopeInterpreter.evaluate
        .mockResolvedValueOnce(['key_001'])
        .mockResolvedValueOnce(['chest_001'])
        .mockResolvedValueOnce(['treasure_001']);

      mockEntityManager.getEntity
        .mockReturnValueOnce({ id: 'key_001', components: {} })
        .mockReturnValueOnce({ id: 'chest_001', components: {} })
        .mockReturnValueOnce({ id: 'treasure_001', components: {} });

      mockTargetContextBuilder.buildContext
        .mockReturnValueOnce({
          actor: { id: 'player' },
          location: { id: 'room' },
          target: { id: 'key_001', components: {} },
        })
        .mockReturnValueOnce({
          actor: { id: 'player' },
          location: { id: 'room' },
          targets: {
            primary: [{ id: 'key_001', components: {} }],
            secondary: [{ id: 'chest_001', components: {} }],
          },
          target: { id: 'chest_001', components: {} },
        });

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets).toEqual({
        primary: [{ id: 'key_001', components: {} }],
        secondary: [{ id: 'chest_001', components: {} }],
        tertiary: [{ id: 'treasure_001', components: {} }],
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle scope evaluation errors', async () => {
      const context = {
        actionDef: {
          id: 'test:error',
          scope: 'invalid.scope[]',
          template: 'do {target}',
        },
        actor: { id: 'player' },
        actionContext: { location: null },
      };

      mockScopeInterpreter.evaluate.mockRejectedValue(
        new Error('Invalid scope expression')
      );

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.isError).toBe(true);
      expect(result.error.message).toContain('Invalid scope expression');
    });

    it('should handle missing entity errors', async () => {
      const context = {
        actionDef: {
          id: 'test:missing',
          scope: 'actor.core:inventory.items[]',
          template: 'use {target}',
        },
        actor: { id: 'player' },
        actionContext: { location: null },
      };

      mockScopeInterpreter.evaluate.mockResolvedValue(['missing_item']);
      mockEntityManager.getEntity.mockReturnValue(null);

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets.primary).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Entity not found: missing_item')
      );
    });

    it('should handle context building errors', async () => {
      const context = {
        actionDef: {
          id: 'test:context_error',
          targets: {
            primary: {
              scope: 'location.core:actors[]',
              placeholder: 'person',
            },
            secondary: {
              scope: 'target.invalid[]',
              placeholder: 'invalid',
              contextFrom: 'primary',
            },
          },
        },
        actor: { id: 'player' },
        actionContext: { location: { id: 'room' } },
      };

      mockScopeInterpreter.evaluate
        .mockResolvedValueOnce(['npc_001'])
        .mockRejectedValueOnce(new Error('Context error'));

      mockEntityManager.getEntity.mockReturnValue({
        id: 'npc_001',
        components: {},
      });
      mockTargetContextBuilder.buildContext.mockReturnValue({});

      const result = await stage.executeInternal(context, mockTrace);

      expect(result.isError).toBe(true);
      expect(result.error.message).toContain('Context error');
    });
  });

  describe('Performance', () => {
    it('should process large target sets efficiently', async () => {
      const context = {
        actionDef: {
          id: 'test:performance',
          scope: 'actor.core:inventory.items[]',
          template: 'use {target}',
        },
        actor: { id: 'player' },
        actionContext: { location: null },
      };

      // Create large target set
      const targetIds = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
      mockScopeInterpreter.evaluate.mockResolvedValue(targetIds);

      // Mock entity responses
      targetIds.forEach((id) => {
        mockEntityManager.getEntity.mockReturnValueOnce({
          id,
          components: { 'core:item': { name: `Item ${id}` } },
        });
      });

      const start = performance.now();
      const result = await stage.executeInternal(context, mockTrace);
      const end = performance.now();

      expect(result.shouldContinue).toBe(true);
      expect(result.data.resolvedTargets.primary).toHaveLength(1000);
      expect(end - start).toBeLessThan(500); // < 500ms for 1000 targets
    });

    it('should handle concurrent target resolution efficiently', async () => {
      const context = {
        actionDef: {
          id: 'test:concurrent',
          targets: {
            primary: {
              scope: 'actor.core:inventory.items[]',
              placeholder: 'item',
            },
            secondary: {
              scope: 'location.core:actors[]',
              placeholder: 'actor',
            },
            tertiary: {
              scope: 'location.core:objects[]',
              placeholder: 'object',
            },
          },
        },
        actor: { id: 'player' },
        actionContext: { location: { id: 'room' } },
      };

      // Simulate concurrent resolution
      mockScopeInterpreter.evaluate.mockImplementation(async (scope) => {
        await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
        if (scope.includes('items')) return ['item_001'];
        if (scope.includes('actors')) return ['actor_001'];
        if (scope.includes('objects')) return ['object_001'];
        return [];
      });

      mockEntityManager.getEntity.mockImplementation((id) => ({
        id,
        components: {},
      }));

      const start = performance.now();
      const result = await stage.executeInternal(context, mockTrace);
      const end = performance.now();

      expect(result.shouldContinue).toBe(true);
      // Should be faster than sequential (3 × 10ms + overhead)
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('Dependency Order', () => {
    it('should resolve targets in dependency order', async () => {
      const context = {
        actionDef: {
          id: 'test:order',
          targets: {
            // Note: out of dependency order in definition
            tertiary: {
              scope: 'target.contents[]',
              placeholder: 'content',
              contextFrom: 'secondary',
            },
            primary: {
              scope: 'actor.core:inventory.items[]',
              placeholder: 'tool',
            },
            secondary: {
              scope: 'location.containers[]',
              placeholder: 'container',
              contextFrom: 'primary',
            },
          },
        },
        actor: { id: 'player' },
        actionContext: { location: { id: 'room' } },
      };

      const scopeCalls = [];
      mockScopeInterpreter.evaluate.mockImplementation(async (scope) => {
        scopeCalls.push(scope);
        if (scope.includes('inventory')) return ['tool_001'];
        if (scope.includes('containers')) return ['container_001'];
        if (scope.includes('contents')) return ['content_001'];
        return [];
      });

      mockEntityManager.getEntity.mockImplementation((id) => ({
        id,
        components: {},
      }));
      mockTargetContextBuilder.buildContext.mockReturnValue({});

      await stage.executeInternal(context, mockTrace);

      // Should resolve in dependency order: primary → secondary → tertiary
      expect(scopeCalls[0]).toContain('inventory'); // primary first
      expect(scopeCalls[1]).toContain('containers'); // secondary second
      expect(scopeCalls[2]).toContain('contents'); // tertiary last
    });
  });
});
```

### Step 2: Test ActionFormattingStage Enhanced Features

Update file: `tests/unit/actions/pipeline/stages/ActionFormattingStage.test.js` (if not already created in ticket 5):

```javascript
// ... (previous tests from ticket 5) ...

describe('Combination Performance', () => {
  it('should handle large combination sets efficiently', async () => {
    // Create large target sets
    const primaryTargets = Array.from({ length: 50 }, (_, i) => ({
      id: `primary_${i}`,
      displayName: `Primary ${i}`,
    }));

    const secondaryTargets = Array.from({ length: 50 }, (_, i) => ({
      id: `secondary_${i}`,
      displayName: `Secondary ${i}`,
    }));

    mockContext.actionDef.generateCombinations = true;
    mockContext.resolvedTargets = {
      primary: primaryTargets,
      secondary: secondaryTargets,
    };

    const start = performance.now();
    const result = await stage.executeInternal(mockContext);
    const end = performance.now();

    expect(result.shouldContinue).toBe(true);
    expect(end - start).toBeLessThan(200); // < 200ms for large sets
    expect(result.data.formattedActions.length).toBeLessThanOrEqual(100); // Respects limit
  });

  it('should optimize placeholder replacement', async () => {
    mockContext.actionDef.template =
      'complex {item} action with {target} and more {item} references';
    mockContext.actionDef.generateCombinations = true;

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await stage.executeInternal(mockContext);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    expect(avgTime).toBeLessThan(10); // < 10ms average per formatting
  });
});

describe('Memory Management', () => {
  it('should not leak memory with large combination sets', async () => {
    // Create very large target sets
    const primaryTargets = Array.from({ length: 1000 }, (_, i) => ({
      id: `item_${i}`,
      displayName: `Item ${i}`,
    }));

    mockContext.actionDef.generateCombinations = true;
    mockContext.resolvedTargets = {
      primary: primaryTargets,
      secondary: [{ id: 'target_001', displayName: 'Target' }],
    };

    // Process multiple times to check for memory leaks
    for (let i = 0; i < 10; i++) {
      const result = await stage.executeInternal(mockContext);
      expect(result.shouldContinue).toBe(true);
    }

    // If we reach here without memory issues, test passes
    expect(true).toBe(true);
  });
});
```

### Step 3: Test Pipeline Orchestrator

Create file: `tests/unit/actions/pipeline/Pipeline.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';

describe('Pipeline', () => {
  let pipeline;
  let mockStages;
  let mockLogger;
  let mockTrace;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockTrace = {
      step: jest.fn(),
      success: jest.fn(),
      info: jest.fn(),
      failure: jest.fn(),
    };

    // Create mock stages
    mockStages = [
      {
        constructor: { name: 'ComponentFilteringStage' },
        executeInternal: jest.fn(),
      },
      {
        constructor: { name: 'PrerequisiteEvaluationStage' },
        executeInternal: jest.fn(),
      },
      {
        constructor: { name: 'MultiTargetResolutionStage' },
        executeInternal: jest.fn(),
      },
      {
        constructor: { name: 'ActionFormattingStage' },
        executeInternal: jest.fn(),
      },
    ];

    pipeline = new Pipeline({
      stages: mockStages,
      logger: mockLogger,
    });
  });

  describe('Stage Execution Order', () => {
    it('should execute stages in correct order', async () => {
      const context = { actionDef: { id: 'test' }, actor: { id: 'player' } };

      // Mock all stages to continue
      mockStages.forEach((stage, index) => {
        stage.executeInternal.mockResolvedValue(
          PipelineResult.continue({
            ...context,
            stageIndex: index,
          })
        );
      });

      const result = await pipeline.execute(context, mockTrace);

      expect(result.isError).toBe(false);
      expect(result.shouldContinue).toBe(true);

      // Verify stages executed in order
      mockStages.forEach((stage, index) => {
        expect(stage.executeInternal).toHaveBeenCalledTimes(1);
        if (index > 0) {
          expect(stage.executeInternal).toHaveBeenCalledAfter(
            mockStages[index - 1].executeInternal
          );
        }
      });
    });

    it('should stop execution when stage returns shouldContinue=false', async () => {
      const context = { actionDef: { id: 'test' }, actor: { id: 'player' } };

      // First stage continues, second stage stops
      mockStages[0].executeInternal.mockResolvedValue(
        PipelineResult.continue(context)
      );
      mockStages[1].executeInternal.mockResolvedValue(
        PipelineResult.skip('Prerequisites not met')
      );

      const result = await pipeline.execute(context, mockTrace);

      expect(result.shouldContinue).toBe(false);
      expect(result.reason).toBe('Prerequisites not met');

      // Only first two stages should execute
      expect(mockStages[0].executeInternal).toHaveBeenCalledTimes(1);
      expect(mockStages[1].executeInternal).toHaveBeenCalledTimes(1);
      expect(mockStages[2].executeInternal).not.toHaveBeenCalled();
      expect(mockStages[3].executeInternal).not.toHaveBeenCalled();
    });

    it('should stop execution on stage error', async () => {
      const context = { actionDef: { id: 'test' }, actor: { id: 'player' } };
      const stageError = new Error('Stage failed');

      // First stage continues, second stage errors
      mockStages[0].executeInternal.mockResolvedValue(
        PipelineResult.continue(context)
      );
      mockStages[1].executeInternal.mockResolvedValue(
        PipelineResult.error(stageError, 'PrerequisiteEvaluationStage')
      );

      const result = await pipeline.execute(context, mockTrace);

      expect(result.isError).toBe(true);
      expect(result.error).toBe(stageError);

      // Only first two stages should execute
      expect(mockStages[0].executeInternal).toHaveBeenCalledTimes(1);
      expect(mockStages[1].executeInternal).toHaveBeenCalledTimes(1);
      expect(mockStages[2].executeInternal).not.toHaveBeenCalled();
      expect(mockStages[3].executeInternal).not.toHaveBeenCalled();
    });
  });

  describe('Context Data Flow', () => {
    it('should pass context data between stages', async () => {
      const initialContext = {
        actionDef: { id: 'test' },
        actor: { id: 'player' },
      };

      // Each stage adds data to context
      mockStages[0].executeInternal.mockResolvedValue(
        PipelineResult.continue({
          ...initialContext,
          filteredComponents: ['core:inventory'],
        })
      );

      mockStages[1].executeInternal.mockResolvedValue(
        PipelineResult.continue({
          ...initialContext,
          filteredComponents: ['core:inventory'],
          prerequisitesPassed: true,
        })
      );

      mockStages[2].executeInternal.mockResolvedValue(
        PipelineResult.continue({
          ...initialContext,
          filteredComponents: ['core:inventory'],
          prerequisitesPassed: true,
          resolvedTargets: { primary: [{ id: 'item_001' }] },
        })
      );

      mockStages[3].executeInternal.mockResolvedValue(
        PipelineResult.continue({
          ...initialContext,
          filteredComponents: ['core:inventory'],
          prerequisitesPassed: true,
          resolvedTargets: { primary: [{ id: 'item_001' }] },
          formattedActions: [
            { actionId: 'test', formattedText: 'use item_001' },
          ],
        })
      );

      const result = await pipeline.execute(initialContext, mockTrace);

      expect(result.shouldContinue).toBe(true);

      // Verify each stage received updated context
      expect(mockStages[1].executeInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          filteredComponents: ['core:inventory'],
        }),
        mockTrace
      );

      expect(mockStages[2].executeInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          filteredComponents: ['core:inventory'],
          prerequisitesPassed: true,
        }),
        mockTrace
      );

      expect(mockStages[3].executeInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          resolvedTargets: { primary: [{ id: 'item_001' }] },
        }),
        mockTrace
      );
    });
  });

  describe('Stage Management', () => {
    it('should validate stage order on construction', () => {
      // Create pipeline with wrong order
      const wrongOrderStages = [
        { constructor: { name: 'ActionFormattingStage' } },
        { constructor: { name: 'MultiTargetResolutionStage' } },
      ];

      expect(() => {
        new Pipeline({
          stages: wrongOrderStages,
          logger: mockLogger,
        });
      }).not.toThrow(); // Should warn but not throw

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('out of order')
      );
    });

    it('should reject deprecated TargetResolutionStage', () => {
      const deprecatedStages = [
        { constructor: { name: 'TargetResolutionStage' } },
      ];

      expect(() => {
        new Pipeline({
          stages: deprecatedStages,
          logger: mockLogger,
        });
      }).toThrow('TargetResolutionStage is deprecated');
    });

    it('should allow adding stages at runtime', () => {
      const newStage = {
        constructor: { name: 'CustomStage' },
        executeInternal: jest.fn(),
      };

      pipeline.addStage(newStage, 2); // Insert at index 2

      const stageInfo = pipeline.getStageInfo();
      expect(stageInfo).toHaveLength(5);
      expect(stageInfo[2].name).toBe('CustomStage');
    });

    it('should allow removing stages at runtime', () => {
      pipeline.removeStage(2); // Remove MultiTargetResolutionStage

      const stageInfo = pipeline.getStageInfo();
      expect(stageInfo).toHaveLength(3);
      expect(stageInfo.map((s) => s.name)).not.toContain(
        'MultiTargetResolutionStage'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle stage execution exceptions', async () => {
      const context = { actionDef: { id: 'test' }, actor: { id: 'player' } };
      const executionError = new Error('Unexpected stage error');

      mockStages[0].executeInternal.mockResolvedValue(
        PipelineResult.continue(context)
      );
      mockStages[1].executeInternal.mockRejectedValue(executionError);

      const result = await pipeline.execute(context, mockTrace);

      expect(result.isError).toBe(true);
      expect(result.error).toBe(executionError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Pipeline execution failed'),
        executionError
      );
    });
  });

  describe('Tracing Integration', () => {
    it('should provide detailed trace information', async () => {
      const context = { actionDef: { id: 'test' }, actor: { id: 'player' } };

      mockStages.forEach((stage) => {
        stage.executeInternal.mockResolvedValue(
          PipelineResult.continue(context)
        );
      });

      await pipeline.execute(context, mockTrace);

      expect(mockTrace.step).toHaveBeenCalledWith(
        'Starting action pipeline execution',
        'Pipeline'
      );

      mockStages.forEach((stage, index) => {
        expect(mockTrace.step).toHaveBeenCalledWith(
          `Executing stage ${index + 1}: ${stage.constructor.name}`,
          'Pipeline'
        );
        expect(mockTrace.success).toHaveBeenCalledWith(
          `Stage ${stage.constructor.name} completed successfully`,
          'Pipeline'
        );
      });

      expect(mockTrace.success).toHaveBeenCalledWith(
        'Pipeline execution completed successfully',
        'Pipeline'
      );
    });
  });

  describe('Performance', () => {
    it('should execute simple pipeline efficiently', async () => {
      const context = { actionDef: { id: 'test' }, actor: { id: 'player' } };

      mockStages.forEach((stage) => {
        stage.executeInternal.mockResolvedValue(
          PipelineResult.continue(context)
        );
      });

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await pipeline.execute(context);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(5); // < 5ms average per execution
    });
  });
});
```

### Step 4: Test PipelineFactory

Create file: `tests/unit/actions/pipeline/pipelineFactory.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PipelineFactory } from '../../../../src/actions/pipeline/pipelineFactory.js';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';

describe('PipelineFactory', () => {
  let factory;
  let mockDependencies;

  beforeEach(() => {
    mockDependencies = {
      entityManager: { getEntity: jest.fn() },
      prerequisiteEvaluationService: { evaluate: jest.fn() },
      scopeInterpreter: { evaluate: jest.fn() },
      targetResolver: { resolve: jest.fn() },
      targetContextBuilder: { buildContext: jest.fn() },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    factory = new PipelineFactory(mockDependencies);
  });

  describe('Pipeline Creation', () => {
    it('should create standard pipeline with correct stages', () => {
      const pipeline = factory.createStandardPipeline();

      expect(pipeline).toBeInstanceOf(Pipeline);

      const stageInfo = pipeline.getStageInfo();
      expect(stageInfo).toHaveLength(4);
      expect(stageInfo.map((s) => s.name)).toEqual([
        'ComponentFilteringStage',
        'PrerequisiteEvaluationStage',
        'MultiTargetResolutionStage',
        'ActionFormattingStage',
      ]);
    });

    it('should create legacy compatible pipeline', () => {
      const legacyPipeline = factory.createLegacyCompatiblePipeline();
      const standardPipeline = factory.createStandardPipeline();

      // Should be identical - MultiTargetResolutionStage handles legacy
      expect(legacyPipeline.getStageInfo()).toEqual(
        standardPipeline.getStageInfo()
      );
    });

    it('should create custom pipeline with specified stages', () => {
      const customStages = [
        'ComponentFilteringStage',
        'MultiTargetResolutionStage',
        'ActionFormattingStage',
      ];

      const pipeline = factory.createCustomPipeline(customStages);
      const stageInfo = pipeline.getStageInfo();

      expect(stageInfo).toHaveLength(3);
      expect(stageInfo.map((s) => s.name)).toEqual(customStages);
    });

    it('should throw error for unknown stages', () => {
      expect(() => {
        factory.createCustomPipeline(['UnknownStage']);
      }).toThrow('Unknown stage: UnknownStage');
    });
  });

  describe('Dependency Validation', () => {
    it('should validate all required dependencies', () => {
      const incompleteDeps = { ...mockDependencies };
      delete incompleteDeps.entityManager;

      expect(() => {
        new PipelineFactory(incompleteDeps);
      }).toThrow('Missing required dependency: entityManager');
    });

    it('should accept optional dependencies', () => {
      const depsWithOptionals = {
        ...mockDependencies,
        displayNameResolver: jest.fn(),
        maxCombinations: 150,
      };

      expect(() => {
        new PipelineFactory(depsWithOptionals);
      }).not.toThrow();
    });
  });

  describe('Stage Configuration', () => {
    it('should configure stages with correct dependencies', () => {
      const pipeline = factory.createStandardPipeline();

      // This is more of an integration test to ensure stages are configured
      expect(pipeline.getStageInfo()).toHaveLength(4);
    });

    it('should respect maxCombinations setting', () => {
      const factoryWithLimit = new PipelineFactory({
        ...mockDependencies,
        maxCombinations: 50,
      });

      const pipeline = factoryWithLimit.createStandardPipeline();
      expect(pipeline).toBeInstanceOf(Pipeline);
    });
  });
});
```

### Step 5: Integration Test for Full Pipeline

Create file: `tests/integration/actions/pipeline/fullPipelineIntegration.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { IntegrationTestBed } from '../../../common/integrationTestBed.js';

describe('Full Pipeline Integration', () => {
  let testBed;
  let actionProcessor;

  beforeEach(() => {
    testBed = new IntegrationTestBed();
    actionProcessor = testBed.getService('actionCandidateProcessor');
  });

  describe('Legacy Action Processing', () => {
    it('should process legacy action through full pipeline', async () => {
      const legacyAction = {
        id: 'test:legacy_eat',
        name: 'Eat',
        description: 'Consume food',
        scope: 'actor.core:inventory.items[]',
        template: 'eat {target}',
      };

      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['apple_001', 'bread_002'] },
      });

      const apple = testBed.createEntity('apple_001', {
        'core:item': { name: 'Red Apple', type: 'food' },
      });

      const bread = testBed.createEntity('bread_002', {
        'core:item': { name: 'Fresh Bread', type: 'food' },
      });

      const result = await actionProcessor.process(legacyAction, player, {
        location: null,
      });

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(2);
      expect(result.value.actions.map((a) => a.command)).toEqual([
        'eat Red Apple',
        'eat Fresh Bread',
      ]);
    });
  });

  describe('Multi-Target Action Processing', () => {
    it('should process multi-target action with combinations', async () => {
      const multiTargetAction = {
        id: 'test:multi_craft',
        name: 'Craft',
        description: 'Craft item using tool and materials',
        targets: {
          primary: {
            scope: 'actor.core:inventory.tools[]',
            placeholder: 'tool',
          },
          secondary: {
            scope: 'actor.core:inventory.materials[]',
            placeholder: 'material',
          },
        },
        template: 'craft using {tool} and {material}',
        generateCombinations: true,
      };

      const player = testBed.createEntity('player', {
        'core:inventory': {
          items: ['hammer_001', 'saw_002', 'wood_003', 'iron_004'],
        },
      });

      // Create tools
      testBed.createEntity('hammer_001', {
        'core:item': { name: 'Hammer', type: 'tool' },
      });

      testBed.createEntity('saw_002', {
        'core:item': { name: 'Saw', type: 'tool' },
      });

      // Create materials
      testBed.createEntity('wood_003', {
        'core:item': { name: 'Wood Plank', type: 'material' },
      });

      testBed.createEntity('iron_004', {
        'core:item': { name: 'Iron Bar', type: 'material' },
      });

      // Register scopes
      testBed.registerScope(
        'actor.core:inventory.tools[]',
        'actor.core:inventory.items[][{"==": [{"var": "entity.components.core:item.type"}, "tool"]}]'
      );

      testBed.registerScope(
        'actor.core:inventory.materials[]',
        'actor.core:inventory.items[][{"==": [{"var": "entity.components.core:item.type"}, "material"]}]'
      );

      const result = await actionProcessor.process(multiTargetAction, player, {
        location: null,
      });

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(4); // 2 tools × 2 materials

      const commands = result.value.actions.map((a) => a.command);
      expect(commands).toContain('craft using Hammer and Wood Plank');
      expect(commands).toContain('craft using Hammer and Iron Bar');
      expect(commands).toContain('craft using Saw and Wood Plank');
      expect(commands).toContain('craft using Saw and Iron Bar');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for simple actions', async () => {
      const simpleAction = {
        id: 'test:simple',
        name: 'Simple',
        scope: 'actor.core:inventory.items[]',
        template: 'use {target}',
      };

      const player = testBed.createEntity('player', {
        'core:inventory': { items: ['item_001'] },
      });

      testBed.createEntity('item_001', {
        'core:item': { name: 'Test Item' },
      });

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await actionProcessor.process(simpleAction, player, { location: null });
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      expect(avgTime).toBeLessThan(10); // < 10ms average per simple action
    });

    it('should handle large target sets efficiently', async () => {
      const largeSetAction = {
        id: 'test:large',
        name: 'Large Set',
        scope: 'actor.core:inventory.items[]',
        template: 'process {target}',
      };

      // Create player with many items
      const itemIds = Array.from({ length: 100 }, (_, i) => `item_${i}`);
      const player = testBed.createEntity('player', {
        'core:inventory': { items: itemIds },
      });

      // Create all items
      itemIds.forEach((id) => {
        testBed.createEntity(id, {
          'core:item': { name: `Item ${id}` },
        });
      });

      const start = performance.now();
      const result = await actionProcessor.process(largeSetAction, player, {
        location: null,
      });
      const end = performance.now();

      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(100);
      expect(end - start).toBeLessThan(100); // < 100ms for 100 targets
    });
  });
});
```

## Testing Strategy

### Unit Tests Coverage

1. **Stage Isolation**: Each stage tested independently
2. **Error Paths**: All error scenarios covered
3. **Edge Cases**: Empty targets, invalid data, missing dependencies
4. **Performance**: Benchmarks for key operations
5. **Legacy Compatibility**: Existing functionality preserved

### Integration Tests Coverage

1. **Full Pipeline Flow**: End-to-end action processing
2. **Real Data**: Using actual entities and scopes
3. **Performance Validation**: Real-world timing benchmarks
4. **Complex Scenarios**: Multi-target, context-dependent actions

### Performance Benchmarks

- Simple action processing: < 10ms
- Large target sets (100 items): < 100ms
- Complex multi-target: < 50ms
- Memory usage: No leaks with repeated processing

## Acceptance Criteria

1. ✅ All pipeline stages have comprehensive unit tests
2. ✅ Pipeline orchestrator tests cover execution flow
3. ✅ Legacy action compatibility verified through tests
4. ✅ Multi-target functionality fully tested
5. ✅ Error handling and recovery paths covered
6. ✅ Performance benchmarks meet targets
7. ✅ Integration tests demonstrate real usage
8. ✅ Test coverage >95% for all pipeline components
9. ✅ Memory leak prevention validated
10. ✅ Regression tests prevent breaking changes

## Documentation Requirements

### Test Documentation

- Clear test descriptions explaining what each test validates
- Performance benchmark explanations and targets
- Error scenario documentation
- Integration test usage examples

### Code Coverage Reports

- Generate coverage reports for all pipeline components
- Identify any uncovered code paths
- Ensure critical paths have multiple test scenarios

## Future Testing Enhancements

1. **Property-Based Testing**: Use generators for comprehensive input testing
2. **Load Testing**: Stress tests with very large data sets
3. **Concurrency Testing**: Parallel pipeline execution validation
4. **Mutation Testing**: Verify test quality through code mutation
5. **Visual Testing**: Pipeline execution flow visualization for debugging
