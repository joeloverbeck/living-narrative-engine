import { jest } from '@jest/globals';
import { TraitsGeneratorController } from '../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import { TraitsDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';

const defaultDirectionItem = {
  direction: {
    id: 'dir-1',
    title:
      'A remarkably elaborate thematic direction title that should be truncated for display purposes',
    description: 'A direction focused on resilience and curiosity.',
    conceptId: 'concept-1',
    concept: 'Resilience',
    createdAt: new Date().toISOString(),
  },
  concept: {
    id: 'concept-1',
    concept: 'Resilience in adversity',
    name: 'Resilience Concept',
  },
};

const defaultMotivations = [
  {
    id: 'mot-1',
    directionId: 'dir-1',
    conceptId: 'concept-1',
    coreDesire: 'To inspire communities to rebuild together',
    internalContradiction:
      'Leads boldly but quietly fears the sacrifices that leadership demands',
    centralQuestion: 'How much of themselves must they give to heal their world?',
  },
];

const defaultCliche = {
  id: 'cliche-1',
  directionId: 'dir-1',
  conceptId: 'concept-1',
  categories: {
    archetypes: ['The bridge-builder'],
    conflicts: ['Balancing hope and exhaustion'],
  },
  createdAt: new Date().toISOString(),
};

const comprehensiveTraits = {
  id: 'traits-1',
  generatedAt: new Date().toISOString(),
  names: [
    { name: 'Alden', justification: 'Echoes their relentless warmth' },
    { name: 'Lyra', justification: 'Guides others like a constellation' },
  ],
  physicalDescription: 'Tall, ink-stained hands, and observant eyes that rarely miss detail.',
  personality: [
    { trait: 'Curious', explanation: 'Collects stories from every traveler met.' },
    { trait: 'Resilient', explanation: 'Continues planning even after setbacks.' },
  ],
  strengths: ['Strategic empathy', 'Creative problem solving'],
  weaknesses: ['Sleepless planning', 'Reluctance to delegate'],
  likes: ['Restoring forgotten gardens', 'Sunrise planning sessions'],
  dislikes: ['Grandstanding speeches', 'Wasted potential'],
  fears: ['Failing their community', 'Watching allies give up'],
  goals: {
    shortTerm: ['Secure safe shelters', 'Organize mutual aid circles'],
    longTerm: 'Ignite a sustainable renaissance for their city.',
  },
  notes: ['Keeps sketches of every settlement visited', 'Hums ancestral lullabies'],
  profile: 'A wandering strategist rebuilding hope through collaboration.',
  secrets: ['Smuggled archives out of hostile territory', 'Masked true heritage for safety'],
};

class TestLogger {
  constructor() {
    this.debug = jest.fn();
    this.info = jest.fn();
    this.warn = jest.fn();
    this.error = jest.fn();
  }
}

class TestEventBus {
  constructor() {
    this.events = [];
  }

  dispatch(name, payload) {
    this.events.push({ name, payload });
  }

  subscribe() {}

  unsubscribe() {}
}

class TestSchemaValidator {
  validate() {
    return { isValid: true, errors: [] };
  }

  validateAgainstSchema() {
    return { isValid: true, errors: [] };
  }

  async addSchema() {
    return true;
  }

  isSchemaLoaded() {
    return true;
  }

  formatAjvErrors(errors) {
    return Array.isArray(errors) ? errors.join(', ') : '';
  }
}

class TestCharacterBuilderService {
  constructor({ directions, clichesByDirection, motivationsByDirection, traitsResolver }) {
    this.directions = directions;
    this.clichesByDirection = clichesByDirection;
    this.motivationsByDirection = motivationsByDirection;
    this.traitsResolver = traitsResolver;
    this.generateTraitsCalls = [];
  }

  async initialize() {}

  async getAllCharacterConcepts() {
    return [];
  }

  async createCharacterConcept() {
    return {};
  }

  async updateCharacterConcept() {
    return {};
  }

  async deleteCharacterConcept() {
    return true;
  }

  async getCharacterConcept() {
    return null;
  }

  async generateThematicDirections() {
    return [];
  }

  async getThematicDirections() {
    return [];
  }

