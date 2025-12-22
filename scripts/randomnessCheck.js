#!/usr/bin/env node

import OutcomeDeterminerService from '../src/combat/services/OutcomeDeterminerService.js';
import { ensureValidLogger } from '../src/utils/loggerUtils.js';

const logger = ensureValidLogger(console, 'RandomnessCheck');
const determiner = new OutcomeDeterminerService({ logger });

const DEFAULT_TRIALS = 200000;
const DEFAULT_ROLLS = 200000;
const DEFAULT_SIGMA = 5;
const DEFAULT_CHANCES = [10, 30, 50, 60, 80, 95];

function parseArgs(argv) {
  const args = new Map();
  for (const token of argv) {
    if (!token.startsWith('--')) {
      continue;
    }
    const [rawKey, rawValue] = token.slice(2).split('=');
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (key) {
      args.set(key, value ?? '');
    }
  }
  return args;
}

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFloatValue(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseChances(value) {
  if (!value) {
    return DEFAULT_CHANCES;
  }
  const entries = value.split(',').map((item) => Number.parseInt(item, 10));
  const filtered = entries.filter(
    (chance) => Number.isFinite(chance) && chance >= 0 && chance <= 100
  );
  return filtered.length > 0 ? filtered : DEFAULT_CHANCES;
}

function sigmaBound(p, trials, sigma) {
  const variance = p * (1 - p);
  const std = Math.sqrt(variance / trials);
  return sigma * std;
}

function zScore(observed, expected, std) {
  if (std === 0) {
    return 0;
  }
  return (observed - expected) / std;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(3)}%`;
}

function runChanceTests({ trials, sigma, chances }) {
  const failures = [];

  for (const chance of chances) {
    const probability = chance / 100;
    let successCount = 0;
    let criticalSuccessCount = 0;
    let fumbleCount = 0;

    for (let i = 0; i < trials; i += 1) {
      const result = determiner.determine({ finalChance: chance });
      if (result.outcome === 'SUCCESS' || result.outcome === 'CRITICAL_SUCCESS') {
        successCount += 1;
      }
      if (result.outcome === 'CRITICAL_SUCCESS') {
        criticalSuccessCount += 1;
      }
      if (result.outcome === 'FUMBLE') {
        fumbleCount += 1;
      }
    }

    const successRate = successCount / trials;
    const successStd = Math.sqrt(probability * (1 - probability) / trials);
    const successZ = zScore(successRate, probability, successStd);

    const criticalSuccessThreshold = 5;
    const criticalSuccessExpected = Math.min(chance, criticalSuccessThreshold) / 100;
    const criticalSuccessStd = Math.sqrt(
      criticalSuccessExpected * (1 - criticalSuccessExpected) / trials
    );
    const criticalSuccessRate = criticalSuccessCount / trials;
    const criticalSuccessZ = zScore(
      criticalSuccessRate,
      criticalSuccessExpected,
      criticalSuccessStd
    );

    const criticalFailureThreshold = 95;
    const fumbleExpected =
      chance >= criticalFailureThreshold
        ? 0
        : (100 - Math.max(chance, criticalFailureThreshold - 1)) / 100;
    const fumbleStd = Math.sqrt(fumbleExpected * (1 - fumbleExpected) / trials);
    const fumbleRate = fumbleCount / trials;
    const fumbleZ = zScore(fumbleRate, fumbleExpected, fumbleStd);

    const bounds = sigmaBound(probability, trials, sigma);

    console.log(`Chance ${chance}%:`);
    console.log(
      `  success=${formatPercent(successRate)} expected=${formatPercent(
        probability
      )} z=${successZ.toFixed(2)} bound=+/-${formatPercent(bounds)}`
    );
    console.log(
      `  criticalSuccess=${formatPercent(
        criticalSuccessRate
      )} expected=${formatPercent(criticalSuccessExpected)} z=${criticalSuccessZ.toFixed(2)}`
    );
    console.log(
      `  fumble=${formatPercent(fumbleRate)} expected=${formatPercent(
        fumbleExpected
      )} z=${fumbleZ.toFixed(2)}`
    );

    if (Math.abs(successZ) > sigma) {
      failures.push(
        `Chance ${chance}% success rate z=${successZ.toFixed(2)} exceeded sigma ${sigma}`
      );
    }

    if (criticalSuccessExpected > 0 && Math.abs(criticalSuccessZ) > sigma) {
      failures.push(
        `Chance ${chance}% critical success z=${criticalSuccessZ.toFixed(2)} exceeded sigma ${sigma}`
      );
    }

    if (fumbleExpected > 0 && Math.abs(fumbleZ) > sigma) {
      failures.push(
        `Chance ${chance}% fumble z=${fumbleZ.toFixed(2)} exceeded sigma ${sigma}`
      );
    }
  }

  return failures;
}

function runRollUniformityTest({ rolls, sigma }) {
  const counts = new Array(101).fill(0);
  let sum = 0;
  let sumSq = 0;
  let sumCross = 0;
  let previous = null;

  for (let i = 0; i < rolls; i += 1) {
    const result = determiner.determine({ finalChance: 50 });
    const roll = result.roll;
    counts[roll] += 1;
    sum += roll;
    sumSq += roll * roll;

    if (previous !== null) {
      sumCross += previous * roll;
    }
    previous = roll;
  }

  const mean = sum / rolls;
  const variance = sumSq / rolls - mean * mean;
  const expectedMean = 50.5;
  const expectedVariance = 833.25;
  const meanStd = Math.sqrt(expectedVariance / rolls);
  const varianceStd = Math.sqrt((2 * expectedVariance * expectedVariance) / (rolls - 1));
  const meanZ = zScore(mean, expectedMean, meanStd);
  const varianceZ = zScore(variance, expectedVariance, varianceStd);

  const p = 0.01;
  const expected = rolls * p;
  const std = Math.sqrt(rolls * p * (1 - p));
  let maxBucketZ = 0;
  let maxBucket = 0;

  for (let roll = 1; roll <= 100; roll += 1) {
    const bucketZ = zScore(counts[roll], expected, std);
    const absZ = Math.abs(bucketZ);
    if (absZ > maxBucketZ) {
      maxBucketZ = absZ;
      maxBucket = roll;
    }
  }

  const covariance = sumCross / (rolls - 1) - mean * mean;
  const correlation = covariance / variance;
  const correlationStd = 1 / Math.sqrt(rolls - 1);
  const correlationZ = zScore(correlation, 0, correlationStd);

  console.log('Roll uniformity:');
  console.log(
    `  mean=${mean.toFixed(3)} expected=${expectedMean.toFixed(3)} z=${meanZ.toFixed(2)}`
  );
  console.log(
    `  variance=${variance.toFixed(3)} expected=${expectedVariance.toFixed(
      3
    )} z=${varianceZ.toFixed(2)}`
  );
  console.log(
    `  maxBucket=${maxBucket} z=${maxBucketZ.toFixed(2)} threshold=${sigma.toFixed(
      2
    )}`
  );
  console.log(
    `  correlation=${correlation.toFixed(4)} z=${correlationZ.toFixed(2)} threshold=${sigma.toFixed(
      2
    )}`
  );

  const failures = [];
  if (Math.abs(meanZ) > sigma) {
    failures.push(`Roll mean z=${meanZ.toFixed(2)} exceeded sigma ${sigma}`);
  }
  if (Math.abs(varianceZ) > sigma) {
    failures.push(
      `Roll variance z=${varianceZ.toFixed(2)} exceeded sigma ${sigma}`
    );
  }
  if (maxBucketZ > sigma) {
    failures.push(
      `Roll bucket z=${maxBucketZ.toFixed(2)} exceeded sigma ${sigma} (bucket ${maxBucket})`
    );
  }
  if (Math.abs(correlationZ) > sigma) {
    failures.push(
      `Roll correlation z=${correlationZ.toFixed(2)} exceeded sigma ${sigma}`
    );
  }

  return failures;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const trials = parseNumber(args.get('trials'), DEFAULT_TRIALS);
  const rolls = parseNumber(args.get('rolls'), DEFAULT_ROLLS);
  const sigma = parseFloatValue(args.get('sigma'), DEFAULT_SIGMA);
  const chances = parseChances(args.get('chances'));

  console.log('Randomness checks (Math.random via OutcomeDeterminerService)');
  console.log(`  trials=${trials} rolls=${rolls} sigma=${sigma}`);
  console.log(`  chances=${chances.join(', ')}`);

  const failures = [];
  failures.push(...runChanceTests({ trials, sigma, chances }));
  failures.push(...runRollUniformityTest({ rolls, sigma }));

  if (failures.length > 0) {
    console.error('\nFailures:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed.');
  }
}

main();
