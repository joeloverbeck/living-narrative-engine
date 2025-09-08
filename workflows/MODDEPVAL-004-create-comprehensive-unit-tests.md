# MODDEPVAL-004: Create Comprehensive Unit Tests for Reference Extraction

## Overview

Create a comprehensive test suite for the `ModReferenceExtractor` system, ensuring high coverage and robust validation of all reference extraction functionality. This includes tests for JSON processing, Scope DSL parsing, error handling, and performance requirements.

## Background

The reference extraction system is critical for detecting mod dependency violations. Comprehensive testing ensures reliability and prevents false positives/negatives that could break the development workflow or miss actual violations.

**Testing targets:**
- Core extraction functionality (MODDEPVAL-001)
- Enhanced JSON processing (MODDEPVAL-002)  
- Scope DSL parsing (MODDEPVAL-003)
- Error handling and edge cases
- Performance requirements
- Integration with existing infrastructure

## Technical Specifications

### Test Structure Overview

```
tests/unit/validation/modReferenceExtractor/
├── core.test.js                 # Core functionality tests
├── jsonExtraction.test.js       # JSON file processing tests  
├── scopeDslExtraction.test.js   # Scope DSL parsing tests
├── errorHandling.test.js        # Error scenarios and recovery
├── performance.test.js          # Performance benchmarks
├── integration.test.js          # Integration with existing systems
└── fixtures/                    # Test data files
    ├── validMods/               # Valid mod structures for testing
    ├── invalidMods/             # Mods with various violations
    ├── sampleActions/           # Action file test cases
    ├── sampleRules/             # Rule file test cases
    ├── sampleScopes/            # Scope DSL test cases
    └── performanceData/         # Large test datasets
```

### Core Functionality Tests

