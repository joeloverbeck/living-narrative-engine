/**
 * @file Extracts mod references from various file types to detect undeclared dependencies
 * @see src/validation/ajvSchemaValidator.js - Similar validation infrastructure pattern
 * @see src/modding/modDependencyValidator.js - Existing dependency validation
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { string } from '../utils/validationCore.js';
// Runtime Environment Note: This implementation assumes Node.js environment with filesystem access
// If intended for browser runtime, replace fs/path imports with fetch-based approaches
import path from 'path';
import fs from 'fs/promises';
import { parseScopeDefinitions } from '../scopeDsl/scopeDefinitionParser.js';

/** @typedef {import('./types.js').ModReferenceMap} ModReferenceMap */
/** @typedef {import('./types.js').ExtractionResult} ExtractionResult */

/**
 * Extracts mod references from various file types to identify cross-mod dependencies
 * Integrates with existing validation infrastructure for consistent error handling
 */
class ModReferenceExtractor {
  #logger;
  // eslint-disable-next-line no-unused-private-class-members
  #ajvValidator; // Reserved for future schema validation in MODDEPVAL-002
  
  /**
   * Creates a new ModReferenceExtractor instance
   *
   * @param {object} dependencies - Dependencies for the extractor
   * @param {import('../utils/loggerUtils.js').ILogger} dependencies.logger - Logger instance for debug/info/warn/error logging
   * @param {import('./ajvSchemaValidator.js')} dependencies.ajvValidator - AJV validator instance for schema validation
   */
  constructor({ logger, ajvValidator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(ajvValidator, 'IAjvValidator', logger, {
      requiredMethods: ['validate'],
    });
    
    this.#logger = logger;
    this.#ajvValidator = ajvValidator;
  }

  /**
   * Extracts all mod references from a given mod directory
   *
   * @param {string} modPath - Absolute path to mod directory
   * @returns {Promise<ModReferenceMap>} Map of referenced mod IDs to component sets
   * @throws {Error} If modPath is invalid or inaccessible
   */
  async extractReferences(modPath) {
    string.assertNonBlank(modPath, 'modPath', 'ModReferenceExtractor.extractReferences', this.#logger);
    
    try {
      const modId = path.basename(modPath);
      this.#logger.debug(`Starting reference extraction for mod: ${modId}`);
      
      const references = new Map();
      await this.#scanDirectory(modPath, references, modId);
      
      // Remove self-references (references to the mod being analyzed)
      references.delete(modId);
      
      this.#logger.info(`Extracted references for mod '${modId}': ${Array.from(references.keys()).join(', ')}`);
      return references;
      
    } catch (error) {
      this.#logger.error(`Failed to extract references from ${modPath}`, error);
      throw error;
    }
  }

  /**
   * Recursively scans directory for mod files and extracts references
   *
   * @private
   * @param {string} dirPath - Directory to scan
   * @param {ModReferenceMap} references - Reference map to populate
   * @param {string} modId - ID of the mod being analyzed (for filtering self-references)
   */
  async #scanDirectory(dirPath, references, modId) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await this.#scanDirectory(fullPath, references, modId);
      } else if (entry.isFile()) {
        await this.#extractFromFile(fullPath, references);
      }
    }
  }

  /**
   * Enhanced file processing with better error recovery and reporting
   *
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

  /**
   * Enhanced JSON processing with file-type-specific extraction logic
   *
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
      default: {
        // Fallback to existing generic processing
        const extractedRefs = this.#extractReferencesFromObject(data, fileType);
        // Merge extracted references into the main reference map
        for (const [modId, componentIds] of extractedRefs) {
          if (!references.has(modId)) {
            references.set(modId, new Set());
          }
          for (const componentId of componentIds) {
            references.get(modId).add(componentId);
          }
        }
        break;
      }
    }
  }

  /**
   * Extracts references from Scope DSL files (.scope)
   *
   * @private
   * @param {string} filePath - Scope file path  
   * @param {ModReferenceMap} references - Reference map to populate
   */
  async #extractFromScopeFile(filePath, references) {
    const content = await fs.readFile(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    try {
      this.#logger.debug(`Processing scope file: ${fileName}`);
      
      // Use existing scope definition parser from scopeDsl module
      const scopeDefinitions = parseScopeDefinitions(content, filePath);
      
      // Extract references from parsed scope definitions
      for (const [scopeName, { ast }] of scopeDefinitions) {
        this.#extractReferencesFromScopeAST(scopeName, ast, references);
      }
      
      this.#logger.debug(`Extracted ${references.size} mod references from ${fileName}`);
      
    } catch (error) {
      this.#logger.warn(`Failed to parse scope file ${fileName}: ${error.message}`);
      // Fallback to regex-based extraction for partial results
      this.#extractScopeReferencesWithRegex(content, references);
    }
  }

  /**
   * Extracts references from a parsed scope AST
   *
   * @private
   * @param {string} scopeName - Name of the scope (e.g., "intimacy:close_actors")
   * @param {object} ast - Parsed AST from parseScopeDefinitions
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractReferencesFromScopeAST(scopeName, ast, references) {
    // Extract from scope name (left side of :=)
    const colonIndex = scopeName.indexOf(':');
    if (colonIndex !== -1) {
      const modId = scopeName.substring(0, colonIndex);
      const scopeId = scopeName.substring(colonIndex + 1);
      if (modId !== 'core' && modId !== 'none' && modId !== 'self') {
        this.#addScopeReference(modId, scopeId, references);
      }
    }
    
    // Extract from AST tree (right side of :=)
    this.#extractFromScopeExpression(ast, references);
  }

  /**
   * Recursively extracts references from parsed AST nodes
   * The existing parser produces AST nodes with these types:
   * - Source: { type: 'Source', kind: 'actor'|'location'|'entities', param?: string }
   * - Step: { type: 'Step', field: string, isArray: boolean, parent: object }
   * - Filter: { type: 'Filter', logic: object, parent: object }
   * - Union: { type: 'Union', left: object, right: object }
   * - ArrayIterationStep: { type: 'ArrayIterationStep', parent: object }
   * 
   * @private
   * @param {object} node - AST node from parseDslExpression
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromScopeExpression(node, references) {
    if (!node) return;
    
    switch (node.type) {
      case 'Step':
        this.#extractFromStepNode(node, references);
        break;
        
      case 'Filter':
        this.#extractFromFilterNode(node, references);
        break;
        
      case 'Union':
        this.#extractFromUnionNode(node, references);
        break;
        
      case 'ArrayIterationStep':
        // Process parent node for array iteration
        if (node.parent) {
          this.#extractFromScopeExpression(node.parent, references);
        }
        break;
        
      case 'Source':
        // Source nodes may contain entity references
        if (node.param && node.param.includes(':')) {
          this.#extractModReferencesFromString(node.param, references, 'source_param');
        }
        break;
        
      default:
        this.#logger.debug(`Processing AST node type: ${node.type}`);
        break;
    }
  }

  /**
   * Extracts references from Step nodes (field access)
   *
   * @private
   * @param {object} node - Step node from AST
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromStepNode(node, references) {
    // Step nodes represent field access like .components.modId:componentId
    if (node.field && node.field.includes(':')) {
      // Field contains a mod reference
      this.#extractModReferencesFromString(node.field, references, 'step_field');
    }
    
    // Process parent node
    if (node.parent) {
      this.#extractFromScopeExpression(node.parent, references);
    }
  }

  /**
   * Extracts references from Filter nodes
   *
   * @private
   * @param {object} node - Filter node from AST
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromFilterNode(node, references) {
    // Process parent expression
    if (node.parent) {
      this.#extractFromScopeExpression(node.parent, references);
    }
    
    // Process JSON Logic in filter
    if (node.logic) {
      this.#extractFromJsonLogic(node.logic, references);
    }
  }

  /**
   * Extracts references from Union nodes (| or + operators)
   *
   * @private
   * @param {object} node - Union node from AST
   * @param {ModReferenceMap} references - Reference map to populate  
   */
  #extractFromUnionNode(node, references) {
    // Process left and right branches of the union
    if (node.left) {
      this.#extractFromScopeExpression(node.left, references);
    }
    if (node.right) {
      this.#extractFromScopeExpression(node.right, references);
    }
  }

  /**
   * Helper to safely add a scope reference to the reference map
   *
   * @private
   * @param {string} modId - Mod identifier
   * @param {string} componentId - Component identifier
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #addScopeReference(modId, componentId, references) {
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

  /**
   * Recursively extracts mod references from object/array structures
   *
   * @private
   * @param {any} obj - Object to scan
   * @param {string} fileType - Type of file being processed
   * @returns {ModReferenceMap} Extracted references
   */
  #extractReferencesFromObject(obj, fileType) {
    const references = new Map();
    this.#traverseObject(obj, '', references, fileType);
    return references;
  }

  /**
   * Deep traversal of object structures to find mod reference patterns
   *
   * @private
   * @param {any} obj - Current object/value
   * @param {string} path - Current object path for context
   * @param {ModReferenceMap} references - Reference map to populate
   * @param {string} fileType - Type of file being processed
   */
  #traverseObject(obj, path, references, fileType) {
    if (typeof obj === 'string') {
      this.#extractModReferencesFromString(obj, references, path || fileType);
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.#traverseObject(item, `${path}[${index}]`, references, fileType);
      });
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        this.#traverseObject(value, `${path}.${key}`, references, fileType);
      }
    }
  }

  /**
   * Enhanced mod reference extraction with context awareness
   *
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
      // Standard modId:componentId pattern (including hyphens for compatibility)
      /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_-]*)\b/g,
      
      // Scope DSL patterns in JSON strings (preview for MODDEPVAL-003)
      /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_-]*)\s*:=/g,
      
      // Component access patterns: modId:componentId.field
      /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_-]*)\.[a-zA-Z_][a-zA-Z0-9_]*\b/g
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

  /**
   * Determines JSON file type based on filename patterns
   *
   * @private
   * @param {string} filePath - File path to analyze
   * @returns {string} File type identifier
   */
  #detectJsonFileType(filePath) {
    const basename = path.basename(filePath);
    
    if (basename.endsWith('.action.json')) return 'action';
    if (basename.endsWith('.rule.json')) return 'rule';  
    if (basename.endsWith('.condition.json')) return 'condition';
    if (basename.endsWith('.component.json')) return 'component';
    if (basename.endsWith('.event.json')) return 'event';
    if (basename.endsWith('.blueprint.json')) return 'blueprint';
    if (basename.endsWith('.recipe.json')) return 'recipe';
    
    return 'unknown';
  }

  /**
   * Extracts references from action files with specialized logic
   *
   * @private
   * @param {object} actionData - Parsed action JSON
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromActionFile(actionData, references) {
    // Required components - typically arrays of component IDs
    if (actionData.required_components) {
      for (const [_entityType, components] of Object.entries(actionData.required_components)) {
        if (Array.isArray(components)) {
          components.forEach(comp => this.#extractModReferencesFromString(comp, references, 'required_components'));
        }
      }
    }

    // Forbidden components - same structure as required
    if (actionData.forbidden_components) {
      for (const [_entityType, components] of Object.entries(actionData.forbidden_components)) {
        if (Array.isArray(components)) {
          components.forEach(comp => this.#extractModReferencesFromString(comp, references, 'forbidden_components'));
        }
      }
    }

    // Target scopes - reference to scope definitions
    if (actionData.targets?.scope) {
      this.#extractModReferencesFromString(actionData.targets.scope, references, 'target_scope');
    }

    // Handle targets as string (alternative format)
    if (typeof actionData.targets === 'string') {
      this.#extractModReferencesFromString(actionData.targets, references, 'targets_string');
    }

    // Handle target as string (singular form)
    if (typeof actionData.target === 'string') {
      this.#extractModReferencesFromString(actionData.target, references, 'target_string');
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
   *
   * @private
   * @param {object} ruleData - Parsed rule JSON
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromRuleFile(ruleData, references) {
    // Condition references - link to other mods' conditions
    if (ruleData.condition_ref) {
      this.#extractModReferencesFromString(ruleData.condition_ref, references, 'condition_ref');
    }

    // Condition object with condition_ref nested
    if (ruleData.condition?.condition_ref) {
      this.#extractModReferencesFromString(ruleData.condition.condition_ref, references, 'nested_condition_ref');
    }

    // Direct condition as string reference
    if (typeof ruleData.condition === 'string') {
      this.#extractModReferencesFromString(ruleData.condition, references, 'condition_string');
    }

    // Inline JSON Logic conditions
    if (ruleData.condition && typeof ruleData.condition === 'object' && !ruleData.condition.condition_ref) {
      this.#extractFromJsonLogic(ruleData.condition, references);
    }

    // Actions array with operation handlers
    if (ruleData.actions) {
      this.#extractFromOperationHandlers(ruleData.actions, references);
    }

    // Operation handlers with component operations (legacy format)
    if (ruleData.operations) {
      this.#extractFromOperationHandlers(ruleData.operations, references);
    }

    // Rule metadata may contain mod references
    if (ruleData.metadata) {
      const metadataRefs = this.#extractReferencesFromObject(ruleData.metadata, 'rule-metadata');
      // Merge metadata references
      for (const [modId, componentIds] of metadataRefs) {
        if (!references.has(modId)) {
          references.set(modId, new Set());
        }
        for (const componentId of componentIds) {
          references.get(modId).add(componentId);
        }
      }
    }
  }

  /**
   * Extracts references from condition files  
   *
   * @private
   * @param {object} conditionData - Parsed condition JSON
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromConditionFile(conditionData, references) {
    // Condition files are primarily JSON Logic structures
    if (conditionData.condition) {
      this.#extractFromJsonLogic(conditionData.condition, references);
    }

    // Some conditions may have metadata or dependencies
    const genericRefs = this.#extractReferencesFromObject(conditionData, 'condition');
    // Merge generic references
    for (const [modId, componentIds] of genericRefs) {
      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      for (const componentId of componentIds) {
        references.get(modId).add(componentId);
      }
    }
  }

  /**
   * Extracts references from component definition files
   *
   * @private
   * @param {object} componentData - Parsed component JSON
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromComponentFile(componentData, references) {
    // Component schemas may reference other mod components
    if (componentData.dataSchema) {
      const schemaRefs = this.#extractReferencesFromObject(componentData.dataSchema, 'component-schema');
      // Merge schema references
      for (const [modId, componentIds] of schemaRefs) {
        if (!references.has(modId)) {
          references.set(modId, new Set());
        }
        for (const componentId of componentIds) {
          references.get(modId).add(componentId);
        }
      }
    }

    // Default values might contain mod references
    if (componentData.defaultData) {
      const defaultRefs = this.#extractReferencesFromObject(componentData.defaultData, 'component-defaults');
      // Merge default references
      for (const [modId, componentIds] of defaultRefs) {
        if (!references.has(modId)) {
          references.set(modId, new Set());
        }
        for (const componentId of componentIds) {
          references.get(modId).add(componentId);
        }
      }
    }

    // Validation rules may contain component references
    if (componentData.validation) {
      const validationRefs = this.#extractReferencesFromObject(componentData.validation, 'component-validation');
      // Merge validation references
      for (const [modId, componentIds] of validationRefs) {
        if (!references.has(modId)) {
          references.set(modId, new Set());
        }
        for (const componentId of componentIds) {
          references.get(modId).add(componentId);
        }
      }
    }
  }

  /**
   * Extracts references from event definition files
   *
   * @private
   * @param {object} eventData - Parsed event JSON
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromEventFile(eventData, references) {
    // Event payload schemas may reference components
    if (eventData.payloadSchema) {
      const payloadRefs = this.#extractReferencesFromObject(eventData.payloadSchema, 'event-payload');
      // Merge payload references
      for (const [modId, componentIds] of payloadRefs) {
        if (!references.has(modId)) {
          references.set(modId, new Set());
        }
        for (const componentId of componentIds) {
          references.get(modId).add(componentId);
        }
      }
    }

    // Event handlers may contain component operations
    if (eventData.handlers) {
      this.#extractFromOperationHandlers(eventData.handlers, references);
    }

    // Event metadata
    const eventRefs = this.#extractReferencesFromObject(eventData, 'event');
    // Merge event references
    for (const [modId, componentIds] of eventRefs) {
      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      for (const componentId of componentIds) {
        references.get(modId).add(componentId);
      }
    }
  }

  /**
   * Extracts references from blueprint files (anatomy system)
   *
   * @private
   * @param {object} blueprintData - Parsed blueprint JSON
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromBlueprintFile(blueprintData, references) {
    // Blueprints define anatomy structures with potential cross-mod references
    const blueprintRefs = this.#extractReferencesFromObject(blueprintData, 'blueprint');
    // Merge blueprint references
    for (const [modId, componentIds] of blueprintRefs) {
      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      for (const componentId of componentIds) {
        references.get(modId).add(componentId);
      }
    }
  }

  /**
   * Extracts references from recipe files (anatomy system)
   *
   * @private  
   * @param {object} recipeData - Parsed recipe JSON
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromRecipeFile(recipeData, references) {
    // Recipes may reference components from other mods
    const recipeRefs = this.#extractReferencesFromObject(recipeData, 'recipe');
    // Merge recipe references
    for (const [modId, componentIds] of recipeRefs) {
      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      for (const componentId of componentIds) {
        references.get(modId).add(componentId);
      }
    }
  }

  /**
   * Recursively processes JSON Logic expressions to extract mod references
   *
   * @private
   * @param {object} jsonLogic - JSON Logic expression object
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
            this.#extractModReferencesFromString(componentRef, references, `json_logic_${operator}`);
          }
        }
      } else if (Array.isArray(operands)) {
        // Recursive processing for arrays
        operands.forEach(operand => {
          if (typeof operand === 'object') {
            this.#extractFromJsonLogic(operand, references);
          } else if (typeof operand === 'string') {
            this.#extractModReferencesFromString(operand, references, 'json_logic_operand');
          }
        });
      } else if (typeof operands === 'object') {
        // Recursive processing for objects
        this.#extractFromJsonLogic(operands, references);
      } else if (typeof operands === 'string') {
        // String operands may contain references
        this.#extractModReferencesFromString(operands, references, 'json_logic_string');
      }
    }
  }

  /**
   * Processes operation handler structures for component references
   *
   * @private
   * @param {Array | object} operations - Operation handler data
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
   *
   * @private
   * @param {object} operation - Single operation object
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractFromSingleOperation(operation, references) {
    if (!operation || typeof operation !== 'object') {
      return;
    }

    // Component operations often have 'component' or 'componentId' fields
    if (operation.component) {
      this.#extractModReferencesFromString(operation.component, references, 'operation_component');
    }
    
    if (operation.componentId) {
      this.#extractModReferencesFromString(operation.componentId, references, 'operation_componentId');
    }

    // Target specifications may contain mod references
    if (operation.target) {
      this.#extractModReferencesFromString(operation.target, references, 'operation_target');
    }

    // Component type specifications
    if (operation.component_type) {
      this.#extractModReferencesFromString(operation.component_type, references, 'operation_component_type');
    }

    // Parameters may contain nested references
    if (operation.parameters) {
      const paramRefs = this.#extractReferencesFromObject(operation.parameters, 'operation_parameters');
      // Merge parameter references
      for (const [modId, componentIds] of paramRefs) {
        if (!references.has(modId)) {
          references.set(modId, new Set());
        }
        for (const componentId of componentIds) {
          references.get(modId).add(componentId);
        }
      }
    }

    // Recursively process nested operation data
    const operationRefs = this.#extractReferencesFromObject(operation, 'operation');
    // Merge operation references
    for (const [modId, componentIds] of operationRefs) {
      if (!references.has(modId)) {
        references.set(modId, new Set());
      }
      for (const componentId of componentIds) {
        references.get(modId).add(componentId);
      }
    }
  }

  /**
   * Fallback regex-based extraction for scope files when parsing fails
   *
   * @private
   * @param {string} content - File content
   * @param {ModReferenceMap} references - Reference map to populate
   */
  #extractScopeReferencesWithRegex(content, references) {
    this.#logger.debug('Using fallback regex extraction for scope file');
    
    // Multiple patterns to catch different scope syntax variations
    const patterns = [
      // Assignment targets: modId:scopeId :=
      /^([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_-]*)\s*:=/gm,
      
      // Component access: .components.modId:componentId
      /\.components\.([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_-]*)/g,
      
      // Direct references: modId:identifier  
      /\b([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_-]*)\b/g,
      
      // JSON Logic embedded in scope filters
      /"([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_-]*)"/g
    ];
    
    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, modId, componentId] = match;
        
        // Skip core and special references
        if (modId === 'core' || modId === 'none' || modId === 'self') {
          continue;
        }
        
        this.#addScopeReference(modId, componentId, references);
        this.#logger.debug(`Regex fallback found: ${modId}:${componentId} (pattern ${index})`);
      }
    });
  }
}

export default ModReferenceExtractor;