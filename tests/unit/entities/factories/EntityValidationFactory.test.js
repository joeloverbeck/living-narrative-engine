/**
 * @file Unit tests for EntityValidationFactory.
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import EntityValidationFactory from '../../../../src/entities/factories/EntityValidationFactory.js';
import { InvalidInstanceIdError } from '../../../../src/errors/invalidInstanceIdError.js';
import { SerializedEntityError } from '../../../../src/errors/serializedEntityError.js';
import {
  createMockLogger,
  createMockSchemaValidator,
} from '../../../common/mockFactories.js';
import * as dependencyUtils from '../../../../src/utils/dependencyUtils.js';

/**
 * Helper to create a factory with valid dependencies for the majority of tests.
 *
 * @returns {{ factory: EntityValidationFactory, logger: ReturnType<typeof createMockLogger>, validator: ReturnType<typeof createMockSchemaValidator>, validateAndClone: jest.Mock }}
 */
function createFactory() {
  const logger = createMockLogger();
  const validator = createMockSchemaValidator();
  const validateAndClone = jest.fn((type, data) => ({ type, data }));
  const factory = new EntityValidationFactory({
    validator,
    logger,
    validateAndClone,
  });

  return { factory, logger, validator, validateAndClone };
}

describe('EntityValidationFactory', () => {
  let factory;
  let logger;
  let validator;
  let validateAndClone;

  beforeEach(() => {
    jest.restoreAllMocks();
    ({ factory, logger, validator, validateAndClone } = createFactory());
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should log initialization when constructed with valid dependencies', () => {
      expect(factory).toBeInstanceOf(EntityValidationFactory);
      expect(logger.debug).toHaveBeenCalledWith(
        'EntityValidationFactory initialized.'
      );
    });

    it('should throw when validateAndClone dependency is not a function', () => {
      expect(() => {
        return new EntityValidationFactory({
          validator,
          logger,
          validateAndClone: 'not-a-function',
        });
      }).toThrow('validateAndClone must be a function');
    });
  });

  describe('validateCreateIds', () => {
    it('should throw TypeError with helpful message when definitionId is invalid', () => {
      expect(() => factory.validateCreateIds('', 'valid-instance')).toThrow(
        TypeError
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('definitionId must be a non-empty string.')
      );
    });

    it('should throw InvalidInstanceIdError when instanceId is invalid', () => {
      expect(() => factory.validateCreateIds('core:test', '')).toThrow(
        InvalidInstanceIdError
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'EntityValidationFactory.validateCreateIds: instanceId is missing or invalid.'
        )
      );
    });

    it('should rethrow unexpected errors from definitionId validation', () => {
      const unexpectedError = new Error('unexpected definition failure');
      const spy = jest
        .spyOn(dependencyUtils, 'assertValidId')
        .mockImplementation(() => {
          throw unexpectedError;
        });

      expect(() => factory.validateCreateIds('core:test', 'instance-1')).toThrow(
        unexpectedError
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should rethrow unexpected errors from instanceId validation', () => {
      const unexpectedError = new Error('unexpected instance failure');
      const spy = jest.spyOn(dependencyUtils, 'assertValidId');
      spy.mockImplementationOnce(() => undefined); // definitionId passes silently
      spy.mockImplementationOnce(() => {
        throw unexpectedError;
      });

      expect(() => factory.validateCreateIds('core:test', 'instance-1')).toThrow(
        unexpectedError
      );
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateReconstructData', () => {
    it('should throw SerializedEntityError when serializedEntity is invalid', () => {
      expect(() => factory.validateReconstructData(null)).toThrow(
        SerializedEntityError
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'EntityValidationFactory.validateReconstructData: serializedEntity data is missing or invalid.'
        )
      );
    });

    it('should throw InvalidInstanceIdError when instanceId is invalid', () => {
      expect(() =>
        factory.validateReconstructData({
          instanceId: '',
          definitionId: 'core:test',
        })
      ).toThrow(InvalidInstanceIdError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'EntityValidationFactory.validateReconstructData: instanceId is missing or invalid in serialized data.'
        )
      );
    });

    it('should rethrow unexpected errors from instanceId validation', () => {
      const unexpectedError = new Error('unexpected reconstruct failure');
      const spy = jest
        .spyOn(dependencyUtils, 'assertValidId')
        .mockImplementation(() => {
          throw unexpectedError;
        });

      expect(() =>
        factory.validateReconstructData({
          instanceId: 'valid-id',
          definitionId: 'core:test',
        })
      ).toThrow(unexpectedError);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
