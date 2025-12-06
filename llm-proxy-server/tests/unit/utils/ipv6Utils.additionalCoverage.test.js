import { describe, it, expect, afterEach, jest } from '@jest/globals';

const IPV6_UTILS_PATH = '../../../src/utils/ipv6Utils.js';

/**
 * Additional coverage tests for ipv6Utils.js focusing on rarely hit branches.
 */
describe('ipv6Utils additional coverage', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const mockIpv4MappedAddress = async (address) => {
    const ipaddr = await import('ipaddr.js');
    const originalParse = ipaddr.default.IPv6.parse;

    const parseSpy = jest
      .spyOn(ipaddr.default.IPv6, 'parse')
      .mockImplementation(function patchedParse(requestedAddress) {
        const parsed = originalParse.call(this, requestedAddress);
        const originalToIPv4 = parsed.toIPv4Address.bind(parsed);
        parsed.toIPv4Address = () => {
          const ipv4Address = originalToIPv4();
          const originalRange = ipv4Address.range.bind(ipv4Address);
          const originalToString = ipv4Address.toString.bind(ipv4Address);
          return {
            parts: [...ipv4Address.octets],
            range: originalRange,
            toString: originalToString,
          };
        };
        return parsed;
      });

    const { validateIPv6Address } = await import(IPV6_UTILS_PATH);
    const classification = validateIPv6Address(address);
    return { parseSpy, classification };
  };

  it('handles IPv4-mapped public addresses when only the parts array is available', async () => {
    const { parseSpy, classification } = await mockIpv4MappedAddress(
      '::ffff:93.184.216.34'
    );

    expect(parseSpy).toHaveBeenCalledWith('::ffff:93.184.216.34');
    expect(classification.type).toBe('ipv4-mapped-public');
    expect(classification.isPublic).toBe(true);
    expect(classification.isReserved).toBe(false);
    expect(classification.range).toBe(
      '::ffff:0:0/96 (IPv4-mapped, embedded: 93.184.216.34)'
    );
  });

  it('handles IPv4-mapped loopback addresses using the parts fallback', async () => {
    const { parseSpy, classification } =
      await mockIpv4MappedAddress('::ffff:127.0.0.1');

    expect(parseSpy).toHaveBeenCalledWith('::ffff:127.0.0.1');
    expect(classification.type).toBe('ipv4-mapped-private');
    expect(classification.isReserved).toBe(true);
    expect(classification.isPublic).toBe(false);
    expect(classification.range).toBe(
      '::ffff:0:0/96 (IPv4-mapped, embedded private: 127.0.0.1)'
    );
  });

  it('provides reserved range descriptions for documentation addresses', async () => {
    const { validateIPv6Address } = await import(IPV6_UTILS_PATH);

    const classification = validateIPv6Address('2001:db8::1');

    expect(classification.isReserved).toBe(true);
    expect(classification.type).toBe('reserved');
    expect(classification.range).toBe('Reserved ranges');
  });

  it('falls back to generic reserved label for unknown reserved range types', async () => {
    const { __determineReservedRangeFromType } = await import(IPV6_UTILS_PATH);

    const result = __determineReservedRangeFromType('hypotheticalRange');

    expect(result).toBe('hypotheticalRange (Reserved)');
  });
});
