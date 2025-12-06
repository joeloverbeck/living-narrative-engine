import { describe, it, expect, beforeEach } from '@jest/globals';
import { ComponentStateValidator } from '../../../src/utils/componentStateValidator.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

/** @typedef {ReturnType<typeof createMockLogger>} MockLogger */

describe('ComponentStateValidator integration', () => {
  /** @type {ComponentStateValidator} */
  let validator;
  /** @type {MockLogger} */
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    validator = new ComponentStateValidator({ logger });
  });

  describe('validateFurnitureComponent', () => {
    it('validates a well formed allows_sitting component and logs debug information', () => {
      const component = {
        spots: ['game:actor1', null, 'game:actor2'],
      };

      validator.validateFurnitureComponent(
        'furniture:sofa',
        component,
        'integration scenario'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'Furniture component validated',
        expect.objectContaining({
          furnitureId: 'furniture:sofa',
          spotsCount: 3,
          context: 'integration scenario',
        })
      );
    });

    it('throws when the component is missing', () => {
      expect(() =>
        validator.validateFurnitureComponent('furniture:missing', null)
      ).toThrow(EntityNotFoundError);

      expect(logger.error).toHaveBeenCalledWith(
        'Furniture validation failed for furniture:missing',
        expect.objectContaining({
          error: expect.stringContaining('missing allows_sitting component'),
        })
      );
    });

    it('throws when spots is not an array', () => {
      expect(() =>
        validator.validateFurnitureComponent('furniture:broken', {
          spots: 'invalid',
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Furniture validation failed for furniture:broken',
        expect.objectContaining({
          error: expect.stringContaining('invalid spots array'),
        })
      );
    });

    it('throws when spots array is empty', () => {
      expect(() =>
        validator.validateFurnitureComponent('furniture:empty', {
          spots: [],
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Furniture validation failed for furniture:empty',
        expect.objectContaining({
          error: expect.stringContaining('empty spots array'),
        })
      );
    });

    it('throws when there are more than 10 spots', () => {
      const overcrowdedSpots = Array.from({ length: 11 }, (_, index) =>
        index === 10 ? 'game:actor-final' : `game:actor-${index}`
      );

      expect(() =>
        validator.validateFurnitureComponent('furniture:overcrowded', {
          spots: overcrowdedSpots,
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Furniture validation failed for furniture:overcrowded',
        expect.objectContaining({
          error: expect.stringContaining('exceeds maximum spots'),
        })
      );
    });

    it('throws when a spot contains an invalid occupant reference', () => {
      expect(() =>
        validator.validateFurnitureComponent('furniture:invalid-occupant', {
          spots: ['game:actor1', 42, 'game:actor3'],
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Furniture validation failed for furniture:invalid-occupant',
        expect.objectContaining({
          error: expect.stringContaining('invalid occupant ID'),
        })
      );
    });
  });

  describe('validateClosenessComponent', () => {
    it('accepts a null closeness component as valid and logs debug for non-empty data', () => {
      expect(() =>
        validator.validateClosenessComponent('game:solo-actor', null)
      ).not.toThrow();

      validator.validateClosenessComponent(
        'game:actor-with-partners',
        {
          partners: ['game:partner1', 'game:partner2'],
        },
        'closeness scenario'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'Closeness component validated',
        expect.objectContaining({
          actorId: 'game:actor-with-partners',
          partnerCount: 2,
          context: 'closeness scenario',
        })
      );
    });

    it('throws when partners is not an array', () => {
      expect(() =>
        validator.validateClosenessComponent('game:actor', {
          partners: 'invalid',
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Closeness validation failed for game:actor',
        expect.objectContaining({
          error: expect.stringContaining('invalid closeness partners array'),
        })
      );
    });

    it('throws when a partner id is malformed', () => {
      expect(() =>
        validator.validateClosenessComponent('game:actor', {
          partners: ['game:valid', 'invalid-partner'],
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Closeness validation failed for game:actor',
        expect.objectContaining({
          error: expect.stringContaining('invalid partner ID'),
        })
      );
    });

    it('throws when duplicate partners are present', () => {
      expect(() =>
        validator.validateClosenessComponent('game:actor', {
          partners: ['game:duplicate', 'game:duplicate'],
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Closeness validation failed for game:actor',
        expect.objectContaining({
          error: expect.stringContaining('duplicate partners'),
        })
      );
    });

    it('throws when the actor references themselves as a partner', () => {
      expect(() =>
        validator.validateClosenessComponent('game:actor', {
          partners: ['game:actor'],
        })
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Closeness validation failed for game:actor',
        expect.objectContaining({
          error: expect.stringContaining('partner with themselves'),
        })
      );
    });
  });

  describe('validateBidirectionalCloseness', () => {
    it('throws when entity manager dependency is missing', () => {
      expect(() =>
        validator.validateBidirectionalCloseness(
          null,
          'game:actor',
          'game:partner'
        )
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Bidirectional validation failed for game:actor and game:partner',
        expect.objectContaining({
          error: expect.stringContaining('Entity manager is required'),
        })
      );
    });

    it('throws when the relationship exists only from actor to partner', () => {
      const entityManager = {
        getComponentData(requestedId, componentType) {
          if (componentType !== 'positioning:closeness') {
            return null;
          }

          if (requestedId === 'game:actor') {
            return { partners: ['game:partner'] };
          }

          if (requestedId === 'game:partner') {
            return { partners: [] };
          }

          return null;
        },
      };

      expect(() =>
        validator.validateBidirectionalCloseness(
          entityManager,
          'game:actor',
          'game:partner'
        )
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Bidirectional validation failed for game:actor and game:partner',
        expect.objectContaining({
          error: expect.stringContaining('game:actor → game:partner'),
        })
      );
    });

    it('throws when the relationship exists only from partner to actor', () => {
      const entityManager = {
        getComponentData(requestedId, componentType) {
          if (componentType !== 'positioning:closeness') {
            return null;
          }

          if (requestedId === 'game:actor') {
            return { partners: [] };
          }

          if (requestedId === 'game:partner') {
            return { partners: ['game:actor'] };
          }

          return null;
        },
      };

      expect(() =>
        validator.validateBidirectionalCloseness(
          entityManager,
          'game:actor',
          'game:partner'
        )
      ).toThrow(InvalidArgumentError);

      expect(logger.error).toHaveBeenCalledWith(
        'Bidirectional validation failed for game:actor and game:partner',
        expect.objectContaining({
          error: expect.stringContaining('game:partner → game:actor'),
        })
      );
    });

    it('validates and logs when the relationship is reciprocal', () => {
      const entityManager = {
        getComponentData(requestedId, componentType) {
          if (componentType !== 'positioning:closeness') {
            return null;
          }

          if (requestedId === 'game:actor') {
            return { partners: ['game:partner'] };
          }

          if (requestedId === 'game:partner') {
            return { partners: ['game:actor'] };
          }

          return null;
        },
      };

      validator.validateBidirectionalCloseness(
        entityManager,
        'game:actor',
        'game:partner'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'Bidirectional closeness validated',
        expect.objectContaining({
          actorId: 'game:actor',
          partnerId: 'game:partner',
        })
      );
    });
  });
});
