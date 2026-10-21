# Inkwash on Fire TV: draw the world in your head

**For anyone with a world in their head.** Artists, writers, people who build worlds for the fun
of it, kids who dream big: some of us carry whole worlds around, a castle on the moon, a ferry that
never comes, a dragon who is a friend. We hear "stop daydreaming", and we keep doing it. Imaginary
worlds start early and go with creativity: in two studies, about 17% of 8- to 12-year-olds
described one in detail, and those children scored higher on a creative storytelling task
([Taylor et al., *Child Development*](https://news.uoregon.edu/index%2ephp/content/uo-study-finds-healthy-creativity-kids-imaginary-worlds)).
MacArthur Fellows were about twice as likely as university students to have built one as children
([Root-Bernstein & Root-Bernstein, *Creativity Research Journal*, 2006](https://blogs.scientificamerican.com/news-blog/imaginary-worlds-are-early-sign-of-2009-08-07/)),
and psychologists who study daydreaming call the playful, planning kind "positive constructive
daydreaming" ([McMillan, Kaufman & Singer, 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3779797/)).
But these worlds mostly stay in our heads. A notebook can't hold a world, a sketch doesn't answer
back, nothing remembers what you made last week, and a six-year-old can't type theirs up at all.

**Inkwash makes them real.** The TV opens on your world: everything you have drawn into it
standing there, each thing where it first came. The remote is a brush that draws straight into it,
in lines of light: a place, someone who lives there, something that happens. Two buttons say how
it felt (brighter or darker, calmer or wilder). The storyteller sees the drawing as you see it,
asks a question or two, and tells it back as a story, a line at a time, read aloud; you keep each
line or turn it down with one button. As its story starts, the Set Designer writes the place it
happens in (a library that goes on for ever, lamplit; a drowned city's lake at first light), and as
the story ends, what you drew wakes up in that place, where you drew it: as light where it is dark,
as ink with its shadow where it is light (and with the story server, an image model can make each
thing real). A world whose story hasn't started yet is night, and what you draw is light over still
water. Then it asks: *What happens next?* You draw it, and hear it told your way. Every drawing is
kept in your world, so the dragon from Tuesday is still your dragon on Friday, and looks it. Between
drawings, your world wonders back (*Where does the night ferry go?*), and what you choose becomes
true of it. When you come back it opens like a series: *Previously in Star's world…*

And it forgets exactly what you ask it to. Choose a thing in your world and *Forget* it: the TV
says first what goes with it, and that everything else stays; then it goes, with everything that
grew from it (the lines of its stories, what was true of it, its marks in the drawings, its
picture), and nothing else does. A chain of custody for the world's memory, after
[Custody](https://github.com/Yatsuiii/custody), kept on the TV: every line knows what it was about
and every fact the line it came from, set by code, never by the model.

The world in your head is worth keeping. Inkwash takes it as seriously as you do.

One person, or a family sharing one TV: each has a seal and a world of their own, a grown-up's or
a child's. Four agents work on it, each held to it in code: the **storyteller** looks closely at
how they drew, asks what only they know, tells it, hears how each line lands, and remembers; the
**Worldbuilder** asks about their world between drawings; the **Illustrator** makes each thing
real; and the **Set Designer** decides where their world stands, from its story, as the story
starts. No world has a set background. The TV draws the place at once and asks how it should look:
the Set Designer's three other looks to choose from, or their own words on the phone. Then Amazon
Nova Canvas paints it, over the TV's own drawing, so the horizon stays where their things stand. The
drawing wakes into that place, Step inside opens in it, and the TV at rest shows each drawing in it.

**Status:**
- **Built and tested** in Chromium at 1920 × 1080, driven by simulated remote keys:
  - 86 unit tests for the brush, the remote, "Feel it again", their world on the TV, the
    phone, and the storyteller's loop and tools (what they say came again is never lost), with the
    check that holds a telling to their evidence and the taste that chooses between a line and its alternative, what a child never
    hears and what a telling of what happens next always ends on, the ink keeping smooth on a slow
    TV, a family's painters kept apart, a story told again with what happens next, the demo
    family, the book of their world, and reading aloud; and the new look: the coloured inks, how each part
    of a painting moves by its shape, the camera's framing, their things as cards and as a map;
    and a long memory kept safe: every night kept apart, the storyteller reading the nights a
    world has let go, and a TV short of room losing nothing; and stepping inside: what stands up
    from the paper and where, how far away, and the walk round it; and the night: the light each
    ink gives, where each thing stands in their world at night, and where the water begins; and
    walking through their world: where each thing stands in it, the eye's walk, where it stands
    before a thing (looking up to what is in the sky), and what was told of each thing, night by
    night; and each thing made real on its own: the part of the paper painted, its white cut away, how it springs up, and how a thing hops; and the opening, a night drawn as light at an even pace, never naming who tells the story; and the ledger that caps what the demo's pictures may cost; and worlds that meet: a thing visiting one world at a time, sent home, and let go with its world or its painter; nothing frightening sent to a child's world, and a child's storyteller told only what is gentle of it; where a visitor stands; and the storyteller told what is visiting, a line naming it counted as theirs, and the visitor never kept as a thing of the world it visits; never two things of one name in a world; and picture choices, an answer naming the thing of their world it says; and pictures: how they said a thing looks, on its card and in what its picture is made from, and how much of a picture Nova Canvas cut out is left; and walking inside a world built from their picture, a press a step or a turn, never far from where it was taken; and how a long story is held together: told to them as "you" (their words with how the story says them, a line in "I" sent back and then said as "you", what is kept kept as "you"), what happens next carried on from where it stopped and kept after the story so far, the last chapters word for word and older ones as fenced recaps, the other way to say a line heard at once on "not quite" (only a way that holds), and what it remembered kept with the chapter, on its page, and gone with what is forgotten; and what goes wrong: a world that can't be read opening empty with what was kept set aside, never written over; the storyteller's tools only by name; a question for the phone sent again when a poll doesn't get through; and a family kept wrongly holding one painter to an id and to a seal; and all around a picture and painted again: the panorama's sheet, looking across it with ◀ ▶, and the look a picture is painted again in, one not yet tried first;
  - 80 tests for the story server, among them never paid twice (a request being made waited for, one made answered again for ten minutes and not counted again, only what was made kept, a world asked for twice one world), and among them it comes alive (only a picture the size Nova Reel takes, one six-second shot moving softly through its scene, asked for and looked in on until it is made and looked for only in its own job's folder, counted each day and in the day's spending, and left still when Reel's filter turns it down), walk inside (a quick world asked for from the picture and its scene, private to the guide, looked in on until it is built, the lighter file a TV can draw handed over through the guide, none without a key or past the day's count, priced as it is asked for), all around it (only a sheet and mask the size Nova Canvas widens, the picture kept and its sides painted in its own look, a child's gentle, none past the day's pictures), the Worldbuilder, the Illustrator and the Set Designer (with the looks it offers,
    and what they said of how their world looks), each sent back once when its answer can't be used, what Nova Canvas is asked (for a painting, a place, or one thing alone on white; made again from the picture it had; cut out of its white, or left for the TV to cut when it can't be), their own words for a thing first in every picture of it, a child's picture, the day's
    pictures counted, the day's spending priced and stopped at its limit, each caller's calls
    limited, phone pairings no one came back to let go, errors told without their details, the privacy page and the template held to what the code does, and
    the storyteller answered through Claude Code on a Claude subscription;
  - 42 tests of the engine's worlds, among them a world kept and read back exactly, and one cut short or kept by an older TV opening with all of it that can be read, earlier chapters (the last two as told, older ones recapped in blocks, scored against tonight, never twice, within the budget), told as "you" (a line in "I" found outside quotation marks and a thing's own name, and said to them as "you"), forgetting (exactly the thing and what grew from it goes, everything else is unchanged, no word of it is left, and forgetting it again changes nothing), a thing given by its name being the same
    thing, a mark painted again known again, what explaining a story is (and isn't), how they
    painted, their taste, the evidence
    check, a child's telling held kind, the feeling model, what happens next, last time's story,
    a long memory, the Worldbuilder's and the Illustrator's checks, a thing's look kept, how a
    thing looks in their own words (kept over any look, in every picture of it, and let go), and
    simulated dreamers and painters (below);
  - 33 browser steps, run twice (on the served page, and on the packaged single file opened from
    `file://`, the way the Vega app loads it). They run the story server's own code, with a script
    standing in for Claude that calls every tool the way the storyteller would. They pair a phone
    in a second tab and paint two chapters. Each telling is checked against their evidence before
    it is told. On the first, "not quite" on a line hears the storyteller's other way to say it at
    once, and that is what is kept. Leaving the storyteller with Back and feeling the painting again
    straight away, the storyteller finishing late leaves the new line be. As the first story starts, the Set Designer is shown it and writes where their world stands; back
    home they are asked how it should look, choose a bright toy world, and the place is written again
    in that look and painted. On the second night the storyteller is told what the first night's answers taught,
    recognises a mark from the first, shows the first night's mark beside it and asks; a line
    marked "not quite" is told again; and the chapter keeps what the storyteller remembered for it
    (chapter 1 as it was told, and the ferry and the chapter it read); and home again, the night
    closes on their Worldbuilder's question, asked without being asked (one left waiting as the TV
    goes off is asked again when their world next opens). Then a child paints on the same TV, with a seal and a
    world of their own, and a storyteller told it is talking to a child. Its first telling brings
    in a monster, and brings what the child marked darker closer, so the TV sends it back
    ("Finding gentler words") and the child hears it told kindly. They paint what happens next, a
    sun in gold, and the story carries on with it and is kept with the night. Along the way the sky
    darkens and stirs as the dial is held, the telling is filmed with the part of the painting
    each line is about alive, a card flies in for the night ferry, and the first night opens into
    a world to step inside, their world's own place all round, the night ferry standing up as their
    own ink on the grass, with its shadow and its name. The first night's picture is chosen to come alive: it is asked for with the picture and its scene, the choice says it is coming while it is made, and the clip (a stand-in) plays over the picture and is kept with the night. Then it is built into a world to walk inside (World Labs standing in), its file kept with the night, and walked through with the remote. Then it is widened into a panorama (Nova Canvas standing in) and looked across with ◀ ▶, kept with the night and seen again for free; and painted again as a painting, shown as *Picture 2 of 2*, and OK goes back to the first. Each night's first telling is made real: the Illustrator is sent their ink and the story as it begins, the
    ink blooms into the picture as it ends, and the picture is kept with the night and becomes the
    ferry's portrait on its card in their world; on the second night the Illustrator is shown the ferry
    and its look is kept, so it looks the same from then on; a child's is asked for as a warm
    animated film, and when the image model's filter turns it down, the child's painting wakes up
    in their world's place instead, from its own ink. Back home with the phone paired again, they
    say on it how the night ferry looks; it is kept on its card and in their world, and the ferry
    is made again from the picture it had, as they said, and cut out by (stand-in) Nova Canvas;
    let go, it is made again as it was. From their world, the Worldbuilder asks where the night ferry goes. Last, the demo family opens,
    labelled, and leaves the TV's own family as it was; Moon is offered last time's story, which
    opens with *Previously in Moon's world* and is heard over that night's painting, and is
    stepped inside; Moon's book, opened from Moon's world, keeps on that night's page that it was heard; Star's book opens from the seals and its pages turn; Moon sends the night ferry to visit Star's world: it stands there, clear of Star's things and lit from Moon's drawing, with a card saying it is visiting from Moon's world; Star's storyteller is told it is visiting and brings it into the story, it is kept in Moon's world only, and Star sends it home. Star's world opens in its own place, and is walked through: OK to each thing in turn, the moon looked up to in
    the sky, ▶‖ its night as it was told, read aloud, and Back walks home; and left on the seals, the TV rests, showing the family's paintings, each in its own world's place. Last, the TV is filled almost to its limit, and the
    seals say so; then to the brim, so Moon's world no longer fits: it is kept in IndexedDB
    instead, read from there after the TV is turned off and on, and moved back once there is room.
- **Not yet tried on Bedrock.** The real storyteller and Worldbuilder have told 24 worlds, three of
  them for 22 nights, through Claude Code on a Claude subscription (`npm run cli`), but never
  through Amazon Bedrock, and Dream it real has never made a real picture, nor Nova Reel a clip:
  the tests use a stand-in picture and a stand-in clip. Nova Canvas's background removal and image
  variation are untried too. Walk inside has been run only with a stand-in world: no real World
  Labs world has been built from the TV, nor walked on a Fire TV Stick, whose GPU may find it too
  much (the TV draws it at the screen's full size, dropping to two thirds if it can't keep up, and takes a world of at most 150,000
  points). That costs money, and waits for your go-ahead. Without it, each told painting
  wakes up in its world's place (drawn by the TV), or at night, made on the TV, for free.
- **Packaged as a Vega app** (`vega/`): it builds for the Vega Virtual Device and for Fire TV
  sticks. **It has not yet run on either.** The simulator needs hardware acceleration (KVM) to
  boot, and the cloud machine this was built on has none; and it runs a WebView app only on an
  Apple Silicon Mac (not on Ubuntu, an Intel Mac or Windows), so that is where to try it.
- **The story server** (`server/`) is written and tested against stand-ins. **It isn't deployed
  yet**; that needs an AWS account. Why there is a server at all: Claude runs in Amazon Bedrock,
  and calling it takes AWS credentials, which can't go inside a TV app (anyone could pull them
  out). So a small Lambda function in your AWS account holds them: the TV sends it each turn of
  the storyteller's, and it passes it to Claude and back. It also makes the voice (Amazon Polly),
  makes paintings real (Amazon Nova Canvas, at most `RealPicturesPerDay` a day) and pairs a
  phone. It keeps no paintings or stories. Without it, the TV still paints, keeps each world and
  tells your line plainly, but there's no Claude.
- **What got in our way** building for Vega OS and Bedrock is in
  [`FRICTION_LOG.md`](FRICTION_LOG.md). How to try it, on a Fire TV or in a browser, is in
  [`TESTING.md`](../TESTING.md).

## How it plays

**Who's painting?** A family shares one TV, so Inkwash opens on the painters' seals. Each
painter chooses a seal (Moon, Mountain, Wave, Star, Bird, Leaf, Fish or Sun: the red stamp a
painter signs a painting with, and easier than typing a name with a remote) and says who the
storyteller is talking to, a grown-up or a child. Each keeps a world of their own: their
chapters, their things, what their tellings taught, how they usually paint and mark the dial. For a
child, the dial reads brighter and darker, calmer and wilder, and the storyteller is told to use
words a six-year-old knows, to keep the telling kind (never adding anything scary, never making
what they marked darker bigger), to ask only about the painting, and, if something they say
suggests they are not safe, to tell them to tell a grown-up they trust. A TV that kept one world
before there were painters opens it as the first painter's, untouched. Choosing a seal opens that
painter's world.

**Your world is home.** Not a blank page: their world opens first, in its own place (below, *Where
it stands*). Everything painted into it stands there, each thing where it first came: as the ink they
painted it in, with its shadow on the ground, in a place that is bright; in its own light, in a place that is
dark; held upside down in the ground as much as the ground shines. The nearer, the bigger, and what
was painted high up risen into the sky, with paths between the things that came in the same
chapter. The one chosen stands out, with a ring round it, and its card comes up below: its name,
the chapter it came in, how often it came back, what is true of it (◀ ▶ goes from thing to thing).
Until its story has started, a new world stands on a still lake at night, each thing in the light
of its own ink. ▲ ▼ and OK choose what to do: *Paint something new*,
*Walk through your world*, *Paint more of the night ferry* (the storyteller then tells that
painting as more of it), *Hear last time's story*, *What's out there?*, or *How it looks*. Every
chapter ends back in it, grown. Back on a clean
sheet returns to it, and Back there to the seals. The inkstone and the brush are on screen only
while painting.

**Where it stands.** No world has a set background. As a world's story starts, the Set Designer
reads it (the first telling, what they said as they painted) and writes the place it happens in: a
library that goes on for ever is lamplit under a roof, a playful adventure is bright and chunky
like a toy world in an animated game, a drowned city is a still lake at first light. The TV draws
it at once, and back home asks *How should your world look?*, with three other looks to choose
from (*A misty ink landscape*, *A bright toy world, chunky and rounded*, *A golden evening in
oils*), *Keep it as it is*, or their own words said on the phone. A look chosen has the place
written again in it; then Nova Canvas paints it. *How it looks*, at home, asks again any time. It
is the same place everywhere their world is shown: home, the walk, the painting woken, Step inside,
the sky round the paper while a story is told, and the TV at rest.

**Walk through your world.** The picture of their world is a place to walk into. It starts on
that very picture, from the water's edge, and every thing from every night stands where it first
came, facing them as they go, doubled in the water, with the paths of light on the water between
what came on the same night and fireflies over it. ◀ ▶ turn and ▲ ▼ walk (held; a tap turns or
steps a little); OK goes to each thing in turn, nearest first, and stands before it: on the water,
eye to eye; up in the sky (the moon, a dragon in flight), from below, looking up into the stars,
the horizon low. Its name, the night it came and the first thing told of it come up over it. ▶‖
hears the nights it came in, as they were told, a line at a time, read aloud (again to stop); Back
walks home to the water's edge, where their world is as it was, the last thing gone to the one
shown. Nothing in it is generated: it is their world as it is kept, and it works without the
story server (with it, the lines are read in the storyteller's voice) (`src/walk.js`).

**What's out there?** The Worldbuilder (Claude Haiku 4.5) is shown what is in their world (its
things, what is true of each, what is unresolved, the questions asked before) and asks one
question about one thing in it, with a few answers to choose from: *Where does the night ferry
go? To an island of lanterns. Under the sea. Up to the moon.* What they choose is kept as true of
that thing, and the storyteller tells their world with it from then on; or they paint their own
answer, and it is told as the answer; or they let it be. Its answers are held to their world in
code: about a thing that is there, never a question asked before, and for a child nothing
frightening they never brought. From a world's second chapter, every night kept closes on one: home
again, their Worldbuilder asks without being asked, once what the night kept has come in (if they
are already doing something, it waits). Left unanswered as the TV goes off, it is still waiting
the next time their world opens: *Still wondering. Who rides the night ferry?*

**The painting wakes up.** It wakes a part at a time while it is told: as each line ends, the part
it was about settles back into the paper and wakes there, through a soft opening the shape of its
own strokes onto the place it wakes into; what stands apart from it stays paper until its own line.
As the story ends, the painting wakes up in their world's place, as it is at home (painted, once it
has been): what they painted stands there as their own ink (black as black, a wash as a thin veil, a
coloured ink its own colour, every dry streak as it was), lit a little from where the place's light
is, with its shadow thrown behind it and held in the ground as much as the ground shines. On a
world's first chapter, the place is written as the story starts (*Where it stands*, below), so even
the first painting wakes into it. A world with no place yet wakes at night: their ink turns to
light where they painted it, dense black moonlight, gold lamplight, indigo blue and cinnabar fire,
over still water that holds it upside down. Either way it is made on the TV in a moment, on the
GPU, and costs nothing. The TV at rest shows their paintings this way too, each in its own world's
place.

**Dream it real.** Ink is how you paint a world, not how you see it. So as a night's first
telling begins, the Illustrator (Claude Haiku 4.5, which sees the painting) reads the story and
what is true of the things in it, and writes the scene; an image model, Amazon Nova Canvas, paints
it over their strokes, holding loosely to the edges of their ink, so a rough drawing becomes the real thing they meant, not a traced scribble, and what they painted stays where they
put it: the long stroke a pier, the ferry waiting at its end, at dusk. When the story ends,
the ink blooms into it, from where they painted most. It is kept with the night, and from then on
it is how their world looks: on its cards, in *Previously in…*, on the TV at rest. How
each thing looks is kept the first time and given back to the Illustrator every night after, so
the night ferry is the same ferry night after night. A grown-up's world looks like a photograph
of a real place; a child's like a frame from a warm animated film, with nothing frightening in it.
One picture a chapter; without the story server, or when the image model turns one down, the
painting wakes up in their world's place instead (or at night, until it has one). (Not yet tried with the real image model: the tests use a
stand-in picture.)

**Kids too.** Everything works with the remote alone; the phone is never needed. For a child:
- **Read aloud:** the storyteller's questions, each choice as they reach it, its tips and every
  line it tells, in its voice (or the browser's, without the server), so a child who can't read
  yet can answer.
- **Picture choices:** an answer that names something already in their world (or visiting it)
  shows that thing's own picture beside the words, its strokes as light, as it stands at home:
  *Up to the moon castle*, with the castle they drew. Without the server too: the TV's own
  question at the turn shows *the night ferry, again* with the ferry.
- **Always in view:** four steps on the felt, Paint, Feel, Listen, Keep, with where they are lit,
  so what comes next is never a surprise.
- **Pictures on the dial:** a sun at brighter, a cloud at darker.
- **More time:** the painting comes back more slowly, and each line of the telling waits longer.
- **A storyteller told how to talk to them:** words a six-year-old knows; never correcting their
  dream, saying what it really was, or calling anything in it silly, impossible or wrong, however
  big; plain sentences, without figures of speech they might take literally.
- **A little story, with their world's friends in it:** something happens, with a small happy
  surprise; one or two things from their world come into it by name, as they already are (flap,
  flap! the dragon friend takes the balloon's string); a sound to say, something that happens again and
  again; and what they drew and answered stays just as they said (a star they called a star stays a
  star). Tried on five drawings in a child's world, before and after, with the real storyteller,
  judged blind in both orders: the new tellings won on delight, story and their own world all five
  times; lines that only said how a mark looked fell from 11 to 3.
- **And held to it in code:** whatever the model writes, a child never hears a line that brings in
  something scary they never brought, makes what they marked darker bigger or closer, or uses a
  figure of speech (below).

**What happens next?** Once a story is told, the TV asks. The strokes painted then are theirs to
choose: more of the story, or a different ending. ▶‖ brings back only those strokes, to mark how
they feel, and the storyteller tells it again: the start as it was told, then what they
painted next, which it never explains or takes back. The night keeps both; what it brings is
kept, and the threads it settles close. The next time, they are welcomed back to it ("Last time,
you painted what happened next"), and if something comes back that they once carried on this
way, the storyteller may let that come back too.

**Previously in their world.** When they come back on a later day, their world opens with *Hear
last time's story* first. It tells the story as it was
last told (with what they painted next, if they did, and without the lines they turned down),
over the painting kept that night, each line lit on its strokes and read aloud, the way a series
opens with what happened last time: *Previously in Star's world…* At its end the painting wakes
up again, as it did that night. No model is asked, so it is there without the story server, and
costs nothing. Each time is kept, and so is "Not tonight", so
it isn't asked twice in an evening.

**Their book.** « on a painter's seal, or *Read your book* in their world, opens their world as a
picture book, paged with ◀ ▶ (OK turns the page too), each page turned over about the spine. Its
title page: *Star's book*, how many chapters and when; and who and what keeps coming back,
each in a sentence to read at a glance ("The rocket: very bright and very wild the first time";
"The dragon friend: first painted in what happened next, in chapter 2"), in a child's words for a
child's book. Then a night to a spread, the first first: on the left, that night's painting as it
was kept; on the right, its title and its story as it was last told, without the lines they turned
down, what they painted next set apart, how it felt (their word for it, or their marks), the things
in it, and how often it was heard again. For a child, each page is read aloud. A record of the world
they are building, and for a child, a window for the grown-ups who look after them. Built from the
world on the TV; nothing leaves it.

**A demo family.** ▶‖ on the seals (or `?demo` in the page's address) opens a demo family,
labelled as one on the felt: Moon, with three earlier nights (a long pier and the night ferry
waiting at its end; the ferry again, with a lantern; the ferry leaving, and the bridge they
painted out to it next), and Star, a child, with three: a rocket that is going to the moon; the
rocket landed by a castle on the moon, and a dragon who flew out of the castle, painted as what
happened next; and the dragon friend back again, to fly on over the clouds. Their nights were
painted in this page with the real brush, ink and harness, by scripted remote presses, and told by
a scripted storyteller (`npm run demo` makes them again). The demo is kept apart from
the TV's own family and laid out fresh each time it opens, its nights moved to the days before
today, so a night painted in it tonight meets a real history: Star is welcomed back to night 4 and
offered last time's story, and a rocket painted where the first one stood is the rocket again.

The remote is held in one hand, and the thumb presses one button at a time.

| | Brush lifted | Painting | Feel it again | The storyteller asks | Telling |
| --- | --- | --- | --- | --- | --- |
| **OK** | Touch the brush to the paper | Lift: the line tapers off as it leaves | Skip, to one word | Answer | Next line |
| **◀ ▶** | Move | Steer | Hold where it felt calmer, or more stirred | Choose an answer | |
| **▲** | Move | Ease off to the tip: a fine, quick line, which breaks into dry streaks sooner | Hold where it felt lighter | Choose an answer | That's it |
| **▼** | Move | Press: the line swells and slows. Hold: it stops, and the ink pools and spreads | Hold where it felt heavier | Choose an answer | Not quite |
| **« »** | Choose the ink: dense, light, clear water, or a coloured ink (indigo, gold, cinnabar) | The same, for the next stroke | | | |
| **▶‖** | Tell my story (first: feel it again) | Lift and tell | Skip | Answer | Pause |
| **Back** | Wash out the last stroke; told and kept, twice: a fresh sheet; on a clean sheet, your world | Wash out this stroke | Back to the paper | Skip the question | Back to the paper |

The brush is dipped fresh for every stroke, and its ink runs out as it goes. Only the last six
strokes wash out; once the night is kept, or the next stroke back has soaked in, Back pressed again
puts the painting away for a fresh sheet (twice, so one press never loses a painting; a told one
stays kept in their world, picture and all). While the storyteller is looking, Back takes you back
to the paper: before the telling, it stops; after it, it finishes remembering quietly. Painting
what happens next, Back before any of it is painted keeps the dream as it was.

## The look

A world, told and kept, shouldn't look like a form. What's on the screen:

- **Their world's place, everywhere.** Their world's own place is round everything they do once
  its story has started (and a night sky until then), and the rest is the same few things on every screen: what the TV says or asks is one dark glass
  panel, every choice is one chip, quiet until it's chosen and then lit in ember, and the small
  words over a title are gold. What they made stays paper: the sheet, the pages of their book, the
  cards of the things in their world.
- **Coloured inks.** Beside dense ink, light ink and clear water, three colours: indigo, gold, and
  cinnabar, the red of the seal. Each has its own channel in the paper, so colour lies over and
  under the black as real pigment does. Gold catches the light in fine flecks. Colour wets the
  paper but stays where it lands.
- **The sky around the paper.** While a painting is made, the paper lies on the felt. Once it
  is felt, told or remembered, the paper floats in their world's place (or, until it has one, among
  the stars), and the sky feels what they mark: brighter, and dawn rises gold from below; darker,
  and it deepens to indigo; wilder, and at night the stars flicker fast and shoot across it; calmer,
  and they barely glimmer. During the telling, each line's sky is how that part felt to them.
- **A camera.** While a story is told, the sheet moves the way a film would: in on the part of the
  painting each line is about, framed above the telling, gliding to the next.
- **The painting, alive.** That part of the painting comes off the paper and moves the way its
  shape does: a rocket or a tower rises, a moon glows, a dragon or a wave swims, a shore drifts, a
  star twinkles, a pool of ink breathes. It settles back as the next line comes, so the painting
  is never other than the one they painted.
- **Previously in Star's world.** Last time's story opens the way a series does: the nights
  before it go by as a strip of paintings, then its title, signed with their seal.
- **Cards to collect.** When a night is kept, each thing new to their world flies in as a card,
  its picture cut from tonight's painting: *New in your world: the dragon friend*. Then it comes
  to life on the card: its ink shimmers (*Coming to life…*) while it is painted on its own, then
  its own picture springs out of the ink with a burst of sparks and a chime, and the badge turns
  gold: *It came to life!* A thing that comes back gets a card too: *Came back, a second chapter*.
- **Their world**, where the TV opens for them: each thing in it standing in its place where it
  first came, as its own picture made real (*Each thing made real*, below), or until then as their
  own ink, with its shadow (or in its own light, where the place is dark), the
  nearer the bigger, what was painted high up risen into the sky; paths between what came in the
  same chapter; the one chosen with a ring round it; and its card at the foot of the screen, one at
  a time (◀ ▶), with what is true of it. As it opens, each thing says hello with a little hop,
  left to right; the one gone to with ◀ ▶ hops again (stretched as it jumps, squashed as it
  lands) with a sound of its own by how it moves: what rises whooshes up, what glows rings, what
  swims warbles, what twinkles sparkles, what is built knocks; a child hears what is true of it.
  Few words on it: a line of welcome, the three things to do that matter most (the rest under
  *More…*), and the one chosen's name (with what they chose to be true of it, if they did); a
  thing's name that would be under the choices goes over it instead. Left alone ten seconds, even those fade, and it is only their
  world; any button brings them back, and does nothing else.
- **Walk through your world.** From the water's edge into it: everything they ever painted,
  each where it first came, facing them as they walk. OK goes to each thing in turn (and looks up
  to what is in the sky), ▶‖ hears the stories it came in, Back walks home.
- **The TV at rest.** Left on the seals, the TV becomes a frame for the family's paintings, as
  they were made real where they were, or else woken in their own world's place: each in turn,
  slowly, with its title and whose world it is. Any button wakes it.
- **Walk inside.** Once a story is told and its picture made real, *Walk inside* builds that
  picture into a 3D world with World Labs (Marble's quick model, from the picture and the scene the
  Illustrator wrote for it). It takes a minute or so; meanwhile the choice says *Building your
  world…* and they can go on. Then they walk through it with the remote: ▲ ▼ a step forward or
  back, ◀ ▶ a turn, a little way from where the picture was taken (a world built from one picture
  is whole only near it); Back is the picture again. The world's lighter file, about 100,000 soft
  points (Gaussian splats), which a TV can draw, comes through the story server and is kept with
  the night, so walking it again, after last time's story too, costs nothing. three.js and Spark
  draw it: they are packed into the app as text and read only once someone walks inside. World
  Labs is the one service here that isn't Amazon's: nothing on AWS builds a world to walk through
  from a picture.
- **See all around it, and paint it again.** Once a story's picture is made real, *See all
  around it* widens it to either side into a panorama: the TV sets the picture in the middle of a
  2560 × 800 sheet (its sides its own edges mirrored, for the model to start from) with a mask of
  what to paint, and Nova Canvas paints the rest of the place in the same look (`OUTPAINTING`).
  They look across it with ◀ ▶, and let go it drifts on slowly by itself; Back is the picture
  again. It is kept with the night, so seeing it again costs nothing. *Paint it again* makes the
  same ink real in another look, one not yet tried first: a grown-up's as a painting, a picture
  book or an animated film; a child's as a picture book or a painting. Each one is kept to go back
  to (*Picture 2 of 2*; OK goes to the next), and the one left showing is the one kept with the
  night, with its own panorama. Both came from Dream Canvas, an earlier web prototype.
- **Step inside.** Once a story is told, or last time's story heard again, they can step inside
  it. The paper tips back and becomes the ground of their world's place, the place comes up all
  round, and each thing they painted stands up from where they painted it, the way a pop-up book
  opens: a thing made real on its own as that picture, as tall as they painted it tonight, and
  everything else as their own ink, each with its shadow on the ground, and held upside down in it
  as much as the ground shines (or, in a world with no place yet, its own ink in light over still
  water at night, with a pool of light round its foot). Higher up the page stands further away, and what was painted near
  the top is up in the air (the moon, the stars, a bird, a dragon in flight); washes and long flat
  strokes (a shore, a horizon) stay painted on the ground. What drifts in the place's air (motes,
  snow, petals, fireflies) drifts at every depth.
  Things they kept have their names glowing over them. ◀ ▶ turn the world round on its middle, like a pop-up book turned on a table, so it is always in
  view; ▲ ▼ come nearer or go back; OK goes to each named thing in turn, turns it to face them and
  says the line the telling gave it (read aloud for a child); Back folds it all back into the
  painting. Everything standing there is what they painted, or a thing's picture already made
  from it: nothing is sent anywhere to step inside (`src/inside.js`).

How it stays cheap on a TV stick:
- **A stroke cut out exactly.** The ink shader can draw the paper alone, and the ink alone as the
  share of the light it lets through; the painting is one times the other. So the strokes a line
  is about are lifted off as their own picture, and what stays where they were is the painting
  divided by that picture: laid one on the other, unmoved, they are the painting to the pixel. A
  kept night, which is only a JPEG, is divided by the paper it was painted on, the same sheet
  every night (`src/cutout.js`).
- **Only transforms move.** The living strokes, the camera and the cards are CSS transforms and
  opacity: nothing is redrawn while they move (`src/life.js`, `src/camera.js`).
- **The night, on the GPU.** Made the way a canvas would make it (a pass over every pixel, blurs
  for the glow, a stroke cut out with a few composites), the light took a TV stick seconds, and
  stepping inside as forty layers in CSS 3D stuttered. So the night is drawn with WebGL2
  (`src/glow.js`): a shader sorts each pixel of ink into its light, straight from the painting
  (a kept night's divided by its paper, in the shader) and through the shape of a thing's strokes,
  so nothing is cut out first; the glow is halved a few times and blurred a few texels wide; and
  core and glow are added up once, into one texture with smaller copies of itself for the softer
  reflections. Their world at night and stepping inside are each one canvas, redrawn from a few
  dozen quads, every corner put where the eye sees it; thirty times a second when nothing moves
  fast, and at three quarters or half the size if a TV can't keep thirty. A painting at night is
  drawn on the GPU, read back once and encoded away from the page's thread. Walking through their
  world draws the same lights, each now a quad facing the eye, under a sky that repeats as the eye
  turns (home's own sky, with more of it above to look up into); their names are the page's own
  text over it, so they stay sharp however small the night is drawn. Starting a walk takes about
  80 ms of the page's time in Chromium on the cloud machine, and a frame of it under a millisecond
  (4 to 10 ms with the CPU slowed six times, about a TV stick's). The page's own work in
  a frame is under a millisecond in Chromium on the cloud machine, and `__inktv.frames` says what
  it is on a TV. Frames a second have to be measured on one: the cloud machine has no GPU, only
  one emulated in software at about 40 megapixels a second, where a full-screen frame takes 50 ms.
- **The night is drawn once** and never moves. What moves is small: two dozen glimmering stars, the
  odd shooting star, and dawn and depth, two gradients that change only when the feeling does
  (`src/sky.js`). A first sky that turned the whole star field made frames four times slower in a
  software renderer, so it went. While a dream is painted, the sky is hidden and costs nothing:
  once it has faded out, its stars rest.
- **Nothing is drawn again that hasn't changed.** A changed canvas costs a TV stick much of a frame
  to show, however little changed on it. So the brush has a canvas a little bigger than itself,
  moved with it and drawn only when it moves or is pressed; the feeling line only while the
  painting comes back; a label is written only when what it says changes; and the paths of light
  behind their world are drawn only when they move. Each is the same picture, drawn as before:
  only less often. With the CPU slowed six times, the paper at rest kept the page's thread 98%
  busy, most of it a brush that hadn't moved; now 25%.
- **As little read back from the GPU as can be.** The painting pulled apart, to cut its strokes
  out for the telling, the cards and stepping inside, is read back once and kept until the paper
  changes; the paper alone once, when it is dry (dry, it is the same sheet every night); and the
  painting the storyteller looks at is made a JPEG away from the page's thread, so the brush
  doesn't stop for it. The phone's codes are made once for an address, and whether the GPU can
  draw into a size and kind of picture is asked once (asking waits for it to catch up).
- **Measured screen by screen** (`scripts/smoothness.mjs`): with the CPU slowed six times, how busy
  the page's thread is on each screen and on what, the gaps between frames, long tasks, and the
  scripts that ran in each frame over 50 ms. Before and after the changes above, each screen looking
  just as it did: painting went from 12 frames a second to 17.5, the paper at rest from 19 to 27,
  their world at night from 12 to 16, the telling from 10 to 14, the journal from 36 to 50, and the
  share of the time the picture stood still in stutters while painting from 98% to 54%. (Feeling
  it again went from 12 to 10: its line is drawn again.) Measured again with the night look and their
  book: the seals went from 22 frames a second to 42, with no paper behind them, and their book turns
  its pages at 55; no screen got slower by more than the run-to-run noise (the paper alone and still
  for 20 seconds holds 60 frames a second, before and after). On the cloud machine, which only emulates
  a GPU, most of what is left
  is the emulator reading each WebGL frame back for its software compositor, which a TV's GPU
  doesn't do: the counts that carry over to a TV are the page's own script, style and layout.

## The ink

What makes it look like ink and not like a drawing program:

- **The brush** (`src/brush.js`) is a tuft of 16 clumps of bristles in a teardrop footprint.
  - **Pressure** decides how many clumps touch the paper and how wide they spread.
  - **Each clump holds its own ink** and lets it go at its own pace, faster when it's pressed and
    when it's full.
  - **Speed:** a slow line soaks the paper. A quick one spreads the ink too thin to cover it, and
    breaks into streaks along the stroke ("flying white").
  - **Length:** a long stroke runs dry, clump by clump.
  - **Held still**, the ink soaks out of the whole tuft into one growing pool.
  - **The hand:** strokes land moving, and lifting tapers them to a point. Pressure and heading
    waver a little, so no line is ruled.
- **The paper** (`src/inkgl.js`) is made once, from noise and a few thousand drawn fibres: its
  colour, its tooth, and how much water each spot holds and how fast water moves through it.
- **The crisp layer** takes each bristle's mark at full resolution. Where the brush can't cover
  the paper, the mark catches only on the tooth's peaks.
- **The wet layer** runs at half resolution, a few steps a frame, only while something is wet:
  - **Spreading:** water past what the paper holds spreads into dry paper, fastest along the
    fibres, so edges feather.
  - **The halo:** ink travels with standing water, but damp fibres hold it back at the wet edge,
    which leaves a pale halo around a wet stroke.
  - **The rim:** edges dry first, so the water inside flows out to them and leaves a darker rim.
  - **Blooms:** clear water laid into wet ink pushes the ink out into a bloom.
  - **Drying:** wet paper looks a shade darker, and dries back.
- **Without WebGL2**, `src/ink.js` draws a plainer version in 2D.

`dev/lab.html` paints scripted pictures with the real brush and ink in simulated time, for
tuning by eye: `/dev/lab.html?scene=samples` (or `bamboo`, `one`, `drop`).

## The storyteller

- **What the brush did:** a coach's line, once each, when the brush first runs dry, pools, or
  changes ink. It never claims to see the picture.
- **With the story server, after you pause:** once there are two strokes or more, it looks at
  the painting and says one short thing: what a mark might be in the dream, a question, or a
  next step. It sends a 768-pixel JPEG of the paper and a summary of each stroke: where it went,
  its ink, its pressure, where it pooled.
- **If you're talking to it on your phone,** it interviews you gently: one short question about
  what you're painting, or what you haven't said yet (never what it means). If a mark looks like
  something from your earlier dreams, it may ask: "Is that the stopped clock again?" Its question
  shows on the phone too.
- **▶‖ tells the dream** (after "Feel it again", below). The storyteller looks, may ask you one or two
  things on the TV, then tells the dream: a title and three to seven lines. Each line lights up
  the part of the painting it's about and is read aloud, and a red seal is stamped with the title.
  While it works, the screen says what it's doing: "Looking closer at mark 6", "Remembering
  night 2". It begins as the painting comes back to be marked: its first look, read and recall
  happen while they mark how it felt, so once they finish there is a turn less to wait for (below,
  *A head start*).

| Job | Model on Amazon Bedrock |
| --- | --- |
| The storyteller: looking, asking, telling, remembering | Claude Opus 5.5 (`anthropic.claude-opus-5-5`), at medium effort (the template's `Effort`: low, medium or high) |
| Remarks as you paint, which have to be quick | Claude Haiku 4.5 (`anthropic.claude-haiku-4-5`) |
| The Worldbuilder: one question about their world, with answers | Claude Haiku 4.5 |
| The Illustrator: seeing the painting, the scene it is made real from, how each thing looks | Claude Haiku 4.5 |
| Painting it real, over their ink | Amazon Nova Canvas (`amazon.nova-canvas-v1:0`), held loosely to the ink's edges (`CANNY_EDGE` at 0.45), 1280 × 800; painted again the same way in another look when they choose *Paint it again* |
| Widening the picture into a panorama, when they choose to see all around it | Amazon Nova Canvas, `OUTPAINTING`: the picture kept in the middle of a 2560 × 800 sheet and its sides painted |
| Setting the picture moving, when they choose to watch it come alive | Amazon Nova Reel (`amazon.nova-reel-v1:0`): one six-second shot from the picture, 1280 × 720, made as an async job into S3 |
| Building the picture into a world to walk through, when they choose to walk inside | World Labs Marble (`marble-1.0-draft`), from the picture and its scene; the TV draws its lighter file (about 100,000 soft points) with three.js and Spark |
| Each thing made real on its own, from its strokes | Amazon Nova Canvas, held to its strokes' edges (`CANNY_EDGE`), up to 640 a side, alone on white; made again from the picture it had (`IMAGE_VARIATION`); cut out of its white (`BACKGROUND_REMOVAL`) |

**Four agents, each held to their world in code.** Not every tool is an agent: the brush, the
ink, the map and the checks are code, and only where judgement is wanted is a model asked.
- **The storyteller** runs a loop with tools on the TV (below). Each telling is checked against
  their evidence and, for a child, held kind before it is told; sent back once with why.
- **The Worldbuilder** (`server/worldbuilder.mjs`, `engine/dreams/wonder.mjs`) answers with a
  question and choices; code checks it is about a thing in their world, not asked before, and for a
  child frightens no one, and sends it back once with why.
- **The Illustrator** (`server/illustrator.mjs`, `engine/dreams/illustrate.mjs`) answers with a
  scene and how each thing looks; code checks the scene is one to paint from and, for a child,
  brings in nothing frightening, and that a thing's look, once kept, stays as it is. Then Nova
  Canvas paints it, its own filter on top: a picture it turns down leaves the ink as it is.
- **The Set Designer** (`server/scenery.mjs`, `engine/dreams/scene.mjs`) reads a world's story as
  it starts (on its first chapter, as the first telling begins, with that telling in it), what they
  said as they painted, and their own words about how it looks if they gave them, and writes
  where it stands: the sky or a roof and its light, up to three layers of what stands far off, the
  ground, the haze, what drifts in the air, how their things stand there, its look in an art
  director's words, and three other looks it could just as well have. Code keeps only what the TV can draw (`checkScene`), and sends it back once if
  it can't be. The TV draws it at once (`src/scene.js`; their things as their own ink, with
  shadows, or as light where it is dark) and, back home, asks how it should look: the three other
  looks, *Keep it as it is*, or their own words on the phone; a look chosen has the place written
  again in it. Then it sends that drawing to be painted: Nova Canvas
  paints the place in its look, held to the drawing's edges (`CANNY_EDGE`, 1536 × 864) so the
  horizon stays where their things stand, and the TV lays it over the drawing, its edges brought
  round to meet for the walk. Both are kept with the world. One picture per world, counted with
  the day's pictures; without one (no story server, none left today, or turned down), the drawing
  stays, and without the story server at all, a world stands at night on the lake.
- **Each thing made real** (`src/things.js`, `server/illustrator.mjs` `thing`). Ink strokes standing
  up in a painted place look like what they are, strokes: a lighthouse is a few black lines with a
  shadow. So, back home, each thing of their world is painted on its own: its strokes alone, in
  black on white, over the part of the paper it is in (its box with a margin, at most 640 pixels
  a side, no thinner than 4 to 1), are the condition image; Nova Canvas is asked for that one
  thing, as the Illustrator said it looks, in the look of their world's place, whole and alone on
  plain white (`NOT_THING` keeps out ground, sky and other things), and holds to its strokes'
  edges, so it keeps the shape and size they gave it. Nova Canvas then removes its background
  (`BACKGROUND_REMOVAL`); if it can't, or with `ThingCutout=tv`, the TV cuts the white away
  itself, from the edge of the picture inwards (a white window inside it stays), easing its fringe
  into the clear. It is kept among their paintings with what it was made from, so it is made again
  only when that changes: its strokes, its look, how they said it looks, or how their world looks;
  and made again, it is painted from the picture it had (`IMAGE_VARIATION`), so it is still the
  same one. Then it stands where their strokes stood, at
  home and when they step inside, with its shadow. A thing new to their world comes to life on
  its card as the story ends (above), in the look the Illustrator gave it while the story was
  told; the rest come to life when their world opens, the ones that come most first, two at a
  time, each glowing while it is made and springing up with sparks when it comes, until the day's
  pictures run out (and then none is asked for again for an hour). A picture with nothing to cut
  away (painted with a place round it) or turned down, and their ink stands there instead.

  **In their own words.** At home, with their phone paired, *Say how the night ferry looks* takes
  their words for it: "it has a red funnel and one lit window". They are kept on it in their
  world and on its card (*In your words: …*), and given first, over any look the Illustrator gave
  it, in every picture of it from then on, its own and the night's; it is made again so, at once.
  *Let go of your words* takes them back.

- **Fallback:** if the AWS account can't use Opus yet, the storyteller goes on with Haiku, without
  thinking. If the storyteller fails altogether, the pipeline it replaced (`/tell`, below) tells the
  dream, and failing that, your line is told plainly.
- **Voice:** Amazon Polly's neural voice Ruth. If your region doesn't offer it, choose another
  with the template's `Voice` parameter (Kajal, for Indian English).
- **Client:** Claude is called through the Anthropic SDK's `AnthropicBedrockMantle` client.
- **Region:** Claude in Amazon Bedrock serves Mumbai (`ap-south-1`) on its global endpoint.

## Your dream, night after night

Many people paint the same kind of night. Asked the same way, a model tells them all much the
same dream: a moon, stars, a lantern, quiet water. AI-assisted stories are known to drift toward
each other ([Doshi & Hauser, 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11244532);
[Padmakumar & He, 2024](https://arxiv.org/abs/2309.05196)). And anyone can get one good dream
story from a chat app with a good prompt.

So the TV asks more of the person than a prompt can, in ways only this app can, and keeps what
their dreams have held:

1. **Their own words, by phone.** The remote has no microphone an app can use, so a phone lends
   one.
   - **Pairing:** a QR on the clean paper (and small on the felt after), from a six-letter code.
     The phone opens a small page from the story server: type, use the keyboard's microphone, or
     press Talk where the browser turns speech into text.
   - **Kept with the stroke:** what they say is kept with the stroke they were painting as they
     said it, and shown on the TV ("You said: …"). The telling is built from it, part by part.
2. **Feel it again, in two dimensions.** ▶‖ doesn't tell the dream straight away.
   - **The replay:** the sheet draws back and the painting comes back stroke by stroke, in the
     order it was painted. The stroke coming back is traced in cinnabar.
   - **The dial:** they hold ▲ where the dream felt lighter and ▼ where heavier, ▶ where it felt
     more stirred and ◀ calmer. A line draws itself under the painting, trembling and thick where
     stirred, thin where calm, with a word for the feeling by its bead ("afraid", "peaceful") and a
     hum that rises with it and beats when stirred. Two dimensions tell fear (heavy, stirred) from
     grief (heavy, still); this is how emotion research measures feeling over time (the affect
     rating dial; FEELTRACE).
   - **Skipping:** OK gives one word instead.
   - **A head start:** with the story server, the storyteller begins as the replay starts, shown the
     painting and everything but how it felt (`firstMessage` with `later`). Its first turn looks,
     reads and recalls while they mark it; its next turn waits for what they marked (or the one
     word) and hears it after what those tools found (`laterMessage`, `runGuide`'s `later`). A
     telling asked for before it has heard how it felt is sent back once with it, a question waits
     for it, and Back on the paper ends it untold. The night it wakes into is made once they have
     marked it, so the replay never stutters.
   - **Fair to a slow TV:** each stroke's feeling is the dial's mean over the time it came back,
     not over the frames drawn, so a TV that drops frames marks it the same.
   - **A feeling model each person teaches** (`engine/dreams/affect.mjs`). Every stroke they mark
     is a lesson: how they painted it, what they said as they painted it, and how it felt. From
     those, a small Bayesian model learns how this person's brush and words carry feeling. It reads:
     - **The brush:** pace, pressure and how much it shook, the wait before the stroke, holding
       still, a wavering line, rising or falling, height on the sheet, size, ink, painted again.
       All of it is measured against their usual hand.
     - **Their words:** the feeling in what they said on the phone at that stroke, where "not
       afraid" counts as not afraid.

     It starts from what lines are known to express (rising lines lighter, quick and wavering
     lines more stirred) and moves to what their marks show. Then it can read a painting they
     didn't mark: when they skip the dial, the storyteller gets each stroke's likely feeling, labelled
     as a guess and with how sure it is. Their one word, if they gave one, sets the night's
     overall level. Every night they do mark, it reads the painting blind first and is scored
     against their marks, so whether it is learning them is measured, not assumed. The storyteller is
     told what it has learned ("For them, holding the brush still has gone with feeling
     heavier") and how far this person usually moves the dial, since a quiet hand's small mark
     can be a strong one.
3. **The storyteller, as an agent.** Claude Opus 5.5 makes every judgement: what a mark is, what to look
   at, what to ask, how to tell it, what to keep. The TV gives it what no chat window has, as tools
   it calls (`src/harness.js`; `src/agent.js` runs the loop on the TV, and `server/agent.mjs`
   carries each turn to Claude):
   - **How it was painted.** Its first turn holds the painting twice, as it is and with each stroke
     numbered, and tonight as data: each stroke's ink, place and length, how long it took, the wait
     before it, how long the brush was held still, its pools and pressure; what was washed out, and
     before which stroke; how each part felt, in both dimensions; the turn; their words, with the
     strokes they were painting. And what stands out in how they painted it, read against how this
     person usually paints (`engine/dreams/gesture.mjs`, a running picture of their hand kept from
     night to night): "You waited 6.5 s before this stroke, longer than you usually wait (about
     1.1 s)"; "You painted this, washed it out, and painted it again"; "You held the brush still
     here until the ink pooled". `look` sees closer, lights up strokes, or shows the painting as it
     was part way through; `strokes` reads particular strokes in full.
   - **Their dream world, to search.** A short brief comes with the first turn: the things that
     keep coming and how they have felt, what is unresolved, what they turned down, the storyteller's own
     notes on how they like their dreams told, and marks tonight shaped and placed like ones a thing
     came as before (hints, never conclusions). `recall` searches the world, `thing` and `night`
     read one thing or one night in full, and `look` with a night shows that night's painting, kept
     on the TV.
   - **Earlier chapters, the way a long story is kept in mind** (`memoryOf`, `engine/dreams/tools.mjs`).
     The last two chapters come word for word, as they were told (THE LAST CHAPTERS). Older ones come
     as short recaps, only where they bear on tonight (EARLIER CHAPTERS): in fixed blocks of four
     chapters, each recap made from what its chapters kept (the title, the things in it, the line
     that names the most of them, what became true), said to them as "you"; scored against
     tonight's words and the things tonight's marks are like; only chapters outside the last two,
     so nothing comes twice; at most three, under their own heading as for reference, never lines to
     tell. All of it is counted the way a model counts it (about 3.5 characters a token, within 900).
     No model writes the recaps: they are what was kept, shortened.
   - **A question, on the TV.** `ask` puts one short question on the screen, at most two a night,
     with the marks it means lit up. They answer with the remote or on the phone, or skip. It can
     show an earlier night's mark beside tonight's: "Is this the night ferry again?" It never asks
     what the dream meant or how they felt.
   - **Their reactions, as it is told.** `tell` plays the telling line by line, each lit on its
     strokes and spoken, slower and softer where it felt heavier, quicker where stirred, with a
     pause before the turn (Polly SSML). It hears back what they said of each line: ▲ that's it, ▼
     not quite. Where the storyteller gave a line another way to say it, and that way holds to what
     is theirs too (checked before the telling starts, `heldAgainst`), ▼ hears it at once in the
     line's place, its voice already made, and what they say of it is what they said of the line;
     ▼ again is not quite. It may tell the lines that were not quite once more ("The Low Shore, once
     more"), and the new lines take their place.
   - **Held to their evidence.** Before anything is told, the harness checks the telling
     (`engine/dreams/ground.mjs`). Each line must come from something of theirs: their words as
     they painted, their answers, a thing of their dreams by its name, or how they painted its
     strokes (the wait, the pressure, the pool, the ink they chose), carried into what happens:
     a hard press something heavy, a mark painted again something that came back. A long wait is
     mostly left unsaid (and a wait spent talking on the phone is not a wait); never "you waited",
     never time passing ("for a long while"), and never an empty stretch before each new thing. It
     sees how it told their last chapters (THE LAST CHAPTERS): new words tonight, a different
     opening, and a thing's long name said once, then "the lake", "she". At most one line
     in three may be the storyteller's own. It is told to them, as "you": their words come with how
     the story says them (`as_you`: their "I found my boat" is "you found your boat"); a line told as
     "I" or "we" outside quotation marks is sent back, and past its send-back is said to them as
     "you" in code (`toSecondPerson`), as are the facts and notes it keeps and the Worldbuilder's
     answers. A telling that explains the dream (what it meant, stood
     for or says about them; not the words a dream is told in: in a dream you realize and know
     things, and things happen because of other things), tells the painting instead of the dream
     in more than one line (the paper, the brush, the ink, strokes, seconds, "you pressed", unless
     those are things of their dream in their own words), leaves out every word they said, leaves
     out what they answered, brings back something they turned down, or tells it as "I" is sent
     back once, with why, and never reaches the screen. A line that names a feeling or reaches for a moon they never
     painted is pointed out to the storyteller.
   - **What is never heard, whatever the model writes** (`engine/dreams/gentle.mjs`). A prompt can
     ask; only code can promise. For a child, a telling is checked line by line: something scary
     they never brought (teeth, a chase, a stranger, being alone: 55 word families, allowed when
     their words or answers brought them), what they marked darker made bigger or closer, or a
     figure of speech they might take literally. For what they painted next, the storyteller carries
     the story on from where it stopped: it tells only what happens next, and the TV keeps it after
     the story so far (less any line they said was not quite) as one story; a line of the story so
     far told again is told already, and not told twice. What happens next must be told, come last,
     and not slide back to the story as it was. A telling that
     fails is sent back once, with why, while the screen says what the storyteller is doing
     ("Finding gentler words"); told that way again, it is told without those lines, and a telling
     that never tells what they painted next ends in their own words for it. The storyteller hears
     what was left out and why. Long lines and hard words are pointed out to it.
   - **Their taste chooses.** Where the storyteller is unsure, it gives a line an alternative. The
     harness chooses which one they hear by their taste (`engine/dreams/taste.mjs`): a Bayesian
     model of which kinds of line this person keeps (their own words, their things by name, an
     earlier night brought back, how they painted carried into what happens; or explaining, a named feeling, a stock
     image, long lines), learned from every line they have ever answered ▲ or ▼, starting from a
     weak guess at what most people keep. What it has learned is told to the storyteller each night
     (WHAT THEY KEEP: "They keep lines in their own words (kept 7 of 8).").
   - **Its own memory.** `remember` writes the night into their dream world: the things in it, new
     or from before, the strokes each one was, why it felt as it did to them, what happened, what
     is still open or now resolved, and notes on how they like their dreams told. As they confirmed
     it: what they turned down is never kept, whatever the storyteller sends, and what they named always
     is. A thing given by its name is the thing already in their world, not a second one; and a
     remember that can't place a thing, or leaves out something they said came again, is sent back
     once, then kept with it.
   - **What it remembered.** Each chapter keeps what the storyteller was given of earlier ones and
     what it looked up (the chapters as told, the recaps and why each was given, what it searched for,
     the things and chapters it read), and the chapter's page in the book says it: "What the
     storyteller remembered: chapters 6 and 7 as they were told; a recap of chapters 1 to 4, for the
     lighthouse; it looked for "the lighthouse lamp"; it read about the lighthouse." Forget a thing,
     and it goes from these too.
   - **Bounded.** At most 14 turns, two questions and two tellings. Every call gets an answer, an
     error the storyteller can work with if it fails or goes past a limit. It's reminded once to tell and
     once to remember, and asked to call its tools together so they wait less.
   - **The service keeps nothing.** `/agent` fixes the prompt, the tools, the model and the effort,
     and checks what the TV sends (turns, blocks, sizes, only these tools). It caches the prompt
     and the conversation as it grows, so each turn pays full price only for what is new. Claude's
     own turns go back to it exactly as they came, thinking included: Opus 5.5 checks that nothing
     before its thinking has changed.
4. **Their dream world, kept on the TV** (`src/world.js` and `src/paintings.js`, on the engine's
   `dreams/`).
   - **What's in it:** the people, places, things, creatures and presences of their dreams, by
     their names, with the marks they came as; how each felt to them every night it came (both
     dimensions, and why); what happened, as facts in story time, and what is still unresolved
     until a later night resolves it; their tellings and how each line landed; what they were asked
     and answered; the storyteller's notes.
   - **The paintings:** each night's picture and strokes, in IndexedDB, for the storyteller to look back
     at.
   - **A long memory, and nothing lost.** A world holds its last 120 nights; every thing, feeling
     and fact from all of them stays in it. Every night is also kept in IndexedDB, beside its
     painting, as it is kept, and `recall`, `thing` and `night` read the older nights there: in a
     simulated two years of nightly painting, night 1's story could still be read on night 730.
     The storyteller's brief carries at most eight unresolved threads (those about what is in
     tonight's painting first, then the latest) and says how many more `recall` finds: 36 open
     threads after two simulated years used to go in whole.
   - **Room.** localStorage, where each world is kept to be read back at once, holds about five
     million characters for the whole TV (Chromium's limit, measured), every painter's world
     together. As it nears full, a world holds only its last 30 nights (the rest are in IndexedDB
     already); a world that still doesn't fit is kept in IndexedDB instead, and read from there,
     until there is room again. Each copy carries when it was kept, so the later one is always read.
     The seals tell the grown-ups as it fills, and if neither store will take a world, the TV says
     so at once and tries again every minute while it is open: a night is never lost silently. The TV also asks
     the browser to keep what it keeps rather than clear it when the TV is short of space.
   - **Recognised:** marks shaped and placed like ones a thing came as before are offered to the
     storyteller as hints, and `recall` finds things by name the way the engine resolves names.
   - **Kept by their reactions:** a thing they turn down isn't kept, and the storyteller is told never to
     offer it again. What they named is always kept. After the telling: "Kept in your dream world:
     the night ferry (a second night)."
   - **Welcome back:** "Welcome back. This is night 3 of your dreams. The night ferry has come to
     you twice, heavier the last time."
5. **Without the story server,** the TV asks its own two questions where their feeling changed
   most: "Here it changed. What was it?" (their words first, then what it could be from their
   dream world, then readings by the mark's shape) and "Why did it feel that way?". Then it tells
   their line plainly ("It began here, quietly. Here it changed: the night ferry. And it ended
   lighter."), and what they named is still kept in their world.

**Why an agent, not a pipeline.** The first storyteller was a pipeline (`/tell` and `/readings` in
`server/guide.mjs`). Code cut the dream into parts where their feeling changed, asked two fixed
questions at the turn and compiled a brief, and smaller models checked the telling three ways: a
reader for the feeling, their key words, an archivist for their world. Each of those was a
judgement made by rules or a smaller model, standing in for one Opus can make itself. What Opus
can't do from a chat window is see how the painting was made, ask the person at the TV, hear how
each line lands, or remember their dreams from night to night. So the harness now gives it exactly
that, and leaves the judgements to it. The pipeline stays as the fallback, with the commons (how
many tellings use each image, counted in DynamoDB, never text or people). It is also what the two
evals below were written to test.

**What a chat app, or a competitor starting today, doesn't have.** Anyone can get a good dream
story from Claude or ChatGPT, and anyone can copy this idea. What can't be copied is what each
person builds up here, night by night: the picture of how they paint, their taste learned from
every line they answered, and their dream world with its paintings. All three start empty
anywhere else. The harness that uses them runs on the TV, without a model call. It checks every
telling against their evidence and chooses between lines by their taste, so the storyteller is held
to the person whatever model it runs on.

**The taste model, tested without a model** (`engine/dreams/sim.mjs`, `node
engine/dreams/sim.mjs`): 400 simulated dreamers, each with a hidden taste (most people's,
moved on every trait and turned hard on a couple), over 10 nights of five lines, each with an
alternative. Choosing between the two by what each dreamer's answers taught:

| By night 10 | Chose the line they'd rather keep | Lines kept |
| --- | --- | --- |
| At random | 52% | 61% |
| The same guess for everyone | 62% | 65% |
| Learned from their answers | 78% | 71% |
| Knowing their hidden taste | 100% | 75% |

It is a simulation of the learning only: the lines are just their traits, and the dreamers'
tastes are made up. It says nothing about how well the storyteller writes; that needs the real model.

**The feeling model, tested without a model** (`node engine/dreams/sim.mjs feelings 400
8 0.4`): 400 simulated painters, each with a hidden hand (how their strokes move with how they
feel: most people's, varied, and for some turned around), over 8 nights. Each night is a dream
with a turn in it. Every night the model reads the painting blind, is scored against the marks,
then learns from them. Error by night 8, where 1 is the whole range of the dial:

| Read by | Heavier/lighter, brush only | With words on 40% of strokes | Found the turn, brush only |
| --- | --- | --- | --- |
| Saying nothing (a flat line) | 0.46 | 0.47 | 4% |
| The starting guess, never learning | 0.40 | 0.36 | 34% |
| Learned from their marks | 0.36 | 0.33 | 41% |
| Knowing their hidden hand | 0.35 | 0.31 | 40% |

By night 8 it has learned nearly all a brush can say in this simulation. How much a real
person's brush says about their feelings is unknown until real people paint. Their world keeps
the blind score of every marked night, so a few nights of real painting will show it. On calm
against stirred, learning gains little over the starting guess.

**Where their worlds go:**
- **Their world stays on the TV** (browser storage, in the app), and so do the paintings of
  earlier nights and what has been learned of their hand and their taste (numbers only: no words). Each turn of the storyteller sends the conversation so far: tonight's painting,
  strokes, line and words, and whatever of their world the storyteller has looked up. The story server
  keeps none of it.
- **Their words by phone:** the story server holds them only until the TV picks them up (a second
  or two), then deletes them; a pairing ends when the TV is done, or after 30 minutes. The phone's
  Talk button uses the browser's own speech-to-text, which may send audio to the browser maker's
  service: the page says so, and typing or the keyboard's microphone always works.

**Not yet measured:** whether following their line, or a telling made from their dream world,
beats a good prompt given the same things. Both plans were written before any telling, are
capped (about $14 and $18), and run only with approval. They test the pipeline, not the agent.
The eval sets are kept out of this repository so that they stay unseen.

## Run it

```sh
cd tv
npm install         # esbuild, for the bundle
npm start           # http://localhost:5180
npm test            # 86 unit tests: the remote, the brush, "Feel it again", the world, the phone, the storyteller, the family, the new look, a long memory, stepping inside, the night, all around it
npm run e2e         # 33 browser steps at 1920 x 1080; screenshots in test-shots/
npm run bundle      # the page as one file: dist/inkwash-tv.html
npm run e2e:bundle  # the 31 steps on that file, opened from file://
node scripts/motion-sheet.mjs   # how things move, frame by frame: contact sheets of a thing coming to
                                # life, a hop and a card's reveal, with an onion skin and the curves

cd server
npm install
npm test            # 80 tests, with stand-ins for Claude, Nova Canvas, Nova Reel, World Labs, Polly and DynamoDB
npm run stand-in    # a scripted storyteller on http://localhost:5188 that calls the tools like the real one
npm run dev         # the real storyteller, with your AWS credentials
npm run cli         # the real storyteller through Claude Code (claude -p), on the Claude subscription
                    # it is signed in with: no AWS, so no voice and no pictures made real

cd ../../engine
node --test dreams/test.mjs   # 42 tests: dream worlds (kept and read back, even cut short), earlier chapters, told as "you", how they painted, their taste, the check, a child held kind, feelings, what happens next, last time's story, a long memory, the Worldbuilder, the Illustrator
node dreams/sim.mjs           # the taste model on 400 simulated dreamers, no model calls
node dreams/sim.mjs feelings 400 8 0.4   # the feeling model on 400 simulated painters
```

Open the page with `?guide=http://localhost:5188` to use a local storyteller. To pair a real phone with
it, open the TV page by this computer's address on your network rather than `localhost`, so the QR
points somewhere the phone can reach.

On a computer, the keyboard stands in for the remote:

| Remote | Keyboard |
| --- | --- |
| Arrows | Arrow keys |
| OK | Enter |
| Back | Esc |
| Play/pause | P |
| Rewind, fast-forward | `,` and `.` |

The browser test uses the Playwright that's installed globally (`npm root -g`) and its Chromium.

## Deploying the story server

You need an AWS account and the AWS SAM CLI.

1. Pick the region: **us-east-1 (N. Virginia)** has Claude and Amazon Nova Canvas both. Bedrock's
   models are on for every account there (AWS retired its "Model access" page in October 2025);
   the one step left is Anthropic's one-time use-case form, filled in once in the Bedrock console
   (open the chat playground, choose a Claude model, and it asks). Nova Canvas isn't offered in
   every region: deploying elsewhere, set `RealRegion` to one where it is, or `RealPictures=off`
   to keep the ink.
2. Deploy:

   ```sh
   cd tv/server
   npm install --omit=dev
   sam deploy --guided --stack-name inkwash-guide --capabilities CAPABILITY_IAM
   ```

   It asks for a `GuideKey` (at least 16 characters: make it long and random), an `AlertEmail`,
   and how much it may spend (`SpendPerDay`, `MonthlyBudget`). `sam deploy --guided` saves your
   answers in `server/samconfig.toml`, which git ignores: it can hold the key.

   The template is `server/template.yaml`: one Lambda function behind a function URL, and one
   DynamoDB table (the commons, pairings with a phone, and the day's pictures and spending, with
   time to live on `expires`). It may call `bedrock-mantle:CreateInference`, `bedrock:InvokeModel`
   on the image model alone, `polly:SynthesizeSpeech`, and read and write that table. Each call may take up to 120 seconds, since one turn of the storyteller can think for a
   minute; the `Effort` parameter sets how hard it thinks. Its log is kept 14 days.
   **It comes alive** (Amazon Nova Reel, about 50 cents a clip, at most `AliveClipsPerDay`, 6 by
   default) is made only by a stack in us-east-1, where Nova Reel is: Reel writes each clip to a
   private bucket the template makes (`Clips`, each clip deleted a day after it is made), the guide
   may `bedrock:StartAsyncInvoke` and `bedrock:GetAsyncInvoke` and read and write that bucket, and
   the TV fetches its clip by a link good for ten minutes. `AliveClips=off`, or any other region,
   and the picture stays still. Reel's clips are MP4s, and a TV whose WebView can't play one is
   never offered *Watch it come alive*, so no clip is paid for that would never play. Clips are counted in `SpendPerDay` too, and the budget's action
   stops them with the rest. Where Reel puts the clip under the job's folder is found by listing
   it, so it is found whatever the file is called; this has not yet been run against Bedrock.
   **Walk inside** needs a World Labs API key (`WorldLabsKey`, from platform.worldlabs.ai; left
   empty, there are no worlds and the rest works as before), and builds at most `WorldsPerDay`
   worlds a day (10 by default), each counted in `SpendPerDay` at 20 cents. A world is built on
   that key's account, private to it, and stays there until you delete it. With `WorldsAhead=on`,
   a TV starts building the world as soon as *Walk inside* is offered, so it is nearer ready when
   chosen; a world never walked into is paid for all the same, so it is off unless you turn it on.
3. **Confirm the email** AWS sends `AlertEmail`, or no alert reaches you.
4. Build the TV app with the URL it prints and the same key:
   `INKWASH_GUIDE_URL=https://… INKWASH_GUIDE_KEY=… npm run vega:assets`.
5. **Opt out of AWS keeping what Polly reads**, if you can: AWS may keep the text Amazon Polly
   speaks to improve Polly unless the account opts out, with an AI services opt-out policy in AWS
   Organizations (a free organization of one account will do). Then deploy again with
   `AIOptOut=yes`, and the privacy page says so. Amazon Bedrock keeps nothing either way.
6. **The privacy page** is at `<guide URL>privacy` (the deploy prints it as `PrivacyUrl`): what the
   TV keeps, what it sends, what the server keeps and for how long, and short terms. Set `Contact`
   to where people can write; it is shown there, so it is public. It is what an app listing asks for.

**What it may spend.** Anyone with the URL can call it, and the key ships inside the app, so it
keeps out casual callers only. What protects the bill:
- **The day's spending** (`SpendPerDay`, $10 by default; `server/limits.mjs`). Every call to Claude,
  every line Polly reads and every picture is priced as it is used, from the usage Bedrock returns,
  at list prices plus 10% (a model with no price there counts as the dearest), and added up in the
  DynamoDB table. Once a day (UTC) reaches it, the guide asks Bedrock and Polly for nothing more
  until midnight: it answers `429`, the TV tells offline, and you get an email. A call already under
  way finishes, so a day can end a little over.
- **Never paid twice** (`server/once.mjs`). A picture, a thing's picture, a place, a clip, a world
  or a place's scene asked for again (a TV on a slow connection asks again) is known by what was
  asked, hashed: asked again while the first is still being made, it waits for that one; asked again
  within ten minutes, it is answered with the same, at no cost and not counted again. Only what was
  made is kept, at most 16, in memory on the running server, never written anywhere.
- **Each caller** may make 150 paid calls in ten minutes (`GUIDE_CALLS_PER_CALLER`), and 2,000 calls
  in all (a paired TV and phone each listen every two seconds), counted by address in memory and
  never stored. That keeps one caller from spending the day alone or trying pairing codes.
- **The month's bill:** an AWS Budget (`MonthlyBudget`, $50 by default, for the whole account, after
  any credits) emails you at half, at 80% and when the month is forecast to go over. At all of it,
  its action attaches a policy to the guide's role that denies Bedrock and Polly; reverse the action
  in the Budgets console to go on. Billing data runs hours behind, which is why the guide counts for
  itself too. The action can't be tried without reaching the budget, so treat the day's spending as
  the guard and the budget as the backstop.
- **Alerts** go to `AlertEmail` when the guide answers with errors five times in five minutes, when
  its function fails or is throttled, and when it reaches the day's spending.
- **Errors:** the TV only ever hears that something went wrong (`502`); what went wrong goes to the
  log. Lambda logs only errors, and when the storyteller or the telling falls back to Haiku (with
  Claude's reason, if it refused the conversation). It never logs the painting.
- The phone's page (`GET /phone`) and its two calls (`/words`, `/asked`) need the pairing code
  instead of the key: the phone never has the key.

**If it goes wrong.** The TV never depends on the server: with it stopped or broken, the TV tells
its stories itself. So:
- **Stop it now:** in the Lambda console, *Throttle* the function (or
  `aws lambda put-function-concurrency --function-name <name> --reserved-concurrent-executions 0`).
  Every call is turned away and the TV tells offline. Undo with *Edit concurrency* → unreserved (or
  `aws lambda delete-function-concurrency --function-name <name>`).
- **Go back to the last version that worked:** `git checkout <commit> -- tv/server`, then
  `npm install --omit=dev && sam deploy` (it reuses `samconfig.toml`). The URL stays the same, so the
  TV app needn't change. A deploy that fails rolls itself back.
- **Pictures misbehaving:** deploy with `RealPictures=off`; the TV keeps the ink.
- **The key got out and someone is spending:** the day's spending already stops them each day. Deploy
  with a new `GuideKey`, then rebuild and reinstall the app with it; old builds stop working.
- **Keep the last `.vpkg`** that worked, to put back on the TV.
- **Take it all down:** `sam delete --stack-name inkwash-guide`.

**Cost:**
- **The storyteller, per night:** measured over the 66 nights of Babel, Kitezh and Sky Whales told
  through Claude Code: about 6 turns of Opus 5.5, about 117,000 tokens of prompt (half written to
  the cache, half read from it) and 4,000 out. At Opus 5.5's published price ($4 per million input
  tokens, $20 per million output, $5 per million written to the cache, $0.20 per million read from
  it), that's about 37 cents a night on average, from about 28 cents on a world's first night to
  45 cents by its twenty-second, as the world grows. Haiku 5.5 as the storyteller (`TellModel`)
  would be about a cent, untried. `Effort=low` thinks less. A sent-back telling costs one more turn.
- **The wait:** each turn is seconds to tens of seconds, and the screen says what the storyteller is
  doing. It's asked to call its tools together so there are fewer turns, and its first turn is taken
  while they mark how it felt (a head start), so one turn less is waited for. The head start costs
  a turn even when they go back to the paper to paint on instead: about one part in six of a night,
  each time. How long people actually
  wait is not measured yet.
- **Dream it real, per painting:** one picture from Nova Canvas, standard quality at 1280 × 800:
  from 4 to 6 cents at its listed prices, depending on which of its sizes that counts as (check
  your region's), and a call to Haiku for the Illustrator, under a cent. One a night, never for a
  line told again. `RealPicturesPerDay` (60 by default) is the most it makes in a day, for every
  TV the guide serves together, counted in the DynamoDB table; past it, or with
  `RealPictures=off`, the TV keeps the ink.
- **Walk inside, when they choose it:** one quick World Labs world, 12 to 20 cents (the Dream
  Canvas's one live world cost 230 credits), counted in `SpendPerDay` at 20 cents; walking it
  again costs nothing.
- **See all around it, when they choose it:** one Nova Canvas picture at 2560 × 800, counted with
  `RealPicturesPerDay` and in `SpendPerDay` at its dearer size (8.8 cents); seeing it again costs
  nothing. **Paint it again** is one more picture made real each time, counted the same way.
- **Where a world stands, once per world:** a call to Haiku for the Set Designer, under a cent
  (one more each time they change how it looks), and one picture of the place (1536 × 864,
  counted with `RealPicturesPerDay`), 4 to 8 cents.
- **Each thing made real, once:** two pictures per thing, painted and then cut out of its white
  by Nova Canvas (at most 640 × 640, standard quality, both counted with `RealPicturesPerDay`, of
  which things take three quarters at most, so a painting made real and its place always have
  some left), 8 to 16 cents if a background removal is priced as a picture (check your region's
  prices); with `ThingCutout=tv`, one, and the TV cuts it out. Twelve things at most a visit to
  their world; made again only when its look, their words for it or their world's look changes,
  and one turned down or that can't be cut out is not asked for again until then. A first chapter
  with three new things is about eight pictures in all (the painting, the place, the things), 30
  to 65 cents.
- **Besides:** short calls to Haiku for the remarks as you paint, and the Worldbuilder's question
  when they ask *What's out there?*
- **DynamoDB:** a few writes per telling, and a few per thing said on the phone.
- **Polly:** charges per character it reads.

Check the Amazon Bedrock, DynamoDB and Polly pricing pages for your region's rates.

**Set `CommonsSalt`** to a long random value when you deploy, and keep it. It's what makes the
commons' hashes unreadable.

## Building the Vega app

This needs the Vega SDK (`vega` on the path) and Node 20 or later:

```sh
cd tv
npm run vega:assets     # bundle, then copy it to vega/assets/index.html
cd vega
npm install
npm run build:release   # build/<arch>-release/inkwashtv_<arch>.vpkg
```

- **Packages:** it builds `x86_64` for the Vega Virtual Device, and `aarch64` and `armv7` for
  Fire TV sticks.
- **Install and start:** run
  `vega run-app build/x86_64-release/inkwashtv_x86_64.vpkg com.yatsuiii.inkwashtv.main -d <device>`.
  `vega device list` gives the device's serial.

## Files

| File | What it is |
| --- | --- |
| `src/remote.js` | The remote as the page sees it: Vega WebView's key names and codes, and holds whether they arrive as one keydown and a keyup or as repeats. Pure |
| `src/brush.js` | The brush: pressure, bristles, ink flow, dryness, pools, the stroke's landing and lift-off, ink choice, washing out; and the strokes summed up for the storyteller. Pure |
| `src/inkgl.js` | Ink on rice paper in WebGL2: the paper, the crisp and wet layers, undo, the snapshot the storyteller sees |
| `src/ink.js` | The same, plainer, in 2D, for a screen without WebGL2 |
| `src/guide.js` | When the storyteller speaks, and what it says without the service (its painting tips in plain words for a child, who hears them read aloud); the telling |
| `src/ai.js` | The story server, as the TV calls it |
| `src/sound.js` | The brush on paper, a drip, a swish, the seal: synthesized, no sound files |
| `src/main.js` | The page: the loop, the drawn brush, the panels, "how did it feel?", the storyteller's questions and telling, their world as home and the Worldbuilder's question, a painting made real |
| `src/feel.js` | "Feel it again": when each stroke comes back, the dial in two dimensions (▲▼ lighter or heavier, ◀▶ calmer or more stirred), the feeling at each stroke. Pure |
| `src/agent.js` | The storyteller's loop, on the TV: each turn to Claude through the service, each tool it calls carried out, within bounds. Pure |
| `src/harness.js` | The storyteller's tools: the painting numbered, closer, part way through, or an earlier night's; how strokes were painted; their dream world; asking and telling on the TV; remembering. And its first turn. Pure, apart from what it's given |
| `src/paintings.js` | What the TV keeps in IndexedDB: each night's painting and strokes, for the storyteller to look back at; every night of each world, kept as it is kept, read once the world lets it go; a world too big for localStorage |
| `src/cutout.js` | Strokes cut out of a painting as their own picture, exactly (the painting is the paper times the ink); how each part moves by its shape. The cutting draws on canvases; the rest is pure |
| `src/life.js` | The telling, alive: the part of the painting a line is about lifts off and moves, then settles back |
| `src/camera.js` | Where the sheet goes while a story is told: in on each line's part of the painting, above the panel. Pure |
| `src/sky.js` | The night around the paper, drawn once, which feels what they mark on the dial |
| `src/night.js` | A painting woken in its world's place (their ink, with its shadow) or at night (their ink turned to light over still water: which light each ink gives); their world (where each thing stands, the nearer bigger, the sky's things risen, nothing hiding another, each doubled in the water), and walked through, drawn on the GPU. The layout is pure |
| `src/walk.js` | Walking through their world: where each thing stands in it (just where the home view shows it), what the eye sees, a step of the walk, where to stand before a thing (eye to eye on the water, looking up to what is in the sky), and what was told of each thing, night by night. Pure |
| `src/stage.js` | The world's stage: its size, the horizon, and the eye above the water. Pure |
| `src/glow.js` | The night on the GPU (WebGL2): ink turned to light in a shader, through a thing's shape, its glow blurred small, all of it added into one texture; a view's quads in one canvas, each corner where the eye sees it, drawn smaller if the TV can't keep up; a painting at night as a picture |
| `src/inside.js` | Stepping inside a painting: the paper tips back into the still water of a night, each thing they painted standing up from it in its own light, with its reflection, drawn on the GPU in one canvas; turning it round, coming nearer, going to each thing. The layout and the walk are pure |
| `src/cards.js` | Their world as cards (each thing, its picture's strokes, the nights it came, how it felt, what is true of it) and as a map (where each first came, pushed apart, joined to what came with it). Pure |
| `src/quality.js` | Keeps the ink smooth on a slow TV: while the ink is wet, frames that run long for a moment ask the paper for fewer wet steps a second, judged against how quick a dry frame is on this TV, and quick frames give them back |
| `docs/architecture.html`, `.png` | How it fits together, for the submission |
| `src/demo-family.js`, `scripts/demo.mjs`, `scripts/ledger.mjs` | The demo family, and the script that paints its earlier nights in the page, each drawing steered with the remote along the shape it is of, and writes down what the TV kept; with `--real`, each night made real (the Illustrator on Claude Code, Nova Canvas on your AWS account), behind a ledger that refuses any picture past a cap |
| `scripts/gallery.mjs`, `docs/gallery/` | The Devpost gallery: the TV page driven through the demo family with the real storyteller and Set Designer (through Claude Code), each screen kept as it is with its caption under it, 3:2, and the thumbnail |
| `scripts/listing.mjs`, `docs/listing/` | The Appstore listing's pictures in the app's own look: the 512 x 512 icon a Live App Test asks for, the small icon, and Fire TV's app icon and background |
| `src/intro.js` | The opening, on a TV that has never had Inkwash open: the demo child's first drawing drawn as light, stroke by stroke, told back a line at a time, and woken up as their world, chapter after chapter, in about twenty seconds. Any button skips it |
| `scripts/painted-nights.mjs` | The TV driven through nights painted by a script, for the three below: the real page, brush, harness and story server code, pressed as a remote presses it, with a phone in a second tab, a storyteller and a Worldbuilder that are scripts (no model is called), and what the TV did with each telling |
| `scripts/kids-dreams.mjs` | Ten children's dreams (a giant talking dog, a monster in the school hall, raining candy, falling, getting lost at the shop…), painted by one child, a night each: how the app takes them, the TV's checks on a child's telling, what their world keeps, walked through. Screenshots and what happened in `test-shots/kids/` |
| `scripts/worlds.mjs` | Twenty-four worlds from ideas found online (Calvino's cities, drowned and hidden cities from legend, worlds from myth and books, two children's invented countries, worldbuilders' prompts), three nights each, made on the TV the way a person makes one: painted with the remote, a few words on the phone, marked, the questions answered. The real storyteller and Worldbuilder tell, name and keep everything (through Claude Code on a subscription). Three of them (Babel, Kitezh, Sky Whales) go on for 22 nights: `KEEP=1` keeps each TV on disk and saves after every night, `FROM=n` opens it again another day |
| `scripts/grown-dreams.mjs` | Three grown-ups share one TV for twelve nights: a night dreamer (rooms found behind a bookcase, late for an exam, a grandmother alive again), a writer building a story world (a city on stilts, its lamplighter, a question from the Worldbuilder answered in paint) and a daydreamer (a cottage by the sea, a stage, a night train). Lines marked not quite and told again, what happens next, more of one thing, worlds kept apart, journals, last time's story on a later day. Screenshots and what happened in `test-shots/grown/` |
| `scripts/smoothness.mjs` | How smooth the TV is, screen by screen, with the CPU slowed to about a Fire TV Stick's: how busy the page's thread is and on what, the gaps between frames, long tasks, and the scripts that ran in frames over 50 ms, as a night is painted, felt, told and woken, their world walked through, last time's story heard and stepped inside. Results in `test-shots/smooth/` |
| `src/book.js` | A painter's world as a picture book: a title page with who and what keeps coming back, then a night to a spread, its painting beside its story as it was last told. Pure |
| `src/journal.js` | What goes in a painter's book: who and what keeps coming back, how it felt each night, what they painted next, and each story heard again. Pure |
| `src/aloud.js` | The screen read aloud for a child: each phrase fetched once from the storyteller's voice and kept, cut off when they move on; the browser's voice without the service |
| `src/visits.js` | Worlds that meet: a thing of one painter's world visiting another's, sent by its painter and sent home by either; read from its own world each time, so nothing is copied; nothing frightening to a child's world; where a visitor stands. Pure |
| `server/wide.mjs`, `src/wide.js` | All around it and painted again: Nova Canvas's outpainting request from the picture set in its wider sheet and the mask, checked to the sizes it takes; on the TV, the sheet's layout, the look a picture is painted again in, and looking across a panorama |
| `server/reel.mjs`, `server/standin-clip.webm` | It comes alive: Nova Reel's request from a picture made real and its scene, the job asked for and looked in on, a child's kept gentle; and a stand-in that hands back a few seconds of moving light |
| `src/family.js` | Who paints on this TV: each painter's seal, whether the storyteller is talking to a child, and where their world and paintings are kept |
| `src/world.js` | Their dream world, kept on the TV: loading and keeping it so no night is lost (localStorage, IndexedDB when short of room, a word for the grown-ups), tonight's slice, the welcome back, what a night kept |
| `src/phone.js` | Talking to the storyteller by phone, from the TV's side: pairing, the QR, collecting what they say, passing on the storyteller's questions |
| `src/vendor/qrcode.mjs` | qrcode-generator 2.0.4 (MIT), unchanged, so the QR is made on the TV |
| `src/engine/`, `server/engine/` | The Inkwash engine (its core, the personal layer, dream worlds), copied from `../engine` by `scripts/sync-personal.mjs` (a test fails if a copy drifts). The TV page runs it too |
| `server/commons-store.mjs` | The commons, in memory or in DynamoDB |
| `server/worldbuilder.mjs` | The Worldbuilder: its prompt, what the TV sends it, its answer held to their world and sent back once if not; and a stand-in |
| `server/illustrator.mjs` | The Illustrator: its prompt (it sees the painting), the scene held to their world, Nova Canvas's request over their ink, its filter; and stand-ins for both |
| `server/budget.mjs` | The day's pictures and clips, each counted in memory or in DynamoDB, so no more are made than were set |
| `index.html` | The 1920 × 1080 stage, with every word inside the TV's safe area |
| `fonts/` | Alegreya and Alegreya Sans, bundled: the page fetches nothing from outside itself |
| `dev/` | The ink lab, and the night lab (`dev/night.html`: the demo paintings at night, and a world) |
| `scripts/serve.mjs` | A small static server, for a browser and the tests |
| `scripts/bundle.mjs` | Packs the page and the fonts into one HTML file |
| `server/agent.mjs` | The storyteller as an agent: its prompt and tools, checking what the TV sends, the cached request to Claude, the voice |
| `server/agent-standin.mjs` | A script standing in for Claude as the storyteller, for the tests and the dev server: it calls every tool the way the storyteller would |
| `server/guide.mjs` | The story server's core: its routes, the remarks, and the pipeline the agent replaced (`/tell`, `/readings`), kept as the fallback |
| `server/phone.mjs` | Pairings with a phone (in memory, or in DynamoDB), and the page the phone opens |
| `server/lambda.mjs` | The storyteller on AWS Lambda: Claude and Nova Canvas on Amazon Bedrock, Amazon Polly; each caller's calls limited, the day's spending checked first, and nothing but "it went wrong" told to a caller when it does |
| `server/limits.mjs` | What the guide may spend in a day (every call priced from its usage and counted, in memory or in DynamoDB) and how often one caller may call |
| `server/once.mjs` | The same paid request is never paid twice: one being made is waited for, one made is answered again for ten minutes |
| `server/privacy.mjs` | The privacy notice and terms, served at `/privacy` |
| `server/scenery.mjs` | The Set Designer: where a world stands, written from its story (`/scene`), and the place painted from it by Nova Canvas over the TV's drawing (`/backdrop`) |
| `src/scene.js` | A world's place drawn from its scene, going on round for the walk; and how their things stand in it (`materialOf`) |
| `server/dev.mjs` | The storyteller on this computer, real or a stand-in |
| `server/claude-cli.mjs` | The Messages API answered by Claude Code (`claude -p`) on the Claude subscription it is signed in with: the guide's own prompts, tools and checks, unchanged; for running the storyteller without AWS |
| `server/template.yaml` | The AWS SAM template: the function and its role, the table, its log (14 days), alarms by email, and a monthly AWS Budget whose action takes Bedrock and Polly away |
| `vega/` | The Vega app: React Native for Vega, around one WebView that fills the screen |
| `test/` | The unit tests and the browser test |

## On Vega OS

From Amazon's Vega docs, checked 2026-10-05:

- **Keys.** The WebView passes the remote to a web page as keyboard events:
  - `ArrowUp`/`Down`/`Left`/`Right`, `Enter`, `MediaPlayPause`, `MediaRewind` and
    `MediaFastForward`;
  - `GoBack` (key code 27), only if the WebView's `allowSystemKeyEvents` prop is set.

  The page answers to the names and to the key codes. It also calls `preventDefault` on them, so
  the WebView's own spatial navigation doesn't move focus.
- **Packaging.** The page is packaged inside the app and loaded as
  `file:///pkg/assets/index.html`.
  - There, Chromium refuses module scripts and font files. So `npm run bundle` packs everything
    into one HTML file of about 800 KB (with the demo family's paintings).
  - A page loaded from `file://` can still call the story server: it answers with CORS
    headers. The browser test checks this.
- **Network.** WebView 4.0.2 (React Native 0.83) loads HTTPS only, unless the manifest allows
  plain HTTP. The deployed storyteller is HTTPS, so the manifest needs nothing.
  - To try a local storyteller on a real device, add a `[network-traffic-policy.cleartext]` section
    for your computer's address.
- **Audio.** The storyteller's voice needs the `com.amazon.audio.stream` service, which is in
  `manifest.toml`.

**Not verified on a device:**
- the frame rate of the ink on a Fire TV Stick, and whether its WebView has WebGL2 with float
  render targets (without them, the page falls back to 2D). If frames run long while the ink is
  wet, the page takes fewer wet steps a second (two levels, down to 44%), so the brush stays
  smooth and the ink spreads a little less; `__inktv.quality` shows the level;
- how a held button actually arrives (both ways are handled and tested);
- whether the voice plays without a tap first (keys count as one in Chromium).

## Next

1. **Run it on a Fire TV Stick**, or on the Vega Virtual Device on a PC with KVM. Measure the
   frame rate, and tune the ink for the stick if it needs it.
2. **Hear the real storyteller.** Deploy the service, paint a few nights, and read the conversations:
   what it looks at, what it asks, whether the tellings are unmistakably theirs, and how long the
   wait is. About ten paintings, a few dollars, once approved.
3. **The evals, for the agent.** Add an arm where synthetic dreamers answer its questions and
   react to its lines, then run them, once approved.
4. **A shorter wait, measured.** The storyteller now takes its first turn while they mark the
   feeling (a head start). How many seconds that saves on a real night is not measured yet: time it
   on the TV with the real storyteller.
5. **The commons, for the agent:** tell it which images most tellings use, as the pipeline does.
   And everyone's taste, as a better starting guess: only each person's dozen numbers, never their
   words. The same for the feeling model's starting guess, once real people have marked enough.
6. **How they sound, not only what they say.** The phone could measure how they speak (pitch,
   loudness, pace) as well as their words: how stirred someone is shows in the voice more than in
   anything else. Measured on the phone, so audio never leaves it.
7. **The remote's own microphone, as well as the phone.** Vega apps can't record speech
   themselves, so this would go through a custom Alexa skill: "Alexa, tell Inkwash it was my
   grandmother's house." Its free-form slot (`AMAZON.SearchQuery`) works in English and Hindi in
   India.
8. **A painting that is told more than once** is one night in their world, kept the first time:
   later tellings of it aren't kept. Amending a night is next.
9. **See Dream it real for real.** Make the six demo nights real (about 40 cents), look at what
   Nova Canvas does with loose ink, and tune how closely it holds to the strokes
   (`REAL.strength`) and the words.
10. **Travel their world:** go to a thing in their world and hear the stories it came in.

## Fonts

Alegreya and Alegreya Sans are under the SIL Open Font License 1.1; see
`fonts/OFL-alegreya.txt` and `fonts/OFL-alegreyasans.txt`.
