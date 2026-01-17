# Prototype Fit vs Blockers Scope Disambiguation

## Goal

Fix the information-output confusion in Monte Carlo reports where "prototype fit looks clean" can coexist with "AND-block impossible" by:

1. Adding explicit scope metadata to every analysis section
2. Creating a new "Non-axis clause feasibility in mood-regime" section
3. Emitting first-class conflict warnings when fit and feasibility contradict
4. Making clause IDs stable and deterministic

## Problem Statement

Current Monte Carlo reports from `expression-diagnostics.html` mix two different analysis scopes without labeling:

| Analysis | Scope | Population | Signal |
|----------|-------|------------|--------|
| Prototype Fit | Axis constraints only (`moodAxes.*`, `sexualAxes.*`, `affectTraits.*`) | In-regime | Raw |
| Blockers/Pass-rate | Full prerequisites (axes + `emotions.*` + `sexualStates.*` + deltas) | Global & In-regime | Final (post-gate) |

**Result**: Users see contradictory outputs with no explanation of why "fit is clean" but "expression is impossible."

## Current State

### Key Files

| File | Purpose |
|------|---------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Report assembly and section coordination |
| `src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js` | Prototype fit analysis (axis-only, unlabeled) |
| `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js` | Blocker analysis (full-prereqs, unlabeled) |
| `src/expressionDiagnostics/services/ClauseNormalizer.js` | Clause ID and type normalization |
| `src/expressionDiagnostics/utils/moodRegimeUtils.js` | Axis-only constraint extraction |
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | Prototype fit ranking |
| `src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js` | Gate/regime contradiction detection |
| `src/expressionDiagnostics/services/simulatorCore/ExpressionEvaluator.js` | Clause evaluation with tracking |

### Current Limitations

1. **No scope labeling**: Sections don't indicate what data they analyze
2. **No non-axis feasibility**: No dedicated analysis of emotion/sexual clauses within mood regime
3. **No conflict detection**: Contradictions between sections go unexplained
4. **Unstable clause IDs**: May vary across evaluations due to ordering/formatting

## Solution Design

### Architecture Overview

```
MonteCarloReportGenerator
├── PrototypeSectionGenerator        [+ scope metadata: axis_only]
├── BlockerSectionGenerator          [+ scope metadata: full_prereqs]
├── NonAxisFeasibilitySectionGenerator   [NEW]
├── ConflictWarningSectionGenerator      [NEW]
└── Dependencies:
    ├── NonAxisClauseExtractor           [NEW]
    ├── NonAxisFeasibilityAnalyzer       [NEW]
    └── FitFeasibilityConflictDetector   [NEW]
```

### Data Flow

```
Prerequisites ─┬─► extractMoodConstraints() ─► Axis clauses ─► Prototype Fit
               │
               └─► NonAxisClauseExtractor ─► Non-axis clauses ─┬─► In-regime evaluation
                                                               │
                                                               └─► FeasibilityAnalyzer
                                                                        │
                                                                        ▼
                                                               ConflictDetector
                                                                        │
                                                                        ▼
                                                               ConflictWarnings
```

## Implementation Details

### Phase 1: Data Models

#### A. AnalysisScopeMetadata

**File**: `src/expressionDiagnostics/models/AnalysisScopeMetadata.js`

```javascript
/**
 * @typedef {'axis_only' | 'full_prereqs' | 'non_axis_subset'} AnalysisScope
 */

/**
 * @typedef {'global' | 'in_regime'} PopulationType
 */

/**
 * @typedef {'raw' | 'final' | 'delta'} SignalType
 */

/**
 * @typedef {object} AnalysisScopeMetadata
 * @property {AnalysisScope} scope
 * @property {PopulationType} population
 * @property {SignalType} signal
 * @property {string} description - Human-readable explanation
 */

export const SCOPE_METADATA = {
  PROTOTYPE_FIT: {
    scope: 'axis_only',
    population: 'in_regime',
    signal: 'raw',
    description: 'Computed from mood-regime axis constraints only (emotion clauses not enforced).',
  },
  BLOCKER_GLOBAL: {
    scope: 'full_prereqs',
    population: 'global',
    signal: 'final',
    description: 'Computed from ALL prerequisites using post-gate (final) values.',
  },
  BLOCKER_IN_REGIME: {
    scope: 'full_prereqs',
    population: 'in_regime',
    signal: 'final',
    description: 'Computed from ALL prerequisites, restricted to mood-regime samples.',
  },
  NON_AXIS_FEASIBILITY: {
    scope: 'non_axis_subset',
    population: 'in_regime',
    signal: 'final',
    description: 'Evaluates emotion/sexual/delta clauses within mood-regime using final values.',
  },
};
```

#### B. NonAxisClauseFeasibility

**File**: `src/expressionDiagnostics/models/NonAxisClauseFeasibility.js`

```javascript
/**
 * @typedef {'IMPOSSIBLE' | 'RARE' | 'OK'} FeasibilityClassification
 */

/**
 * Classification rules (deterministic):
 * - IMPOSSIBLE: passRate === 0 AND maxValue < threshold - eps
 * - RARE: passRate > 0 AND passRate < rareThreshold (0.001)
 * - OK: otherwise
 */

/**
 * @typedef {object} NonAxisClauseFeasibility
 * @property {string} clauseId - Deterministic identifier (hash of normalized clause)
 * @property {string} sourcePath - Pointer back into prerequisites tree
 * @property {string} varPath - e.g., "emotions.confusion"
 * @property {string} operator - >=, <=, >, <
 * @property {number} threshold
 * @property {'final' | 'raw' | 'delta'} signal
 * @property {'in_regime'} population
 * @property {number} passRate - passCount / inRegimeCount
 * @property {number} maxValue - max(LHS) over in-regime samples
 * @property {number|null} p95Value - 95th percentile (from stored contexts)
 * @property {number} marginMax - maxValue - threshold
 * @property {FeasibilityClassification} classification
 * @property {object} evidence
 * @property {string|null} evidence.bestSampleRef - Sample ID for maxValue
 * @property {string} evidence.note - Short textual explanation
 */
```

