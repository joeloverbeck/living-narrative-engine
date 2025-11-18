const BASE_ACTIVITY_COMPONENTS = {
  'core:gender': {
    id: 'core:gender',
    dataSchema: { type: 'object', properties: { value: { type: 'string' } } },
  },
  'positioning:closeness': {
    id: 'positioning:closeness',
    dataSchema: {
      type: 'object',
      properties: {
        partners: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  'test:activity_kneeling': {
    id: 'test:activity_kneeling',
    dataSchema: {
      type: 'object',
      properties: {
        entityId: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:activity_holding_hands': {
    id: 'test:activity_holding_hands',
    dataSchema: {
      type: 'object',
      properties: {
        partner: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
  'test:activity_gazing': {
    id: 'test:activity_gazing',
    dataSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  },
};

/**
 *
 * @param id
 */
function createGenericActivityDefinition(id) {
  return {
    id,
    dataSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        activityMetadata: { type: 'object' },
      },
    },
  };
}

const GENERIC_COMPONENT_IDS = [
  'test:activity_generic',
  'test:activity_generic_alt1',
  'test:activity_generic_alt2',
  'test:activity_generic_alt3',
  'test:activity_generic_alt4',
  'test:activity_generic_alt5',
  'test:activity_generic_alt6',
  'test:activity_generic_alt7',
  'test:activity_generic_alt8',
  'test:activity_generic_alt9',
  'test:activity_generic_0',
  'test:activity_generic_1',
  'test:activity_generic_2',
  'test:activity_generic_3',
  'test:activity_generic_4',
  'test:activity_generic_5',
  'test:activity_generic_6',
  'test:activity_generic_7',
  'test:activity_generic_8',
  'test:activity_generic_9',
];

export const ACTIVITY_COMPONENTS = GENERIC_COMPONENT_IDS.reduce(
  (components, id) => {
    components[id] = createGenericActivityDefinition(id);
    return components;
  },
  { ...BASE_ACTIVITY_COMPONENTS }
);

/**
 *
 * @param testBed
 */
export function registerActivityComponents(testBed) {
  testBed.loadComponents(ACTIVITY_COMPONENTS);
}

/**
 *
 * @param entityManager
 * @param root0
 * @param root0.id
 * @param root0.name
 * @param root0.gender
 */
export async function createActor(entityManager, { id, name, gender }) {
  const entity = await entityManager.createEntityInstance('core:actor', {
    instanceId: id,
  });

  if (name) {
    entityManager.addComponent(entity.id, 'core:name', { text: name });
  }

  if (gender) {
    entityManager.addComponent(entity.id, 'core:gender', { value: gender });
  }

  return entity;
}

/**
 *
 * @param entityManager
 * @param actorId
 * @param componentId
 * @param root0
 * @param root0.targetId
 * @param root0.template
 * @param root0.priority
 * @param root0.grouping
 * @param root0.targetRole
 */
export function addInlineActivity(
  entityManager,
  actorId,
  componentId,
  { targetId, template, priority, grouping, targetRole = 'entityId' }
) {
  const componentData = {};

  if (targetId && targetRole) {
    componentData[targetRole] = targetId;
  }

  componentData.activityMetadata = {
    shouldDescribeInActivity: true,
    template,
    priority,
    targetRole,
    grouping,
  };

  entityManager.addComponent(actorId, componentId, componentData);
}

export const DEFAULT_ACTIVITY_FORMATTING_CONFIG = {
  prefix: 'Activity: ',
  suffix: '',
  separator: '. ',
  maxActivities: 10,
  enableContextAwareness: true,
  nameResolution: {
    usePronounsWhenAvailable: true,
    fallbackToNames: true,
  },
};

/**
 *
 * @param formattingService
 * @param overrides
 */
export function configureActivityFormatting(formattingService, overrides = {}) {
  formattingService.getActivityIntegrationConfig = () => {
    const baseConfig = {
      ...DEFAULT_ACTIVITY_FORMATTING_CONFIG,
      ...overrides,
    };

    baseConfig.nameResolution = {
      ...DEFAULT_ACTIVITY_FORMATTING_CONFIG.nameResolution,
      ...overrides.nameResolution,
    };

    return baseConfig;
  };
}
