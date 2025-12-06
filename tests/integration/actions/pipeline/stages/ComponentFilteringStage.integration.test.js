/**
 * @file Integration tests for the ComponentFilteringStage.
 * @description Exercises the stage with real ActionIndex and EntityManager implementations
 *              to validate candidate filtering, trace instrumentation, and error handling.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ComponentFilteringStage } from '../../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { ActionIndex } from '../../../../../src/actions/actionIndex.js';
import SimpleEntityManager from '../../../../common/entities/simpleEntityManager.js';
import { createMockActionErrorContextBuilder } from '../../../../common/mockFactories/actions.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ComponentFilteringStage integration', () => {
  let logger;
  let errorBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createLogger();
    errorBuilder = createMockActionErrorContextBuilder();
  });

  /**
   * Builds a stage instance backed by the real ActionIndex and SimpleEntityManager.
   *
   * @param {object} options - Stage creation options.
   * @param {Array<object>} options.entities - Seed entities for the entity manager.
   * @param {Array<object>} options.actions - Action definitions to index.
   * @returns {{ stage: ComponentFilteringStage, entityManager: SimpleEntityManager, actionIndex: ActionIndex }}
   */
  function buildStage({ entities, actions }) {
    const entityManager = new SimpleEntityManager(entities);
    const actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex(actions);

    const stage = new ComponentFilteringStage(
      actionIndex,
      errorBuilder,
      logger,
      entityManager
    );

    return { stage, entityManager, actionIndex };
  }

  it('filters candidate actions and records trace analytics for action-aware traces', async () => {
    const actorId = 'actor-1';
    const { stage } = buildStage({
      entities: [
        {
          id: actorId,
          components: {
            'skill:stealth': { level: 3 },
            'status:injured': { severity: 'minor' },
          },
        },
      ],
      actions: [
        { id: 'core:rest', name: 'Rest' },
        {
          id: 'core:stealth_move',
          name: 'Stealth Move',
          required_components: { actor: ['skill:stealth'] },
        },
        {
          id: 'core:heavy_attack',
          name: 'Heavy Attack',
          required_components: { actor: ['skill:strength'] },
          forbidden_components: { actor: ['status:injured'] },
        },
      ],
    });

    const capturePayloads = [];
    const trace = {
      captureActionData: jest
        .fn()
        .mockImplementation(async (_type, _id, payload) => {
          capturePayloads.push({ type: _type, id: _id, payload });
        }),
      data: jest.fn(),
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
    };

    const result = await stage.execute({
      actor: { id: actorId },
      actionContext: { scope: 'demo' },
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(2);
    const candidateIds = result.data.candidateActions.map(
      (action) => action.id
    );
    expect(candidateIds).toEqual(['core:rest', 'core:stealth_move']);

    expect(trace.captureActionData).toHaveBeenCalledTimes(4);
    expect(trace.success).toHaveBeenCalledWith(
      'Component filtering completed: 2 candidates',
      'ComponentFilteringStage.execute',
      { candidateCount: 2 }
    );

    const [firstCall, secondCall, thirdCall, fourthCall] = capturePayloads;
    expect(firstCall).toMatchObject({
      type: 'component_filtering',
      id: 'core:rest',
      payload: {
        actorId,
        actorComponents: expect.arrayContaining([
          'skill:stealth',
          'status:injured',
        ]),
        requiredComponents: [],
        forbiddenComponents: [],
        componentMatchPassed: true,
        missingComponents: [],
        forbiddenComponentsPresent: [],
      },
    });
    expect(secondCall).toMatchObject({
      type: 'stage_performance',
      id: 'core:rest',
      payload: {
        stage: 'component_filtering',
        itemsProcessed: 2,
        stageName: 'ComponentFiltering',
      },
    });
    expect(thirdCall).toMatchObject({
      type: 'component_filtering',
      id: 'core:stealth_move',
      payload: {
        requiredComponents: ['skill:stealth'],
        forbiddenComponents: [],
        componentMatchPassed: true,
        missingComponents: [],
        forbiddenComponentsPresent: [],
      },
    });
    expect(fourthCall.type).toBe('stage_performance');
    expect(logger.debug).toHaveBeenCalledWith(
      'Found 2 candidate actions for actor actor-1'
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('halts further processing when no candidate actions are discovered', async () => {
    const actorId = 'actor-2';
    const { stage } = buildStage({
      entities: [
        {
          id: actorId,
          components: {},
        },
      ],
      actions: [
        {
          id: 'core:stealth_move',
          required_components: { actor: ['skill:stealth'] },
        },
      ],
    });

    const trace = {
      data: jest.fn(),
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
    };

    const result = await stage.execute({
      actor: { id: actorId },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toEqual([]);
    expect(result.continueProcessing).toBe(false);
    expect(trace.info).toHaveBeenCalledWith(
      'No candidate actions found for actor',
      'ComponentFilteringStage.execute'
    );
    const stageSuccessCall = trace.success.mock.calls.find(
      ([message]) =>
        typeof message === 'string' &&
        message.includes('Component filtering completed:')
    );
    expect(stageSuccessCall).toBeUndefined();
  });

  it('builds error context when candidate retrieval throws', async () => {
    const actorId = 'actor-3';
    const failingIndex = {
      getCandidateActions: () => {
        throw new Error('index offline');
      },
    };
    const entityManager = new SimpleEntityManager([
      { id: actorId, components: {} },
    ]);

    const stage = new ComponentFilteringStage(
      failingIndex,
      errorBuilder,
      logger,
      entityManager
    );

    const trace = {
      data: jest.fn(),
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
    };

    const result = await stage.execute({
      actor: { id: actorId },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(errorBuilder.buildErrorContext).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId,
        phase: 'discovery',
        additionalContext: { stage: 'component_filtering' },
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error retrieving candidate actions'),
      expect.any(Error)
    );
  });

  it('keeps processing even when trace introspection helpers fail', async () => {
    const actorId = 'actor-4';
    const entityManager = new SimpleEntityManager([
      { id: actorId, components: { 'skill:arcana': {} } },
    ]);

    jest
      .spyOn(entityManager, 'getAllComponentTypesForEntity')
      .mockImplementation(() => {
        throw new Error('introspection blocked');
      });

    const actionIndex = {
      getCandidateActions: jest.fn(() => [
        { id: 'core:ritual', required_components: { actor: ['skill:arcana'] } },
      ]),
    };

    const stage = new ComponentFilteringStage(
      actionIndex,
      errorBuilder,
      logger,
      entityManager
    );

    const captureActionData = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('analysis capture failed');
      })
      .mockImplementationOnce(() => {
        throw new Error('performance capture failed');
      })
      .mockResolvedValue(undefined);

    const trace = {
      captureActionData,
      data: jest.fn(),
      step: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
    };

    const result = await stage.execute({
      actor: { id: actorId },
      actionContext: {},
      candidateActions: [],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn.mock.calls[0][0]).toContain(
      'Failed to get actor components for tracing'
    );
    expect(logger.warn.mock.calls[1][0]).toContain(
      "Failed to capture component analysis for action 'core:ritual'"
    );
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes(
          "Failed to capture performance data for action 'core:ritual'"
        )
      )
    ).toBe(true);
    expect(trace.captureActionData).toHaveBeenCalledTimes(2);
  });
});
