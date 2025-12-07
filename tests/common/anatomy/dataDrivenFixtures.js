/**
 * @file Shared helpers for constructing data-driven anatomy fixtures from authored definitions.
 */

import { ModEntityBuilder } from '../mods/ModEntityBuilder.js';
import humanFemaleTorsoDefinition from '../../../data/mods/anatomy/entities/definitions/human_female_torso.entity.json' assert { type: 'json' };
import humanoidHeadDefinition from '../../../data/mods/anatomy/entities/definitions/humanoid_head.entity.json' assert { type: 'json' };
import humanHeartDefinition from '../../../data/mods/anatomy/entities/definitions/human_heart.entity.json' assert { type: 'json' };
import humanBrainDefinition from '../../../data/mods/anatomy/entities/definitions/human_brain.entity.json' assert { type: 'json' };
import humanSpineDefinition from '../../../data/mods/anatomy/entities/definitions/human_spine.entity.json' assert { type: 'json' };

const cloneComponents = (definition) =>
  JSON.parse(JSON.stringify(definition.components || {}));

const normalizePart = (components) => {
  if (!components['anatomy:part']) {
    return components;
  }
  const part = components['anatomy:part'];
  components['anatomy:part'] = {
    type: part.type || part.subType,
    ...part,
  };
  return components;
};

const normalizeHealth = (definitionHealth, overrideHealth) => {
  if (typeof overrideHealth !== 'number') {
    return definitionHealth;
  }
  return {
    ...definitionHealth,
    currentHealth: overrideHealth,
    maxHealth: overrideHealth,
  };
};

export const HUMAN_PART_DEFINITIONS = {
  torso: humanFemaleTorsoDefinition,
  head: humanoidHeadDefinition,
  heart: humanHeartDefinition,
  brain: humanBrainDefinition,
  spine: humanSpineDefinition,
};

export const BASE_HEALTHS = {
  torso:
    humanFemaleTorsoDefinition.components['anatomy:part_health']
      ?.currentHealth || 0,
  head:
    humanoidHeadDefinition.components['anatomy:part_health']?.currentHealth ||
    0,
  heart:
    humanHeartDefinition.components['anatomy:part_health']?.currentHealth || 0,
  brain:
    humanBrainDefinition.components['anatomy:part_health']?.currentHealth || 0,
  spine:
    humanSpineDefinition.components['anatomy:part_health']?.currentHealth || 0,
};

export const VITAL_ORGAN_TYPES = new Set(
  ['heart', 'brain', 'spine'].filter((key) => {
    const def = HUMAN_PART_DEFINITIONS[key];
    return Boolean(def?.components?.['anatomy:vital_organ']?.organType);
  })
);

/**
 * Instantiates an authored part definition into an entity object.
 */
export const instantiatePart = (
  definition,
  id,
  { parentId, socketId, healthOverride, killOnDestroy, name, extraComponents } = {}
) => {
  const components = normalizePart(cloneComponents(definition));
  if (components['anatomy:part_health']) {
    components['anatomy:part_health'] = normalizeHealth(
      components['anatomy:part_health'],
      healthOverride
    );
  }
  if (
    components['anatomy:vital_organ'] &&
    typeof killOnDestroy === 'boolean'
  ) {
    components['anatomy:vital_organ'] = {
      ...components['anatomy:vital_organ'],
      killOnDestroy,
    };
  }

  const builder = new ModEntityBuilder(id).withComponents(components);

  if (name) {
    builder.withName(name);
  }

  if (parentId && socketId) {
    builder.withComponent('anatomy:joint', { parentId, socketId });
  }

  if (extraComponents) {
    builder.withComponents(extraComponents);
  }

  return builder.build();
};

export const buildHumanTorsoWithHeart = (rulesOverride) => {
  const torso = instantiatePart(humanFemaleTorsoDefinition, 'torso', {
    extraComponents: rulesOverride
      ? { 'anatomy:damage_propagation': { rules: rulesOverride } }
      : undefined,
  });

  const heart = instantiatePart(humanHeartDefinition, 'heart', {
    parentId: torso.id,
    socketId: 'heart_socket',
  });

  return { torso, heart };
};

export const buildHumanHeadWithBrain = () => {
  const head = instantiatePart(humanoidHeadDefinition, 'head');
  const brain = instantiatePart(humanBrainDefinition, 'brain', {
    parentId: head.id,
    socketId: 'brain_socket',
  });
  return { head, brain };
};

export const buildHumanTorsoWithHeartAndSpine = (rulesOverride) => {
  const { torso, heart } = buildHumanTorsoWithHeart(rulesOverride);
  const spine = instantiatePart(humanSpineDefinition, 'spine', {
    parentId: torso.id,
    socketId: 'spine_socket',
  });
  return { torso, heart, spine };
};

export const buildHumanVitalsGraph = ({
  actorId = 'victim',
  healthOverrides = {},
  killOnDestroyOverrides = {},
} = {}) => {
  const torso = instantiatePart(
    humanFemaleTorsoDefinition,
    `${actorId}-torso`,
    { healthOverride: healthOverrides.torso }
  );

  const head = instantiatePart(humanoidHeadDefinition, `${actorId}-head`, {
    parentId: torso.id,
    socketId: 'neck',
    healthOverride: healthOverrides.head,
  });

  const heart = instantiatePart(humanHeartDefinition, `${actorId}-heart`, {
    parentId: torso.id,
    socketId: 'heart_socket',
    healthOverride: healthOverrides.heart,
    killOnDestroy: killOnDestroyOverrides.heart,
  });

  const brain = instantiatePart(humanBrainDefinition, `${actorId}-brain`, {
    parentId: head.id,
    socketId: 'brain_socket',
    healthOverride: healthOverrides.brain,
    killOnDestroy: killOnDestroyOverrides.brain,
  });

  const spine = instantiatePart(humanSpineDefinition, `${actorId}-spine`, {
    parentId: torso.id,
    socketId: 'spine_socket',
    healthOverride: healthOverrides.spine,
    killOnDestroy: killOnDestroyOverrides.spine,
  });

  return { torso, head, heart, brain, spine };
};