#### C. FitFeasibilityConflict

**File**: `src/expressionDiagnostics/models/FitFeasibilityConflict.js`

```javascript
/**
 * @typedef {'fit_vs_clause_impossible' | 'gate_contradiction'} ConflictType
 */

/**
 * @typedef {object} FitFeasibilityConflict
 * @property {ConflictType} type
 * @property {Array<{prototypeId: string, score: number}>} topPrototypes
 * @property {string[]} impossibleClauseIds
 * @property {string} explanation
 * @property {string[]} suggestedFixes
 */
```

### Phase 2: Core Services

#### A. NonAxisClauseExtractor

**File**: `src/expressionDiagnostics/services/NonAxisClauseExtractor.js`

**Purpose**: Extract atomic non-axis clauses from prerequisites (emotions.*, sexualStates.*, deltas).

```javascript
class NonAxisClauseExtractor {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, { requiredMethods: ['debug', 'warn'] });
    this.#logger = logger;
  }

  /**
   * Extract non-axis atomic clauses from prerequisites.
   * @param {Array} prerequisites - Expression prerequisites
   * @returns {AtomicClause[]} Non-axis clauses with normalized structure
   */
  extract(prerequisites) {
    const clauses = [];
    for (let i = 0; i < prerequisites.length; i++) {
      const prereq = prerequisites[i];
      if (!prereq?.logic) continue;
      this.#traverseLogic(prereq.logic, `prereqs[${i}]`, clauses);
    }
    return clauses;
  }

  /**
   * Traverse JSON Logic tree and extract non-axis comparison clauses.
   */
  #traverseLogic(node, path, results) {
    if (!node || typeof node !== 'object') return;

    // Check for comparison operators
    const comparisonOps = ['>=', '>', '<=', '<', '==', '!='];
    for (const op of comparisonOps) {
      if (node[op]) {
        const extracted = this.#extractComparison(node[op], op, path);
        if (extracted && this.#isNonAxisClause(extracted.varPath)) {
          results.push(extracted);
        }
        return;
      }
    }

    // Recurse into compound operators
    for (const compoundOp of ['and', 'or']) {
      if (Array.isArray(node[compoundOp])) {
        node[compoundOp].forEach((child, idx) => {
          this.#traverseLogic(child, `${path}.${compoundOp}[${idx}]`, results);
        });
        return;
      }
    }

    // Handle delta patterns: { "-": [a, b] } inside comparison
    // (already handled when parent comparison is processed)
  }

  /**
   * Extract comparison clause details.
   */
  #extractComparison(args, operator, path) {
    if (!Array.isArray(args) || args.length < 2) return null;

    const [left, right] = args;
    let varPath = null;
    let threshold = null;
    let isDelta = false;

    // Case: { "var": "path" } >= number
    if (left?.var && typeof right === 'number') {
      varPath = left.var;
      threshold = right;
    }
    // Case: number <= { "var": "path" }
    else if (typeof left === 'number' && right?.var) {
      varPath = right.var;
      threshold = left;
    }
    // Case: delta pattern { "-": [current, previous] } >= number
    else if (left?.['-'] && typeof right === 'number') {
      const deltaArgs = left['-'];
      if (deltaArgs?.[0]?.var && deltaArgs?.[1]?.var) {
        varPath = deltaArgs[0].var;
        threshold = right;
        isDelta = true;
      }
    }

    if (!varPath) return null;

    return {
      varPath: this.#canonicalizeVarPath(varPath),
      operator,
      threshold,
      isDelta,
      sourcePath: path,
      clauseType: this.#classifyClauseType(varPath, isDelta),
    };
  }

  /**
   * Check if clause is non-axis (emotion, sexual state, or delta).
   */
  #isNonAxisClause(varPath) {
    const axisPatterns = [
      /^moodAxes\./,
      /^mood\./,
      /^sexualAxes\./,
      /^affectTraits\./,
    ];
    return !axisPatterns.some(pattern => pattern.test(varPath));
  }

  /**
   * Classify clause type.
   */
  #classifyClauseType(varPath, isDelta) {
    if (isDelta) return 'delta';
    if (varPath.startsWith('emotions.') || varPath.startsWith('previousEmotions.')) return 'emotion';
    if (varPath.startsWith('sexualStates.') || varPath.startsWith('previousSexualStates.')) return 'sexual';
    return 'other';
  }

  /**
   * Normalize variable path for consistency.
   */
  #canonicalizeVarPath(varPath) {
    // Normalize mood. alias to moodAxes.
    if (varPath.startsWith('mood.') && !varPath.startsWith('moodAxes.')) {
      return 'moodAxes.' + varPath.slice(5);
    }
    return varPath;
  }
}

export default NonAxisClauseExtractor;
```

#### B. NonAxisFeasibilityAnalyzer

**File**: `src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js`

**Purpose**: Analyze feasibility of non-axis clauses within the mood regime population.

