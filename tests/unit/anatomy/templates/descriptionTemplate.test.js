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

    it('should initialize with partDescriptionGenerator when provided', () => {
      const mockGenerator = {
        generatePartDescription: jest.fn(),
      };
      const templateWithGenerator = new DescriptionTemplate({
        config: mockConfig,
        partDescriptionGenerator: mockGenerator,
      });
      expect(templateWithGenerator.partDescriptionGenerator).toBe(mockGenerator);
    });

    it('should initialize partDescriptionGenerator as null when not provided', () => {
      const templateWithoutGenerator = new DescriptionTemplate({
        config: mockConfig,
      });
      expect(templateWithoutGenerator.partDescriptionGenerator).toBeNull();
    });

    it('should handle constructor with no parameters', () => {
      const templateWithDefaults = new DescriptionTemplate();
      expect(templateWithDefaults.config).toBeUndefined();
      expect(templateWithDefaults.textFormatter).toBeDefined();
      expect(templateWithDefaults.strategyFactory).toBeDefined();
      expect(templateWithDefaults.partDescriptionGenerator).toBeNull();
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

    it('should use partDescriptionGenerator when no persisted description exists', () => {
      const mockGenerator = {
        generatePartDescription: jest.fn().mockReturnValue('generated description'),
      };
      const templateWithGenerator = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: mockTextFormatter,
        strategyFactory: mockStrategyFactory,
        partDescriptionGenerator: mockGenerator,
      });

      const parts = [
        {
          id: 'part1',
          getComponentData: jest.fn().mockReturnValue(null),
        },
        {
          id: 'part2',
          getComponentData: jest.fn().mockReturnValue({ text: '' }),
        },
      ];

      const result = templateWithGenerator.extractDescriptions(parts);
      
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledWith('part1');
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledWith('part2');
      expect(result).toEqual(['generated description', 'generated description']);
    });

    it('should handle partDescriptionGenerator errors gracefully', () => {
      const mockGenerator = {
        generatePartDescription: jest.fn().mockImplementation(() => {
          throw new Error('Generation failed');
        }),
      };
      const templateWithGenerator = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: mockTextFormatter,
        strategyFactory: mockStrategyFactory,
        partDescriptionGenerator: mockGenerator,
      });

      const parts = [
        {
          id: 'part1',
          getComponentData: jest.fn().mockReturnValue(null),
        },
      ];

      const result = templateWithGenerator.extractDescriptions(parts);
      
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledWith('part1');
      expect(result).toEqual([]);
    });

    it('should handle partDescriptionGenerator returning null or empty string', () => {
      const mockGenerator = {
        generatePartDescription: jest.fn()
          .mockReturnValueOnce(null)
          .mockReturnValueOnce('')
          .mockReturnValueOnce(undefined),
      };
      const templateWithGenerator = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: mockTextFormatter,
        strategyFactory: mockStrategyFactory,
        partDescriptionGenerator: mockGenerator,
      });

      const parts = [
        {
          id: 'part1',
          getComponentData: jest.fn().mockReturnValue(null),
        },
        {
          id: 'part2',
          getComponentData: jest.fn().mockReturnValue(null),
        },
        {
          id: 'part3',
          getComponentData: jest.fn().mockReturnValue(null),
        },
      ];

      const result = templateWithGenerator.extractDescriptions(parts);
      
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    it('should not use partDescriptionGenerator for parts without id', () => {
      const mockGenerator = {
        generatePartDescription: jest.fn(),
      };
      const templateWithGenerator = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: mockTextFormatter,
        strategyFactory: mockStrategyFactory,
        partDescriptionGenerator: mockGenerator,
      });

      const parts = [
        {
          getComponentData: jest.fn().mockReturnValue(null),
        },
      ];

      const result = templateWithGenerator.extractDescriptions(parts);
      
      expect(mockGenerator.generatePartDescription).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should prefer persisted descriptions over generated ones', () => {
      const mockGenerator = {
        generatePartDescription: jest.fn().mockReturnValue('generated description'),
      };
      const templateWithGenerator = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: mockTextFormatter,
        strategyFactory: mockStrategyFactory,
        partDescriptionGenerator: mockGenerator,
      });

      const parts = [
        {
          id: 'part1',
          getComponentData: jest.fn().mockReturnValue({ text: 'persisted description' }),
        },
      ];

      const result = templateWithGenerator.extractDescriptions(parts);
      
      expect(mockGenerator.generatePartDescription).not.toHaveBeenCalled();
      expect(result).toEqual(['persisted description']);
    });

    it('should handle mixed scenario with some persisted and some generated descriptions', () => {
      const mockGenerator = {
        generatePartDescription: jest.fn()
          .mockReturnValueOnce('generated for part2')
          .mockReturnValueOnce('generated for part4'),
      };
      const templateWithGenerator = new DescriptionTemplate({
        config: mockConfig,
        textFormatter: mockTextFormatter,
        strategyFactory: mockStrategyFactory,
        partDescriptionGenerator: mockGenerator,
      });

      const parts = [
        {
          id: 'part1',
          getComponentData: jest.fn().mockReturnValue({ text: 'persisted 1' }),
        },
        {
          id: 'part2',
          getComponentData: jest.fn().mockReturnValue(null),
        },
        {
          id: 'part3',
          getComponentData: jest.fn().mockReturnValue({ text: 'persisted 3' }),
        },
        {
          id: 'part4',
          getComponentData: jest.fn().mockReturnValue({ text: '' }),
        },
      ];

      const result = templateWithGenerator.extractDescriptions(parts);
      
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledWith('part2');
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledWith('part4');
      expect(mockGenerator.generatePartDescription).toHaveBeenCalledTimes(2);
      expect(result).toEqual(['persisted 1', 'generated for part2', 'persisted 3', 'generated for part4']);
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
