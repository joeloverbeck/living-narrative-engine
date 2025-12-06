import { afterEach, describe, expect, it, jest } from '@jest/globals';

const IPV6_UTILS_PATH = '../../../src/utils/ipv6Utils.js';

describe('ipv6Utils edge case coverage', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('classifies abbreviated unique local prefixes (fc0::) as private addresses', async () => {
    const { validateIPv6Address } = await import(IPV6_UTILS_PATH);
    const result = validateIPv6Address('fc0::1');

    expect(result.isValid).toBe(true);
    expect(result.isPrivate).toBe(true);
    expect(result.type).toBe('private');
    expect(result.range).toBe('fc00::/7 (Unique Local Addresses)');
  });

  it('recognizes abbreviated link-local prefixes (fe8::) as link-local addresses', async () => {
    const { validateIPv6Address } = await import(IPV6_UTILS_PATH);
    const result = validateIPv6Address('fe8::1');

    expect(result.isValid).toBe(true);
    expect(result.isLinkLocal).toBe(true);
    expect(result.type).toBe('link-local');
    expect(result.range).toBe('fe80::/10');
  });

  it('treats IPv4-mapped addresses with unparsable IPv4 segments as reserved for safety', async () => {
    const ipaddrModule = await import('ipaddr.js');
    const originalToIPv4Address =
      ipaddrModule.default.IPv6.prototype.toIPv4Address;

    ipaddrModule.default.IPv6.prototype.toIPv4Address = function patched() {
      throw new Error('invalid embedded IPv4');
    };

    try {
      const { validateIPv6Address } = await import(IPV6_UTILS_PATH);
      const result = validateIPv6Address('::ffff:203.0.113.10');

      expect(result.isValid).toBe(true);
      expect(result.isReserved).toBe(true);
      expect(result.type).toBe('reserved');
      expect(result.range).toBe('::ffff:0:0/96 (IPv4-mapped)');
    } finally {
      ipaddrModule.default.IPv6.prototype.toIPv4Address = originalToIPv4Address;
    }
  });
});
