import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import ModReferenceExtractor from '../../../src/validation/modReferenceExtractor.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs/promises module directly
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

describe('ModReferenceExtractor - Enhanced Context Extraction', () => {
  let testBed;
  let extractor;
  let mockLogger;
  let mockAjvValidator;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;
    
    mockAjvValidator = {
      validate: jest.fn(),
    };
    
    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator
    });

    // Reset mocks
    fs.readFile.mockClear();
    fs.readdir.mockClear();
  });

  afterEach(() => {
    testBed.cleanup?.();
    jest.clearAllMocks();
  });

  describe('Enhanced Reference Extraction with Context', () => {
    it('should extract contextual references successfully', async () => {
      // Mock directory structure - needs to be called twice (extractReferences and _findReferenceContexts)
      fs.readdir
        .mockResolvedValue([
          { name: 'test.action.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      // Mock file content with a reference
      const actionContent = JSON.stringify({
        "id": "kiss",
        "required_components": {
          "actor": ["intimacy:kissing"],
          "target": ["intimacy:romantic_interest"]
        }
      });
      fs.readFile.mockResolvedValue(actionContent);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result).toBeInstanceOf(Map);
      expect(result.has('intimacy')).toBe(true);
      
      const intimacyComponents = result.get('intimacy');
      expect(intimacyComponents).toHaveLength(2);
      
      // Check that components have context
      const kissingComponent = intimacyComponents.find(c => c.componentId === 'kissing');
      expect(kissingComponent).toBeDefined();
      expect(kissingComponent.contexts).toHaveLength(1);
      expect(kissingComponent.contexts[0]).toMatchObject({
        file: 'test.action.json',
        line: expect.any(Number),
        column: expect.any(Number),
        snippet: expect.any(String),
        type: 'action'
      });
    });

    it('should handle files with no contextual references', async () => {
      // Mock directory with file that has no references
      fs.readdir
        .mockResolvedValue([
          { name: 'empty.action.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const actionContent = JSON.stringify({
        "id": "simple_action",
        "description": "A simple action with no external references"
      });
      fs.readFile.mockResolvedValue(actionContent);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should create appropriate context objects with all required fields', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'test.rule.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const ruleContent = `{
  "id": "test-rule",
  "condition_ref": "positioning:close_to_target",
  "actions": [
    {
      "component": "intimacy:kissing"
    }
  ]
}`;
      fs.readFile.mockResolvedValue(ruleContent);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result.has('positioning')).toBe(true);
      expect(result.has('intimacy')).toBe(true);

      // Check positioning component context
      const positioningComponents = result.get('positioning');
      const closeToTargetComponent = positioningComponents.find(c => c.componentId === 'close_to_target');
      
      expect(closeToTargetComponent.contexts[0]).toMatchObject({
        file: 'test.rule.json',
        line: 3,
        column: expect.any(Number),
        snippet: expect.stringContaining('positioning:close_to_target'),
        type: 'rule',
        isBlocking: true,
        isOptional: true,
        isUserFacing: false
      });

      // Check intimacy component context
      const intimacyComponents = result.get('intimacy');
      const kissingComponent = intimacyComponents.find(c => c.componentId === 'kissing');
      
      expect(kissingComponent.contexts[0]).toMatchObject({
        file: 'test.rule.json',
        line: 6,
        column: expect.any(Number),
        snippet: expect.stringContaining('intimacy:kissing'),
        type: 'rule',
        isBlocking: true,
        isOptional: false,
        isUserFacing: false
      });
    });
  });

  describe('Context Type Detection', () => {
    it('should correctly identify action context type', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'test.action.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const content = '{"required_components": {"actor": ["test:component"]}}';
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');
      const component = result.get('test')[0];
      
      expect(component.contexts[0].type).toBe('action');
      expect(component.contexts[0].isUserFacing).toBe(true);
    });

    it('should correctly identify rule context type', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'test.rule.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const content = '{"condition_ref": "test:condition"}';
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');
      const component = result.get('test')[0];
      
      expect(component.contexts[0].type).toBe('rule');
      expect(component.contexts[0].isBlocking).toBe(true);
    });

    it('should correctly identify scope context type', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'test.scope', isDirectory: () => false, isFile: () => true }
        ]);
      
      const content = 'test:my_scope := actor.components.test:component';
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');
      const component = result.get('test')[0];
      
      expect(component.contexts[0].type).toBe('scope');
    });
  });

  describe('Context Snippet Creation', () => {
    it('should create appropriate snippets with ellipsis for long lines', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'test.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const longLine = '"very_long_property_name_that_goes_on_and_on": "test:component_with_very_long_name_here"';
      const content = `{\n  ${longLine}\n}`;
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');
      const component = result.get('test')[0];
      const snippet = component.contexts[0].snippet;
      
      // Should contain the reference and appropriate truncation
      expect(snippet).toContain('test:component_with_very_long_name_here');
      expect(snippet.length).toBeLessThan(longLine.length); // Should be truncated
    });

    it('should handle snippet creation for short lines', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'test.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const shortLine = '"ref": "test:comp"';
      const content = `{${shortLine}}`;
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');
      const component = result.get('test')[0];
      const snippet = component.contexts[0].snippet;
      
      expect(snippet).toBe('{"ref": "test:comp"}');
      expect(snippet).not.toContain('...');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle file read errors gracefully', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'bad.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      fs.readFile.mockRejectedValue(new Error('File read error'));

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process bad.json'),
        expect.any(Object)
      );
    });

    it('should skip core and special references in context extraction', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'test.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const content = JSON.stringify({
        "core_ref": "core:component",
        "none_ref": "none:component", 
        "self_ref": "self:component",
        "valid_ref": "test_mod:component"
      });
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result.has('core')).toBe(false);
      expect(result.has('none')).toBe(false);
      expect(result.has('self')).toBe(false);
      expect(result.has('test_mod')).toBe(true);
    });

    it('should handle empty directories', async () => {
      fs.readdir.mockResolvedValue([]);

      const result = await extractor.extractReferencesWithFileContext('/test/empty-mod');

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle nested directory structures', async () => {
      // Mock nested directory structure
      fs.readdir
        .mockResolvedValueOnce([
          { name: 'actions', isDirectory: () => true, isFile: () => false }
        ])
        .mockResolvedValueOnce([
          { name: 'test.action.json', isDirectory: () => false, isFile: () => true }
        ])
        .mockResolvedValueOnce([
          { name: 'actions', isDirectory: () => true, isFile: () => false }
        ])
        .mockResolvedValueOnce([
          { name: 'test.action.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const content = '{"required_components": {"actor": ["nested:component"]}}';
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result.has('nested')).toBe(true);
      const component = result.get('nested')[0];
      expect(component.contexts[0].file).toBe('actions/test.action.json');
    });
  });

  describe('Multiple References in Same File', () => {
    it('should capture multiple contexts for the same component', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'multi.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const content = `{
  "first_ref": "test:component",
  "nested": {
    "second_ref": "test:component"
  },
  "array": ["test:component"]
}`;
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result.has('test')).toBe(true);
      const component = result.get('test')[0];
      expect(component.componentId).toBe('component');
      expect(component.contexts).toHaveLength(3); // Three occurrences
      
      // Check different line numbers
      const lineNumbers = component.contexts.map(c => c.line);
      expect(new Set(lineNumbers)).toHaveProperty('size', 3);
    });

    it('should capture different components from same mod', async () => {
      fs.readdir
        .mockResolvedValue([
          { name: 'multi-comp.json', isDirectory: () => false, isFile: () => true }
        ]);
      
      const content = `{
  "first_component": "test:comp1",
  "second_component": "test:comp2"
}`;
      fs.readFile.mockResolvedValue(content);

      const result = await extractor.extractReferencesWithFileContext('/test/mod');

      expect(result.has('test')).toBe(true);
      const components = result.get('test');
      expect(components).toHaveLength(2);
      
      const componentIds = components.map(c => c.componentId);
      expect(componentIds).toContain('comp1');
      expect(componentIds).toContain('comp2');
    });
  });
});