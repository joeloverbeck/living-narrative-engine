import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getDisplayName,
  getDescription,
} from '../../../../src/utils/displayHelpers.js';
import { DESCRIPTION_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

const LOG_PREFIX = '[DisplayHelpersTest]';

describe('displayHelpers', () => {
  let entityManager;
  let logger;

  beforeEach(() => {
    entityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
    };
    logger = { debug: jest.fn(), warn: jest.fn() };
  });

  describe('getDisplayName', () => {
    it('returns name from entity when available', () => {
      const entity = {
        id: 'e1',
        getComponentData: jest.fn(() => ({ text: 'Hero' })),
      };
      entityManager.getEntityInstance.mockReturnValue(entity);
      const name = getDisplayName(
        entityManager,
        'e1',
        'Unknown',
        logger,
        LOG_PREFIX
      );
      expect(name).toBe('Hero');
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('e1');
    });

    it('returns default when entity missing', () => {
      entityManager.getEntityInstance.mockReturnValue(null);
      const name = getDisplayName(
        entityManager,
        'missing',
        'Default',
        logger,
        LOG_PREFIX
      );
      expect(name).toBe('Default');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity with ID 'missing' not found")
      );
    });

    it('uses module default name when no fallback provided', () => {
      entityManager.getEntityInstance.mockReturnValue(null);

      const name = getDisplayName(
        entityManager,
        'missing',
        undefined,
        logger,
        LOG_PREFIX
      );

      expect(name).toBe('Unknown Entity');
      expect(logger.debug).toHaveBeenCalledWith(
        `${LOG_PREFIX} getDisplayName: Entity with ID 'missing' not found. Returning default name.`
      );
    });

    it('returns default when entityId is null', () => {
      const name = getDisplayName(
        entityManager,
        null,
        'Default',
        logger,
        LOG_PREFIX
      );
      expect(name).toBe('Default');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty entityId')
      );
    });
  });

  describe('getDescription', () => {
    it('returns description from component', () => {
      const entity = {
        id: 'i1',
        getComponentData: jest.fn(() => ({ text: 'desc' })),
      };
      entityManager.getEntityInstance.mockReturnValue(entity);
      const desc = getDescription(
        entityManager,
        'i1',
        'none',
        logger,
        LOG_PREFIX
      );
      expect(desc).toBe('desc');
      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('i1');
    });

    it.each([
      ['missing component data', null],
      ['non-string component text', { text: 123 }],
    ])(
      'falls back to default when entity has %s',
      (_scenario, componentData) => {
        const entity = {
          id: 'e2',
          getComponentData: jest.fn(() => componentData),
        };
        entityManager.getEntityInstance.mockReturnValue(entity);

        const fallback = 'fallback description';
        const desc = getDescription(
          entityManager,
          'e2',
          fallback,
          logger,
          LOG_PREFIX
        );

        expect(desc).toBe(fallback);
        expect(entity.getComponentData).toHaveBeenCalledWith(
          DESCRIPTION_COMPONENT_ID
        );
        expect(logger.debug).toHaveBeenCalledTimes(1);
        expect(logger.debug).toHaveBeenCalledWith(
          `${LOG_PREFIX} getDescription: Entity 'e2' found, but no valid DESCRIPTION_COMPONENT_ID data. Returning default description.`
        );
      }
    );

    it('returns default when entity missing', () => {
      entityManager.getEntityInstance.mockReturnValue(null);
      const desc = getDescription(
        entityManager,
        'missing',
        'none',
        logger,
        LOG_PREFIX
      );
      expect(desc).toBe('none');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Entity with ID 'missing' not found")
      );
    });

    it('uses module default description when no fallback provided', () => {
      entityManager.getEntityInstance.mockReturnValue(null);

      const desc = getDescription(
        entityManager,
        'missing',
        undefined,
        logger,
        LOG_PREFIX
      );

      expect(desc).toBe('');
      expect(logger.debug).toHaveBeenCalledWith(
        `${LOG_PREFIX} getDescription: Entity with ID 'missing' not found. Returning default description.`
      );
    });

    it('returns default when entityId is null', () => {
      const desc = getDescription(
        entityManager,
        null,
        'none',
        logger,
        LOG_PREFIX
      );
      expect(desc).toBe('none');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('called with null or empty entityId')
      );
    });
  });
});
