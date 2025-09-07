/**
 * @file Test SchemaPhase construction and dependency resolution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('SchemaPhase Construction Debug', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should resolve all phase dependencies without error', () => {
    console.log('Testing phase dependency resolution...');
    
    const phaseTokens = [
      'SchemaPhase',
      'GameConfigPhase', 
      'ManifestPhase',
      'ContentPhase',
      'WorldPhase',
      'SummaryPhase'
    ];
    
    const resolvedPhases = [];
    
    for (const token of phaseTokens) {
      try {
        console.log(`Resolving ${token}...`);
        const phase = testBed.container.resolve(token);
        console.log(`✓ ${token} resolved successfully (name: ${phase.name})`);
        resolvedPhases.push({ token, phase });
      } catch (error) {
        console.error(`✗ ${token} failed to resolve: ${error.message}`);
        console.error('Stack trace:', error.stack);
        throw error;
      }
    }
    
    expect(resolvedPhases).toHaveLength(6);
    console.log(`All ${resolvedPhases.length} phases resolved successfully`);
  });

  it('should construct ModsLoader with phases array', () => {
    console.log('Testing ModsLoader construction...');
    
    let modsLoader;
    try {
      modsLoader = testBed.container.resolve('ModsLoader');
      console.log('✓ ModsLoader resolved successfully');
    } catch (error) {
      console.error('✗ ModsLoader failed to resolve:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
    
    expect(modsLoader).toBeDefined();
    console.log('ModsLoader construction successful');
  });

  it('should test SchemaPhase dependencies individually', () => {
    console.log('Testing SchemaPhase dependencies...');
    
    const dependencies = [
      'SchemaLoader',
      'IConfiguration', 
      'ISchemaValidator',
      'ILogger'
    ];
    
    for (const dep of dependencies) {
      try {
        console.log(`Resolving dependency ${dep}...`);
        const resolved = testBed.container.resolve(dep);
        console.log(`✓ ${dep} resolved successfully`);
      } catch (error) {
        console.error(`✗ ${dep} failed to resolve: ${error.message}`);
        throw error;
      }
    }
    
    console.log('All SchemaPhase dependencies resolved successfully');
    expect(true).toBe(true);
  });
});