```javascript
class NonAxisFeasibilityAnalyzer {
  #logger;
  #clauseExtractor;
  #eps = 1e-6;
  #rareThreshold = 0.001;

  constructor({ logger, clauseExtractor }) {
    validateDependency(logger, 'ILogger', logger, { requiredMethods: ['debug', 'warn', 'error'] });
    validateDependency(clauseExtractor, 'NonAxisClauseExtractor', logger, { requiredMethods: ['extract'] });
    this.#logger = logger;
    this.#clauseExtractor = clauseExtractor;
  }

  /**
   * Analyze feasibility of non-axis clauses within mood regime.
   * @param {Array} prerequisites - Expression prerequisites
   * @param {Array} inRegimeContexts - Contexts that passed mood constraints
   * @param {string} expressionId - For clauseId generation
   * @returns {NonAxisClauseFeasibility[]}
   */
  analyze(prerequisites, inRegimeContexts, expressionId) {
    const clauses = this.#clauseExtractor.extract(prerequisites);

    if (clauses.length === 0) {
      this.#logger.debug('NonAxisFeasibilityAnalyzer: No non-axis clauses found');
      return [];
    }

    if (!inRegimeContexts || inRegimeContexts.length === 0) {
      this.#logger.warn('NonAxisFeasibilityAnalyzer: No in-regime contexts available for feasibility analysis');
      return clauses.map(clause => this.#createEmptyFeasibility(clause, expressionId));
    }

    return clauses.map(clause => this.#analyzeClause(clause, inRegimeContexts, expressionId));
  }

  /**
   * Analyze a single clause against in-regime contexts.
   */
  #analyzeClause(clause, contexts, expressionId) {
    const stats = {
      passCount: 0,
      maxValue: -Infinity,
      values: [],
      bestSampleIdx: null,
    };

    for (let i = 0; i < contexts.length; i++) {
      const ctx = contexts[i];
      const value = this.#evaluateClauseLHS(clause, ctx);

      if (value === null || value === undefined || Number.isNaN(value)) continue;

      stats.values.push(value);

      if (value > stats.maxValue) {
        stats.maxValue = value;
        stats.bestSampleIdx = i;
      }

      if (this.#clausePasses(clause, value)) {
        stats.passCount++;
      }
    }

    const inRegimeCount = contexts.length;
    const passRate = inRegimeCount > 0 ? stats.passCount / inRegimeCount : 0;
    const p95Value = this.#computePercentile(stats.values, 0.95);
    const marginMax = stats.maxValue - clause.threshold;

    return {
      clauseId: this.#generateClauseId(expressionId, clause),
      sourcePath: clause.sourcePath,
      varPath: clause.varPath,
      operator: clause.operator,
      threshold: clause.threshold,
      signal: clause.isDelta ? 'delta' : 'final',
      population: 'in_regime',
      passRate,
      maxValue: stats.maxValue === -Infinity ? null : stats.maxValue,
      p95Value,
      marginMax: stats.maxValue === -Infinity ? null : marginMax,
      classification: this.#classify(passRate, stats.maxValue, clause.threshold),
      evidence: {
        bestSampleRef: stats.bestSampleIdx !== null ? `sample_${stats.bestSampleIdx}` : null,
        note: this.#generateEvidenceNote(passRate, stats.maxValue, clause.threshold, clause.varPath),
      },
    };
  }

  /**
   * Evaluate the left-hand side of a clause comparison.
   */
  #evaluateClauseLHS(clause, context) {
    const path = clause.varPath;
    const parts = path.split('.');
    let value = context;

    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = value[part];
    }

    return typeof value === 'number' ? value : null;
  }

  /**
   * Check if clause passes for given value.
   */
  #clausePasses(clause, value) {
    switch (clause.operator) {
      case '>=': return value >= clause.threshold;
      case '>': return value > clause.threshold;
      case '<=': return value <= clause.threshold;
      case '<': return value < clause.threshold;
      case '==': return Math.abs(value - clause.threshold) < this.#eps;
      default: return false;
    }
  }

  /**
   * Classify feasibility.
   */
  #classify(passRate, maxValue, threshold) {
    if (passRate === 0 && (maxValue === null || maxValue < threshold - this.#eps)) {
      return 'IMPOSSIBLE';
    }
    if (passRate > 0 && passRate < this.#rareThreshold) {
      return 'RARE';
    }
    return 'OK';
  }

  /**
   * Compute percentile from sorted values.
   */
  #computePercentile(values, percentile) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor(percentile * (sorted.length - 1));
    return sorted[idx];
  }

  /**
   * Generate deterministic clause ID.
   */
  #generateClauseId(expressionId, clause) {
    const normalized = [
      expressionId,
      clause.varPath,
      clause.operator,
      clause.threshold.toFixed(4),
      clause.isDelta ? 'delta' : 'current',
    ].join('|');

    // Simple hash (consider crypto.subtle.digest for production)
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `clause_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Generate human-readable evidence note.
   */
  #generateEvidenceNote(passRate, maxValue, threshold, varPath) {
    if (passRate === 0 && maxValue !== null && maxValue < threshold) {
      const gap = (threshold - maxValue).toFixed(3);
      return `${varPath} >= ${threshold} but max(final)=${maxValue.toFixed(3)} in-regime (${gap} short, 0% pass)`;
    }
    if (passRate < this.#rareThreshold && passRate > 0) {
      return `${varPath} passes rarely (${(passRate * 100).toFixed(2)}% of in-regime samples)`;
    }
    return `${varPath} achievable (${(passRate * 100).toFixed(1)}% pass rate)`;
  }

  /**
   * Create empty feasibility for clauses when no contexts available.
   */
  #createEmptyFeasibility(clause, expressionId) {
    return {
      clauseId: this.#generateClauseId(expressionId, clause),
      sourcePath: clause.sourcePath,
      varPath: clause.varPath,
      operator: clause.operator,
      threshold: clause.threshold,
      signal: clause.isDelta ? 'delta' : 'final',
      population: 'in_regime',
      passRate: null,
      maxValue: null,
      p95Value: null,
      marginMax: null,
      classification: 'UNKNOWN',
      evidence: {
        bestSampleRef: null,
        note: 'No in-regime contexts available for analysis',
      },
    };
  }
}

