/**
 * @file Expression prerequisite validation for JSON Logic structure and var paths.
 */

const DEFAULT_ALLOWED_VAR_ROOTS = new Set([
  'actor',
  'emotions',
  'sexualStates',
  'sexualArousal',
  'moodAxes',
  'affectTraits',
  'previousEmotions',
  'previousSexualStates',
  'previousMoodAxes',
]);

const DEFAULT_MOOD_AXES = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
];

const DEFAULT_AFFECT_TRAITS = [
  'affective_empathy',
  'cognitive_empathy',
  'harm_aversion',
];

const COMPARISON_OPERATORS = new Set([
  '==',
  '===',
  '!=',
  '!==',
  '>',
  '>=',
  '<',
  '<=',
]);

const MOOD_AXES_ROOTS = new Set(['moodAxes', 'previousMoodAxes']);
const NORMALIZED_ROOTS = new Set([
  'emotions',
  'previousEmotions',
  'sexualStates',
  'previousSexualStates',
  'sexualArousal',
]);

const OPERATOR_ARITY_RULES = new Map([
  ['and', { type: 'array', min: 1 }],
  ['or', { type: 'array', min: 1 }],
  ['if', { type: 'array', min: 3 }],
  ['!', { type: 'array', min: 1, max: 1 }],
  ['not', { type: 'array', min: 1, max: 1 }],
  ['!!', { type: 'array', min: 1, max: 1 }],
  ['==', { type: 'array', min: 2 }],
  ['===', { type: 'array', min: 2 }],
  ['!=', { type: 'array', min: 2 }],
  ['!==', { type: 'array', min: 2 }],
  ['>', { type: 'array', min: 2 }],
  ['>=', { type: 'array', min: 2 }],
  ['<', { type: 'array', min: 2 }],
  ['<=', { type: 'array', min: 2 }],
  ['var', { type: 'var' }],
  ['min', { type: 'array', min: 2 }],
  ['max', { type: 'array', min: 2 }],
  ['+', { type: 'array', min: 2 }],
  ['-', { type: 'array', min: 1 }],
  ['*', { type: 'array', min: 2 }],
  ['/', { type: 'array', min: 2 }],
  ['%', { type: 'array', min: 2 }],
  ['in', { type: 'array', min: 2, max: 2 }],
  ['cat', { type: 'array', min: 2 }],
  ['substr', { type: 'array', min: 2, max: 3 }],
  ['missing', { type: 'array', min: 1 }],
  ['missing_some', { type: 'array', min: 2, max: 2 }],
]);

const RANGE_BY_ROOT = new Map([
  ['emotions', { min: 0, max: 1 }],
  ['sexualStates', { min: 0, max: 1 }],
  ['sexualArousal', { min: 0, max: 1 }],
  ['moodAxes', { min: -100, max: 100 }],
  ['affectTraits', { min: 0, max: 100 }],
  ['previousEmotions', { min: 0, max: 1 }],
  ['previousSexualStates', { min: 0, max: 1 }],
  ['previousMoodAxes', { min: -100, max: 100 }],
]);

class ExpressionPrerequisiteValidator {
  #allowedOperations;
  #allowedVarRoots;

  constructor({ allowedOperations, allowedVarRoots } = {}) {
    this.#allowedOperations = allowedOperations
      ? new Set(allowedOperations)
      : null;
    this.#allowedVarRoots = allowedVarRoots
      ? new Set(allowedVarRoots)
      : DEFAULT_ALLOWED_VAR_ROOTS;
  }

