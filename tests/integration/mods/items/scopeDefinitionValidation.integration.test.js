/**
 * @file Integration test to verify container_contents.scope loads with correct syntax
 * Reproduces the runtime error where scope definition was missing := assignment operator
 * Tests that the scope file follows the required "name := dsl_expression" format
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('containers-core:container_contents Scope Definition Validation', () => {
  const scopePath = path.join(
    process.cwd(),
    'data/mods/containers-core/scopes/container_contents.scope'
  );

  it('should have container_contents.scope file', () => {
    expect(fs.existsSync(scopePath)).toBe(true);
  });

  it('should have correct scope definition format with := operator', () => {
    const scopeContent = fs.readFileSync(scopePath, 'utf8').trim();

    // Must contain := operator
    expect(scopeContent).toContain(':=');

    // Must follow pattern: scopeName := dslExpression
    const scopePattern = /^[a-zA-Z_][a-zA-Z0-9_:-]*\s*:=\s*.+$/;
    expect(scopeContent).toMatch(scopePattern);

    // Must start with namespaced scope name
    expect(scopeContent).toMatch(/^containers-core:container_contents\s*:=/);

    // Must include the DSL expression for container contents
    expect(scopeContent).toContain('target.containers-core:container.contents[]');
  });

  it('should have correct scope name and DSL expression', () => {
    const scopeContent = fs.readFileSync(scopePath, 'utf8').trim();

    // Parse the scope definition - split on := assignment operator
    const parts = scopeContent.split(':=');
    expect(parts.length).toBe(2);

    const scopeName = parts[0].trim();
    const dslExpression = parts[1].trim();

    expect(scopeName).toBe('containers-core:container_contents');
    expect(dslExpression).toBe('target.containers-core:container.contents[]');
  });

  it('should follow the same pattern as other scope definitions', () => {
    // Compare with actor_inventory_items.scope which we know is correct
    const referenceScopePath = path.join(
      process.cwd(),
      'data/mods/items/scopes/actor_inventory_items.scope'
    );

    const referenceContent = fs.readFileSync(referenceScopePath, 'utf8').trim();
    const targetContent = fs.readFileSync(scopePath, 'utf8').trim();

    // Both should have := operator
    expect(referenceContent).toContain(':=');
    expect(targetContent).toContain(':=');

    // Both should follow same pattern
    const scopePattern = /^[a-zA-Z_][a-zA-Z0-9_:-]*\s*:=\s*.+$/;
    expect(referenceContent).toMatch(scopePattern);
    expect(targetContent).toMatch(scopePattern);

    // Namespaces should be applied consistently
    expect(referenceContent).toMatch(/^items:/);
    expect(targetContent).toMatch(/^containers-core:/);
  });

  it('should reject invalid scope format (no := operator)', () => {
    // Test that validates the error condition we fixed
    const invalidScopeContent = 'target.containers-core:container.contents[]';

    // This should NOT match the scope pattern
    const scopePattern = /^[a-zA-Z_][a-zA-Z0-9_:]*\s*:=\s*.+$/;
    expect(invalidScopeContent).not.toMatch(scopePattern);

    // Should not contain := operator
    expect(invalidScopeContent).not.toContain(':=');
  });

  it('should have single-line scope definition', () => {
    const scopeContent = fs.readFileSync(scopePath, 'utf8');

    // Trim and check for single line
    const lines = scopeContent.trim().split('\n');
    expect(lines.length).toBe(1);
  });
});