```javascript
// tests/unit/validation/modReferenceExtractor/core.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import ModReferenceExtractor from '../../../../src/validation/modReferenceExtractor.js';
import path from 'path';
import fs from 'fs/promises';

describe('ModReferenceExtractor - Core Functionality', () => {
  let testBed;
  let extractor;
  let mockLogger;
  let mockAjvValidator;
  let testTempDir;

  beforeEach(async () => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockAjvValidator = testBed.createMock('ajvValidator', ['validateSchema']);
    
    extractor = new ModReferenceExtractor({
      logger: mockLogger,
      ajvValidator: mockAjvValidator
    });

    // Create temporary directory for test files
    testTempDir = await testBed.createTempDirectory('mod-ref-extractor-tests');
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor and Initialization', () => {
    it('should validate logger dependency correctly', () => {
      expect(() => {
        new ModReferenceExtractor({
          logger: null,
          ajvValidator: mockAjvValidator
        });
      }).toThrow('Logger is required');
    });

    it('should validate ajvValidator dependency correctly', () => {
      expect(() => {
        new ModReferenceExtractor({
          logger: mockLogger,
          ajvValidator: null
        });
      }).toThrow('ajvValidator is required');
    });

    it('should validate logger has required methods', () => {
      const invalidLogger = { log: jest.fn() }; // Missing required methods
      
      expect(() => {
        new ModReferenceExtractor({
          logger: invalidLogger,
          ajvValidator: mockAjvValidator
        });
      }).toThrow('Logger must have required methods: info, warn, error, debug');
    });

    it('should initialize successfully with valid dependencies', () => {
      const validExtractor = new ModReferenceExtractor({
        logger: mockLogger,
        ajvValidator: mockAjvValidator
      });
      
      expect(validExtractor).toBeDefined();
    });
  });

  describe('Directory Scanning', () => {
    beforeEach(async () => {
      // Create test mod structure
      await testBed.createFileStructure(testTempDir, {
        'actions/': {
          'move.action.json': JSON.stringify({
            required_components: { actor: ['positioning:closeness'] }
          }),
          'kiss.action.json': JSON.stringify({
            required_components: { actor: ['intimacy:attraction'] },
            forbidden_components: { actor: ['violence:attacking'] }
          })
        },
        'rules/': {
          'movement.rule.json': JSON.stringify({
            condition_ref: 'positioning:can_move'
          })
        },
        'scopes/': {
          'nearby.scope': 'positioning:nearby_actors := actor.components.positioning:closeness.partners'
        },
        'components/': {
          'custom.component.json': JSON.stringify({
            id: 'test:custom',
            dataSchema: {
              references: 'intimacy:attraction'
            }
          })
        }
      });
    });

    it('should extract references from entire mod directory', async () => {
      const references = await extractor.extractReferences(testTempDir);
      
      expect(references.has('positioning')).toBe(true);
      expect(references.has('intimacy')).toBe(true);
      expect(references.has('violence')).toBe(true);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('positioning')).toContain('can_move');
      expect(references.get('positioning')).toContain('nearby_actors');
      
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('violence')).toContain('attacking');
    });

    it('should handle nested directory structures', async () => {
      await testBed.createFileStructure(testTempDir, {
        'subdirectory/': {
          'nested/': {
            'deep.action.json': JSON.stringify({
              required_components: { actor: ['deep:component'] }
            })
          }
        }
      });

      const references = await extractor.extractReferences(testTempDir);
      expect(references.get('deep')).toContain('component');
    });

    it('should skip non-relevant files', async () => {
      await testBed.createFileStructure(testTempDir, {
        'README.md': '# Test mod',
        'image.png': Buffer.from('fake image'),
        'script.js': 'console.log("test");',
        'data.txt': 'some text data'
      });

      const references = await extractor.extractReferences(testTempDir);
      // Should not fail, just skip these files
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping file with unsupported extension')
      );
    });

    it('should handle empty directories gracefully', async () => {
      const emptyDir = path.join(testTempDir, 'empty');
      await fs.mkdir(emptyDir);

      const references = await extractor.extractReferences(emptyDir);
      expect(references.size).toBe(0);
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify action files', () => {
      expect(extractor.#detectJsonFileType('/path/to/move.action.json')).toBe('action');
      expect(extractor.#detectJsonFileType('/complex/path/kiss_passionately.action.json')).toBe('action');
    });

    it('should correctly identify rule files', () => {
      expect(extractor.#detectJsonFileType('/path/to/movement.rule.json')).toBe('rule');
      expect(extractor.#detectJsonFileType('/path/to/complex_rule_name.rule.json')).toBe('rule');
    });

    it('should correctly identify condition files', () => {
      expect(extractor.#detectJsonFileType('/path/to/can_move.condition.json')).toBe('condition');
    });

    it('should correctly identify component files', () => {
      expect(extractor.#detectJsonFileType('/path/to/attraction.component.json')).toBe('component');
    });

    it('should correctly identify event files', () => {
      expect(extractor.#detectJsonFileType('/path/to/movement_started.event.json')).toBe('event');
    });

    it('should correctly identify blueprint files', () => {
      expect(extractor.#detectJsonFileType('/path/to/human.blueprint.json')).toBe('blueprint');
    });

    it('should correctly identify recipe files', () => {
      expect(extractor.#detectJsonFileType('/path/to/body.recipe.json')).toBe('recipe');
    });

    it('should handle unknown JSON file types', () => {
      expect(extractor.#detectJsonFileType('/path/to/unknown.json')).toBe('unknown');
      expect(extractor.#detectJsonFileType('/path/to/data.json')).toBe('unknown');
    });
  });

  describe('String Pattern Matching', () => {
    it('should extract basic mod references', () => {
      const references = new Map();
      extractor.#extractModReferencesFromString('positioning:closeness', references);
      
      expect(references.get('positioning')).toContain('closeness');
    });

    it('should extract multiple references from single string', () => {
      const references = new Map();
      extractor.#extractModReferencesFromString(
        'actor has positioning:closeness and intimacy:attraction', 
        references
      );
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should ignore core references', () => {
      const references = new Map();
      extractor.#extractModReferencesFromString('core:actor', references);
      
      expect(references.has('core')).toBe(false);
    });

    it('should ignore special references', () => {
      const references = new Map();
      extractor.#extractModReferencesFromString('none:nothing self:reference', references);
      
      expect(references.has('none')).toBe(false);
      expect(references.has('self')).toBe(false);
    });

    it('should handle component field access patterns', () => {
      const references = new Map();
      extractor.#extractModReferencesFromString(
        'positioning:closeness.distance.value', 
        references
      );
      
      expect(references.get('positioning')).toContain('closeness');
    });

    it('should handle empty or invalid strings gracefully', () => {
      const references = new Map();
      
      extractor.#extractModReferencesFromString('', references);
      extractor.#extractModReferencesFromString(null, references);
      extractor.#extractModReferencesFromString(undefined, references);
      
      expect(references.size).toBe(0);
    });
  });

  describe('Reference Merging', () => {
    it('should merge references correctly', () => {
      const references = new Map();
      
      // Add initial reference
      extractor.#extractModReferencesFromString('positioning:closeness', references);
      expect(references.get('positioning').size).toBe(1);
      
      // Add another reference to same mod
      extractor.#extractModReferencesFromString('positioning:sitting', references);
      expect(references.get('positioning').size).toBe(2);
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('positioning')).toContain('sitting');
      
      // Add reference to different mod
      extractor.#extractModReferencesFromString('intimacy:attraction', references);
      expect(references.has('intimacy')).toBe(true);
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should handle duplicate references correctly', () => {
      const references = new Map();
      
      // Add same reference multiple times
      extractor.#extractModReferencesFromString('positioning:closeness', references);
      extractor.#extractModReferencesFromString('positioning:closeness', references);
      extractor.#extractModReferencesFromString('positioning:closeness', references);
      
      // Should only have one instance
      expect(references.get('positioning').size).toBe(1);
      expect(references.get('positioning')).toContain('closeness');
    });
  });

  describe('Logging and Debug Information', () => {
    it('should log extraction progress', async () => {
      await testBed.createFileStructure(testTempDir, {
        'test.action.json': JSON.stringify({
          required_components: { actor: ['positioning:closeness'] }
        })
      });

      await extractor.extractReferences(testTempDir);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting reference extraction')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Extracted references')
      );
    });

    it('should log reference discoveries with context', () => {
      const references = new Map();
      extractor.#extractModReferencesFromString('positioning:closeness', references, 'test-context');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Found reference positioning:closeness in test-context'
      );
    });
  });
});
```

