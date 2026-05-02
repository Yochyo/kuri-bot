import {Events} from 'discord.js';
import * as fs from 'fs-extra';
import * as env from './env';
import * as reddit from './reddit';
import {Publisher} from './publisher';
import {TimeToLive} from './time-to-live';
import {createKuriClient, createSyreneClient} from './discord/create-client';
import {registerKuriClient, type AssignableRole} from './handlers/kuri';
import {registerSyreneClient} from './handlers/syrene';

const client = createKuriClient();
const syrene = createSyreneClient();

const publishers: Record<string, Publisher> = {
  'r-dakimakuras': new Publisher(client, 'r-dakimakuras'),
};

const timeToLive = new TimeToLive(client, {
  emojis: {
    '⬛': {minutesToLive: 1},
    '🟥': {minutesToLive: 60},
    '🟧': {minutesToLive: 60 * 24},
    '🟨': {minutesToLive: 60 * 24 * 7},
    '🟩': {reset: true},
  },
});

const assignableRoles: AssignableRole[] = [];

async function checkPublisher(
  name: string,
  delayMinutes: number,
  fn: (since: Date) => ReturnType<typeof reddit.getEmbeds>,
) {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * delayMinutes));
    try {
      const publisher = publishers[name];
      await publisher.publish(await fn(publisher.lastPublish));
    } catch (err) {
      console.error(err);
    }
  }
}

registerKuriClient({
  client,
  publishers,
  timeToLive,
  assignableRoles,
});

registerSyreneClient(syrene);

client.once(Events.ClientReady, () => {
  void checkPublisher('r-dakimakuras', 15, reddit.getEmbeds.bind(reddit, 'dakimakuras'));
});

void (async () => {
  try {
    await fs.ensureDir('data');
    await fs.ensureDir('data/cache');
    await fs.ensureDir('data/publishers');
    await timeToLive.load();
    if (env.syreneToken) {
      void syrene.login(env.syreneToken);
    }
    await client.login(env.token);
  } catch (err) {
    console.error(err);
  }
})();
