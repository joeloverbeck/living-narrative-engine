/**
 * @file Integration test reproducing task schema not loaded warning
 * @description This test reproduces the runtime issue where TaskLoader warns about
 * task.schema.json not being loaded, causing validation to be skipped.
 *
 * The issue: task.schema.json is NOT included in the getSchemaFiles() method
 * in StaticConfiguration, so it's never loaded by the schema validator during
 * application bootstrap. This causes TaskLoader to log warnings about the missing
 * schema and skip validation.
 */

import { describe, it, expect } from '@jest/globals';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';

describe('TaskLoader - Schema Not Loaded Issue', () => {
  it('should include task.schema.json in the list of schema files to load', () => {
    const config = new StaticConfiguration();
    const schemaFiles = config.getSchemaFiles();

    // The bug: task.schema.json is not in the array
    expect(schemaFiles).toContain('task.schema.json');
  });

  it('should have a schema ID mapping for tasks content type', () => {
    const config = new StaticConfiguration();
    const taskSchemaId = config.getContentTypeSchemaId('tasks');

    expect(taskSchemaId).toBe(
      'schema://living-narrative-engine/task.schema.json'
    );
  });
});
