/**
 * @file GateASTNormalizer - Service for parsing gates into canonical AST representation
 * @description Parses gate definitions from multiple formats (JSON-Logic, strings, arrays)
 * into a canonical AST representation, enabling reliable implication checking and
 * consistent gate comparisons.
 * @see tickets/PROANAOVEV3-006-gate-ast-normalizer.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Valid comparison operators supported by the gate system.
 *
 * @type {Set<string>}
 */
const VALID_OPERATORS = new Set(['<', '<=', '>', '>=', '==', '!=']);

/**
 * Regex pattern for parsing string gate predicates.
 * Matches patterns like "axis >= 0.35" or "valence <= -0.20".
 *
 * @type {RegExp}
 */
const GATE_STRING_PATTERN = /^(\w+)\s*(>=|<=|>|<|==|!=)\s*(-?\d*\.?\d+)$/;

/**
 * @typedef {object} GateAST
 * @property {'and' | 'or' | 'comparison' | 'not'} type - AST node type
 * @property {Array<GateAST>} [children] - Child nodes for 'and' | 'or' types
 * @property {GateAST} [operand] - Operand for 'not' type
 * @property {string} [axis] - Axis name for 'comparison' type
 * @property {'<' | '<=' | '>' | '>=' | '==' | '!='} [operator] - Comparison operator
 * @property {number} [threshold] - Threshold value for 'comparison' type
 */

/**
 * @typedef {object} ParseResult
 * @property {GateAST} ast - Parsed AST
 * @property {boolean} parseComplete - Whether parsing completed without errors
 * @property {Array<string>} errors - Any parsing errors encountered
 */

/**
 * @typedef {object} ImplicationResult
 * @property {boolean} implies - Whether A implies B
 * @property {boolean} isVacuous - Whether implication is vacuous (always true)
 */

/**
 * Service that parses gate definitions into a canonical AST representation.
 * Supports multiple input formats and provides implication checking.
 */
class GateASTNormalizer {
  #logger;

  /**
   * Constructs a new GateASTNormalizer instance.
   *
   * @param {object} options - Configuration options
   * @param {object} options.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#logger = logger;
  }

  /**
   * Parse gate definition to canonical AST.
   * Supports multiple input formats:
   * - JSON-Logic: {"and": [{">=": [{"var": "valence"}, 0.5]}, ...]}
   * - String predicates: "valence > 0.5 AND arousal >= 0.3"
   * - Array format: [{"axis": "valence", "op": ">", "value": 0.5}, ...]
   * - Single string gate: "valence >= 0.5"
   *
   * @param {object|string|Array} gate - Gate in any supported format
   * @returns {ParseResult} Parse result with AST and status
   */
  parse(gate) {
    const errors = [];

    try {
      // Handle null/undefined
      if (gate === null || gate === undefined) {
        return {
          ast: null,
          parseComplete: false,
          errors: ['Gate is null or undefined'],
        };
      }

      // Handle string input
      if (typeof gate === 'string') {
        const ast = this.#parseString(gate, errors);
        return {
          ast,
          parseComplete: errors.length === 0,
          errors,
        };
      }

      // Handle array input
      if (Array.isArray(gate)) {
        const ast = this.#parseArray(gate, errors);
        return {
          ast,
          parseComplete: errors.length === 0,
          errors,
        };
      }

      // Handle object input (JSON-Logic)
      if (typeof gate === 'object') {
        const ast = this.#parseJsonLogic(gate, errors);
        return {
          ast,
          parseComplete: errors.length === 0,
          errors,
        };
      }

      errors.push(`Unsupported gate type: ${typeof gate}`);
      return {
        ast: null,
        parseComplete: false,
        errors,
      };
    } catch (err) {
      this.#logger.error('GateASTNormalizer.parse failed', err);
      errors.push(`Parse error: ${err.message}`);
      return {
        ast: null,
        parseComplete: false,
        errors,
      };
    }
  }