### JSON Extraction Tests

```javascript
// tests/unit/validation/modReferenceExtractor/jsonExtraction.test.js

describe('ModReferenceExtractor - JSON Processing', () => {
  // Test cases for enhanced JSON extraction from MODDEPVAL-002
  
  describe('Action File Processing', () => {
    it('should extract required components from action files', () => {
      const actionData = {
        required_components: {
          actor: ['positioning:closeness', 'intimacy:attraction'],
          target: ['core:actor', 'violence:health']
        }
      };
      
      const references = new Map();
      extractor.#extractFromActionFile(actionData, references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('violence')).toContain('health');
      expect(references.has('core')).toBe(false); // Core filtered out
    });

    it('should extract forbidden components from action files', () => {
      const actionData = {
        forbidden_components: {
          actor: ['intimacy:kissing', 'violence:attacking'],
          target: ['positioning:sitting']
        }
      };
      
      const references = new Map();
      extractor.#extractFromActionFile(actionData, references);
      
      expect(references.get('intimacy')).toContain('kissing');
      expect(references.get('violence')).toContain('attacking');
      expect(references.get('positioning')).toContain('sitting');
    });

    it('should extract target scope references', () => {
      const actionData = {
        targets: {
          scope: 'positioning:close_actors_facing_each_other'
        }
      };
      
      const references = new Map();
      extractor.#extractFromActionFile(actionData, references);
      
      expect(references.get('positioning')).toContain('close_actors_facing_each_other');
    });

    it('should handle missing or empty component arrays', () => {
      const actionData = {
        required_components: {
          actor: [],
          target: null
        },
        forbidden_components: {}
      };
      
      const references = new Map();
      expect(() => {
        extractor.#extractFromActionFile(actionData, references);
      }).not.toThrow();
      
      expect(references.size).toBe(0);
    });
  });

  describe('Rule File Processing', () => {
    it('should extract condition references from rule files', () => {
      const ruleData = {
        condition_ref: 'positioning:can_move_to_furniture'
      };
      
      const references = new Map();
      extractor.#extractFromRuleFile(ruleData, references);
      
      expect(references.get('positioning')).toContain('can_move_to_furniture');
    });

    it('should extract inline JSON Logic conditions', () => {
      const ruleData = {
        condition: {
          and: [
            { has_component: ['actor', 'positioning:closeness'] },
            { has_component: ['target', 'intimacy:attraction'] }
          ]
        }
      };
      
      const references = new Map();
      extractor.#extractFromRuleFile(ruleData, references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should process operation handlers in rules', () => {
      const ruleData = {
        operations: [
          {
            type: 'add_component',
            target: 'actor',
            component: 'positioning:sitting'
          }
        ]
      };
      
      const references = new Map();
      extractor.#extractFromRuleFile(ruleData, references);
      
      expect(references.get('positioning')).toContain('sitting');
    });
  });

  describe('Component File Processing', () => {
    it('should extract references from component schemas', () => {
      const componentData = {
        id: 'test:component',
        dataSchema: {
          type: 'object',
          properties: {
            dependency: {
              type: 'string',
              enum: ['positioning:closeness', 'intimacy:attraction']
            }
          }
        }
      };
      
      const references = new Map();
      extractor.#extractFromComponentFile(componentData, references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should extract references from default data', () => {
      const componentData = {
        id: 'test:component',
        defaultData: {
          relatedComponents: ['positioning:closeness', 'intimacy:attraction']
        }
      };
      
      const references = new Map();
      extractor.#extractFromComponentFile(componentData, references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
    });
  });

  describe('JSON Logic Processing', () => {
    it('should extract component references from has_component operators', () => {
      const jsonLogic = {
        has_component: ['actor', 'positioning:closeness']
      };
      
      const references = new Map();
      extractor.#extractFromJsonLogic(jsonLogic, references);
      
      expect(references.get('positioning')).toContain('closeness');
    });

    it('should extract component references from get_component_value operators', () => {
      const jsonLogic = {
        '>=': [
          { get_component_value: ['actor', 'intimacy:attraction', 'level'] },
          50
        ]
      };
      
      const references = new Map();
      extractor.#extractFromJsonLogic(jsonLogic, references);
      
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should handle nested JSON Logic expressions', () => {
      const complexLogic = {
        or: [
          {
            and: [
              { has_component: ['actor', 'positioning:closeness'] },
              { has_component: ['actor', 'intimacy:attraction'] }
            ]
          },
          { has_component: ['actor', 'violence:attacking'] }
        ]
      };
      
      const references = new Map();
      extractor.#extractFromJsonLogic(complexLogic, references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('violence')).toContain('attacking');
    });

    it('should handle arrays of operands', () => {
      const jsonLogic = {
        and: [
          { has_component: ['actor', 'positioning:closeness'] },
          { has_component: ['actor', 'intimacy:attraction'] },
          { has_component: ['actor', 'violence:health'] }
        ]
      };
      
      const references = new Map();
      extractor.#extractFromJsonLogic(jsonLogic, references);
      
      expect(references.size).toBe(3);
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('violence')).toContain('health');
    });

    it('should handle non-component operators gracefully', () => {
      const jsonLogic = {
        '>': [10, 5],
        '!=': ['string1', 'string2']
      };
      
      const references = new Map();
      expect(() => {
        extractor.#extractFromJsonLogic(jsonLogic, references);
      }).not.toThrow();
      
      expect(references.size).toBe(0);
    });
  });

  describe('Operation Handler Processing', () => {
    it('should extract references from add_component operations', () => {
      const operations = [
        {
          type: 'add_component',
          target: 'actor',
          component: 'positioning:sitting',
          data: { furniture: 'chair' }
        }
      ];
      
      const references = new Map();
      extractor.#extractFromOperationHandlers(operations, references);
      
      expect(references.get('positioning')).toContain('sitting');
    });

    it('should extract references from set_component_value operations', () => {
      const operations = [
        {
          type: 'set_component_value',
          target: 'actor',
          componentId: 'intimacy:attraction',
          field: 'level',
          value: 75
        }
      ];
      
      const references = new Map();
      extractor.#extractFromOperationHandlers(operations, references);
      
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should handle operation arrays and single operations', () => {
      const singleOperation = {
        type: 'add_component',
        component: 'positioning:closeness'
      };
      
      const references1 = new Map();
      extractor.#extractFromOperationHandlers(singleOperation, references1);
      expect(references1.get('positioning')).toContain('closeness');
      
      const operationArray = [singleOperation];
      const references2 = new Map();
      extractor.#extractFromOperationHandlers(operationArray, references2);
      expect(references2.get('positioning')).toContain('closeness');
    });
  });
});
```

