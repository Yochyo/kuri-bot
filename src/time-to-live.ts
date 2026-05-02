import type {Client, Message, MessageReaction} from 'discord.js';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';
import {Mutex} from './mutex';

const minutes = 60 * 1000;

export class TimeToLiveOptions {
  emojis: {[key: string]: {minutesToLive?: number; reset?: boolean}};
}

export class TimeToLive {
  private mutex = new Mutex();
  private data: {[key: string]: {liveUntil: number; channel: string}} | null = null;
  private sortedTimes: {time: number; emoji: string}[] = [];

  constructor(
    private readonly client: Client,
    private readonly options: TimeToLiveOptions,
  ) {
    for (const key of Object.keys(options.emojis)) {
      if (!options.emojis[key].reset) {
        this.sortedTimes.push({
          time: options.emojis[key].minutesToLive!,
          emoji: key,
        });
      }
    }
    this.sortedTimes.sort((a, b) => b.time - a.time);

    void (async () => {
      while (true) {
        try {
          await this.refreshAll();
        } catch (err) {
          console.error(err);
        }
        await new Promise((resolve) => setTimeout(resolve, 1 * minutes));
      }
    })();
  }

  async load() {
    await this.mutex.lock();
    try {
      try {
        this.data = await fs.readJson('data/time-to-live.json');
      } catch (err) {
        if (_.get(err, 'code') == 'ENOENT') {
          this.data = {};
        } else {
          throw err;
        }
      }
    } finally {
      await this.mutex.release();
    }
  }

  async save() {
    await this.mutex.lock();
    try {
      await fs.writeJson('data/time-to-live.json', this.data);
    } finally {
      await this.mutex.release();
    }
  }

  match(emoji: string) {
    return !!this.options.emojis[emoji];
  }

  async apply(message: Message, emoji: string) {
    const info = this.options.emojis[emoji];
    if (info.reset) {
      delete this.data![message.id];
    } else if (info.minutesToLive) {
      this.data![message.id] = {
        channel: message.channel.id,
        liveUntil: new Date().getTime() + minutes * info.minutesToLive,
      };
    }
    await this.save();
    await this.react(message);
  }

  private async react(message: Message) {
    let desiredReaction = '';
    const info = this.data![message.id];
    if (info) {
      let ttl = (info.liveUntil - new Date().getTime()) / minutes;
      if (ttl <= 0) {
        await message.delete();
        delete this.data![message.id];
        await this.save();
        return;
      }
      desiredReaction = this.sortedTimes[0].emoji;
      for (let i = 1; i < this.sortedTimes.length; ++i) {
        if (ttl < this.sortedTimes[i].time) {
          desiredReaction = this.sortedTimes[i].emoji;
        } else {
          break;
        }
      }
    }

    const removeReactions: MessageReaction[] = [];
    let needToReact = true;
    message.reactions.cache.forEach((reaction) => {
      const emojiName = reaction.emoji.name;
      if (emojiName && this.match(emojiName)) {
        if (reaction.me && desiredReaction === reaction.emoji.name) {
          needToReact = false;
        }
        removeReactions.push(reaction);
      }
    });

    if (needToReact && desiredReaction) {
      await message.react(desiredReaction);
    }

    for (const reaction of removeReactions) {
      if (desiredReaction !== reaction.emoji.name) {
        await reaction.remove();
      } else {
        reaction.users.cache.forEach((value) => {
          if (value.id !== this.client.user?.id) {
            void reaction.users.remove(value);
          }
        });
      }
    }

    await this.save();
  }

  private async refreshAll() {
    if (!this.data) return;
    for (const id of Object.keys(this.data)) {
      const message = this.data[id];
      try {
        const channel = await this.client.channels.fetch(message.channel);
        if (channel?.isTextBased() && !channel.isDMBased() && 'messages' in channel) {
          const msg = await channel.messages.fetch(id);
          await this.react(msg);
        }
      } catch (err: unknown) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? (err as {code: unknown}).code
            : undefined;
        if (code === RESTJSONErrorCodes.UnknownMessage || code === RESTJSONErrorCodes.UnknownChannel) {
          delete this.data[id];
          await this.save();
        }
      }
    }
  }
}
