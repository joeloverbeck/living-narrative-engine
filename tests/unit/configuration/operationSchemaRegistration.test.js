/**
 * @file Test to ensure all operation schema files are registered in configuration
 * Prevents missing schema registration errors
 */

import { describe, it, expect } from '@jest/globals';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';

describe('Operation Schema Registration', () => {
  it('should include all operation schema files in OPERATION_SCHEMA_FILES', async () => {
    const config = new StaticConfiguration();
    const schemaPath = join(config.getBaseDataPath(), config.getSchemaBasePath(), 'operations');
    
    // Get all .schema.json files from the operations directory
    const files = await readdir(schemaPath);
    const schemaFiles = files.filter(file => file.endsWith('.schema.json'));
    
    // Get the configured schema files
    const configuredSchemas = config.getSchemaFiles()
      .filter(file => file.startsWith('operations/'))
      .map(file => file.replace('operations/', ''));
    
    // Sort for easier comparison
    schemaFiles.sort();
    configuredSchemas.sort();
    
    // Check that all schema files in the directory are configured
    const missingSchemas = schemaFiles.filter(file => !configuredSchemas.includes(file));
    
    expect(missingSchemas).toEqual([]);
    
    // Also verify the inverse - no configured schemas that don't exist
    const nonExistentSchemas = configuredSchemas.filter(file => !schemaFiles.includes(file));
    
    expect(nonExistentSchemas).toEqual([]);
    
    // Verify counts match
    expect(configuredSchemas.length).toBe(schemaFiles.length);
  });

  it('should verify unequipClothing.schema.json is specifically included', () => {
    const config = new StaticConfiguration();
    const schemaFiles = config.getSchemaFiles();
    
    const hasUnequipClothing = schemaFiles.some(file => 
      file === 'operations/unequipClothing.schema.json'
    );
    
    expect(hasUnequipClothing).toBe(true);
  });

  it('should maintain alphabetical order in OPERATION_SCHEMA_FILES for readability', () => {
    const config = new StaticConfiguration();
    const operationSchemas = config.getSchemaFiles()
      .filter(file => file.startsWith('operations/'))
      .map(file => file.replace('operations/', ''));
    
    // Create a sorted copy
    const sortedSchemas = [...operationSchemas].sort();
    
    // They should be equal if the original was sorted
    expect(operationSchemas).toEqual(sortedSchemas);
  });
});