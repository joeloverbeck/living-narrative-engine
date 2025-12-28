// @jest-environment node

import { describe, it, expect } from '@jest/globals';
import { globSync } from 'glob';
import fs from 'fs';
import path from 'path';

const LEGACY_INLINE_CONSTANTS = new Set([
  'src/logic/operationHandlers/addPerceptionLogEntryHandler.js:39:SENSORIAL_LINKS_COMPONENT_ID',
  'src/logic/operationHandlers/addPerceptionLogEntryHandler.js:40:LOCATION_NAME_COMPONENT_ID',
  'src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js:37:POSITION_COMPONENT_ID',
  'src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js:38:CLOSENESS_COMPONENT_ID',
  'src/logic/operationHandlers/unwieldItemHandler.js:29:WIELDING_COMPONENT_ID',
  'src/logic/operationHandlers/unwieldItemHandler.js:30:ITEM_UNWIELDED_EVENT',
]);

const HANDLERS_DIR = 'src/logic/operationHandlers';
const COMPONENT_CONSTANT_PATTERN = /const\s+(\w+_COMPONENT_ID)\s*=\s*['"`]/;
const EVENT_CONSTANT_PATTERN = /const\s+(\w+_EVENT(?:_ID)?)\s*=\s*['"`]/;

/**
 * Collect inline constants matching the supplied regex.
 *
 * @param {RegExp} pattern - Regex to match inline constant declarations.
 * @returns {Array<{entry: string, filePath: string, lineNumber: number, line: string}>} List of violations.
 */
function collectInlineConstants(pattern) {
  const handlerFiles = globSync(`${HANDLERS_DIR}/**/*Handler.js`, { nodir: true });
  const violations = [];

  for (const filePath of handlerFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('import') ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        return;
      }

      const match = trimmed.match(pattern);
      if (!match) {
        return;
      }

      const entry = `${relativePath}:${index + 1}:${match[1]}`;
      if (!LEGACY_INLINE_CONSTANTS.has(entry)) {
        violations.push({
          entry,
          filePath: relativePath,
          lineNumber: index + 1,
          line: line.trim(),
        });
      }
    });
  }

  return violations;
}

/**
 * Build an actionable error message for inline constant violations.
 *
 * @param {string} label - Label describing the constant type.
 * @param {Array<{filePath: string, lineNumber: number, line: string}>} violations - Violations to report.
 * @param {string} suggestion - Suggested fix guidance.
 * @returns {string} Formatted error message.
 */
function buildErrorMessage(label, violations, suggestion) {
  const details = violations
    .map(
      ({ filePath, lineNumber, line }) =>
        `${filePath}:${lineNumber} ${line}`
    )
    .join('\n');
  return [
    `New inline ${label} constants detected.`,
    details,
    suggestion,
  ].join('\n');
}

describe('Hardcoded Constants Static Analysis', () => {
  it('blocks new inline component ID constants in handlers', () => {
    const violations = collectInlineConstants(COMPONENT_CONSTANT_PATTERN);

    if (violations.length > 0) {
      throw new Error(
        buildErrorMessage(
          'component ID',
          violations,
          'Import component IDs from src/constants/componentIds.js instead.'
        )
      );
    }

    expect(violations).toHaveLength(0);
  });

  it('blocks new inline event ID constants in handlers', () => {
    const violations = collectInlineConstants(EVENT_CONSTANT_PATTERN);

    if (violations.length > 0) {
      throw new Error(
        buildErrorMessage(
          'event ID',
          violations,
          'Import event IDs from src/constants/eventIds.js instead.'
        )
      );
    }

    expect(violations).toHaveLength(0);
  });
});
