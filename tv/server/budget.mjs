// How many pictures a day the guide may make: Dream it real costs a few cents a picture, so the
// guide counts them by day and stops at the number it was set up with (GUIDE_REAL_PER_DAY). In
// memory, for one copy of the guide; or in the commons table (pk "real#YYYY-MM-DD"), shared by
// every copy, each day's count expiring a few days on.
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);

// `share`: of the day's pictures, the part this one may be taken from (things made real on their
// own take only so many, so that some are always left for a painting made real and its place)
const mostOf = (perDay, share = 1) => (share >= 1 ? perDay : Math.max(1, Math.floor(perDay * share)));

export function memoryBudget({ perDay = 60 } = {}) {
  const used = new Map();
  return {
    async take(now = Date.now(), { share = 1 } = {}) {
      const d = dayOf(now), n = used.get(d) || 0;
      if (n >= mostOf(perDay, share)) return false;
      used.set(d, n + 1);
      return true;
    },
  };
}

// `kind`: what is counted, each its own count a day (pictures; clips, 'alive')
export function dynamoBudget({ client, table, commands: { UpdateItemCommand }, perDay = 60, kind = 'real' }) {
  return {
    async take(now = Date.now(), { share = 1 } = {}) {
      try {
        await client.send(new UpdateItemCommand({
          TableName: table,
          Key: { pk: { S: `${kind}#${dayOf(now)}` }, sk: { S: 'count' } },
          UpdateExpression: 'SET expires = :expires ADD pictures :one',
          ConditionExpression: 'attribute_not_exists(pictures) OR pictures < :most',
          ExpressionAttributeValues: { ':one': { N: '1' }, ':most': { N: String(mostOf(perDay, share)) }, ':expires': { N: String(Math.floor(now / 1000) + 3 * 86400) } },
        }));
        return true;
      } catch (err) {
        if (err.name === 'ConditionalCheckFailedException') return false;
        throw err;
      }
    },
  };
}
