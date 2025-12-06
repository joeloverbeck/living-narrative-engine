/**
 * @file Unit tests for IPv6 validation utilities
 * @description Comprehensive test coverage for IPv6 validation edge cases
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ipaddr from 'ipaddr.js';
import {
  validateIPv6Address,
  isIPv6AddressSafeForSSRF,
  isValidPublicIPv6,
  isIPv6Hostname,
  extractIPv6FromHostname,
  normalizeIPv6Address,
  validateMultipleIPv6Addresses,
  getIPv6ValidationSummary,
} from '../../../src/utils/ipv6Utils.js';

describe('IPv6 Validation Utilities', () => {
  describe('validateIPv6Address', () => {
    describe('Valid IPv6 addresses', () => {
      const validAddresses = [
        {
          address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
          type: 'reserved',
          description: 'Documentation prefix (expanded form)',
        },
        {
          address: '2001:db8:85a3::8a2e:370:7334',
          type: 'reserved',
          description: 'Documentation prefix with compression',
        },
        {
          address: '::1',
          type: 'loopback',
          description: 'Loopback address',
        },
        {
          address: '::',
          type: 'reserved',
          description: 'Unspecified address',
        },
        {
          address: 'fe80::1',
          type: 'link-local',
          description: 'Link-local address',
        },
        {
          address: 'fc00::1',
          type: 'private',
          description: 'Unique local address',
        },
        {
          address: 'ff02::1',
          type: 'multicast',
          description: 'Multicast address',
        },
        {
          address: '2001:4860:4860::8888',
          type: 'public',
          description: 'Google DNS IPv6',
        },
        {
          address: '::ffff:192.0.2.1',
          type: 'ipv4-mapped-private',
          description: 'IPv4-mapped IPv6 with reserved IP',
        },
        {
          address: '::ffff:8.8.8.8',
          type: 'ipv4-mapped-public',
          description: 'IPv4-mapped IPv6 with public IP',
        },
      ];

      validAddresses.forEach(({ address, type, description }) => {
        it(`should validate ${description}: ${address}`, () => {
          const result = validateIPv6Address(address);

          expect(result.isValid).toBe(true);
          expect(result.type).toBe(type);
          expect(result.details.originalAddress).toBe(address);
          expect(result.details.canonicalAddress).toBeDefined();
          expect(result.details.hexadecimalAddress).toBeDefined();
          expect(Array.isArray(result.details.addressParts)).toBe(true);
        });
      });
    });

    describe('IPv6 addresses with brackets', () => {
      const bracketedAddresses = [
        '[2001:db8::1]',
        '[::1]',
        '[fe80::1]',
        '[::ffff:192.0.2.1]',
      ];

      bracketedAddresses.forEach((address) => {
        it(`should handle bracketed address: ${address}`, () => {
          const result = validateIPv6Address(address);
          expect(result.isValid).toBe(true);
          expect(result.details.originalAddress).toBe(address);
        });
      });
    });

    describe('Invalid IPv6 addresses', () => {
      const invalidAddresses = [
        '',
        null,
        undefined,
        'not-an-ip',
        '192.168.1.1', // IPv4
        '2001:db8::1::2', // Double compression
        '2001:db8:85a3::8a2e::7334', // Multiple compressions
        'gggg::1', // Invalid hex characters
        '2001:db8:85a3:0000:0000:8a2e:0370:7334:extra', // Too many groups
        'fe80:', // Incomplete
        ':::', // Invalid compression
        '[2001:db8::1', // Missing closing bracket
        '2001:db8::1]', // Missing opening bracket
      ];

      invalidAddresses.forEach((address) => {
        it(`should reject invalid address: ${JSON.stringify(address)}`, () => {
          const result = validateIPv6Address(address);
          expect(result.isValid).toBe(false);
          expect(result.type).toBe('invalid');
          expect(result.details.reason).toBeDefined();
        });
      });
    });

    describe('Address classification', () => {
      it('should correctly classify loopback addresses', () => {
        const loopbackAddresses = ['::1', '0:0:0:0:0:0:0:1'];

        loopbackAddresses.forEach((address) => {
          const result = validateIPv6Address(address);
          expect(result.isLoopback).toBe(true);
          expect(result.isPublic).toBe(false);
          expect(result.type).toBe('loopback');
        });
      });

      it('should correctly classify private addresses', () => {
        const privateAddresses = ['fc00::1', 'fd12:3456:789a::1'];

        privateAddresses.forEach((address) => {
          const result = validateIPv6Address(address);
          expect(result.isPrivate).toBe(true);
          expect(result.isPublic).toBe(false);
          expect(result.type).toBe('private');
        });
      });

      it('should correctly classify link-local addresses', () => {
        const linkLocalAddresses = [
          'fe80::1',
          'fe80:0000:0000:0000:0202:b3ff:fe1e:8329',
        ];

        linkLocalAddresses.forEach((address) => {
          const result = validateIPv6Address(address);
          expect(result.isLinkLocal).toBe(true);
          expect(result.isPublic).toBe(false);
          expect(result.type).toBe('link-local');
        });
      });

      it('should correctly classify multicast addresses', () => {
        const multicastAddresses = ['ff02::1', 'ff0e::1', 'ff05::2'];

        multicastAddresses.forEach((address) => {
          const result = validateIPv6Address(address);
          expect(result.isMulticast).toBe(true);
          expect(result.isPublic).toBe(false);
          expect(result.type).toBe('multicast');
        });
      });

      it('should correctly classify reserved addresses', () => {
        const reservedAddresses = [
          { address: '::', type: 'reserved' },
          { address: '2001:db8::1', type: 'reserved' },
          { address: '64:ff9b::192.0.2.1', type: 'reserved' },
        ];

        reservedAddresses.forEach(({ address, type }) => {
          const result = validateIPv6Address(address);
          expect(result.isReserved).toBe(true);
          expect(result.isPublic).toBe(false);
          expect(result.type).toBe(type);
        });
      });

      it('should correctly classify IPv4-mapped addresses', () => {
        const ipv4MappedAddresses = [
          {
            address: '::ffff:192.0.2.1',
            type: 'ipv4-mapped-private',
            isReserved: true,
          },
          {
            address: '::ffff:192.168.1.1',
            type: 'ipv4-mapped-private',
            isReserved: true,
          },
          {
            address: '::ffff:10.0.0.1',
            type: 'ipv4-mapped-private',
            isReserved: true,
          },
          {
            address: '::ffff:127.0.0.1',
            type: 'ipv4-mapped-private',
            isReserved: true,
          },
          {
            address: '::ffff:8.8.8.8',
            type: 'ipv4-mapped-public',
            isPublic: true,
          },
          {
            address: '::ffff:1.1.1.1',
            type: 'ipv4-mapped-public',
            isPublic: true,
          },
        ];

        ipv4MappedAddresses.forEach(
          ({ address, type, isReserved, isPublic }) => {
            const result = validateIPv6Address(address);
            expect(result.isValid).toBe(true);
            expect(result.type).toBe(type);
            if (isReserved === true) {
              expect(result.isReserved).toBe(true);
              expect(result.isPublic).toBe(false);
            } else if (isPublic === true) {
              expect(result.isPublic).toBe(true);
              expect(result.isReserved).toBe(false);
            }
          }
        );
      });

      it('should correctly classify public addresses', () => {
        const publicAddresses = [
          '2001:4860:4860::8888', // Google DNS
          '2606:4700:4700::1111', // Cloudflare DNS
          '2001:500:88:200::10', // Root server
        ];

        publicAddresses.forEach((address) => {
          const result = validateIPv6Address(address);
          expect(result.isPublic).toBe(true);
          expect(result.isLoopback).toBe(false);
          expect(result.isPrivate).toBe(false);
          expect(result.isLinkLocal).toBe(false);
          expect(result.isMulticast).toBe(false);
          expect(result.type).toBe('public');
        });
      });
    });

    describe('Address details', () => {
      it('should provide comprehensive address details', () => {
        const address = '2001:db8:85a3::8a2e:370:7334';
        const result = validateIPv6Address(address);

        expect(result.details).toMatchObject({
          originalAddress: address,
          canonicalAddress: expect.any(String),
          hexadecimalAddress: expect.any(String),
          addressParts: expect.any(Array),
          timestamp: expect.any(String),
        });

        // Verify timestamp is recent
        const timestamp = new Date(result.details.timestamp);
        const now = new Date();
        expect(Math.abs(now - timestamp)).toBeLessThan(1000);
      });
    });
  });

  describe('isIPv6AddressSafeForSSRF', () => {
    it('should allow safe public IPv6 addresses', () => {
      const safeAddresses = [
        '2001:4860:4860::8888',
        '2606:4700:4700::1111',
        '2001:500:88:200::10',
      ];

      safeAddresses.forEach((address) => {
        expect(isIPv6AddressSafeForSSRF(address)).toBe(true);
      });
    });

    it('should block dangerous IPv6 addresses', () => {
      const dangerousAddresses = [
        '::1', // Loopback
        'fe80::1', // Link-local
        'fc00::1', // Private
        'ff02::1', // Multicast
        '::', // Unspecified
        '::ffff:192.168.1.1', // IPv4-mapped with private IP
        '2001:db8::1', // Documentation
      ];

      dangerousAddresses.forEach((address) => {
        expect(isIPv6AddressSafeForSSRF(address)).toBe(false);
      });
    });

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '',
        'not-an-ip',
        '192.168.1.1',
        'invalid::address::format',
      ];

      invalidAddresses.forEach((address) => {
        expect(isIPv6AddressSafeForSSRF(address)).toBe(false);
      });
    });
  });

  describe('isValidPublicIPv6', () => {
    it('should validate public IPv6 addresses', () => {
      const publicAddresses = ['2001:4860:4860::8888', '2606:4700:4700::1111'];

      publicAddresses.forEach((address) => {
        expect(isValidPublicIPv6(address)).toBe(true);
      });
    });

    it('should reject non-public IPv6 addresses', () => {
      const nonPublicAddresses = [
        '::1',
        'fe80::1',
        'fc00::1',
        'ff02::1',
        '2001:db8::1',
      ];

      nonPublicAddresses.forEach((address) => {
        expect(isValidPublicIPv6(address)).toBe(false);
      });
    });
  });

  describe('isIPv6Hostname', () => {
    it('should detect IPv6 hostnames with brackets', () => {
      const bracketedHosts = ['[2001:db8::1]', '[::1]', '[fe80::1%eth0]'];

      bracketedHosts.forEach((host) => {
        expect(isIPv6Hostname(host)).toBe(true);
      });
    });

    it('should detect IPv6 hostnames without brackets', () => {
      const unbracketedHosts = ['2001:db8::1', '::1', 'fe80::1'];

      unbracketedHosts.forEach((host) => {
        expect(isIPv6Hostname(host)).toBe(true);
      });
    });

    it('should reject non-IPv6 hostnames', () => {
      const nonIPv6Hosts = [
        'example.com',
        '192.168.1.1',
        'localhost',
        '',
        'invalid-address',
      ];

      nonIPv6Hosts.forEach((host) => {
        expect(isIPv6Hostname(host)).toBe(false);
      });
    });
  });

  describe('extractIPv6FromHostname', () => {
    it('should extract IPv6 from bracketed hostnames', () => {
      const testCases = [
        { input: '[2001:db8::1]', expected: '2001:db8::1' },
        { input: '[::1]', expected: '::1' },
        { input: '[fe80::1]', expected: 'fe80::1' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(extractIPv6FromHostname(input)).toBe(expected);
      });
    });

    it('should extract IPv6 from unbracketed hostnames', () => {
      const testCases = [
        { input: '2001:db8::1', expected: '2001:db8::1' },
        { input: '::1', expected: '::1' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(extractIPv6FromHostname(input)).toBe(expected);
      });
    });

    it('should return null for non-IPv6 hostnames', () => {
      const invalidHosts = [
        'example.com',
        '192.168.1.1',
        'invalid',
        '',
        null,
        undefined,
      ];

      invalidHosts.forEach((host) => {
        expect(extractIPv6FromHostname(host)).toBeNull();
      });
    });
  });

  describe('normalizeIPv6Address', () => {
    it('should normalize valid IPv6 addresses', () => {
      const testCases = [
        {
          input: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
          description: 'Full form to canonical',
        },
        {
          input: '2001:db8:85a3::8a2e:370:7334',
          description: 'Compressed form normalization',
        },
        {
          input: '[::1]',
          description: 'Bracketed loopback',
        },
      ];

      testCases.forEach(({ input }) => {
        const result = normalizeIPv6Address(input);
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);

        // Verify the normalized address is valid
        const validation = validateIPv6Address(result);
        expect(validation.isValid).toBe(true);
      });
    });

    it('should return null for invalid addresses', () => {
      const invalidAddresses = [
        'invalid',
        '192.168.1.1',
        '',
        null,
        undefined,
        'not::an::ipv6::address::format',
      ];

      invalidAddresses.forEach((address) => {
        expect(normalizeIPv6Address(address)).toBeNull();
      });
    });
  });

  describe('validateMultipleIPv6Addresses', () => {
    it('should validate multiple addresses', () => {
      const addresses = [
        '2001:db8::1',
        '::1',
        'fe80::1',
        'invalid-address',
        '2001:4860:4860::8888',
      ];

      const results = validateMultipleIPv6Addresses(addresses);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(addresses.length);

      expect(results[0].isValid).toBe(true); // 2001:db8::1
      expect(results[1].isValid).toBe(true); // ::1
      expect(results[2].isValid).toBe(true); // fe80::1
      expect(results[3].isValid).toBe(false); // invalid-address
      expect(results[4].isValid).toBe(true); // Google DNS
    });

    it('should handle empty array', () => {
      const results = validateMultipleIPv6Addresses([]);
      expect(results).toEqual([]);
    });

    it('should handle invalid input', () => {
      expect(validateMultipleIPv6Addresses(null)).toEqual([]);
      expect(validateMultipleIPv6Addresses(undefined)).toEqual([]);
      expect(validateMultipleIPv6Addresses('not-an-array')).toEqual([]);
    });
  });

  describe('getIPv6ValidationSummary', () => {
    let classifications;

    beforeEach(() => {
      const addresses = [
        '2001:4860:4860::8888', // public
        '2001:4860:4860::8844', // public
        '::1', // loopback
        'fe80::1', // link-local
        'fc00::1', // private
        'ff02::1', // multicast
        '2001:db8::1', // reserved (documentation)
        'invalid-address', // invalid
      ];

      classifications = validateMultipleIPv6Addresses(addresses);
    });

    it('should generate comprehensive summary statistics', () => {
      const summary = getIPv6ValidationSummary(classifications);

      expect(summary).toMatchObject({
        total: 8,
        valid: 7,
        invalid: 1,
        public: 2,
        private: 1,
        loopback: 1,
        linkLocal: 1,
        multicast: 1,
        reserved: 1,
        typeBreakdown: expect.any(Object),
        rangeBreakdown: expect.any(Object),
      });

      expect(summary.typeBreakdown.public).toBe(2);
      expect(summary.typeBreakdown.loopback).toBe(1);
      expect(summary.typeBreakdown.private).toBe(1);
      expect(summary.typeBreakdown['link-local']).toBe(1);
      expect(summary.typeBreakdown.multicast).toBe(1);
      expect(summary.typeBreakdown.reserved).toBe(1);
      expect(summary.typeBreakdown.invalid).toBe(1);
    });

    it('should handle empty classifications', () => {
      const summary = getIPv6ValidationSummary([]);

      expect(summary).toMatchObject({
        total: 0,
        valid: 0,
        invalid: 0,
        public: 0,
        private: 0,
        loopback: 0,
        linkLocal: 0,
        multicast: 0,
        reserved: 0,
        typeBreakdown: {},
        rangeBreakdown: {},
      });
    });

    it('should handle invalid input', () => {
      const summary = getIPv6ValidationSummary('not-an-array');
      expect(summary.error).toBeDefined();
    });
  });

  describe('Edge cases and security considerations', () => {
    it('should handle addresses with zone identifiers', () => {
      // Note: Zone identifiers are typically stripped by URL parsing
      // but we should handle them gracefully
      const addressWithZone = 'fe80::1%eth0';
      const result = validateIPv6Address(addressWithZone);

      // This might be invalid depending on ipaddr.js handling
      // The important thing is that it doesn't crash
      expect(typeof result.isValid).toBe('boolean');
    });

    it('should handle very long invalid inputs', () => {
      const longInvalidInput = 'a'.repeat(1000);
      const result = validateIPv6Address(longInvalidInput);

      expect(result.isValid).toBe(false);
      expect(result.details.reason).toBeDefined();
    });

    it('should handle special characters', () => {
      const specialInputs = [
        '2001:db8::1\n',
        '2001:db8::1\r\n',
        '\t2001:db8::1\t',
        '2001:db8::1\x00',
      ];

      specialInputs.forEach((input) => {
        const result = validateIPv6Address(input);
        // These should either be cleaned and validated or rejected
        expect(typeof result.isValid).toBe('boolean');
      });
    });

    it('should maintain consistent performance with various inputs', () => {
      const testInputs = [
        '2001:db8::1',
        'invalid-very-long-hostname-that-should-be-processed-quickly',
        '::1',
        '',
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      ];

      testInputs.forEach((input) => {
        const startTime = performance.now();
        validateIPv6Address(input);
        const endTime = performance.now();

        // Should complete within reasonable time (< 100ms)
        expect(endTime - startTime).toBeLessThan(100);
      });
    });
  });

  describe('Additional edge coverage scenarios', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should reject addresses that become empty after cleaning', () => {
      const result = validateIPv6Address(' [  ] ');

      expect(result.isValid).toBe(false);
      expect(result.details.reason).toContain('empty after cleaning');
    });

    it('should treat IPv4-mapped addresses with unparsable IPv4 segments as reserved', () => {
      jest.spyOn(ipaddr, 'isValid').mockReturnValue(true);
      jest.spyOn(ipaddr.IPv6, 'parse').mockImplementation(() => ({
        range: () => 'ipv4Mapped',
        parts: [0x2001, 0, 0, 0, 0, 0, 0, 1],
        toString: () => '::ffff:0:1',
        toNormalizedString: () => '::ffff:0:1',
        isIPv4MappedAddress: () => true,
        toIPv4Address: () => {
          throw new Error('boom');
        },
      }));

      const result = validateIPv6Address('::ffff:0:1');

      expect(result.isValid).toBe(true);
      expect(result.isReserved).toBe(true);
      expect(result.type).toBe('reserved');
      expect(result.range).toBe('::ffff:0:0/96 (IPv4-mapped)');
    });

    it('should fallback to reserved classification for unknown ranges', () => {
      jest.spyOn(ipaddr, 'isValid').mockReturnValue(true);
      jest.spyOn(ipaddr.IPv6, 'parse').mockImplementation(() => ({
        range: () => 'mysteryRange',
        parts: [0x1234, 0, 0, 0, 0, 0, 0, 1],
        toString: () => '1234::1',
        toNormalizedString: () => '1234::1',
        isIPv4MappedAddress: () => false,
      }));

      const result = validateIPv6Address('1234::1');

      expect(result.isValid).toBe(true);
      expect(result.isReserved).toBe(true);
      expect(result.type).toBe('reserved');
      expect(result.range).toBe('mysteryRange');
    });
  });
});
