import { TargetNormalizationService } from '../../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { TargetExtractionResult } from '../../../../../../src/entities/multiTarget/targetExtractionResult.js';

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

  it('normalizes multi-target maps into target ids and params', () => {
    const resolvedTargets = {
      primary: [
        { id: 'target-1', displayName: 'Enemy' },
      ],
      secondary: [
        { id: 'target-2', displayName: 'Item' },
      ],
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
});
