/**
 * @file Manual verification test for context propagation fix
 * @description Simple test to verify that clothing:target_topmost_clothing scope
 * correctly uses target context instead of actor context
 */

import { describe, it, expect } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Context propagation fix verification', () => {
  it('should read target_topmost_clothing scope definition correctly', async () => {
    const testBed = createTestBed();

    // Verify the new scope file exists and has correct content
    const fs = await import('fs/promises');
    const scopeContent = await fs.readFile(
      'data/mods/clothing/scopes/target_topmost_clothing.scope',
      'utf-8'
    );

    expect(scopeContent).toContain('clothing:target_topmost_clothing');
    expect(scopeContent).toContain('target.topmost_clothing[]');
    expect(scopeContent).not.toContain('actor.topmost_clothing[]');

    testBed.cleanup();
  });

  it('should have updated action to use target_topmost_clothing scope', async () => {
    const testBed = createTestBed();

    // Verify the action file was updated
    const fs = await import('fs/promises');
    const actionContent = await fs.readFile(
      'data/mods/clothing/actions/remove_others_clothing.action.json',
      'utf-8'
    );

    const actionJson = JSON.parse(actionContent);

    expect(actionJson.targets.secondary.scope).toBe(
      'clothing:target_topmost_clothing'
    );
    expect(actionJson.targets.secondary.contextFrom).toBe('primary');

    testBed.cleanup();
  });
});
