/**
 * @file FilterClauseAnalyzer
 * @description Recursively analyzes JSON Logic expressions to break down filter evaluations
 * into detailed trees showing pass/fail status for each clause.
 */

/**
 * FilterClauseAnalyzer class for analyzing JSON Logic filter expressions.
 * Provides detailed breakdowns of filter evaluation results, showing which
 * specific clauses passed or failed during entity filtering.
 *
 * @class
 * @example
 * const logic = { and: [{ '==': [{ var: 'type' }, 'actor'] }, { '>': [{ var: 'level' }, 5] }] };
 * const context = { type: 'actor', level: 3 };
 * const analysis = FilterClauseAnalyzer.analyzeFilter(logic, context, logicEval);
 * console.log(analysis.result); // false
 * console.log(analysis.breakdown); // detailed tree with per-clause results
 */
export class FilterClauseAnalyzer {
  /**
   * Analyze a JSON Logic expression and return detailed breakdown.
   *
   * @param {object} logic - JSON Logic expression to analyze
   * @param {object} evalContext - Evaluation context with variables
   * @param {object} logicEval - JSON Logic evaluator instance (JsonLogicEvaluationService)
   * @returns {{result: boolean, breakdown: object|null, description: string, error?: string}} Analysis result with breakdown tree
   */
  static analyzeFilter(logic, evalContext, logicEval) {
    if (!logic || typeof logic !== 'object') {
      return {
        result: Boolean(logicEval.evaluate(logic, evalContext)),
        breakdown: null,
        description: 'Empty or invalid logic',
      };
    }

    try {
      const result = logicEval.evaluate(logic, evalContext);
      const breakdown = this.#analyzeNode(logic, evalContext, logicEval, []);

      return {
        result,
        breakdown,
        description: this.#describeClause(logic, []),
      };
    } catch (error) {
      return {
        result: false,
        breakdown: null,
        description: `Error evaluating filter: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Recursively analyze a node in the JSON Logic expression tree.
   *
   * @private
   * @param {unknown} node - Current node to analyze
   * @param {object} evalContext - Evaluation context with variables
   * @param {object} logicEval - JSON Logic evaluator instance
   * @param {Array<number>} path - Path in expression tree
   * @returns {object} Node analysis result
   */
  static #analyzeNode(node, evalContext, logicEval, path) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      // Primitive value or array literal
      return {
        type: 'value',
        value: node,
        path,
      };
    }

    const operator = Object.keys(node)[0];
    const args = node[operator];

    // Special case: var operator
    if (operator === 'var') {
      const varName = typeof args === 'string' ? args : args[0];
      const defaultValue = Array.isArray(args) ? args[1] : undefined;
      const value = evalContext[varName] ?? defaultValue;

      return {
        type: 'variable',
        operator: 'var',
        varName,
        value,
        path,
        description: `var("${varName}") = ${this.#formatValue(value)}`,
      };
    }

    // Evaluate this node
    const nodeResult = logicEval.evaluate(node, evalContext);

    // Analyze children recursively
    const children = Array.isArray(args)
      ? args.map((arg, i) =>
          this.#analyzeNode(arg, evalContext, logicEval, [...path, i])
        )
      : [this.#analyzeNode(args, evalContext, logicEval, [...path, 0])];

    return {
      type: 'operator',
      operator,
      result: nodeResult,
      children,
      path,
      description: this.#describeClause(node, path),
    };
  }

  /**
   * Generate a human-readable description for a clause.
   *
   * @private
   * @param {unknown} node - Node to describe
   * @param {Array<number>} path - Path in expression tree
   * @returns {string} Human-readable description
   */
  static #describeClause(node, path) {
    if (typeof node !== 'object' || node === null) {
      return String(node);
    }

    const operator = Object.keys(node)[0];
    const args = node[operator];

    // Operator-specific descriptions
    switch (operator) {
      case 'and':
        return 'All conditions must be true';

      case 'or':
        return 'At least one condition must be true';

      case '==':
        return `${this.#formatValue(args[0])} equals ${this.#formatValue(args[1])}`;

      case '!=':
        return `${this.#formatValue(args[0])} does not equal ${this.#formatValue(args[1])}`;

      case '>':
        return `${this.#formatValue(args[0])} is greater than ${this.#formatValue(args[1])}`;

      case '>=':
        return `${this.#formatValue(args[0])} is greater than or equal to ${this.#formatValue(args[1])}`;

      case '<':
        return `${this.#formatValue(args[0])} is less than ${this.#formatValue(args[1])}`;

      case '<=':
        return `${this.#formatValue(args[0])} is less than or equal to ${this.#formatValue(args[1])}`;

      case 'in':
        return `${this.#formatValue(args[0])} is in ${this.#formatValue(args[1])}`;

      case '!':
        return `NOT (${this.#describeClause(args, [...path, 0])})`;

      case 'not':
        return `NOT (${this.#describeClause(args, [...path, 0])})`;

      case 'var':
        return `variable "${args}"`;

      case 'condition_ref':
        return `condition reference "${args}"`;

      // Custom anatomy operators
      case 'hasPartWithComponentValue':
      case 'hasPartOfType':
      case 'hasPartOfTypeWithComponentValue':
        return `${operator}(${Array.isArray(args) ? args.map((a) => this.#formatValue(a)).join(', ') : this.#formatValue(args)})`;

      // Custom clothing operators
      case 'isSlotExposed':
        return `${operator}(${Array.isArray(args) ? args.map((a) => this.#formatValue(a)).join(', ') : this.#formatValue(args)})`;

      case 'isSocketCovered':
        return `${operator}(${Array.isArray(args) ? args.map((a) => this.#formatValue(a)).join(', ') : this.#formatValue(args)})`;

      // Custom positioning operators
      case 'hasSittingSpaceToRight':
      case 'canScootCloser':
      case 'isClosestLeftOccupant':
      case 'isClosestRightOccupant':
        return `${operator}(${Array.isArray(args) ? args.map((a) => this.#formatValue(a)).join(', ') : this.#formatValue(args)})`;

      default:
        // Generic description for any other operator
        return `${operator}(${Array.isArray(args) ? args.map((a) => this.#formatValue(a)).join(', ') : this.#formatValue(args)})`;
    }
  }

  /**
   * Format a value for display in descriptions.
   *
   * @private
   * @param {unknown} value - Value to format
   * @returns {string} Formatted value string
   */
  static #formatValue(value) {
    if (typeof value === 'object' && value !== null) {
      if ('var' in value) {
        return `var("${value.var}")`;
      }
      if ('condition_ref' in value) {
        return `condition_ref("${value.condition_ref}")`;
      }
      if (Array.isArray(value)) {
        return `[${value.map((v) => this.#formatValue(v)).join(', ')}]`;
      }
      return JSON.stringify(value);
    }

    if (typeof value === 'string') {
      return `"${value}"`;
    }

    return String(value);
  }
}
