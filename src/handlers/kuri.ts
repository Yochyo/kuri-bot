import type {Message} from 'discord.js';
import {
  Client,
  Events,
  PermissionFlagsBits,
} from 'discord.js';
import {TimeToLive} from '../time-to-live';
import {findShopInfo} from '../shop-info';
import {currency} from '../currency';

import cats = require('cat-ascii-faces');

/** Channel where shop checks always run (guild). */
const SHOP_ALWAYS_CHECK_CHANNEL_ID = '807402589565616171';

export type KuriRuntime = {
  client: Client;
  timeToLive: TimeToLive;
};

async function checkShops(message: Message, forceCheck: boolean) {
  if (!message.channel.isSendable()) return;
  const content = message.content.trim();
  const shops = await findShopInfo(content, {ignoreMatches: forceCheck});
  const messages: string[] = [];
  for (const shop of shops) {
    let note: string | undefined;
    if (shop.status === 'unknown') {
      if (forceCheck) note = `❓ I don't have any information about ${shop.url}.`;
    } else if (shop.status === 'scalper') {
      if (forceCheck)
        note = `❗ The shop "${shop.name}" (${shop.url}) is a scalper. Scalpers buy legitimate items (often with limited stock) and resell them at a marked up price. If you insist on buying from a scalper, first check that the item is not still officially available.`;
    } else if (shop.status === 'questionable') {
      if (forceCheck) note = `❗ The shop "${shop.name}" (${shop.url}) is questionable.`;
    } else if (shop.status === 'bootlegger') {
      note = `❌ The shop "${shop.name}" (${shop.url}) has been known to sell either bootleg products or AI generated art.`;
    } else if (shop.status === 'legitimate') {
      if (forceCheck) note = `✅ The shop "${shop.name}" (${shop.url}) is legitimate and does not sell bootleg products.`;
    }

    if (note && shop.notes) note += `\n\n**Community notes:**\n${shop.notes}`;
    if (note && !messages.includes(note)) messages.push(note);
  }
  if (messages.length > 0) {
    await message.channel.send(messages.join('\n'));
  }
}

async function handleMessage(rt: KuriRuntime, msg: Message) {
  let {client} = rt;
  if (msg.author.bot) return;
  if (!msg.channel.isSendable()) return;
  if (!msg.member) {
    await checkShops(msg, true);
    return;
  }
  let content = msg.content.trim();
  if (content.match(/^[-]?[\d|,]{0,12}(\.\d{1,2})?\s*\w{3}\s+to\s+\w{3}$/i)) {
    try {
      content = content.replace(/,/g, '');
      const value = parseFloat(content);
      if (isNaN(value)) return;
      const instruction = content.substring(String(value).length).trim();
      const from = instruction.substring(0, 3).toUpperCase();
      const to = instruction.substring(instruction.length - 3, 3).toUpperCase();
      if (!(await currency.exists(from))) return;
      if (!(await currency.exists(to))) return;
      const result = await currency.convert(value, from, to);
      await msg.channel.send(`${value} ${from} = ${result} ${to}`);
    } catch (err) {
      if (err?.['code'] == 'missing_access_key') {
        await msg.channel.send(
          'A fixer API token has not been configured so conversion rates could not be obtained.',
        );
      } else {
        await msg.reply('Something went wrong.');
      }
    }
  } else if (content.match(/^[-]?\d{0,3}(\.\d{1,2})?\s*c\s+to\s+f$/i)) {
    const value = parseFloat(content);
    let result = (value * 9) / 5 + 32;
    result = Math.round(result * 100) / 100;
    await msg.channel.send(`${value} C = ${result} F`);
  } else if (content.match(/^[-]?\d{0,3}(\.\d{1,2})?\s*f\s+to\s+c$/i)) {
    const value = parseFloat(content);
    let result = ((value - 32) * 5) / 9;
    result = Math.round(result * 100) / 100;
    await msg.channel.send(`${value} F = ${result} C`);
  } else if (content.replace(/[^a-z]/gi, '').toLowerCase().match(/^(n+y+a+h*|m+e+o+w+)$/)) {
    await msg.channel.send(cats());
  } else {
    const me = client.user;
    const forceShop =
      (me && msg.mentions.has(me)) || msg.channel.id === SHOP_ALWAYS_CHECK_CHANNEL_ID;
    await checkShops(msg, forceShop);
  }
}

export function registerKuriClient(rt: KuriRuntime): void {
  const {client, timeToLive} = rt;

  client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}!`);
  });

  client.on(Events.MessageCreate, (msg) => {
    void handleMessage(rt, msg);
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (!timeToLive.match(reaction.emoji.name ?? '')) return;
    reaction = await reaction.fetch();
    const fullUser = await user.fetch();

    if (fullUser.id === client.user?.id) return;

    const message = await reaction.message.fetch();
    if (!message.guild) return;
    const member = await message.guild.members.fetch(fullUser);
    const mod = member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (mod) {
      await timeToLive.apply(message, reaction.emoji.name ?? '');
    } else {
      await reaction.users.remove(fullUser);
    }
  });
}