  /**
   * Check if AST A implies AST B (A → B).
   * A implies B if every state satisfying A also satisfies B.
   *
   * @param {GateAST} astA - First AST
   * @param {GateAST} astB - Second AST
   * @returns {ImplicationResult} Implication result
   */
  checkImplication(astA, astB) {
    // Handle null ASTs
    if (astA === null) {
      // Null A (always true) doesn't imply B unless B is also always true
      return {
        implies: astB === null,
        isVacuous: true,
      };
    }

    if (astB === null) {
      // Anything implies null B (always true)
      return {
        implies: true,
        isVacuous: true,
      };
    }

    // Extract constraints from both ASTs
    const constraintsA = this.#extractConstraints(astA);
    const constraintsB = this.#extractConstraints(astB);

    // Check if A's constraints imply B's constraints
    // For A to imply B, every constraint in B must be satisfied by A's constraints
    const implies = this.#constraintsImply(constraintsA, constraintsB);

    return {
      implies,
      isVacuous: false,
    };
  }

  /**
   * Generate human-readable string from AST.
   *
   * @param {GateAST} ast - AST to convert
   * @returns {string} Human-readable gate expression
   */
  toString(ast) {
    if (ast === null) {
      return 'true';
    }

    switch (ast.type) {
      case 'comparison':
        return `${ast.axis} ${ast.operator} ${ast.threshold}`;

      case 'and':
        if (!ast.children || ast.children.length === 0) {
          return 'true';
        }
        return ast.children.map((c) => this.#wrapIfNeeded(c, 'and')).join(' AND ');

      case 'or':
        if (!ast.children || ast.children.length === 0) {
          return 'false';
        }
        return ast.children.map((c) => this.#wrapIfNeeded(c, 'or')).join(' OR ');

      case 'not':
        return `NOT ${this.#wrapIfNeeded(ast.operand, 'not')}`;

      default:
        return `[unknown: ${ast.type}]`;
    }
  }

  /**
   * Evaluate AST against context.
   *
   * @param {GateAST} ast - AST to evaluate
   * @param {object} context - Context with axis values
   * @returns {boolean} Whether the gate is satisfied
   */
  evaluate(ast, context) {
    if (ast === null) {
      return true; // Null AST is always satisfied
    }

    switch (ast.type) {
      case 'comparison':
        return this.#evaluateComparison(ast, context);

      case 'and':
        if (!ast.children || ast.children.length === 0) {
          return true;
        }
        return ast.children.every((child) => this.evaluate(child, context));

      case 'or':
        if (!ast.children || ast.children.length === 0) {
          return false;
        }
        return ast.children.some((child) => this.evaluate(child, context));

      case 'not':
        return !this.evaluate(ast.operand, context);

      default:
        this.#logger.warn(`Unknown AST type: ${ast.type}`);
        return false;
    }
  }

  /**
   * Normalize AST to canonical form (sorted, simplified).
   *
   * @param {GateAST} ast - AST to normalize
   * @returns {GateAST} Normalized AST
   */
  normalize(ast) {
    if (ast === null) {
      return null;
    }

    switch (ast.type) {
      case 'comparison':
        // Comparisons are already in canonical form
        return { ...ast };

      case 'and':
      case 'or': {
        if (!ast.children || ast.children.length === 0) {
          return ast.type === 'and' ? null : { type: 'or', children: [] };
        }

        // Flatten nested same-type nodes
        const flattened = this.#flattenLogical(ast);

        // Normalize children recursively
        const normalizedChildren = flattened.children
          .map((child) => this.normalize(child))
          .filter((child) => child !== null);

        // Remove duplicates and sort
        const uniqueChildren = this.#deduplicateAndSort(normalizedChildren);

        // Handle single child
        if (uniqueChildren.length === 0) {
          return ast.type === 'and' ? null : { type: 'or', children: [] };
        }
        if (uniqueChildren.length === 1) {
          return uniqueChildren[0];
        }

        return {
          type: ast.type,
          children: uniqueChildren,
        };
      }

      case 'not':
        return {
          type: 'not',
          operand: this.normalize(ast.operand),
        };

      default:
        return { ...ast };
    }
  }

  // ========== Private Methods ==========

  /**
   * Parse a string gate expression.
   *
   * @param {string} str - String to parse
   * @param {Array<string>} errors - Error collector
   * @returns {GateAST|null} Parsed AST or null
   * @private
   */
  #parseString(str, errors) {
    const trimmed = str.trim();

    if (trimmed === '') {
      errors.push('Empty gate string');
      return null;
    }

    // Check for compound expressions (AND/OR)
    const upperStr = trimmed.toUpperCase();

    if (upperStr.includes(' AND ') || upperStr.includes(' OR ')) {
      return this.#parseCompoundString(trimmed, errors);
    }

    // Parse as simple gate
    return this.#parseSimpleGate(trimmed, errors);
  }

  /**
   * Parse a compound string expression with AND/OR.
   *
   * @param {string} str - Compound expression string
   * @param {Array<string>} errors - Error collector
   * @returns {GateAST|null} Parsed AST
   * @private
   */
  #parseCompoundString(str, errors) {
    // Simple tokenization - split by AND/OR preserving order
    // For more complex expressions, a proper parser would be needed
    const upperStr = str.toUpperCase();

    // Determine primary operator (OR has lower precedence than AND)
    if (upperStr.includes(' OR ')) {
      const parts = this.#splitByOperator(str, ' OR ');
      const children = parts
        .map((part) => this.#parseString(part.trim(), errors))
        .filter((ast) => ast !== null);

      if (children.length === 0) {
        return null;
      }
      if (children.length === 1) {
        return children[0];
      }

      return {
        type: 'or',
        children,
      };
    }

    if (upperStr.includes(' AND ')) {
      const parts = this.#splitByOperator(str, ' AND ');
      const children = parts
        .map((part) => this.#parseString(part.trim(), errors))
        .filter((ast) => ast !== null);

      if (children.length === 0) {
        return null;
      }
      if (children.length === 1) {
        return children[0];
      }

      return {
        type: 'and',
        children,
      };
    }

    // Should not reach here, but fallback to simple gate
    return this.#parseSimpleGate(str, errors);
  }

  /**
   * Split string by operator (case-insensitive).
   *
   * @param {string} str - String to split
   * @param {string} operator - Operator to split by
   * @returns {Array<string>} Split parts
   * @private
   */
  #splitByOperator(str, operator) {
    const regex = new RegExp(operator, 'gi');
    return str.split(regex);
  }

  /**
   * Parse a simple gate string (axis op value).
   *
   * @param {string} str - Simple gate string
   * @param {Array<string>} errors - Error collector
   * @returns {GateAST|null} Parsed AST
   * @private
   */
  #parseSimpleGate(str, errors) {
    const match = str.match(GATE_STRING_PATTERN);

    if (!match) {
      errors.push(`Cannot parse gate string: "${str}"`);
      return null;
    }

    const [, axis, operator, valueStr] = match;
    const threshold = parseFloat(valueStr);

    if (Number.isNaN(threshold)) {
      errors.push(`Invalid numeric value in gate: "${str}"`);
      return null;
    }

    return {
      type: 'comparison',
      axis,
      operator,
      threshold,
    };
  }

