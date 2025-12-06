/**
 * @file Integration tests for TargetNormalizationService
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { TargetNormalizationService } from '../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { TargetExtractionResult } from '../../../../../src/entities/multiTarget/targetExtractionResult.js';
import { ActionTargetContext } from '../../../../../src/models/actionTargetContext.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../../src/logging/consoleLogger.js';

/**
 * Helper to create a context with display name metadata.
 *
 * @param {string} entityId
 * @param {string} [displayName]
 */
function createEntityContext(entityId, displayName) {
  const context = ActionTargetContext.forEntity(entityId);
  if (displayName) {
    context.displayName = displayName;
  }
  return context;
}

describe('TargetNormalizationService - Integration', () => {
  let logger;
  let service;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    logger = new ConsoleLogger(LogLevel.DEBUG);
    jest.spyOn(logger, 'warn');
    jest.spyOn(logger, 'debug');

    service = new TargetNormalizationService({ logger });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes TargetExtractionResult instances with contextual data', () => {
    const extractionResult = TargetExtractionResult.fromResolvedParameters(
      {
        isMultiTarget: true,
        targetIds: {
          primary: ['test:entity_primary'],
          support: ['test:entity_support'],
        },
      },
      logger
    );

    const result = service.normalize({
      resolvedTargets: extractionResult,
      targetContexts: [
        createEntityContext('test:entity_primary', 'Commander'),
        createEntityContext('test:entity_support', 'Support Drone'),
      ],
      actionId: 'test:multi-target',
    });

    expect(result.targetExtractionResult).toBe(extractionResult);
    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({
      primary: ['test:entity_primary'],
      support: ['test:entity_support'],
    });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'test:entity_primary',
      displayName: 'Commander',
    });
    expect(result.params).toEqual({
      targetIds: {
        primary: ['test:entity_primary'],
        support: ['test:entity_support'],
      },
      isMultiTarget: true,
      targetId: 'test:entity_primary',
    });
  });

  it('falls back to extraction metadata when contextual display names are missing', () => {
    const extractionResult = TargetExtractionResult.fromResolvedParameters(
      {
        targetId: 'test:lonely_entity',
      },
      logger
    );

    const result = service.normalize({
      resolvedTargets: extractionResult,
      targetContexts: [createEntityContext('someone-else')],
      actionId: 'test:single-target',
    });

    expect(result.error).toBeNull();
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'test:lonely_entity',
      displayName: null,
    });
    expect(result.params).toEqual({
      targetIds: { primary: ['test:lonely_entity'] },
      targetId: 'test:lonely_entity',
    });
  });

  it('returns neutral payloads for extraction results without targets', () => {
    const extractionResult = TargetExtractionResult.createEmpty(logger);

    const result = service.normalize({
      resolvedTargets: extractionResult,
      actionId: 'test:empty-extraction',
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({});
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({});
    expect(result.targetExtractionResult).toBe(extractionResult);
  });

  it('normalizes legacy resolved target maps while preserving inferred target ids', () => {
    const result = service.normalize({
      resolvedTargets: {
        target: [{ id: 'test:single_target', displayName: 'The Chosen One' }],
      },
      isMultiTarget: false,
      actionId: 'test:legacy-target',
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({
      target: ['test:single_target'],
    });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'test:single_target',
      displayName: 'The Chosen One',
    });
    expect(result.params).toEqual({
      targetIds: { target: ['test:single_target'] },
      targetId: 'test:single_target',
    });
  });

  it('logs warnings for malformed resolved target entries and infers multi-target state', () => {
    const result = service.normalize({
      resolvedTargets: {
        primary: [{ id: 'test:entity_primary', displayName: 'Alpha' }],
        helper: [{ id: 'test:entity_helper1' }, { id: 'test:entity_helper2' }],
        broken: [{ foo: 'bar' }, null],
      },
      isMultiTarget: false,
      actionId: 'test:warn-targets',
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({
      primary: ['test:entity_primary'],
      helper: ['test:entity_helper1', 'test:entity_helper2'],
    });
    expect(result.params).toEqual({
      targetIds: {
        primary: ['test:entity_primary'],
        helper: ['test:entity_helper1', 'test:entity_helper2'],
      },
      isMultiTarget: true,
      targetId: 'test:entity_primary',
    });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'test:entity_primary',
      displayName: 'Alpha',
    });
    expect(result.targetExtractionResult).toBeInstanceOf(
      TargetExtractionResult
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Invalid target entries detected for placeholders: broken'
      )
    );
  });

  it('derives null primary contexts when primary target collections are empty', () => {
    const result = service.normalize({
      resolvedTargets: {
        primary: [],
        helper: [{ id: 'test:entity_helper' }],
      },
      actionId: 'test:empty-primary',
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({ helper: ['test:entity_helper'] });
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({
      targetIds: { helper: ['test:entity_helper'] },
    });
  });

  it('ignores malformed primary entries when deriving primary context', () => {
    const result = service.normalize({
      resolvedTargets: {
        primary: [{ foo: 'bar' }],
        target: [{ id: 'test:valid_target' }],
      },
      actionId: 'test:invalid-primary-entry',
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({ target: ['test:valid_target'] });
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({
      targetIds: { target: ['test:valid_target'] },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Invalid target entries detected for placeholders: primary'
      )
    );
  });

  it('returns structured errors when resolved target maps contain no valid entries', () => {
    const result = service.normalize({
      resolvedTargets: {
        primary: [{ displayName: 'Alpha' }],
        empty: [],
      },
      actionId: 'test:invalid-targets',
    });

    expect(result.targetIds).toEqual({});
    expect(result.targetExtractionResult).toBeNull();
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({});
    expect(result.error).toEqual({
      code: 'TARGETS_INVALID',
      message:
        'Resolved targets were provided but no valid target identifiers could be extracted.',
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('derives parameters from legacy target contexts when no resolved targets exist', () => {
    const context = createEntityContext('test:context_entity', 'Context Hero');

    const result = service.normalize({
      targetContexts: [context],
      actionId: 'test:context-only',
    });

    expect(result.error).toBeNull();
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'test:context_entity',
      displayName: 'Context Hero',
    });
    expect(result.params).toEqual({ targetId: 'test:context_entity' });
    expect(result.targetExtractionResult).toBeInstanceOf(
      TargetExtractionResult
    );
  });

  it('handles legacy contexts that lack entity identifiers', () => {
    const result = service.normalize({
      targetContexts: [ActionTargetContext.noTarget()],
    });

    expect(result.error).toBeNull();
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({ targetId: null });
    expect(result.targetExtractionResult).toBeNull();
  });

  it('reports missing target information when no inputs are provided', () => {
    const result = service.normalize({ actionId: 'test:missing-info' });

    expect(result.error).toEqual({
      code: 'TARGETS_MISSING',
      message: "No target information supplied for action 'test:missing-info'.",
    });
    expect(result.params).toEqual({});
    expect(result.targetExtractionResult).toBeNull();
    expect(result.primaryTargetContext).toBeNull();
  });
});