### Scope DSL Tests

```javascript
// tests/unit/validation/modReferenceExtractor/scopeDslExtraction.test.js

describe('ModReferenceExtractor - Scope DSL Processing', () => {
  // Test cases for Scope DSL parsing from MODDEPVAL-003
  
  describe('Basic Scope Definition Parsing', () => {
    it('should parse simple scope assignments', async () => {
      const scopeContent = 'positioning:nearby_actors := actor.components.positioning:closeness.partners';
      
      await testBed.writeFile('test.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('test.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('positioning')).toContain('nearby_actors');
    });

    it('should handle multiple scope definitions', async () => {
      const scopeContent = `
        positioning:close_actors := actor.components.positioning:closeness.partners
        intimacy:attracted_actors := actor.components.intimacy:attraction.targets
        violence:enemies := actor.components.violence:targeting.enemies
      `;
      
      await testBed.writeFile('multi.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('multi.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('violence')).toContain('targeting');
    });

    it('should ignore comments and empty lines', async () => {
      const scopeContent = `
        # This is a comment
        
        positioning:nearby := actor.components.positioning:closeness.partners
        
        # Another comment
        intimacy:attracted := actor.components.intimacy:attraction.targets
      `;
      
      await testBed.writeFile('commented.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('commented.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
    });
  });

  describe('Complex Scope Expressions', () => {
    it('should handle filtered access expressions', async () => {
      const scopeContent = `
        intimacy:available_partners := actor.components.positioning:closeness.partners[
          {
            "and": [
              {"has_component": ["item", "intimacy:attraction"]},
              {">=": [{"get_component_value": ["item", "intimacy:arousal", "level"]}, 30]}
            ]
          }
        ]
      `;
      
      await testBed.writeFile('filtered.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('filtered.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('intimacy')).toContain('arousal');
    });

    it('should handle union expressions with | operator', async () => {
      const scopeContent = `
        positioning:all_nearby := actor.components.positioning:closeness.partners | actor.followers
      `;
      
      await testBed.writeFile('union.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('union.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
    });

    it('should handle union expressions with + operator', async () => {
      const scopeContent = `
        positioning:combined := actor.components.positioning:sitting.furniture.users + actor.components.positioning:standing.nearby
      `;
      
      await testBed.writeFile('union-plus.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('union-plus.scope', references);
      
      expect(references.get('positioning')).toContain('sitting');
      expect(references.get('positioning')).toContain('standing');
    });

    it('should handle array iteration expressions', async () => {
      const scopeContent = `
        positioning:all_furniture_users := actor.components.positioning:sitting.furniture.users[]
      `;
      
      await testBed.writeFile('iteration.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('iteration.scope', references);
      
      expect(references.get('positioning')).toContain('sitting');
    });

    it('should handle nested component access', async () => {
      const scopeContent = `
        positioning:furniture_interactions := actor.components.positioning:sitting.furniture.components.core:interaction_points
      `;
      
      await testBed.writeFile('nested.scope', scopeContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('nested.scope', references);
      
      expect(references.get('positioning')).toContain('sitting');
      expect(references.has('core')).toBe(false); // Core filtered out
    });
  });

  describe('Scope DSL Parser Unit Tests', () => {
    let parser;
    
    beforeEach(() => {
      parser = new ScopeDslParser(mockLogger);
    });

    it('should parse assignment targets correctly', () => {
      const target = parser.#parseAssignmentTarget('positioning:nearby_actors');
      
      expect(target.modId).toBe('positioning');
      expect(target.scopeId).toBe('nearby_actors');
    });

    it('should reject invalid assignment targets', () => {
      expect(() => {
        parser.#parseAssignmentTarget('invalid_target_without_colon');
      }).toThrow('Invalid assignment target');
      
      expect(() => {
        parser.#parseAssignmentTarget(':missing_mod_id');
      }).toThrow('Invalid assignment target');
      
      expect(() => {
        parser.#parseAssignmentTarget('missing_scope_id:');
      }).toThrow('Invalid assignment target');
    });

    it('should parse component references correctly', () => {
      const ref = parser.#parseComponentReference('positioning:closeness');
      
      expect(ref.modId).toBe('positioning');
      expect(ref.componentId).toBe('closeness');
    });

    it('should handle bracket splitting correctly', () => {
      const expr = 'part1[{"nested": "json"}] | part2 + part3[filter]';
      const parts = parser.#splitRespectingBrackets(expr, /[|+]/);
      
      expect(parts).toHaveLength(3);
      expect(parts[0].trim()).toBe('part1[{"nested": "json"}]');
      expect(parts[1].trim()).toBe('part2');
      expect(parts[2].trim()).toBe('part3[filter]');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed scope definitions gracefully', async () => {
      const malformedContent = `
        valid:scope := actor.components.positioning:closeness
        invalid_scope_without_assignment_operator
        another:valid := actor.components.intimacy:attraction
        malformed:json := actor.components.filter[{invalid json}]
      `;
      
      await testBed.writeFile('malformed.scope', malformedContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('malformed.scope', references);
      
      // Should extract valid references despite parse errors
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      
      // Should log warnings for malformed lines
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse scope file')
      );
    });

    it('should provide partial references from failed parses', async () => {
      const partialContent = `
        # This line has syntax errors but contains references
        broken positioning:closeness intimacy:attraction syntax
      `;
      
      await testBed.writeFile('partial.scope', partialContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('partial.scope', references);
      
      // Should extract references via regex fallback
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should continue processing after individual line errors', async () => {
      const mixedContent = `
        valid:scope1 := actor.components.positioning:closeness
        invalid syntax here
        valid:scope2 := actor.components.intimacy:attraction
        another invalid line
        valid:scope3 := actor.components.violence:health
      `;
      
      await testBed.writeFile('mixed.scope', mixedContent);
      const references = new Map();
      await extractor.#extractFromScopeFile('mixed.scope', references);
      
      // Should have extracted from all valid lines
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('violence')).toContain('health');
    });
  });

  describe('Regex Fallback Processing', () => {
    it('should extract references when parser fails completely', () => {
      const complexContent = `
        # Complex content with syntax errors but valid references
        broken:syntax := actor.components.positioning:closeness invalid
        also:broken [{ bad json }] but has intimacy:attraction reference
        scope:ref := some.invalid.syntax positioning:sitting reference
      `;
      
      const references = new Map();
      extractor.#extractScopeReferencesWithRegex(complexContent, references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('positioning')).toContain('sitting');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('broken')).toContain('syntax');
    });

    it('should handle multiple regex patterns', () => {
      const content = `
        assignment:target := expression
        .components.positioning:closeness reference
        "intimacy:attraction" in json
        mod:comp.field access
      `;
      
      const references = new Map();
      extractor.#extractScopeReferencesWithRegex(content, references);
      
      expect(references.get('assignment')).toContain('target');
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      expect(references.get('mod')).toContain('comp');
    });
  });
});
```

