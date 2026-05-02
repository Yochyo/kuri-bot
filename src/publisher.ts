import type {Client, EmbedBuilder, GuildTextBasedChannel} from 'discord.js';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import {validate} from 'jsonschema';
import {Mutex} from './mutex';

export interface PublishedFeedItem {
  embed: EmbedBuilder;
  /** Milliseconds since epoch (RSS pub date). */
  publishedAtMs: number;
}

export class Publisher {
  private channels: string[] = [];
  private _lastPublish = new Date();
  private mutex = new Mutex();
  get lastPublish() {
    return this._lastPublish;
  }
  constructor(
    private readonly client: Client,
    private readonly name: string,
  ) {}

  async publish(items: PublishedFeedItem[]) {
    await this.mutex.lock();
    try {
      let batch = [...items];
      while (batch.length > 10) {
        batch.splice(0, 1);
      }
      batch = _.filter(batch, (item) => item.publishedAtMs > this.lastPublish.getTime());
      for (const item of batch) {
        for (const channelId of this.channels) {
          const channel = await this.client.channels.fetch(channelId);
          if (channel?.isTextBased() && channel.isSendable() && !channel.isDMBased()) {
            await channel.send({embeds: [item.embed]});
          }
        }
        if (item.publishedAtMs > this.lastPublish.getTime()) {
          this._lastPublish = new Date(item.publishedAtMs);
        }
      }
    } finally {
      this.mutex.release();
      await this.save();
    }
  }

  async subscribe(newChannel: GuildTextBasedChannel) {
    await this.mutex.lock();
    try {
      if (this.channels.indexOf(newChannel.id) === -1) {
        this.channels.push(newChannel.id);
      }
    } finally {
      this.mutex.release();
      await this.save();
    }
  }

  async unsubscribe(channel: GuildTextBasedChannel) {
    await this.mutex.lock();
    try {
      const ind = this.channels.indexOf(channel.id);
      if (ind !== -1) {
        this.channels.splice(ind, 1);
      }
    } finally {
      this.mutex.release();
      await this.save();
    }
  }

  async load() {
    await this.mutex.lock();
    try {
      try {
        const data = await fs.readJson(`data/publishers/${this.name}.json`);
        validate(
          data,
          {
            type: 'object',
            properties: {
              channels: {
                type: 'array',
                required: true,
                items: {
                  type: 'string',
                },
              },
              lastPublish: {
                type: 'string',
                format: 'date-time',
                required: true,
              },
            },
          },
          {throwError: true},
        );
        this.channels = data.channels;
        this._lastPublish = new Date(data.lastPublish);
      } catch (err) {
        if (_.get(err, 'code') == 'ENOENT') {
          this.channels = [];
          this._lastPublish = new Date();
        } else {
          throw err;
        }
      }
    } finally {
      this.mutex.release();
    }
  }

  async save() {
    await this.mutex.lock();
    try {
      await fs.writeJson(`data/publishers/${this.name}.json`, {
        channels: this.channels,
        lastPublish: this._lastPublish.toISOString(),
      });
    } finally {
      this.mutex.release();
    }
  }
}
