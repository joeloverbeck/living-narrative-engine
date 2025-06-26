import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  buildPortraitPath,
  buildAltText,
  buildPortraitInfo,
} from '../../../../src/entities/utils/portraitUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

const LOG_PREFIX = '[EntityDisplayDataProvider]';

describe('portraitUtils', () => {
  describe('buildPortraitPath', () => {
    it('constructs a mod-relative path', () => {
      expect(buildPortraitPath('core', 'img.png')).toBe(
        '/data/mods/core/img.png'
      );
    });
  });

  describe('buildAltText', () => {
    it('trims non-blank text', () => {
      expect(buildAltText('  hero  ')).toBe('hero');
    });

    it('returns null for blank text', () => {
      expect(buildAltText('')).toBeNull();
      expect(buildAltText('   ')).toBeNull();
    });
  });

  describe('buildPortraitInfo', () => {
    let logger;
    let dispatcher;

    beforeEach(() => {
      logger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      dispatcher = { dispatch: jest.fn() };
      safeDispatchError.mockClear();
    });

    it('returns path and alt text when data valid', () => {
      const entity = {
        id: 'e1',
        definitionId: 'core:test',
        getComponentData: jest.fn(() => ({
          imagePath: 'img.png',
          altText: ' alt ',
        })),
      };

      const result = buildPortraitInfo(
        entity,
        'getEntityPortraitPath',
        logger,
        dispatcher,
        LOG_PREFIX
      );

      expect(result).toEqual({
        path: '/data/mods/core/img.png',
        altText: 'alt',
      });
      expect(logger.debug).toHaveBeenCalledWith(
        `${LOG_PREFIX} getEntityPortraitPath: Constructed portrait path for 'e1': /data/mods/core/img.png`
      );
      expect(safeDispatchError).not.toHaveBeenCalled();
    });

    it('returns null when portrait component missing', () => {
      const entity = {
        id: 'e1',
        definitionId: 'core:test',
        getComponentData: jest.fn(() => undefined),
      };

      const result = buildPortraitInfo(
        entity,
        'getEntityPortraitPath',
        logger,
        dispatcher,
        LOG_PREFIX
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        `${LOG_PREFIX} getEntityPortraitPath: Entity 'e1' has no valid PORTRAIT_COMPONENT_ID data or imagePath.`
      );
    });

    it('returns null and warns when definitionId invalid', () => {
      const entity = {
        id: 'e1',
        definitionId: '',
        getComponentData: jest.fn(() => ({ imagePath: 'img.png' })),
      };

      const result = buildPortraitInfo(
        entity,
        'getEntityPortraitPath',
        logger,
        dispatcher,
        LOG_PREFIX
      );

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} getEntityPortraitPath: Invalid or missing definitionId. Expected string, got:`,
        ''
      );
    });

    it('dispatches error when mod id cannot be extracted', () => {
      const entity = {
        id: 'e1',
        definitionId: 'badformat',
        getComponentData: jest.fn(() => ({ imagePath: 'img.png' })),
      };

      const result = buildPortraitInfo(
        entity,
        'getEntityPortraitPath',
        logger,
        dispatcher,
        LOG_PREFIX
      );

      expect(result).toBeNull();
      expect(safeDispatchError).toHaveBeenCalledWith(
        dispatcher,
        "Entity definitionId 'badformat' has invalid format. Expected format 'modId:entityName'.",
        expect.any(Object),
        logger
      );
    });
  });
});
