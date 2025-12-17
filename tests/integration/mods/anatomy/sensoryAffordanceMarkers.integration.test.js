/**
 * @file Ensures sensory affordance marker components are present on canonical anatomy entities.
 *
 * This is a content-level invariant test: if these markers are missing, the perception system
 * may incorrectly conclude actors cannot hear/see/smell even when the anatomy includes organs.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const ANATOMY_DEFINITIONS_PATH = path.resolve(
  process.cwd(),
  'data/mods/anatomy/entities/definitions'
);

function loadEntityFile(filename) {
  const filePath = path.join(ANATOMY_DEFINITIONS_PATH, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

describe('DATDRISENAFF: Sensory affordance marker components (anatomy mod)', () => {
  it('adds anatomy:provides_hearing to anatomy:humanoid_ear', () => {
    const entity = loadEntityFile('humanoid_ear.entity.json');

    expect(entity.id).toBe('anatomy:humanoid_ear');
    expect(entity.components).toBeDefined();

    expect(entity.components['anatomy:provides_hearing']).toEqual({});
  });

  it.each([
    ['humanoid_nose.entity.json', 'anatomy:humanoid_nose'],
    ['humanoid_nose_small.entity.json', 'anatomy:humanoid_nose_small'],
    ['humanoid_nose_scarred.entity.json', 'anatomy:humanoid_nose_scarred'],
  ])('adds anatomy:provides_smell to %s', (filename, expectedId) => {
    const entity = loadEntityFile(filename);

    expect(entity.id).toBe(expectedId);
    expect(entity.components).toBeDefined();

    expect(entity.components['anatomy:provides_smell']).toEqual({});
  });
});
