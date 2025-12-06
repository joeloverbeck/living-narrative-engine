import { describe, it, expect, afterEach, jest } from '@jest/globals';
import ipaddr from 'ipaddr.js';
import { validateIPv6Address } from '../../../src/utils/ipv6Utils.js';

describe('validateIPv6Address additional branch coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('treats deprecated site-local ranges as private addresses', () => {
    const classification = validateIPv6Address('fec0::1');

    expect(classification.isValid).toBe(true);
    expect(classification.isPrivate).toBe(true);
    expect(classification.type).toBe('site-local');
    expect(classification.range).toBe('fec0::/10 (Site-local, deprecated)');
  });

  it('recognizes abbreviated unique local addresses that start with fc0::', () => {
    const classification = validateIPv6Address('fc0::1234');

    expect(classification.isValid).toBe(true);
    expect(classification.isPrivate).toBe(true);
    expect(classification.type).toBe('private');
    expect(classification.range).toBe('fc00::/7 (Unique Local Addresses)');
  });

  it('identifies abbreviated link-local prefixes that start with fe8::', () => {
    const classification = validateIPv6Address('fe8::abcd');

    expect(classification.isValid).toBe(true);
    expect(classification.isLinkLocal).toBe(true);
    expect(classification.type).toBe('link-local');
    expect(classification.range).toBe('fe80::/10');
  });

  it('distinguishes IPv4-mapped addresses with public IPv4 payloads', () => {
    const classification = validateIPv6Address('::ffff:1.1.1.1');

    expect(classification.isValid).toBe(true);
    expect(classification.isPublic).toBe(true);
    expect(classification.type).toBe('ipv4-mapped-public');
    expect(classification.range).toContain('1.1.1.1');
  });

  it('flags IPv4-mapped addresses that embed reserved IPv4 ranges', () => {
    const classification = validateIPv6Address('::ffff:240.0.0.1');

    expect(classification.isValid).toBe(true);
    expect(classification.isReserved).toBe(true);
    expect(classification.type).toBe('ipv4-mapped-private');
    expect(classification.range).toContain('240.0.0.1');
  });

  it('flags IPv4-mapped addresses with manual private range detection when ipaddr range is unrecognized', () => {
    jest.spyOn(ipaddr, 'isValid').mockReturnValue(true);
    jest.spyOn(ipaddr.IPv6, 'parse').mockReturnValue({
      range: () => 'ipv4Mapped',
      parts: [0, 0, 0, 0, 0, 0xffff, 0, 1],
      isIPv4MappedAddress: () => true,
      toString: () => '::ffff:10.0.0.1',
      toNormalizedString: () => '0000:0000:0000:0000:0000:ffff:0000:0001',
      toIPv4Address: () => ({
        range: () => 'unicast',
        octets: [10, 0, 0, 1],
        toString: () => '10.0.0.1',
      }),
    });

    const classification = validateIPv6Address('::ffff:10.0.0.1');

    expect(classification.isValid).toBe(true);
    expect(classification.isReserved).toBe(true);
    expect(classification.type).toBe('ipv4-mapped-private');
    expect(classification.range).toBe(
      '::ffff:0:0/96 (IPv4-mapped, embedded private: 10.0.0.1)'
    );
  });

  it('falls back to reserved classification when IPv4 extraction fails', () => {
    jest.spyOn(ipaddr, 'isValid').mockReturnValue(true);
    jest.spyOn(ipaddr.IPv6, 'parse').mockReturnValue({
      range: () => 'ipv4Mapped',
      parts: [0, 0, 0, 0, 0, 0xffff, 0, 1],
      isIPv4MappedAddress: () => true,
      toIPv4Address: () => {
        throw new Error('synthetic failure');
      },
      toString: () => '::ffff:0:1',
      toNormalizedString: () => '0000:0000:0000:0000:0000:ffff:0000:0001',
    });

    const classification = validateIPv6Address('::ffff:0:1');

    expect(classification.isValid).toBe(true);
    expect(classification.isReserved).toBe(true);
    expect(classification.type).toBe('reserved');
    expect(classification.range).toBe('::ffff:0:0/96 (IPv4-mapped)');
  });

  it('treats IPv4-mapped addresses embedding the unspecified IPv4 address as reserved', () => {
    const classification = validateIPv6Address('::ffff:0.0.0.0');

    expect(classification.isValid).toBe(true);
    expect(classification.isReserved).toBe(true);
    expect(classification.type).toBe('ipv4-mapped-private');
    expect(classification.range).toContain('0.0.0.0');
  });
});