  validateExpression(expression, options = {}) {
    const {
      modId = 'unknown',
      source = 'unknown',
      validKeysByRoot = {},
      strictMode = false,
    } = options;
    const expressionId = expression?.id ?? 'unknown';
    const prerequisites = Array.isArray(expression?.prerequisites)
      ? expression.prerequisites
      : [];

    const violations = [];
    const warnings = [];

    const pushIssue = (collection, issue) => {
      collection.push({
        violationType: 'expression_prerequisite',
        modId,
        expressionId,
        source,
        ...issue,
      });
    };

    const recordViolation = (issue) => pushIssue(violations, issue);
    const noteWarning = (issue) => {
      if (strictMode) {
        pushIssue(violations, issue);
      } else {
        pushIssue(warnings, issue);
      }
    };

    prerequisites.forEach((prerequisite, index) => {
      const prerequisiteIndex = index + 1;

      if (!prerequisite || typeof prerequisite !== 'object') {
        pushIssue(violations, {
          issueType: 'missing_logic',
          prerequisiteIndex,
          message: 'Prerequisite entry is missing logic.',
          severity: 'high',
        });
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(prerequisite, 'logic')) {
        pushIssue(violations, {
          issueType: 'missing_logic',
          prerequisiteIndex,
          message: 'Prerequisite is missing logic.',
          severity: 'high',
        });
        return;
      }

      if (
        !prerequisite.logic ||
        typeof prerequisite.logic !== 'object' ||
        Array.isArray(prerequisite.logic)
      ) {
        pushIssue(violations, {
          issueType: 'invalid_logic',
          prerequisiteIndex,
          message: 'Prerequisite logic must be a JSON object.',
          severity: 'high',
        });
        return;
      }

      this.#validateLogicNode(prerequisite.logic, {
        modId,
        expressionId,
        source,
        prerequisiteIndex,
        validKeysByRoot,
        strictMode,
        recordViolation,
        noteWarning,
      });
    });

    return {
      modId,
      expressionId,
      source,
      violations,
      warnings,
    };
  }

  #validateLogicNode(node, context) {
    /* istanbul ignore if -- defensive guard for recursive method */
    if (node === null || node === undefined) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((entry) => this.#validateLogicNode(entry, context));
      return;
    }

    if (typeof node !== 'object') {
      return;
    }

    const keys = Object.keys(node);
    if (keys.length === 0) {
      context.recordViolation({
        issueType: 'invalid_logic',
        prerequisiteIndex: context.prerequisiteIndex,
        message: 'JSON Logic object must include an operator.',
        severity: 'high',
        logicSummary: this.#summarizeLogic(node),
      });
      return;
    }

    if (keys.length !== 1) {
      context.recordViolation({
        issueType: 'invalid_logic',
        prerequisiteIndex: context.prerequisiteIndex,
        message: 'JSON Logic object must include a single operator.',
        severity: 'high',
        logicSummary: this.#summarizeLogic(node),
      });
      return;
    }

    const operator = keys[0];
    const args = node[operator];

    if (this.#allowedOperations && !this.#allowedOperations.has(operator)) {
      context.recordViolation({
        issueType: 'invalid_operator',
        prerequisiteIndex: context.prerequisiteIndex,
        message: `Unsupported JSON Logic operator "${operator}".`,
        severity: 'high',
        logicSummary: this.#summarizeLogic(node),
      });
    }

    if (operator === 'var') {
      this.#validateVarArgs(args, context, node);
    } else {
      this.#validateOperatorArgs(operator, args, context, node);
    }

    if (COMPARISON_OPERATORS.has(operator)) {
      this.#validateComparisonRanges(operator, args, context);
    }

    if (operator === 'max' || operator === 'min') {
      this.#validateMixedScaleOperation(operator, args, context, node);
    }

    if (operator !== 'var') {
      this.#validateLogicNode(args, context);
    }
  }

  #validateOperatorArgs(operator, args, context, node) {
    const rule = OPERATOR_ARITY_RULES.get(operator);
    if (!rule) {
      return;
    }

    if (rule.type === 'array') {
      if (!Array.isArray(args)) {
        context.recordViolation({
          issueType: 'invalid_args',
          prerequisiteIndex: context.prerequisiteIndex,
          message: `Operator "${operator}" expects an array of arguments.`,
          severity: 'high',
          logicSummary: this.#summarizeLogic(node),
        });
        return;
      }

      if (args.length === 0 && (operator === 'and' || operator === 'or')) {
        context.noteWarning({
          issueType: 'vacuous_operator',
          prerequisiteIndex: context.prerequisiteIndex,
          message: `Operator "${operator}" has an empty argument list.`,
          severity: 'low',
          logicSummary: this.#summarizeLogic(node),
        });
        return;
      }

      if (args.length < rule.min || (rule.max && args.length > rule.max)) {
        context.recordViolation({
          issueType: 'invalid_args',
          prerequisiteIndex: context.prerequisiteIndex,
          message: `Operator "${operator}" expects ${this.#formatArity(rule)} arguments.`,
          severity: 'high',
          logicSummary: this.#summarizeLogic(node),
        });
      }
    }
  }

  #validateVarArgs(args, context, node) {
    let path = null;
    if (typeof args === 'string') {
      path = args;
    } else if (Array.isArray(args)) {
      if (args.length === 0) {
        context.recordViolation({
          issueType: 'invalid_args',
          prerequisiteIndex: context.prerequisiteIndex,
          message: 'Operator "var" requires a path.',
          severity: 'high',
          logicSummary: this.#summarizeLogic(node),
        });
        return;
      }

      if (args.length > 2) {
        context.recordViolation({
          issueType: 'invalid_args',
          prerequisiteIndex: context.prerequisiteIndex,
          message: 'Operator "var" supports at most two arguments.',
          severity: 'high',
          logicSummary: this.#summarizeLogic(node),
        });
      }

      if (typeof args[0] === 'string') {
        path = args[0];
      } else {
        context.recordViolation({
          issueType: 'invalid_args',
          prerequisiteIndex: context.prerequisiteIndex,
          message: 'Operator "var" path must be a string.',
          severity: 'high',
          logicSummary: this.#summarizeLogic(node),
        });
        return;
      }
    } else {
      context.recordViolation({
        issueType: 'invalid_args',
        prerequisiteIndex: context.prerequisiteIndex,
        message: 'Operator "var" must be a string or an array.',
        severity: 'high',
        logicSummary: this.#summarizeLogic(node),
      });
      return;
    }

    // Note: At this point, path is always a valid non-empty string because:
    // - If args was a string, path = args (line 312-313)
    // - If args was an array with string[0], path = args[0] (line 336-337)
    // - All other cases return early before reaching here

    const trimmedPath = path.trim();
    if (trimmedPath === '') {
      context.recordViolation({
        issueType: 'invalid_args',
        prerequisiteIndex: context.prerequisiteIndex,
        message: 'Operator "var" path cannot be empty.',
        severity: 'high',
        logicSummary: this.#summarizeLogic(node),
      });
      return;
    }

    const segments = trimmedPath.split('.');
    const root = segments[0];

    if (!this.#allowedVarRoots.has(root)) {
      context.recordViolation({
        issueType: 'invalid_var_root',
        prerequisiteIndex: context.prerequisiteIndex,
        message: `Var path root "${root}" is not allowed.`,
        severity: 'high',
        varPath: trimmedPath,
        logicSummary: this.#summarizeLogic(node),
      });
      return;
    }

    if (root === 'sexualArousal' && segments.length > 1) {
      context.recordViolation({
        issueType: 'invalid_var_path',
        prerequisiteIndex: context.prerequisiteIndex,
        message: 'sexualArousal does not support nested paths.',
        severity: 'high',
        varPath: trimmedPath,
        logicSummary: this.#summarizeLogic(node),
      });
      return;
    }

    const key = segments[1];
    const expectedKeys = this.#resolveExpectedKeys(root, context.validKeysByRoot);
    if (expectedKeys && segments.length < 2) {
      context.recordViolation({
        issueType: 'invalid_var_path',
        prerequisiteIndex: context.prerequisiteIndex,
        message: `Var path "${trimmedPath}" must include a key after "${root}".`,
        severity: 'high',
        varPath: trimmedPath,
        logicSummary: this.#summarizeLogic(node),
      });
      return;
    }

    if (expectedKeys && key && !expectedKeys.has(key)) {
      context.recordViolation({
        issueType: 'unknown_var_key',
        prerequisiteIndex: context.prerequisiteIndex,
        message: `Var path "${trimmedPath}" references unknown key "${key}".`,
        severity: 'high',
        varPath: trimmedPath,
        logicSummary: this.#summarizeLogic(node),
      });
    }
  }

  #validateComparisonRanges(operator, args, context) {
    if (!Array.isArray(args)) {
      return;
    }

    const numericArgs = args.filter((arg) => typeof arg === 'number');
    if (numericArgs.length === 0) {
      // Continue; nested comparisons might include numeric literals.
    }

    const nonNumericArgs = args.filter((arg) => typeof arg !== 'number');
    const directVarPaths = [];
    let hasNonDirectArg = false;
    for (const arg of nonNumericArgs) {
      const varPath = this.#extractVarPath(arg);
      if (!varPath) {
        hasNonDirectArg = true;
        break;
      }
      directVarPaths.push(varPath);
    }

    if (!hasNonDirectArg && directVarPaths.length > 0) {
      for (const varPath of directVarPaths) {
        const root = varPath.split('.')[0];
        const range = RANGE_BY_ROOT.get(root);
        if (!range) {
          continue;
        }

        numericArgs.forEach((value) => {
          if (value < range.min || value > range.max) {
            context.recordViolation({
              issueType: 'range_mismatch',
              prerequisiteIndex: context.prerequisiteIndex,
              message: `Value ${value} is outside expected range for "${root}" (${range.min}..${range.max}).`,
              severity: 'medium',
              varPath,
            });
          }
        });
      }
    }

    const comparisonVarEntries = this.#collectVarPathsWithScales(args);
    const comparisonVarPaths = comparisonVarEntries.map((entry) => entry.path);
    if (comparisonVarPaths.length === 0) {
      return;
    }

    const moodAxesPaths = comparisonVarEntries
      .filter((entry) => MOOD_AXES_ROOTS.has(entry.root))
      .map((entry) => entry.path);
    if (moodAxesPaths.length === 0) {
      return;
    }

    const numericLiterals = this.#collectNumericLiterals(args);
    if (numericLiterals.length === 0) {
      return;
    }

    const logicSummary = this.#summarizeLogic({ [operator]: args });
    const normalizedEntries = comparisonVarEntries.filter((entry) =>
      NORMALIZED_ROOTS.has(entry.root)
    );
    const moodAxesEntries = comparisonVarEntries.filter((entry) =>
      MOOD_AXES_ROOTS.has(entry.root)
    );
    const hasNormalizedRoot = normalizedEntries.length > 0;
    if (
      hasNormalizedRoot &&
      !this.#isMixedScaleComparisonCompatible(
        normalizedEntries,
        moodAxesEntries
      )
    ) {
      context.noteWarning({
        issueType: 'mood_axes_mixed_scale',
        prerequisiteIndex: context.prerequisiteIndex,
        message:
          'Comparison mixes mood axes with normalized roots (emotions or sexual states).',
        severity: 'medium',
        varPath: moodAxesPaths[0],
        logicSummary,
      });
    }

    const skipMoodAxesRangeCheck =
      !hasNonDirectArg &&
      directVarPaths.some((path) => MOOD_AXES_ROOTS.has(path.split('.')[0]));
    numericLiterals.forEach((value) => {
      if (!Number.isInteger(value)) {
        context.recordViolation({
          issueType: 'mood_axes_fractional_threshold',
          prerequisiteIndex: context.prerequisiteIndex,
          message: `Value ${value} must be an integer when comparing mood axes.`,
          severity: 'medium',
          varPath: moodAxesPaths[0],
          logicSummary,
        });
      }

      if (!skipMoodAxesRangeCheck && (value < -100 || value > 100)) {
        context.recordViolation({
          issueType: 'range_mismatch',
          prerequisiteIndex: context.prerequisiteIndex,
          message: `Value ${value} is outside expected range for mood axes (-100..100).`,
          severity: 'medium',
          varPath: moodAxesPaths[0],
          logicSummary,
        });
      }
    });
  }

  #validateMixedScaleOperation(operator, args, context, node) {
    if (!Array.isArray(args)) {
      return;
    }

    const entries = this.#collectVarPathsWithScales(args);
    if (entries.length === 0) {
      return;
    }

    const normalizedEntries = entries.filter((entry) =>
      NORMALIZED_ROOTS.has(entry.root)
    );
    const moodAxesEntries = entries.filter((entry) =>
      MOOD_AXES_ROOTS.has(entry.root)
    );
    if (normalizedEntries.length === 0 || moodAxesEntries.length === 0) {
      return;
    }

    if (
      this.#isMixedScaleComparisonCompatible(
        normalizedEntries,
        moodAxesEntries
      )
    ) {
      return;
    }

    context.noteWarning({
      issueType: 'mood_axes_mixed_scale',
      prerequisiteIndex: context.prerequisiteIndex,
      message: `Operator "${operator}" mixes mood axes with normalized roots (emotions or sexual states).`,
      severity: 'medium',
      varPath: moodAxesEntries[0]?.path,
      logicSummary: this.#summarizeLogic(node),
    });
  }

  #collectVarPathsWithScales(node, scaleFactor = 1, entries = []) {
    /* istanbul ignore if -- defensive guard for recursive method */
    if (node === null || node === undefined) {
      return entries;
    }

    if (Array.isArray(node)) {
      node.forEach((entry) =>
        this.#collectVarPathsWithScales(entry, scaleFactor, entries)
      );
      return entries;
    }

    if (typeof node !== 'object') {
      return entries;
    }

    const directPath = this.#extractVarPath(node);
    if (directPath) {
      entries.push({
        path: directPath,
        root: directPath.split('.')[0],
        scaleFactor,
      });
      return entries;
    }

    const keys = Object.keys(node);
    if (keys.length === 1) {
      const operator = keys[0];
      const args = node[operator];

      if (operator === '*' && Array.isArray(args)) {
        const numericFactors = args.filter((arg) => typeof arg === 'number');
        const multiplier = numericFactors.reduce((acc, value) => acc * value, 1);
        const nextScaleFactor = numericFactors.length
          ? scaleFactor * multiplier
          : scaleFactor;
        args.forEach((arg) => {
          if (typeof arg !== 'number') {
            this.#collectVarPathsWithScales(arg, nextScaleFactor, entries);
          }
        });
        return entries;
      }

      if (operator === '/' && Array.isArray(args)) {
        const [numerator, denominator, ...rest] = args;
        if (typeof denominator === 'number' && denominator !== 0) {
          this.#collectVarPathsWithScales(
            numerator,
            scaleFactor * (1 / denominator),
            entries
          );
          rest.forEach((arg) =>
            this.#collectVarPathsWithScales(arg, scaleFactor, entries)
          );
          return entries;
        }
      }
    }

    Object.values(node).forEach((value) =>
      this.#collectVarPathsWithScales(value, scaleFactor, entries)
    );
    return entries;
  }

  #isMixedScaleComparisonCompatible(normalizedEntries, moodAxesEntries) {
    /* istanbul ignore if -- unreachable: caller guarantees both arrays are non-empty
       (hasNormalizedRoot check ensures normalizedEntries > 0,
        moodAxesPaths.length > 0 check at line 484 ensures moodAxesEntries > 0) */
    if (normalizedEntries.length === 0 || moodAxesEntries.length === 0) {
      return false;
    }

    const normalizedScales = normalizedEntries.map((entry) =>
      Math.abs(entry.scaleFactor)
    );
    const moodAxesScales = moodAxesEntries.map((entry) =>
      Math.abs(entry.scaleFactor)
    );

    const normalizedUp = normalizedScales.every((scale) =>
      this.#isApproximately(scale, 100)
    );
    const moodAxesRaw = moodAxesScales.every((scale) =>
      this.#isApproximately(scale, 1)
    );
    if (normalizedUp && moodAxesRaw) {
      return true;
    }

    const normalizedRaw = normalizedScales.every((scale) =>
      this.#isApproximately(scale, 1)
    );
    const moodAxesDown = moodAxesScales.every((scale) =>
      this.#isApproximately(scale, 0.01)
    );
    return normalizedRaw && moodAxesDown;
  }

  #isApproximately(value, target, tolerance = 1e-6) {
    return Math.abs(value - target) <= tolerance;
  }

  #collectNumericLiterals(node, values = []) {
    /* istanbul ignore if -- defensive guard for recursive method */
    if (node === null || node === undefined) {
      return values;
    }

    if (typeof node === 'number') {
      values.push(node);
      return values;
    }

    if (Array.isArray(node)) {
      node.forEach((entry) => this.#collectNumericLiterals(entry, values));
      return values;
    }

    if (typeof node !== 'object') {
      return values;
    }

    Object.values(node).forEach((value) =>
      this.#collectNumericLiterals(value, values)
    );
    return values;
  }

  #extractVarPath(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return null;
    }

    if (!Object.prototype.hasOwnProperty.call(node, 'var')) {
      return null;
    }

    const value = node.var;
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    return null;
  }

  #resolveExpectedKeys(root, validKeysByRoot) {
    if (root === 'emotions' || root === 'previousEmotions') {
      return validKeysByRoot.emotions || null;
    }
    if (root === 'sexualStates' || root === 'previousSexualStates') {
      return validKeysByRoot.sexualStates || null;
    }
    if (root === 'moodAxes' || root === 'previousMoodAxes') {
      return validKeysByRoot.moodAxes || null;
    }
    if (root === 'affectTraits') {
      return validKeysByRoot.affectTraits || null;
    }

    return null;
  }

  #formatArity(rule) {
    if (rule.min && rule.max && rule.min === rule.max) {
      return `${rule.min}`;
    }
    if (rule.max) {
      return `${rule.min}-${rule.max}`;
    }
    return `at least ${rule.min}`;
  }

  #summarizeLogic(logic) {
    try {
      const serialized = JSON.stringify(logic);
      if (serialized.length <= 160) {
        return serialized;
      }
      return `${serialized.slice(0, 157)}...`;
    } catch /* istanbul ignore next -- defensive catch for circular references */ {
      return '[unserializable logic]';
    }
  }
}

export {
  DEFAULT_ALLOWED_VAR_ROOTS,
  DEFAULT_AFFECT_TRAITS,
  DEFAULT_MOOD_AXES,
  ExpressionPrerequisiteValidator,
};
export default ExpressionPrerequisiteValidator;
