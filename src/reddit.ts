import {EmbedBuilder} from 'discord.js';

const Parser = require('rss-parser');
const parser = new Parser({
  customFields: {
    item: ['pubDate', 'content'],
  },
});

import type {PublishedFeedItem} from './publisher';

function rssToEmbed(rss: any, name: string, publishedAtMs: number): PublishedFeedItem {
  if (typeof rss.author !== 'string' || !rss.author.startsWith('/u/')) {
    throw new Error('Expected Reddit author to start with /u/.');
  }
  rss.author = rss.author.substring(3);

  const found = rss.content.match(
    /<img.*src=['|"]http(s)?:\/\/.*preview\.redd\.it.*\/.*?['|"]/,
  );
  let thumb: string | undefined;
  if (found) {
    thumb = String(found[0]);
    let s = thumb.search(/['|"]/);
    if (s === -1) throw new Error('Expected token not found when searching for Reddit thumbnail.');
    thumb = thumb.substring(s + 1);
    s = thumb.search(/['|"]/);
    if (s === -1) throw new Error('Expected token not found when searching for Reddit thumbnail.');
    thumb = thumb.substring(0, s).replace(/&amp;/g, '&');
  }

  const embed = new EmbedBuilder();
  if (typeof rss.title === 'string') embed.setTitle(rss.title.substring(0, 256));
  if (typeof rss.link === 'string') embed.setURL(rss.link);
  embed.setColor(16727832);
  if (typeof rss.pubDate === 'string') embed.setTimestamp(new Date(rss.pubDate));
  embed.setFooter({text: name});
  embed.setAuthor({
    name: rss.author,
    url: `https://www.reddit.com/user/${rss.author}`,
  });
  if (thumb) {
    embed.setThumbnail(thumb);
  }
  return {embed, publishedAtMs};
}

export async function getEmbeds(subreddit: string, _since: Date): Promise<PublishedFeedItem[]> {
  const feed = await parser.parseURL(`https://www.reddit.com/r/${subreddit}/.rss`);
  const embeds: PublishedFeedItem[] = [];
  feed.items.filter((item) => item.pubDate != null);
  feed.items.sort(
    (a: any, b: any) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime(),
  );
  for (const item of feed.items) {
    try {
      const publishedAtMs =
        typeof item.pubDate === 'string' ? new Date(item.pubDate).getTime() : 0;
      embeds.push(rssToEmbed(item, `r/${subreddit}`, publishedAtMs));
    } catch (err) {
      console.error(err);
    }
  }
  return embeds;
}
