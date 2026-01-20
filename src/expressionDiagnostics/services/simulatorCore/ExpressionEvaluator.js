/**
 * @file ExpressionEvaluator.js
 * @description Evaluates JSON Logic expressions with clause tracking and hierarchical analysis
 */

import jsonLogic from 'json-logic-js';
import HierarchicalClauseNode from '../../models/HierarchicalClauseNode.js';
import ClauseNormalizer from '../ClauseNormalizer.js';
import { getEpsilonForVariable } from '../../config/advancedMetricsConfig.js';

class ExpressionEvaluator {
  #gateOutcomeRecorder;
  #jsonLogicService;

  /**
   * @param {Object} [deps]
   * @param {(node: HierarchicalClauseNode, context: object, clausePassed: boolean, inRegime: boolean, gateContextCache: object|null) => void} [deps.gateOutcomeRecorder]
   * @param {import('../../../logic/jsonLogicEvaluationService.js').default} [deps.jsonLogicService] - Optional JsonLogicEvaluationService for validated evaluation
   */
  constructor({ gateOutcomeRecorder, jsonLogicService } = {}) {
    this.#gateOutcomeRecorder = gateOutcomeRecorder ?? null;
    this.#jsonLogicService = jsonLogicService ?? null;
  }

  /**
   * Initialize clause tracking data structure with hierarchical breakdown
   *
   * @param {object} expression
   * @returns {Array}
   */
  initClauseTracking(expression) {
    const clauses = [];
    if (!expression?.prerequisites) return clauses;

    for (let i = 0; i < expression.prerequisites.length; i++) {
      const prereq = expression.prerequisites[i];
      clauses.push({
        clauseIndex: i,
        description: this.#describeClause(prereq),
        failureCount: 0,
        violationSum: 0,
        inRegimeFailureCount: 0,
        inRegimeEvaluationCount: 0,
        hierarchicalTree: this.buildHierarchicalTree(prereq.logic, `${i}`),
      });
    }

    const isSingleClause = clauses.length === 1;
    for (const clause of clauses) {
      if (clause.hierarchicalTree) {
        clause.hierarchicalTree.isSingleClause = isSingleClause;
      }
    }

    return clauses;
  }

  /**
   * Evaluate expression with clause tracking (includes hierarchical breakdown)
   *
   * @param {object} expression - The expression to evaluate
   * @param {object} context - Prebuilt evaluation context
   * @param {Array|null} clauseTracking - Tracking array for clause failures
   * @param {boolean} inRegime - Whether mood constraints passed for this sample
   * @param {object|null} gateContextCache - Cached gate context for the sample
   * @param {Object} [options] - Evaluation options
   * @param {(node: HierarchicalClauseNode, context: object, clausePassed: boolean, inRegime: boolean, gateContextCache: object|null) => void} [options.gateOutcomeRecorder]
   * @returns {{triggered: boolean, clauseResults: Array<{passed: boolean}>|null, atomTruthMap: Map<string, boolean>|null}}
   */
  evaluateWithTracking(
    expression,
    context,
    clauseTracking,
    inRegime,
    gateContextCache,
    options = {}
  ) {
    let clauseResults = null;
    let atomTruthMap = null;

    if (clauseTracking && expression?.prerequisites) {
      clauseResults = [];
      atomTruthMap = new Map();
      const gateOutcomeRecorder =
        options.gateOutcomeRecorder ?? this.#gateOutcomeRecorder;

      for (let i = 0; i < expression.prerequisites.length; i++) {
        const prereq = expression.prerequisites[i];
        const clause = clauseTracking[i];
        let passed;

        if (clause.hierarchicalTree) {
          passed = this.evaluateHierarchicalNode(
            clause.hierarchicalTree,
            context,
            inRegime,
            gateContextCache,
            atomTruthMap,
            gateOutcomeRecorder
          );
          if (!passed) {
            clause.failureCount++;
          }
        } else {
          passed = this.evaluatePrerequisite(prereq, context);
          if (!passed) {
            clause.failureCount++;
            const violation = this.#estimateViolation(prereq, context);
            clause.violationSum += violation;
          }
          if (inRegime) {
            clause.inRegimeEvaluationCount++;
            if (!passed) {
              clause.inRegimeFailureCount++;
            }
          }
        }

        clauseResults.push({ clause, passed });
      }

      for (let i = 0; i < clauseResults.length; i++) {
        const { clause: currentClause, passed: currentPassed } =
          clauseResults[i];

        const othersPassed = clauseResults.every(
          (result, j) => j === i || result.passed
        );

        if (othersPassed && currentClause.hierarchicalTree) {
          currentClause.hierarchicalTree.recordOthersPassed();

          if (!currentPassed) {
            currentClause.hierarchicalTree.recordLastMileFail();
            // Record actual value for sole-blocker percentile analysis
            const logic = currentClause.hierarchicalTree.logic;
            const actualValue = this.#extractActualValue(logic, context);
            if (actualValue !== null) {
              currentClause.hierarchicalTree.recordSoleBlockerValue(actualValue);
            }
          }
        }
      }
    }

    const triggered = this.evaluateAllPrerequisites(expression, context);
    return { triggered, clauseResults, atomTruthMap };
  }

