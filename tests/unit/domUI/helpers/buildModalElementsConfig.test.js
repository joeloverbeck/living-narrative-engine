import { describe, it, expect } from '@jest/globals';
import { buildModalElementsConfig } from '../../../../src/domUI/helpers/buildModalElementsConfig.js';

describe('buildModalElementsConfig', () => {
  it('transforms selectors map into config objects', () => {
    const result = buildModalElementsConfig({
      container: '#container',
      button: ['.btn', HTMLButtonElement],
      list: ['ul'],
      skip: null,
    });

    expect(result).toEqual({
      container: { selector: '#container', required: true },
      button: {
        selector: '.btn',
        required: true,
        expectedType: HTMLButtonElement,
      },
      list: { selector: 'ul', required: true },
    });
  });

  it('omits entries with falsy values', () => {
    const result = buildModalElementsConfig({ a: '#a', b: undefined, c: '' });
    expect(result).toEqual({ a: { selector: '#a', required: true } });
  });
});
