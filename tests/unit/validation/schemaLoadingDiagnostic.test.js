/**
 * @file Diagnostic test to understand exact schema loading state during game loading
 */

import { describe, it, expect, jest } from '@jest/globals';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Schema Loading Diagnostic', () => {
  it('should show exactly what schemas are loaded in the DI container validator', async () => {
    // Create container and mock UI elements as required by configureContainer
    const container = new AppContainer();
    
    // Create mock UI elements
    const mockOutputDiv = { innerHTML: '', appendChild: jest.fn() };
    const mockInputElement = { value: '', addEventListener: jest.fn() };
    const mockTitleElement = { textContent: '' };
    const mockDocument = { 
      getElementById: jest.fn(),
      createElement: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    // Configure container with required parameters
    await configureContainer(container, {
      outputDiv: mockOutputDiv,
      inputElement: mockInputElement,
      titleElement: mockTitleElement,
      document: mockDocument,
    });
    
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    const logger = container.resolve(tokens.ILogger);

    console.log('=== SCHEMA VALIDATOR STATE AT DI SETUP ===');
    const loadedSchemas = schemaValidator.getLoadedSchemaIds();
    console.log('Number of loaded schemas:', loadedSchemas.length);
    console.log('Loaded schema IDs:', loadedSchemas.sort());

    console.log('\n=== GAME SCHEMA LOADING STATUS ===');
    const gameSchemas = [
      'schema://living-narrative-engine/rule.schema.json',
      'schema://living-narrative-engine/operation.schema.json',
      'schema://living-narrative-engine/common.schema.json',
      'schema://living-narrative-engine/operations/queryComponents.schema.json',
      'schema://living-narrative-engine/operations/if.schema.json',
      'schema://living-narrative-engine/operations/dispatchThought.schema.json'
    ];

    gameSchemas.forEach(schemaId => {
      const isLoaded = schemaValidator.isSchemaLoaded(schemaId);
      console.log(`${schemaId}: ${isLoaded ? 'LOADED' : 'NOT LOADED'}`);
    });

    console.log('\n=== TESTING RULE VALIDATION WITH CURRENT STATE ===');
    
    // Test rule validation as would happen during game loading
    const entityThoughtRule = {
      $schema: 'schema://living-narrative-engine/rule.schema.json',
      rule_id: 'entity_thought',
      event_type: 'core:entity_thought',
      actions: [
        {
          type: 'IF',
          parameters: {
            condition: { var: 'context.test' },
            then_actions: []
          }
        }
      ]
    };

    console.log('Is rule schema loaded?', schemaValidator.isSchemaLoaded('schema://living-narrative-engine/rule.schema.json'));
    
    try {
      const result = schemaValidator.validate('schema://living-narrative-engine/rule.schema.json', entityThoughtRule);
      console.log('Validation result:', result.isValid);
      if (!result.isValid) {
        console.log('Number of errors:', result.errors.length);
        console.log('First few errors:', result.errors.slice(0, 3).map(e => ({
          path: e.instancePath,
          message: e.message,
          keyword: e.keyword
        })));
      }
    } catch (error) {
      console.log('Validation threw error:', error.message);
    }

    // This is mainly a diagnostic test, so we don't need strict assertions
    console.log('\n=== DIAGNOSTIC COMPLETE ===');
  });

  it('should test SchemaLoader functionality directly', async () => {
    // Test SchemaLoader directly to see if it works
    const container = new AppContainer();
    
    // Create mock UI elements
    const mockOutputDiv = { innerHTML: '', appendChild: jest.fn() };
    const mockInputElement = { value: '', addEventListener: jest.fn() };
    const mockTitleElement = { textContent: '' };
    const mockDocument = { 
      getElementById: jest.fn(),
      createElement: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    
    // Configure container with required parameters
    await configureContainer(container, {
      outputDiv: mockOutputDiv,
      inputElement: mockInputElement,
      titleElement: mockTitleElement,
      document: mockDocument,
    });
    
    const schemaLoader = container.resolve(tokens.SchemaLoader);
    const schemaValidator = container.resolve(tokens.ISchemaValidator);
    const logger = container.resolve(tokens.ILogger);

    console.log('\n=== TESTING SCHEMALOADER DIRECTLY ===');
    console.log('Schemas before SchemaLoader.loadAndCompileAllSchemas():');
    console.log('Count:', schemaValidator.getLoadedSchemaIds().length);

    try {
      await schemaLoader.loadAndCompileAllSchemas();
      console.log('SchemaLoader.loadAndCompileAllSchemas() completed successfully');
      
      console.log('\nSchemas after SchemaLoader.loadAndCompileAllSchemas():');
      const schemasAfter = schemaValidator.getLoadedSchemaIds();
      console.log('Count:', schemasAfter.length);
      console.log('Game schema status after loading:');
      
      const gameSchemas = [
        'schema://living-narrative-engine/rule.schema.json',
        'schema://living-narrative-engine/operation.schema.json'
      ];
      
      gameSchemas.forEach(schemaId => {
        const isLoaded = schemaValidator.isSchemaLoaded(schemaId);
        console.log(`${schemaId}: ${isLoaded ? 'LOADED' : 'NOT LOADED'}`);
      });

      // Now try validation again
      const entityThoughtRule = {
        rule_id: 'entity_thought',
        event_type: 'core:entity_thought',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { var: 'context.test' },
              then_actions: []
            }
          }
        ]
      };

      const result = schemaValidator.validate('schema://living-narrative-engine/rule.schema.json', entityThoughtRule);
      console.log('Rule validation after schema loading:', result.isValid);
      
    } catch (error) {
      console.log('SchemaLoader failed:', error.message);
    }
  });
});