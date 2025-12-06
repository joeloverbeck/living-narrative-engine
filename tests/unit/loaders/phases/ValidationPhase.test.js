import { describe, it, expect, jest } from '@jest/globals';

import ValidationPhase from '../../../../src/loaders/phases/ValidationPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../../src/errors/modsLoaderPhaseError.js';

const createLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

describe('ValidationPhase', () => {
  it('returns context unchanged when orchestrator is unavailable', async () => {
    const logger = createLogger();
    const phase = new ValidationPhase({ validationOrchestrator: null, logger });
    const ctx = { finalModOrder: ['core:base'] };

    const result = await phase.execute(ctx);

    expect(result).toBe(ctx);
    expect(logger.info).toHaveBeenCalledWith('— ValidationPhase starting —');
    expect(logger.debug).toHaveBeenCalledWith(
      'ValidationPhase: No validation orchestrator available, skipping'
    );
  });

  it('logs warnings and recommendations and returns a frozen context on success', async () => {
    const logger = createLogger();
    const validateForLoading = jest.fn().mockResolvedValue({
      canLoad: true,
      warnings: ['Deprecated action reference', 'Unoptimized asset'],
      recommendations: ['Consider pruning optional mods'],
    });
    const validationOrchestrator = { validateForLoading };
    const phase = new ValidationPhase({
      validationOrchestrator,
      logger,
      options: { failFast: true, skipCrossReferences: true },
    });
    const ctx = {
      finalModOrder: ['core:base', 'core:world'],
      requestedMods: ['core:base'],
      previousPhase: 'manifest',
    };

    const result = await phase.execute(ctx);

    expect(validateForLoading).toHaveBeenCalledWith(ctx.finalModOrder, {
      strictMode: true,
      allowWarnings: false,
    });
    expect(result).not.toBe(ctx);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).toEqual({
      ...ctx,
      validationWarnings: ['Deprecated action reference', 'Unoptimized asset'],
      validationRecommendations: ['Consider pruning optional mods'],
      validationPassed: true,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'ValidationPhase: 2 validation warnings found'
    );
    expect(logger.warn).toHaveBeenCalledWith('  - Deprecated action reference');
    expect(logger.warn).toHaveBeenCalledWith('  - Unoptimized asset');
    expect(logger.info).toHaveBeenCalledWith(
      'ValidationPhase recommendations:'
    );
    expect(logger.info).toHaveBeenCalledWith(
      '  - Consider pruning optional mods'
    );
    expect(logger.info).toHaveBeenCalledWith(
      '— ValidationPhase completed successfully —'
    );
  });

  it('throws ModsLoaderPhaseError when validation fails and logs details', async () => {
    const logger = createLogger();
    const validateForLoading = jest.fn().mockResolvedValue({
      canLoad: false,
      dependencies: {
        isValid: false,
        errors: ['Missing dependency: storyteller:core'],
      },
      warnings: ['Optional asset mismatch'],
    });
    const validationOrchestrator = { validateForLoading };
    const phase = new ValidationPhase({
      validationOrchestrator,
      logger,
      options: {},
    });
    const ctx = { requestedMods: ['storyteller:core'] };

    await expect(phase.execute(ctx)).rejects.toMatchObject({
      name: 'ModsLoaderPhaseError',
      message: 'Mod validation failed - cannot proceed with loading',
      phase: 'ValidationPhase',
    });
    expect(validateForLoading).toHaveBeenCalledWith(ctx.requestedMods, {
      strictMode: false,
      allowWarnings: true,
    });
    expect(logger.error).toHaveBeenCalledWith('Dependency validation errors:', [
      'Missing dependency: storyteller:core',
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Validation warning: Optional asset mismatch'
    );
  });

  it('re-throws ModsLoaderPhaseError raised by orchestrator', async () => {
    const logger = createLogger();
    const phaseError = new ModsLoaderPhaseError(
      ModsLoaderErrorCode.VALIDATION,
      'Existing failure',
      'ValidationPhase'
    );
    const validationOrchestrator = {
      validateForLoading: jest.fn().mockRejectedValue(phaseError),
    };
    const phase = new ValidationPhase({ validationOrchestrator, logger });

    await expect(phase.execute({ requestedMods: [] })).rejects.toBe(phaseError);
  });

  it('wraps unexpected errors from orchestrator in ModsLoaderPhaseError', async () => {
    const logger = createLogger();
    const originalError = new Error('unexpected failure');
    const validationOrchestrator = {
      validateForLoading: jest.fn().mockRejectedValue(originalError),
    };
    const phase = new ValidationPhase({ validationOrchestrator, logger });

    await expect(phase.execute({ requestedMods: [] })).rejects.toEqual(
      expect.objectContaining({
        name: 'ModsLoaderPhaseError',
        message: 'unexpected failure',
        phase: 'ValidationPhase',
        cause: originalError,
      })
    );
  });
});
