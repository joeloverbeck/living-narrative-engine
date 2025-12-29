/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseDslExpression } from '../../../../src/scopeDsl/parser/parser.js';

/**
 * Integration tests to verify that the personal-space mod's scope files
 * exist, are properly listed in the manifest, and can be parsed.
 *
 * These tests verify the fix for ScopeNotFoundError caused by accidentally
 * deleted scope files in commit ed4d0a2acdc2ba1d82e64435f708ad68f5b2a714.
 */
describe('Personal Space Scope Loading Verification', () => {
  const modsPath = join(
    process.cwd(),
    'data',
    'mods',
    'personal-space'
  );
  const scopesPath = join(modsPath, 'scopes');
  const manifestPath = join(modsPath, 'mod-manifest.json');

  let manifest;

  beforeAll(() => {
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(manifestContent);
  });

  describe('actors_sitting_with_space_to_right.scope', () => {
    const scopeFileName = 'actors_sitting_with_space_to_right.scope';
    const scopeFilePath = join(scopesPath, scopeFileName);

    test('scope file should exist', () => {
      expect(existsSync(scopeFilePath)).toBe(true);
    });

    test('scope should be listed in mod manifest', () => {
      expect(manifest.content.scopes).toContain(scopeFileName);
    });

    test('scope file should contain valid scope definition', () => {
      const content = readFileSync(scopeFilePath, 'utf-8');

      // Should contain the scope ID
      expect(content).toContain(
        'personal-space:actors_sitting_with_space_to_right'
      );

      // Should use the hasSittingSpaceToRight operator
      expect(content).toContain('hasSittingSpaceToRight');
    });

    test('scope expression should be parseable', () => {
      const content = readFileSync(scopeFilePath, 'utf-8');

      // Extract expression after :=
      const match = content.match(/:=\s*(.+)/s);
      expect(match).not.toBeNull();

      const expression = match[1].trim();

      // Should not throw when parsing
      expect(() => parseDslExpression(expression)).not.toThrow();
    });
  });

  describe('furniture_actor_sitting_on.scope', () => {
    const scopeFileName = 'furniture_actor_sitting_on.scope';
    const scopeFilePath = join(scopesPath, scopeFileName);

    test('scope file should exist', () => {
      expect(existsSync(scopeFilePath)).toBe(true);
    });

    test('scope should be listed in mod manifest', () => {
      expect(manifest.content.scopes).toContain(scopeFileName);
    });

    test('scope file should contain valid scope definition', () => {
      const content = readFileSync(scopeFilePath, 'utf-8');

      // Should contain the scope ID
      expect(content).toContain('personal-space:furniture_actor_sitting_on');

      // Should reference the sitting-states:sitting_on component
      expect(content).toContain('sitting-states:sitting_on');
    });

    test('scope expression should be parseable', () => {
      const content = readFileSync(scopeFilePath, 'utf-8');

      // Extract expression after :=
      const match = content.match(/:=\s*(.+)/s);
      expect(match).not.toBeNull();

      const expression = match[1].trim();

      // Should not throw when parsing
      expect(() => parseDslExpression(expression)).not.toThrow();
    });
  });

  describe('sit_down_at_distance action scope references', () => {
    const actionPath = join(
      modsPath,
      'actions',
      'sit_down_at_distance.action.json'
    );

    test('action file should reference actors_sitting_with_space_to_right scope', () => {
      const actionContent = readFileSync(actionPath, 'utf-8');
      const action = JSON.parse(actionContent);

      // The secondary target should reference the scope
      expect(action.targets.secondary.scope).toBe(
        'personal-space:actors_sitting_with_space_to_right'
      );
    });

    test('referenced scope should exist in manifest', () => {
      // Verify the scope referenced in the action is listed in manifest
      expect(manifest.content.scopes).toContain(
        'actors_sitting_with_space_to_right.scope'
      );
    });
  });
});
