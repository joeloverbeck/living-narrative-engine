# MODDEPVAL-003: Implement Scope DSL File Parsing Support

## Overview

Implement comprehensive parsing support for Scope DSL (`.scope`) files to extract mod references from the custom query language used by the Living Narrative Engine. This extends the `ModReferenceExtractor` with advanced parsing capabilities for the most complex file type in the mod system.

## Background

Scope DSL files use a custom syntax for defining entity queries and relationships. These files contain the most complex mod reference patterns in the system and require specialized parsing beyond simple regex matching.

**Scope DSL syntax examples:**
```scope
# Basic scope definition with mod reference
positioning:close_actors_facing_each_other := actor.components.positioning:closeness.partners

# Complex scope with filters and unions
intimacy:available_romantic_partners := actor.components.positioning:closeness.partners[
  {
    "and": [
      {"has_component": ["item", "intimacy:attraction"]},
      {">=": [{"get_component_value": ["item", "intimacy:attraction", "level"]}, 30]}
    ]
  }
] | actor.followers[{"has_component": ["item", "intimacy:single"]}]

# Nested component access
positioning:furniture_interactions := actor.components.positioning:sitting.furniture.components.core:interaction_points
```

**Key parsing challenges:**
1. **Assignment syntax**: `modId:scopeId := expression`
2. **Component access chains**: `entity.components.modId:componentId.field.subfield`
3. **JSON Logic filters**: Embedded JSON within DSL expressions
4. **Union operators**: `|` and `+` combining multiple expressions
5. **Array operations**: `[]` for filtering and iteration
6. **Nested references**: Multi-level component access patterns

## Technical Specifications

### Scope DSL Parser Implementation

