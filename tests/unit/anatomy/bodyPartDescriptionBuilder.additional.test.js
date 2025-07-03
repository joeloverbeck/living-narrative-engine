import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';

/**
 * Additional coverage tests for BodyPartDescriptionBuilder focusing on
 * getPlural and helper logic when entities expose getComponentData.
 */
describe('BodyPartDescriptionBuilder additional coverage', () => {
  let descriptorFormatter;

  beforeEach(() => {
    descriptorFormatter = {
      extractDescriptors: jest.fn((comps) => comps),
      formatDescriptors: jest.fn(() => 'formatted'),
    };
  });

  describe('buildDescription with getComponentData enumeration', () => {
    it('collects components via getComponentData and ignores errors', () => {
      const entity = {
        getComponentData: jest.fn((id) => {
          if (id === 'anatomy:part') return { subType: 'eye' };
          if (id === 'descriptors:color_basic') return { value: 'blue' };
          if (id === 'descriptors:firmness') throw new Error('missing');
          return null;
        }),
      };

      const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
      const result = builder.buildDescription(entity);

      expect(result).toBe('formatted');
      expect(entity.getComponentData).toHaveBeenCalledWith(
        'descriptors:firmness'
      );
      expect(descriptorFormatter.extractDescriptors).toHaveBeenCalledWith(
        expect.objectContaining({
          'anatomy:part': { subType: 'eye' },
          'descriptors:color_basic': { value: 'blue' },
        })
      );
    });
  });

  describe('buildMultipleDescription paired logic', () => {
    it('returns single descriptor when all descriptors match for paired parts', () => {
      descriptorFormatter.extractDescriptors.mockReturnValue([]);
      descriptorFormatter.formatDescriptors.mockReturnValue('same');

      const entities = [
        { components: { 'anatomy:part': { subType: 'arm' } } },
        { components: { 'anatomy:part': { subType: 'arm' } } },
      ];
      const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
      const result = builder.buildMultipleDescription(entities, 'arm');
      expect(result).toBe('same');
    });

    it('returns array of descriptors when descriptors differ', () => {
      descriptorFormatter.extractDescriptors
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);
      descriptorFormatter.formatDescriptors
        .mockReturnValueOnce('red')
        .mockReturnValueOnce('blue');

      const entities = [
        { components: { 'anatomy:part': { subType: 'arm' } } },
        { components: { 'anatomy:part': { subType: 'arm' } } },
      ];
      const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
      const result = builder.buildMultipleDescription(entities, 'arm');
      expect(result).toEqual(['red', 'blue']);
    });
  });

  describe('getPlural', () => {
    it('uses default irregular plurals', () => {
      const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
      expect(builder.getPlural('foot')).toBe('feet');
    });

    it('uses custom irregular plurals when provided', () => {
      const service = { getIrregularPlurals: () => ({ tooth: 'teef' }) };
      const builder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
        anatomyFormattingService: service,
      });
      expect(builder.getPlural('tooth')).toBe('teef');
    });

    it('applies "es" rule', () => {
      const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
      expect(builder.getPlural('box')).toBe('boxes');
    });

    it('applies "ies" rule', () => {
      const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
      expect(builder.getPlural('party')).toBe('parties');
    });

    it('defaults to adding "s"', () => {
      const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
      expect(builder.getPlural('dog')).toBe('dogs');
    });
  });
});