export default NonAxisFeasibilityAnalyzer;
```

#### C. FitFeasibilityConflictDetector

**File**: `src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js`

```javascript
class FitFeasibilityConflictDetector {
  #logger;
  #fitScoreThreshold = 0.3; // Consider fit "clean" if top prototype score >= this

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, { requiredMethods: ['debug', 'info'] });
    this.#logger = logger;
  }

  /**
   * Detect conflicts between prototype fit and clause feasibility.
   * @param {object} prototypeFitResult - From PrototypeFitRankingService
   * @param {NonAxisClauseFeasibility[]} feasibilityResults
   * @param {object|null} gateAlignmentResult - From PrototypeGateAlignmentAnalyzer
   * @returns {FitFeasibilityConflict[]}
   */
  detect(prototypeFitResult, feasibilityResults, gateAlignmentResult) {
    const conflicts = [];

    // Conflict Type 1: Fit clean but non-axis clause impossible
    const impossibleClauses = (feasibilityResults || []).filter(f => f.classification === 'IMPOSSIBLE');

    if (this.#isFitClean(prototypeFitResult) && impossibleClauses.length > 0) {
      const topPrototypes = this.#extractTopPrototypes(prototypeFitResult);

      conflicts.push({
        type: 'fit_vs_clause_impossible',
        topPrototypes,
        impossibleClauseIds: impossibleClauses.map(c => c.clauseId),
        explanation: this.#buildExplanation(topPrototypes, impossibleClauses),
        suggestedFixes: this.#generateSuggestedFixes(impossibleClauses),
      });
    }

    // Conflict Type 2: Gate contradictions (already detected by PrototypeGateAlignmentAnalyzer)
    if (gateAlignmentResult?.contradictions?.length > 0) {
      conflicts.push({
        type: 'gate_contradiction',
        topPrototypes: this.#extractTopPrototypes(prototypeFitResult),
        impossibleClauseIds: gateAlignmentResult.contradictions.map(c => `gate:${c.emotionId}:${c.axis}`),
        explanation: `${gateAlignmentResult.contradictions.length} prototype gate(s) conflict with mood regime constraints.`,
        suggestedFixes: [
          'Review prototype gate thresholds against mood regime bounds',
          'Consider using a different emotion prototype',
          'Widen mood regime constraints to accommodate gate requirements',
        ],
      });
    }

    return conflicts;
  }

  /**
   * Check if prototype fit is considered "clean" (good fit).
   */
  #isFitClean(prototypeFitResult) {
    if (!prototypeFitResult) return false;

    // Check leaderboard or current prototype analysis
    const topScore = prototypeFitResult.leaderboard?.[0]?.compositeScore
      ?? prototypeFitResult.currentPrototype?.compositeScore
      ?? 0;

    return topScore >= this.#fitScoreThreshold;
  }

  /**
   * Extract top prototypes for conflict report.
   */
  #extractTopPrototypes(prototypeFitResult) {
    if (!prototypeFitResult?.leaderboard) return [];

    return prototypeFitResult.leaderboard.slice(0, 3).map(p => ({
      prototypeId: p.prototypeId,
      score: p.compositeScore,
    }));
  }

  /**
   * Build human-readable explanation.
   */
  #buildExplanation(topPrototypes, impossibleClauses) {
    const protoNames = topPrototypes.map(p => p.prototypeId).join(', ');
    const clauseNames = impossibleClauses.map(c => c.varPath).join(', ');

    return `Mood signature matches prototypes [${protoNames}], but clause(s) [${clauseNames}] cannot be satisfied in-regime on final values.`;
  }

  /**
   * Generate suggested fixes based on impossible clauses.
   */
  #generateSuggestedFixes(impossibleClauses) {
    const fixes = [];

    for (const clause of impossibleClauses) {
      const varName = clause.varPath.split('.').pop();

      // Generic fixes
      fixes.push(`Lower threshold for ${clause.varPath} to <= ${(clause.maxValue ?? 0).toFixed(3)}`);

      // Emotion-specific fixes
      if (clause.varPath.startsWith('emotions.')) {
        fixes.push(`Move ${varName} requirement to previous-state or delta gate`);

        // Confusion/uncertainty specific
        if (varName === 'confusion' || varName === 'uncertainty') {
          fixes.push(`Replace ${varName} with curiosity/interest in current state (more achievable in flow regimes)`);
        }
      }

      // Delta-specific
      if (clause.signal === 'delta') {
        fixes.push(`Reduce delta threshold for ${varName} based on typical change rates`);
      }
    }

    // Deduplicate and limit
    return [...new Set(fixes)].slice(0, 5);
  }
}

export default FitFeasibilityConflictDetector;
```

### Phase 3: Section Generators

#### A. Scope Metadata Header Utility

**File**: `src/expressionDiagnostics/utils/scopeMetadataRenderer.js`

```javascript
import { SCOPE_METADATA } from '../models/AnalysisScopeMetadata.js';

/**
 * Render scope metadata as markdown header.
 * @param {AnalysisScopeMetadata} metadata
 * @returns {string}
 */
export function renderScopeMetadataHeader(metadata) {
  const scopeBadge = getScopeBadge(metadata.scope);
  const populationBadge = getPopulationBadge(metadata.population);

  return [
    `> **[${scopeBadge}]** **[${populationBadge}]**`,
    `> *${metadata.description}*`,
    '',
  ].join('\n');
}

function getScopeBadge(scope) {
  switch (scope) {
    case 'axis_only': return 'AXIS-ONLY FIT';
    case 'full_prereqs': return 'FULL PREREQS';
    case 'non_axis_subset': return 'NON-AXIS ONLY';
    default: return scope.toUpperCase();
  }
}

function getPopulationBadge(population) {
  switch (population) {
    case 'in_regime': return 'IN-REGIME';
    case 'global': return 'GLOBAL';
    default: return population.toUpperCase();
  }
}
```

#### B. NonAxisFeasibilitySectionGenerator

**File**: `src/expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js`

```javascript
import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';
import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';

