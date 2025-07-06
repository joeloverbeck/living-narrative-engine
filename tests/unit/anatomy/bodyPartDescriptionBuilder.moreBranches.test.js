import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';

/**
 * Additional branch coverage for BodyPartDescriptionBuilder.
 */
describe('BodyPartDescriptionBuilder more branches', () => {
  let descriptorFormatter;

  beforeEach(() => {
    descriptorFormatter = {
      extractDescriptors: jest.fn(() => []),
      formatDescriptors: jest.fn((descs) =>
        Array.isArray(descs) ? descs.join('-') : 'formatted'
      ),
    };
  });

  it('filters empty descriptors and skips null entities', () => {
    descriptorFormatter.extractDescriptors
      .mockReturnValueOnce(['red'])
      .mockReturnValueOnce(['blue']);

    const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
    const entities = [
      { components: { 'anatomy:part': { subType: 'wing' } } },
      null,
      { components: { 'anatomy:part': { subType: 'wing' } } },
    ];

    const result = builder.buildMultipleDescription(entities, 'wing');
    expect(result).toEqual(['red', 'blue']);
  });

  it('uses custom paired parts from formatting service', () => {
    descriptorFormatter.extractDescriptors.mockReturnValue([]);
    descriptorFormatter.formatDescriptors.mockReturnValue('same');
    const service = { getPairedParts: () => new Set(['tail']) };
    const builder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService: service,
    });
    const entities = [
      { components: { 'anatomy:part': { subType: 'tail' } } },
      { components: { 'anatomy:part': { subType: 'tail' } } },
    ];
    const result = builder.buildMultipleDescription(entities, 'tail');
    expect(result).toBe('same');
  });

  it('falls back to default plural rules when irregular map missing', () => {
    const service = { getIrregularPlurals: () => ({}) };
    const builder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService: service,
    });
    expect(builder.getPlural('brush')).toBe('brushes');
    expect(builder.getPlural('key')).toBe('keys');
  });
});
