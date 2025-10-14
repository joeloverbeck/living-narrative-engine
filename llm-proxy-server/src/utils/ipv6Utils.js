/**
 * @file Comprehensive IPv6 validation utilities
 * @description Provides robust IPv6 address validation, classification, and security checks
 * Addresses IPv6 validation gaps identified in security analysis report
 */

import ipaddr from 'ipaddr.js';

/**
 * IPv6 address classification result
 * @typedef {object} IPv6Classification
 * @property {boolean} isValid - Whether the address is a valid IPv6 address
 * @property {boolean} isLoopback - Whether the address is a loopback address
 * @property {boolean} isPrivate - Whether the address is in private/internal ranges
 * @property {boolean} isLinkLocal - Whether the address is link-local
 * @property {boolean} isMulticast - Whether the address is multicast
 * @property {boolean} isReserved - Whether the address is in reserved ranges
 * @property {boolean} isPublic - Whether the address is a public address
 * @property {string} type - Address type classification
 * @property {string} range - Specific address range if applicable
 * @property {object} details - Additional technical details
 */

/**
 * Comprehensive IPv6 validation with enhanced security checks
 * @param {string} address - IPv6 address to validate (with or without brackets)
 * @returns {IPv6Classification} Classification result
 */
export function validateIPv6Address(address) {
  if (!address || typeof address !== 'string') {
    return createInvalidResult(
      'Invalid input - address must be a non-empty string'
    );
  }

  // Clean the address (remove brackets, whitespace)
  const cleanAddress = cleanIPv6Address(address);

  if (!cleanAddress) {
    return createInvalidResult(
      'Invalid input - address is empty after cleaning'
    );
  }

  try {
    // Use ipaddr.js for robust parsing and validation
    if (!ipaddr.isValid(cleanAddress)) {
      return createInvalidResult('Invalid IPv6 address format');
    }

    const parsedAddress = ipaddr.IPv6.parse(cleanAddress);

    // Perform comprehensive classification
    return classifyIPv6Address(parsedAddress, address);
  } catch (error) {
    return createInvalidResult(`IPv6 parsing error: ${error.message}`);
  }
}

/**
 * Checks if an IPv6 address is safe for external connections (not internal/private)
 * @param {string} address - IPv6 address to check
 * @returns {boolean} True if address is safe for external connections
 */
export function isIPv6AddressSafeForSSRF(address) {
  const classification = validateIPv6Address(address);

  if (!classification.isValid) {
    return false;
  }

  // Block dangerous addresses for SSRF protection
  return (
    !classification.isLoopback &&
    !classification.isPrivate &&
    !classification.isLinkLocal &&
    !classification.isReserved &&
    classification.isPublic
  );
}

/**
 * Checks if an IPv6 address is a valid public IP for rate limiting
 * @param {string} address - IPv6 address to check
 * @returns {boolean} True if address is a valid public IPv6 address
 */
export function isValidPublicIPv6(address) {
  const classification = validateIPv6Address(address);
  return classification.isValid && classification.isPublic;
}

/**
 * Detects if a hostname string contains an IPv6 address
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if hostname contains IPv6 address
 */
export function isIPv6Hostname(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return false;
  }

  // Check for bracketed IPv6 addresses (common in URLs)
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const innerAddress = hostname.slice(1, -1);
    return validateIPv6Address(innerAddress).isValid;
  }

  // Check for IPv6 patterns without brackets
  return validateIPv6Address(hostname).isValid;
}

/**
 * Extracts IPv6 address from hostname (removes brackets if present)
 * @param {string} hostname - Hostname that may contain IPv6 address
 * @returns {string|null} Extracted IPv6 address or null if not found
 */
export function extractIPv6FromHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return null;
  }

  const cleanAddress = cleanIPv6Address(hostname);
  const classification = validateIPv6Address(cleanAddress);

  return classification.isValid ? cleanAddress : null;
}

/**
 * Normalizes IPv6 address to canonical form
 * @param {string} address - IPv6 address to normalize
 * @returns {string|null} Normalized address or null if invalid
 */
export function normalizeIPv6Address(address) {
  try {
    const cleanAddress = cleanIPv6Address(address);
    if (!cleanAddress || !ipaddr.isValid(cleanAddress)) {
      return null;
    }

    const parsedAddress = ipaddr.IPv6.parse(cleanAddress);
    return parsedAddress.toString();
  } catch {
    return null;
  }
}

/**
 * Cleans IPv6 address by removing brackets and whitespace
 * @param {string} address - Raw address string
 * @returns {string} Cleaned address
 */
function cleanIPv6Address(address) {
  if (!address || typeof address !== 'string') {
    return '';
  }

  // Remove brackets if present
  let cleaned = address.trim();
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1);
  }

  return cleaned.trim();
}

