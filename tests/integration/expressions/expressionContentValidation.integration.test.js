/**
 * @file Integration tests for core expression content validation.
 */

import { describe, expect, it } from '@jest/globals';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';

const EXPRESSIONS_DIR = path.resolve(
  process.cwd(),
  'data',
  'mods',
  'emotions',
  'expressions'
);

const loadExpressions = async () => {
  const files = await readdir(EXPRESSIONS_DIR);
  const expressions = [];

  for (const file of files) {
    if (!file.endsWith('.expression.json')) {
      continue;
    }

    const expression = JSON.parse(
      await readFile(path.join(EXPRESSIONS_DIR, file), 'utf-8')
    );
    expressions.push(expression);
  }

  return expressions;
};

describe('Expression Content Validation - Integration', () => {
  it('loads core expressions with required fields and unique ids', async () => {
    const expressions = await loadExpressions();

    expect(expressions.length).toBeGreaterThan(0);

    const ids = new Set();
    for (const expression of expressions) {
      expect(expression.id).toMatch(/^[a-z0-9_-]+:[a-z0-9_-]+$/);
      expect(expression.priority).toEqual(expect.any(Number));
      expect(expression.priority).toBeGreaterThanOrEqual(0);
      expect(expression.priority).toBeLessThanOrEqual(100);
      expect(Array.isArray(expression.prerequisites)).toBe(true);
      expect(expression.actor_description).toEqual(expect.any(String));
      expect(expression.description_text).toEqual(expect.any(String));
      expect(expression.description_text).toContain('{actor}');

      if (expression.perception_type !== undefined) {
        expect(expression.perception_type).toBe('emotion.expression');
      }

      expect(Array.isArray(expression.tags)).toBe(true);
      expect(expression.tags.length).toBeGreaterThan(0);

      for (const prerequisite of expression.prerequisites) {
        expect(prerequisite.logic).toEqual(expect.any(Object));
      }

      ids.add(expression.id);
    }

    expect(ids.size).toBe(expressions.length);
  });
});
