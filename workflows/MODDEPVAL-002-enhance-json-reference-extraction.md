# MODDEPVAL-002: Enhance JSON Reference Extraction for Complex Structures

## Overview

Enhance the `ModReferenceExtractor` class to handle complex JSON structures including JSON Logic expressions, nested component references, and file-type-specific extraction patterns. This builds on the core functionality from MODDEPVAL-001.

## Background

The Living Narrative Engine uses sophisticated JSON structures that require specialized parsing:

- **JSON Logic conditions** with nested mod references
- **Action files** with complex target scopes and component arrays
- **Rule files** with condition references and operation handlers
- **Component files** with cross-mod dependencies

**Complex extraction examples:**
```json
// Action file - multiple reference types
{
  "required_components": {
    "actor": ["positioning:closeness", "core:actor"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]  // ← Target violation
  },
  "targets": {
    "scope": "positioning:close_actors_facing_each_other"
  }
}

// Rule file - JSON Logic with mod references  
{
  "condition": {
    "and": [
      {"has_component": ["actor", "intimacy:arousal"]},
      {">=": [{"get_component_value": ["actor", "intimacy:arousal", "level"]}, 50]}
    ]
  }
}
```

## Technical Specifications

### Enhanced Methods in ModReferenceExtractor

#### File-Type-Specific Extraction

```javascript
/**
 * Enhanced JSON processing with file-type-specific extraction logic
 * @private
 * @param {string} filePath - JSON file path
 * @param {ModReferenceMap} references - Reference map to populate
 */
async #extractFromJsonFile(filePath, references) {
  const content = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(content);
  
  const fileType = this.#detectJsonFileType(filePath);
  
  switch (fileType) {
    case 'action':
      this.#extractFromActionFile(data, references);
      break;
    case 'rule':
      this.#extractFromRuleFile(data, references);
      break;
    case 'condition':
      this.#extractFromConditionFile(data, references);
      break;
    case 'component':
      this.#extractFromComponentFile(data, references);
      break;
    case 'event':
      this.#extractFromEventFile(data, references);
      break;
    case 'blueprint':
      this.#extractFromBlueprintFile(data, references);
      break;
    case 'recipe':
      this.#extractFromRecipeFile(data, references);
      break;
    default:
      this.#extractReferencesFromObject(data, fileType);
      break;
  }
}

/**
 * Extracts references from action files with specialized logic
 * @private
 * @param {Object} actionData - Parsed action JSON
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromActionFile(actionData, references) {
  // Required components - typically arrays of component IDs
  if (actionData.required_components) {
    for (const [entityType, components] of Object.entries(actionData.required_components)) {
      if (Array.isArray(components)) {
        components.forEach(comp => this.#extractModReferencesFromString(comp, references));
      }
    }
  }

  // Forbidden components - same structure as required
  if (actionData.forbidden_components) {
    for (const [entityType, components] of Object.entries(actionData.forbidden_components)) {
      if (Array.isArray(components)) {
        components.forEach(comp => this.#extractModReferencesFromString(comp, references));
      }
    }
  }

  // Target scopes - reference to scope definitions
  if (actionData.targets?.scope) {
    this.#extractModReferencesFromString(actionData.targets.scope, references);
  }

  // Operation handlers may contain component operations
  if (actionData.operations) {
    this.#extractFromOperationHandlers(actionData.operations, references);
  }

  // JSON Logic conditions in actions
  if (actionData.condition) {
    this.#extractFromJsonLogic(actionData.condition, references);
  }
}

/**
 * Extracts references from rule files
 * @private
 * @param {Object} ruleData - Parsed rule JSON
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromRuleFile(ruleData, references) {
  // Condition references - link to other mods' conditions
  if (ruleData.condition_ref) {
    this.#extractModReferencesFromString(ruleData.condition_ref, references);
  }

  // Inline JSON Logic conditions
  if (ruleData.condition) {
    this.#extractFromJsonLogic(ruleData.condition, references);
  }

  // Operation handlers with component operations
  if (ruleData.operations) {
    this.#extractFromOperationHandlers(ruleData.operations, references);
  }

  // Rule metadata may contain mod references
  if (ruleData.metadata) {
    this.#extractReferencesFromObject(ruleData.metadata, 'rule-metadata');
  }
}

/**
 * Extracts references from condition files  
 * @private
 * @param {Object} conditionData - Parsed condition JSON
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromConditionFile(conditionData, references) {
  // Condition files are primarily JSON Logic structures
  if (conditionData.condition) {
    this.#extractFromJsonLogic(conditionData.condition, references);
  }

  // Some conditions may have metadata or dependencies
  this.#extractReferencesFromObject(conditionData, 'condition');
}

/**
 * Extracts references from component definition files
 * @private
 * @param {Object} componentData - Parsed component JSON
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromComponentFile(componentData, references) {
  // Component schemas may reference other mod components
  if (componentData.dataSchema) {
    this.#extractReferencesFromObject(componentData.dataSchema, 'component-schema');
  }

  // Default values might contain mod references
  if (componentData.defaultData) {
    this.#extractReferencesFromObject(componentData.defaultData, 'component-defaults');
  }

  // Validation rules may contain component references
  if (componentData.validation) {
    this.#extractReferencesFromObject(componentData.validation, 'component-validation');
  }
}

/**
 * Extracts references from event definition files
 * @private
 * @param {Object} eventData - Parsed event JSON
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromEventFile(eventData, references) {
  // Event payload schemas may reference components
  if (eventData.payloadSchema) {
    this.#extractReferencesFromObject(eventData.payloadSchema, 'event-payload');
  }

  // Event handlers may contain component operations
  if (eventData.handlers) {
    this.#extractFromOperationHandlers(eventData.handlers, references);
  }

  // Event metadata
  this.#extractReferencesFromObject(eventData, 'event');
}

/**
 * Extracts references from blueprint files (anatomy system)
 * @private
 * @param {Object} blueprintData - Parsed blueprint JSON
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromBlueprintFile(blueprintData, references) {
  // Blueprints define anatomy structures with potential cross-mod references
  this.#extractReferencesFromObject(blueprintData, 'blueprint');
}

/**
 * Extracts references from recipe files (anatomy system)
 * @private  
 * @param {Object} recipeData - Parsed recipe JSON
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromRecipeFile(recipeData, references) {
  // Recipes may reference components from other mods
  this.#extractReferencesFromObject(recipeData, 'recipe');
}
```

