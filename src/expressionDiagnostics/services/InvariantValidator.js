/**
 * @file InvariantValidator - Validates DiagnosticFacts invariants.
 */

class InvariantValidator {
  /**
   * Validate DiagnosticFacts invariants.
   *
   * @param {object} diagnosticFacts
   * @param {object} [options]
   * @param {number} [options.epsilon=1e-6]
   * @returns {Array<{id: string, ok: boolean, message: string}>}
   */
  validate(diagnosticFacts, { epsilon = 1e-6 } = {}) {
    if (!diagnosticFacts) {
      return [];
    }

    const invariants = [];
    const addInvariant = (id, ok, message) => {
      invariants.push({ id, ok, message });
    };

    const checkRate = (value, id, label) => {
      if (value === null || value === undefined) {
        return;
      }
      const ok = value >= 0 && value <= 1;
      addInvariant(
        `rate:${id}`,
        ok,
        `${label} must be between 0 and 1 (value=${value})`
      );
    };

    checkRate(
      diagnosticFacts.overallPassRate,
      'overallPassRate',
      'overallPassRate'
    );

    for (const clause of diagnosticFacts.clauses ?? []) {
      const clauseId = clause.clauseId ?? 'unknown';
      checkRate(
        clause.failRateInMood,
        `clause:${clauseId}:failRateInMood`,
        `failRateInMood for ${clauseId}`
      );
      checkRate(
        clause.conditionalFailRate,
        `clause:${clauseId}:conditionalFailRate`,
        `conditionalFailRate for ${clauseId}`
      );
      checkRate(
        clause.nearMissRate,
        `clause:${clauseId}:nearMissRate`,
        `nearMissRate for ${clauseId}`
      );

      const gateClampFacts = clause.gateClampRegimePermissive;
      if (gateClampFacts) {
        checkRate(
          gateClampFacts.gateClampRateInRegime,
          `clause:${clauseId}:gateClampRateInRegime`,
          `gateClampRateInRegime for ${clauseId}`
        );

        const gatePass = gateClampFacts.gatePassInRegimeCount;
        const gateFail = gateClampFacts.gateFailInRegimeCount;
        const moodCount = gateClampFacts.moodRegimeCount;
        const gateCountOk =
          typeof gatePass === 'number' &&
          typeof gateFail === 'number' &&
          typeof moodCount === 'number'
            ? gatePass + gateFail === moodCount
            : true;
        addInvariant(
          `count:${clauseId}:gatePassFailInRegime`,
          gateCountOk,
          `gatePassInRegimeCount + gateFailInRegimeCount must equal moodRegimeCount for ${clauseId}` +
            ` (gatePass=${gatePass}, gateFail=${gateFail}, moodRegimeCount=${moodCount})`
        );

        for (const evidence of gateClampFacts.axisEvidence ?? []) {
          const { quantiles } = evidence ?? {};
          if (
            quantiles &&
            typeof quantiles.p10 === 'number' &&
            typeof quantiles.p50 === 'number' &&
            typeof quantiles.p90 === 'number'
          ) {
            const ok =
              quantiles.p10 <= quantiles.p50 && quantiles.p50 <= quantiles.p90;
            addInvariant(
              `quantiles:${clauseId}:${evidence.axis}`,
              ok,
              `Quantiles must be monotonic for ${clauseId} (${evidence.axis}) ` +
                `(p10=${quantiles.p10}, p50=${quantiles.p50}, p90=${quantiles.p90})`
            );
          }
        }
      }
    }

    for (const prototype of diagnosticFacts.prototypes ?? []) {
      const prototypeId = prototype.prototypeId ?? 'unknown';
      checkRate(
        prototype.gatePassRate,
        `prototype:${prototypeId}:gatePassRate`,
        `gatePassRate for ${prototypeId}`
      );
      checkRate(
        prototype.gateFailRate,
        `prototype:${prototypeId}:gateFailRate`,
        `gateFailRate for ${prototypeId}`
      );
      checkRate(
        prototype.pThreshGivenGate,
        `prototype:${prototypeId}:pThreshGivenGate`,
        `pThreshGivenGate for ${prototypeId}`
      );
      checkRate(
        prototype.pThreshEffective,
        `prototype:${prototypeId}:pThreshEffective`,
        `pThreshEffective for ${prototypeId}`
      );
      checkRate(
        prototype.meanValueGivenGate,
        `prototype:${prototypeId}:meanValueGivenGate`,
        `meanValueGivenGate for ${prototypeId}`
      );

      const gatePassOk =
        typeof prototype.gatePassCount === 'number' &&
        typeof prototype.moodSampleCount === 'number'
          ? prototype.gatePassCount <= prototype.moodSampleCount
          : true;
      addInvariant(
        `count:${prototypeId}:gatePassWithinMood`,
        gatePassOk,
        `gatePassCount must be <= moodSampleCount for ${prototypeId} ` +
          `(gatePassCount=${prototype.gatePassCount}, moodSampleCount=${prototype.moodSampleCount})`
      );

      const thresholdPassOk =
        typeof prototype.thresholdPassCount === 'number' &&
        typeof prototype.gatePassCount === 'number'
          ? prototype.thresholdPassCount <= prototype.gatePassCount
          : true;
      addInvariant(
        `count:${prototypeId}:thresholdPassWithinGate`,
        thresholdPassOk,
        `thresholdPassCount must be <= gatePassCount for ${prototypeId} ` +
          `(thresholdPassCount=${prototype.thresholdPassCount}, gatePassCount=${prototype.gatePassCount})`
      );

      if (
        typeof prototype.gatePassRate === 'number' &&
        typeof prototype.pThreshGivenGate === 'number' &&
        typeof prototype.pThreshEffective === 'number'
      ) {
        const expected = prototype.gatePassRate * prototype.pThreshGivenGate;
        const ok = Math.abs(prototype.pThreshEffective - expected) <= epsilon;
        addInvariant(
          `probabilityIdentity:${prototypeId}`,
          ok,
          `pThreshEffective must equal gatePassRate * pThreshGivenGate for ${prototypeId}` +
            ` (expected=${expected}, actual=${prototype.pThreshEffective})`
        );
      }
    }

    return invariants;
  }
}

export default InvariantValidator;
