/**
 * @file Integration tests for complex expression prerequisites (Suite A1-A5, B1).
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { registerExpressionServices } from '../../../src/dependencyInjection/registrations/expressionsRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

const createTestExpression = ({
  id,
  priority = 100,
  prerequisites = [],
  descriptionText = '{actor} reacts to a test trigger.',
  actorDescription = 'Test actor description.',
} = {}) => ({
  $schema: 'schema://living-narrative-engine/expression.schema.json',
  id,
  description: 'Test expression',
  priority,
  prerequisites,
  actor_description: actorDescription,
  description_text: descriptionText,
});

const storeExpression = (dataRegistry, expression) => {
  dataRegistry.store('expressions', expression.id, expression);
  return expression;
};

describe('Complex Expression Prerequisites - Suite A + B', () => {
  let testBed;
  let container;
  let dataRegistry;
  let expressionEvaluatorService;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    container = testBed.container;
    dataRegistry = container.resolve(tokens.IDataRegistry);

    registerExpressionServices(container);

    expressionEvaluatorService = container.resolve(tokens.IExpressionEvaluatorService);
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('matches emotions-elevation:awed_transfixion with previous-state delta gates (A1)', async () => {
    const actorId = 'actor-a1';
    const expression = storeExpression(
      dataRegistry,
      createTestExpression({
        id: 'test:awed_transfixion',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.awe' }, 0.65] },
                { '<=': [{ var: 'emotions.terror' }, 0.35] },
                { '<=': [{ var: 'emotions.rage' }, 0.35] },
                {
                  or: [
                    { '>=': [{ var: 'emotions.surprise_startle' }, 0.25] },
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'emotions.awe' },
                            { var: 'previousEmotions.awe' },
                          ],
                        },
                        0.12,
                      ],
                    },
                  ],
                },
                {
                  or: [
                    { '<': [{ var: 'emotions.euphoria' }, 0.65] },
                    {
                      '>=': [
                        { var: 'emotions.awe' },
                        {
                          '+': [{ var: 'emotions.euphoria' }, 0.05],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    );

    const currentContext = {
      actor: { entityId: actorId },
      emotions: {
        awe: 0.7,
        terror: 0.2,
        rage: 0.2,
        surprise_startle: 0.3,
        euphoria: 0.5,
      },
      sexualStates: {},
      moodAxes: {},
      sexualArousal: 0,
      previousEmotions: {
        awe: 0.55,
      },
      previousSexualStates: {},
      previousMoodAxes: {},
    };

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions-disgust:horror_revulsion with threat/disgust spikes (A2)', async () => {
    const actorId = 'actor-a2';
    const expression = storeExpression(
      dataRegistry,
      createTestExpression({
        id: 'test:horror_revulsion',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.disgust' }, 0.6] },
                {
                  or: [
                    { '>=': [{ var: 'emotions.fear' }, 0.35] },
                    { '>=': [{ var: 'emotions.alarm' }, 0.35] },
                  ],
                },
                { '<': [{ var: 'emotions.terror' }, 0.55] },
                { '>=': [{ var: 'moodAxes.threat' }, 25] },
                { '<=': [{ var: 'moodAxes.valence' }, -20] },
                {
                  or: [
                    {
                      '>=': [
                        {
                          '*': [
                            {
                              '-': [
                                { var: 'emotions.disgust' },
                                { var: 'previousEmotions.disgust' },
                              ],
                            },
                            100,
                          ],
                        },
                        12,
                      ],
                    },
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'moodAxes.threat' },
                            { var: 'previousMoodAxes.threat' },
                          ],
                        },
                        12,
                      ],
                    },
                    {
                      '>=': [
                        {
                          '*': [
                            {
                              '-': [
                                { var: 'emotions.fear' },
                                { var: 'previousEmotions.fear' },
                              ],
                            },
                            100,
                          ],
                        },
                        12,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    );

    const currentContext = {
      actor: { entityId: actorId },
      emotions: {
        disgust: 0.65,
        fear: 0.4,
        alarm: 0.2,
        terror: 0.4,
      },
      sexualStates: {},
      moodAxes: {
        threat: 30,
        valence: -30,
      },
      sexualArousal: 0,
      previousEmotions: {
        disgust: 0.5,
        fear: 0.25,
      },
      previousSexualStates: {},
      previousMoodAxes: {
        threat: 10,
      },
    };

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions-courage:steeled_courage with rising courage or determination (A3)', async () => {
    const actorId = 'actor-a3';
    const expression = storeExpression(
      dataRegistry,
      createTestExpression({
        id: 'test:steeled_courage',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.courage' }, 0.6] },
                { '>=': [{ var: 'emotions.fear' }, 0.45] },
                { '>=': [{ var: 'emotions.determination' }, 0.4] },
                { '<': [{ var: 'emotions.terror' }, 0.6] },
                {
                  or: [
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'emotions.courage' },
                            { var: 'previousEmotions.courage' },
                          ],
                        },
                        0.1,
                      ],
                    },
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'emotions.determination' },
                            { var: 'previousEmotions.determination' },
                          ],
                        },
                        0.1,
                      ],
                    },
                  ],
                },
                {
                  '>=': [
                    {
                      '-': [
                        { var: 'emotions.fear' },
                        { var: 'previousEmotions.fear' },
                      ],
                    },
                    -0.05,
                  ],
                },
              ],
            },
          },
        ],
      })
    );

    const currentContext = {
      actor: { entityId: actorId },
      emotions: {
        courage: 0.65,
        fear: 0.5,
        determination: 0.45,
        terror: 0.3,
      },
      sexualStates: {},
      moodAxes: {},
      sexualArousal: 0,
      previousEmotions: {
        courage: 0.5,
        fear: 0.45,
        determination: 0.3,
      },
      previousSexualStates: {},
      previousMoodAxes: {},
    };

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions-calm:sigh_of_relief with relief spike and fear drop (A4)', async () => {
    const actorId = 'actor-a4';
    const expression = storeExpression(
      dataRegistry,
      createTestExpression({
        id: 'test:sigh_of_relief',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.relief' }, 0.55] },
                { '>=': [{ var: 'previousEmotions.fear' }, 0.25] },
                { '<=': [{ var: 'emotions.fear' }, 0.2] },
                {
                  '>=': [
                    {
                      '-': [
                        { var: 'emotions.relief' },
                        { var: 'previousEmotions.relief' },
                      ],
                    },
                    0.15,
                  ],
                },
                {
                  '<=': [
                    {
                      '-': [
                        { var: 'emotions.fear' },
                        { var: 'previousEmotions.fear' },
                      ],
                    },
                    -0.2,
                  ],
                },
              ],
            },
          },
        ],
      })
    );

    const currentContext = {
      actor: { entityId: actorId },
      emotions: {
        relief: 0.6,
        fear: 0.15,
      },
      sexualStates: {},
      moodAxes: {},
      sexualArousal: 0,
      previousEmotions: {
        relief: 0.4,
        fear: 0.4,
      },
      previousSexualStates: {},
      previousMoodAxes: {},
    };

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions-dissociation:dissociation with dissociation + numbness state and engagement drop (A5)', async () => {
    const actorId = 'actor-a5';
    const expression = storeExpression(
      dataRegistry,
      createTestExpression({
        id: 'test:dissociation',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.dissociation' }, 0.55] },
                { '>=': [{ var: 'emotions.numbness' }, 0.5] },
                { '<=': [{ var: 'moodAxes.engagement' }, -15] },
                { '<=': [{ var: 'moodAxes.agency_control' }, -10] },
                { '<': [{ var: 'emotions.freeze' }, 0.35] },
                { '<=': [{ var: 'emotions.panic' }, 0.25] },
                { '<': [{ var: 'emotions.boredom' }, 0.6] },
                {
                  or: [
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'emotions.dissociation' },
                            { var: 'previousEmotions.dissociation' },
                          ],
                        },
                        0.1,
                      ],
                    },
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'emotions.numbness' },
                            { var: 'previousEmotions.numbness' },
                          ],
                        },
                        0.12,
                      ],
                    },
                    {
                      '<=': [
                        {
                          '-': [
                            { var: 'moodAxes.engagement' },
                            { var: 'previousMoodAxes.engagement' },
                          ],
                        },
                        -10,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    );

    const currentContext = {
      actor: { entityId: actorId },
      emotions: {
        dissociation: 0.60, // >= 0.55
        numbness: 0.55, // >= 0.50
        freeze: 0.30, // < 0.35
        panic: 0.20, // <= 0.25
        boredom: 0.40, // < 0.60
      },
      sexualStates: {},
      moodAxes: {
        engagement: -25, // <= -15
        agency_control: -20, // <= -10
        valence: -30,
        arousal: -50,
        threat: 40,
        future_expectancy: -20,
        self_evaluation: -10,
      },
      sexualArousal: 0,
      previousEmotions: {
        dissociation: 0.45,
        numbness: 0.40,
        freeze: 0.25,
        panic: 0.15,
        boredom: 0.35,
      },
      previousSexualStates: {},
      previousMoodAxes: {
        engagement: -10,
        agency_control: -5,
        valence: -10,
        arousal: -20,
        threat: 20,
        future_expectancy: -5,
        self_evaluation: 0,
      },
    };

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });

  it('matches emotions-sexual-conflict:aroused_but_ashamed_conflict with sexual composites (B1)', async () => {
    const actorId = 'actor-b1';
    const expression = storeExpression(
      dataRegistry,
      createTestExpression({
        id: 'test:aroused_but_ashamed_conflict',
        prerequisites: [
          {
            logic: {
              and: [
                { '>=': [{ var: 'emotions.shame' }, 0.4] },
                { '>=': [{ var: 'sexualStates.aroused_with_shame' }, 0.6] },
                { '>=': [{ var: 'sexualStates.sexual_lust' }, 0.35] },
                { '>=': [{ var: 'emotions.freeze' }, 0.18] },
                { '<=': [{ var: 'emotions.terror' }, 0.4] },
                { '<=': [{ var: 'emotions.panic' }, 0.2] },
                { '<=': [{ var: 'sexualStates.aroused_with_disgust' }, 0.45] },
                { '<=': [{ var: 'sexualStates.sexual_indifference' }, 0.55] },
                { '<=': [{ var: 'moodAxes.self_evaluation' }, -10] },
                {
                  and: [
                    { '>=': [{ var: 'moodAxes.threat' }, 5] },
                    { '<=': [{ var: 'moodAxes.threat' }, 60] },
                  ],
                },
                {
                  or: [
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'emotions.shame' },
                            { var: 'previousEmotions.shame' },
                          ],
                        },
                        0.06,
                      ],
                    },
                    {
                      '>=': [
                        {
                          '-': [
                            { var: 'sexualStates.aroused_with_shame' },
                            { var: 'previousSexualStates.aroused_with_shame' },
                          ],
                        },
                        0.06,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    );

    const currentContext = {
      actor: { entityId: actorId },
      emotions: {
        shame: 0.45, // >= 0.40
        embarrassment: 0.2,
        guilt: 0.2,
        freeze: 0.35, // >= 0.18 AND <= 0.70
        terror: 0.25, // <= 0.40
        panic: 0.1, // <= 0.20
      },
      sexualStates: {
        aroused_with_shame: 0.70, // >= 0.60
        sexual_lust: 0.45, // >= 0.35
        aroused_with_disgust: 0.3, // <= 0.45
        sexual_indifference: 0.2, // <= 0.55
      },
      moodAxes: {
        self_evaluation: -15, // <= -10
        threat: 25, // >= 5 AND <= 60
      },
      sexualArousal: 1,
      previousEmotions: {
        shame: 0.35,
        freeze: 0.20,
      },
      previousSexualStates: {
        aroused_with_shame: 0.55,
      },
      previousMoodAxes: {
        self_evaluation: -10,
        threat: 20,
      },
    };

    const matches = expressionEvaluatorService.evaluateAll(currentContext);
    expect(matches.map((match) => match.id)).toContain(expression.id);
  });
});
