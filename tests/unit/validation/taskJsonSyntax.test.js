/**
 * @file Test suite for validating JSON syntax in task files
 * @description Ensures all task files have valid JSON syntax to prevent mod loading failures
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Task JSON Syntax Validation', () => {
  const tasksDir = join(process.cwd(), 'data/mods/core/tasks');

  it('should have valid JSON syntax in all task files', () => {
    const taskFiles = readdirSync(tasksDir).filter((file) =>
      file.endsWith('.task.json')
    );

    expect(taskFiles.length).toBeGreaterThan(0);

    const errors = [];

    for (const file of taskFiles) {
      const filePath = join(tasksDir, file);
      const content = readFileSync(filePath, 'utf-8');

      try {
        JSON.parse(content);
      } catch (err) {
        errors.push({
          file,
          error: err.message,
          position: err.message.match(/position (\d+)/)?.[1],
          line: err.message.match(/line (\d+)/)?.[1],
        });
      }
    }

    if (errors.length > 0) {
      const errorReport = errors
        .map(
          (e) =>
            `\n  - ${e.file}:\n    Error: ${e.error}\n    Line: ${e.line}, Position: ${e.position}`
        )
        .join('');

      throw new Error(
        `Found JSON syntax errors in ${errors.length} task file(s):${errorReport}`
      );
    }
  });

  it('should specifically validate consume_nourishing_item.task.json syntax', () => {
    const filePath = join(tasksDir, 'consume_nourishing_item.task.json');
    const content = readFileSync(filePath, 'utf-8');

    // This test should fail initially due to missing comma at line 31
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('should have proper comma separators between top-level properties', () => {
    const filePath = join(tasksDir, 'consume_nourishing_item.task.json');
    const content = readFileSync(filePath, 'utf-8');

    let parsed;
    expect(() => {
      parsed = JSON.parse(content);
    }).not.toThrow();

    // Verify expected properties exist (would fail if JSON is malformed)
    expect(parsed).toHaveProperty('planningPreconditions');
    expect(parsed).toHaveProperty('planningEffects');
    expect(Array.isArray(parsed.planningPreconditions)).toBe(true);
    expect(Array.isArray(parsed.planningEffects)).toBe(true);
  });
});
