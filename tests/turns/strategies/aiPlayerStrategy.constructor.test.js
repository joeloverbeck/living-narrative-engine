// tests/turns/strategies/aiPlayerStrategy.constructor.test.js

/**
 * @file Unit tests for AIPlayerStrategy constructor validation.
 */
import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

const mockOrchestrator = () => ({
  decideOrFallback: jest.fn(),
});
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('AIPlayerStrategy constructor', () => {
  let orchestrator;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = mockOrchestrator();
    logger = mockLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates instance with valid dependencies', () => {
    const instance = new AIPlayerStrategy({ orchestrator, logger });
    expect(instance).toBeInstanceOf(AIPlayerStrategy);
  });

  test('throws if orchestrator is missing', () => {
    expect(() => new AIPlayerStrategy({ orchestrator: null, logger })).toThrow(
      'Missing required dependency: IAIDecisionOrchestrator.'
    );
  });

  test('throws if orchestrator lacks decideOrFallback method', () => {
    expect(() => new AIPlayerStrategy({ orchestrator: {}, logger })).toThrow(
      'Missing required dependency: IAIDecisionOrchestrator.'
    );
  });

  test('throws if logger is missing', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(() => new AIPlayerStrategy({ orchestrator, logger: null })).toThrow(
      'Missing required dependency: ILogger.'
    );
    consoleErrorSpy.mockRestore();
  });

  test('throws if logger lacks debug method', () => {
    const badLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    expect(
      () => new AIPlayerStrategy({ orchestrator, logger: badLogger })
    ).toThrow('Missing required dependency: ILogger.');
  });
});
