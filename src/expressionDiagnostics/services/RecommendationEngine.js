/**
 * @file RecommendationEngine - Emits deterministic recommendations from DiagnosticFacts.
 */

const SEVERITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const GATE_CLAMP_MIN_RATE = 0.2;
const GATE_CLAMP_MIN_KEEP = 0.5;
const GATE_CLAMP_MIN_DELTA = 0.1;
const CHOKE_GATE_FAIL_RATE = 0.2;
const CHOKE_PASS_GIVEN_GATE_MAX = 0.95;

class RecommendationEngine {
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
}

export default RecommendationEngine;
