import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  beforeAll,
} from '@jest/globals';

let mockExecuteActionSequence;

jest.mock('../../../src/logic/actionSequence.js', () => {
  mockExecuteActionSequence = jest.fn();
  return {
    __esModule: true,
    executeActionSequence: mockExecuteActionSequence,
    default: mockExecuteActionSequence,
  };
});

let ActionSequenceService;

/**
 *
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('ActionSequenceService', () => {
  beforeAll(async () => {
    ({ default: ActionSequenceService } = await import(
      '../../../src/logic/actionSequenceService.js'
    ));
  });

  let logger;
  let operationInterpreter;
  let service;

  beforeEach(() => {
    mockExecuteActionSequence.mockReset();
    logger = createMockLogger();
    operationInterpreter = { execute: jest.fn() };
    service = new ActionSequenceService({
      logger,
      operationInterpreter,
    });
  });

  describe('constructor validation', () => {
    it('throws when provided logger is missing required methods', () => {
      const badLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

      expect(
        () =>
          new ActionSequenceService({
            logger: badLogger,
            operationInterpreter,
          })
      ).toThrow("Invalid or missing method 'debug' on dependency 'logger'.");
    });

    it('throws when operation interpreter lacks execute method', () => {
      const invalidInterpreter = {};

      expect(
        () =>
          new ActionSequenceService({
            logger,
            operationInterpreter: invalidInterpreter,
          })
      ).toThrow(
        "Invalid or missing method 'execute' on dependency 'ActionSequenceService: operationInterpreter'."
      );
    });
  });

  describe('execute', () => {
    it('throws when sequence lacks an actions array', async () => {
      await expect(
        service.execute(
          { notActions: [] },
          { jsonLogic: {}, evaluationContext: {} }
        )
      ).rejects.toThrow(
        'ActionSequenceService.execute: sequence must have an actions array'
      );
      expect(mockExecuteActionSequence).not.toHaveBeenCalled();
    });

    it('throws when execution context is missing or invalid', async () => {
      await expect(service.execute({ actions: [] }, null)).rejects.toThrow(
        'ActionSequenceService.execute: context is required'
      );
      expect(mockExecuteActionSequence).not.toHaveBeenCalled();
    });

    it('forwards actions and enhanced context to executeActionSequence', async () => {
      const actions = [{ type: 'TEST_OP' }];
      const context = {
        jsonLogic: { name: 'logic' },
        evaluationContext: { foo: 'bar' },
      };
      mockExecuteActionSequence.mockResolvedValueOnce(undefined);

      await service.execute({ actions }, context);

      expect(mockExecuteActionSequence).toHaveBeenCalledTimes(1);
      const [passedActions, passedContext, passedLogger, passedInterpreter] =
        mockExecuteActionSequence.mock.calls[0];

      expect(passedActions).toBe(actions);
      expect(passedContext).toMatchObject({
        evaluationContext: context.evaluationContext,
        scopeLabel: 'ActionSequenceService',
        jsonLogic: context.jsonLogic,
      });
      expect(passedLogger).toBeDefined();
      expect(typeof passedLogger.debug).toBe('function');
      expect(passedInterpreter).toBe(operationInterpreter);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Sequence execution completed successfully')
      );
    });

    it('logs and rethrows errors from executeActionSequence', async () => {
      const actions = [{ type: 'FAIL_OP' }];
      const context = {
        jsonLogic: {},
        evaluationContext: {},
      };
      const failure = new Error('sequence failure');
      mockExecuteActionSequence.mockRejectedValueOnce(failure);

      await expect(service.execute({ actions }, context)).rejects.toThrow(
        'sequence failure'
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Sequence execution failed'),
        failure
      );
    });
  });
});
