import { describe, it, expect, jest } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';

/**
 * Tests targeting previously uncovered branches in BodyPartDescriptionBuilder.
 */

describe('BodyPartDescriptionBuilder uncovered branches', () => {
  it('collects components using getComponentData for multiple entities', () => {
    const descriptorFormatter = {
      extractDescriptors: jest.fn((comps) => {
        const size = comps['descriptors:size_specific'];
        return size ? [size.size] : [];
      }),
      formatDescriptors: jest.fn((descs) => descs.join(',')),
    };

    const entity1 = {
      getComponentData: jest.fn((id) => {
        if (id === 'anatomy:part') return { subType: 'wing' };
        if (id === 'descriptors:size_specific') return { size: 'large' };
        if (id === 'descriptors:firmness') throw new Error('missing');
        return null;
      }),
    };

    const entity2 = {
      getComponentData: jest.fn((id) => {
        if (id === 'anatomy:part') return { subType: 'wing' };
        if (id === 'descriptors:size_specific') return { size: 'large' };
        return null;
      }),
    };

    const builder = new BodyPartDescriptionBuilder({ descriptorFormatter });
    const result = builder.buildMultipleDescription([entity1, entity2], 'wing');

    expect(result).toBe('large');
    expect(entity1.getComponentData).toHaveBeenCalled();
    expect(entity2.getComponentData).toHaveBeenCalled();
    expect(descriptorFormatter.extractDescriptors).toHaveBeenCalledTimes(2);
  });
});