  /**
   * Evaluate a single prerequisite
   *
   * @param {object} prereq
   * @param {object} context
   * @returns {boolean}
   */
  evaluatePrerequisite(prereq, context) {
    try {
      return this.#jsonLogicService
        ? this.#jsonLogicService.evaluate(prereq.logic, context)
        : jsonLogic.apply(prereq.logic, context);
    } catch {
      return false;
    }
  }

  /**
   * Evaluate all prerequisites
   *
   * @param {object} expression
   * @param {object} context
   * @returns {boolean}
   */
  evaluateAllPrerequisites(expression, context) {
    if (!expression?.prerequisites) return true;

    for (const prereq of expression.prerequisites) {
      if (!this.evaluatePrerequisite(prereq, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Finalize clause results with rates and hierarchical breakdown
   *
   * @param {Array} clauseTracking
   * @param {number} sampleCount
   * @returns {Array}
   */
  finalizeClauseResults(clauseTracking, sampleCount) {
    return clauseTracking
      .map((c) => {
        const ceilingData = this.#extractCeilingData(c.hierarchicalTree);
        const leafOnly = c.hierarchicalTree?.nodeType === 'leaf';
        const inRegimeFailureRate =
          c.hierarchicalTree?.inRegimeFailureRate ??
          (c.inRegimeEvaluationCount > 0
            ? c.inRegimeFailureCount / c.inRegimeEvaluationCount
            : null);
        const inRegimePassRate =
          typeof inRegimeFailureRate === 'number'
            ? 1 - inRegimeFailureRate
            : null;
        const achievableRange = leafOnly
          ? {
              min: c.hierarchicalTree?.minObservedValue ?? null,
              max: c.hierarchicalTree?.maxObservedValue ?? null,
            }
          : null;
        const inRegimeAchievableRange = leafOnly
          ? {
              min: c.hierarchicalTree?.inRegimeMinObservedValue ?? null,
              max: c.hierarchicalTree?.inRegimeMaxObservedValue ?? null,
            }
          : null;
        const gatePassRateInRegime = leafOnly
          ? c.hierarchicalTree?.gatePassRateInRegime ?? null
          : null;
        const gateClampRateInRegime = leafOnly
          ? c.hierarchicalTree?.gateClampRateInRegime ?? null
          : null;
        const passRateGivenGateInRegime = leafOnly
          ? c.hierarchicalTree?.passRateGivenGateInRegime ?? null
          : null;
        const gatePassInRegimeCount = leafOnly
          ? c.hierarchicalTree?.gatePassInRegimeCount ?? null
          : null;
        const gateFailInRegimeCount = leafOnly
          ? c.hierarchicalTree?.gateFailInRegimeCount ?? null
          : null;
        const gatePassAndClausePassInRegimeCount = leafOnly
          ? c.hierarchicalTree?.gatePassAndClausePassInRegimeCount ?? null
          : null;
        const gatePassAndClauseFailInRegimeCount = leafOnly
          ? c.hierarchicalTree?.gatePassAndClauseFailInRegimeCount ?? null
          : null;
        const rawPassInRegimeCount = leafOnly
          ? c.hierarchicalTree?.rawPassInRegimeCount ?? null
          : null;
        const lostPassInRegimeCount = leafOnly
          ? c.hierarchicalTree?.lostPassInRegimeCount ?? null
          : null;
        const lostPassRateInRegime = leafOnly
          ? c.hierarchicalTree?.lostPassRateInRegime ?? null
          : null;
        const gatedPassInRegimeCount =
          typeof rawPassInRegimeCount === 'number' &&
          typeof lostPassInRegimeCount === 'number'
            ? rawPassInRegimeCount - lostPassInRegimeCount
            : null;

        return {
          clauseDescription: c.description,
          clauseIndex: c.clauseIndex,
          failureCount: c.failureCount,
          failureRate: c.failureCount / sampleCount,
          inRegimeFailureRate,
          inRegimePassRate,
          averageViolation:
            c.failureCount > 0 ? c.violationSum / c.failureCount : 0,
          violationP50: c.hierarchicalTree?.violationP50 ?? null,
          violationP90: c.hierarchicalTree?.violationP90 ?? null,
          nearMissRate: c.hierarchicalTree?.nearMissRate ?? null,
          nearMissEpsilon: c.hierarchicalTree?.nearMissEpsilon ?? null,
          lastMileFailRate: c.hierarchicalTree?.lastMileFailRate ?? null,
          lastMileContext: {
            othersPassedCount: c.hierarchicalTree?.othersPassedCount ?? 0,
            lastMileFailCount: c.hierarchicalTree?.lastMileFailCount ?? 0,
          },
          isSingleClause: c.hierarchicalTree?.isSingleClause ?? false,
          ceilingGap: ceilingData.ceilingGap,
          maxObserved: ceilingData.maxObserved,
          thresholdValue: ceilingData.thresholdValue,
          achievableRange,
          inRegimeAchievableRange,
          redundantInRegime: leafOnly
            ? c.hierarchicalTree?.redundantInRegime ?? null
            : null,
          tuningDirection: leafOnly
            ? c.hierarchicalTree?.tuningDirection ?? null
            : null,
          gatePassRateInRegime,
          gateClampRateInRegime,
          passRateGivenGateInRegime,
          gatePassInRegimeCount,
          gateFailInRegimeCount,
          gatePassAndClausePassInRegimeCount,
          gatePassAndClauseFailInRegimeCount,
          rawPassInRegimeCount,
          lostPassInRegimeCount,
          lostPassRateInRegime,
          gatedPassInRegimeCount,
          hierarchicalBreakdown: c.hierarchicalTree?.toJSON() ?? null,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Build a hierarchical tracking tree from a JSON Logic expression.
   *
   * @param {object} logic - The JSON Logic object
   * @param {string} pathPrefix - Path prefix for node IDs
   * @param {'and' | 'or' | 'root'} parentNodeType - The parent node's type for context-aware analysis
   * @returns {HierarchicalClauseNode}
   */
  buildHierarchicalTree(logic, pathPrefix = '0', parentNodeType = 'root') {
    if (!logic || typeof logic !== 'object') {
      const clauseMeta = ClauseNormalizer.normalizeLeaf(logic, pathPrefix);
      const node = new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'leaf',
        description: this.#describeLeafCondition(logic),
        logic,
        clauseId: clauseMeta.clauseId,
        clauseType: clauseMeta.clauseType,
      });
      node.parentNodeType = parentNodeType;
      const thresholdInfo = this.#extractThresholdFromLogic(logic);
      if (thresholdInfo) {
        node.setThresholdMetadata(
          thresholdInfo.threshold,
          thresholdInfo.operator,
          thresholdInfo.variablePath
        );
      }
      return node;
    }

    if (logic.and && Array.isArray(logic.and)) {
      const children = logic.and.map((child, i) =>
        this.buildHierarchicalTree(child, `${pathPrefix}.${i}`, 'and')
      );
      const node = new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'and',
        description: `AND of ${logic.and.length} conditions`,
        logic,
        children,
      });
      node.parentNodeType = parentNodeType;
      return node;
    }

    if (logic.or && Array.isArray(logic.or)) {
      const children = logic.or.map((child, i) =>
        this.buildHierarchicalTree(child, `${pathPrefix}.${i}`, 'or')
      );
      const node = new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'or',
        description: `OR of ${logic.or.length} conditions`,
        logic,
        children,
      });
      node.parentNodeType = parentNodeType;
      return node;
    }

    const maxDecomposition = ClauseNormalizer.decomposeMaxClause(logic);
    if (maxDecomposition) {
      const children = maxDecomposition.map((child, i) =>
        this.buildHierarchicalTree(child, `${pathPrefix}.${i}`, 'and')
      );
      const node = new HierarchicalClauseNode({
        id: pathPrefix,
        nodeType: 'and',
        description: `AND of ${children.length} conditions`,
        logic,
        children,
      });
      node.parentNodeType = parentNodeType;
      return node;
    }

    const clauseMeta = ClauseNormalizer.normalizeLeaf(logic, pathPrefix);
    const node = new HierarchicalClauseNode({
      id: pathPrefix,
      nodeType: 'leaf',
      description: this.#describeLeafCondition(logic),
      logic,
      clauseId: clauseMeta.clauseId,
      clauseType: clauseMeta.clauseType,
    });
    node.parentNodeType = parentNodeType;
    const thresholdInfo = this.#extractThresholdFromLogic(logic);
    if (thresholdInfo) {
      node.setThresholdMetadata(
        thresholdInfo.threshold,
        thresholdInfo.operator,
        thresholdInfo.variablePath
      );
    }
    return node;
  }

  /**
   * Recursively evaluate a hierarchical tree node and update stats.
   * Evaluates ALL children (no short-circuit) to collect accurate stats.
   * Also tracks sibling-conditioned stats for leaves within compound nodes.
   *
   * @param {HierarchicalClauseNode} node
   * @param {object} context
   * @param {boolean} inRegime
   * @param {object|null} gateContextCache
   * @param {Map<string, boolean>|null} atomTruthMap
   * @param {(node: HierarchicalClauseNode, context: object, clausePassed: boolean, inRegime: boolean, gateContextCache: object|null) => void} [gateOutcomeRecorder]
   * @returns {boolean}
   */
  evaluateHierarchicalNode(
    node,
    context,
    inRegime,
    gateContextCache,
    atomTruthMap,
    gateOutcomeRecorder
  ) {
    const recorder = gateOutcomeRecorder ?? this.#gateOutcomeRecorder;

    if (node.nodeType === 'leaf') {
      const clauseId = node.clauseId;
      let passed;
      if (atomTruthMap) {
        const cacheKey = clauseId ?? `node:${node.id}`;
        if (atomTruthMap.has(cacheKey)) {
          passed = atomTruthMap.get(cacheKey);
        } else {
          passed = this.evaluateLeafCondition(node.logic, context);
          atomTruthMap.set(cacheKey, passed);
        }
      } else {
        passed = this.evaluateLeafCondition(node.logic, context);
      }
      const violation = passed
        ? 0
        : this.#estimateLeafViolation(node.logic, context);

      const actualValue = this.#extractActualValue(node.logic, context);
      if (actualValue !== null) {
        if (inRegime) {
          node.recordObservedValueInRegime(actualValue);
        } else {
          node.recordObservedValue(actualValue);
        }
      }

      if (actualValue !== null && node.thresholdValue !== null && node.variablePath) {
        const epsilon = getEpsilonForVariable(node.variablePath);
        node.recordNearMiss(actualValue, node.thresholdValue, epsilon);
      }

      node.recordEvaluation(passed, violation);
      if (inRegime) {
        node.recordInRegimeEvaluation(passed);
      }
      if (recorder) {
        recorder(node, context, passed, inRegime, gateContextCache);
      }
      return passed;
    }

    if (node.nodeType === 'and') {
      const childResults = [];
      for (const child of node.children) {
        const childPassed = this.evaluateHierarchicalNode(
          child,
          context,
          inRegime,
          gateContextCache,
          atomTruthMap,
          recorder
        );
        childResults.push({ child, passed: childPassed });
      }

      this.#recordSiblingConditionedStats(childResults);

      const allPassed = childResults.every((r) => r.passed);
      node.recordEvaluation(allPassed);
      if (inRegime) {
        node.recordInRegimeEvaluation(allPassed);
      }
      return allPassed;
    }

    if (node.nodeType === 'or') {
      const childResults = [];
      for (const child of node.children) {
        const childPassed = this.evaluateHierarchicalNode(
          child,
          context,
          inRegime,
          gateContextCache,
          atomTruthMap,
          recorder
        );
        childResults.push({ child, passed: childPassed });
      }

      this.#recordSiblingConditionedStats(childResults);

      const anyPassed = childResults.some((r) => r.passed);
      const passingChildren = anyPassed
        ? childResults.filter((result) => result.passed).map((result) => result.child)
        : [];

      if (anyPassed) {
        if (passingChildren.length === 1) {
          node.recordOrBlockExclusivePass(inRegime);
        }
        if (passingChildren.length > 1) {
          for (let i = 0; i < passingChildren.length; i++) {
            for (let j = i + 1; j < passingChildren.length; j++) {
              node.recordOrPairPass(
                passingChildren[i].id,
                passingChildren[j].id,
                inRegime
              );
            }
          }
        }
        let firstContributorFound = false;
        for (let i = 0; i < childResults.length; i++) {
          const { child, passed } = childResults[i];
          child.recordOrSuccess();
          if (passed) {
            child.recordOrPass();
          }
          if (passed && !firstContributorFound) {
            child.recordOrContribution();
            firstContributorFound = true;
          }
          if (passed) {
            const siblingsFailed = childResults.every(
              (result, j) => j === i || !result.passed
            );
            if (siblingsFailed) {
              child.recordOrExclusivePass();
            }
          }
        }
      }

      node.recordEvaluation(anyPassed);
      if (inRegime) {
        node.recordInRegimeEvaluation(anyPassed);
      }
      return anyPassed;
    }

    try {
      const passed = this.#jsonLogicService
        ? this.#jsonLogicService.evaluate(node.logic, context)
        : jsonLogic.apply(node.logic, context);
      node.recordEvaluation(passed);
      if (inRegime) {
        node.recordInRegimeEvaluation(passed);
      }
      return passed;
    } catch {
      node.recordEvaluation(false);
      if (inRegime) {
        node.recordInRegimeEvaluation(false);
      }
      return false;
    }
  }

  /**
   * Evaluate a leaf condition directly.
   *
   * @param {object} logic
   * @param {object} context
   * @returns {boolean}
   */
  evaluateLeafCondition(logic, context) {
    try {
      return this.#jsonLogicService
        ? this.#jsonLogicService.evaluate(logic, context)
        : jsonLogic.apply(logic, context);
    } catch {
      return false;
    }
  }

  /**
   * Evaluate a threshold condition (helper for sensitivity analysis).
   *
   * @param {number} actual - Actual value from context
   * @param {string} operator - Comparison operator
   * @param {number} threshold - Threshold value
   * @returns {boolean} Whether condition passes
   */
  evaluateThresholdCondition(actual, operator, threshold) {
    switch (operator) {
      case '>=':
        return actual >= threshold;
      case '>':
        return actual > threshold;
      case '<=':
        return actual <= threshold;
      case '<':
        return actual < threshold;
      default:
        return false;
    }
  }

  #describeClause(prerequisite) {
    const logic = prerequisite?.logic;
    if (!logic) return 'Unknown clause';

    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} >= ${right}`;
      }
    }

    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (left?.var && typeof right === 'number') {
        return `${left.var} <= ${right}`;
      }
    }

    if (logic.and || logic.or) {
      const op = logic.and ? 'AND' : 'OR';
      const count = (logic.and || logic.or).length;
      return `${op} of ${count} conditions`;
    }

    return JSON.stringify(logic).substring(0, 50);
  }

  #describeLeafCondition(logic) {
    if (!logic || typeof logic !== 'object') return String(logic);

    const operators = ['>=', '<=', '>', '<', '==', '!='];
    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];
        const leftStr = this.#describeOperand(left);
        const rightStr = this.#describeOperand(right);
        return `${leftStr} ${op} ${rightStr}`;
      }
    }

    return JSON.stringify(logic).substring(0, 60);
  }

  #describeOperand(operand) {
    if (operand === null || operand === undefined) return 'null';
    if (typeof operand === 'number') return String(operand);
    if (typeof operand === 'string') return `"${operand}"`;
    if (operand?.var) return operand.var;

    if (operand['-']) {
      const [a, b] = operand['-'];
      return `(${this.#describeOperand(a)} - ${this.#describeOperand(b)})`;
    }
    if (operand['+']) {
      const [a, b] = operand['+'];
      return `(${this.#describeOperand(a)} + ${this.#describeOperand(b)})`;
    }
    if (operand['*']) {
      const [a, b] = operand['*'];
      return `(${this.#describeOperand(a)} * ${this.#describeOperand(b)})`;
    }
    if (operand['/']) {
      const [a, b] = operand['/'];
      return `(${this.#describeOperand(a)} / ${this.#describeOperand(b)})`;
    }

    return JSON.stringify(operand).substring(0, 30);
  }

  #extractThresholdFromLogic(logic) {
    if (!logic || typeof logic !== 'object') return null;

    const operators = ['>=', '<=', '>', '<', '=='];

    for (const op of operators) {
      if (logic[op] && Array.isArray(logic[op]) && logic[op].length === 2) {
        const [left, right] = logic[op];

        if (left?.var && typeof right === 'number') {
          return {
            threshold: right,
            operator: op,
            variablePath: left.var,
          };
        }

        if (right?.var && typeof left === 'number') {
          return {
            threshold: left,
            operator: this.#reverseOperator(op),
            variablePath: right.var,
          };
        }
      }
    }

    return null;
  }

