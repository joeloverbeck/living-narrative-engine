// tests/unit/loaders/phases/summaryPhase.test.js
import SummaryPhase from '../../../../src/loaders/phases/summaryPhase.js';
import LoaderPhase from '../../../../src/loaders/phases/LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../../src/errors/modsLoaderPhaseError.js';

// Mock the custom error classes since we are only testing the phase logic.
jest.mock('../../../../src/errors/modsLoaderPhaseError.js', () => ({
  ModsLoaderPhaseError: class extends Error {
    /**
     * @param {string} code
     * @param {string} message
     * @param {string} phase
     * @param {Error} cause
     */
    constructor(code, message, phase, cause) {
      super(message);
      this.code = code;
      this.phase = phase;
      this.cause = cause;
      this.name = 'ModsLoaderPhaseError';
    }
  },
  ModsLoaderErrorCode: {
    SUMMARY: 'summary',
  },
}));

describe('SummaryPhase', () => {
  let summaryLogger;
  let logger;
  let summaryPhase;
  let mockCtx;

  beforeEach(() => {
    // Arrange: Create mocks and test data before each test.
    summaryLogger = {
      logSummary: jest.fn(),
    };
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };
    mockCtx = {
      worldName: 'TestWorld',
      requestedMods: ['modA', 'modB'],
      finalModOrder: ['core', 'modA', 'modB'],
      incompatibilities: 1,
      totals: { mods: { loaded: 3 }, components: { loaded: 10 } },
    };

    summaryPhase = new SummaryPhase({ summaryLogger, logger });
  });

  // Test to ensure correct inheritance
  it('should be an instance of LoaderPhase', () => {
    expect(summaryPhase).toBeInstanceOf(LoaderPhase);
  });

  // Test the primary success path (AC 1)
  it('should successfully log the summary using the provided context without mutating it', async () => {
    Object.freeze(mockCtx);
    Object.freeze(mockCtx.totals);
    const result = await summaryPhase.execute(mockCtx);

    // Assert: Verify the correct methods were called with the correct arguments.
    expect(logger.info).toHaveBeenCalledWith('— SummaryPhase starting —');
    expect(summaryLogger.logSummary).toHaveBeenCalledTimes(1);
    expect(summaryLogger.logSummary).toHaveBeenCalledWith(
      logger,
      mockCtx.worldName,
      mockCtx.requestedMods,
      mockCtx.finalModOrder,
      mockCtx.incompatibilities,
      mockCtx.totals
    );
    expect(result).not.toBe(mockCtx);
  });

  // Test the failure path (AC 2)
  it('should wrap any thrown error in a ModsLoaderPhaseError with the correct code', async () => {
    // Arrange: Set up the mock to throw an error.
    const originalError = new Error('Failed to write summary to log file');
    summaryLogger.logSummary.mockImplementation(() => {
      throw originalError;
    });
    Object.freeze(mockCtx);
    Object.freeze(mockCtx.totals);

    // Act & Assert: Expect the promise to reject and that the thrown error
    // has all the correct properties.
    await expect(summaryPhase.execute(mockCtx)).rejects.toMatchObject({
      name: 'ModsLoaderPhaseError',
      code: ModsLoaderErrorCode.SUMMARY,
      message: originalError.message,
      phase: 'SummaryPhase',
      cause: originalError,
    });
  });
});
