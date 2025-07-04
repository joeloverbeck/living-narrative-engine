import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';

/**
 * Additional branch coverage tests for BodyPartDescriptionBuilder.
 */
describe('BodyPartDescriptionBuilder branch coverage', () => {
  let descriptorFormatter;
  let builder;

  beforeEach(() => {
    descriptorFormatter = {
      extractDescriptors: jest.fn(() => []),
      formatDescriptors: jest.fn(() => 'desc'),
    };
    builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
  });

  describe('buildDescription edge cases', () => {
    it('returns empty string when entity is falsy', () => {
      expect(builder.buildDescription(null)).toBe('');
    });

    it('returns empty string when components missing and no getComponentData', () => {
      const result = builder.buildDescription({});
      expect(result).toBe('');
    });

    it('returns empty string when anatomy part missing', () => {
      const result = builder.buildDescription({ components: {} });
      expect(result).toBe('');
    });
  });

  describe('buildMultipleDescription branches', () => {
    it('returns empty string when called with no entities', () => {
      expect(builder.buildMultipleDescription([], 'arm')).toBe('');
    });

    it('delegates to buildDescription when single entity provided', () => {
      const spy = jest
        .spyOn(builder, 'buildDescription')
        .mockReturnValue('one');
      const entity = { components: { 'anatomy:part': { subType: 'arm' } } };
      const result = builder.buildMultipleDescription([entity], 'arm');
      expect(result).toBe('one');
      expect(spy).toHaveBeenCalledWith(entity);
    });

    it('returns array when descriptors identical but subtype not paired', () => {
      descriptorFormatter.extractDescriptors.mockReturnValue([]);
      descriptorFormatter.formatDescriptors.mockReturnValue('same');
      const entities = [
        { components: { 'anatomy:part': { subType: 'tail' } } },
        { components: { 'anatomy:part': { subType: 'tail' } } },
      ];
      // 'tail' is not in the default paired parts set
      const result = builder.buildMultipleDescription(entities, 'tail');
      expect(result).toEqual(['same', 'same']);
    });
  });
});
