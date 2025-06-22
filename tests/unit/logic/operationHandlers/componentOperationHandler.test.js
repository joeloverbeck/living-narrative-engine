import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import ComponentOperationHandler from '../../../../src/logic/operationHandlers/componentOperationHandler.js';

class TestHandler extends ComponentOperationHandler {
  constructor(logger) {
    super('TestHandler', { logger: { value: logger } });
  }
}

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('ComponentOperationHandler utilities', () => {
  let handler;
  let logger;
  const execCtx = {
    evaluationContext: { actor: { id: 'a1' }, target: { id: 't1' } },
  };

  beforeEach(() => {
    logger = makeLogger();
    handler = new TestHandler(logger);
    jest.clearAllMocks();
  });

  test('validateEntityRef resolves actor keyword', () => {
    const id = handler.validateEntityRef('actor', logger, 'TEST', execCtx);
    expect(id).toBe('a1');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('validateEntityRef warns and returns null when invalid', () => {
    const id = handler.validateEntityRef(
      { bad: true },
      logger,
      'TEST',
      execCtx
    );
    expect(id).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'TEST: Could not resolve entity id from entity_ref.',
      { entity_ref: { bad: true } }
    );
  });

  test('requireComponentType trims valid type', () => {
    const type = handler.requireComponentType('  core:stat  ', logger, 'TEST');
    expect(type).toBe('core:stat');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('requireComponentType warns and returns null for invalid input', () => {
    const type = handler.requireComponentType('  ', logger, 'TEST');
    expect(type).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'TEST: Invalid or missing "component_type" parameter (must be non-empty string).'
    );
  });
});