```javascript
/**
 * Parses Scope DSL files to extract mod references
 * @private
 * @param {string} filePath - Scope file path
 * @param {ModReferenceMap} references - Reference map to populate
 */
async #extractFromScopeFile(filePath, references) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  try {
    this.#logger.debug(`Processing scope file: ${fileName}`);
    
    const parser = new ScopeDslParser(this.#logger);
    const parseResult = parser.parseScope(content, fileName);
    
    // Extract references from parsed scope definitions
    for (const scopeDef of parseResult.definitions) {
      this.#extractReferencesFromScopeDefinition(scopeDef, references);
    }
    
    // Extract references from any parsing errors (may contain partial references)
    for (const error of parseResult.errors) {
      if (error.partialReferences) {
        this.#mergeReferences(error.partialReferences, references);
      }
    }
    
    this.#logger.debug(`Extracted ${references.size} mod references from ${fileName}`);
    
  } catch (error) {
    this.#logger.warn(`Failed to parse scope file ${fileName}: ${error.message}`);
    // Fallback to regex-based extraction for partial results
    this.#extractScopeReferencesWithRegex(content, references);
  }
}

/**
 * Extracts references from a parsed scope definition
 * @private
 * @param {ScopeDefinition} scopeDef - Parsed scope definition
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractReferencesFromScopeDefinition(scopeDef, references) {
  // Extract from assignment target (left side of :=)
  if (scopeDef.target && scopeDef.target.modId) {
    this.#addReference(scopeDef.target.modId, scopeDef.target.scopeId, references);
  }
  
  // Extract from expression tree (right side of :=)
  this.#extractFromScopeExpression(scopeDef.expression, references);
}

/**
 * Recursively extracts references from scope expression trees
 * @private
 * @param {ScopeExpression} expression - Scope expression node
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromScopeExpression(expression, references) {
  if (!expression) return;
  
  switch (expression.type) {
    case 'component_access':
      this.#extractFromComponentAccess(expression, references);
      break;
      
    case 'filtered_access':
      this.#extractFromFilteredAccess(expression, references);
      break;
      
    case 'union':
      this.#extractFromUnionExpression(expression, references);
      break;
      
    case 'array_iteration':
      this.#extractFromArrayIteration(expression, references);
      break;
      
    case 'scope_reference':
      this.#extractFromScopeReference(expression, references);
      break;
      
    default:
      this.#logger.debug(`Unknown expression type: ${expression.type}`);
      break;
  }
}

/**
 * Extracts references from component access expressions
 * @private
 * @param {ComponentAccessExpression} expression - Component access expression
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromComponentAccess(expression, references) {
  // Pattern: entity.components.modId:componentId.field
  if (expression.componentRef) {
    const { modId, componentId } = expression.componentRef;
    this.#addReference(modId, componentId, references);
  }
  
  // Process nested expressions
  if (expression.baseExpression) {
    this.#extractFromScopeExpression(expression.baseExpression, references);
  }
}

/**
 * Extracts references from filtered access expressions
 * @private
 * @param {FilteredAccessExpression} expression - Filtered access expression
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromFilteredAccess(expression, references) {
  // Process base expression
  if (expression.baseExpression) {
    this.#extractFromScopeExpression(expression.baseExpression, references);
  }
  
  // Process JSON Logic filter
  if (expression.filter) {
    this.#extractFromJsonLogic(expression.filter, references);
  }
}

/**
 * Extracts references from union expressions (| or + operators)
 * @private
 * @param {UnionExpression} expression - Union expression
 * @param {ModReferenceMap} references - Reference map to populate  
 */
#extractFromUnionExpression(expression, references) {
  // Process all operands in the union
  if (expression.operands) {
    expression.operands.forEach(operand => {
      this.#extractFromScopeExpression(operand, references);
    });
  }
}

/**
 * Extracts references from array iteration expressions
 * @private
 * @param {ArrayIterationExpression} expression - Array iteration expression
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromArrayIteration(expression, references) {
  // Process base expression
  if (expression.baseExpression) {
    this.#extractFromScopeExpression(expression.baseExpression, references);
  }
  
  // Process iteration filter if present
  if (expression.filter) {
    this.#extractFromJsonLogic(expression.filter, references);
  }
}

/**
 * Extracts references from scope reference expressions
 * @private
 * @param {ScopeReferenceExpression} expression - Scope reference expression
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractFromScopeReference(expression, references) {
  // Direct scope references: modId:scopeId
  if (expression.modId && expression.scopeId) {
    this.#addReference(expression.modId, expression.scopeId, references);
  }
}

/**
 * Helper to safely add a reference to the reference map
 * @private
 * @param {string} modId - Mod identifier
 * @param {string} componentId - Component identifier
 * @param {ModReferenceMap} references - Reference map to populate
 */
#addReference(modId, componentId, references) {
  // Skip core references and special cases
  if (modId === 'core' || modId === 'none' || modId === 'self') {
    return;
  }
  
  if (!references.has(modId)) {
    references.set(modId, new Set());
  }
  
  references.get(modId).add(componentId);
  this.#logger.debug(`Found scope reference: ${modId}:${componentId}`);
}
```

### Scope DSL Parser Class

Create a dedicated parser class for Scope DSL syntax:

