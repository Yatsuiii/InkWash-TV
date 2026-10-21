// The privacy notice and terms, served at /privacy by the guide: what the TV keeps, what it sends
// here, what this service keeps and for how long. Every line is what the code does; change the
// code, change this. `contact` is where to write (GUIDE_CONTACT); `optedOut` says the AWS account
// has opted out of AWS using Amazon Polly's input to improve Polly (GUIDE_AI_OPT_OUT=yes);
// `models` is who runs the story's models: 'anthropic' (Anthropic's API) or 'bedrock'; `pictures`,
// who makes the pictures: 'gemini' (Google's Gemini API), 'bedrock', or 'off' with Anthropic's;
// `clips`, whether a picture can be set moving (Nova Reel, reel.mjs).
export const PRIVACY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'max-age=300',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const UPDATED = '21 October 2026';

export function privacyPage({ contact = '', optedOut = false, models = 'bedrock', pictures = 'bedrock', clips = true } = {}) {
  const write = contact
    ? `<p>Questions, or something wrong? Write to <strong>${esc(contact)}</strong>.</p>`
    : '<p>Questions, or something wrong? Write to whoever gave you the app.</p>';
  const polly = optedOut
    ? 'This service’s AWS account has opted out of AWS using that text to improve Polly.'
    : 'Under AWS’s terms, AWS may keep that text to improve Polly, unless an account opts out; this one hasn’t yet.';
  // who the story's models are run by (`models`), and who makes its pictures (`pictures`)
  const byGemini = `<p>To make pictures, the server sends <strong>Google’s Gemini API</strong> what each picture is made
from: to make a painting into a picture, the painting and a description of it written from its story;
to paint the place, the TV’s own drawing of it; to paint a thing of your world on its own, the brush
strokes you painted it with, in black on white, with its name and how it looks (in your own words, if
you said how); to paint it again, the picture made of it before; and to see all around a picture, that
picture. Google’s own terms for its paid Gemini API say how it treats what it is sent.</p>`;
  const sends = models === 'anthropic'
    ? `<p>The server passes these to <strong>Anthropic’s API</strong>, where Anthropic’s AI models
(Claude) look at the painting, tell the story, ask about your world and decide where your world
stands from its story. Anthropic’s commercial terms for its API say it doesn’t train models on
what it is sent, and how long it keeps it.</p>
<p>It sends the text of each line to <strong>Amazon Polly</strong>, on Amazon Web Services, which
reads the story aloud. ${polly}</p>
${pictures === 'gemini' ? byGemini : ''}`
    : `<p>The server passes these to Amazon Web Services:</p>
<ul>
${pictures === 'gemini' ? `<li><strong>Amazon Bedrock</strong> runs the AI models that look at the painting, tell the story, ask
about your world and decide where your world stands from its story.
AWS says Bedrock doesn’t store or log what it is sent or what it answers, doesn’t use it to train
models, and doesn’t share it with the companies that make the models.</li>
<li><strong>Amazon Polly</strong> reads the story aloud: it is sent the text of each line. ${polly}</li>
</ul>
${byGemini}` : `<li><strong>Amazon Bedrock</strong> runs the AI models that look at the painting, tell the story, ask
about your world, decide where your world stands from its story and paint that place, and make a
painting into a picture (with Amazon Nova Canvas)${clips ? `, and, when you choose to watch a picture come
alive, set it moving for a few seconds (with Amazon Nova Reel)` : ''}. To paint the place, the TV sends
its own drawing of it; to paint a thing of your world on its own, the brush strokes you painted it
with, in black on white, with its name and how it looks (in your own words, if you said how); to
paint it again, the picture made of it before; and to cut it out of its white background, the
picture just made of it.
AWS says Bedrock doesn’t store or log what it is sent or what it answers, doesn’t use it to train
models, and doesn’t share it with the companies that make the models.</li>
<li><strong>Amazon Polly</strong> reads the story aloud: it is sent the text of each line. ${polly}</li>
</ul>`}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Inkwash: privacy and terms</title>
<style>
:root { --paper: #f4efe4; --ink: #1d1b18; --wash: #6f6a61; --line: #d9d1c1; }
@media (prefers-color-scheme: dark) { :root { --paper: #171614; --ink: #ece6d8; --wash: #a59f93; --line: #34312c; } }
html, body { margin: 0; background: var(--paper); color: var(--ink); }
body { font: 17px/1.55 Georgia, 'Times New Roman', serif; padding: 32px 18px 48px; }
main { max-width: 38em; margin: 0 auto; }
h1 { font-size: 1.6em; line-height: 1.2; margin: 0 0 4px; text-wrap: balance; }
h2 { font-size: 1.1em; margin: 2em 0 0.4em; padding-top: 1em; border-top: 1px solid var(--line); }
p, li { margin: 0 0 0.7em; }
ul { padding-left: 1.2em; }
.small { color: var(--wash); font-size: 0.9em; }
</style>
</head>
<body>
<main>
<h1>Inkwash: privacy and terms</h1>
<p class="small">Updated ${UPDATED}</p>

<p>Inkwash is a painting and storytelling app for Fire TV. You paint with the remote, and a storyteller
tells what you painted as a story and remembers your world from one painting to the next. There are no accounts, no ads,
no analytics and no tracking.</p>

<h2>What stays on your TV</h2>
<p>Your paintings, the stories told about them, your world (the people, places and things in it),
and the seal each person who paints on this TV chose are kept in the app’s own storage on the TV. Uninstalling Inkwash removes the app and what it kept.</p>

<h2>What goes to the story server, and why</h2>
<p>When the storyteller is on, the TV sends this server what it needs to tell the story of a painting:</p>
<ul>
<li>the painting, as a picture, and a summary of its brush strokes;</li>
<li>your answers to the storyteller’s questions, and anything you typed or spoke on your phone while painting;</li>
<li>the parts of your world the story needs, such as a thing that came back from an earlier painting;</li>
<li>whether a young child is painting, so the storyteller and the pictures keep to what is right for a child.</li>
</ul>
${sends}
<p>Only when you choose to walk inside a picture, the server sends that picture, made from your
drawing, and the description of what it shows to <strong>World Labs</strong>, which builds it
into a 3D world on the server’s own World Labs account, private to it. Your TV is sent the world
to walk through and keeps it. The world stays on that account until whoever runs this server
deletes it, and World Labs’ own terms say how it treats what it is sent.</p>
<p>Without the story server, the TV tells your stories itself, and nothing leaves it.</p>

<h2>What this server keeps</h2>
<p>It doesn’t keep your paintings, your stories or your world. It keeps only:</p>
<ul>
<li><strong>Common story images.</strong> A count of the short images stories use, such as “a lamp
in the window”, so the storyteller can steer away from what everyone gets. An image is kept as a
salted hash and a count, and as words only once at least ten different tellings have used it. None
of it says who painted what.</li>
<li><strong>Your phone’s words, briefly.</strong> While your phone is paired with your TV, what you
say on it waits here until your TV picks it up, and is then deleted. A pairing ends after 30
minutes; anything still in it is never passed on, and is deleted automatically soon after.</li>
${clips ? `<li><strong>A clip, for a day.</strong> When you choose to watch a picture come alive, Nova Reel
writes the few seconds of it to private storage on the server’s AWS account. Your TV fetches it
from there and keeps it, and the storage deletes it a day after it was made.</li>
` : ''}<li><strong>Daily totals.</strong> How many pictures, clips and worlds were made each day and what the
day’s requests cost, so the server stops for the day before it costs too much.</li>
<li><strong>Error logs</strong>, for 14 days: short technical notes about what went wrong, which can
include a few words from the request that failed.</li>
</ul>
<p>To stop any one caller making too many requests, the server counts each internet address’s
requests for ten minutes, in its memory only; it doesn’t store them.</p>
<p>So that a picture, a world or a clip your TV asks for twice is made and paid for once, the
server holds what it made, with a fingerprint of what was asked, for ten minutes, in its memory
only; it doesn’t store them, and they are gone when it stops.</p>

<h2>Your phone</h2>
<p>If you pair your phone, the page it opens sends only what you type or speak there, and only to
this server. If you speak, your phone’s own speech to text turns it into words, and may use its
maker’s online service to do so.</p>

<h2>Children</h2>
<p>Inkwash is for anyone with a world in their head, children included, painting with a grown-up who
set up the TV. What a child paints and says is handled exactly as above, and the storyteller and the
pictures keep to what is right for a young child when the TV says one is painting.</p>

<h2>Terms</h2>
<ul>
<li>Inkwash is offered as it is, as a free prototype, without any promise that it will work or stay available.</li>
<li>The stories and pictures are made by AI. They can be strange or wrong, and aren’t advice of any kind.</li>
<li>Don’t paint or say anything you wouldn’t want sent to the story server as described above.</li>
<li>The server stops answering for the rest of the day once the day’s requests have cost what it allows; the TV goes on telling stories itself.</li>
</ul>

<h2>Contact</h2>
${write}
</main>
</body>
</html>
`;
}
