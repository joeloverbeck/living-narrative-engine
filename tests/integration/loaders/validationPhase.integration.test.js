import { describe, it, expect } from '@jest/globals';
import ValidationPhase from '../../../src/loaders/phases/ValidationPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../src/errors/modsLoaderPhaseError.js';
import { createLoadContext } from '../../../src/loaders/LoadContext.js';

class RecordingLogger {
  constructor() {
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
    this.debugMessages = [];
  }

  info(...args) {
    this.infoMessages.push(args);
  }

  warn(...args) {
    this.warnMessages.push(args);
  }

  error(...args) {
    this.errorMessages.push(args);
  }

  debug(...args) {
    this.debugMessages.push(args);
  }
}

class RecordingValidationOrchestrator {
  constructor({ result, error } = {}) {
    this.result = result;
    this.error = error;
    this.calls = [];
  }

  async validateForLoading(modOrder, options) {
    this.calls.push({ modOrder, options });

    if (this.error) {
      throw this.error;
    }

    return this.result;
  }
}

describe('ValidationPhase integration behaviour', () => {
  const createContext = (overrides = {}) => {
    const base = createLoadContext({
      worldName: 'primus',
      requestedMods: ['core:base', 'story:chapter1'],
      registry: { name: 'registry-double' },
    });

    return Object.freeze({ ...base, ...overrides });
  };

  it('returns the original context when no validation orchestrator is provided', async () => {
    const logger = new RecordingLogger();
    const phase = new ValidationPhase({ validationOrchestrator: null, logger });
    const ctx = createContext();

    const result = await phase.execute(ctx);

    expect(result).toBe(ctx);
    expect(logger.infoMessages.map((args) => args[0])).toEqual([
      '— ValidationPhase starting —',
    ]);
    expect(logger.debugMessages.map((args) => args[0])).toEqual([
      'ValidationPhase: No validation orchestrator available, skipping',
    ]);
  });

  it('delegates to the orchestrator, logs warnings and recommendations, and returns a frozen context', async () => {
    const logger = new RecordingLogger();
    const orchestrator = new RecordingValidationOrchestrator({
      result: {
        canLoad: true,
        warnings: ['Deprecated action reference', 'Unoptimized asset'],
        recommendations: ['Consider pruning optional mods'],
      },
    });
    const phase = new ValidationPhase({
      validationOrchestrator: orchestrator,
      logger,
      options: { failFast: true, skipCrossReferences: true },
    });
    const ctx = createContext({
      finalModOrder: ['core:base', 'story:chapter1'],
    });

    const result = await phase.execute(ctx);

    expect(orchestrator.calls).toEqual([
      {
        modOrder: ['core:base', 'story:chapter1'],
        options: { strictMode: true, allowWarnings: false },
      },
    ]);

    expect(result).not.toBe(ctx);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.validationPassed).toBe(true);
    expect(result.validationWarnings).toEqual([
      'Deprecated action reference',
      'Unoptimized asset',
    ]);
    expect(result.validationRecommendations).toEqual([
      'Consider pruning optional mods',
    ]);

    expect(logger.infoMessages.map((args) => args[0])).toEqual([
      '— ValidationPhase starting —',
      'ValidationPhase recommendations:',
      '  - Consider pruning optional mods',
      '— ValidationPhase completed successfully —',
    ]);
    expect(logger.warnMessages.map((args) => args[0])).toEqual([
      'ValidationPhase: 2 validation warnings found',
      '  - Deprecated action reference',
      '  - Unoptimized asset',
    ]);
    expect(logger.errorMessages).toHaveLength(0);
  });

  it('uses the requested mod order when the final order is unavailable and produces empty arrays by default', async () => {
    const logger = new RecordingLogger();
    const orchestrator = new RecordingValidationOrchestrator({
      result: {
        canLoad: true,
      },
    });
    const phase = new ValidationPhase({
      validationOrchestrator: orchestrator,
      logger,
    });
    const ctx = createContext({ finalModOrder: undefined });

    const result = await phase.execute(ctx);

    expect(orchestrator.calls).toEqual([
      {
        modOrder: ctx.requestedMods,
        options: { strictMode: false, allowWarnings: true },
      },
    ]);
    expect(result.validationWarnings).toEqual([]);
    expect(result.validationRecommendations).toEqual([]);
    expect(logger.warnMessages).toHaveLength(0);
    expect(logger.infoMessages.map((args) => args[0])).toContain(
      '— ValidationPhase completed successfully —'
    );
  });

  it('throws ModsLoaderPhaseError when validation reports unresolved issues', async () => {
    const logger = new RecordingLogger();
    const orchestrator = new RecordingValidationOrchestrator({
      result: {
        canLoad: false,
        dependencies: {
          isValid: false,
          errors: ['Missing dependency: storyteller:core'],
        },
        warnings: ['Optional asset mismatch'],
      },
    });
    const phase = new ValidationPhase({
      validationOrchestrator: orchestrator,
      logger,
    });
    const ctx = createContext();

    await expect(phase.execute(ctx)).rejects.toMatchObject({
      name: 'ModsLoaderPhaseError',
      message: 'Mod validation failed - cannot proceed with loading',
      phase: 'ValidationPhase',
    });

    expect(orchestrator.calls[0]).toEqual({
      modOrder: ctx.finalModOrder || ctx.requestedMods,
      options: { strictMode: false, allowWarnings: true },
    });
    expect(logger.errorMessages).toEqual([
      ['Mod validation failed - cannot proceed with loading'],
      [
        'Dependency validation errors:',
        ['Missing dependency: storyteller:core'],
      ],
    ]);
    expect(logger.warnMessages.map((args) => args[0])).toContain(
      'Validation warning: Optional asset mismatch'
    );
  });

  it('surfaces validation failures that provide no extra diagnostic data', async () => {
    const logger = new RecordingLogger();
    const orchestrator = new RecordingValidationOrchestrator({
      result: {
        canLoad: false,
      },
    });
    const phase = new ValidationPhase({
      validationOrchestrator: orchestrator,
      logger,
    });

    await expect(phase.execute(createContext())).rejects.toMatchObject({
      name: 'ModsLoaderPhaseError',
      message: 'Mod validation failed - cannot proceed with loading',
    });

    expect(logger.errorMessages).toEqual([
      ['Mod validation failed - cannot proceed with loading'],
    ]);
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('re-throws ModsLoaderPhaseError emitted by the orchestrator', async () => {
    const logger = new RecordingLogger();
    const phaseError = new ModsLoaderPhaseError(
      ModsLoaderErrorCode.VALIDATION,
      'Existing failure',
      'ValidationPhase'
    );
    const orchestrator = new RecordingValidationOrchestrator({
      error: phaseError,
    });
    const phase = new ValidationPhase({
      validationOrchestrator: orchestrator,
      logger,
    });

    await expect(phase.execute(createContext())).rejects.toBe(phaseError);
  });

  it('wraps unexpected orchestrator failures in ModsLoaderPhaseError', async () => {
    const logger = new RecordingLogger();
    const originalError = new Error('unexpected failure');
    const orchestrator = new RecordingValidationOrchestrator({
      error: originalError,
    });
    const phase = new ValidationPhase({
      validationOrchestrator: orchestrator,
      logger,
    });

    await expect(phase.execute(createContext())).rejects.toEqual(
      expect.objectContaining({
        name: 'ModsLoaderPhaseError',
        message: 'unexpected failure',
        phase: 'ValidationPhase',
        cause: originalError,
      })
    );
  });
});
