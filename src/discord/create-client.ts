import {Client, GatewayIntentBits, Partials} from 'discord.js';

const sharedPartials = [
  Partials.Channel,
  Partials.Message,
  Partials.Reaction,
  Partials.User,
  Partials.GuildMember,
];

const kuriIntents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.DirectMessageReactions,
];

/** Main bot: moderation TTL, roles, utilities. */
export function createKuriClient(): Client {
  return new Client({
    intents: kuriIntents,
    partials: sharedPartials,
  });
}

/** Secondary client (Syrene): lightweight guild message + reactions. */
export function createSyreneClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: sharedPartials,
  });
}