class NonAxisFeasibilitySectionGenerator {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Generate the Non-Axis Clause Feasibility section.
   * @param {NonAxisClauseFeasibility[]} feasibilityResults
   * @param {number} inRegimeSampleCount
   * @returns {string}
   */
  generate(feasibilityResults, inRegimeSampleCount) {
    if (!feasibilityResults || feasibilityResults.length === 0) {
      return [
        '### Non-Axis Clause Feasibility in Mood-Regime',
        '',
        '*No non-axis clauses (emotions, sexual states, deltas) found in prerequisites.*',
        '',
      ].join('\n');
    }

    const lines = [
      '### Non-Axis Clause Feasibility in Mood-Regime',
      '',
      renderScopeMetadataHeader(SCOPE_METADATA.NON_AXIS_FEASIBILITY),
      '',
      `**Population**: ${inRegimeSampleCount.toLocaleString()} samples in mood regime`,
      '',
      '| Clause | Pass Rate | Max Value | P95 | Margin | Classification |',
      '|--------|-----------|-----------|-----|--------|----------------|',
    ];

    for (const result of feasibilityResults) {
      const emoji = this.#getClassificationEmoji(result.classification);
      const passRateStr = result.passRate !== null
        ? `${(result.passRate * 100).toFixed(2)}%`
        : 'N/A';
      const maxStr = result.maxValue !== null ? result.maxValue.toFixed(3) : 'N/A';
      const p95Str = result.p95Value !== null ? result.p95Value.toFixed(3) : 'N/A';
      const marginStr = result.marginMax !== null ? result.marginMax.toFixed(3) : 'N/A';

      lines.push(
        `| \`${result.varPath} ${result.operator} ${result.threshold}\` | ${passRateStr} | ${maxStr} | ${p95Str} | ${marginStr} | ${emoji} ${result.classification} |`
      );
    }

    // Add detailed explanations for problematic clauses
    const impossible = feasibilityResults.filter(f => f.classification === 'IMPOSSIBLE');
    const rare = feasibilityResults.filter(f => f.classification === 'RARE');

    if (impossible.length > 0) {
      lines.push('', '#### ⛔ Impossible Clauses (0% pass rate)', '');
      for (const clause of impossible) {
        lines.push(`- **\`${clause.clauseId}\`**: ${clause.evidence.note}`);
      }
    }

    if (rare.length > 0) {
      lines.push('', '#### ⚠️ Rare Clauses (<0.1% pass rate)', '');
      for (const clause of rare) {
        lines.push(`- **\`${clause.clauseId}\`**: ${clause.evidence.note}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  #getClassificationEmoji(classification) {
    switch (classification) {
      case 'IMPOSSIBLE': return '⛔';
      case 'RARE': return '⚠️';
      case 'OK': return '✅';
      default: return '❓';
    }
  }
}

export default NonAxisFeasibilitySectionGenerator;
```

#### C. ConflictWarningSectionGenerator

**File**: `src/expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js`

```javascript
class ConflictWarningSectionGenerator {
  #logger;

  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Generate conflict warnings section.
   * @param {FitFeasibilityConflict[]} conflicts
   * @returns {string}
   */
  generate(conflicts) {
    if (!conflicts || conflicts.length === 0) {
      return '';
    }

    const lines = [
      '### ⚠️ Fit vs Feasibility Conflicts',
      '',
      '> **Important**: These conflicts explain why "fit looks clean" can coexist with "impossible" blockers.',
      '> Different analysis sections use different data scopes.',
      '',
    ];

    for (const conflict of conflicts) {
      const typeLabel = this.#formatConflictType(conflict.type);
      const severityEmoji = conflict.type === 'fit_vs_clause_impossible' ? '🚨' : '⚠️';

      lines.push(`#### ${severityEmoji} ${typeLabel}`, '');
      lines.push(conflict.explanation, '');

      if (conflict.topPrototypes?.length > 0) {
        lines.push('**Matching Prototypes**:');
        for (const proto of conflict.topPrototypes) {
          lines.push(`- ${proto.prototypeId}: score ${proto.score.toFixed(3)}`);
        }
        lines.push('');
      }

      if (conflict.impossibleClauseIds?.length > 0) {
        lines.push(`**Impossible Clauses**: ${conflict.impossibleClauseIds.map(id => `\`${id}\``).join(', ')}`, '');
      }

      if (conflict.suggestedFixes?.length > 0) {
        lines.push('**Suggested Fixes**:');
        for (const fix of conflict.suggestedFixes) {
          lines.push(`- ${fix}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  #formatConflictType(type) {
    const labels = {
      'fit_vs_clause_impossible': 'Clean Fit but Impossible Clause',
      'gate_contradiction': 'Gate vs Regime Contradiction',
    };
    return labels[type] ?? type;
  }
}

export default ConflictWarningSectionGenerator;
```

### Phase 4: Report Integration

#### MonteCarloReportGenerator Updates

**File**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

**Changes Required**:

1. Add new dependencies to constructor
2. Call feasibility analyzer after simulation
3. Call conflict detector after fit analysis
4. Generate new sections in report assembly

```javascript
// Constructor additions
constructor({
  // ... existing deps ...
  nonAxisClauseExtractor = null,
  nonAxisFeasibilityAnalyzer = null,
  fitFeasibilityConflictDetector = null,
  nonAxisFeasibilitySectionGenerator = null,
  conflictWarningSectionGenerator = null,
}) {
  // ... existing initialization ...

  this.#nonAxisClauseExtractor = nonAxisClauseExtractor ?? new NonAxisClauseExtractor({ logger: this.#logger });
  this.#nonAxisFeasibilityAnalyzer = nonAxisFeasibilityAnalyzer ?? new NonAxisFeasibilityAnalyzer({
    logger: this.#logger,
    clauseExtractor: this.#nonAxisClauseExtractor,
  });
  this.#fitFeasibilityConflictDetector = fitFeasibilityConflictDetector ?? new FitFeasibilityConflictDetector({
    logger: this.#logger,
  });
  this.#nonAxisFeasibilitySectionGenerator = nonAxisFeasibilitySectionGenerator ?? new NonAxisFeasibilitySectionGenerator({
    logger: this.#logger,
  });
  this.#conflictWarningSectionGenerator = conflictWarningSectionGenerator ?? new ConflictWarningSectionGenerator({
    logger: this.#logger,
  });
}

