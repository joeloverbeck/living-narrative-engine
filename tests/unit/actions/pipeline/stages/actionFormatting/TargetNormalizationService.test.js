import { TargetNormalizationService } from '../../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { TargetExtractionResult } from '../../../../../../src/entities/multiTarget/targetExtractionResult.js';
import { ActionTargetContext } from '../../../../../../src/models/actionTargetContext.js';

describe('TargetNormalizationService', () => {
  let logger;
  let service;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };
    service = new TargetNormalizationService({ logger });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('can be constructed without dependencies', () => {
    expect(() => new TargetNormalizationService()).not.toThrow();
  });

  it('normalizes multi-target maps into target ids and params', () => {
    const resolvedTargets = {
      primary: [{ id: 'target-1', displayName: 'Enemy' }],
      secondary: [{ id: 'target-2', displayName: 'Item' }],
    };

    const result = service.normalize({
      resolvedTargets,
      isMultiTarget: true,
      actionId: 'attack',
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({
      primary: ['target-1'],
      secondary: ['target-2'],
    });
    expect(result.params).toEqual({
      targetIds: {
        primary: ['target-1'],
        secondary: ['target-2'],
      },
      isMultiTarget: true,
      targetId: 'target-1',
    });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'target-1',
      displayName: 'Enemy',
    });
    expect(result.targetExtractionResult).toBeInstanceOf(
      TargetExtractionResult
    );
  });

  it('supports existing TargetExtractionResult instances', () => {
    const extractionResult = TargetExtractionResult.fromResolvedParameters(
      {
        targetIds: { primary: ['target-5'] },
        isMultiTarget: true,
      },
      logger
    );

    const result = service.normalize({
      resolvedTargets: extractionResult,
      targetContexts: [
        { entityId: 'target-5', displayName: 'Supporter', type: 'entity' },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({ primary: ['target-5'] });
    expect(result.params).toEqual({
      targetIds: { primary: ['target-5'] },
      targetId: 'target-5',
    });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'target-5',
      displayName: 'Supporter',
    });
  });

  it('falls back to default context metadata when no matching context exists', () => {
    const extractionResult = TargetExtractionResult.fromResolvedParameters(
      {
        targetIds: { primary: ['target-hero'] },
        isMultiTarget: true,
      },
      logger
    );

    const result = service.normalize({
      resolvedTargets: extractionResult,
      targetContexts: [{ entityId: 'someone-else', type: 'entity' }],
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({ primary: ['target-hero'] });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'target-hero',
      displayName: null,
    });
  });

  it('skips extraction placeholders that do not resolve to entity identifiers', () => {
    const extractionResult = TargetExtractionResult.createEmpty(logger);
    jest.spyOn(extractionResult, 'getTargetNames').mockReturnValue(['primary']);
    jest
      .spyOn(extractionResult, 'getEntityIdByPlaceholder')
      .mockReturnValue(null);

    const result = service.normalize({ resolvedTargets: extractionResult });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({});
    expect(result.params).toEqual({});
  });

  it('derives context information from legacy target contexts', () => {
    const result = service.normalize({
      resolvedTargets: null,
      targetContexts: [
        { entityId: 'legacy-1', displayName: 'Legacy Target', type: 'entity' },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({});
    expect(result.params).toEqual({ targetId: 'legacy-1' });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'legacy-1',
      displayName: 'Legacy Target',
    });
  });

  it('marks targetId as null when target contexts explicitly indicate no target', () => {
    const result = service.normalize({
      resolvedTargets: null,
      targetContexts: [ActionTargetContext.noTarget()],
    });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({});
    expect(result.params).toEqual({ targetId: null });
    expect(result.primaryTargetContext).toBeNull();
  });

  it('returns error when no target information is supplied', () => {
    const result = service.normalize({ resolvedTargets: null });

    expect(result.error).toEqual({
      code: 'TARGETS_MISSING',
      message: 'No target information supplied for action.',
    });
    expect(result.targetIds).toEqual({});
    expect(result.params).toEqual({});
    expect(result.primaryTargetContext).toBeNull();
  });

  it('includes the action identifier when reporting missing targets', () => {
    const result = service.normalize({
      resolvedTargets: null,
      actionId: 'attack-action',
    });

    expect(result.error).toEqual({
      code: 'TARGETS_MISSING',
      message: "No target information supplied for action 'attack-action'.",
    });
  });

  it('warns and reports error when resolved targets contain malformed entries', () => {
    const resolvedTargets = {
      primary: [{}],
    };

    const result = service.normalize({
      resolvedTargets,
      isMultiTarget: true,
    });

    expect(result.error).toEqual({
      code: 'TARGETS_INVALID',
      message:
        'Resolved targets were provided but no valid target identifiers could be extracted.',
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(result.targetIds).toEqual({});
  });

  it('warns about specific placeholders when some targets are malformed', () => {
    const resolvedTargets = {
      primary: [{ id: 42, displayName: 'Invalid target type' }],
      support: [{ id: 'support-1', displayName: 'Support Ally' }],
    };

    const result = service.normalize({ resolvedTargets });

    expect(result.error).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid target entries detected for placeholders: primary'
    );
    expect(result.targetIds).toEqual({ support: ['support-1'] });
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({ targetIds: { support: ['support-1'] } });
    expect(result.targetExtractionResult).toBeInstanceOf(
      TargetExtractionResult
    );
  });

  it('ignores placeholders that provide no targets while preserving valid entries', () => {
    const resolvedTargets = {
      primary: [],
      support: [{ id: 'support-1', displayName: 'Support Ally' }],
    };

    const result = service.normalize({ resolvedTargets });

    expect(result.error).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(result.targetIds).toEqual({ support: ['support-1'] });
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({
      targetIds: { support: ['support-1'] },
    });
  });

  it('derives a targetId when only non-primary placeholder carries a valid target', () => {
    const resolvedTargets = {
      auxiliary: [{ id: 'aux-9', displayName: 'Auxiliary Target' }],
    };

    const result = service.normalize({ resolvedTargets });

    expect(result.error).toBeNull();
    expect(result.targetIds).toEqual({ auxiliary: ['aux-9'] });
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'aux-9',
      displayName: 'Auxiliary Target',
    });
    expect(result.params).toEqual({
      targetIds: { auxiliary: ['aux-9'] },
      targetId: 'aux-9',
    });
  });

  it('handles extraction results without a primary target gracefully', () => {
    const extractionResult = TargetExtractionResult.createEmpty(logger);

    const result = service.normalize({ resolvedTargets: extractionResult });

    expect(result.error).toBeNull();
    expect(result.targetExtractionResult).toBe(extractionResult);
    expect(result.targetIds).toEqual({});
    expect(result.primaryTargetContext).toBeNull();
    expect(result.params).toEqual({});
  });

  it('derives primary context from resolved targets that omit display names', () => {
    const resolvedTargets = {
      primary: [{ id: 'mystery-1' }],
    };

    const result = service.normalize({ resolvedTargets });

    expect(result.error).toBeNull();
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'mystery-1',
      displayName: null,
    });
  });

  it('builds legacy context payloads when metadata lacks display names', () => {
    const result = service.normalize({
      resolvedTargets: null,
      targetContexts: [
        {
          entityId: 'legacy-without-name',
          type: 'entity',
        },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.primaryTargetContext).toEqual({
      type: 'entity',
      entityId: 'legacy-without-name',
      displayName: null,
    });
    expect(result.params).toEqual({ targetId: 'legacy-without-name' });
  });
});
