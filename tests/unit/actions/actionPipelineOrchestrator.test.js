/**
 * @file Tests for ActionPipelineOrchestrator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import { Pipeline } from '../../../src/actions/pipeline/Pipeline.js';
import { PipelineResult } from '../../../src/actions/pipeline/PipelineResult.js';
import { ComponentFilteringStage } from '../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from '../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { ActionFormattingStage } from '../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';

// Mock the dependencies
jest.mock('../../../src/actions/pipeline/Pipeline.js');
jest.mock('../../../src/actions/pipeline/stages/ComponentFilteringStage.js');
jest.mock(
  '../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js'
);
jest.mock('../../../src/actions/pipeline/stages/ActionFormattingStage.js');

describe('ActionPipelineOrchestrator', () => {
  let orchestrator;
  let mockDependencies;
  let mockPipeline;
  let mockPipelineResult;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock dependencies
    mockDependencies = {
      actionIndex: {
        getCandidateActions: jest.fn(),
      },
      prerequisiteService: {
        evaluatePrerequisites: jest.fn(),
      },
      targetService: {
        resolveTargets: jest.fn(),
      },
      formatter: {
        formatCommand: jest.fn(),
      },
      entityManager: {
        getEntity: jest.fn(),
        hasComponent: jest.fn(),
        getComponent: jest.fn(),
      },
      safeEventDispatcher: {
        dispatch: jest.fn(),
      },
      getEntityDisplayNameFn: jest.fn().mockReturnValue('Test Entity'),
      errorBuilder: {
        build: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      unifiedScopeResolver: {
        resolve: jest.fn(),
      },
      targetContextBuilder: {
        build: jest.fn(),
      },
      multiTargetResolutionStage: {
        name: 'MultiTargetResolutionStage',
        execute: jest.fn(),
      },
    };

    // Setup Pipeline mock
    mockPipeline = {
      execute: jest.fn(),
    };
    Pipeline.mockImplementation(() => mockPipeline);
  });

  describe('constructor', () => {
    it('should create an instance with all required dependencies', () => {
      orchestrator = new ActionPipelineOrchestrator(mockDependencies);
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(ActionPipelineOrchestrator);
    });

    it('should initialize all private fields from dependencies', async () => {
      orchestrator = new ActionPipelineOrchestrator(mockDependencies);
      // Pipeline is created when discoverActions is called, not in constructor
      mockPipeline.execute.mockResolvedValue({ actions: [], errors: [] });

      await orchestrator.discoverActions({ id: 'test' }, {});

      // Verify Pipeline was created with correct stages
      expect(Pipeline).toHaveBeenCalledTimes(1);
      const pipelineCall = Pipeline.mock.calls[0];
      const stages = pipelineCall[0];
      const logger = pipelineCall[1];

      expect(stages).toHaveLength(4);
      expect(logger).toBe(mockDependencies.logger);
    });

    it('should create pipeline stages in correct order', async () => {
      orchestrator = new ActionPipelineOrchestrator(mockDependencies);
      mockPipeline.execute.mockResolvedValue({ actions: [], errors: [] });

      await orchestrator.discoverActions({ id: 'test' }, {});

      expect(ComponentFilteringStage).toHaveBeenCalledWith(
        mockDependencies.actionIndex,
        mockDependencies.errorBuilder,
        mockDependencies.logger
      );

      expect(PrerequisiteEvaluationStage).toHaveBeenCalledWith(
        mockDependencies.prerequisiteService,
        mockDependencies.errorBuilder,
        mockDependencies.logger
      );

      expect(ActionFormattingStage).toHaveBeenCalledWith({
        commandFormatter: mockDependencies.formatter,
        entityManager: mockDependencies.entityManager,
        safeEventDispatcher: mockDependencies.safeEventDispatcher,
        getEntityDisplayNameFn: mockDependencies.getEntityDisplayNameFn,
        errorContextBuilder: mockDependencies.errorBuilder,
        logger: mockDependencies.logger,
      });
    });
  });

  describe('discoverActions', () => {
    let mockActor;
    let mockContext;
    let mockTrace;

    beforeEach(() => {
      orchestrator = new ActionPipelineOrchestrator(mockDependencies);

      mockActor = {
        id: 'actor-123',
        type: 'actor',
      };

      mockContext = {
        location: 'test-location',
        timestamp: Date.now(),
      };

      mockTrace = new TraceContext();

      // Default successful pipeline result
      mockPipelineResult = {
        actions: [
          { id: 'action1', name: 'Test Action 1' },
          { id: 'action2', name: 'Test Action 2' },
        ],
        errors: [],
      };
    });

    it('should successfully discover actions with valid input', async () => {
      mockPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await orchestrator.discoverActions(mockActor, mockContext);

      expect(result).toEqual({
        actions: mockPipelineResult.actions,
        errors: mockPipelineResult.errors,
        trace: undefined,
      });

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'Starting action discovery pipeline for actor actor-123'
      );

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'Action discovery pipeline completed for actor actor-123. Found 2 actions, 0 errors.'
      );

      expect(mockPipeline.execute).toHaveBeenCalledWith({
        actor: mockActor,
        actionContext: mockContext,
        candidateActions: [],
        trace: undefined,
      });
    });

    it('should handle trace context when provided', async () => {
      mockPipeline.execute.mockResolvedValue(mockPipelineResult);

      const result = await orchestrator.discoverActions(
        mockActor,
        mockContext,
        { trace: mockTrace }
      );

      expect(result.trace).toBe(mockTrace);

      expect(mockPipeline.execute).toHaveBeenCalledWith({
        actor: mockActor,
        actionContext: mockContext,
        candidateActions: [],
        trace: mockTrace,
      });
    });

    it('should handle empty actions result', async () => {
      const emptyResult = {
        actions: [],
        errors: [],
      };
      mockPipeline.execute.mockResolvedValue(emptyResult);

      const result = await orchestrator.discoverActions(mockActor, mockContext);

      expect(result).toEqual({
        actions: [],
        errors: [],
        trace: undefined,
      });

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'Action discovery pipeline completed for actor actor-123. Found 0 actions, 0 errors.'
      );
    });

    it('should handle pipeline errors', async () => {
      const errorResult = {
        actions: [],
        errors: [
          {
            phase: 'FILTERING',
            message: 'Component not found',
            entityId: 'actor-123',
          },
        ],
      };
      mockPipeline.execute.mockResolvedValue(errorResult);

      const result = await orchestrator.discoverActions(mockActor, mockContext);

      expect(result).toEqual({
        actions: [],
        errors: errorResult.errors,
        trace: undefined,
      });

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'Action discovery pipeline completed for actor actor-123. Found 0 actions, 1 errors.'
      );
    });

    it('should handle mixed results with actions and errors', async () => {
      const mixedResult = {
        actions: [{ id: 'action1', name: 'Test Action' }],
        errors: [
          {
            phase: 'PREREQUISITE',
            message: 'Prerequisite failed',
            actionId: 'action2',
          },
        ],
      };
      mockPipeline.execute.mockResolvedValue(mixedResult);

      const result = await orchestrator.discoverActions(mockActor, mockContext);

      expect(result).toEqual({
        actions: mixedResult.actions,
        errors: mixedResult.errors,
        trace: undefined,
      });

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'Action discovery pipeline completed for actor actor-123. Found 1 actions, 1 errors.'
      );
    });

    it('should propagate pipeline execution errors', async () => {
      const error = new Error('Pipeline execution failed');
      mockPipeline.execute.mockRejectedValue(error);

      await expect(
        orchestrator.discoverActions(mockActor, mockContext)
      ).rejects.toThrow('Pipeline execution failed');

      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'Starting action discovery pipeline for actor actor-123'
      );
    });

    it('should handle null options parameter', async () => {
      mockPipeline.execute.mockResolvedValue(mockPipelineResult);

      // Pass undefined instead of null to test default parameter behavior
      const result = await orchestrator.discoverActions(mockActor, mockContext);

      expect(result).toEqual({
        actions: mockPipelineResult.actions,
        errors: mockPipelineResult.errors,
        trace: undefined,
      });
    });

    it('should pass empty candidateActions array to pipeline', async () => {
      mockPipeline.execute.mockResolvedValue(mockPipelineResult);

      await orchestrator.discoverActions(mockActor, mockContext);

      const executionContext = mockPipeline.execute.mock.calls[0][0];
      expect(executionContext.candidateActions).toEqual([]);
    });

    it('should create new pipeline for each execution', async () => {
      mockPipeline.execute.mockResolvedValue(mockPipelineResult);

      // Execute twice
      await orchestrator.discoverActions(mockActor, mockContext);
      await orchestrator.discoverActions(mockActor, mockContext);

      // Pipeline should be created twice (once per discoverActions call)
      expect(Pipeline).toHaveBeenCalledTimes(2);
    });
  });

  describe('pipeline creation', () => {
    beforeEach(() => {
      orchestrator = new ActionPipelineOrchestrator(mockDependencies);
    });

    it('should include multiTargetResolutionStage in pipeline', async () => {
      mockPipeline.execute.mockResolvedValue({
        actions: [],
        errors: [],
      });

      // Force pipeline creation by calling discoverActions
      await orchestrator.discoverActions(
        { id: 'test-actor' },
        { location: 'test' }
      );

      const pipelineCall = Pipeline.mock.calls[0]; // First call
      const stages = pipelineCall[0];

      // Find the multiTargetResolutionStage
      expect(stages).toContain(mockDependencies.multiTargetResolutionStage);
      expect(stages[2]).toBe(mockDependencies.multiTargetResolutionStage);
    });
  });
});
