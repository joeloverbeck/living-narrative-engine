/**
 * @file Integration tests for CharacterStorageService interacting with the real CharacterDatabase.
 * @see src/characterBuilder/services/characterStorageService.js
 */

import {
  describe,
  it,
  beforeAll,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import 'fake-indexeddb/auto';
import path from 'path';
import fs from 'fs';
import {
  CharacterStorageService,
  CharacterStorageError,
} from '../../../../src/characterBuilder/services/characterStorageService.js';
import { CharacterDatabase } from '../../../../src/characterBuilder/storage/characterDatabase.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import { createCharacterConcept } from '../../../../src/characterBuilder/models/characterConcept.js';
import { createThematicDirection } from '../../../../src/characterBuilder/models/thematicDirection.js';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'CharacterBuilder';

let conceptSchemaData;
let thematicDirectionSchemaData;

/**
 *
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 */
async function clearDatabase() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

class FlakyCharacterDatabase extends CharacterDatabase {
  constructor(dependencies, failures = { concept: 1, directions: 1 }) {
    super(dependencies);
    this._failures = { ...failures };
  }

  async saveCharacterConcept(concept) {
    if (this._failures.concept > 0) {
      this._failures.concept -= 1;
      throw new Error('Simulated transient concept failure');
    }
    return super.saveCharacterConcept(concept);
  }

  async saveThematicDirections(directions) {
    if (this._failures.directions > 0) {
      this._failures.directions -= 1;
      throw new Error('Simulated transient directions failure');
    }
    return super.saveThematicDirections(directions);
  }
}

/**
 *
 * @param root0
 * @param root0.logger
 * @param root0.schemaValidator
 * @param root0.DatabaseClass
 * @param root0.initialized
 */
async function createStorageService({
  logger,
  schemaValidator,
  DatabaseClass = CharacterDatabase,
  initialized = true,
} = {}) {
  const database = new DatabaseClass({ logger });
  const service = new CharacterStorageService({
    logger,
    database,
    schemaValidator,
  });

  if (initialized) {
    await service.initialize();
  }

  return { service, database };
}

describe('CharacterStorageService + CharacterDatabase integration', () => {
  let logger;
  let schemaValidator;

  beforeAll(() => {
    const rootDir = process.cwd();
    conceptSchemaData = JSON.parse(
      fs.readFileSync(
        path.join(rootDir, 'data/schemas/character-concept.schema.json'),
        'utf8'
      )
    );
    thematicDirectionSchemaData = JSON.parse(
      fs.readFileSync(
        path.join(rootDir, 'data/schemas/thematic-direction.schema.json'),
        'utf8'
      )
    );
  });

  beforeEach(async () => {
    jest.useRealTimers();
    await clearDatabase();
    logger = createTestLogger();
    schemaValidator = new AjvSchemaValidator({ logger });
    await schemaValidator.addSchema(
      thematicDirectionSchemaData,
      thematicDirectionSchemaData.$id
    );
    await schemaValidator.addSchema(conceptSchemaData, conceptSchemaData.$id);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await clearDatabase();
  });

  it('requires initialization before storing character concepts', async () => {
    const { service } = await createStorageService({
      logger,
      schemaValidator,
      initialized: false,
    });

    const concept = createCharacterConcept(
      'Integration guard concept with enough detail to pass validation.'
    );

    await expect(service.storeCharacterConcept(concept)).rejects.toThrow(
      CharacterStorageError
    );

    await service.close();
  });

  it('persists and retrieves concepts and thematic directions end-to-end', async () => {
    const { service } = await createStorageService({
      logger,
      schemaValidator,
    });

    await service.initialize();
    expect(logger.debug).toHaveBeenCalledWith(
      'CharacterStorageService: Already initialized'
    );

    const concept = createCharacterConcept(
      'An adventurer seeking redemption after a disastrous mission goes wrong.'
    );

    const storedConcept = await service.storeCharacterConcept(concept);
    expect(storedConcept.id).toBe(concept.id);

    const concepts = await service.listCharacterConcepts();
    expect(concepts.map((item) => item.id)).toContain(concept.id);

    const fetchedConcept = await service.getCharacterConcept(concept.id);
    expect(fetchedConcept?.concept).toBe(concept.concept);

    const missingConcept = await service.getCharacterConcept('missing-concept');
    expect(missingConcept).toBeNull();

    const emptyDirections = await service.storeThematicDirections(
      concept.id,
      []
    );
    expect(emptyDirections).toEqual([]);

    const direction = createThematicDirection(concept.id, {
      title: 'Haunted battlefield mentor',
      description:
        'The hero coaches rookies while confronting the ghosts of a failed campaign.',
      coreTension:
        'Can they keep their composure when the past resurfaces at the worst moment?',
      uniqueTwist:
        'Their combat insight manifests as phantom projections that others can see.',
      narrativePotential:
        'Opens storylines about teaching, legacy, and confronting generational trauma.',
    });

    const storedDirections = await service.storeThematicDirections(concept.id, [
      direction,
    ]);
    expect(storedDirections).toHaveLength(1);

    const byConcept = await service.getThematicDirections(concept.id);
    expect(byConcept[0].id).toBe(direction.id);

    const allDirections = await service.getAllThematicDirections();
    expect(allDirections.map((item) => item.id)).toContain(direction.id);

    const updatedDirection = await service.updateThematicDirection(
      direction.id,
      {
        uniqueTwist:
          'Their phantom projections evolve, revealing futures they desperately hope to avoid.',
      }
    );
    expect(updatedDirection.uniqueTwist).toContain('phantom projections');

    const fetchedDirection = await service.getThematicDirection(direction.id);
    expect(fetchedDirection?.uniqueTwist).toBe(updatedDirection.uniqueTwist);

    const deleteDirectionResult = await service.deleteThematicDirection(
      direction.id
    );
    expect(deleteDirectionResult).toBe(true);

    const afterDeleteDirections = await service.getThematicDirections(
      concept.id
    );
    expect(afterDeleteDirections).toEqual([]);

    const orphanConceptId = uuidv4();
    const orphanDirection = createThematicDirection(orphanConceptId, {
      title: 'Echo of a forgotten comrade',
      description:
        'A mysterious ally mirrors the protagonist but vanishes whenever the past is discussed.',
      coreTension:
        'Will the hero uncover who the echo truly is before enemies exploit the bond?',
      uniqueTwist:
        'The echo reacts to unspoken emotions, changing tactics without verbal cues.',
      narrativePotential:
        'Allows arcs about unreliable memories, found family, and the cost of secrecy.',
    });

    await service.storeThematicDirections(orphanConceptId, [orphanDirection]);
    const orphaned = await service.findOrphanedDirections();
    expect(orphaned.map((item) => item.id)).toContain(orphanDirection.id);

    await service.deleteThematicDirection(orphanDirection.id);

    const deleteConceptResult = await service.deleteCharacterConcept(
      concept.id
    );
    expect(deleteConceptResult).toBe(true);

    const afterDeleteConcept = await service.getCharacterConcept(concept.id);
    expect(afterDeleteConcept).toBeNull();

    await service.close();
  });

  it('surfaces schema validation errors for invalid thematic directions', async () => {
    const { service } = await createStorageService({
      logger,
      schemaValidator,
    });

    const concept = createCharacterConcept(
      'A patient strategist whose calm demeanor hides decades of conflict.'
    );

    await service.storeCharacterConcept(concept);

    const invalidDirection = {
      id: 'invalid-direction',
      conceptId: concept.id,
      title: 'bad',
      description: 'too short to satisfy schema requirements',
      coreTension: 'short text',
      uniqueTwist: 'brief',
      narrativePotential: 'tiny',
      createdAt: new Date().toISOString(),
      llmMetadata: {},
    };

    await expect(
      service.storeThematicDirections(concept.id, [invalidDirection])
    ).rejects.toThrow('Thematic direction validation failed');

    await service.close();
  });

  it('retries transient database failures when storing data', async () => {
    const { service } = await createStorageService({
      logger,
      schemaValidator,
      DatabaseClass: FlakyCharacterDatabase,
    });

    const concept = createCharacterConcept(
      'A relentless archivist who rebuilds lost histories for a fractured realm.'
    );

    const storedConcept = await service.storeCharacterConcept(concept);
    expect(storedConcept.id).toBe(concept.id);

    const resilientDirection = createThematicDirection(concept.id, {
      title: 'Restoring forgotten bloodlines',
      description:
        'The archivist uncovers heirs to long-fallen houses, inviting both hope and conflict.',
      coreTension:
        'Will revitalizing the past destabilize the alliances keeping the peace?',
      uniqueTwist:
        'Recovered memories manifest as spectral advisors only the archivist can see.',
      narrativePotential:
        'Creates new political factions while forcing the archivist to choose between duty and serenity.',
    });

    const directions = await service.storeThematicDirections(concept.id, [
      resilientDirection,
    ]);
    expect(directions).toHaveLength(1);

    // Ensure warnings captured from retries
    expect(logger.warn).toHaveBeenCalled();

    await service.close();
  });
});
