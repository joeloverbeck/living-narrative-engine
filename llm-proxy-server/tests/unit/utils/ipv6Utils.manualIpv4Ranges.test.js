import { describe, it, expect, afterEach, jest } from '@jest/globals';
import ipaddr from 'ipaddr.js';
import { validateIPv6Address } from '../../../src/utils/ipv6Utils.js';

const setupIpv4MappedMock = (octets, { ipv4Range = 'unicast' } = {}) => {
  jest.spyOn(ipaddr, 'isValid').mockReturnValue(true);

  jest.spyOn(ipaddr.IPv6, 'parse').mockReturnValue({
    range: () => 'ipv4Mapped',
    parts: [0, 0, 0, 0, 0, 0xffff, 0, 1],
    isIPv4MappedAddress: () => true,
    toString: () => `::ffff:${octets.join('.')}`,
    toNormalizedString: () => '0000:0000:0000:0000:0000:ffff:0000:0001',
    toIPv4Address: () => ({
      range: () => ipv4Range,
      octets,
      parts: octets,
      toString: () => octets.join('.'),
    }),
  });

  return `::ffff:${octets.join('.')}`;
};

const expectReservedIpv4Mapped = (classification, ipv4String) => {
  expect(classification.isValid).toBe(true);
  expect(classification.isReserved).toBe(true);
  expect(classification.isPublic).toBe(false);
  expect(classification.type).toBe('ipv4-mapped-private');
  expect(classification.range).toBe(
    `::ffff:0:0/96 (IPv4-mapped, embedded private: ${ipv4String})`
  );
};

describe('ipv6Utils manual IPv4 range detection', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('treats IPv4-mapped broadcast addresses as reserved', () => {
    const address = setupIpv4MappedMock([255, 255, 255, 255], {
      ipv4Range: 'broadcast',
    });

    const classification = validateIPv6Address(address);

    expectReservedIpv4Mapped(classification, '255.255.255.255');
  });

  it('flags IPv4-mapped 172.16/12 addresses when the library reports unicast', () => {
    const address = setupIpv4MappedMock([172, 20, 10, 5]);

    const classification = validateIPv6Address(address);

    expectReservedIpv4Mapped(classification, '172.20.10.5');
  });

  it('flags IPv4-mapped 192.168/16 addresses with manual detection', () => {
    const address = setupIpv4MappedMock([192, 168, 1, 50]);

    const classification = validateIPv6Address(address);

    expectReservedIpv4Mapped(classification, '192.168.1.50');
  });

  it('flags IPv4-mapped 169.254/16 link-local addresses with manual detection', () => {
    const address = setupIpv4MappedMock([169, 254, 42, 99]);

    const classification = validateIPv6Address(address);

    expectReservedIpv4Mapped(classification, '169.254.42.99');
  });

  it('treats IPv4-mapped addresses beginning with 0 as unsafe', () => {
    const address = setupIpv4MappedMock([0, 10, 20, 30]);

    const classification = validateIPv6Address(address);

    expectReservedIpv4Mapped(classification, '0.10.20.30');
  });

  it('flags IPv4-mapped multicast ranges (224.0.0.0/4) using manual checks', () => {
    const address = setupIpv4MappedMock([230, 1, 2, 3]);

    const classification = validateIPv6Address(address);

    expectReservedIpv4Mapped(classification, '230.1.2.3');
  });

  it('flags IPv4-mapped reserved ranges (>= 240.0.0.0) using manual checks', () => {
    const address = setupIpv4MappedMock([240, 1, 2, 3]);

    const classification = validateIPv6Address(address);

    expectReservedIpv4Mapped(classification, '240.1.2.3');
  });
});
