// Where the commons lives between tellings (personal/commons.mjs): counts of the images
// everyone's tellings use, kept by salted hash until an image is common enough to read.
//
// - memoryCommons: in this process only. For the stand-in, the tests, and a guide that runs as
//   one process.
// - dynamoCommons: in a DynamoDB table, shared by every copy of the guide. One item per image
//   (its hash, a count added to atomically, and the image itself once its count reaches k) and
//   one item for the number of tellings. No text, no person. Read again every few minutes.
import { createCommons, imageKey } from './engine/personal/index.mjs';

export function memoryCommons(opts = {}) {
  const c = createCommons(opts);
  return { load: async () => c, saved: async () => {} };
}

const PK = 'commons';

export function dynamoCommons({ client, table, commands, salt = 'inkwash-commons', k = 10, minTellings = 20, minShare = 0.08, refreshMs = 5 * 60 * 1000, now = () => Date.now() }) {
  const { QueryCommand, UpdateItemCommand } = commands;
  let cached = null, at = 0;
  async function read() {
    const counts = [], names = [];
    let tellings = 0, start;
    do {
      const r = await client.send(new QueryCommand({
        TableName: table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': { S: PK } }, ExclusiveStartKey: start,
      }));
      for (const it of r.Items || []) {
        const n = Number(it.n?.N || 0);
        if (it.sk.S === '#tellings') tellings = n;
        else { counts.push([it.sk.S, n]); if (it.image?.S) names.push([it.sk.S, it.image.S]); }
      }
      start = r.LastEvaluatedKey;
    } while (start);
    return createCommons({ salt, k, minTellings, minShare }, { tellings, counts, names });
  }
  return {
    async load() {
      if (!cached || now() - at > refreshMs) { cached = await read(); at = now(); }
      return cached;
    },
    // after a telling: add its images (the in-memory commons was already counted by finishTelling)
    async saved(motifs) {
      const add = (sk, extra = {}) => client.send(new UpdateItemCommand({
        TableName: table, Key: { pk: { S: PK }, sk: { S: sk } },
        UpdateExpression: 'ADD n :one', ExpressionAttributeValues: { ':one': { N: '1' } }, ReturnValues: 'UPDATED_NEW', ...extra,
      }));
      await add('#tellings');
      await Promise.all([...new Set(motifs)].map(async (m) => {
        const key = imageKey(salt, m);
        const r = await add(key);
        // the image is kept readable only once enough tellings have used it
        if (Number(r.Attributes?.n?.N || 0) >= k) {
          await client.send(new UpdateItemCommand({
            TableName: table, Key: { pk: { S: PK }, sk: { S: key } },
            UpdateExpression: 'SET image = :m', ExpressionAttributeValues: { ':m': { S: m } },
          }));
        }
      }));
    },
  };
}