#### JSON Logic Processing

```javascript
/**
 * Recursively processes JSON Logic expressions to extract mod references
 * @private
 * @param {Object} jsonLogic - JSON Logic expression object
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromJsonLogic(jsonLogic, references) {
  if (!jsonLogic || typeof jsonLogic !== 'object') {
    return;
  }

  // Handle JSON Logic operators that commonly contain mod references
  const COMPONENT_OPERATORS = [
    'has_component',
    'get_component_value', 
    'set_component_value',
    'remove_component',
    'add_component'
  ];

  for (const [operator, operands] of Object.entries(jsonLogic)) {
    if (COMPONENT_OPERATORS.includes(operator)) {
      // Component operators: ["entity", "modId:componentId", ...args]
      if (Array.isArray(operands) && operands.length >= 2) {
        const componentRef = operands[1];
        if (typeof componentRef === 'string') {
          this.#extractModReferencesFromString(componentRef, references);
        }
      }
    } else if (Array.isArray(operands)) {
      // Recursive processing for arrays
      operands.forEach(operand => {
        if (typeof operand === 'object') {
          this.#extractFromJsonLogic(operand, references);
        } else if (typeof operand === 'string') {
          this.#extractModReferencesFromString(operand, references);
        }
      });
    } else if (typeof operands === 'object') {
      // Recursive processing for objects
      this.#extractFromJsonLogic(operands, references);
    } else if (typeof operands === 'string') {
      // String operands may contain references
      this.#extractModReferencesFromString(operands, references);
    }
  }
}

/**
 * Processes operation handler structures for component references
 * @private
 * @param {Array|Object} operations - Operation handler data
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromOperationHandlers(operations, references) {
  if (Array.isArray(operations)) {
    operations.forEach(op => this.#extractFromSingleOperation(op, references));
  } else if (typeof operations === 'object') {
    this.#extractFromSingleOperation(operations, references);
  }
}

/**
 * Processes a single operation for component references
 * @private
 * @param {Object} operation - Single operation object
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromSingleOperation(operation, references) {
  if (!operation || typeof operation !== 'object') {
    return;
  }

  // Component operations often have 'component' or 'componentId' fields
  if (operation.component) {
    this.#extractModReferencesFromString(operation.component, references);
  }
  
  if (operation.componentId) {
    this.#extractModReferencesFromString(operation.componentId, references);
  }

  // Target specifications may contain mod references
  if (operation.target) {
    this.#extractModReferencesFromString(operation.target, references);
  }

  // Recursively process nested operation data
  this.#extractReferencesFromObject(operation, 'operation');
}
```