// In generate() method, after existing analysis:
generate({ expression, simulationResult, moodConstraints, options = {} }) {
  // ... existing code ...

  // NEW: Analyze non-axis clause feasibility
  const inRegimeContexts = this.#filterInRegimeContexts(
    simulationResult.storedContexts ?? [],
    moodConstraints
  );

  const nonAxisFeasibility = this.#nonAxisFeasibilityAnalyzer.analyze(
    expression.prerequisites ?? [],
    inRegimeContexts,
    expression.id
  );

  // NEW: Detect conflicts
  const conflicts = this.#fitFeasibilityConflictDetector.detect(
    prototypeFitResult,
    nonAxisFeasibility,
    gateAlignmentResult
  );

  // ... existing section generation ...

  // NEW: Generate conflict warnings section (insert after prototype section)
  const conflictSection = this.#conflictWarningSectionGenerator.generate(conflicts);

  // NEW: Generate non-axis feasibility section
  const nonAxisSection = this.#nonAxisFeasibilitySectionGenerator.generate(
    nonAxisFeasibility,
    simulationResult.populationSummary?.inRegimeSampleCount ?? 0
  );

  // Assemble report with new sections
  // ...
}
```

### Phase 5: Section Generator Scope Metadata Updates

#### PrototypeSectionGenerator

**File**: `src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js`

Add scope metadata header to each prototype-related section:

```javascript
import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';
import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';

// In generatePrototypeFitSection():
generatePrototypeFitSection(...) {
  const lines = [
    '### Prototype Fit Analysis',
    '',
    renderScopeMetadataHeader(SCOPE_METADATA.PROTOTYPE_FIT),
    '',
    // ... existing content ...
  ];
}
```

#### BlockerSectionGenerator

**File**: `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js`

Add scope metadata header:

```javascript
import { SCOPE_METADATA } from '../../models/AnalysisScopeMetadata.js';
import { renderScopeMetadataHeader } from '../../utils/scopeMetadataRenderer.js';

// In generateBlockerSection():
generateBlockerSection(..., population) {
  const scopeMetadata = population === 'in_regime'
    ? SCOPE_METADATA.BLOCKER_IN_REGIME
    : SCOPE_METADATA.BLOCKER_GLOBAL;

  const lines = [
    `### Blocker Analysis (${population === 'in_regime' ? 'In-Regime' : 'Global'})`,
    '',
    renderScopeMetadataHeader(scopeMetadata),
    '',
    // ... existing content ...
  ];
}
```

### Phase 6: DI Registration

#### Token Definitions

**File**: `src/dependencyInjection/tokens/tokens-diagnostics.js`

```javascript
export const diagnosticsTokens = {
  // ... existing tokens ...

  // New services
  NonAxisClauseExtractor: 'NonAxisClauseExtractor',
  NonAxisFeasibilityAnalyzer: 'NonAxisFeasibilityAnalyzer',
  FitFeasibilityConflictDetector: 'FitFeasibilityConflictDetector',

  // New section generators
  NonAxisFeasibilitySectionGenerator: 'NonAxisFeasibilitySectionGenerator',
  ConflictWarningSectionGenerator: 'ConflictWarningSectionGenerator',
};
```

#### Factory Registrations

**File**: `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

Add factory functions for new services (follow existing patterns).

## Testing Strategy

### Unit Tests

#### NonAxisClauseExtractor.test.js

**File**: `tests/unit/expressionDiagnostics/services/NonAxisClauseExtractor.test.js`

```javascript
describe('NonAxisClauseExtractor', () => {
  describe('extract', () => {
    it('should extract emotion comparison clauses', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } }
      ];
      const clauses = extractor.extract(prereqs);
      expect(clauses).toHaveLength(1);
      expect(clauses[0]).toMatchObject({
        varPath: 'emotions.confusion',
        operator: '>=',
        threshold: 0.25,
        clauseType: 'emotion',
      });
    });

    it('should NOT extract axis constraints', () => {
      const prereqs = [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, -0.5] } }
      ];
      const clauses = extractor.extract(prereqs);
      expect(clauses).toHaveLength(0);
    });

    it('should extract delta clauses', () => {
      const prereqs = [
        {
          logic: {
            '>=': [
              { '-': [{ var: 'emotions.joy' }, { var: 'previousEmotions.joy' }] },
              0.1
            ]
          }
        }
      ];
      const clauses = extractor.extract(prereqs);
      expect(clauses).toHaveLength(1);
      expect(clauses[0].isDelta).toBe(true);
      expect(clauses[0].clauseType).toBe('delta');
    });

    it('should generate stable clause IDs across runs', () => {
      const prereqs = [{ logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } }];
      const clauses1 = extractor.extract(prereqs);
      const clauses2 = extractor.extract(prereqs);
      // IDs should be identical
      expect(clauses1[0].sourcePath).toBe(clauses2[0].sourcePath);
    });
  });
});
```

#### NonAxisFeasibilityAnalyzer.test.js

**File**: `tests/unit/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.test.js`