### Error Handling Tests

```javascript
// tests/unit/validation/modReferenceExtractor/errorHandling.test.js

describe('ModReferenceExtractor - Error Handling', () => {
  describe('File System Errors', () => {
    it('should handle non-existent directories gracefully', async () => {
      const nonExistentPath = '/path/that/does/not/exist';
      
      await expect(
        extractor.extractReferences(nonExistentPath)
      ).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to extract references'),
        expect.any(Error)
      );
    });

    it('should handle permission errors', async () => {
      const restrictedDir = path.join(testTempDir, 'restricted');
      await fs.mkdir(restrictedDir);
      await fs.chmod(restrictedDir, 0o000); // No permissions
      
      await expect(
        extractor.extractReferences(restrictedDir)
      ).rejects.toThrow();
      
      // Clean up
      await fs.chmod(restrictedDir, 0o755);
    });

    it('should handle invalid file paths', async () => {
      await expect(
        extractor.extractReferences('')
      ).rejects.toThrow('modPath is required');
      
      await expect(
        extractor.extractReferences(null)
      ).rejects.toThrow('modPath is required');
    });
  });

  describe('JSON Parse Errors', () => {
    it('should handle malformed JSON files gracefully', async () => {
      const malformedJson = '{ "key": invalid json }';
      await testBed.writeFile('malformed.action.json', malformedJson);
      
      const references = new Map();
      await extractor.#extractFromFile('malformed.action.json', references);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process malformed.action.json'),
        expect.objectContaining({
          filePath: 'malformed.action.json',
          fileType: '.json'
        })
      );
      
      // Should not throw, should continue processing
      expect(references.size).toBe(0);
    });

    it('should handle empty JSON files', async () => {
      await testBed.writeFile('empty.action.json', '');
      
      const references = new Map();
      expect(async () => {
        await extractor.#extractFromFile('empty.action.json', references);
      }).not.toThrow();
    });

    it('should handle null/undefined JSON content', async () => {
      await testBed.writeFile('null.action.json', 'null');
      await testBed.writeFile('undefined.action.json', 'undefined');
      
      const references = new Map();
      await extractor.#extractFromFile('null.action.json', references);
      await extractor.#extractFromFile('undefined.action.json', references);
      
      // Should handle gracefully without throwing
      expect(references.size).toBe(0);
    });
  });

  describe('Large File Handling', () => {
    it('should handle very large JSON files', async () => {
      const largeActionData = {
        required_components: {
          actor: Array.from({length: 10000}, (_, i) => `mod${i}:component${i}`)
        }
      };
      
      await testBed.writeFile('large.action.json', JSON.stringify(largeActionData));
      
      const startTime = performance.now();
      const references = new Map();
      await extractor.#extractFromFile('large.action.json', references);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in <5 seconds
      expect(references.size).toBe(10000);
    });

    it('should handle deeply nested JSON structures', async () => {
      let deepStructure = { value: 'positioning:closeness' };
      for (let i = 0; i < 1000; i++) {
        deepStructure = { nested: deepStructure };
      }
      
      await testBed.writeFile('deep.action.json', JSON.stringify(deepStructure));
      
      const references = new Map();
      await extractor.#extractFromFile('deep.action.json', references);
      
      expect(references.get('positioning')).toContain('closeness');
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle concurrent extractions safely', async () => {
      // Create multiple test files
      for (let i = 0; i < 10; i++) {
        await testBed.writeFile(`test${i}.action.json`, JSON.stringify({
          required_components: { actor: [`mod${i}:component${i}`] }
        }));
      }
      
      // Run concurrent extractions
      const promises = Array.from({length: 10}, (_, i) => 
        extractor.extractReferences(testTempDir)
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed and have consistent results
      results.forEach(references => {
        expect(references.size).toBeGreaterThan(0);
      });
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during large extractions', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many files
      for (let i = 0; i < 100; i++) {
        await testBed.writeFile(`mem-test${i}.action.json`, JSON.stringify({
          required_components: { actor: [`mod${i}:component${i}`] }
        }));
        
        await extractor.extractReferences(testTempDir);
        
        // Force garbage collection periodically
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Input Validation', () => {
    it('should validate input parameters', () => {
      expect(() => {
        extractor.#extractModReferencesFromString(123, new Map());
      }).not.toThrow(); // Should handle gracefully
      
      expect(() => {
        extractor.#extractModReferencesFromString('valid:string', null);
      }).toThrow(); // Should fail on invalid references map
    });

    it('should sanitize logged data', async () => {
      const sensitiveData = 'password:secret';
      
      const references = new Map();
      extractor.#extractModReferencesFromString(sensitiveData, references);
      
      // Should log references but not expose sensitive content
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.not.stringContaining('password:secret')
      );
    });
  });
});
```