#### Enhanced String Pattern Matching

```javascript
/**
 * Enhanced mod reference extraction with context awareness
 * @private
 * @param {string} str - String to analyze
 * @param {ModReferenceMap} references - Reference map to populate
 * @param {string} context - Context information for better extraction
 */
#extractModReferencesFromString(str, references, context = '') {
  if (typeof str !== 'string' || !str.trim()) {
    return;
  }

  // Enhanced pattern matching for various mod reference formats
  const patterns = [
    // Standard modId:componentId pattern
    /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)\b/g,
    
    // Scope DSL patterns in JSON strings (preview for MODDEPVAL-003)
    /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)\s*:=/g,
    
    // Component access patterns: modId:componentId.field
    /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)\.[\w.]+/g
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(str)) !== null) {
      const [, modId, componentId] = match;
      
      // Skip core references and special cases
      if (modId === 'core' || modId === 'none' || modId === 'self') {
        continue;
      }

      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      
      references.get(modId).add(componentId);
      
      // Log context for debugging
      if (context) {
        this.#logger.debug(`Found reference ${modId}:${componentId} in ${context}`);
      }
    }
  });
}
```

## Integration Points

### File Processing Pipeline Enhancement
```javascript
/**
 * Enhanced file processing with better error recovery and reporting
 * @private
 * @param {string} filePath - File to process
 * @param {ModReferenceMap} references - Reference map to populate
 */
async #extractFromFile(filePath, references) {
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);
  
  try {
    switch (ext) {
      case '.json':
        await this.#extractFromJsonFile(filePath, references);
        this.#logger.debug(`Processed JSON file: ${basename}`);
        break;
      case '.scope':
        await this.#extractFromScopeFile(filePath, references);
        this.#logger.debug(`Processed scope file: ${basename}`);
        break;
      default:
        this.#logger.debug(`Skipping unsupported file: ${basename}`);
        break;
    }
  } catch (error) {
    // Enhanced error context
    this.#logger.warn(`Failed to process ${basename} (${ext}): ${error.message}`, {
      filePath,
      fileType: ext,
      error: error.name
    });
    
    // Continue processing - don't fail entire extraction for one bad file
  }
}
```

## Testing Requirements

### Enhanced Test Cases

```javascript
// tests/unit/validation/modReferenceExtractor.test.js - Enhanced tests

describe('ModReferenceExtractor - JSON Processing', () => {
  describe('Action Files', () => {
    it('should extract required components', async () => {
      const mockActionData = {
        required_components: {
          actor: ['positioning:closeness', 'intimacy:arousal'],
          target: ['core:actor']
        }
      };
      
      const references = extractor.extractReferencesFromObject(mockActionData, 'action');
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('arousal');
      expect(references.has('core')).toBe(false); // Core should be filtered out
    });

    it('should extract forbidden components', async () => {
      const mockActionData = {
        forbidden_components: {
          actor: ['intimacy:kissing', 'violence:attacking']
        }
      };
      
      const references = extractor.extractReferencesFromObject(mockActionData, 'action');
      expect(references.get('intimacy')).toContain('kissing');
      expect(references.get('violence')).toContain('attacking');
    });

    it('should extract target scopes', async () => {
      const mockActionData = {
        targets: {
          scope: 'positioning:close_actors_facing_each_other'
        }
      };
      
      const references = extractor.extractReferencesFromObject(mockActionData, 'action');
      expect(references.get('positioning')).toContain('close_actors_facing_each_other');
    });
  });

  describe('JSON Logic Processing', () => {
    it('should extract component references from has_component operators', async () => {
      const jsonLogic = {
        and: [
          { has_component: ['actor', 'intimacy:arousal'] },
          { has_component: ['target', 'positioning:closeness'] }
        ]
      };
      
      const references = new Map();
      extractor.#extractFromJsonLogic(jsonLogic, references);
      
      expect(references.get('intimacy')).toContain('arousal');
      expect(references.get('positioning')).toContain('closeness');
    });

    it('should extract nested JSON Logic references', async () => {
      const complexLogic = {
        or: [
          { 
            and: [
              { has_component: ['actor', 'intimacy:kissing'] },
              { '>=': [{ get_component_value: ['actor', 'intimacy:arousal', 'level'] }, 50] }
            ]
          },
          { has_component: ['actor', 'violence:attacking'] }
        ]
      };
      
      const references = new Map();
      extractor.#extractFromJsonLogic(complexLogic, references);
      
      expect(references.get('intimacy')).toContain('kissing');
      expect(references.get('intimacy')).toContain('arousal');
      expect(references.get('violence')).toContain('attacking');
    });
  });

  describe('Operation Handlers', () => {
    it('should extract references from component operations', async () => {
      const operations = [
        { 
          type: 'add_component',
          target: 'actor',
          component: 'intimacy:arousal',
          data: { level: 25 }
        },
        {
          type: 'set_component_value',
          target: 'actor', 
          componentId: 'positioning:closeness',
          field: 'distance',
          value: 'close'
        }
      ];
      
      const references = new Map();
      extractor.#extractFromOperationHandlers(operations, references);
      
      expect(references.get('intimacy')).toContain('arousal');
      expect(references.get('positioning')).toContain('closeness');
    });
  });

  describe('File Type Detection', () => {
    it('should correctly identify action files', () => {
      expect(extractor.#detectJsonFileType('/path/to/kiss.action.json')).toBe('action');
      expect(extractor.#detectJsonFileType('/path/to/movement.rule.json')).toBe('rule');
      expect(extractor.#detectJsonFileType('/path/to/arousal.component.json')).toBe('component');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const malformedFile = 'test-malformed.json';
      await fs.writeFile(malformedFile, '{ invalid json }');
      
      const references = new Map();
      await expect(extractor.#extractFromFile(malformedFile, references)).not.toThrow();
      
      await fs.unlink(malformedFile);
    });

    it('should continue processing after individual file errors', async () => {
      // Test that one bad file doesn't stop the entire extraction
    });
  });
});
```

