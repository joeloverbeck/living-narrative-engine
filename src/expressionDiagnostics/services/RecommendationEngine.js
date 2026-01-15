/**
 * @file RecommendationEngine - Emits deterministic recommendations from DiagnosticFacts.
 */

const SEVERITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

// Prototype create suggestion constants
const DEFAULT_THRESHOLD_T_STAR = 0.55;
const CANDIDATE_SET_SIZE = 10;
const USABLE_GATE_PASS_RATE_MIN = 0.30;
const USABLE_P_AT_LEAST_T_MIN = 0.10;
const USABLE_CONFLICT_RATE_MAX = 0.20;
const IMPROVEMENT_DELTA_MIN = 0.15;
const IMPROVEMENT_BOTH_LOW_THRESHOLD = 0.05;
const GAP_NEAREST_DISTANCE_THRESHOLD = 0.45;
const GAP_PERCENTILE_THRESHOLD = 95;
const SANITY_GATE_PASS_RATE_MIN = 0.20;
const SANITY_MIN_NON_ZERO_WEIGHTS = 3;
const SPAM_BRAKE_DISTANCE_MAX = 0.35;
const SPAM_BRAKE_P_AT_LEAST_T_MIN = 0.15;

const GATE_CLAMP_MIN_RATE = 0.2;
const GATE_CLAMP_MIN_KEEP = 0.5;
const GATE_CLAMP_MIN_DELTA = 0.1;
const CHOKE_GATE_FAIL_RATE = 0.2;
const CHOKE_PASS_GIVEN_GATE_MAX = 0.95;

class RecommendationEngine {
  #prototypeSynthesisService;

  /**
   * @param {object} [options]
   * @param {object} [options.prototypeSynthesisService] - Optional synthesis service for prototype creation recommendations.
   */
  constructor({ prototypeSynthesisService = null } = {}) {
    this.#prototypeSynthesisService = prototypeSynthesisService;
  }

  /**
   * Generate recommendations from DiagnosticFacts.
   *
   * @param {object|null} diagnosticFacts
   * @returns {Array<object>}
   */
  generate(diagnosticFacts) {
    if (!diagnosticFacts) {
      return [];
    }

    const invariants = diagnosticFacts.invariants ?? [];
    const hasInvariantFailure = invariants.some((inv) => inv.ok === false);
    if (hasInvariantFailure) {
      return [];
    }

    const clauses = diagnosticFacts.clauses ?? [];
    if (clauses.length === 0) {
      return [];
    }

    const prototypes = diagnosticFacts.prototypes ?? [];
    if (prototypes.length === 0) {
      return [];
    }

    const topClauses = [...clauses]
      .sort((a, b) => {
        const impactA = typeof a.impact === 'number' ? a.impact : 0;
        const impactB = typeof b.impact === 'number' ? b.impact : 0;
        return (
          impactB - impactA ||
          String(a.clauseId ?? '').localeCompare(String(b.clauseId ?? ''))
        );
      })
      .slice(0, 3);

    const recommendations = [];

    for (const clause of topClauses) {
      const gateClampRecommendation = this.#buildGateClampRecommendation(
        clause
      );
      if (gateClampRecommendation) {
        recommendations.push(gateClampRecommendation);
      }
    }

    const candidates = topClauses.filter((clause) => clause.prototypeId);

    for (const clause of candidates) {
      const prototype = prototypes.find(
        (entry) => entry.prototypeId === clause.prototypeId
      );
      if (!prototype) {
        continue;
      }

      const gateFailRate = prototype.gateFailRate ?? 0;
      const pThreshGivenGate = prototype.pThreshGivenGate ?? 0;
      const meanValueGivenGate = prototype.meanValueGivenGate ?? 0;
      const compatibilityScore = prototype.compatibilityScore ?? 0;
      const thresholdValue = clause.thresholdValue;
      const axisConflicts = this.#normalizeAxisConflicts(
        prototype.axisConflicts
      );
      const lostPassRateInRegime =
        typeof clause.lostPassRateInRegime === 'number'
          ? clause.lostPassRateInRegime
          : null;

