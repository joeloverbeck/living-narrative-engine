import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import * as entityRefUtils from '../../../../src/utils/entityRefUtils.js';
import * as operationValidationUtils from '../../../../src/utils/operationValidationUtils.js';
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveEntity', () => {
    test('returns null for falsy references without calling resolveEntityId', () => {
      const spy = jest.spyOn(entityRefUtils, 'resolveEntityId');

      expect(handler.resolveEntity(null, execCtx)).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    test('delegates to resolveEntityId when a reference is provided', () => {
      const spy = jest
        .spyOn(entityRefUtils, 'resolveEntityId')
        .mockReturnValue('resolved-id');

      const result = handler.resolveEntity('target', execCtx);

      expect(result).toBe('resolved-id');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('target', execCtx);
    });
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

  test('validateComponentType uses the handler logger when none is provided', () => {
    const spy = jest
      .spyOn(operationValidationUtils, 'validateComponentType')
      .mockReturnValue('normalized');

    const result = handler.validateComponentType('core:stat', undefined, 'OP');

    expect(result).toBe('normalized');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('core:stat', handler.logger, 'OP');
  });

  test('validateEntityRef forwards arguments to the utility function', () => {
    const spy = jest
      .spyOn(operationValidationUtils, 'validateEntityRef')
      .mockReturnValue('entity-42');

    const result = handler.validateEntityRef('target', logger, 'OP', execCtx);

    expect(result).toBe('entity-42');
    expect(spy).toHaveBeenCalledWith(
      'target',
      execCtx,
      logger,
      undefined,
      'OP'
    );
  });

  describe('validateEntityAndType', () => {
    test('returns null when the entity reference cannot be resolved', () => {
      const entitySpy = jest
        .spyOn(handler, 'validateEntityRef')
        .mockReturnValue(null);
      const typeSpy = jest.spyOn(handler, 'requireComponentType');

      expect(
        handler.validateEntityAndType(
          'actor',
          'core:stat',
          logger,
          'OP',
          execCtx
        )
      ).toBeNull();
      expect(entitySpy).toHaveBeenCalledTimes(1);
      expect(typeSpy).not.toHaveBeenCalled();
    });

    test('returns null when the component type validation fails', () => {
      jest.spyOn(handler, 'validateEntityRef').mockReturnValue('entity-17');
      const typeSpy = jest
        .spyOn(handler, 'requireComponentType')
        .mockReturnValue(null);

      expect(
        handler.validateEntityAndType('actor', '  ', logger, 'OP', execCtx)
      ).toBeNull();
      expect(typeSpy).toHaveBeenCalledWith('  ', logger, 'OP');
    });

    test('returns the resolved entity id and normalized component type', () => {
      jest.spyOn(handler, 'validateEntityRef').mockReturnValue('entity-99');
      jest.spyOn(handler, 'requireComponentType').mockReturnValue('core:stat');

      const result = handler.validateEntityAndType(
        'actor',
        'core:stat',
        logger,
        'OP',
        execCtx
      );

      expect(result).toEqual({ entityId: 'entity-99', type: 'core:stat' });
    });
  });
});
