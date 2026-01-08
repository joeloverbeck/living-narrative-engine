/**
 * @file Integration tests for complex expression prerequisites (Suite A1-A5, B1).
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

const LOOKUPS_DIR = path.resolve(
  process.cwd(),
  'data',
  'mods',
  'core',
  'lookups'
);

const EXPRESSIONS_DIRS = {
  emotions: path.resolve(process.cwd(), 'data', 'mods', 'emotions', 'expressions'),
  'emotions-positive-affect': path.resolve(
    process.cwd(),
    'data',
    'mods',
    'emotions-positive-affect',
    'expressions'
  ),
};

const loadLookup = async (dataRegistry, filename) => {
  const lookupPath = path.join(LOOKUPS_DIR, filename);
  const lookup = JSON.parse(await readFile(lookupPath, 'utf-8'));
  dataRegistry.store('lookups', lookup.id, lookup);
};

const loadExpressionDefinition = async (dataRegistry, expressionId) => {
  const [namespace, fileBase] = expressionId.split(':');
  const expressionsDir = EXPRESSIONS_DIRS[namespace];
  if (!expressionsDir) {
    throw new Error(`Unsupported expression namespace: ${namespace}`);
  }
  const filePath = path.join(expressionsDir, `${fileBase}.expression.json`);
  const expression = JSON.parse(await readFile(filePath, 'utf-8'));
  dataRegistry.store('expressions', expression.id, expression);
  return expression;
};

const createEntityManagerStub = () => {
  const components = new Map();
  const entityComponentIds = new Map();

  const getKey = (entityId, componentId) => `${entityId}:${componentId}`;
  const registerComponent = (entityId, componentId) => {
    if (!entityComponentIds.has(entityId)) {
      entityComponentIds.set(entityId, new Set());
    }
    entityComponentIds.get(entityId).add(componentId);
  };

  return {
    setComponent(entityId, componentId, data) {
      components.set(getKey(entityId, componentId), data);
      registerComponent(entityId, componentId);
    },
    getComponentData: jest.fn((entityId, componentId) => {
      return components.get(getKey(entityId, componentId)) ?? null;
    }),
    getAllComponentTypesForEntity: jest.fn((entityId) => {
      return Array.from(entityComponentIds.get(entityId) ?? []);
    }),
    hasComponent: jest.fn((entityId, componentId) => {
      return Boolean(entityComponentIds.get(entityId)?.has(componentId));
    }),
    getEntitiesInLocation: jest.fn(() => new Set()),
  };
};

const buildPreviousState = (context) => ({
  emotions: context.emotions,
  sexualStates: context.sexualStates,
  moodAxes: context.moodAxes,
});

describe('Complex Expression Prerequisites - Suite A + B', () => {
  let testBed;
  let container;
  let dataRegistry;
  let expressionContextBuilder;
  let expressionEvaluatorService;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    container = testBed.container;
    dataRegistry = container.resolve(tokens.IDataRegistry);

    await loadLookup(dataRegistry, 'emotion_prototypes.lookup.json');
    await loadLookup(dataRegistry, 'sexual_prototypes.lookup.json');

    const emotionCalculatorService = new EmotionCalculatorService({
      logger: container.resolve(tokens.ILogger),
      dataRegistry,
    });

    testBed.setOverride(tokens.IEmotionCalculatorService, emotionCalculatorService);
    testBed.setOverride(tokens.IEntityManager, createEntityManagerStub());

    registerExpressionServices(container);

    expressionContextBuilder = container.resolve(tokens.IExpressionContextBuilder);
    expressionEvaluatorService = container.resolve(tokens.IExpressionEvaluatorService);
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('matches emotions-positive-affect:awed_transfixion with previous-state delta gates (A1)', async () => {
    const actorId = 'actor-a1';
    const expression = await loadExpressionDefinition(
      dataRegistry,
      'emotions-positive-affect:awed_transfixion'
    );

    const previousMood = {
      valence: 40,
      arousal: 60,
      engagement: 50,
      agency_control: -30,
      threat: 10,
      future_expectancy: 10,
      self_evaluation: 0,
    };
    const currentMood = {
      valence: 60,
      arousal: 70,
      engagement: 90,
      agency_control: -60,
      threat: 10,
      future_expectancy: 20,
      self_evaluation: 0,
    };

    const previousContext = expressionContextBuilder.buildContext(
      actorId,
      previousMood,
      null,
      null
    );
    const currentContext = expressionContextBuilder.buildContext(
      actorId,
      currentMood,
      null,
      buildPreviousState(previousContext)
    );

    const awe = currentContext.emotions.awe ?? 0;
    const terror = currentContext.emotions.terror ?? 0;
    const rage = currentContext.emotions.rage ?? 0;
    const surprise = currentContext.emotions.surprise_startle ?? 0;
    const euphoria = currentContext.emotions.euphoria ?? 0;
    const aweDelta = awe - (previousContext.emotions.awe ?? 0);

    expect(awe).toBeGreaterThanOrEqual(0.65);
    expect(terror).toBeLessThanOrEqual(0.35);
    expect(rage).toBeLessThanOrEqual(0.35);
    expect(surprise >= 0.25 || aweDelta >= 0.12).toBe(true);
    expect(euphoria < 0.65 || awe >= euphoria + 0.05).toBe(true);

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions:horror_revulsion with threat/disgust spikes (A2)', async () => {
    const actorId = 'actor-a2';
    const expression = await loadExpressionDefinition(
      dataRegistry,
      'emotions:horror_revulsion'
    );

    const previousMood = {
      valence: -60,
      arousal: 40,
      threat: 20,
      engagement: -10,
      agency_control: -10,
      future_expectancy: -5,
      self_evaluation: -5,
    };
    const currentMood = {
      valence: -80,
      arousal: 60,
      threat: 50,
      engagement: -20,
      agency_control: -30,
      future_expectancy: -10,
      self_evaluation: -10,
    };

    const previousContext = expressionContextBuilder.buildContext(
      actorId,
      previousMood,
      null,
      null
    );
    const currentContext = expressionContextBuilder.buildContext(
      actorId,
      currentMood,
      null,
      buildPreviousState(previousContext)
    );

    const disgust = currentContext.emotions.disgust ?? 0;
    const fear = currentContext.emotions.fear ?? 0;
    const alarm = currentContext.emotions.alarm ?? 0;
    const terror = currentContext.emotions.terror ?? 0;
    const disgustDelta = disgust - (previousContext.emotions.disgust ?? 0);
    const threatDelta =
      currentContext.moodAxes.threat - previousContext.moodAxes.threat;
    const fearDelta = fear - (previousContext.emotions.fear ?? 0);
    const scaledDisgustDelta = disgustDelta * 100;
    const scaledFearDelta = fearDelta * 100;
    const maxDelta = Math.max(scaledDisgustDelta, threatDelta, scaledFearDelta);

    expect(disgust).toBeGreaterThanOrEqual(0.6);
    expect(fear >= 0.35 || alarm >= 0.35).toBe(true);
    expect(terror).toBeLessThan(0.55);
    expect(currentContext.moodAxes.threat).toBeGreaterThanOrEqual(25);
    expect(currentContext.moodAxes.valence).toBeLessThanOrEqual(-20);
    expect(maxDelta).toBeGreaterThanOrEqual(12);

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions:steeled_courage with rising courage or determination (A3)', async () => {
    const actorId = 'actor-a3';
    const expression = await loadExpressionDefinition(
      dataRegistry,
      'emotions:steeled_courage'
    );

    const previousMood = {
      valence: -80,
      arousal: 70,
      threat: 80,
      agency_control: 30,
      future_expectancy: 10,
      engagement: 10,
      self_evaluation: 0,
    };
    const currentMood = {
      valence: -80,
      arousal: 90,
      threat: 90,
      agency_control: 50,
      future_expectancy: 20,
      engagement: 20,
      self_evaluation: 0,
    };

    const previousContext = expressionContextBuilder.buildContext(
      actorId,
      previousMood,
      null,
      null
    );
    const currentContext = expressionContextBuilder.buildContext(
      actorId,
      currentMood,
      null,
      buildPreviousState(previousContext)
    );

    const courage = currentContext.emotions.courage ?? 0;
    const fear = currentContext.emotions.fear ?? 0;
    const determination = currentContext.emotions.determination ?? 0;
    const terror = currentContext.emotions.terror ?? 0;
    const courageDelta = courage - (previousContext.emotions.courage ?? 0);
    const determinationDelta =
      determination - (previousContext.emotions.determination ?? 0);

    expect(courage).toBeGreaterThanOrEqual(0.6);
    expect(fear).toBeGreaterThanOrEqual(0.45);
    expect(determination).toBeGreaterThanOrEqual(0.4);
    expect(terror).toBeLessThan(0.6);
    expect(Math.max(courageDelta, determinationDelta)).toBeGreaterThanOrEqual(
      0.1
    );

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions-positive-affect:sigh_of_relief with relief spike and fear drop (A4)', async () => {
    const actorId = 'actor-a4';
    const expression = await loadExpressionDefinition(
      dataRegistry,
      'emotions-positive-affect:sigh_of_relief'
    );

    const previousMood = {
      valence: -40,
      arousal: 40,
      threat: 50,
      agency_control: -20,
      engagement: 10,
      future_expectancy: -10,
      self_evaluation: -10,
    };
    const currentMood = {
      valence: 80,
      arousal: -10,
      threat: -80,
      agency_control: 0,
      engagement: 0,
      future_expectancy: 20,
      self_evaluation: 10,
    };

    const previousContext = expressionContextBuilder.buildContext(
      actorId,
      previousMood,
      null,
      null
    );
    const currentContext = expressionContextBuilder.buildContext(
      actorId,
      currentMood,
      null,
      buildPreviousState(previousContext)
    );

    const relief = currentContext.emotions.relief ?? 0;
    const fear = currentContext.emotions.fear ?? 0;
    const previousFear = previousContext.emotions.fear ?? 0;
    const reliefDelta = relief - (previousContext.emotions.relief ?? 0);
    const fearDelta = fear - previousFear;

    expect(relief).toBeGreaterThanOrEqual(0.55);
    expect(previousFear).toBeGreaterThanOrEqual(0.25);
    expect(fear).toBeLessThanOrEqual(0.2);
    expect(reliefDelta).toBeGreaterThanOrEqual(0.15);
    expect(fearDelta).toBeLessThanOrEqual(-0.2);

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions:dissociation with numbness spike and interest drop (A5)', async () => {
    const actorId = 'actor-a5';
    const expression = await loadExpressionDefinition(
      dataRegistry,
      'emotions:dissociation'
    );

    const previousMood = {
      valence: 0,
      arousal: -10,
      engagement: 40,
      agency_control: 0,
      future_expectancy: 0,
      threat: 0,
      self_evaluation: 0,
    };
    const currentMood = {
      valence: -40,
      arousal: -100,
      engagement: -20,
      agency_control: -20,
      future_expectancy: -40,
      threat: 100,
      self_evaluation: 0,
    };

    const previousContext = expressionContextBuilder.buildContext(
      actorId,
      previousMood,
      null,
      null
    );
    const currentContext = expressionContextBuilder.buildContext(
      actorId,
      currentMood,
      null,
      buildPreviousState(previousContext)
    );

    const numbness = currentContext.emotions.numbness ?? 0;
    const numbnessDelta = numbness - (previousContext.emotions.numbness ?? 0);
    const interestDelta =
      (currentContext.emotions.interest ?? 0) -
      (previousContext.emotions.interest ?? 0);

    expect(numbness).toBeGreaterThanOrEqual(0.6);
    expect(numbnessDelta).toBeGreaterThanOrEqual(0.2);
    expect(interestDelta).toBeLessThanOrEqual(-0.2);

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions:aroused_but_ashamed_conflict with sexual composites (B1)', async () => {
    const actorId = 'actor-b1';
    const expression = await loadExpressionDefinition(
      dataRegistry,
      'emotions:aroused_but_ashamed_conflict'
    );

    const currentMood = {
      valence: -10,
      arousal: 100,
      agency_control: -100,
      threat: 30,
      engagement: 90,
      self_evaluation: -40,
      future_expectancy: 0,
    };
    const sexualState = {
      sex_excitation: 100,
      sex_inhibition: 0,
      baseline_libido: 0,
    };

    const currentContext = expressionContextBuilder.buildContext(
      actorId,
      currentMood,
      sexualState,
      null
    );

    const arousalComposite =
      currentContext.sexualStates.aroused_with_shame ?? 0;
    const lust = currentContext.sexualStates.sexual_lust ?? 0;
    const shame = currentContext.emotions.shame ?? 0;

    expect(currentContext.sexualArousal).toBe(1);
    expect(arousalComposite).toBeGreaterThanOrEqual(0.65);
    expect(lust).toBeGreaterThanOrEqual(0.45);
    expect(shame).toBeGreaterThanOrEqual(0.45);

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });
});
