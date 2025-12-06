import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  PartGroupingStrategy,
  SinglePartStrategy,
  PairedPartsStrategy,
  MultiplePartsStrategy,
  PartGroupingStrategyFactory,
} from '../../../../src/anatomy/configuration/partGroupingStrategies.js';

describe('PartGroupingStrategies', () => {
  let mockTextFormatter;
  let mockConfig;
  let mockPart;

  beforeEach(() => {
    mockTextFormatter = {
      capitalize: jest.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
      getPartLabel: jest
        .fn()
        .mockImplementation((type, count, pluralizer, paired) => {
          if (count > 1 && paired.has(type)) {
            return mockTextFormatter.capitalize(pluralizer(type));
          }
          return mockTextFormatter.capitalize(type);
        }),
      formatLabelValue: jest.fn((label, value) => `${label}: ${value}`),
      formatIndexedItem: jest.fn(
        (type, index, desc) =>
          `${mockTextFormatter.capitalize(type)} ${index}: ${desc}`
      ),
      formatSidedItem: jest.fn(
        (side, type, desc) => `${side} ${type}: ${desc}`
      ),
      joinLines: jest.fn((lines) => lines.join('\n')),
    };

    mockConfig = {
      getPairedParts: jest
        .fn()
        .mockReturnValue(
          new Set([
            'eye',
            'ear',
            'arm',
            'leg',
            'hand',
            'foot',
            'breast',
            'wing',
          ])
        ),
      getIrregularPlurals: jest
        .fn()
        .mockReturnValue({ foot: 'feet', tooth: 'teeth' }),
    };

    mockPart = {
      getComponentData: jest.fn(),
    };
  });

  describe('PartGroupingStrategy base class', () => {
    it('should throw error when canHandle not implemented', () => {
      const strategy = new PartGroupingStrategy();
      expect(() => strategy.canHandle()).toThrow(
        'canHandle must be implemented by subclass'
      );
    });

    it('should throw error when format not implemented', () => {
      const strategy = new PartGroupingStrategy();
      expect(() => strategy.format()).toThrow(
        'format must be implemented by subclass'
      );
    });
  });

  describe('SinglePartStrategy', () => {
    let strategy;

    beforeEach(() => {
      strategy = new SinglePartStrategy();
    });

    describe('canHandle', () => {
      it('should return true for single description', () => {
        const result = strategy.canHandle(
          'arm',
          [mockPart],
          ['strong arm'],
          mockConfig
        );
        expect(result).toBe(true);
      });

      it('should return false for multiple descriptions', () => {
        const result = strategy.canHandle(
          'arm',
          [mockPart, mockPart],
          ['arm1', 'arm2'],
          mockConfig
        );
        expect(result).toBe(false);
      });

      it('should return false for empty descriptions', () => {
        const result = strategy.canHandle('arm', [], [], mockConfig);
        expect(result).toBe(false);
      });
    });

    describe('format', () => {
      it('should format single part correctly', () => {
        const result = strategy.format(
          'arm',
          [mockPart],
          ['strong arm'],
          mockTextFormatter,
          mockConfig
        );
        expect(mockTextFormatter.getPartLabel).toHaveBeenCalledWith(
          'arm',
          1,
          expect.any(Function),
          new Set()
        );
        const pluralizerFn = mockTextFormatter.getPartLabel.mock.calls[0][2];
        expect(pluralizerFn()).toBe('arm');
        expect(mockTextFormatter.formatLabelValue).toHaveBeenCalledWith(
          'Arm',
          'strong arm'
        );
        expect(result).toBe('Arm: strong arm');
      });
    });
  });

  describe('PairedPartsStrategy', () => {
    let strategy;

    beforeEach(() => {
      strategy = new PairedPartsStrategy();
    });

    describe('canHandle', () => {
      it('should return true for paired part with 2 descriptions', () => {
        const result = strategy.canHandle(
          'eye',
          [mockPart, mockPart],
          ['blue', 'green'],
          mockConfig
        );
        expect(result).toBe(true);
      });

      it('should return false for non-paired part', () => {
        mockConfig.getPairedParts.mockReturnValue(new Set(['eye']));
        const result = strategy.canHandle(
          'torso',
          [mockPart],
          ['muscular'],
          mockConfig
        );
        expect(result).toBe(false);
      });

      it('should return false for wrong number of descriptions', () => {
        const result = strategy.canHandle(
          'eye',
          [mockPart],
          ['blue'],
          mockConfig
        );
        expect(result).toBe(false);
      });
    });

    describe('format', () => {
      it('should format identical paired parts with plural label', () => {
        const result = strategy.format(
          'eye',
          [mockPart, mockPart],
          ['blue eyes', 'blue eyes'],
          mockTextFormatter,
          mockConfig
        );
        expect(mockTextFormatter.getPartLabel).toHaveBeenCalledWith(
          'eye',
          2,
          expect.any(Function),
          expect.any(Set)
        );
        expect(mockTextFormatter.formatLabelValue).toHaveBeenCalledWith(
          'Eyes',
          'blue eyes'
        );
        expect(result).toBe('Eyes: blue eyes');
      });

      it('should format different paired parts with left/right labels', () => {
        const leftPart = {
          getComponentData: jest.fn().mockReturnValue({ text: 'left eye' }),
        };
        const rightPart = {
          getComponentData: jest.fn().mockReturnValue({ text: 'right eye' }),
        };

        const result = strategy.format(
          'eye',
          [leftPart, rightPart],
          ['blue eye', 'green eye'],
          mockTextFormatter,
          mockConfig
        );
        expect(mockTextFormatter.formatSidedItem).toHaveBeenCalledWith(
          'Left',
          'eye',
          'blue eye'
        );
        expect(mockTextFormatter.formatSidedItem).toHaveBeenCalledWith(
          'Right',
          'eye',
          'green eye'
        );
        expect(mockTextFormatter.joinLines).toHaveBeenCalledWith([
          'Left eye: blue eye',
          'Right eye: green eye',
        ]);
      });

      it('should fallback to indexed format when no left/right in names', () => {
        mockPart.getComponentData.mockReturnValue({ text: 'eye' });

        const result = strategy.format(
          'eye',
          [mockPart, mockPart],
          ['blue eye', 'green eye'],
          mockTextFormatter,
          mockConfig
        );
        expect(mockTextFormatter.formatIndexedItem).toHaveBeenCalledWith(
          'eye',
          1,
          'blue eye'
        );
        expect(mockTextFormatter.formatIndexedItem).toHaveBeenCalledWith(
          'eye',
          2,
          'green eye'
        );
      });

      it('should handle parts without name component', () => {
        mockPart.getComponentData.mockReturnValue(null);

        const result = strategy.format(
          'eye',
          [mockPart, mockPart],
          ['blue eye', 'green eye'],
          mockTextFormatter,
          mockConfig
        );
        expect(mockTextFormatter.formatIndexedItem).toHaveBeenCalledTimes(2);
      });

      it('should handle irregular plural forms', () => {
        const result = strategy.format(
          'foot',
          [mockPart, mockPart],
          ['large foot', 'large foot'],
          mockTextFormatter,
          mockConfig
        );

        // Get the pluralizer function that was passed to getPartLabel
        const pluralizerCall = mockTextFormatter.getPartLabel.mock.calls[0];
        const pluralizerFn = pluralizerCall[2]; // It's the third parameter, not second

        expect(pluralizerFn('foot')).toBe('feet');
      });
    });
  });

  describe('MultiplePartsStrategy', () => {
    let strategy;

    beforeEach(() => {
      strategy = new MultiplePartsStrategy();
    });

    describe('canHandle', () => {
      it('should return true for any non-empty descriptions', () => {
        expect(
          strategy.canHandle('tentacle', [mockPart], ['slimy'], mockConfig)
        ).toBe(true);
        expect(
          strategy.canHandle(
            'wing',
            [mockPart, mockPart, mockPart],
            ['a', 'b', 'c'],
            mockConfig
          )
        ).toBe(true);
      });

      it('should return false for empty descriptions', () => {
        expect(strategy.canHandle('tentacle', [], [], mockConfig)).toBe(false);
      });
    });

    describe('format', () => {
      it('should format multiple identical parts with plural label', () => {
        const parts = [mockPart, mockPart, mockPart];
        const descriptions = [
          'feathered wing',
          'feathered wing',
          'feathered wing',
        ];

        const result = strategy.format(
          'wing',
          parts,
          descriptions,
          mockTextFormatter,
          mockConfig
        );
        expect(mockTextFormatter.getPartLabel).toHaveBeenCalledWith(
          'wing',
          3,
          expect.any(Function),
          expect.any(Set)
        );
        expect(mockTextFormatter.formatLabelValue).toHaveBeenCalledWith(
          'Wings',
          'feathered wing'
        );
      });

      it('should use irregular plural forms when available', () => {
        const parts = [mockPart, mockPart];
        const descriptions = ['agile foot', 'agile foot'];

        const result = strategy.format(
          'foot',
          parts,
          descriptions,
          mockTextFormatter,
          mockConfig
        );

        expect(mockTextFormatter.getPartLabel).toHaveBeenCalledWith(
          'foot',
          2,
          expect.any(Function),
          expect.any(Set)
        );
        const pluralizerFn = mockTextFormatter.getPartLabel.mock.calls[0][2];
        expect(pluralizerFn('foot')).toBe('feet');
        expect(mockTextFormatter.formatLabelValue).toHaveBeenCalledWith(
          'Feet',
          'agile foot'
        );
        expect(result).toBe('Feet: agile foot');
      });

      it('should format multiple different parts with indexed items', () => {
        const parts = [mockPart, mockPart, mockPart];
        const descriptions = [
          'red tentacle',
          'blue tentacle',
          'green tentacle',
        ];

        const result = strategy.format(
          'tentacle',
          parts,
          descriptions,
          mockTextFormatter,
          mockConfig
        );
        expect(mockTextFormatter.formatIndexedItem).toHaveBeenCalledWith(
          'tentacle',
          1,
          'red tentacle'
        );
        expect(mockTextFormatter.formatIndexedItem).toHaveBeenCalledWith(
          'tentacle',
          2,
          'blue tentacle'
        );
        expect(mockTextFormatter.formatIndexedItem).toHaveBeenCalledWith(
          'tentacle',
          3,
          'green tentacle'
        );
        expect(mockTextFormatter.joinLines).toHaveBeenCalled();
      });
    });
  });

  describe('PartGroupingStrategyFactory', () => {
    let factory;

    beforeEach(() => {
      factory = new PartGroupingStrategyFactory();
    });

    it('should return SinglePartStrategy for single part', () => {
      const strategy = factory.getStrategy(
        'arm',
        [mockPart],
        ['strong arm'],
        mockConfig
      );
      expect(strategy).toBeInstanceOf(SinglePartStrategy);
    });

    it('should return PairedPartsStrategy for paired parts with 2 descriptions', () => {
      const strategy = factory.getStrategy(
        'eye',
        [mockPart, mockPart],
        ['blue', 'green'],
        mockConfig
      );
      expect(strategy).toBeInstanceOf(PairedPartsStrategy);
    });

    it('should return MultiplePartsStrategy for multiple parts', () => {
      const strategy = factory.getStrategy(
        'tentacle',
        [mockPart, mockPart, mockPart],
        ['a', 'b', 'c'],
        mockConfig
      );
      expect(strategy).toBeInstanceOf(MultiplePartsStrategy);
    });

    it('should return MultiplePartsStrategy for non-paired parts with 2 descriptions', () => {
      mockConfig.getPairedParts.mockReturnValue(new Set()); // No paired parts
      const strategy = factory.getStrategy(
        'tentacle',
        [mockPart, mockPart],
        ['a', 'b'],
        mockConfig
      );
      expect(strategy).toBeInstanceOf(MultiplePartsStrategy);
    });

    it('should have correct number of strategies', () => {
      expect(factory.strategies).toHaveLength(3);
    });

    it('should throw an error when no strategy can handle the configuration', () => {
      expect(() => factory.getStrategy('arm', [], [], mockConfig)).toThrow(
        'No strategy found for part type: arm'
      );
    });
  });
});
