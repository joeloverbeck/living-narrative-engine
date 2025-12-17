import { describe, it, expect } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';

describe('anatomy-creatures ear entities provide hearing', () => {
  const earEntities = [
    {
      file: 'badger_ear.entity.json',
      subType: 'ear',
    },
    {
      file: 'cat_ear.entity.json',
      subType: 'ear',
    },
    {
      file: 'cat_ear_decorated.entity.json',
      subType: 'ear',
    },
    {
      file: 'cat_ear_mottled_brown_gray.entity.json',
      subType: 'ear',
    },
    {
      file: 'ermine_ear.entity.json',
      subType: 'ear',
    },
    {
      file: 'hyena_ear.entity.json',
      subType: 'ear',
    },
    {
      file: 'newt_tympanum.entity.json',
      subType: 'ear',
    },
    {
      file: 'toad_tympanum.entity.json',
      subType: 'ear',
    },
  ];

  const definitionsDir = path.join(
    process.cwd(),
    'data/mods/anatomy-creatures/entities/definitions'
  );

  it.each(earEntities)(
    'adds anatomy:provides_hearing to $file (subType=$subType)',
    async ({ file, subType }) => {
      const content = await fs.readFile(path.join(definitionsDir, file), 'utf-8');
      const entity = JSON.parse(content);

      expect(entity.components).toHaveProperty('anatomy:part');
      expect(entity.components['anatomy:part']).toHaveProperty('subType', subType);

      expect(entity.components).toHaveProperty('anatomy:provides_hearing');
      expect(entity.components['anatomy:provides_hearing']).toEqual({});
    }
  );
});

