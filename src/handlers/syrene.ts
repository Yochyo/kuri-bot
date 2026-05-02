import type {Message} from 'discord.js';
import {Client, Events} from 'discord.js';

const octoTimeout = 20_000;
const octo1Emote = '<:Octo1:733281498697826324>';
const octo2Emote = '<:Octo2:733281510588940288>';
const octoHugId = '617843371540742144';
const octoHugEmote = '<:Octohug:617843371540742144>';

type OctoPending = {
  type: 1 | 2;
  id: string;
  chan_id: string;
  timeout_id: ReturnType<typeof setTimeout>;
};

class OctoCoordinator {
  private readonly pending: OctoPending[] = [];

  private matchOcto(typeToMatch: 1 | 2, originalMessage: Message) {
    const idOfOriginalMessage = originalMessage.id;
    const idx = this.pending.findIndex((inst) => inst.id === idOfOriginalMessage);
    if (idx === -1) return;
    this.pending.splice(idx, 1);

    const ch = originalMessage.channel;
    if (!ch.isSendable()) return;
    if (typeToMatch === 1) {
      void ch.send(octo2Emote);
    } else {
      void ch.send(octo1Emote);
    }
  }

  handleMessage(msg: Message) {
    if (msg.author.bot || !msg.member || !msg.channel.isSendable()) return;
    const content = msg.content.trim();
    if (content === octo1Emote || content === octo2Emote) {
      const ty = content === octo1Emote ? 1 : 2;
      const otherTy = content === octo1Emote ? 2 : 1;

      const thisChannelOctos = this.pending.filter((inst) => inst.chan_id === msg.channel.id);
      if (
        thisChannelOctos.length !== 0 &&
        thisChannelOctos[thisChannelOctos.length - 1].type === otherTy
      ) {
        const toCancel = thisChannelOctos[thisChannelOctos.length - 1];
        const cancelIdx = this.pending.findIndex((inst) => inst.id === toCancel.id);
        if (cancelIdx !== -1) this.pending.splice(cancelIdx, 1);
        clearTimeout(toCancel.timeout_id);
      } else {
        const timeout_id = setTimeout(() => this.matchOcto(ty, msg), octoTimeout);
        this.pending.push({type: ty, id: msg.id, chan_id: msg.channel.id, timeout_id});
      }
    } else if (content === octoHugEmote) {
      void msg.react(octoHugId);
    }
  }
}

export function registerSyreneClient(client: Client): void {
  const octo = new OctoCoordinator();

  client.once(Events.ClientReady, (c) => {
    console.log(`Logged in as ${c.user.tag}!`);
  });

  client.on(Events.MessageCreate, (msg: Message) => {
    octo.handleMessage(msg);
  });
}
