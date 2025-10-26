import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DescriptionConfiguration } from '../../../../src/anatomy/configuration/descriptionConfiguration.js';

describe('DescriptionConfiguration', () => {
  let config;
  let mockAnatomyFormattingService;

  beforeEach(() => {
    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getPairedParts: jest.fn(),
      getIrregularPlurals: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should initialize with default values when no service provided', () => {
      config = new DescriptionConfiguration();
      expect(config.anatomyFormattingService).toBeNull();
      expect(config._defaultDescriptionOrder).toBeDefined();
      expect(config._defaultPairedParts).toBeDefined();
      expect(config._defaultIrregularPlurals).toBeDefined();
    });

    it('should accept anatomyFormattingService', () => {
      config = new DescriptionConfiguration(mockAnatomyFormattingService);
      expect(config.anatomyFormattingService).toBe(
        mockAnatomyFormattingService
      );
    });
  });

  describe('getDescriptionOrder', () => {
    it('should return service values when available', () => {
      const customOrder = ['hair', 'eye', 'face'];
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue(
        customOrder
      );
      config = new DescriptionConfiguration(mockAnatomyFormattingService);

      const result = config.getDescriptionOrder();
      expect(result).toEqual(customOrder);
      expect(
        mockAnatomyFormattingService.getDescriptionOrder
      ).toHaveBeenCalledTimes(1);
    });

    it('should return default values when service not provided', () => {
      config = new DescriptionConfiguration();
      const result = config.getDescriptionOrder();

      expect(result).toEqual([
        'height',
        'build',
        'body_composition',
        'body_hair',
        'skin_color',
        'hair',
        'eye',
        'face',
        'ear',
        'nose',
        'mouth',
        'neck',
        'breast',
        'torso',
        'arm',
        'hand',
        'leg',
        'foot',
        'tail',
        'wing',
        'activity',
      ]);
    });

    it('should return default values when service method not available', () => {
      config = new DescriptionConfiguration({});
      const result = config.getDescriptionOrder();

      expect(result.length).toBe(21);
      expect(result[0]).toBe('height');
    });

    it('should return a new array each time to prevent mutation', () => {
      config = new DescriptionConfiguration();
      const result1 = config.getDescriptionOrder();
      const result2 = config.getDescriptionOrder();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('DescriptionConfiguration - Activity Order', () => {
    it('should include activity in default description order', () => {
      config = new DescriptionConfiguration();
      const order = config.getDescriptionOrder();

      expect(order).toContain('activity');
    });

    it('should place activity at end of description order', () => {
      config = new DescriptionConfiguration();
      const order = config.getDescriptionOrder();

      const activityIndex = order.indexOf('activity');
      const lastIndex = order.length - 1;

      expect(activityIndex).toBe(lastIndex);
    });

    it('should allow activity order to be customized via anatomyFormattingService', () => {
      const mockFormattingService = {
        getDescriptionOrder: jest.fn(() => ['height', 'activity', 'breast']),
      };
      config = new DescriptionConfiguration(mockFormattingService);

      expect(config.getDescriptionOrder()).toEqual([
        'height',
        'activity',
        'breast',
      ]);
      expect(mockFormattingService.getDescriptionOrder).toHaveBeenCalled();
    });
  });

  describe('getPairedParts', () => {
    it('should return service values when available', () => {
      const customPaired = new Set(['eye', 'arm']);
      mockAnatomyFormattingService.getPairedParts.mockReturnValue(customPaired);
      config = new DescriptionConfiguration(mockAnatomyFormattingService);

      const result = config.getPairedParts();
      expect(result).toBe(customPaired);
      expect(mockAnatomyFormattingService.getPairedParts).toHaveBeenCalledTimes(
        1
      );
    });

    it('should return default values when service not provided', () => {
      config = new DescriptionConfiguration();
      const result = config.getPairedParts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(9);
      expect(result.has('eye')).toBe(true);
      expect(result.has('ear')).toBe(true);
      expect(result.has('arm')).toBe(true);
      expect(result.has('leg')).toBe(true);
      expect(result.has('hand')).toBe(true);
      expect(result.has('foot')).toBe(true);
      expect(result.has('breast')).toBe(true);
      expect(result.has('wing')).toBe(true);
      expect(result.has('testicle')).toBe(true);
    });

    it('should return default values when service method not available', () => {
      config = new DescriptionConfiguration({});
      const result = config.getPairedParts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(9);
    });

    it('should return a new Set each time to prevent mutation', () => {
      config = new DescriptionConfiguration();
      const result1 = config.getPairedParts();
      const result2 = config.getPairedParts();

      expect(result1).not.toBe(result2);
      expect([...result1]).toEqual([...result2]);
    });
  });

  describe('getIrregularPlurals', () => {
    it('should return service values when available', () => {
      const customPlurals = { hand: 'hands', mouse: 'mice' };
      mockAnatomyFormattingService.getIrregularPlurals.mockReturnValue(
        customPlurals
      );
      config = new DescriptionConfiguration(mockAnatomyFormattingService);

      const result = config.getIrregularPlurals();
      expect(result).toEqual(customPlurals);
      expect(
        mockAnatomyFormattingService.getIrregularPlurals
      ).toHaveBeenCalledTimes(1);
    });

    it('should return default values when service not provided', () => {
      config = new DescriptionConfiguration();
      const result = config.getIrregularPlurals();

      expect(result).toEqual({
        foot: 'feet',
        tooth: 'teeth',
      });
    });

    it('should return default values when service method not available', () => {
      config = new DescriptionConfiguration({});
      const result = config.getIrregularPlurals();

      expect(result).toEqual({
        foot: 'feet',
        tooth: 'teeth',
      });
    });

    it('should return a new object each time to prevent mutation', () => {
      config = new DescriptionConfiguration();
      const result1 = config.getIrregularPlurals();
      const result2 = config.getIrregularPlurals();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('immutability', () => {
    it('should not allow mutation of returned description order', () => {
      config = new DescriptionConfiguration();
      const order = config.getDescriptionOrder();
      const originalLength = order.length;

      order.push('test');

      const newOrder = config.getDescriptionOrder();
      expect(newOrder.length).toBe(originalLength);
      expect(newOrder).not.toContain('test');
    });

    it('should not allow mutation of returned paired parts', () => {
      config = new DescriptionConfiguration();
      const paired = config.getPairedParts();
      const originalSize = paired.size;

      paired.add('test');

      const newPaired = config.getPairedParts();
      expect(newPaired.size).toBe(originalSize);
      expect(newPaired.has('test')).toBe(false);
    });

    it('should not allow mutation of returned irregular plurals', () => {
      config = new DescriptionConfiguration();
      const plurals = config.getIrregularPlurals();

      plurals.test = 'tests';

      const newPlurals = config.getIrregularPlurals();
      expect(newPlurals.test).toBeUndefined();
    });
  });
});
