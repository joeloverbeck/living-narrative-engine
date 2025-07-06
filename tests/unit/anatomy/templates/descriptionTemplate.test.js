import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DescriptionTemplate } from '../../../../src/anatomy/templates/descriptionTemplate.js';

describe('DescriptionTemplate', () => {
  let template;
  let mockConfig;
  let mockTextFormatter;
  let mockStrategyFactory;
  let mockStrategy;

  beforeEach(() => {
    mockConfig = {
      getPairedParts: jest.fn().mockReturnValue(new Set(['eye', 'arm'])),
      getIrregularPlurals: jest
        .fn()
        .mockReturnValue({ foot: 'feet', tooth: 'teeth' }),
    };

    mockTextFormatter = {
      capitalize: jest.fn(),
      getPartLabel: jest.fn(),
      formatLabelValue: jest.fn(),
      formatIndexedItem: jest.fn(),
      formatSidedItem: jest.fn(),
      joinLines: jest.fn(),
    };

    mockStrategy = {
      canHandle: jest.fn(),
      format: jest.fn().mockReturnValue('formatted description'),
    };

    mockStrategyFactory = {
      getStrategy: jest.fn().mockReturnValue(mockStrategy),
    };

    template = new DescriptionTemplate({
      config: mockConfig,
      textFormatter: mockTextFormatter,
      strategyFactory: mockStrategyFactory,
    });
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(template.config).toBe(mockConfig);
      expect(template.textFormatter).toBe(mockTextFormatter);
      expect(template.strategyFactory).toBe(mockStrategyFactory);
    });

    it('should create default instances if not provided', () => {
      const defaultTemplate = new DescriptionTemplate({ config: mockConfig });
      expect(defaultTemplate.config).toBe(mockConfig);
      expect(defaultTemplate.textFormatter).toBeDefined();
      expect(defaultTemplate.strategyFactory).toBeDefined();
    });
  });

  describe('extractDescriptions', () => {
    it('should extract descriptions from parts with getComponentData', () => {
      const parts = [
        {
          getComponentData: jest
            .fn()
            .mockReturnValue({ text: 'description 1' }),
        },
        {
          getComponentData: jest
            .fn()
            .mockReturnValue({ text: 'description 2' }),
        },
      ];

      const result = template.extractDescriptions(parts);
      expect(result).toEqual(['description 1', 'description 2']);
      expect(parts[0].getComponentData).toHaveBeenCalledWith(
        'core:description'
      );
      expect(parts[1].getComponentData).toHaveBeenCalledWith(
        'core:description'
      );
    });

    it('should filter out empty descriptions', () => {
      const parts = [
        {
          getComponentData: jest
            .fn()
            .mockReturnValue({ text: 'description 1' }),
        },
        {
          getComponentData: jest.fn().mockReturnValue({ text: '' }),
        },
        {
          getComponentData: jest.fn().mockReturnValue(null),
        },
      ];

      const result = template.extractDescriptions(parts);
      expect(result).toEqual(['description 1']);
    });

    it('should handle parts without getComponentData', () => {
      const parts = [{ someOtherMethod: jest.fn() }, null, undefined];

      const result = template.extractDescriptions(parts);
      expect(result).toEqual([]);
    });

    it('should handle empty parts array', () => {
      const result = template.extractDescriptions([]);
      expect(result).toEqual([]);
    });
  });

  describe('formatDescription', () => {
    let mockParts;

    beforeEach(() => {
      mockParts = [
        {
          getComponentData: jest.fn().mockReturnValue({ text: 'blue eyes' }),
        },
        {
          getComponentData: jest.fn().mockReturnValue({ text: 'green eyes' }),
        },
      ];
    });

    it('should return empty string for null parts', () => {
      const result = template.formatDescription('eye', null);
      expect(result).toBe('');
    });

    it('should return empty string for empty parts array', () => {
      const result = template.formatDescription('eye', []);
      expect(result).toBe('');
    });

    it('should return empty string when no descriptions found', () => {
      const partsWithNoDesc = [
        {
          getComponentData: jest.fn().mockReturnValue(null),
        },
      ];
      const result = template.formatDescription('eye', partsWithNoDesc);
      expect(result).toBe('');
    });

    it('should get strategy and format using it', () => {
      const result = template.formatDescription('eye', mockParts);

      expect(mockStrategyFactory.getStrategy).toHaveBeenCalledWith(
        'eye',
        mockParts,
        ['blue eyes', 'green eyes'],
        mockConfig
      );
      expect(mockStrategy.format).toHaveBeenCalledWith(
        'eye',
        mockParts,
        ['blue eyes', 'green eyes'],
        mockTextFormatter,
        mockConfig
      );
      expect(result).toBe('formatted description');
    });
  });

  describe('createStructuredLine', () => {
    it('should delegate to formatDescription', () => {
      const mockParts = [
        {
          getComponentData: jest.fn().mockReturnValue({ text: 'strong arm' }),
        },
      ];

      // Spy on formatDescription
      const formatDescriptionSpy = jest.spyOn(template, 'formatDescription');

      const result = template.createStructuredLine('arm', mockParts);

      expect(formatDescriptionSpy).toHaveBeenCalledWith('arm', mockParts);
      expect(result).toBe('formatted description');
    });
  });

  describe('integration with real strategy', () => {
    it('should format single part correctly', async () => {
      const { TextFormatter } = await import(
        '../../../../src/anatomy/templates/textFormatter.js'
      );
      const { PartGroupingStrategyFactory } = await import(
        '../../../../src/anatomy/configuration/partGroupingStrategies.js'
      );

      const realTemplate = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: new TextFormatter(),
        strategyFactory: new PartGroupingStrategyFactory(),
      });

      const parts = [
        {
          getComponentData: jest
            .fn()
            .mockReturnValue({ text: 'muscular torso' }),
        },
      ];

      const result = realTemplate.formatDescription('torso', parts);
      expect(result).toBe('Torso: muscular torso');
    });

    it('should format paired parts correctly', async () => {
      const { TextFormatter } = await import(
        '../../../../src/anatomy/templates/textFormatter.js'
      );
      const { PartGroupingStrategyFactory } = await import(
        '../../../../src/anatomy/configuration/partGroupingStrategies.js'
      );

      const realTemplate = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: new TextFormatter(),
        strategyFactory: new PartGroupingStrategyFactory(),
      });

      const parts = [
        {
          getComponentData: jest.fn().mockImplementation((type) => {
            if (type === 'core:description') return { text: 'blue eyes' };
            if (type === 'core:name') return { text: 'left eye' };
            return null;
          }),
        },
        {
          getComponentData: jest.fn().mockImplementation((type) => {
            if (type === 'core:description') return { text: 'blue eyes' };
            if (type === 'core:name') return { text: 'right eye' };
            return null;
          }),
        },
      ];

      const result = realTemplate.formatDescription('eye', parts);
      expect(result).toBe('Eyes: blue eyes');
    });
  });
});