```javascript
/**
 * @file Parses Scope DSL syntax to extract structured expressions
 * @see src/scopeDsl/ - Existing scope parsing infrastructure
 */

/**
 * @typedef {Object} ScopeDefinition
 * @property {Object} target - Assignment target {modId, scopeId}
 * @property {ScopeExpression} expression - Right-hand expression tree
 * @property {number} lineNumber - Source line number
 */

/**
 * @typedef {Object} ScopeExpression
 * @property {string} type - Expression type identifier
 * @property {Object} data - Type-specific expression data
 */

/**
 * @typedef {Object} ParseResult
 * @property {ScopeDefinition[]} definitions - Successfully parsed definitions
 * @property {Object[]} errors - Parse errors with context
 */

class ScopeDslParser {
  #logger;
  
  constructor(logger) {
    this.#logger = logger;
  }
  
  /**
   * Parses complete scope file content
   * @param {string} content - File content to parse
   * @param {string} fileName - File name for error context
   * @returns {ParseResult} Parse results with definitions and errors
   */
  parseScope(content, fileName) {
    const lines = content.split('\n');
    const definitions = [];
    const errors = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      try {
        const definition = this.#parseScopeDefinition(line, i + 1);
        if (definition) {
          definitions.push(definition);
        }
      } catch (error) {
        errors.push({
          line: i + 1,
          content: line,
          error: error.message,
          fileName,
          partialReferences: this.#extractPartialReferences(line)
        });
      }
    }
    
    return { definitions, errors };
  }
  
  /**
   * Parses a single scope definition line
   * @private
   * @param {string} line - Line to parse
   * @param {number} lineNumber - Line number for error reporting
   * @returns {ScopeDefinition|null} Parsed definition or null if invalid
   */
  #parseScopeDefinition(line, lineNumber) {
    // Split on assignment operator :=
    const assignmentMatch = line.match(/^([^:]+:[^:]+)\s*:=\s*(.+)$/);
    if (!assignmentMatch) {
      throw new Error(`Invalid scope definition syntax: missing ':=' operator`);
    }
    
    const [, targetStr, expressionStr] = assignmentMatch;
    
    // Parse assignment target
    const target = this.#parseAssignmentTarget(targetStr.trim());
    
    // Parse expression
    const expression = this.#parseExpression(expressionStr.trim());
    
    return {
      target,
      expression,
      lineNumber
    };
  }
  
  /**
   * Parses assignment target (left side of :=)
   * @private  
   * @param {string} targetStr - Target string to parse
   * @returns {Object} Parsed target with modId and scopeId
   */
  #parseAssignmentTarget(targetStr) {
    const colonIndex = targetStr.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid assignment target: missing mod namespace`);
    }
    
    const modId = targetStr.substring(0, colonIndex);
    const scopeId = targetStr.substring(colonIndex + 1);
    
    if (!modId || !scopeId) {
      throw new Error(`Invalid assignment target format: ${targetStr}`);
    }
    
    return { modId, scopeId };
  }
  
  /**
   * Parses scope expressions (right side of :=)
   * @private
   * @param {string} expressionStr - Expression string to parse
   * @returns {ScopeExpression} Parsed expression tree
   */
  #parseExpression(expressionStr) {
    // Handle union operators (| or +)
    const unionMatch = expressionStr.match(/^(.+?)\s*[|+]\s*(.+)$/);
    if (unionMatch) {
      return this.#parseUnionExpression(expressionStr);
    }
    
    // Handle filtered access: expression[filter]
    const filterMatch = expressionStr.match(/^(.+?)\[(.+)\]$/);
    if (filterMatch) {
      return this.#parseFilteredAccess(expressionStr, filterMatch);
    }
    
    // Handle array iteration: expression[]
    if (expressionStr.endsWith('[]')) {
      return this.#parseArrayIteration(expressionStr);
    }
    
    // Handle component access: entity.components.modId:componentId.field
    if (expressionStr.includes('.components.')) {
      return this.#parseComponentAccess(expressionStr);
    }
    
    // Handle direct scope reference: modId:scopeId
    if (expressionStr.includes(':') && !expressionStr.includes('.')) {
      return this.#parseScopeReference(expressionStr);
    }
    
    throw new Error(`Unsupported expression syntax: ${expressionStr}`);
  }
  
  /**
   * Parses union expressions with | or + operators
   * @private
   * @param {string} expressionStr - Union expression string
   * @returns {ScopeExpression} Union expression tree
   */
  #parseUnionExpression(expressionStr) {
    // Split on union operators, respecting nested brackets
    const operands = this.#splitRespectingBrackets(expressionStr, /[|+]/);
    
    const parsedOperands = operands.map(operand => 
      this.#parseExpression(operand.trim())
    );
    
    return {
      type: 'union',
      operands: parsedOperands
    };
  }
  
  /**
   * Parses filtered access expressions
   * @private
   * @param {string} expressionStr - Full expression string
   * @param {RegExpMatchArray} filterMatch - Regex match result
   * @returns {ScopeExpression} Filtered access expression
   */
  #parseFilteredAccess(expressionStr, filterMatch) {
    const [, baseStr, filterStr] = filterMatch;
    
    const baseExpression = this.#parseExpression(baseStr.trim());
    
    // Parse JSON Logic filter
    let filter;
    try {
      filter = JSON.parse(filterStr);
    } catch (error) {
      throw new Error(`Invalid JSON filter: ${filterStr}`);
    }
    
    return {
      type: 'filtered_access',
      baseExpression,
      filter
    };
  }
  
  /**
   * Parses array iteration expressions
   * @private
   * @param {string} expressionStr - Array iteration string  
   * @returns {ScopeExpression} Array iteration expression
   */
  #parseArrayIteration(expressionStr) {
    const baseStr = expressionStr.slice(0, -2); // Remove []
    const baseExpression = this.#parseExpression(baseStr.trim());
    
    return {
      type: 'array_iteration',
      baseExpression
    };
  }
  
  /**
   * Parses component access expressions
   * @private
   * @param {string} expressionStr - Component access string
   * @returns {ScopeExpression} Component access expression
   */
  #parseComponentAccess(expressionStr) {
    // Pattern: entity.components.modId:componentId.field.subfield
    const parts = expressionStr.split('.');
    const componentsIndex = parts.indexOf('components');
    
    if (componentsIndex === -1) {
      throw new Error(`Invalid component access: missing 'components' segment`);
    }
    
    if (parts.length <= componentsIndex + 1) {
      throw new Error(`Invalid component access: missing component reference`);
    }
    
    const componentRefStr = parts[componentsIndex + 1];
    const componentRef = this.#parseComponentReference(componentRefStr);
    
    return {
      type: 'component_access',
      baseEntity: parts.slice(0, componentsIndex).join('.'),
      componentRef,
      fieldPath: parts.slice(componentsIndex + 2)
    };
  }
  
  /**
   * Parses direct scope references
   * @private
   * @param {string} expressionStr - Scope reference string
   * @returns {ScopeExpression} Scope reference expression
   */
  #parseScopeReference(expressionStr) {
    const colonIndex = expressionStr.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid scope reference: missing mod namespace`);
    }
    
    const modId = expressionStr.substring(0, colonIndex);
    const scopeId = expressionStr.substring(colonIndex + 1);
    
    return {
      type: 'scope_reference',
      modId,
      scopeId
    };
  }
  
  /**
   * Parses component references (modId:componentId)
   * @private
   * @param {string} refStr - Component reference string
   * @returns {Object} Component reference with modId and componentId
   */
  #parseComponentReference(refStr) {
    const colonIndex = refStr.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid component reference: missing mod namespace`);
    }
    
    const modId = refStr.substring(0, colonIndex);
    const componentId = refStr.substring(colonIndex + 1);
    
    return { modId, componentId };
  }
  
  /**
   * Splits string on delimiters while respecting bracket nesting
   * @private
   * @param {string} str - String to split
   * @param {RegExp} delimiter - Delimiter pattern
   * @returns {string[]} Split parts
   */
  #splitRespectingBrackets(str, delimiter) {
    const parts = [];
    let current = '';
    let bracketDepth = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      if (char === '[') {
        bracketDepth++;
      } else if (char === ']') {
        bracketDepth--;
      } else if (bracketDepth === 0 && delimiter.test(char)) {
        parts.push(current);
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }
  
  /**
   * Extracts partial references from unparseable lines using regex fallback
   * @private
   * @param {string} line - Line that failed to parse
   * @returns {ModReferenceMap} Partial references found
   */
  #extractPartialReferences(line) {
    const references = new Map();
    
    // Simple regex patterns for common reference formats
    const patterns = [
      /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)\b/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const [, modId, componentId] = match;
        
        if (modId !== 'core' && modId !== 'none' && modId !== 'self') {
          if (!references.has(modId)) {
            references.set(modId, new Set());
          }
          references.get(modId).add(componentId);
        }
      }
    });
    
    return references;
  }
}
```

### Fallback Regex Extraction

```javascript
/**
 * Fallback regex-based extraction for scope files when parsing fails
 * @private
 * @param {string} content - File content
 * @param {ModReferenceMap} references - Reference map to populate
 */
