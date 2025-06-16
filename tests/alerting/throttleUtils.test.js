import { describe, it, expect } from '@jest/globals';
import { generateKey } from '../../src/utils/throttleUtils.js';

describe('generateKey', () => {
  it('creates key with status and url when provided', () => {
    const result = generateKey('Message', { statusCode: 404, url: '/foo' });
    expect(result).toBe('Message::404::/foo');
  });

  it('handles missing details gracefully', () => {
    const result = generateKey('Missing');
    expect(result).toBe('Missing::::');
  });

  it('handles null details', () => {
    const result = generateKey('Missing', null);
    expect(result).toBe('Missing::::');
  });

  it('handles partial details', () => {
    const result = generateKey('Partial', { statusCode: 500 });
    expect(result).toBe('Partial::500::');
    const result2 = generateKey('OnlyUrl', { url: '/bar' });
    expect(result2).toBe('OnlyUrl::::/bar');
  });
});