  #reverseOperator(op) {
    const reverseMap = {
      '>=': '<=',
      '<=': '>=',
      '>': '<',
      '<': '>',
      '==': '==',
    };
    return reverseMap[op] || op;
  }

  #estimateViolation(prereq, context) {
    const logic = prereq?.logic;
    if (!logic) return 0;

    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (left?.var && typeof right === 'number') {
        const actual = this.#getNestedValue(context, left.var);
        if (typeof actual === 'number') {
          return Math.max(0, right - actual);
        }
      }
    }

    return 0.1;
  }

  #getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  #extractCeilingData(tree) {
    if (!tree) {
      return { ceilingGap: null, maxObserved: null, thresholdValue: null };
    }

    if (tree.nodeType === 'leaf') {
      return {
        ceilingGap: tree.ceilingGap,
        maxObserved: tree.maxObservedValue,
        thresholdValue: tree.thresholdValue,
      };
    }

    let worstCeiling = { ceilingGap: null, maxObserved: null, thresholdValue: null };
    let worstGap = -Infinity;

    for (const child of tree.children || []) {
      const childCeiling = this.#extractCeilingData(child);
      if (childCeiling.ceilingGap !== null && childCeiling.ceilingGap > worstGap) {
        worstGap = childCeiling.ceilingGap;
        worstCeiling = childCeiling;
      }
    }

    return worstCeiling;
  }

  #recordSiblingConditionedStats(childResults) {
    for (let i = 0; i < childResults.length; i++) {
      const { child: currentChild, passed: currentPassed } = childResults[i];

      const siblingsPassed = childResults.every(
        (result, j) => j === i || result.passed
      );

      if (siblingsPassed) {
        currentChild.recordSiblingsPassed();
        if (!currentPassed) {
          currentChild.recordSiblingConditionedFail();
        }
      }
    }
  }

  #estimateLeafViolation(logic, context) {
    if (!logic) return 0;

    if (logic['>=']) {
      const [left, right] = logic['>='];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return Math.max(0, threshold - actual);
      }
    }

    if (logic['<=']) {
      const [left, right] = logic['<='];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return Math.max(0, actual - threshold);
      }
    }

    if (logic['<']) {
      const [left, right] = logic['<'];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return actual >= threshold ? actual - threshold + 0.01 : 0;
      }
    }

    if (logic['>']) {
      const [left, right] = logic['>'];
      const actual = this.#resolveValue(left, context);
      const threshold = this.#resolveValue(right, context);
      if (typeof actual === 'number' && typeof threshold === 'number') {
        return actual <= threshold ? threshold - actual + 0.01 : 0;
      }
    }

    return 0.1;
  }

  #resolveValue(expr, context) {
    if (expr?.var) {
      return this.#getNestedValue(context, expr.var);
    }
    if (typeof expr === 'number' || typeof expr === 'string') {
      return expr;
    }
    try {
      return this.#jsonLogicService
        ? this.#jsonLogicService.evaluate(expr, context)
        : jsonLogic.apply(expr, context);
    } catch {
      return expr;
    }
  }

  #extractActualValue(logic, context) {
    if (!logic) return null;

    const operators = ['>=', '<=', '>', '<', '=='];

    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];

        if (left?.var) {
          const value = this.#resolveValue(left, context);
          return typeof value === 'number' ? value : null;
        }

        if (right?.var) {
          const value = this.#resolveValue(right, context);
          return typeof value === 'number' ? value : null;
        }
      }
    }

    return null;
  }
}

export default ExpressionEvaluator;