  async getAllThematicDirectionsWithConcepts() {
    return this.directions;
  }

  async hasClichesForDirection(directionId) {
    return this.clichesByDirection.has(directionId);
  }

  async getCoreMotivationsByDirectionId(directionId) {
    return this.motivationsByDirection.get(directionId) || [];
  }

  async getClichesByDirectionId(directionId) {
    return this.clichesByDirection.get(directionId) || null;
  }

  async generateTraits(params) {
    this.generateTraitsCalls.push(params);
    if (!this.traitsResolver) {
      return null;
    }
    return await this.traitsResolver(params);
  }

  setTraitsResolver(resolver) {
    this.traitsResolver = resolver;
  }
}

function createTraitsGeneratorDOM({ includeResultsContainer = true } = {}) {
  document.body.innerHTML = `
    <div id="traits-generator-root">
      <div class="form-section">
        <div class="cb-form-group">
          <select id="direction-selector">
            <option value="">Select a thematic direction</option>
          </select>
          <div id="direction-selector-error"></div>
        </div>
        <div id="selected-direction-display" style="display: none;">
          <h2 id="direction-title"></h2>
          <p id="direction-description"></p>
        </div>
        <div id="core-motivations-panel" style="display: none;">
          <div id="core-motivations-list"></div>
        </div>
        <textarea id="core-motivation-input"></textarea>
        <textarea id="internal-contradiction-input"></textarea>
        <textarea id="central-question-input"></textarea>
        <div id="input-validation-error"></div>
        <div id="user-input-summary"></div>
        <button id="generate-btn">Generate</button>
        <button id="export-btn" style="display: none;">Export</button>
        <button id="clear-btn">Clear</button>
        <button id="back-btn">Back</button>
      </div>
      <div id="empty-state" class="cb-empty-state" style="display: none;"></div>
      <div id="loading-state" class="cb-loading-state" style="display: none;">
        <p id="loading-message"></p>
      </div>
      <div id="error-state" class="cb-error-state" style="display: none;">
        <p id="error-message-text"></p>
      </div>
      <div id="results-state" class="cb-results-state" style="display: none;">
        ${
          includeResultsContainer
            ? '<div id="traits-results"></div>'
            : '<div class="missing-results-placeholder"></div>'
        }
      </div>
      <div id="screen-reader-announcement"></div>
    </div>
  `;
}

function createControllerSetup({
  directions = [defaultDirectionItem],
  motivations = new Map([[defaultDirectionItem.direction.id, defaultMotivations]]),
  cliches = new Map([[defaultDirectionItem.direction.id, defaultCliche]]),
  traitsResolver = async () => comprehensiveTraits,
  includeResultsContainer = true,
  traitsDisplayEnhancerFactory,
} = {}) {
  createTraitsGeneratorDOM({ includeResultsContainer });
  const logger = new TestLogger();
  const eventBus = new TestEventBus();
  const schemaValidator = new TestSchemaValidator();
  const service = new TestCharacterBuilderService({
    directions,
    clichesByDirection: cliches,
    motivationsByDirection: motivations,
    traitsResolver,
  });
  const traitsDisplayEnhancer =
    typeof traitsDisplayEnhancerFactory === 'function'
      ? traitsDisplayEnhancerFactory({ logger })
      : new TraitsDisplayEnhancer({ logger });
  const controller = new TraitsGeneratorController({
    logger,
    characterBuilderService: service,
    eventBus,
    schemaValidator,
    traitsDisplayEnhancer,
  });
  return { controller, logger, eventBus, schemaValidator, service };
}

async function flushMicrotasksOnly() {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushAsyncOperations() {
  await flushMicrotasksOnly();
  jest.runOnlyPendingTimers();
  await flushMicrotasksOnly();
}

async function initializeAndSettle(controller) {
  await controller.initialize();
  await flushAsyncOperations();
}

export {
  comprehensiveTraits,
  createControllerSetup,
  createTraitsGeneratorDOM,
  defaultCliche,
  defaultDirectionItem,
  defaultMotivations,
  flushAsyncOperations,
  flushMicrotasksOnly,
  initializeAndSettle,
};
