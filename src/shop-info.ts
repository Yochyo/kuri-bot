import {URL} from 'url';
import * as request from 'request-promise-native';
import {Mutex} from './mutex';

let mutex = new Mutex();
let stores: { stores: ShopInfo[], expire: number };

export async function getStores(): Promise<ShopInfo[]> {
  const now = new Date()
  if (stores && now.getTime() < stores.expire) {
    return stores.stores;
  } else {
    try {
      await mutex.lock();
      const response = await request(`https://cunny.dakidex.com/v1/circles/external-stores`);
      stores = {stores: JSON.parse(response).data.stores, expire: new Date(now.getTime() + 1 * 60000).getTime()};
      return stores.stores;
    } finally {
      mutex.release();
    }
  }
}

export class ShopResult {
  name: string;
  url: string
  status: 'legitimate' | 'scalper' | 'questionable' | 'bootlegger' | 'unknown';
}

export class ShopInfo {
  name: string;
  status: 'legitimate' | 'scalper' | 'questionable' | 'bootlegger' | 'unknown';
  urls: string[];
}

export async function findShopInfo(message: string, opts: { ignoreMatches?: boolean } = {}): Promise<ShopResult[]> {
  let {ignoreMatches = false} = opts;
  let matches: ShopInfo[];
  try {
    matches = await getStores();
  } catch (err) {
    console.error(err);
    return [];
  }
  const split = message.split(/\s/);
  const shops: ShopResult[] = [];
  const stripUrl = (url: string) => {
    if (url.startsWith('https://')) {
      url = url.substr('https://'.length);
    } else if (url.startsWith('http://')) {
      url = url.substr('http://'.length);
    }
    const slug = url.indexOf('/');
    if (slug != -1) {
      url = url.substr(0, slug);
    }
    const query = url.indexOf('?');
    if (query != -1) {
      url = url.substr(0, query);
    }
    return url;
  };
  for (let part of split) {
    try {
      if (part.startsWith('<') && part.endsWith('>')) {
        part = part.substr(1, part.length - 2);
      }
      const strippedPart = stripUrl(part)
      const url = new URL(part);
      if (!url.hostname || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
        continue;
      }
      const check = async () => {
        for (const shop of matches) {
          for (const url of shop.urls) {
            if (strippedPart.includes(url)) {
              const shopCopy = {...shop, url}
              shops.push(shopCopy)
            }
          }
        }
      };
      await check();
      if (!shops.length) {
        shops.push({
          name: 'Unknown',
          status: 'unknown',
          url: stripUrl(part)
        });
      }
    } catch {
    }
  }
  return shops;
}