/**
 * Creates an invalid classification result
 * @param {string} reason - Reason for invalidity
 * @returns {IPv6Classification} Invalid classification result
 */
function createInvalidResult(reason) {
  return {
    isValid: false,
    isLoopback: false,
    isPrivate: false,
    isLinkLocal: false,
    isMulticast: false,
    isReserved: false,
    isPublic: false,
    type: 'invalid',
    range: 'invalid',
    details: {
      reason,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Classifies a parsed IPv6 address
 * @param {object} parsedAddress - Parsed IPv6 address from ipaddr.js
 * @param {string} originalAddress - Original address string
 * @returns {IPv6Classification} Classification result
 */
function classifyIPv6Address(parsedAddress, originalAddress) {
  const addressRange = parsedAddress.range();
  const firstPart = parsedAddress.parts[0];

  const classification = {
    isValid: true,
    isLoopback: addressRange === 'loopback',
    isPrivate: addressRange === 'uniqueLocal',
    isLinkLocal: addressRange === 'linkLocal',
    isMulticast: addressRange === 'multicast',
    isReserved: false,
    isPublic: false,
    type: 'unknown',
    range: 'unknown',
    details: {
      originalAddress,
      canonicalAddress: parsedAddress.toString(),
      hexadecimalAddress: parsedAddress.toNormalizedString(),
      addressParts: parsedAddress.parts,
      timestamp: new Date().toISOString(),
    },
  };

  // Handle abbreviated forms and special cases
  // Check for site-local addresses (fec0::/10) - deprecated but should be blocked
  if (firstPart >= 0xfec0 && firstPart <= 0xfeff) {
    classification.isPrivate = true;
    classification.type = 'site-local';
    classification.range = 'fec0::/10 (Site-local, deprecated)';
  }
  // Check for abbreviated unique local addresses (fc0:: should be fc00::)
  else if (firstPart === 0xfc0) {
    classification.isPrivate = true;
    classification.type = 'private';
    classification.range = 'fc00::/7 (Unique Local Addresses)';
  }
  // Check for abbreviated link-local addresses (fe8:: should be fe80::)
  else if (firstPart === 0xfe8) {
    classification.isLinkLocal = true;
    classification.type = 'link-local';
    classification.range = 'fe80::/10';
  }

  // Special handling for IPv4-mapped addresses
  if (addressRange === 'ipv4Mapped' && parsedAddress.isIPv4MappedAddress()) {
    try {
      const ipv4Address = parsedAddress.toIPv4Address();
      const ipv4Range = ipv4Address.range();

      // Check if the embedded IPv4 address is safe
      const ipv4Parts = ipv4Address.octets || ipv4Address.parts;
      const isPrivateIPv4 =
        ipv4Range === 'private' ||
        ipv4Range === 'loopback' ||
        ipv4Range === 'linkLocal' ||
        ipv4Range === 'multicast' ||
        ipv4Range === 'reserved' ||
        ipv4Range === 'unspecified' ||
        ipv4Range === 'broadcast' ||
        ipv4Range === 'carrierGradeNat' ||
        // Manual checks for ranges that ipaddr.js might miss
        ipv4Parts[0] === 10 ||
        (ipv4Parts[0] === 172 && ipv4Parts[1] >= 16 && ipv4Parts[1] <= 31) ||
        (ipv4Parts[0] === 192 && ipv4Parts[1] === 168) ||
        (ipv4Parts[0] === 169 && ipv4Parts[1] === 254) ||
        ipv4Parts[0] === 127 ||
        ipv4Parts[0] === 0 ||
        (ipv4Parts[0] >= 224 && ipv4Parts[0] <= 239) ||
        ipv4Parts[0] >= 240;

      if (!isPrivateIPv4) {
        classification.isPublic = true;
        classification.type = 'ipv4-mapped-public';
        classification.range = `::ffff:0:0/96 (IPv4-mapped, embedded: ${ipv4Address.toString()})`;
      } else {
        classification.isReserved = true;
        classification.type = 'ipv4-mapped-private';
        classification.range = `::ffff:0:0/96 (IPv4-mapped, embedded private: ${ipv4Address.toString()})`;
      }
    } catch {
      // If we can't parse the IPv4 part, treat as reserved
      classification.isReserved = true;
    }
  } else {
    // Check for other reserved ranges
    classification.isReserved =
      addressRange === 'reserved' ||
      addressRange === 'unspecified' ||
      addressRange === 'discard' ||
      addressRange === 'rfc6145' ||
      addressRange === 'rfc6052' ||
      addressRange === '6to4' ||
      addressRange === 'teredo' ||
      addressRange === 'benchmarking' ||
      addressRange === 'amt' ||
      addressRange === 'as112v6' ||
      addressRange === 'deprecated' ||
      addressRange === 'orchid2' ||
      addressRange === 'droneRemoteIdProtocolEntityTags';
  }

  // Determine if address is public (unicast that's not private, link-local, loopback, multicast, or reserved)
  // Note: isPublic may already be set for IPv4-mapped addresses
  if (!classification.isPublic) {
    classification.isPublic =
      addressRange === 'unicast' &&
      !classification.isLoopback &&
      !classification.isPrivate &&
      !classification.isLinkLocal &&
      !classification.isMulticast &&
      !classification.isReserved;
  }

  // Classify address type based on range
  // Note: The order matters here - check specific classifications first
  if (classification.isLoopback) {
    classification.type = 'loopback';
    classification.range = '::1';
  } else if (classification.isLinkLocal) {
    // Range already set if detected via abbreviated form
    if (classification.type !== 'link-local') {
      classification.type = 'link-local';
      classification.range = 'fe80::/10';
    }
  } else if (classification.isMulticast) {
    classification.type = 'multicast';
    classification.range = 'ff00::/8';
  } else if (classification.isPrivate) {
    // Range already set if detected via abbreviated form or site-local
    if (
      classification.type !== 'private' &&
      classification.type !== 'site-local'
    ) {
      classification.type = 'private';
      classification.range = 'fc00::/7 (Unique Local Addresses)';
    }
  } else if (classification.isReserved) {
    // Type and range may already be set for IPv4-mapped addresses
    if (classification.type !== 'ipv4-mapped-private') {
      classification.type = 'reserved';
      classification.range = determineReservedRangeFromType(addressRange);
    }
  } else if (classification.isPublic) {
    // Type and range may already be set for IPv4-mapped addresses
    if (classification.type !== 'ipv4-mapped-public') {
      classification.type = 'public';
      classification.range = 'public';
    }
  } else {
    // Handle any other ranges as reserved
    classification.type = 'reserved';
    classification.range = addressRange;
    classification.isReserved = true;
  }

  return classification;
}

/**
 * Determines the specific reserved IPv6 range description from the range type
 * @param {string} rangeType - Range type from ipaddr.js
 * @returns {string} Specific reserved range identifier
 */
function determineReservedRangeFromType(rangeType) {
  const rangeDescriptions = {
    reserved: 'Reserved ranges',
    unspecified: ':: (Unspecified address)',
    ipv4Mapped: '::ffff:0:0/96 (IPv4-mapped)',
    discard: '100::/64 (Discard prefix)',
    rfc6145: '64:ff9b::/96 (IPv4-embedded)',
    rfc6052: '64:ff9b::/96 (IPv4-embedded)',
    '6to4': '2002::/16 (6to4)',
    teredo: '2001::/32 (Teredo)',
    benchmarking: '2001:2::/48 (Benchmarking)',
    amt: '2001:3::/32 (AMT)',
    as112v6: '2001:4::/32 (AS112-v6)',
    deprecated: 'fec0::/10 (Site-local, deprecated)',
    orchid2: '2001:20::/28 (ORCHIDv2)',
    droneRemoteIdProtocolEntityTags: '2001:30::/28 (Drone Remote ID)',
  };

  return rangeDescriptions[rangeType] || `${rangeType} (Reserved)`;
}

export const __determineReservedRangeFromType = determineReservedRangeFromType;

/**
 * Validates multiple IPv6 addresses in batch
 * @param {string[]} addresses - Array of IPv6 addresses to validate
 * @returns {IPv6Classification[]} Array of classification results
 */
export function validateMultipleIPv6Addresses(addresses) {
  if (!Array.isArray(addresses)) {
    return [];
  }

  return addresses.map((address) => validateIPv6Address(address));
}

/**
 * Gets summary statistics for IPv6 address classifications
 * @param {IPv6Classification[]} classifications - Array of classification results
 * @returns {object} Summary statistics
 */
export function getIPv6ValidationSummary(classifications) {
  if (!Array.isArray(classifications)) {
    return { error: 'Invalid input - classifications must be an array' };
  }

  const summary = {
    total: classifications.length,
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
  };

  classifications.forEach((classification) => {
    if (classification.isValid) {
      summary.valid++;
      if (classification.isPublic) summary.public++;
      if (classification.isPrivate) summary.private++;
      if (classification.isLoopback) summary.loopback++;
      if (classification.isLinkLocal) summary.linkLocal++;
      if (classification.isMulticast) summary.multicast++;
      if (classification.isReserved) summary.reserved++;

      // Type breakdown
      summary.typeBreakdown[classification.type] =
        (summary.typeBreakdown[classification.type] || 0) + 1;

      // Range breakdown
      summary.rangeBreakdown[classification.range] =
        (summary.rangeBreakdown[classification.range] || 0) + 1;
    } else {
      summary.invalid++;

      // Add invalid to type breakdown as well
      summary.typeBreakdown[classification.type] =
        (summary.typeBreakdown[classification.type] || 0) + 1;
    }
  });

  return summary;
}
