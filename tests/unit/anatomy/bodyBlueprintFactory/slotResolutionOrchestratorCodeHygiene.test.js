/**
 * @file Code hygiene tests for slotResolutionOrchestrator.js
 *
 * Ensures production code quality standards are maintained.
 * Prevents regression of console.log debug statements in production code.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('slotResolutionOrchestrator code hygiene', () => {
  const filePath = path.join(
    process.cwd(),
    'src/anatomy/bodyBlueprintFactory/slotResolutionOrchestrator.js'
  );

  it('should not contain console.log calls in production code', () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Pattern matches console.log that is not preceded by // (comment)
    // Uses negative lookbehind to exclude commented lines
    const consoleLogPattern = /^(?!\s*\/\/).*console\.log\(/gm;
    const matches = fileContent.match(consoleLogPattern);

    expect(matches).toBeNull();
  });

  it('should not contain console.warn calls (use logger.warn instead)', () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Pattern matches console.warn that is not preceded by // (comment)
    const consoleWarnPattern = /^(?!\s*\/\/).*console\.warn\(/gm;
    const matches = fileContent.match(consoleWarnPattern);

    expect(matches).toBeNull();
  });

  it('should not contain console.error calls (use logger.error instead)', () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Pattern matches console.error that is not preceded by // (comment)
    const consoleErrorPattern = /^(?!\s*\/\/).*console\.error\(/gm;
    const matches = fileContent.match(consoleErrorPattern);

    expect(matches).toBeNull();
  });

  it('should not contain [DEBUG] markers in any form', () => {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Pattern matches [DEBUG] in any context (even in strings)
    const debugMarkerPattern = /\[DEBUG\]/gi;
    const matches = fileContent.match(debugMarkerPattern);

    expect(matches).toBeNull();
  });
});
