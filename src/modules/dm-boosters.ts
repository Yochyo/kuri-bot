import type {Guild} from 'discord.js';
import {Cache} from '../utils/cache';
import {Mutex} from '../utils/mutex';

const oneDayMs = 24 * 60 * 60 * 1000;

type Store = Record<string, {fetchedAt: number; usernames: string[]}>;

const store = new Cache<Store>('data/cache/dm-boosters.json');

class DmBoostersCache {
  private mutex = new Mutex();
  private data: Store | null = null;
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    await this.mutex.lock();
    try {
      if (this.loaded) return;
      this.data = (await store.read()) ?? {};
      this.loaded = true;
    } finally {
      await this.mutex.release();
    }
  }

  private isFresh(fetchedAt: number, now: number) {
    return now - fetchedAt < oneDayMs;
  }

  async getUsernames(guild: Guild): Promise<string[]> {
    await this.ensureLoaded();
    const guildId = guild.id;
    const now = Date.now();

    const cached = this.data![guildId];
    if (cached && this.isFresh(cached.fetchedAt, now)) return cached.usernames;

    // Prevent stampedes when multiple users request the same guild.
    await this.mutex.lock();
    try {
      const cachedAgain = this.data![guildId];
      const now2 = Date.now();
      if (cachedAgain && this.isFresh(cachedAgain.fetchedAt, now2)) return cachedAgain.usernames;

      const members = await guild.members.fetch();
      const usernames = Array.from(members.values())
        .filter((m) => !!m.premiumSince)
        .map((m) => m.user.username);

      const uniqueUsernames = Array.from(new Set(usernames)).sort((a, b) => a.localeCompare(b));

      this.data![guildId] = {fetchedAt: now2, usernames: uniqueUsernames};
      await store.write(this.data!);

      return uniqueUsernames;
    } finally {
      await this.mutex.release();
    }
  }
}

const dmBoostersCache = new DmBoostersCache();

export async function getBoostersUsernames(guild: Guild): Promise<string[]> {
  return dmBoostersCache.getUsernames(guild);
}