      const gateMismatch =
        clause.operator === '>=' &&
        typeof lostPassRateInRegime === 'number' &&
        lostPassRateInRegime >= 0.25;
      const thresholdMismatch =
        typeof thresholdValue === 'number' &&
        pThreshGivenGate <= 0.1 &&
        meanValueGivenGate <= thresholdValue - 0.15;
      const hasBlockingOperator =
        clause.operator === '>=' || clause.operator === '>';
      const chokeType = this.#classifyChokeType({
        prototype,
        clause,
        gateMismatch,
        thresholdMismatch,
      });
      const gateIncompatibility =
        hasBlockingOperator && compatibilityScore <= -0.25;
      const axisSignConflict =
        axisConflicts.length > 0 &&
        hasBlockingOperator &&
        pThreshGivenGate < CHOKE_PASS_GIVEN_GATE_MAX &&
        (chokeType === 'threshold' || chokeType === 'mixed');

      if (
        !gateMismatch &&
        !thresholdMismatch &&
        !gateIncompatibility &&
        !axisSignConflict
      ) {
        continue;
      }

      const moodSampleCount = prototype.moodSampleCount ?? 0;
      const confidence = this.#getConfidence(moodSampleCount);
      const impact = typeof clause.impact === 'number' ? clause.impact : 0;

      if (gateMismatch || thresholdMismatch) {
        const evidence = this.#buildEvidence({
          prototype,
          clause,
          gateMismatch,
          chokeType,
        });

        const whyParts = [
          'Prototype-linked clause is a top-3 impact choke.',
        ];
        if (gateMismatch) {
          whyParts.push('Lost-pass rate exceeds 25%.');
        }
        if (thresholdMismatch) {
          whyParts.push(
            'Pass|gate and mean value trail the clause threshold.'
          );
        }
        if (confidence === 'low') {
          whyParts.push(
            `Low confidence due to limited mood samples (N=${moodSampleCount}).`
          );
        }

        recommendations.push({
          id: `prototype_mismatch:${clause.prototypeId}:${clause.clauseId}`,
          type: 'prototype_mismatch',
          severity: this.#getSeverity(impact),
          confidence,
          title: 'Prototype structurally mismatched',
          why: whyParts.join(' '),
          evidence,
          actions: this.#buildActions({
            gateMismatch,
            thresholdMismatch,
          }),
          predictedEffect:
            'Reduce mismatch to improve trigger rate and stability.',
          relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
          chokeType,
        });
      }

      if (gateIncompatibility) {
        const evidence = this.#buildEvidence({
          prototype,
          clause,
          gateMismatch,
          gateIncompatibility,
          compatibilityScore,
          chokeType: 'gate',
        });
        const whyParts = [
          'Prototype-linked clause is a top-3 impact choke.',
          'Gate compatibility indicates the regime blocks this prototype.',
          'Prototype values are always clamped to 0 in the regime.',
        ];
        if (confidence === 'low') {
          whyParts.push(
            `Low confidence due to limited mood samples (N=${moodSampleCount}).`
          );
        }

        recommendations.push({
          id: `gate_incompatibility:${clause.prototypeId}:${clause.clauseId}`,
          type: 'gate_incompatibility',
          severity: this.#getSeverity(impact),
          confidence,
          title: 'Prototype gate incompatible with regime',
          why: whyParts.join(' '),
          evidence,
          actions: this.#buildGateIncompatibilityActions(),
          predictedEffect:
            'Align gate constraints to allow the prototype to activate.',
          relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
          chokeType: 'gate',
        });
      }

      if (axisSignConflict) {
        const evidence = [
          ...this.#buildAxisConflictEvidence(
            axisConflicts,
            prototype.moodSampleCount
          ),
          ...this.#buildEvidence({ prototype, clause, chokeType }),
        ];
        const conflictSummary = axisConflicts
          .map((conflict) => `${conflict.axis} (${conflict.conflictType})`)
          .join(', ');
        const whyParts = [
          'Prototype-linked clause is a top-3 impact choke.',
          'Axis sign conflicts indicate regime constraints oppose prototype weights.',
          `Conflicts: ${conflictSummary}.`,
        ];
        if (confidence === 'low') {
          whyParts.push(
            `Low confidence due to limited mood samples (N=${moodSampleCount}).`
          );
        }

        recommendations.push({
          id: `axis_sign_conflict:${clause.prototypeId}:${clause.clauseId}`,
          type: 'axis_sign_conflict',
          severity: this.#getAxisConflictSeverity({
            axisConflicts,
            clause,
            impact,
          }),
          confidence,
          title: 'Prototype axis sign conflict',
          why: whyParts.join(' '),
          evidence,
          actions: this.#buildAxisSignConflictActions(axisConflicts),
          predictedEffect:
            'Reduce opposing constraints to align prototype weights with the regime.',
          relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
          chokeType,
        });
      }
    }

    // Prototype create suggestion
    const prototypeCreateSuggestion =
      this.#buildPrototypeCreateSuggestion(diagnosticFacts);
    if (prototypeCreateSuggestion) {
      recommendations.push(prototypeCreateSuggestion);
    }

    return recommendations.sort((a, b) => {
      const severityDiff =
        (SEVERITY_ORDER[a.severity] ?? 99) -
        (SEVERITY_ORDER[b.severity] ?? 99);
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const impactA = this.#getImpactFromId(a.id, clauses);
      const impactB = this.#getImpactFromId(b.id, clauses);
      if (impactB !== impactA) {
        return impactB - impactA;
      }

      return String(a.id).localeCompare(String(b.id));
    });
  }

  #buildGateClampRecommendation(clause) {
    const gateClampFacts = clause?.gateClampRegimePermissive;
    if (!gateClampFacts) {
      return null;
    }

    const gateClampRate = gateClampFacts.gateClampRateInRegime;
    if (typeof gateClampRate !== 'number') {
      return null;
    }
    if (gateClampRate < GATE_CLAMP_MIN_RATE) {
      return null;
    }
    if (gateClampFacts.allGatesImplied) {
      return null;
    }

    const candidate = this.#selectGateClampCandidate(gateClampFacts);
    if (!candidate) {
      return null;
    }

    const moodRegimeCount =
      typeof gateClampFacts.moodRegimeCount === 'number'
        ? gateClampFacts.moodRegimeCount
        : 0;
    const confidence = this.#getConfidence(moodRegimeCount);
    const impact = typeof clause.impact === 'number' ? clause.impact : 0;

    const whyParts = [
      'Mood regime admits gate-clamped states for this clause.',
      `Gate clamp rate is ${(gateClampRate * 100).toFixed(1)}%.`,
      `Candidate constraint keeps ${(candidate.keepRatio * 100).toFixed(
        1
      )}% of regime samples.`,
    ];
    if (confidence === 'low') {
      whyParts.push(
        `Low confidence due to limited mood samples (N=${moodRegimeCount}).`
      );
    }

    return {
      id: `gate_clamp_regime_permissive:${clause.clauseId ?? 'unknown'}:${candidate.id}`,
      type: 'gate_clamp_regime_permissive',
      severity: this.#getSeverity(impact),
      confidence,
      title: 'Mood regime allows gate-clamped states',
      why: whyParts.join(' '),
      evidence: this.#buildGateClampEvidence(gateClampFacts, candidate),
      actions: this.#buildGateClampActions(candidate),
      predictedEffect:
        'Reduce gate clamp frequency while preserving regime coverage.',
      relatedClauseIds: clause.clauseId ? [clause.clauseId] : [],
    };
  }

  #getConfidence(moodSampleCount) {
    if (moodSampleCount >= 500) {
      return 'high';
    }
    if (moodSampleCount >= 200) {
      return 'medium';
    }
    return 'low';
  }

  #selectGateClampCandidate(gateClampFacts) {
    const clampRate = gateClampFacts?.gateClampRateInRegime;
    if (typeof clampRate !== 'number') {
      return null;
    }

    const candidates = Array.isArray(gateClampFacts.candidates)
      ? gateClampFacts.candidates
      : [];
    const eligible = candidates.filter((candidate) =>
      this.#candidateMeetsGateClampThresholds(candidate, clampRate, gateClampFacts)
    );

    if (eligible.length === 0) {
      return null;
    }

    return eligible
      .slice()
      .sort((a, b) => {
        const clampA =
          typeof a.predClampRate === 'number' ? a.predClampRate : 1;
        const clampB =
          typeof b.predClampRate === 'number' ? b.predClampRate : 1;
        if (clampA !== clampB) {
          return clampA - clampB;
        }
        const keepA = typeof a.keepRatio === 'number' ? a.keepRatio : -1;
        const keepB = typeof b.keepRatio === 'number' ? b.keepRatio : -1;
        if (keepB !== keepA) {
          return keepB - keepA;
        }
        return String(a.id).localeCompare(String(b.id));
      })[0];
  }

  #candidateMeetsGateClampThresholds(candidate, clampRate, gateClampFacts) {
    if (!candidate || typeof clampRate !== 'number') {
      return false;
    }
    if (
      typeof candidate.keepRatio !== 'number' ||
      typeof candidate.predClampRate !== 'number'
    ) {
      return false;
    }
    if (candidate.keepRatio < GATE_CLAMP_MIN_KEEP) {
      return false;
    }
    if (candidate.predClampRate > clampRate - GATE_CLAMP_MIN_DELTA) {
      return false;
    }
    return this.#candidateTightensRegime(
      candidate,
      gateClampFacts?.gatePredicates
    );
  }

  #candidateTightensRegime(candidate, gatePredicates) {
    if (!candidate || !Array.isArray(candidate.axes)) {
      return false;
    }

    const boundsByAxis = new Map();
    for (const predicate of gatePredicates ?? []) {
      if (predicate?.axis && predicate.regimeBounds) {
        boundsByAxis.set(predicate.axis, predicate.regimeBounds);
      }
    }

    let tightens = false;
    for (const axisConstraint of candidate.axes) {
      const axis = axisConstraint?.axis;
      const operator = axisConstraint?.operator;
      const threshold = axisConstraint?.thresholdRaw;
      if (
        typeof axis !== 'string' ||
        typeof operator !== 'string' ||
        typeof threshold !== 'number'
      ) {
        return false;
      }

      const bounds = boundsByAxis.get(axis);
      if (
        !bounds ||
        typeof bounds.min !== 'number' ||
        typeof bounds.max !== 'number'
      ) {
        tightens = true;
        continue;
      }

      if (this.#constraintTightensBounds(bounds, operator, threshold)) {
        tightens = true;
      }
    }

    return tightens;
  }

  #constraintTightensBounds(bounds, operator, threshold) {
    const min = bounds.min;
    const max = bounds.max;

    switch (operator) {
      case '>=':
        return threshold > min;
      case '>':
        return threshold + Number.EPSILON > min;
      case '<=':
        return threshold < max;
      case '<':
        return threshold - Number.EPSILON < max;
      case '==':
        return !(min >= threshold && max <= threshold);
      default:
        return false;
    }
  }

  #buildGateClampEvidence(gateClampFacts, candidate) {
    const evidence = [];
    const moodRegimeCount =
      typeof gateClampFacts.moodRegimeCount === 'number'
        ? gateClampFacts.moodRegimeCount
        : null;
    const gateFail = gateClampFacts.gateFailInRegimeCount;
    const gatePass = gateClampFacts.gatePassInRegimeCount;
    if (typeof gateFail === 'number' && typeof moodRegimeCount === 'number') {
      evidence.push({
        label: 'Gate clamp rate (mood regime)',
        numerator: gateFail,
        denominator: moodRegimeCount,
        value: gateClampFacts.gateClampRateInRegime ?? 0,
        population: this.#buildPopulation('mood-regime', moodRegimeCount),
      });
    }

    if (
      typeof candidate.keepRatio === 'number' &&
      typeof candidate.keepCount === 'number' &&
      typeof candidate.keepDenominator === 'number'
    ) {
      evidence.push({
        label: 'Keep ratio for proposed constraint',
        numerator: candidate.keepCount,
        denominator: candidate.keepDenominator,
        value: candidate.keepRatio,
        population: this.#buildPopulation(
          'mood-regime',
          candidate.keepDenominator
        ),
      });
    }

    if (
      typeof candidate.predClampRate === 'number' &&
      typeof candidate.predSampleCount === 'number'
    ) {
      const predClampCount = Math.round(
        candidate.predClampRate * candidate.predSampleCount
      );
      evidence.push({
        label: 'Predicted gate clamp rate (post-constraint)',
        numerator: predClampCount,
        denominator: candidate.predSampleCount,
        value: candidate.predClampRate,
        population: this.#buildPopulation(
          'mood-regime',
          candidate.predSampleCount
        ),
      });
    }

    if (typeof gatePass === 'number' && typeof moodRegimeCount === 'number') {
      evidence.push({
        label: 'Gate pass count (mood regime)',
        numerator: gatePass,
        denominator: moodRegimeCount,
        value: moodRegimeCount > 0 ? gatePass / moodRegimeCount : 0,
        population: this.#buildPopulation('mood-regime', moodRegimeCount),
      });
    }

    for (const axisEvidence of gateClampFacts.axisEvidence ?? []) {
      const axis = axisEvidence?.axis ?? 'unknown';
      const operator = axisEvidence?.operator ?? '?';
      const threshold =
        typeof axisEvidence?.thresholdRaw === 'number'
          ? axisEvidence.thresholdRaw
          : 'n/a';
      const labelSuffix = `${axis} ${operator} ${threshold}`;

      if (axisEvidence?.fractionBelow) {
        const denominator =
          typeof axisEvidence.fractionBelow.denominator === 'number'
            ? axisEvidence.fractionBelow.denominator
            : typeof moodRegimeCount === 'number'
              ? moodRegimeCount
              : 0;
        evidence.push({
          label: `Axis below gate (${labelSuffix})`,
          numerator: axisEvidence.fractionBelow.count ?? 0,
          denominator,
          value: axisEvidence.fractionBelow.rate ?? null,
          population: this.#buildPopulation('mood-regime', denominator),
        });
      }

      if (axisEvidence?.fractionAbove) {
        const denominator =
          typeof axisEvidence.fractionAbove.denominator === 'number'
            ? axisEvidence.fractionAbove.denominator
            : typeof moodRegimeCount === 'number'
              ? moodRegimeCount
              : 0;
        evidence.push({
          label: `Axis above gate (${labelSuffix})`,
          numerator: axisEvidence.fractionAbove.count ?? 0,
          denominator,
          value: axisEvidence.fractionAbove.rate ?? null,
          population: this.#buildPopulation('mood-regime', denominator),
        });
      }
    }

    return evidence;
  }

  #buildGateClampActions(candidate) {
    const axes = Array.isArray(candidate?.axes) ? candidate.axes : [];
    const axisHints = axes
      .map((axis) => {
        if (!axis) {
          return null;
        }
        const threshold =
          typeof axis.thresholdRaw === 'number' ? axis.thresholdRaw : 'n/a';
        return `${axis.axis} ${axis.operator ?? '?'} ${threshold}`;
      })
      .filter(Boolean)
      .join(', ');

    const actions = [
      'Tighten mood-regime axis constraints that allow gate-clamped states.',
    ];
    if (axisHints) {
      actions.push(`Add regime bounds aligned with gate predicates: ${axisHints}.`);
    }
    actions.push(
      'If the regime cannot be tightened safely, revisit gate thresholds instead.'
    );

    return Array.from(new Set(actions));
  }

  #getSeverity(impact) {
    if (impact >= 0.2) {
      return 'high';
    }
    if (impact >= 0.1) {
      return 'medium';
    }
    return 'low';
  }

  #buildEvidence({
    prototype,
    clause,
    gateMismatch,
    gateIncompatibility = false,
    compatibilityScore = 0,
    chokeType = 'mixed',
  }) {
    const moodSampleCount = prototype.moodSampleCount ?? 0;
    const gateFailCount = prototype.gateFailCount ?? 0;
    const gatePassCount = prototype.gatePassCount ?? 0;
    const thresholdPassCount = prototype.thresholdPassCount ?? 0;
    const pThreshGivenGate = prototype.pThreshGivenGate ?? 0;
    const gateFailRate = prototype.gateFailRate ?? 0;
    const meanValueGivenGate = prototype.meanValueGivenGate ?? null;
    const rawPassInRegimeCount = clause.rawPassInRegimeCount ?? null;
    const lostPassInRegimeCount = clause.lostPassInRegimeCount ?? null;

    const evidence = [];
    const includeGate = chokeType === 'gate' || chokeType === 'mixed';
    const includeThreshold =
      chokeType === 'threshold' || chokeType === 'mixed';

    if (includeGate) {
      evidence.push({
        label: 'Gate fail rate',
        numerator: gateFailCount,
        denominator: moodSampleCount,
        value: gateFailRate,
        population: this.#buildPopulation('mood-regime', moodSampleCount),
      });

      if (gateMismatch) {
        if (
          typeof rawPassInRegimeCount === 'number' &&
          typeof lostPassInRegimeCount === 'number' &&
          rawPassInRegimeCount > 0
        ) {
          evidence.push({
            label: 'Lost passes | raw >= threshold',
            numerator: lostPassInRegimeCount,
            denominator: rawPassInRegimeCount,
            value: lostPassInRegimeCount / rawPassInRegimeCount,
            population: this.#buildPopulation(
              'mood-regime',
              rawPassInRegimeCount
            ),
          });
        }
        const failedGateCounts = prototype.failedGateCounts ?? [];
        if (failedGateCounts.length > 0 && gateFailCount > 0) {
          const topGate = failedGateCounts[0];
          evidence.push({
            label: `Most failed gate: ${topGate.gateId}`,
            numerator: topGate.count ?? 0,
            denominator: gateFailCount,
            value:
              gateFailCount > 0 ? (topGate.count ?? 0) / gateFailCount : 0,
            population: this.#buildPopulation('mood-regime', gateFailCount),
          });
        }
      }

      if (gateIncompatibility) {
        evidence.push({
          label: 'Gate compatibility',
          numerator: compatibilityScore,
          denominator: 1,
          value: compatibilityScore,
          population: this.#buildPopulation('mood-regime', moodSampleCount),
        });
      }
    }

    if (includeThreshold) {
      evidence.push({
        label: 'Pass | gate',
        numerator: thresholdPassCount,
        denominator: gatePassCount,
        value: pThreshGivenGate,
        population: this.#buildPopulation(
          'gate-pass (mood-regime)',
          gatePassCount
        ),
      });

      if (typeof meanValueGivenGate === 'number') {
        evidence.push({
          label: 'Mean value | gate',
          numerator: meanValueGivenGate,
          denominator: 1,
          value: meanValueGivenGate,
          population: this.#buildPopulation(
            'gate-pass (mood-regime)',
            gatePassCount
          ),
        });
      }

      if (typeof clause.thresholdValue === 'number') {
        evidence.push({
          label: 'Clause threshold',
          numerator: clause.thresholdValue,
          denominator: 1,
          value: clause.thresholdValue,
          population: this.#buildPopulation('mood-regime', moodSampleCount),
        });
      }
    }

    return evidence;
  }

  #buildActions({ gateMismatch, thresholdMismatch }) {
    const actions = [];
    if (gateMismatch) {
      actions.push(
        'Tighten mood-regime axis constraints that allow gate-clamped states.'
      );
      actions.push('Loosen prototype gate thresholds or swap the prototype.');
    }
    if (thresholdMismatch) {
      actions.push(
        'Lower the prototype threshold or rebalance weights to raise values.'
      );
    }

    if (actions.length === 0) {
      actions.push('Review prototype gating and threshold alignment.');
    }

    return Array.from(new Set(actions));
  }

  #buildGateIncompatibilityActions() {
    return [
      'Regime makes the gate impossible; adjust gate inputs or swap prototype.',
    ];
  }

  #normalizeAxisConflicts(axisConflicts) {
    if (!Array.isArray(axisConflicts)) {
      return [];
    }
    return axisConflicts.filter((conflict) => conflict?.conflictType);
  }

  #buildAxisConflictEvidence(axisConflicts, moodSampleCount) {
    return axisConflicts.slice(0, 3).map((conflict) => {
      const weightValue =
        typeof conflict.weight === 'number' ? conflict.weight : null;
      const weightLabel =
        typeof weightValue === 'number'
          ? `${weightValue >= 0 ? '+' : ''}${weightValue.toFixed(2)}`
          : 'n/a';
      const range =
        typeof conflict.constraintMin === 'number' &&
        typeof conflict.constraintMax === 'number'
          ? `[${conflict.constraintMin.toFixed(2)}, ${conflict.constraintMax.toFixed(2)}]`
          : 'n/a';
      const lostRawSum = Number.isFinite(conflict.lostRawSum)
        ? conflict.lostRawSum
        : null;
      const lostIntensity = Number.isFinite(conflict.lostIntensity)
        ? conflict.lostIntensity
        : null;
      const lostRawLabel =
        typeof lostRawSum === 'number' ? lostRawSum.toFixed(2) : 'n/a';
      const lostIntensityLabel =
        typeof lostIntensity === 'number' ? lostIntensity.toFixed(2) : 'n/a';
      return {
        label:
          `Axis conflict (${conflict.conflictType}): ` +
          `${conflict.axis} weight ${weightLabel}, ` +
          `regime ${range}, ` +
          `lostRawSum ${lostRawLabel}, ` +
          `lostIntensity ${lostIntensityLabel}`,
        numerator: lostRawSum,
        denominator: 1,
        value: lostIntensity,
        axis: conflict.axis,
        weight: weightValue,
        constraintMin: conflict.constraintMin,
        constraintMax: conflict.constraintMax,
        lostRawSum,
        lostIntensity,
        sources: Array.isArray(conflict.sources) ? conflict.sources : [],
        population: this.#buildPopulation('mood-regime', moodSampleCount),
      };
    });
  }

  #buildPopulation(name, count) {
    if (typeof name !== 'string' || name.length === 0) {
      return null;
    }
    if (typeof count !== 'number' || Number.isNaN(count)) {
      return { name, count: null };
    }
    return { name, count };
  }

  #buildAxisSignConflictActions(axisConflicts) {
    const sourceTexts = new Set();
    for (const conflict of axisConflicts ?? []) {
      for (const source of conflict?.sources ?? []) {
        const varPath = source?.varPath;
        const operator = source?.operator;
        const threshold =
          typeof source?.threshold === 'number'
            ? source.threshold
            : source?.threshold ?? null;
        if (!varPath || !operator) {
          continue;
        }
        const thresholdText =
          typeof threshold === 'number' ? threshold : 'n/a';
        sourceTexts.add(`${varPath} ${operator} ${thresholdText}`);
      }
    }

    const actions = [];
    if (sourceTexts.size > 0) {
      actions.push(
        `Relax regime axis bound(s) created by: ${[...sourceTexts].join(', ')}.`
      );
    } else {
      actions.push('Relax the regime axis bounds that oppose the prototype weight.');
    }
    actions.push(
      'Adjust prototype weights by moving weight toward 0 or reducing magnitude.'
    );
    return actions;
  }

  #getAxisConflictSeverity({ axisConflicts, clause, impact }) {
    const threshold = clause?.thresholdValue;
    const lostIntensity = this.#getMaxLostIntensity(axisConflicts);
    if (
      typeof threshold !== 'number' ||
      threshold <= 0 ||
      typeof lostIntensity !== 'number'
    ) {
      return this.#getSeverity(impact);
    }

    const score = lostIntensity / threshold;
    if (score < 0.15) {
      return 'low';
    }
    if (score < 0.3) {
      return 'medium';
    }
    return 'high';
  }

  #getMaxLostIntensity(axisConflicts) {
    let max = null;
    for (const conflict of axisConflicts ?? []) {
      if (typeof conflict?.lostIntensity !== 'number') {
        continue;
      }
      if (max === null || conflict.lostIntensity > max) {
        max = conflict.lostIntensity;
      }
    }
    return max;
  }

  #getImpactFromId(id, clauses) {
    const parts = String(id).split(':');
    const clauseId = parts.slice(2).join(':');
    const clause = clauses.find((entry) => entry.clauseId === clauseId);
    return typeof clause?.impact === 'number' ? clause.impact : 0;
  }

  #classifyChokeType({ prototype, clause, gateMismatch, thresholdMismatch }) {
    if (gateMismatch && thresholdMismatch) {
      return 'mixed';
    }
    if (gateMismatch) {
      return 'gate';
    }
    if (thresholdMismatch) {
      return 'threshold';
    }

    const gateFailRate = prototype.gateFailRate ?? null;
    const gatePassCount =
      typeof prototype.gatePassCount === 'number'
        ? prototype.gatePassCount
        : 0;
    const passGivenGate =
      typeof prototype.pThreshGivenGate === 'number'
        ? prototype.pThreshGivenGate
        : null;
    const meanValueGivenGate =
      typeof prototype.meanValueGivenGate === 'number'
        ? prototype.meanValueGivenGate
        : null;
    const thresholdValue =
      typeof clause.thresholdValue === 'number' ? clause.thresholdValue : null;

    const gateProblem =
      typeof gateFailRate === 'number' &&
      gateFailRate >= CHOKE_GATE_FAIL_RATE;
    const thresholdProblem =
      gatePassCount > 0 &&
      this.#isThresholdChoke({
        passGivenGate,
        meanValueGivenGate,
        thresholdValue,
      });

    if (gateProblem && thresholdProblem) {
      return 'mixed';
    }
    if (gateProblem) {
      return 'gate';
    }
    if (thresholdProblem) {
      return 'threshold';
    }
    return 'mixed';
  }

  #isThresholdChoke({ passGivenGate, meanValueGivenGate, thresholdValue }) {
    if (typeof passGivenGate === 'number') {
      return passGivenGate < CHOKE_PASS_GIVEN_GATE_MAX;
    }
    if (
      typeof meanValueGivenGate === 'number' &&
      typeof thresholdValue === 'number'
    ) {
      return meanValueGivenGate < thresholdValue;
    }
    return false;
  }

  // ============================================================
  // Prototype Create Suggestion
  // ============================================================

  /**
   * Build a prototype_create_suggestion recommendation if emission conditions are met.
   * Emission logic: (A && B) || C, with spam brake.
   *
   * @param {object} diagnosticFacts
   * @returns {object|null}
   */
  #buildPrototypeCreateSuggestion(diagnosticFacts) {
    if (!this.#prototypeSynthesisService) {
      return null;
    }

    const prototypeFit = diagnosticFacts.prototypeFit;
    const gapDetection = diagnosticFacts.gapDetection;
    const targetSignature = diagnosticFacts.targetSignature;

    if (!prototypeFit || !gapDetection || !targetSignature) {
      return null;
    }

    const leaderboard = prototypeFit.leaderboard ?? [];
    if (leaderboard.length === 0) {
      return null;
    }

    // Select anchor clause and determine threshold t*
    const clauses = diagnosticFacts.clauses ?? [];
    const anchorClause = this.#selectAnchorClause(clauses);
    const thresholdTStar =
      typeof anchorClause?.thresholdValue === 'number'
        ? anchorClause.thresholdValue
        : DEFAULT_THRESHOLD_T_STAR;

    // Build candidate set
    const candidates = this.#buildCandidateSet(leaderboard, gapDetection);
    if (candidates.length === 0) {
      return null;
    }

    // Find best existing prototype
    const best = this.#findBestExistingPrototype(candidates, thresholdTStar);

    // Check spam brake first
    const nearestDistance = gapDetection.nearestDistance ?? 0;
    const bestPAtLeastT = this.#getPAtLeastT(best, thresholdTStar);
    if (
      nearestDistance <= SPAM_BRAKE_DISTANCE_MAX &&
      bestPAtLeastT >= SPAM_BRAKE_P_AT_LEAST_T_MIN
    ) {
      return null;
    }

    // Evaluate A, B, C conditions
    const A = this.#checkNoUsablePrototype(candidates, thresholdTStar);
    const C = this.#checkGapSignal(gapDetection);

    // Early exit if neither A nor C is true
    if (!A && !C) {
      return null;
    }

    // Synthesize proposed prototype
    const synthesized = this.#synthesizeProposedPrototype(
      diagnosticFacts,
      anchorClause,
      thresholdTStar
    );
    if (!synthesized) {
      return null;
    }

    // Evaluate B condition
    const B = this.#checkImprovementCondition(
      synthesized.predictedFit,
      best,
      thresholdTStar
    );

    // Determine if we should emit based on (A && B) || C
    const shouldEmitAB = A && B;
    const shouldEmitC = C && this.#passesSanityCheck(synthesized);
    if (!shouldEmitAB && !shouldEmitC) {
      return null;
    }

    // Determine confidence
    const confidence = this.#determineConfidence(A, B, C, shouldEmitC);
    if (confidence === 'low') {
      return null;
    }

    // Determine severity
    const anchorImpact =
      typeof anchorClause?.impact === 'number' ? anchorClause.impact : 0;
    const severity = anchorClause ? this.#getSeverity(anchorImpact) : 'low';

    // Build evidence
    const evidence = this.#buildPrototypeCreateEvidence({
      gapDetection,
      best,
      synthesized,
      thresholdTStar,
      targetSignature,
      anchorClause,
      C,
    });

    // Build why rationale
    const why = this.#buildPrototypeCreateWhy(A, B, C, shouldEmitAB, shouldEmitC);

    const expressionId = diagnosticFacts.expressionId ?? 'unknown';
    const anchorClauseId = anchorClause?.clauseId ?? 'none';

    return {
      id: `prototype_create_suggestion:${expressionId}:${anchorClauseId}`,
      type: 'prototype_create_suggestion',
      title: 'Prototype creation suggested',
      severity,
      confidence,
      why,
      evidence,
      proposedPrototype: {
        name: synthesized.name,
        weights: synthesized.weights,
        gates: synthesized.gates,
        derivedFrom: {
          anchorPrototype: this.#getAnchorPrototypeId(anchorClause, diagnosticFacts),
          targetSignature: this.#serializeTargetSignature(targetSignature),
          regimeBounds: diagnosticFacts.moodRegime?.bounds ?? null,
        },
      },
      predictedFit: this.#buildPredictedFitPayload(
        synthesized.predictedFit,
        best,
        thresholdTStar,
        diagnosticFacts
      ),
      relatedClauseIds: anchorClause?.clauseId ? [anchorClause.clauseId] : [],
    };
  }

  /**
   * Select anchor clause: highest-impact clause with prototypeId, tie-break by clauseId.
   */
  #selectAnchorClause(clauses) {
    const withPrototype = clauses.filter((c) => c.prototypeId);
    if (withPrototype.length === 0) {
      return null;
    }
    return [...withPrototype].sort((a, b) => {
      const impactA = typeof a.impact === 'number' ? a.impact : 0;
      const impactB = typeof b.impact === 'number' ? b.impact : 0;
      if (impactB !== impactA) {
        return impactB - impactA;
      }
      return String(a.clauseId ?? '').localeCompare(String(b.clauseId ?? ''));
    })[0];
  }

  /**
   * Build candidate set from leaderboard (top K by combinedScore or distance).
   */
  #buildCandidateSet(leaderboard, _gapDetection) {
    // Primary: use combinedScore if available
    const sorted = [...leaderboard].sort((a, b) => {
      const scoreA = typeof a.combinedScore === 'number' ? a.combinedScore : 0;
      const scoreB = typeof b.combinedScore === 'number' ? b.combinedScore : 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      // Fallback to distance (lower is better)
      const distA = typeof a.distance === 'number' ? a.distance : 1;
      const distB = typeof b.distance === 'number' ? b.distance : 1;
      return distA - distB;
    });
    return sorted.slice(0, CANDIDATE_SET_SIZE);
  }

  /**
   * Find best existing prototype by lexicographic: pAtLeastT(t*), gatePassRate, p95.
   */
  #findBestExistingPrototype(candidates, thresholdTStar) {
    if (candidates.length === 0) {
      return null;
    }
    return [...candidates].sort((a, b) => {
      const pA = this.#getPAtLeastT(a, thresholdTStar);
      const pB = this.#getPAtLeastT(b, thresholdTStar);
      if (pB !== pA) {
        return pB - pA;
      }
      const gprA = a.gatePassRate ?? 0;
      const gprB = b.gatePassRate ?? 0;
      if (gprB !== gprA) {
        return gprB - gprA;
      }
      const p95A = a.intensityDistribution?.p95 ?? 0;
      const p95B = b.intensityDistribution?.p95 ?? 0;
      return p95B - p95A;
    })[0];
  }

  /**
   * Get pAtLeastT for a given threshold from a prototype's intensityDistribution.
   */
  #getPAtLeastT(prototype, threshold) {
    if (!prototype?.intensityDistribution?.pAboveThreshold) {
      return 0;
    }
    const pAbove = prototype.intensityDistribution.pAboveThreshold;
    // Find exact match or closest
    const entry = pAbove.find(
      (e) => typeof e.t === 'number' && Math.abs(e.t - threshold) < 0.001
    );
    if (entry && typeof entry.p === 'number') {
      return entry.p;
    }
    // If no exact match, use interpolation or fallback
    return this.#interpolatePAtLeastT(pAbove, threshold);
  }

  /**
   * Interpolate pAtLeastT when exact threshold not found.
   */
  #interpolatePAtLeastT(pAbove, threshold) {
    if (!Array.isArray(pAbove) || pAbove.length === 0) {
      return 0;
    }
    // Sort by threshold
    const sorted = [...pAbove]
      .filter((e) => typeof e.t === 'number' && typeof e.p === 'number')
      .sort((a, b) => a.t - b.t);
    if (sorted.length === 0) {
      return 0;
    }
    // Below min threshold
    if (threshold <= sorted[0].t) {
      return sorted[0].p;
    }
    // Above max threshold
    if (threshold >= sorted[sorted.length - 1].t) {
      return sorted[sorted.length - 1].p;
    }
    // Linear interpolation
    for (let i = 0; i < sorted.length - 1; i++) {
      if (threshold >= sorted[i].t && threshold <= sorted[i + 1].t) {
        const t0 = sorted[i].t;
        const t1 = sorted[i + 1].t;
        const p0 = sorted[i].p;
        const p1 = sorted[i + 1].p;
        const ratio = (threshold - t0) / (t1 - t0);
        return p0 + ratio * (p1 - p0);
      }
    }
    return 0;
  }

  /**
   * Check condition A: No usable existing prototype.
   */
  #checkNoUsablePrototype(candidates, thresholdTStar) {
    for (const proto of candidates) {
      if (this.#isUsablePrototype(proto, thresholdTStar)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a prototype is usable.
   */
  #isUsablePrototype(proto, thresholdTStar) {
    const gatePassRate = proto.gatePassRate ?? 0;
    const pAtLeastT = this.#getPAtLeastT(proto, thresholdTStar);
    const conflictRate = proto.conflictRate ?? null;

    if (gatePassRate < USABLE_GATE_PASS_RATE_MIN) {
      return false;
    }
    if (pAtLeastT < USABLE_P_AT_LEAST_T_MIN) {
      return false;
    }
    if (
      typeof conflictRate === 'number' &&
      conflictRate > USABLE_CONFLICT_RATE_MAX
    ) {
      return false;
    }
    return true;
  }

  /**
   * Check condition C: Prototype space gap signal.
   */
  #checkGapSignal(gapDetection) {
    const nearestDistance = gapDetection.nearestDistance ?? 0;
    const distancePercentile = gapDetection.distancePercentile ?? 0;

    return (
      nearestDistance > GAP_NEAREST_DISTANCE_THRESHOLD ||
      distancePercentile >= GAP_PERCENTILE_THRESHOLD
    );
  }

  /**
   * Check condition B: Proposed prototype materially improves fit.
   */
  #checkImprovementCondition(predictedFit, best, thresholdTStar) {
    const pNew = this.#getPAtLeastTFromPredicted(predictedFit, thresholdTStar);
    const pBest = this.#getPAtLeastT(best, thresholdTStar);
    const delta = pNew - pBest;

    // Primary condition: delta >= 0.15
    if (delta >= IMPROVEMENT_DELTA_MIN) {
      return true;
    }

    // Special case: both < 0.05, require pNew >= 0.10
    if (
      pNew < IMPROVEMENT_BOTH_LOW_THRESHOLD &&
      pBest < IMPROVEMENT_BOTH_LOW_THRESHOLD
    ) {
      return pNew >= USABLE_P_AT_LEAST_T_MIN;
    }

    return false;
  }

  /**
   * Get pAtLeastT from predicted fit structure.
   */
  #getPAtLeastTFromPredicted(predictedFit, threshold) {
    if (!predictedFit?.pAtLeastT) {
      return 0;
    }
    const pAtLeastT = predictedFit.pAtLeastT;
    // Find exact match first
    const entry = pAtLeastT.find(
      (e) => typeof e.t === 'number' && Math.abs(e.t - threshold) < 0.001
    );
    if (entry && typeof entry.p === 'number') {
      return entry.p;
    }
    // If no exact match, use interpolation
    return this.#interpolatePAtLeastT(pAtLeastT, threshold);
  }

  /**
   * Synthesize proposed prototype using the synthesis service.
   */
  #synthesizeProposedPrototype(diagnosticFacts, anchorClause, threshold) {
    const targetSignature = diagnosticFacts.targetSignature;
    const regimeBounds = diagnosticFacts.moodRegime?.bounds ?? {};
    const storedMoodRegimeContexts =
      diagnosticFacts.storedMoodRegimeContexts ?? [];
    const prototypeDefinitions = diagnosticFacts.prototypeDefinitions ?? {};

    // Get anchor prototype if available
    let anchorPrototype = null;
    if (anchorClause?.prototypeId) {
      const def = prototypeDefinitions[anchorClause.prototypeId];
      if (def) {
        anchorPrototype = {
          id: anchorClause.prototypeId,
          weights: def.weights ?? {},
          gates: def.gates ?? [],
        };
      }
    }

    // Collect existing prototype names for collision avoidance
    const existingNames = new Set(Object.keys(prototypeDefinitions));

    try {
      return this.#prototypeSynthesisService.synthesize({
        targetSignature,
        regimeBounds,
        storedMoodRegimeContexts,
        anchorPrototype,
        threshold,
        existingNames,
      });
    } catch {
      return null;
    }
  }

  /**
   * Check sanity conditions for C-triggered emission.
   */
  #passesSanityCheck(synthesized) {
    const gatePassRate = synthesized.predictedFit?.gatePassRate ?? 0;
    const weights = synthesized.weights ?? {};
    const nonZeroCount = Object.values(weights).filter(
      (w) => typeof w === 'number' && Math.abs(w) > 0.001
    ).length;

    return (
      gatePassRate >= SANITY_GATE_PASS_RATE_MIN &&
      nonZeroCount >= SANITY_MIN_NON_ZERO_WEIGHTS
    );
  }

  /**
   * Determine confidence level.
   */
  #determineConfidence(A, B, C, sanityPassed) {
    if ((A && B) || (C && B)) {
      return 'high';
    }
    if (C && sanityPassed) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Build evidence array for prototype create suggestion.
   */
  #buildPrototypeCreateEvidence({
    gapDetection,
    best,
    synthesized,
    thresholdTStar,
    targetSignature,
    anchorClause,
    C,
  }) {
    const evidence = [];

    // Gap evidence (if C triggered)
    if (C) {
      const nearestDistance = gapDetection.nearestDistance ?? 0;
      const distancePercentile = gapDetection.distancePercentile ?? null;
      evidence.push({
        label: 'Nearest prototype distance',
        value: nearestDistance,
        population: null,
      });
      if (typeof distancePercentile === 'number') {
        evidence.push({
          label: 'Distance percentile',
          value: distancePercentile,
          population: null,
        });
      }
    }

    // Best existing prototype fit
    if (best) {
      const bestPAtLeastT = this.#getPAtLeastT(best, thresholdTStar);
      evidence.push({
        label: `Best existing P(I >= ${thresholdTStar.toFixed(2)})`,
        value: bestPAtLeastT,
        prototypeId: best.prototypeId ?? null,
        population: this.#buildPopulation(
          'stored-mood-regime',
          best.moodSampleCount ?? null
        ),
      });
      evidence.push({
        label: 'Best existing gate pass rate',
        value: best.gatePassRate ?? 0,
        prototypeId: best.prototypeId ?? null,
        population: this.#buildPopulation(
          'stored-mood-regime',
          best.moodSampleCount ?? null
        ),
      });
    }

    // Proposed prototype fit
    const predictedFit = synthesized.predictedFit ?? {};
    const proposedPAtLeastT = this.#getPAtLeastTFromPredicted(
      predictedFit,
      thresholdTStar
    );
    evidence.push({
      label: `Proposed P(I >= ${thresholdTStar.toFixed(2)})`,
      value: proposedPAtLeastT,
      population: this.#buildPopulation(
        'stored-mood-regime',
        predictedFit.N ?? null
      ),
    });
    evidence.push({
      label: 'Proposed gate pass rate',
      value: predictedFit.gatePassRate ?? 0,
      population: this.#buildPopulation(
        'stored-mood-regime',
        predictedFit.N ?? null
      ),
    });

    // Delta
    const bestPAtLeastT = best ? this.#getPAtLeastT(best, thresholdTStar) : 0;
    const delta = proposedPAtLeastT - bestPAtLeastT;
    evidence.push({
      label: `Delta P(I >= ${thresholdTStar.toFixed(2)})`,
      value: delta,
      population: null,
    });

    // Target signature summary
    const sigSummary = this.#summarizeTargetSignature(targetSignature);
    if (sigSummary) {
      evidence.push({
        label: 'Target signature',
        value: sigSummary,
        population: null,
      });
    }

    // Anchor prototype
    if (anchorClause?.prototypeId) {
      evidence.push({
        label: 'Anchor prototype',
        value: anchorClause.prototypeId,
        population: null,
      });
    }

    return evidence;
  }

  /**
   * Build why rationale string.
   */
  #buildPrototypeCreateWhy(A, B, C, shouldEmitAB, shouldEmitC) {
    const parts = [];
    if (shouldEmitAB) {
      parts.push('No existing prototype meets usability thresholds.');
      parts.push('Proposed prototype improves fit by at least 15 percentage points.');
    } else if (shouldEmitC) {
      parts.push(
        'Target signature is distant from all existing prototypes (gap detected).'
      );
      if (B) {
        parts.push('Proposed prototype also improves fit.');
      }
    }
    return parts.join(' ');
  }

  /**
   * Build predicted fit payload for the recommendation.
   */
  #buildPredictedFitPayload(predictedFit, best, thresholdTStar, _diagnosticFacts) {
    const N = predictedFit?.N ?? 0;
    const gatePassRate = predictedFit?.gatePassRate ?? 0;
    const mean = predictedFit?.mean ?? 0;
    const p95 = predictedFit?.p95 ?? 0;
    const pAtLeastT = predictedFit?.pAtLeastT ?? [];

    // Build comparison
    const bestPAtLeastT = best ? this.#getPAtLeastT(best, thresholdTStar) : 0;
    const proposedPAtLeastT = this.#getPAtLeastTFromPredicted(
      predictedFit,
      thresholdTStar
    );

    return {
      population: 'stored-mood-regime',
      N,
      gatePassRate,
      mean,
      p95,
      pAtLeastT,
      comparison: {
        bestExistingPrototype: best?.prototypeId ?? null,
        bestExisting: bestPAtLeastT,
        delta: proposedPAtLeastT - bestPAtLeastT,
      },
    };
  }

  /**
   * Get anchor prototype ID from clause and definitions.
   */
  #getAnchorPrototypeId(anchorClause, diagnosticFacts) {
    if (!anchorClause?.prototypeId) {
      return null;
    }
    const defs = diagnosticFacts.prototypeDefinitions ?? {};
    return defs[anchorClause.prototypeId] ? anchorClause.prototypeId : null;
  }

  /**
   * Serialize target signature for evidence.
   */
  #serializeTargetSignature(targetSignature) {
    if (!targetSignature || typeof targetSignature !== 'object') {
      return null;
    }
    const result = {};
    for (const [axis, data] of Object.entries(targetSignature)) {
      if (data && typeof data === 'object') {
        result[axis] = {
          dir: data.dir ?? null,
          importance: data.importance ?? null,
        };
      }
    }
    return result;
  }

  /**
   * Summarize target signature for evidence display.
   */
  #summarizeTargetSignature(targetSignature) {
    if (!targetSignature || typeof targetSignature !== 'object') {
      return null;
    }
    const entries = Object.entries(targetSignature)
      .filter(([, data]) => data && typeof data.importance === 'number')
      .sort((a, b) => (b[1].importance ?? 0) - (a[1].importance ?? 0))
      .slice(0, 3)
      .map(([axis, data]) => `${axis}:${data.dir ?? '?'}(${(data.importance ?? 0).toFixed(2)})`);
    return entries.length > 0 ? entries.join(', ') : null;
  }
}

export default RecommendationEngine;
