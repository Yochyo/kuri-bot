// Currency class fetches currency rates from fixer.io and caches the result.
// Data is stored in memory and on disk (at data/cache/currency.json).
// The cache is invalidated after 12 hours.
// A valid fixer API key is required. The free tier is sufficient.

import * as env from '../utils/env';
import {Cache} from '../utils/cache';
import { Mutex } from '../utils/mutex';

type CurrencyRates = Record<string, number>;

interface FixerResponse {
  success: boolean;
  error?: {info: string; type: number};
  rates: CurrencyRates;
  time: Date | string | number;
}

class Currency {
  private time = new Date(0);
  private rates: CurrencyRates = {};
  private mutex = new Mutex();
  private cache = new Cache<FixerResponse>('data/cache/currency.json');

  private parse(data: FixerResponse) {
    if (data.success === false) {
      const err = new Error(data.error.info) as Error & {code: number};
      err.code = data.error.type;
      throw err;
    }
    this.time = new Date(data.time);
    this.rates = data.rates;
  }

  private async fetch(): Promise<FixerResponse> {
    const res = await fetch(
      `http://data.fixer.io/api/latest?access_key=${env.fixerKey}`,
    );
    if (!res.ok) {
      throw new Error(`Fixer API HTTP ${res.status}: ${res.statusText}`);
    }
    const data = (await res.json()) as FixerResponse;
    if (data.success) {
      data.time = new Date();
    }
    return data;
  }

  private async update() {
    // are the rates already valid?
    if (this.valid) {
      return;
    }

    // fetch rates
    await this.mutex.lock();
    try {
      const cached = await this.cache.read();
      if (cached !== undefined) {
        this.parse(cached);
      }
      if (this.valid) {
        return;
      }

      // fetch from api
      let data = await this.fetch();
      this.parse(data);
      await this.cache.write(data as FixerResponse);
    } finally {
      this.mutex.release();
    }
  }

  private get valid() {
    // invalidate cached results after 12 hours
    return this.time && (new Date().getTime() - this.time.getTime() < 1000 * 60 * 60 * 12);
  }

  async convert(value: number, from: string, to: string) {
    // converts from currency to another
    await this.update();
    from = from.toUpperCase();
    to = to.toUpperCase();
    let toBase = value / this.rates[from];
    return Math.round((toBase * this.rates[to]) * 100) / 100;
  }

  async exists(code: string) {
    await this.update();
    return !!this.rates[code.toUpperCase()];
  }
}

export const currency = new Currency();
