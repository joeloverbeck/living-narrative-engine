import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { resolveEntityId } from '../../../src/anatomy/validation/socketExtractor.js';

const SOCKETS_COMPONENT = 'anatomy:sockets';
const PART_COMPONENT = 'anatomy:part';

const loadModEntityDefinitions = () => {
  const entitiesDir = path.join(
    process.cwd(),
    'data',
    'mods',
    'anatomy',
    'entities',
    'definitions'
  );

  return fs
    .readdirSync(entitiesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) =>
      JSON.parse(fs.readFileSync(path.join(entitiesDir, file), 'utf8'))
    );
};

const getSocketIds = (entity) =>
  entity.components?.[SOCKETS_COMPONENT]?.sockets?.map((socket) => socket.id) || [];

const hasSockets = (entity) =>
  Array.isArray(entity.components?.[SOCKETS_COMPONENT]?.sockets) &&
  entity.components[SOCKETS_COMPONENT].sockets.length > 0;

const shuffleDeterministic = (items) => {
  const result = [...items];
  let seed = 13;

  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

const buildRegistryWithEntities = (entities) => {
  const registry = new InMemoryDataRegistry();

  for (const entity of entities) {
    registry.store('entityDefinitions', entity.id, entity);
  }

  return registry;
};

describe('entityResolutionConsistency', () => {
  let testBed;
  let modEntities;
  let modRegistry;

  beforeAll(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();

    modEntities = loadModEntityDefinitions();
    modRegistry = buildRegistryWithEntities(modEntities);
  });

  afterAll(async () => {
    await testBed.cleanup();
  });

  describe('data consistency', () => {
    it('head entities with sockets expose brain_socket', () => {
      const headEntities = modEntities.filter(
        (entity) => entity.components?.[PART_COMPONENT]?.subType === 'head'
      );

      const missingBrainSocket = headEntities
        .filter(hasSockets)
        .filter((entity) => !getSocketIds(entity).includes('brain_socket'))
        .map((entity) => entity.id);

      expect(missingBrainSocket).toEqual([]);
    });

    it('all torso entities have heart_socket', () => {
      const torsoEntities = modEntities.filter(
        (entity) => entity.components?.[PART_COMPONENT]?.subType === 'torso'
      );

      const missingHeartSocket = torsoEntities
        .filter((entity) => !getSocketIds(entity).includes('heart_socket'))
        .map((entity) => entity.id);

      expect(missingHeartSocket).toEqual([]);
    });

    it('all torso entities have spine_socket', () => {
      const torsoEntities = modEntities.filter(
        (entity) => entity.components?.[PART_COMPONENT]?.subType === 'torso'
      );

      const missingSpineSocket = torsoEntities
        .filter((entity) => !getSocketIds(entity).includes('spine_socket'))
        .map((entity) => entity.id);

      expect(missingSpineSocket).toEqual([]);
    });
  });

  describe('resolution stability', () => {
    it('resolveEntityId returns consistent ID across shuffled registry order', async () => {
      const expected = await resolveEntityId('head', modRegistry);

      const reversedRegistry = buildRegistryWithEntities([...modEntities].reverse());
      const shuffledRegistry = buildRegistryWithEntities(
        shuffleDeterministic(modEntities)
      );

      const registries = [modRegistry, reversedRegistry, shuffledRegistry];

      for (const registry of registries) {
        const resolved = await resolveEntityId('head', registry);
        expect(resolved).toBe(expected);
      }
    });

    it('resolveEntityId prefers anatomy:humanoid_head for partType "head"', async () => {
      const result = await resolveEntityId('head', modRegistry);
      expect(result).toBe('anatomy:humanoid_head');
    });
  });
});