### Performance Tests

```javascript
// tests/unit/validation/modReferenceExtractor/performance.test.js

describe('ModReferenceExtractor - Performance', () => {
  describe('Extraction Speed Benchmarks', () => {
    it('should process action files efficiently', async () => {
      const largeActionData = {
        required_components: {
          actor: Array.from({length: 1000}, (_, i) => `mod${i % 10}:component${i}`)
        },
        forbidden_components: {
          actor: Array.from({length: 500}, (_, i) => `forbidden${i % 5}:comp${i}`)
        }
      };
      
      const startTime = performance.now();
      const references = new Map();
      extractor.#extractFromActionFile(largeActionData, references);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // <100ms
      expect(references.size).toBeGreaterThan(10);
    });

    it('should handle large directory structures efficiently', async () => {
      // Create a large mod structure
      const promises = [];
      for (let dir = 0; dir < 10; dir++) {
        for (let file = 0; file < 20; file++) {
          const filePath = `dir${dir}/file${file}.action.json`;
          const content = JSON.stringify({
            required_components: { actor: [`mod${dir}:component${file}`] }
          });
          promises.push(testBed.writeFile(filePath, content));
        }
      }
      await Promise.all(promises);
      
      const startTime = performance.now();
      const references = await extractor.extractReferences(testTempDir);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // <2 seconds for 200 files
      expect(references.size).toBe(10); // 10 different mods
    });

    it('should handle JSON Logic efficiently', () => {
      // Create deeply nested JSON Logic
      let deepLogic = { has_component: ['actor', 'test:component'] };
      for (let i = 0; i < 100; i++) {
        deepLogic = { 
          and: [
            deepLogic, 
            { has_component: ['actor', `mod${i % 10}:comp${i}`] }
          ] 
        };
      }
      
      const startTime = performance.now();
      const references = new Map();
      extractor.#extractFromJsonLogic(deepLogic, references);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(50); // <50ms
      expect(references.size).toBeGreaterThan(5);
    });

    it('should handle scope DSL efficiently', async () => {
      const largeScopeContent = Array.from({length: 500}, (_, i) => 
        `mod${i % 20}:scope${i} := actor.components.mod${i % 20}:component${i}.field`
      ).join('\n');
      
      await testBed.writeFile('large.scope', largeScopeContent);
      
      const startTime = performance.now();
      const references = new Map();
      await extractor.#extractFromScopeFile('large.scope', references);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(500); // <500ms for 500 definitions
      expect(references.size).toBe(20); // 20 different mods
    });
  });

  describe('Memory Efficiency', () => {
    it('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many references
      const largeData = {
        required_components: {
          actor: Array.from({length: 5000}, (_, i) => `mod${i}:component${i}`)
        }
      };
      
      const references = new Map();
      extractor.#extractFromActionFile(largeData, references);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory usage should be proportional to data size
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // <10MB
    });

    it('should clean up resources after processing', async () => {
      let references = new Map();
      
      // Add many references
      for (let i = 0; i < 1000; i++) {
        extractor.#extractModReferencesFromString(`mod${i}:comp${i}`, references);
      }
      
      expect(references.size).toBe(1000);
      
      // Clear references
      references = null;
      
      if (global.gc) {
        global.gc();
      }
      
      // Memory should be reclaimed (hard to test precisely, but should not crash)
      expect(true).toBe(true);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with file count', async () => {
      const fileCounts = [10, 50, 100, 200];
      const timings = [];
      
      for (const count of fileCounts) {
        const testDir = path.join(testTempDir, `scale-test-${count}`);
        await fs.mkdir(testDir);
        
        // Create test files
        for (let i = 0; i < count; i++) {
          await testBed.writeFile(
            path.join(testDir, `file${i}.action.json`),
            JSON.stringify({ required_components: { actor: [`mod${i}:comp${i}`] } })
          );
        }
        
        const startTime = performance.now();
        await extractor.extractReferences(testDir);
        const endTime = performance.now();
        
        timings.push({ count, time: endTime - startTime });
      }
      
      // Check that scaling is roughly linear (allowing for some variance)
      const timePerFile = timings.map(t => t.time / t.count);
      const avgTimePerFile = timePerFile.reduce((a, b) => a + b) / timePerFile.length;
      
      timePerFile.forEach(tpf => {
        expect(tpf).toBeLessThan(avgTimePerFile * 2); // Within 2x of average
      });
    });
  });
});
```

