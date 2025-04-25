// src/components/healthComponent.js

import Component from './component.js';

export class HealthComponent extends Component {
  /** @param {{current: number, max: number}} data */
  constructor(data) {
    super();
    if (!data || typeof data.current !== 'number' || typeof data.max !== 'number') {
      throw new Error("HealthComponent requires 'current' and 'max' numbers in data.");
    }
    if (data.max <= 0) {
      throw new Error("HealthComponent 'max' must be positive.");
    }
    if (data.current < 0 || data.current > data.max) {
      console.warn(`HealthComponent initial 'current' (${data.current}) outside valid range [0, ${data.max}]. Clamping.`);
      this.current = Math.max(0, Math.min(data.current, data.max));
    } else {
      this.current = data.current;
    }
    this.max = data.max;
  }
}