#extractScopeReferencesWithRegex(content, references) {
  this.#logger.debug('Using fallback regex extraction for scope file');
  
  // Multiple patterns to catch different scope syntax variations
  const patterns = [
    // Assignment targets: modId:scopeId :=
    /^([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)\s*:=/gm,
    
    // Component access: .components.modId:componentId
    /\.components\.([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)/g,
    
    // Direct references: modId:identifier  
    /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)\b/g,
    
    // JSON Logic embedded in scope filters
    /"([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)"/g
  ];
  
  patterns.forEach((pattern, index) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, modId, componentId] = match;
      
      // Skip core and special references
      if (modId === 'core' || modId === 'none' || modId === 'self') {
        continue;
      }
      
      this.#addReference(modId, componentId, references);
      this.#logger.debug(`Regex fallback found: ${modId}:${componentId} (pattern ${index})`);
    }
  });
}
```

## Integration with Existing Infrastructure

### Leverage Current Scope DSL System

```javascript
/**
 * Integration with existing scope DSL infrastructure if available
 * @private
 * @param {string} content - Scope file content
 * @returns {boolean} True if existing parser was used successfully
 */
#tryExistingScoreDslParser(content) {
  try {
    // Check if existing scope parsing infrastructure can be leveraged
    const existingParser = this.#container?.resolve?.('IScopeDslEngine');
    if (existingParser && typeof existingParser.parseScope === 'function') {
      this.#logger.debug('Using existing scope DSL parser');
      
      const result = existingParser.parseScope(content);
      // Extract references from existing parser result
      return this.#extractFromExistingParserResult(result);
    }
  } catch (error) {
    this.#logger.debug(`Existing parser unavailable: ${error.message}`);
  }
  
  return false;
}
```

## Testing Requirements

### Scope DSL Parsing Tests

```javascript
// tests/unit/validation/modReferenceExtractor.scopeDsl.test.js