### Integration Tests

```javascript
// tests/unit/validation/modReferenceExtractor/integration.test.js

describe('ModReferenceExtractor - Integration', () => {
  describe('Dependency Injection Integration', () => {
    it('should integrate with AjvSchemaValidator', () => {
      const realAjvValidator = testBed.createMock('realAjvValidator', ['validateSchema']);
      realAjvValidator.validateSchema.mockReturnValue({ valid: true });
      
      const integratedExtractor = new ModReferenceExtractor({
        logger: mockLogger,
        ajvValidator: realAjvValidator
      });
      
      expect(integratedExtractor).toBeDefined();
      // Could test schema validation integration here
    });

    it('should work with different logger implementations', () => {
      const alternativeLogger = {
        info: jest.fn(),
        warn: jest.fn(), 
        error: jest.fn(),
        debug: jest.fn()
      };
      
      const extractor = new ModReferenceExtractor({
        logger: alternativeLogger,
        ajvValidator: mockAjvValidator
      });
      
      expect(extractor).toBeDefined();
    });
  });

  describe('Real World Scenarios', () => {
    it('should handle real positioning mod structure', async () => {
      // Simulate real positioning mod structure
      await testBed.createFileStructure(testTempDir, {
        'mod-manifest.json': JSON.stringify({
          id: 'positioning',
          dependencies: [{ id: 'core', version: '^1.0.0' }]
        }),
        'actions/': {
          'turn_around.action.json': JSON.stringify({
            forbidden_components: {
              actor: ['intimacy:kissing'] // The actual violation
            }
          }),
          'move_to_furniture.action.json': JSON.stringify({
            required_components: {
              actor: ['positioning:closeness']
            }
          })
        },
        'components/': {
          'closeness.component.json': JSON.stringify({
            id: 'positioning:closeness'
          })
        }
      });
      
      const references = await extractor.extractReferences(testTempDir);
      
      // Should detect the intimacy violation
      expect(references.get('intimacy')).toContain('kissing');
      expect(references.get('positioning')).toContain('closeness');
    });

    it('should handle complex mod ecosystem', async () => {
      // Create a mini ecosystem
      await testBed.createFileStructure(testTempDir, {
        'core-mod/': {
          'components/': {
            'actor.component.json': JSON.stringify({ id: 'core:actor' })
          }
        },
        'anatomy-mod/': {
          'components/': {
            'body.component.json': JSON.stringify({
              id: 'anatomy:body',
              references: ['core:actor']
            })
          }
        },
        'positioning-mod/': {
          'actions/': {
            'sit.action.json': JSON.stringify({
              required_components: {
                actor: ['anatomy:body', 'positioning:sitting']
              }
            })
          }
        },
        'intimacy-mod/': {
          'rules/': {
            'attraction.rule.json': JSON.stringify({
              condition: {
                and: [
                  { has_component: ['actor', 'anatomy:body'] },
                  { has_component: ['actor', 'positioning:closeness'] }
                ]
              }
            })
          }
        }
      });
      
      // Extract from all mods
      const allReferences = new Map();
      const modDirs = await fs.readdir(testTempDir);
      
      for (const modDir of modDirs) {
        const modPath = path.join(testTempDir, modDir);
        const stat = await fs.stat(modPath);
        if (stat.isDirectory()) {
          const modReferences = await extractor.extractReferences(modPath);
          // Merge references
          for (const [modId, components] of modReferences) {
            if (!allReferences.has(modId)) {
              allReferences.set(modId, new Set());
            }
            for (const comp of components) {
              allReferences.get(modId).add(comp);
            }
          }
        }
      }
      
      // Verify cross-mod references detected
      expect(allReferences.get('anatomy')).toContain('body');
      expect(allReferences.get('positioning')).toContain('sitting');
      expect(allReferences.get('positioning')).toContain('closeness');
      expect(allReferences.has('core')).toBe(false); // Core filtered out
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from mixed valid/invalid content', async () => {
      await testBed.createFileStructure(testTempDir, {
        'valid.action.json': JSON.stringify({
          required_components: { actor: ['positioning:closeness'] }
        }),
        'malformed.action.json': '{ invalid json content',
        'empty.action.json': '',
        'another-valid.rule.json': JSON.stringify({
          condition_ref: 'intimacy:attraction'
        })
      });
      
      const references = await extractor.extractReferences(testTempDir);
      
      // Should extract from valid files despite invalid ones
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
      
      // Should log appropriate warnings
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process malformed.action.json')
      );
    });
  });
});
```

