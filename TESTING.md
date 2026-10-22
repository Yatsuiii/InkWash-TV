# Trying Inkwash

**On a Fire TV with Vega OS, from a computer** (an Amazon Developer account and the Vega SDK; the
package, `inkwashtv_aarch64.vpkg`, is attached to our Devpost submission, or build it from
[`tv/vega`](tv/vega) as [`tv/README.md`](tv/README.md) says under *Building the Vega app*):

1. On the TV: **Settings › My Fire TV › About**, select the device's name (e.g. *Fire TV Stick 4K
   Select*) and press the centre button seven times. Back, then **Developer options › Developer
   Mode › Continue**: the TV shows a 6-digit code (it lasts 5 minutes).
2. On the computer: `vega devmode login` (a browser opens; choose **Allow**), then
   `vega devmode enable-device --code <the code>`. The TV restarts in developer mode.
3. Connect over your network (the simplest way with a stick): on the TV, **Developer options ›
   Connection Mode › TCP/IP › Use standard port 5555** (it restarts again); its address is under
   **About › Network**. Then `vega exec vda connect <its address>:5555`, and `vega device list`
   shows it.
4. `vega device install-app --packagePath inkwashtv_aarch64.vpkg`, then
   `vega device launch-app --appName com.yatsuiii.inkwashtv.main`.

A package built without a story server's address (as the one attached may be) still runs: the TV
tells each drawing in plain words of its own and makes no pictures, and the demo family is all
there. Built with one, it uses the real storyteller.

The first time it opens, Inkwash shows what it is in about twenty seconds (any button skips it),
then the seals. Press ▶‖ there for the demo family, as in the video (Back leaves it); the TV's own
family starts empty. *What to try*, below, works the same on the TV, with the remote's own buttons.

**In a browser, without AWS** (about five minutes, Node 20 or later). From the repository's root,
in two terminals:

```sh
cd tv && npm install && npm start                  # the TV page, http://localhost:5180
cd tv/server && npm install && npm run stand-in    # a scripted storyteller, http://localhost:5188
```

Open `http://localhost:5180/?guide=http://localhost:5188&demo`. The keyboard stands in for the
remote: arrows; Enter for OK; Esc for Back; P for play/pause; `,` and `.` for « and ». The
stand-in storyteller is a script, not Claude: it shows the harness at work (looking, asking, the
check against what's theirs, telling, remembering) at no cost. So is the stand-in Worldbuilder.
The stand-in Set Designer always writes the same bright meadow, and the stand-in makes no
pictures, so each told drawing wakes up in that meadow as the TV draws it, as it does on any TV
without the image model; on the real server, the Set Designer writes each world's own place, and
Google's Gemini paints it and can make each drawing real. Without the server's voice, reading
aloud uses the browser's own voice, if it has one.

**What to try:**
1. **Star's book:** on the seals, move to Star and press `,` (« on the remote): *Star's book*
   opens on its title page, with the moon castle, the rocket and the dragon friend (first
   drawn in what happened next), each with how it felt, in a child's words. ▶ turns the page to
   each chapter: its drawing, as light on a night page, and its story as it was last told. Back
   returns to the seals.
2. **Previously in Star's world:** choose Star. Star's world opens, and once its place is written
   (the stand-in's meadow) it asks how it should look. The question begins on *Keep it as it is*,
   so a press meant for something else can't change it: move to a look and choose it (the stand-in
   writes it in that look), or Back to keep it. Its first choice is then *Hear last time's story*. Press Enter: *Flying with the Dragon* is told line by line over chapter 3's
   drawing and read aloud, with no model called. It isn't offered twice in an evening; Star's
   book says on chapter 3's page that it was heard again (*Read your book*, last in Star's world).
3. **A child's night:** in Star's world choose *Draw something new*, draw a line and hold ▼
   until it glows. Press P, and hold ▲
   and ▶ as it comes back. The storyteller's question and each choice are read aloud as you move, and the marks it
   asks about stay lit while the rest of the drawing dims; press OK on one. The stand-in's first telling brings in a monster, as a model might: the TV
   sends it back ("Finding gentler words"), and the telling heard is kind. Press ▲
   or ▼ on each line as it's told. As the last line ends, the drawing wakes up in Star's world: in the
   stand-in's sunlit meadow its lines stand there as ink, with their shadows (in a place at dusk or
   night they stand as light). When it asks what happens next, draw it, press P, hold ▲, and hear
   it told again.
   Back in Star's world, the thing it kept stands in it.
4. **Their world:** Star's world opens in its place: each thing in it where Star first drew
   it, standing there, with its card; ◀ ▶ go through
   them. Choose *Walk through your world*: hold ◀ ▶ to turn and ▲ ▼ to walk; OK goes to each
   thing in turn (the moon is looked up to, in the sky); P hears the stories it came in, read
   aloud; Back walks home. *What's out
   there?* asks the stand-in Worldbuilder about one of them, with answers to choose from; choose
   one, and the card keeps it as true. And the coloured inks: `.` past clear water gives indigo, gold
   and cinnabar.
5. **The TV at rest:** leave the seals alone for 50 seconds (or open the page with `&idle=5`): the
   family's drawings, each in its world's place, one at a time. Any key wakes it. (Their world,
   left alone 30 seconds, lets its words fade; any press brings them back and does what it does.)
6. **Recognised from before:** choose Moon, and in Moon's world choose *Draw something new*.
   Moon's night ferry waited a little right of the middle, a little low. With the brush
   lifted, tap ▼ to move it down a little, then hold ▶ until it's a little right of the middle
   (the brush heads the way it last moved). Press OK, let it run a moment, hold ▼ until the line
   glows, and press OK. Press P, hold ▼ as the stroke comes back, and the storyteller asks whether
   it's the night ferry again, with chapter 3's drawing beside tonight's.
7. **Forget something:** in Star's world, go to a thing (◀ ▶), then *More…* and *Forget* it. The
   TV says what goes with it and that everything else stays; the choice starts on *Keep it*, so OK
   there keeps it. ▼ to *Forget it* and OK: it is gone from Star's world, its cards, its book and
   its drawings, and the rest of the world is as it was. Each card also says where its thing came
   from: *You named it*, *You kept it* or *The storyteller thought so*.
8. **Worlds that meet:** choose Moon; on the night ferry's card, *More…* and *Send the night ferry to
   Star's world*. Its card now says *Visiting Star's world*. Back to the seals and choose Star: the
   night ferry stands in Star's world too, lit from Moon's drawing, its card saying *Visiting from
   Moon's world*, with *Send the night ferry home* (Star can't change or forget it: it's Moon's).
   Draw something there, and Star's storyteller is told it is visiting and may bring it into the
   story; it stays Moon's, and isn't kept in Star's world. On the real server, the picture a
   chapter was made into can also be seen all around (*See all around it*) and be painted again
   in another look (*Paint it again*); the stand-in makes no pictures, so neither is offered there.