describe('ModReferenceExtractor - Scope DSL Processing', () => {
  describe('Basic Scope Definitions', () => {
    it('should extract references from simple assignments', () => {
      const scopeContent = `
        positioning:close_actors := actor.components.positioning:closeness.partners
        intimacy:attracted_actors := actor.components.intimacy:attraction.targets
      `;
      
      const parser = new ScopeDslParser(mockLogger);
      const result = parser.parseScope(scopeContent, 'test.scope');
      
      expect(result.definitions).toHaveLength(2);
      expect(result.definitions[0].target.modId).toBe('positioning');
      expect(result.definitions[0].target.scopeId).toBe('close_actors');
    });

    it('should extract component references from expressions', () => {
      const scopeContent = `
        test:scope := actor.components.positioning:closeness.partners
      `;
      
      const references = new Map();
      extractor.#extractFromScopeFile('/test/test.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
    });
  });

  describe('Complex Scope Expressions', () => {
    it('should handle filtered access with JSON Logic', () => {
      const scopeContent = `
        intimacy:available_partners := actor.components.positioning:closeness.partners[
          {
            "and": [
              {"has_component": ["item", "intimacy:attraction"]},
              {">=": [{"get_component_value": ["item", "intimacy:attraction", "level"]}, 30]}
            ]
          }
        ]
      `;
      
      const references = new Map();
      extractor.#extractFromScopeFile('/test/test.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
      expect(references.get('intimacy')).toContain('attraction');
    });

    it('should handle union expressions', () => {
      const scopeContent = `
        positioning:all_nearby := actor.components.positioning:closeness.partners | actor.followers
      `;
      
      const references = new Map();
      extractor.#extractFromScopeFile('/test/test.scope', references);
      
      expect(references.get('positioning')).toContain('closeness');
    });

    it('should handle array iterations', () => {
      const scopeContent = `
        positioning:furniture_users := actor.components.positioning:sitting.furniture.users[]
      `;
      
      const references = new Map();
      extractor.#extractFromScopeFile('/test/test.scope', references);
      
      expect(references.get('positioning')).toContain('sitting');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed scope syntax gracefully', () => {
      const malformedContent = `
        invalid_scope_without_assignment := 
        positioning:valid_scope := actor.components.positioning:closeness
        another:invalid := [malformed json filter}
      `;
      
      const parser = new ScopeDslParser(mockLogger);
      const result = parser.parseScope(malformedContent, 'test.scope');
      
      expect(result.definitions).toHaveLength(1); // Only valid one
      expect(result.errors).toHaveLength(2);      // Two malformed lines
    });

    it('should provide partial references from failed parses', () => {
      const partialContent = `
        invalid:syntax without assignment but intimacy:kissing reference
      `;
      
      const references = new Map();
      extractor.#extractFromScopeFile('/test/test.scope', references);
      
      // Should still extract references via regex fallback
      expect(references.get('intimacy')).toContain('kissing');
    });
  });

  describe('Performance', () => {
    it('should handle large scope files efficiently', () => {
      const largeContent = Array.from({length: 100}, (_, i) => 
        `mod${i}:scope${i} := actor.components.mod${i}:component${i}.field`
      ).join('\n');
      
      const startTime = performance.now();
      const references = new Map();
      extractor.#extractFromScopeFile('/test/large.scope', references);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(200); // <200ms for 100 definitions
      expect(references.size).toBe(100);
    });
  });

  describe('Integration', () => {
    it('should integrate with existing scope DSL infrastructure when available', () => {
      // Test integration with existing parser if present
    });

    it('should fallback gracefully when existing parser unavailable', () => {
      // Test standalone operation
    });
  });
});
```

### Regex Fallback Tests

```javascript
describe('Scope DSL Regex Fallback', () => {
  it('should extract references when parser fails completely', () => {
    const complexContent = `
      # This content has syntax errors but contains valid references
      broken:syntax := actor.components.positioning:closeness invalid
      also:broken [{ bad json }] but has intimacy:attraction reference
    `;
    
    const references = new Map();
    // Simulate parser failure
    jest.spyOn(extractor, '#parseScopeDefinition').mockImplementation(() => {
      throw new Error('Parse failed');
    });
    
    extractor.#extractScopeReferencesWithRegex(complexContent, references);
    
    expect(references.get('positioning')).toContain('closeness');
    expect(references.get('intimacy')).toContain('attraction');
  });
});
```

## Success Criteria

- [ ] Comprehensive Scope DSL parser handles all syntax variations
- [ ] Complex expressions (unions, filters, iterations) parsed correctly
- [ ] JSON Logic filters within scope expressions processed
- [ ] Error handling provides partial references from failed parses
- [ ] Regex fallback extracts references when parser fails
- [ ] Performance acceptable for large scope files (<200ms for 100 definitions)
- [ ] Integration with existing scope DSL infrastructure when available
- [ ] Test coverage >90% for all parsing functionality
- [ ] Documentation explains scope syntax patterns and extraction logic

## Implementation Notes

### Scope DSL Complexity Levels
1. **Simple assignments**: `mod:scope := entity.field`
2. **Component access**: `mod:scope := entity.components.mod:comp.field`  
3. **Filtered access**: `mod:scope := entity.components.mod:comp[{filter}]`
4. **Union expressions**: `mod:scope := expr1 | expr2 + expr3`
5. **Nested combinations**: Multiple operators in single expression

### Parser Architecture Decisions
- **Recursive descent parsing** for complex expressions
- **Error recovery** to continue parsing after syntax errors
- **Partial reference extraction** from unparseable content
- **Performance optimization** for large files

### Integration Strategy
- **Leverage existing infrastructure** where possible
- **Standalone operation** when existing parser unavailable
- **Consistent error handling** with other validators
- **Flexible architecture** for future DSL evolution

## Next Steps

After completion:
1. **MODDEPVAL-004**: Create comprehensive unit tests covering all extraction functionality
2. **Performance optimization**: Profile scope parsing performance
3. **Integration testing**: Test with real scope files from mod ecosystem

## References

- **Scope DSL examples**: Various `.scope` files in `data/mods/`
- **Existing scope infrastructure**: `src/scopeDsl/` directory
- **JSON Logic documentation**: Understanding embedded filter syntax
- **Parser design patterns**: Recursive descent parsing techniques