## Test Coverage Requirements

### Coverage Targets
- **Line Coverage**: >90%
- **Branch Coverage**: >85%
- **Function Coverage**: >95%
- **Statement Coverage**: >90%

### Coverage Reporting

```javascript
// jest.config.js additions
module.exports = {
  collectCoverageFrom: [
    'src/validation/modReferenceExtractor.js',
    'src/validation/scopeDslParser.js'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 95,
      lines: 90,
      statements: 90
    }
  },
  coverageReporters: ['text', 'html', 'json']
};
```

### Performance Benchmarks

```javascript
// Performance test requirements
const PERFORMANCE_TARGETS = {
  SINGLE_FILE_PROCESSING: 10,        // <10ms per average file
  DIRECTORY_SCAN: 2000,              // <2s for 200 files
  JSON_LOGIC_TRAVERSAL: 50,          // <50ms for complex logic
  SCOPE_DSL_PARSING: 500,            // <500ms for 500 definitions
  MEMORY_USAGE: 10 * 1024 * 1024     // <10MB for large datasets
};
```

## Success Criteria

- [ ] All core functionality tests pass with >90% coverage
- [ ] JSON extraction tests validate all file types and patterns
- [ ] Scope DSL tests cover all syntax variations and error cases
- [ ] Error handling tests ensure graceful failure and recovery
- [ ] Performance tests meet all benchmark requirements
- [ ] Integration tests validate real-world scenarios
- [ ] Test fixtures provide comprehensive test data coverage
- [ ] Automated test reporting integrated with CI/CD pipeline
- [ ] Memory leak detection prevents resource issues
- [ ] Concurrent processing tests ensure thread safety

## Implementation Notes

### Test Data Management
- **Fixtures directory**: Organized test data for various scenarios
- **Temporary files**: Proper cleanup after test execution
- **Performance data**: Reusable large datasets for benchmarking
- **Mock objects**: Consistent mocking patterns across test suites

### CI/CD Integration
- **Test automation**: Run on every commit and PR
- **Coverage reporting**: Enforce coverage thresholds
- **Performance regression**: Detect performance degradations
- **Parallel execution**: Tests should run concurrently safely

### Maintenance Strategy
- **Test updates**: Update tests when implementation changes
- **Fixture maintenance**: Keep test data current with mod ecosystem
- **Performance monitoring**: Track performance trends over time
- **Documentation**: Keep test documentation current

## Next Steps

After completion:
1. **MODDEPVAL-005**: Implement cross-reference validation using tested extractor
2. **CI/CD integration**: Add test automation to build pipeline
3. **Performance monitoring**: Set up continuous performance tracking

## References

- **Jest documentation**: Testing patterns and best practices
- **Test patterns**: `tests/common/testBed.js` for existing patterns
- **Coverage tools**: Istanbul/nyc for coverage reporting
- **Performance testing**: Node.js performance measurement APIs