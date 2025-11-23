#!/usr/bin/env node

/**
 * @file Operation Type Synchronization Validator
 * @description Validates that KNOWN_OPERATION_TYPES whitelist is synchronized
 * with registered operation handlers
 *
 * Usage: npm run validate:operation-types
 *
 * Performs 3 validation checks:
 * 1. All registered handlers have whitelist entries
 * 2. All whitelist entries have registered handlers
 * 3. Whitelist is alphabetically sorted
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const errors = [];

console.log('🔍 Validating operation type synchronization...\n');

// Step 1: Extract KNOWN_OPERATION_TYPES from preValidationUtils.js
console.log('📋 Step 1: Reading whitelist from preValidationUtils.js...');
const whitelistTypes = extractWhitelistTypes();
console.log(`  Found ${whitelistTypes.length} types in whitelist\n`);

// Step 2: Extract registered types from interpreterRegistrations.js
console.log('📋 Step 2: Reading registered handlers from interpreterRegistrations.js...');
const registeredTypes = extractRegisteredTypes();
console.log(`  Found ${registeredTypes.length} registered handlers\n`);

// Step 3: Check whitelist completeness
console.log('📋 Step 3: Checking synchronization...');
const missingFromWhitelist = checkMissingFromWhitelist(registeredTypes, whitelistTypes);
const orphanedInWhitelist = checkOrphanedInWhitelist(whitelistTypes, registeredTypes);

if (missingFromWhitelist.length > 0) {
  errors.push(
    `❌ Missing from whitelist (${missingFromWhitelist.length}):\n` +
    `   ${missingFromWhitelist.join(', ')}\n` +
    `   Fix: Add these types to KNOWN_OPERATION_TYPES in src/utils/preValidationUtils.js`
  );
} else {
  console.log('  ✓ All registered handlers are in whitelist');
}

if (orphanedInWhitelist.length > 0) {
  errors.push(
    `❌ Whitelisted but no handler (${orphanedInWhitelist.length}):\n` +
    `   ${orphanedInWhitelist.join(', ')}\n` +
    `   Fix: Either remove from KNOWN_OPERATION_TYPES or register handler in interpreterRegistrations.js`
  );
} else {
  console.log('  ✓ All whitelist entries have registered handlers');
}

// Step 4: Check alphabetical order
console.log('\n📋 Step 4: Checking alphabetical order...');
const sortingIssue = checkAlphabeticalOrder(whitelistTypes);

if (sortingIssue) {
  errors.push(
    `❌ Whitelist not alphabetically sorted\n` +
    `   Fix: Sort KNOWN_OPERATION_TYPES array in src/utils/preValidationUtils.js\n` +
    `   Expected order:\n${sortingIssue.expected.map(t => `     '${t}',`).join('\n')}`
  );
} else {
  console.log('  ✓ Whitelist is alphabetically sorted');
}

// Report results
console.log('\n' + '='.repeat(70));
console.log('📊 Validation Results\n');

if (errors.length > 0) {
  console.log('❌ Synchronization issues found:\n');
  errors.forEach((e, idx) => {
    console.log(`${idx + 1}. ${e}\n`);
  });
  console.log('='.repeat(70));
  process.exit(1);
} else {
  console.log('✅ All operation types validated!\n');
  console.log(`✓ ${whitelistTypes.length} types in whitelist`);
  console.log(`✓ ${registeredTypes.length} handlers registered`);
  console.log('✓ Whitelist synchronized with registered handlers');
  console.log('✓ Whitelist alphabetically sorted');
  console.log('='.repeat(70));
  process.exit(0);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract KNOWN_OPERATION_TYPES from preValidationUtils.js
 * @returns {string[]} Array of operation type strings
 */
function extractWhitelistTypes() {
  try {
    const preValidationPath = path.join(projectRoot, 'src/utils/preValidationUtils.js');
    const content = fs.readFileSync(preValidationPath, 'utf8');

    const whitelistMatch = content.match(/export const KNOWN_OPERATION_TYPES = \[([\s\S]*?)\];/);
    const types = [];

    if (whitelistMatch) {
      const whitelistBody = whitelistMatch[1];
      const matches = whitelistBody.matchAll(/'([^']+)'/g);
      for (const match of matches) {
        types.push(match[1]);
      }
    }

    return types;
  } catch (error) {
    console.error('❌ Failed to read KNOWN_OPERATION_TYPES:', error.message);
    process.exit(1);
  }
}

/**
 * Extract registered operation types from interpreterRegistrations.js
 * @returns {string[]} Array of registered operation type strings (sorted)
 */
function extractRegisteredTypes() {
  try {
    const interpreterPath = path.join(
      projectRoot,
      'src/dependencyInjection/registrations/interpreterRegistrations.js'
    );
    const content = fs.readFileSync(interpreterPath, 'utf8');

    // Remove comment lines first
    const withoutComments = content
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');

    const types = [];
    // Pattern matches: registry.register('OPERATION_TYPE', bind(tokens.HandlerToken))
    // Handles both single-line and multi-line registrations
    const mappingMatches = withoutComments.matchAll(
      /registry\.register\(\s*['"]([A-Z_]+)['"]\s*,\s*bind\(tokens\.\w+\)/gs
    );

    for (const match of mappingMatches) {
      types.push(match[1]);
    }

    return types.sort();
  } catch (error) {
    console.error('❌ Failed to read registered handlers:', error.message);
    process.exit(1);
  }
}

/**
 * Check for registered handlers missing from whitelist
 * @param {string[]} registered - Registered operation types
 * @param {string[]} whitelist - Whitelisted operation types
 * @returns {string[]} Types registered but not whitelisted
 */
function checkMissingFromWhitelist(registered, whitelist) {
  const whitelistSet = new Set(whitelist);
  return registered.filter(type => !whitelistSet.has(type));
}

/**
 * Check for whitelisted types without registered handlers
 * @param {string[]} whitelist - Whitelisted operation types
 * @param {string[]} registered - Registered operation types
 * @returns {string[]} Types whitelisted but not registered
 */
function checkOrphanedInWhitelist(whitelist, registered) {
  const registeredSet = new Set(registered);
  return whitelist.filter(type => !registeredSet.has(type));
}

/**
 * Check if whitelist is alphabetically sorted
 * @param {string[]} whitelist - Whitelisted operation types
 * @returns {null|{current: string[], expected: string[]}} Null if sorted, object with ordering info if not
 */
function checkAlphabeticalOrder(whitelist) {
  const sorted = [...whitelist].sort();
  const isOrdered = JSON.stringify(sorted) === JSON.stringify(whitelist);

  if (isOrdered) return null;

  return {
    current: whitelist,
    expected: sorted
  };
}
