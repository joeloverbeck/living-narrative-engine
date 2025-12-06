import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';

const baseActor = { id: 'actor-integration', name: 'Integration Actor' };
const baseContext = {
  actorId: baseActor.id,
  locationId: 'integration-location',
};

/**
 *
 */
function createProcessorWithIncompleteErrorContext() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const actionErrorContextBuilder = {
    buildErrorContext: jest
      .fn()
      .mockImplementationOnce(({ error, actionDef, actorId, phase }) => ({
        actionId: actionDef.id,
        actorId,
        phase,
        error,
      }))
      .mockImplementation(({ error, actionDef, actorId, phase }) => ({
        actionId: actionDef.id,
        actorId,
        phase,
        error: error.error ?? error,
        timestamp: 987654321,
      })),
  };

  const prerequisiteEvaluationService = {
    evaluate: jest.fn(() => {
      throw new Error('actor prerequisites exploded');
    }),
  };

  const targetResolutionService = {
    resolveTargets: jest.fn(() => {
      throw new Error('target resolution should not execute');
    }),
  };

  const entityManager = {
    getEntityInstance: jest.fn(() => baseActor),
    getAllComponentTypesForEntity: jest.fn(() => []),
    getComponentData: jest.fn(() => ({})),
    hasComponent: jest.fn(() => true),
    getEntitiesWithComponent: jest.fn(() => []),
  };

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter: {
      format: jest.fn(() => {
        throw new Error('formatter should not execute');
      }),
    },
    safeEventDispatcher: { dispatch: jest.fn() },
    getEntityDisplayNameFn: jest.fn(
      (entity) => entity?.name ?? entity?.id ?? 'Unknown'
    ),
    logger,
    actionErrorContextBuilder,
  });

  return {
    processor,
    logger,
    actionErrorContextBuilder,
    prerequisiteEvaluationService,
    targetResolutionService,
  };
}

describe('ActionCandidateProcessor prerequisite error context recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rebuilds missing prerequisite error metadata before returning the result', () => {
    const {
      processor,
      logger,
      actionErrorContextBuilder,
      targetResolutionService,
    } = createProcessorWithIncompleteErrorContext();

    const actionDef = {
      id: 'integration:missing-timestamp',
      name: 'Missing Timestamp Action',
      description: 'Forces prerequisite error reconstruction',
      scope: 'integration:scope',
      prerequisites: [{ id: 'integration:requires-check' }],
    };

    const result = processor.process(actionDef, baseActor, baseContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(targetResolutionService.resolveTargets).not.toHaveBeenCalled();

    expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledTimes(
      2
    );
    const [firstCall, secondCall] =
      actionErrorContextBuilder.buildErrorContext.mock.calls;

    expect(firstCall[0]).toMatchObject({
      actionDef,
      actorId: baseActor.id,
      phase: ERROR_PHASES.VALIDATION,
    });

    expect(secondCall[0]).toMatchObject({
      actionDef,
      actorId: baseActor.id,
      phase: ERROR_PHASES.VALIDATION,
    });

    const [errorContext] = result.value.errors;
    expect(errorContext).toMatchObject({
      actionId: actionDef.id,
      actorId: baseActor.id,
      phase: ERROR_PHASES.VALIDATION,
      timestamp: 987654321,
    });
    expect(errorContext.error).toBeInstanceOf(Error);
    expect(errorContext.error.message).toBe('actor prerequisites exploded');

    expect(logger.error).toHaveBeenCalledWith(
      "Error checking prerequisites for action 'integration:missing-timestamp'.",
      expect.objectContaining({ actionId: actionDef.id })
    );
  });
});
