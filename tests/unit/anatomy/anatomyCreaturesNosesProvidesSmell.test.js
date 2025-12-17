import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('anatomy-creatures nose entities provide smell', () => {
  const noseEntities = [
    {
      file: 'beaver_folk_nose.entity.json',
      subType: 'nose',
    },
    {
      file: 'cat_folk_nose.entity.json',
      subType: 'nose',
    },
    {
      file: 'hyena_muzzle.entity.json',
      subType: 'nose',
    },
    {
      file: 'newt_nostril.entity.json',
      subType: 'nose',
    },
    {
      file: 'toad_nostril.entity.json',
      subType: 'nose',
    },
  ];

  const definitionsDir = path.join(
    process.cwd(),
    'data/mods/anatomy-creatures/entities/definitions'
  );

  it.each(noseEntities)(
    'adds anatomy:provides_smell to $file (subType=$subType)',
    async ({ file, subType }) => {
      const content = await fs.readFile(path.join(definitionsDir, file), 'utf-8');
      const entity = JSON.parse(content);

      expect(entity.components).toHaveProperty('anatomy:part');
      expect(entity.components['anatomy:part']).toHaveProperty('subType', subType);

      expect(entity.components).toHaveProperty('anatomy:provides_smell');
      expect(entity.components['anatomy:provides_smell']).toEqual({});
    }
  );
});

