import { describe, it, expect } from '@jest/globals';
import '../../../src/ports/IIdGenerator.js';
import '../../../src/ports/IComponentCloner.js';
import { IEntityRepository } from '../../../src/ports/iEntityRepository.js';
import { IDefaultComponentPolicy } from '../../../src/ports/iDefaultComponentPolicy.js';

describe('Core port interfaces', () => {
  it('IEntityRepository methods throw when not implemented', () => {
    const repo = new IEntityRepository();
    expect(() => repo.add({})).toThrow('Interface method');
    expect(() => repo.get('id')).toThrow('Interface method');
    expect(() => repo.has('id')).toThrow('Interface method');
    expect(() => repo.remove('id')).toThrow('Interface method');
    expect(() => repo.clear()).toThrow('Interface method');
    expect(() => repo.entities()).toThrow('Interface method');
  });

  it('IDefaultComponentPolicy.apply throws when not implemented', () => {
    const policy = new IDefaultComponentPolicy();
    expect(() => policy.apply({})).toThrow('Interface method');
  });
});