```javascript
describe('NonAxisFeasibilityAnalyzer', () => {
  describe('analyze', () => {
    it('should classify IMPOSSIBLE when passRate=0 and maxValue < threshold', () => {
      const prereqs = [{ logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } }];
      const contexts = [
        { emotions: { confusion: 0.20 } },
        { emotions: { confusion: 0.23 } },
        { emotions: { confusion: 0.18 } },
      ];

      const results = analyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results).toHaveLength(1);
      expect(results[0].classification).toBe('IMPOSSIBLE');
      expect(results[0].passRate).toBe(0);
      expect(results[0].maxValue).toBe(0.23);
    });

    it('should classify RARE when passRate < 0.001', () => {
      const prereqs = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }];
      const contexts = Array(10000).fill(null).map((_, i) => ({
        emotions: { joy: i === 0 ? 0.51 : 0.3 } // Only 1 passes
      }));

      const results = analyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results[0].classification).toBe('RARE');
      expect(results[0].passRate).toBeCloseTo(0.0001, 4);
    });

    it('should classify OK when passRate >= 0.001', () => {
      const prereqs = [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.3] } }];
      const contexts = Array(100).fill(null).map((_, i) => ({
        emotions: { joy: i < 50 ? 0.4 : 0.2 }
      }));

      const results = analyzer.analyze(prereqs, contexts, 'test_expr');

      expect(results[0].classification).toBe('OK');
      expect(results[0].passRate).toBe(0.5);
    });
  });
});
```

#### FitFeasibilityConflictDetector.test.js

**File**: `tests/unit/expressionDiagnostics/services/FitFeasibilityConflictDetector.test.js`

```javascript
describe('FitFeasibilityConflictDetector', () => {
  describe('detect', () => {
    it('should detect fit_vs_clause_impossible conflict', () => {
      const prototypeFitResult = {
        leaderboard: [
          { prototypeId: 'flow', compositeScore: 0.85 }
        ],
      };
      const feasibilityResults = [
        {
          clauseId: 'clause_abc123',
          varPath: 'emotions.confusion',
          classification: 'IMPOSSIBLE',
        }
      ];

      const conflicts = detector.detect(prototypeFitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('fit_vs_clause_impossible');
      expect(conflicts[0].impossibleClauseIds).toContain('clause_abc123');
      expect(conflicts[0].suggestedFixes.length).toBeGreaterThan(0);
    });

    it('should NOT detect conflict when fit is poor', () => {
      const prototypeFitResult = {
        leaderboard: [
          { prototypeId: 'flow', compositeScore: 0.15 } // Below threshold
        ],
      };
      const feasibilityResults = [
        { clauseId: 'clause_xyz', classification: 'IMPOSSIBLE' }
      ];

      const conflicts = detector.detect(prototypeFitResult, feasibilityResults, null);

      expect(conflicts).toHaveLength(0);
    });
  });
});
```

### Integration Tests

#### Full Report Generation Test

**File**: `tests/integration/expression-diagnostics/fitVsFeasibilityConflict.integration.test.js`

```javascript
describe('Fit vs Feasibility Conflict Integration', () => {
  it('should generate report with conflict warning when fit is clean but clause is impossible', async () => {
    // Fixture: expression with axis constraints that yield strong fit
    // plus emotions.confusion >= 0.25 that is impossible after gating
    const expression = {
      id: 'test:flow_with_impossible_confusion',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 0.3] } },
        { logic: { '<=': [{ var: 'moodAxes.arousal' }, 0.6] } },
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } }, // Impossible in flow
      ],
    };

    const report = await reportGenerator.generate({
      expression,
      simulationResult: mockSimulationResult,
      moodConstraints: extractMoodConstraints(expression.prerequisites),
    });

    // Assert scope metadata present
    expect(report).toContain('[AXIS-ONLY FIT]');
    expect(report).toContain('[FULL PREREQS]');
    expect(report).toContain('Computed from mood-regime axis constraints only');

    // Assert feasibility section present
    expect(report).toContain('### Non-Axis Clause Feasibility');
    expect(report).toContain('emotions.confusion >= 0.25');
    expect(report).toContain('⛔ IMPOSSIBLE');
    expect(report).toContain('passRate');
    expect(report).toContain('maxValue');

    // Assert conflict warning present
    expect(report).toContain('### ⚠️ Fit vs Feasibility Conflicts');
    expect(report).toContain('fit_vs_clause_impossible');
    expect(report).toContain('confusion');
    expect(report).toContain('Suggested Fixes');
  });

  it('should include raw vs final explanation when gate clamps value', async () => {
    // Fixture where raw confusion can exceed threshold but final is clamped
    const expression = {
      id: 'test:gated_confusion',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.confusion' }, 0.25] } },
      ],
    };

    // Mock contexts where raw >= 0.25 but final < 0.25
    const mockContextsWithGating = createMockContextsWithGateClamp();

    const report = await reportGenerator.generate({
      expression,
      simulationResult: { storedContexts: mockContextsWithGating },
      moodConstraints: [],
    });

    // Should indicate the gate/clamp issue
    expect(report).toMatch(/max\(final\)=\d+\.\d+.*in-regime/);
  });
});
```

#### Clause ID Stability Test

**File**: `tests/unit/expressionDiagnostics/services/clauseIdStability.test.js`

```javascript
describe('Clause ID Stability', () => {
  it('should generate identical IDs for same clause across multiple evaluations', () => {
    const expressionId = 'test:stable_id';
    const prereqs = [
      { logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } }
    ];

    const results1 = analyzer.analyze(prereqs, mockContexts, expressionId);
    const results2 = analyzer.analyze(prereqs, mockContexts, expressionId);
    const results3 = analyzer.analyze(prereqs, mockContexts, expressionId);

    expect(results1[0].clauseId).toBe(results2[0].clauseId);
    expect(results2[0].clauseId).toBe(results3[0].clauseId);
  });

  it('should generate different IDs for different clauses', () => {
    const prereqs1 = [{ logic: { '>=': [{ var: 'emotions.anger' }, 0.5] } }];
    const prereqs2 = [{ logic: { '>=': [{ var: 'emotions.anger' }, 0.6] } }]; // Different threshold

    const results1 = analyzer.analyze(prereqs1, mockContexts, 'test:a');
    const results2 = analyzer.analyze(prereqs2, mockContexts, 'test:a');

    expect(results1[0].clauseId).not.toBe(results2[0].clauseId);
  });
});
```

