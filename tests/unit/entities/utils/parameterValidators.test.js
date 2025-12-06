import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  assertInstanceAndComponentIds,
  validateAddComponentParams,
  validateRemoveComponentParams,
  validateReconstructEntityParams,
  validateGetEntityInstanceParams,
  validateGetComponentDataParams,
  validateHasComponentParams,
  validateHasComponentOverrideParams,
  validateGetEntitiesWithComponentParams,
  validateRemoveEntityInstanceParams,
} from '../../../../src/entities/utils/parameterValidators.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';
import { SerializedEntityError } from '../../../../src/errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../../../src/errors/invalidInstanceIdError.js';

describe('parameterValidators', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn() };
  });

  describe('assertInstanceAndComponentIds', () => {
    it('does not throw for valid ids', () => {
      expect(() =>
        assertInstanceAndComponentIds('ctx', 'e1', 'c1', logger)
      ).not.toThrow();
    });

    it('throws for invalid instanceId', () => {
      expect(() =>
        assertInstanceAndComponentIds('ctx', '', 'c1', logger)
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('throws for invalid componentTypeId', () => {
      expect(() =>
        assertInstanceAndComponentIds('ctx', 'e1', '', logger)
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('validateAddComponentParams', () => {
    it('throws when componentData is null', () => {
      expect(() =>
        validateAddComponentParams('inst', 'comp', null, logger)
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('componentData cannot be null'),
        {
          componentTypeId: 'comp',
          instanceId: 'inst',
        }
      );
    });

    it('throws when componentData is not an object', () => {
      expect(() =>
        validateAddComponentParams('inst', 'comp', 'invalid', logger)
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('must be an object'),
        {
          componentTypeId: 'comp',
          instanceId: 'inst',
          receivedType: 'string',
        }
      );
    });

    it('allows object componentData', () => {
      expect(() =>
        validateAddComponentParams('inst', 'comp', { foo: 'bar' }, logger)
      ).not.toThrow();
    });
  });

  describe('validateRemoveComponentParams', () => {
    it('validates ids without throwing', () => {
      expect(() =>
        validateRemoveComponentParams('inst', 'comp', logger)
      ).not.toThrow();
    });
  });

  describe('validateReconstructEntityParams', () => {
    it('throws for missing serialized entity', () => {
      expect(() => validateReconstructEntityParams(null, logger)).toThrow(
        SerializedEntityError
      );
      expect(logger.error).toHaveBeenCalledWith(
        'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.'
      );
    });

    it('throws for missing instanceId', () => {
      expect(() =>
        validateReconstructEntityParams({ definitionId: 'def' }, logger)
      ).toThrow(InvalidInstanceIdError);
      expect(logger.error).toHaveBeenCalledWith(
        'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.'
      );
    });

    it('throws for missing definitionId', () => {
      expect(() =>
        validateReconstructEntityParams({ instanceId: 'inst' }, logger)
      ).toThrow(SerializedEntityError);
      expect(logger.error).toHaveBeenCalledWith(
        'EntityManager.reconstructEntity: definitionId is missing or invalid in serialized data.'
      );
    });

    it('passes for valid serialized data', () => {
      expect(() =>
        validateReconstructEntityParams(
          { instanceId: 'inst', definitionId: 'def' },
          logger
        )
      ).not.toThrow();
    });
  });

  describe('validateGetEntityInstanceParams', () => {
    it('throws and logs when instanceId is invalid', () => {
      expect(() => validateGetEntityInstanceParams('', logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "EntityManager.getEntityInstance: Invalid instanceId ''"
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('passes for valid instanceId', () => {
      expect(() =>
        validateGetEntityInstanceParams('inst', logger)
      ).not.toThrow();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('validateGetComponentDataParams', () => {
    it('calls validator without throwing for valid ids', () => {
      expect(() =>
        validateGetComponentDataParams('inst', 'comp', logger)
      ).not.toThrow();
    });
  });

  describe('validateHasComponentParams', () => {
    it('allows valid ids', () => {
      expect(() =>
        validateHasComponentParams('inst', 'comp', logger)
      ).not.toThrow();
    });
  });

  describe('validateHasComponentOverrideParams', () => {
    it('allows valid ids', () => {
      expect(() =>
        validateHasComponentOverrideParams('inst', 'comp', logger)
      ).not.toThrow();
    });
  });

  describe('validateGetEntitiesWithComponentParams', () => {
    it('throws and logs when componentTypeId is invalid', () => {
      expect(() => validateGetEntitiesWithComponentParams('', logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "EntityManager.getEntitiesWithComponent: Received invalid componentTypeId ('')"
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('allows valid componentTypeId', () => {
      expect(() =>
        validateGetEntitiesWithComponentParams('comp', logger)
      ).not.toThrow();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('validateRemoveEntityInstanceParams', () => {
    it('throws and logs when instanceId is invalid', () => {
      expect(() => validateRemoveEntityInstanceParams('', logger)).toThrow(
        InvalidArgumentError
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "EntityManager.removeEntityInstance: Attempted to remove entity with invalid ID: ''"
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('allows valid instanceId', () => {
      expect(() =>
        validateRemoveEntityInstanceParams('inst', logger)
      ).not.toThrow();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
