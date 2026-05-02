import * as fs from 'fs-extra';
import * as env from './env';
import {TimeToLive} from './time-to-live';
import {createKuriClient, createSyreneClient} from './discord/create-client';
import {registerKuriClient, type AssignableRole} from './handlers/kuri';
import {registerSyreneClient} from './handlers/syrene';

const client = createKuriClient();
const syrene = createSyreneClient();

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

registerKuriClient({
  client,
  timeToLive,
  assignableRoles,
});

registerSyreneClient(syrene);

void (async () => {
  try {
    await fs.ensureDir('data');
    await fs.ensureDir('data/cache');
    await timeToLive.load();
    if (env.syreneToken) {
      void syrene.login(env.syreneToken);
    }
    await client.login(env.token);
  } catch (err) {
    console.error(err);
  }
})();
