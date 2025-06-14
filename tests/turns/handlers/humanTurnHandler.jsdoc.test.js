import { describe, it, expect } from '@jest/globals';
import fs from 'fs';

/**
 * Ensures that humanTurnHandler.js declares the IPromptCoordinator typedef.
 */
describe('humanTurnHandler JSDoc', () => {
  it('includes IPromptCoordinator typedef', () => {
    const contents = fs.readFileSync(
      'src/turns/handlers/humanTurnHandler.js',
      'utf8'
    );
    expect(contents).toMatch(
      /import\('\.\.\/\.\.\/interfaces\/IPromptCoordinator\.js'\)\.IPromptCoordinator/
    );
  });
});
