// The writing studio's world (as its export or backup file holds it), in the engine's shape.
//
// What the studio has, the engine reads as it is: entities and their facts (retired ones left
// out), chapters in order, passages with their chapter and scene, and the ledger: the facts the
// model said it used (`pending`) and the ones the author confirmed (`premises`).
//
// Story time: a fact's `from` is the chapter it becomes true in and `endsIn` the last it holds in
// (what a chapter changed sets them, and the author can); a secret with a reveal chapter is
// secret until that chapter, and a secret with none is secret to the end. Who knows a fact
// (`knownBy`) comes across with its chapters as ordinals.
//
// What the studio doesn't have yet, and how this fills it:
// - who is in a scene: from the chapter's threads, as the studio's own `castIn` reads them (a
//   thread on for at least a quarter of the scene).
// - pronouns: guessed from the canon itself, when a character's own facts call them "he" or "she"
//   and name nobody else. `pronounGuessed` marks them; a guess can be wrong.
// - aliases: none.
// - each passage also carries its scene's notes and its chapter's title, pins and notes, as the
//   studio's brief does.
const SAMPLES = 120; // the studio's score resolution

function sceneRange(scenes, k) {
  const n = Math.max(1, scenes | 0);
  const i0 = Math.floor((k * SAMPLES) / n), i1 = Math.floor(((k + 1) * SAMPLES) / n);
  return [i0, Math.max(i0 + 1, i1)];
}
function castIn(chapter, k) {
  const [i0, i1] = sceneRange(chapter.scenes, k);
  const out = [];
  for (const id of chapter.cast || []) {
    const arr = (chapter.threads || {})[id];
    if (!arr) continue;
    let on = 0;
    for (let i = i0; i < i1; i++) if (arr[i]) on++;
    if (on / (i1 - i0) >= 0.25) out.push(id);
  }
  return out;
}

const HE = /\b(he|him|his|himself)\b/gi, SHE = /\b(she|her|hers|herself)\b/gi;

export function fromStudio(backup) {
  const order = backup.world?.chapterOrder || backup.chapters.map((c) => c.id);
  const ordinal = new Map(order.map((id, i) => [id, i + 1]));
  const chapterById = new Map(backup.chapters.map((c) => [c.id, c]));
  const last = order.length + 1;
  const entities = backup.entities.map((e) => {
    const out = { id: e.id, kind: e.kind, name: e.name, aliases: (e.aliases || []).slice() };
    if (e.pronoun) out.pronoun = e.pronoun;
    else if (e.kind === 'character') {
      let he = 0, she = 0;
      for (const f of e.facts || []) if (!f.retired) { he += (f.text.match(HE) || []).length; she += (f.text.match(SHE) || []).length; }
      if (he !== she) { out.pronoun = he > she ? 'he' : 'she'; out.pronounGuessed = true; }
    }
    return out;
  });
  const facts = [];
  for (const e of backup.entities) for (const f of e.facts || []) {
    if (f.retired) continue;
    const reveal = f.secret ? (f.reveal && ordinal.has(f.reveal) ? ordinal.get(f.reveal) : last) : null;
    const from = f.from && ordinal.has(f.from) ? ordinal.get(f.from) : null;
    const to = f.endsIn && ordinal.has(f.endsIn) ? ordinal.get(f.endsIn) + 1 : null;
    const fact = { id: f.id, entity: e.id, text: f.text, from, to, secretUntil: reveal };
    // what a scene may show of a secret before it comes out: a draft gets these, not the secret
    if (f.secret && Array.isArray(f.hints) && f.hints.length) fact.hints = f.hints.slice();
    // who in the story knows it, each from a chapter (from the start when none)
    if (Array.isArray(f.knownBy)) fact.knownBy = f.knownBy.filter((k) => k && k.who).map((k) => ({ who: k.who, from: k.from && ordinal.has(k.from) ? ordinal.get(k.from) : null }));
    facts.push(fact);
  }
  const known = new Set(facts.map((f) => f.id));
  const passages = (backup.passages || []).filter((p) => ordinal.has(p.chapter) && p.text).map((p) => {
    const ch = chapterById.get(p.chapter);
    const ledger = [...new Map([...(p.premises || []), ...(p.pending || [])].filter((x) => known.has(x.f)).map((x) => [x.f, { f: x.f }])).values()];
    // the author's own words for the scene, and for its chapter (the studio's brief reads both: a
    // place named once in a chapter's notes is the setting of the whole chapter)
    const notes = ch ? (ch.notes || []).filter((n) => n.scene === p.scene).map((n) => n.text).join(' ') : '';
    const chapterNotes = ch ? [ch.title, ...(ch.pins || []).map((x) => x.text), ...(ch.notes || []).map((n) => n.text)].filter(Boolean).join(' ') : '';
    return { id: p.id, chapter: ordinal.get(p.chapter), scene: p.scene, cast: ch ? castIn(ch, p.scene) : [], text: p.text, notes, chapterNotes, premises: ledger };
  });
  passages.sort((a, b) => a.chapter - b.chapter || a.scene - b.scene);
  return {
    title: backup.world?.title || '',
    chapters: order.map((id, i) => ({ ordinal: i + 1, id, title: chapterById.get(id)?.title || '' })),
    entities, facts, passages,
  };
}