### Snapshot Tests

#### Report Section Snapshots

**File**: `tests/unit/expressionDiagnostics/sectionGenerators/__snapshots__/`

Create snapshots for:
- Prototype section with scope metadata header
- Blocker section with scope metadata header
- Non-axis feasibility section
- Conflict warning section

## Implementation Checklist

### Phase 1: Data Models
- [ ] Create `src/expressionDiagnostics/models/AnalysisScopeMetadata.js`
- [ ] Create `src/expressionDiagnostics/models/NonAxisClauseFeasibility.js`
- [ ] Create `src/expressionDiagnostics/models/FitFeasibilityConflict.js`

### Phase 2: Core Services
- [ ] Create `src/expressionDiagnostics/services/NonAxisClauseExtractor.js`
- [ ] Create `src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js`
- [ ] Create `src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js`
- [ ] Create `src/expressionDiagnostics/utils/scopeMetadataRenderer.js`

### Phase 3: Section Generators
- [ ] Create `src/expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js`
- [ ] Create `src/expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js`
- [ ] Update `PrototypeSectionGenerator.js` with scope metadata header
- [ ] Update `BlockerSectionGenerator.js` with scope metadata header

### Phase 4: Report Integration
- [ ] Update `MonteCarloReportGenerator.js` with new dependencies
- [ ] Add feasibility analysis call in generate()
- [ ] Add conflict detection call in generate()
- [ ] Add new sections to report assembly
- [ ] Add helper method for filtering in-regime contexts

### Phase 5: DI Registration
- [ ] Add tokens to `tokens-diagnostics.js`
- [ ] Add factory registrations to `expressionDiagnosticsRegistrations.js`
- [ ] Update `reportGeneratorFactory.js` if needed

### Phase 6: Testing
- [ ] Create `tests/unit/expressionDiagnostics/services/NonAxisClauseExtractor.test.js`
- [ ] Create `tests/unit/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.test.js`
- [ ] Create `tests/unit/expressionDiagnostics/services/FitFeasibilityConflictDetector.test.js`
- [ ] Create `tests/unit/expressionDiagnostics/sectionGenerators/NonAxisFeasibilitySectionGenerator.test.js`
- [ ] Create `tests/unit/expressionDiagnostics/sectionGenerators/ConflictWarningSectionGenerator.test.js`
- [ ] Create `tests/integration/expression-diagnostics/fitVsFeasibilityConflict.integration.test.js`
- [ ] Update existing section generator tests for scope metadata

### Phase 7: Validation
- [ ] Run `npm run lint` on modified files
- [ ] Run `npm run typecheck`
- [ ] Run `npm run test:unit` - verify all new tests pass
- [ ] Run `npm run test:integration` - verify integration tests pass
- [ ] Manual verification in `expression-diagnostics.html`

## Files to Create

| File | Purpose |
|------|---------|
| `src/expressionDiagnostics/models/AnalysisScopeMetadata.js` | Scope metadata types and constants |
| `src/expressionDiagnostics/models/NonAxisClauseFeasibility.js` | Feasibility result type |
| `src/expressionDiagnostics/models/FitFeasibilityConflict.js` | Conflict warning type |
| `src/expressionDiagnostics/services/NonAxisClauseExtractor.js` | Extract non-axis clauses from prerequisites |
| `src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js` | Analyze feasibility in-regime |
| `src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js` | Detect fit vs feasibility conflicts |
| `src/expressionDiagnostics/utils/scopeMetadataRenderer.js` | Render scope badges/headers |
| `src/expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js` | Generate feasibility section |
| `src/expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js` | Generate conflict warnings |

## Files to Modify

| File | Changes |
|------|---------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Add new dependencies, call analyzers, add sections |
| `src/expressionDiagnostics/services/sectionGenerators/PrototypeSectionGenerator.js` | Add scope metadata header |
| `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js` | Add scope metadata header |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Add new tokens |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Add factory registrations |

## Invariants That Must Pass

1. **Scope truthfulness**: If a section says `scope="axis_only"`, it must not incorporate non-axis clause evaluation
2. **Impossible classification correctness**: `passRate == 0 AND maxValue < threshold - eps`
3. **No silent contradictions**: Any IMPOSSIBLE clause must emit conflict warning or visible banner
4. **Determinism**: Same seed + same inputs ⇒ identical clause IDs, classifications, conflict emission
5. **Signal consistency**: "final" values must match the exact gating pipeline used in simulation

## Design Decisions

### Why separate NonAxisClauseExtractor from existing moodRegimeUtils?

The existing `moodRegimeUtils.js` extracts axis constraints for mood regime definition. Non-axis clauses serve a different purpose (feasibility analysis) and need different extraction logic (emotions, deltas, sexual states). Keeping them separate maintains single responsibility.

### Why generate clauseId via hash rather than path index?

Path indices can change if prerequisite ordering changes. A deterministic hash of (expressionId, varPath, operator, threshold, signal) ensures stable IDs across refactoring, which is critical for:
- UI bookmarks/links
- Test snapshot stability
- Cross-session comparisons

### Why classify as IMPOSSIBLE vs RARE vs OK?

- **IMPOSSIBLE**: Actionable - the clause can never pass, must be redesigned
- **RARE**: Warning - technically possible but unlikely, may need threshold adjustment
- **OK**: No action needed - clause is achievable at reasonable rates

The 0.1% threshold for RARE balances noise reduction with meaningful warnings.

## Open Questions

1. **Raw vs final tracking**: Should we track both `maxRaw` and `maxFinal` for emotion variables to explain gate clamping? (Currently only tracking final)

2. **P95 calculation**: Is the stored context reservoir (typically 10k samples) sufficient for accurate P95 estimates?

3. **UI badge styling**: Should scope badges be CSS classes or inline styles for the markdown renderer?
