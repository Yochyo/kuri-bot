import * as env from './utils/env';
import {TimeToLive} from './modules/time-to-live';
import {createKuriClient, createSyreneClient} from './discord/create-client';
import {registerKuriClient} from './handlers/kuri';
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

registerKuriClient({
  client,
  timeToLive,
});

registerSyreneClient(syrene);

void (async () => {
  try {
    await timeToLive.load();
    if (env.syreneToken) {
      void syrene.login(env.syreneToken);
    }
    await client.login(env.token);
  } catch (err) {
    console.error(err);
  }
})();
