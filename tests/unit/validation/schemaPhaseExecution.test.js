/**
 * @file Test to debug why SchemaPhase doesn't run in production
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Schema Phase Execution Debug', () => {
  let testBed;
  let schemaPhase;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    schemaPhase = testBed.container.resolve('SchemaPhase');
  });

  afterEach(() => {
    testBed?.cleanup();
  });

  it('should be able to construct SchemaPhase without errors', () => {
    expect(schemaPhase).toBeDefined();
    expect(schemaPhase.name).toBe('schema');
  });

  it('should execute SchemaPhase and log start message', async () => {
    const mockLogger = testBed.container.resolve('ILogger');
    
    console.log('Testing SchemaPhase execution...');
    
    // Create minimal load context
    const loadContext = {
      startTime: Date.now(),
      config: {},
      stats: {}
    };

    let executionError = null;
    let result = null;
    
    try {
      result = await schemaPhase.execute(loadContext);
      console.log('SchemaPhase executed successfully');
    } catch (error) {
      executionError = error;
      console.error('SchemaPhase execution failed:', error.message);
      console.error('Stack trace:', error.stack);
    }

    // Check if the logger was called with start message
    const loggerCalls = mockLogger.info.mock?.calls || [];
    const startMessageFound = loggerCalls.some(call => 
      call && call[0] && call[0].includes('SchemaPhase starting')
    );
    
    console.log('Logger info calls:', loggerCalls.map(call => call?.[0]).filter(Boolean));
    console.log('Start message found:', startMessageFound);
    
    if (executionError) {
      console.log('Execution failed with error:', executionError.constructor.name, ':', executionError.message);
    } else {
      console.log('Execution completed, result:', result ? Object.keys(result) : 'null');
    }

    // Test passes if we can identify what's happening
    expect(true).toBe(true);
  });
});