  /**
   * Parse an array of gates (implicit AND).
   *
   * @param {Array} arr - Array of gates
   * @param {Array<string>} errors - Error collector
   * @returns {GateAST|null} Parsed AST
   * @private
   */
  #parseArray(arr, errors) {
    if (arr.length === 0) {
      return null; // Empty array = no constraints = always true
    }

    const children = [];

    for (const item of arr) {
      let ast = null;

      if (typeof item === 'string') {
        ast = this.#parseSimpleGate(item, errors);
      } else if (typeof item === 'object' && item !== null) {
        // Check for object format: {axis, op/operator, value/threshold}
        if ('axis' in item && ('op' in item || 'operator' in item)) {
          ast = this.#parseArrayObjectItem(item, errors);
        } else {
          // Try JSON-Logic format
          ast = this.#parseJsonLogic(item, errors);
        }
      } else {
        errors.push(`Unsupported array item type: ${typeof item}`);
      }

      if (ast !== null) {
        children.push(ast);
      }
    }

    if (children.length === 0) {
      return null;
    }
    if (children.length === 1) {
      return children[0];
    }

    return {
      type: 'and',
      children,
    };
  }

  /**
   * Parse an object item in array format.
   *
   * @param {object} item - Object with axis, op, value
   * @param {Array<string>} errors - Error collector
   * @returns {GateAST|null} Parsed AST
   * @private
   */
  #parseArrayObjectItem(item, errors) {
    const axis = item.axis;
    const operator = item.op || item.operator;
    const threshold = item.value !== undefined ? item.value : item.threshold;

    if (!axis || typeof axis !== 'string') {
      errors.push(`Invalid axis in object: ${JSON.stringify(item)}`);
      return null;
    }

    if (!VALID_OPERATORS.has(operator)) {
      errors.push(`Invalid operator "${operator}" in object: ${JSON.stringify(item)}`);
      return null;
    }

    if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
      errors.push(`Invalid threshold in object: ${JSON.stringify(item)}`);
      return null;
    }

    return {
      type: 'comparison',
      axis,
      operator,
      threshold,
    };
  }

  /**
   * Parse JSON-Logic format gate.
   *
   * @param {object} obj - JSON-Logic object
   * @param {Array<string>} errors - Error collector
   * @returns {GateAST|null} Parsed AST
   * @private
   */
  #parseJsonLogic(obj, errors) {
    if (obj === null || typeof obj !== 'object') {
      errors.push(`Invalid JSON-Logic: ${JSON.stringify(obj)}`);
      return null;
    }

    const keys = Object.keys(obj);

    if (keys.length === 0) {
      return null;
    }

    if (keys.length !== 1) {
      errors.push(`JSON-Logic object should have exactly one key: ${JSON.stringify(obj)}`);
      return null;
    }

    const op = keys[0];
    const args = obj[op];

    // Handle logical operators
    if (op === 'and' || op === 'or') {
      if (!Array.isArray(args)) {
        errors.push(`${op} operator requires array argument`);
        return null;
      }

      const children = args
        .map((arg) => this.#parseJsonLogic(arg, errors))
        .filter((ast) => ast !== null);

      if (children.length === 0) {
        return null;
      }
      if (children.length === 1) {
        return children[0];
      }

      return {
        type: op,
        children,
      };
    }

    // Handle not operator
    if (op === '!' || op === 'not') {
      const operand = this.#parseJsonLogic(args, errors);
      return {
        type: 'not',
        operand,
      };
    }

    // Handle comparison operators
    if (VALID_OPERATORS.has(op)) {
      return this.#parseJsonLogicComparison(op, args, errors);
    }

    errors.push(`Unknown JSON-Logic operator: ${op}`);
    return null;
  }

  /**
   * Parse a JSON-Logic comparison expression.
   *
   * @param {string} op - Comparison operator
   * @param {Array} args - Comparison arguments
   * @param {Array<string>} errors - Error collector
   * @returns {GateAST|null} Parsed AST
   * @private
   */
  #parseJsonLogicComparison(op, args, errors) {
    if (!Array.isArray(args) || args.length !== 2) {
      errors.push(`Comparison "${op}" requires exactly 2 arguments`);
      return null;
    }

    const [left, right] = args;

    // Determine which side is the variable and which is the value
    let axis = null;
    let threshold = null;
    let effectiveOp = op;

    if (this.#isJsonLogicVar(left) && typeof right === 'number') {
      axis = this.#extractVarName(left);
      threshold = right;
    } else if (this.#isJsonLogicVar(right) && typeof left === 'number') {
      axis = this.#extractVarName(right);
      threshold = left;
      // Flip operator since value is on left
      effectiveOp = this.#flipOperator(op);
    } else {
      errors.push(`Cannot parse comparison: ${JSON.stringify({ [op]: args })}`);
      return null;
    }

    return {
      type: 'comparison',
      axis,
      operator: effectiveOp,
      threshold,
    };
  }

  /**
   * Check if value is a JSON-Logic variable reference.
   *
   * @param {unknown} value - Value to check
   * @returns {boolean} True if variable reference
   * @private
   */
  #isJsonLogicVar(value) {
    return (
      value !== null &&
      typeof value === 'object' &&
      'var' in value &&
      typeof value.var === 'string'
    );
  }

  /**
   * Extract variable name from JSON-Logic var reference.
   *
   * @param {object} varRef - Variable reference
   * @returns {string} Variable name
   * @private
   */
  #extractVarName(varRef) {
    return varRef.var;
  }

  /**
   * Flip a comparison operator (for when operands are swapped).
   *
   * @param {string} op - Original operator
   * @returns {string} Flipped operator
   * @private
   */
  #flipOperator(op) {
    const flipMap = {
      '<': '>',
      '<=': '>=',
      '>': '<',
      '>=': '<=',
      '==': '==',
      '!=': '!=',
    };
    return flipMap[op] || op;
  }

  /**
   * Evaluate a comparison AST against context.
   *
   * @param {GateAST} ast - Comparison AST
   * @param {object} context - Context with axis values
   * @returns {boolean} Whether comparison is satisfied
   * @private
   */
  #evaluateComparison(ast, context) {
    const value = context[ast.axis];

    if (value === undefined) {
      // Missing axis - could be considered always true or always false
      // We'll treat it as always true (unconstrained)
      return true;
    }

    switch (ast.operator) {
      case '<':
        return value < ast.threshold;
      case '<=':
        return value <= ast.threshold;
      case '>':
        return value > ast.threshold;
      case '>=':
        return value >= ast.threshold;
      case '==':
        return Math.abs(value - ast.threshold) < 1e-9;
      case '!=':
        return Math.abs(value - ast.threshold) >= 1e-9;
      default:
        return false;
    }
  }

  /**
   * Wrap child AST in parentheses if needed for string output.
   *
   * @param {GateAST} child - Child AST
   * @param {string} parentType - Parent node type
   * @returns {string} Potentially wrapped string
   * @private
   */
  #wrapIfNeeded(child, parentType) {
    const childStr = this.toString(child);

    // Wrap if child is a different logical type (for clarity)
    if (
      (parentType === 'and' && child.type === 'or') ||
      (parentType === 'or' && child.type === 'and') ||
      parentType === 'not'
    ) {
      return `(${childStr})`;
    }

    return childStr;
  }

  /**
   * Flatten nested logical nodes of the same type.
   *
   * @param {GateAST} ast - Logical AST node
   * @returns {GateAST} Flattened AST
   * @private
   */
  #flattenLogical(ast) {
    if (ast.type !== 'and' && ast.type !== 'or') {
      return ast;
    }

    const flattened = [];

    for (const child of ast.children || []) {
      if (child.type === ast.type) {
        // Same type - flatten
        const flatChild = this.#flattenLogical(child);
        flattened.push(...(flatChild.children || [flatChild]));
      } else {
        flattened.push(child);
      }
    }

    return {
      type: ast.type,
      children: flattened,
    };
  }

  /**
   * Deduplicate and sort AST children.
   *
   * @param {Array<GateAST>} children - Children to process
   * @returns {Array<GateAST>} Deduplicated and sorted children
   * @private
   */
  #deduplicateAndSort(children) {
    // Convert to strings for comparison and deduplication
    const seen = new Map();

    for (const child of children) {
      const key = this.#astToSortKey(child);
      if (!seen.has(key)) {
        seen.set(key, child);
      }
    }

    // Sort by key
    const sorted = [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return sorted.map(([, ast]) => ast);
  }

  /**
   * Generate a sort key for an AST.
   *
   * @param {GateAST} ast - AST to convert
   * @returns {string} Sort key
   * @private
   */
  #astToSortKey(ast) {
    if (ast === null) {
      return 'null';
    }

    switch (ast.type) {
      case 'comparison':
        return `c:${ast.axis}:${ast.operator}:${ast.threshold}`;
      case 'and':
      case 'or':
        return `${ast.type}:${(ast.children || []).map((c) => this.#astToSortKey(c)).join(',')}`;
      case 'not':
        return `not:${this.#astToSortKey(ast.operand)}`;
      default:
        return `unknown:${JSON.stringify(ast)}`;
    }
  }

  /**
   * Extract constraints from an AST as a map of axis -> bounds.
   *
   * @param {GateAST} ast - AST to extract from
   * @returns {Map<string, {lower: number|null, upper: number|null}>} Constraints map
   * @private
   */
  #extractConstraints(ast) {
    const constraints = new Map();

    this.#collectConstraints(ast, constraints);

    return constraints;
  }

  /**
   * Recursively collect constraints from an AST.
   *
   * @param {GateAST} ast - AST to process
   * @param {Map} constraints - Constraints map to populate
   * @private
   */
  #collectConstraints(ast, constraints) {
    if (ast === null) {
      return;
    }

    switch (ast.type) {
      case 'comparison':
        this.#addConstraint(constraints, ast);
        break;

      case 'and':
        // AND: all children must be satisfied
        for (const child of ast.children || []) {
          this.#collectConstraints(child, constraints);
        }
        break;

      case 'or':
        // OR: we can't simply extract constraints (need union)
        // For simplicity, we don't handle OR in implication checking
        this.#logger.debug('OR nodes not fully supported in constraint extraction');
        break;

      case 'not':
        // NOT: invert constraints (complex, not fully implemented)
        this.#logger.debug('NOT nodes not fully supported in constraint extraction');
        break;
    }
  }

  /**
   * Add a comparison constraint to the constraints map.
   *
   * @param {Map} constraints - Constraints map
   * @param {GateAST} ast - Comparison AST
   * @private
   */
  #addConstraint(constraints, ast) {
    const { axis, operator, threshold } = ast;

    if (!constraints.has(axis)) {
      constraints.set(axis, { lower: null, upper: null });
    }

    const bounds = constraints.get(axis);

    switch (operator) {
      case '>=':
      case '>':
        // Lower bound
        if (bounds.lower === null || threshold > bounds.lower) {
          bounds.lower = threshold;
        }
        break;

      case '<=':
      case '<':
        // Upper bound
        if (bounds.upper === null || threshold < bounds.upper) {
          bounds.upper = threshold;
        }
        break;

      case '==':
        // Equality is both bounds
        bounds.lower = threshold;
        bounds.upper = threshold;
        break;
    }
  }

  /**
   * Check if constraints A imply constraints B.
   *
   * @param {Map} constraintsA - Constraints from A
   * @param {Map} constraintsB - Constraints from B
   * @returns {boolean} True if A implies B
   * @private
   */
  #constraintsImply(constraintsA, constraintsB) {
    // For A to imply B, every constraint in B must be satisfied by A's bounds
    // i.e., A's interval must be a subset of B's interval for each axis

    for (const [axis, boundsB] of constraintsB) {
      const boundsA = constraintsA.get(axis);

      if (!boundsA) {
        // A has no constraint on this axis (unconstrained)
        // Unconstrained doesn't imply a constraint
        return false;
      }

      // Check lower bound: A.lower >= B.lower
      if (boundsB.lower !== null) {
        if (boundsA.lower === null || boundsA.lower < boundsB.lower) {
          return false;
        }
      }

      // Check upper bound: A.upper <= B.upper
      if (boundsB.upper !== null) {
        if (boundsA.upper === null || boundsA.upper > boundsB.upper) {
          return false;
        }
      }
    }

    return true;
  }
}

export default GateASTNormalizer;
