import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getDisplayName,
  getDescription,
} from '../../../../src/utils/displayHelpers.js';

const LOG_PREFIX = '[DisplayHelpersTest]';

describe('displayHelpers', () => {
  let entityManager;
  let logger;

  beforeEach(() => {
    entityManager = { getEntityInstance: jest.fn() };
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
