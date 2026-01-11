# EXPDIAMONCARREFREP-006: Extract RandomStateGenerator from MonteCarloSimulator

## Summary
Extract `#generateRandomState()`, `#sampleValue()`, and `#sampleGaussianDelta()` from `MonteCarloSimulator` into a dedicated `RandomStateGenerator` service. This separates state sampling concerns from simulation orchestration.

## Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | Create | New service for random state generation |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` | Create | Unit tests for the service |

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Modify | Remove extraction methods, inject and delegate to new service |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Modify | Add `IRandomStateGenerator` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modify | Register new service |

## Out of Scope

- **DO NOT** consolidate with `WitnessState.createRandom()` - That's EXPDIAMONCARREFREP-007
- **DO NOT** change sigma values (MOOD_DELTA_SIGMA=15, SEXUAL_DELTA_SIGMA=12, LIBIDO_DELTA_SIGMA=8)
- **DO NOT** change distribution algorithms (Box-Muller transform)
- **DO NOT** modify any UI/controller code

## Acceptance Criteria

### Tests That Must Pass
1. All existing tests in `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`
2. New test: `RandomStateGenerator.generate()` returns valid state structure
3. New test: `generate('uniform', 'static')` produces uniform distribution
4. New test: `generate('gaussian', 'static')` produces gaussian distribution
5. New test: `generate('gaussian', 'dynamic')` produces delta-based sampling
6. New test: Generated mood axes are in [-100, 100] range
7. New test: Generated sexual axes respect their specific ranges
8. New test: Generated affectTraits are in [0, 100] range

### Invariants That Must Remain True
1. Mood axes range: [-100, 100]
2. Sexual ranges: sex_excitation/inhibition [0, 100], baseline_libido [-50, 50]
3. Sigma values unchanged: MOOD_DELTA_SIGMA=15, SEXUAL_DELTA_SIGMA=12, LIBIDO_DELTA_SIGMA=8
4. Box-Muller transform for Gaussian sampling
5. State structure: `{current: {mood, sexual}, previous: {mood, sexual}, affectTraits}`

## Implementation Notes

### RandomStateGenerator Interface
```javascript
/**
 * @file Service for generating random emotional/sexual states for Monte Carlo simulation
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

// Sigma values for Gaussian deltas
const MOOD_DELTA_SIGMA = 15;
const SEXUAL_DELTA_SIGMA = 12;
const LIBIDO_DELTA_SIGMA = 8;

// Axis definitions
const MOOD_AXES = ['valence', 'arousal', 'dominance', 'novelty', 'safety'];
const SEXUAL_AXES = ['sex_excitation', 'sex_inhibition', 'baseline_libido'];
const AFFECT_TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

class RandomStateGenerator {
  #logger;

  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    this.#logger = logger;
  }

  /**
   * Generate a random state for simulation.
   * @param {'uniform'|'gaussian'} distribution - Distribution type
   * @param {'static'|'dynamic'} samplingMode - Sampling mode
   * @returns {{current: Object, previous: Object, affectTraits: Object}}
   */
  generate(distribution = 'gaussian', samplingMode = 'static') {
    const current = {
      mood: this.#generateMood(distribution),
      sexual: this.#generateSexual(distribution)
    };

    let previous;
    if (samplingMode === 'dynamic') {
      previous = {
        mood: this.#generateMoodDelta(current.mood),
        sexual: this.#generateSexualDelta(current.sexual)
      };
    } else {
      previous = {
        mood: this.#generateMood(distribution),
        sexual: this.#generateSexual(distribution)
      };
    }

    const affectTraits = this.#generateAffectTraits();

    return { current, previous, affectTraits };
  }

  #generateMood(distribution) {
    const mood = {};
    for (const axis of MOOD_AXES) {
      mood[axis] = distribution === 'uniform'
        ? this.#uniformRandom(-100, 100)
        : this.#gaussianRandom(0, 50, -100, 100);
    }
    return mood;
  }

  #generateSexual(distribution) {
    return {
      sex_excitation: distribution === 'uniform'
        ? this.#uniformRandom(0, 100)
        : this.#gaussianRandom(50, 25, 0, 100),
      sex_inhibition: distribution === 'uniform'
        ? this.#uniformRandom(0, 100)
        : this.#gaussianRandom(50, 25, 0, 100),
      baseline_libido: distribution === 'uniform'
        ? this.#uniformRandom(-50, 50)
        : this.#gaussianRandom(0, 25, -50, 50)
    };
  }

  #generateMoodDelta(baseMood) {
    const previous = {};
    for (const axis of MOOD_AXES) {
      const delta = this.#gaussianDelta(MOOD_DELTA_SIGMA);
      previous[axis] = this.#clamp(baseMood[axis] + delta, -100, 100);
    }
    return previous;
  }

  #generateSexualDelta(baseSexual) {
    return {
      sex_excitation: this.#clamp(
        baseSexual.sex_excitation + this.#gaussianDelta(SEXUAL_DELTA_SIGMA),
        0, 100
      ),
      sex_inhibition: this.#clamp(
        baseSexual.sex_inhibition + this.#gaussianDelta(SEXUAL_DELTA_SIGMA),
        0, 100
      ),
      baseline_libido: this.#clamp(
        baseSexual.baseline_libido + this.#gaussianDelta(LIBIDO_DELTA_SIGMA),
        -50, 50
      )
    };
  }

  #generateAffectTraits() {
    const traits = {};
    for (const trait of AFFECT_TRAITS) {
      traits[trait] = this.#uniformRandom(0, 100);
    }
    return traits;
  }

  #uniformRandom(min, max) {
    return Math.random() * (max - min) + min;
  }

  #gaussianRandom(mean, stdDev, min, max) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const value = mean + z * stdDev;
    return this.#clamp(value, min, max);
  }

  #gaussianDelta(sigma) {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

export default RandomStateGenerator;
export { MOOD_DELTA_SIGMA, SEXUAL_DELTA_SIGMA, LIBIDO_DELTA_SIGMA };
```

### DI Registration
```javascript
// In tokens-diagnostics.js
IRandomStateGenerator: 'IRandomStateGenerator',

// In expressionDiagnosticsRegistrations.js
container.registerFactory(tokens.IRandomStateGenerator, (c) => {
  return new RandomStateGenerator({
    logger: c.resolve(coreTokens.ILogger),
  });
});
```

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="randomStateGenerator"
npm run test:unit -- --testPathPattern="monteCarloSimulator"
npm run typecheck
npx eslint src/expressionDiagnostics/services/RandomStateGenerator.js
```

## Dependencies
- **Depends on**: None (can run in parallel with other tracks)
- **Blocks**: EXPDIAMONCARREFREP-007 (sampling constants consolidation)