### Performance Tests

```javascript
describe('ModReferenceExtractor - Performance', () => {
  it('should process large action files efficiently', async () => {
    const largeActionData = {
      required_components: {
        actor: Array.from({length: 100}, (_, i) => `mod${i}:component${i}`)
      }
    };
    
    const startTime = performance.now();
    const references = extractor.extractReferencesFromObject(largeActionData, 'action');
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
    expect(references.size).toBe(100);
  });

  it('should handle deeply nested JSON Logic efficiently', async () => {
    // Create deeply nested JSON Logic structure
    let deepLogic = { has_component: ['actor', 'test:component'] };
    for (let i = 0; i < 50; i++) {
      deepLogic = { and: [deepLogic, { has_component: ['actor', `mod${i}:comp${i}`] }] };
    }
    
    const startTime = performance.now();
    const references = new Map();
    extractor.#extractFromJsonLogic(deepLogic, references);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    expect(references.size).toBeGreaterThan(40); // Should find most references
  });
});
```

## Success Criteria

- [ ] Enhanced JSON processing supports all file types (action, rule, condition, component, event, blueprint, recipe)
- [ ] JSON Logic traversal correctly extracts mod references from nested expressions
- [ ] Operation handler processing identifies component operations
- [ ] File-type-specific extraction logic implemented and tested
- [ ] Performance remains acceptable for complex JSON structures (<50ms per file)
- [ ] Error handling gracefully manages malformed JSON files
- [ ] Test coverage >90% for all new extraction methods
- [ ] Integration with MODDEPVAL-001 maintains backwards compatibility

## Implementation Notes

### JSON Logic Complexity
- JSON Logic expressions can be arbitrarily nested
- Component operators vary in argument structure
- Some operands may be variables rather than direct references
- Performance optimization needed for deep nesting

### File Type Variations  
- Action files have the most complex structure
- Rule files often combine JSON Logic with operation handlers
- Component files may have schema references to other mods
- Blueprint and recipe files (anatomy system) need specialized handling

### Error Recovery Strategy
- Continue processing after individual file parse errors
- Log detailed error context for debugging
- Provide summary of successfully processed vs. failed files
- Don't fail entire mod extraction for individual file issues

## Next Steps

After completion:
1. **MODDEPVAL-003**: Add Scope DSL parsing for `.scope` files
2. **Integration with MODDEPVAL-001**: Ensure seamless operation with core extractor
3. **Performance optimization**: Profile and optimize for large mod ecosystems

## References

- **JSON Logic documentation**: Understanding operator structures
- **Action file examples**: `data/mods/positioning/actions/turn_around.action.json`
- **Rule file examples**: Various `.rule.json` files across mods
- **Operation handlers**: Existing operation handler patterns in codebase