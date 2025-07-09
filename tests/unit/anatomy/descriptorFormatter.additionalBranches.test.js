import { describe, it, expect } from '@jest/globals';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';

// Additional branch coverage for DescriptorFormatter

describe('DescriptorFormatter extra branches', () => {
  it('places descriptors not listed in order at the end', () => {
    const formatter = new DescriptorFormatter();
    const descriptors = [
      { componentId: 'descriptors:unknown', value: 'x' },
      { componentId: 'descriptors:size_category', value: 'big' },
    ];
    const result = formatter.formatDescriptors(descriptors);
    expect(result).toBe('big, x');
  });

  it('extractDescriptorValue uses default keys when no service provided', () => {
    const formatter = new DescriptorFormatter();
    const value = formatter.extractDescriptorValue('descriptors:color_basic', {
      color: 'blue',
    });
    expect(value).toBe('blue');
  });

  it('extractDescriptorValue returns first matching key from service order', () => {
    const mockService = { getDescriptorValueKeys: () => ['alt', 'value'] };
    const formatter = new DescriptorFormatter({
      anatomyFormattingService: mockService,
    });
    const value = formatter.extractDescriptorValue(
      'descriptors:size_category',
      {
        alt: 'altVal',
        value: 'mainVal',
      }
    );
    expect(value).toBe('altVal');
  });
});
