# Friction log: building Inkwash for Fire TV (Vega OS) with AWS

What got in our way while building Inkwash, a Vega OS app where the remote is an ink brush, a
phone lends a microphone, a storyteller (Claude, built for Amazon Bedrock and now called through
Anthropic's API, entry 15) tells each drawing back as a story in Amazon Polly's voice, and an image
model makes a drawing real: Amazon Nova Canvas, until AWS retired it (entry 15), and now Google's
Gemini.
Each entry says what we were doing, what happened, how we got past it, and what would have
helped; entries 16 to 19, from the simulator run, also give a severity. Everything here we hit ourselves; where something is not yet verified on hardware or
against the real services, it says so.

## Vega OS and the Vega SDK

### 1. The Vega Virtual Device would not boot without hardware virtualization

- **Doing:** running the app on the Vega Virtual Device, from a cloud Linux machine (our build
  machine).
- **What happened:** the simulator needs KVM. The machine had no `/dev/kvm`, and in software
  emulation the simulator was far too slow to use. The SDK installed and built `.vpkg` packages
  for `x86_64`, `aarch64` and `armv7` without trouble. So we could build for a Fire TV but not see
  it run.
- **Got past it:** we tested the app's page in desktop Chromium at 1920 × 1080, driven by
  simulated remote key events, including the packaged single file opened from `file://` as the
  WebView loads it, then rented an Apple Silicon Mac for the simulator (entry 1a).
- **Would have helped:**
  - the KVM requirement stated before the install steps, not discovered after;
  - a lighter, software-only preview of the WebView runtime for headless CI;
  - or a hosted simulator.

### 1a. The simulator can't run a WebView app on Linux or an Intel Mac, and the SDK doesn't run on Windows

- **Doing:** planning the demo video, which must show the app on a Fire TV or the Fire TV/Vega
  simulator, from a Windows PC and a cloud Linux machine.
- **What happened:** the Vega SDK is for macOS and Ubuntu only (Windows isn't supported, and WSL
  isn't tested). And the Vega Virtual Device doesn't support WebView on Ubuntu or on Intel Macs:
  the troubleshooting page says to use an Apple Silicon Mac or a Fire TV Stick 4K Select, and lists
  the error a WebView app gets on Ubuntu (`Module dependency not found:
  /com.amazon.vega.webview_3@IWebview_3`). Inkwash's Vega app is a WebView around its page, so on
  our machines there was no simulator it could run in, even with KVM (entry 1). We found this two
  days before the deadline, on the troubleshooting page, not on the WebView or install pages.
- **Got past it:** we rented an Apple Silicon Mac (an M4) for a day and ran it in the Vega Virtual
  Device there; the demo video was recorded in it (entries 16 to 18).
- **Would have helped:**
  - the platforms that can run a WebView app named on the WebView quick-start and the install page,
    and in the hackathon's resources, since the Fire TV track invites web apps;
  - WebView in the simulator on Ubuntu;
  - or a hosted simulator.

### 2. A packaged web page can't load ES modules or web fonts from `file://`

- **Doing:** packaging our web app inside the Vega app, loaded as
  `file:///pkg/assets/index.html`.
- **What happened:** Chromium refuses module scripts and font files from `file://`, so the page
  loaded without its code or its fonts.
- **Got past it:** a bundling step (`npm run bundle`) packs the scripts, styles and fonts (as
  base64) into one HTML file (now about 800 KB, with the demo family's paintings). A browser test opens that file from `file://` on
  every run, so it can't regress.
- **Would have helped:**
  - a line in the WebView guide saying so;
  - or an app-local HTTPS origin for packaged assets, so a normal multi-file web build just works.

### 3. Back never reached the page until we found `allowSystemKeyEvents`

- **Doing:** making Back wash out the last stroke, the way an artist takes back a mark.
- **What happened:** the system consumed Back. `GoBack` (key code 27) reaches the page only when
  the WebView's `allowSystemKeyEvents` prop is set.
- **Got past it:** set the prop. The page also calls `preventDefault` on the keys it uses, so the
  WebView's own spatial navigation doesn't move focus while you paint.
- **Would have helped:** one table in the WebView docs: each remote button, the key name and key
  code a page sees, and the prop each one needs.

### 4. Media buttons arrive by name or only by key code

- **Doing:** using ⏯ to tell the dream, and ⏪/⏩ to change the ink.
- **What happened:** the media keys need `allowsDefaultMediaControl={false}`, or the WebView treats
  them as media controls. We couldn't tell from the docs whether they arrive as `MediaPlayPause` /
  `MediaRewind` / `MediaFastForward` by `key`, or only as key codes (179 and others).
- **Got past it:** the page answers to the names and to the codes. A test sends play/pause by key
  code alone.
- **Would have helped:** the same table as in entry 3.

### 5. Whether a held button repeats is not documented

- **Doing:** painting. Holding ▼ presses the brush harder, and a held arrow steers it, so we need
  to know how long a button is held.
- **What happened:** we couldn't find whether holding a remote button sends one keydown and a
  keyup, or a stream of repeated keydowns, or repeats with no keyup at all.
- **Got past it:** the remote handling treats all three as a hold, and lets go when the repeats
  stop. Each case has its own test. **Not yet verified on a device.**
- **Would have helped:** a sentence on key repeat and keyup behaviour for the Fire TV remote in
  the WebView.

### 6. The WebView loads HTTPS only, even from a developer's laptop

- **Doing:** pointing the TV app at a story server running on our own computer during
  development.
- **What happened:** WebView 4.0.2 (React Native 0.83) loads HTTPS only unless the manifest
  allows plain HTTP. That makes a local server on a laptop unreachable from a device.
- **Got past it:** the deployed story server is HTTPS, so production needs nothing. For local work on a
  device, a `[network-traffic-policy.cleartext]` section for the laptop's address.
- **Would have helped:** a developer-mode switch, or the manifest snippet in the WebView quick
  start.

### 7. The voice needs a manifest service that's easy to miss

- **Doing:** playing the storyteller's voice (Polly audio) from the page.
- **What happened:** audio from a WebView needs `com.amazon.audio.stream` (and
  `com.amazon.audio.control` for focus and volume) declared under `[wants]`.
- **Got past it:** declared both. **Whether the voice plays without a tap first is not yet
  verified on a device.**
- **Would have helped:** a checklist of the manifest services a web app needs for audio,
  keyboard and media.

## Amazon Bedrock (Claude) and AWS

### 8. Claude Opus 5.5 rejects a conversation if a proxy re-serializes it

- **Doing:** running the storyteller as an agent: the TV runs the tool loop, and a Lambda function
  passes each turn to Claude on Bedrock.
- **What happened:** our Lambda rebuilt each of Claude's earlier turns field by field before
  sending them back, as a validating proxy would. On Claude Opus 5.5, the API checks that the
  conversation before each thinking block is unchanged ("preserved thinking"). For accounts
  created on or after 31 August 2026 that check is on by default, and a changed turn is a 400. A
  new hackathon AWS account would have failed on its second turn.
- **Got past it:** the proxy now passes Claude's own turns back exactly as they came, removing
  only caching marks, and still checks the TV's turns block by block. A test sends a turn through
  the TV and back and compares it byte for byte.
- **Would have helped:** a Bedrock callout for anyone putting a proxy or gateway in front of
  Claude, and an error that names the changed block.

### 9. Opus 5.5 refuses forced tool use

- **Doing:** making sure the storyteller always ends by remembering the night.
- **What happened:** `tool_choice` of `any` or `tool` returns a 400 on Opus 5.5.
- **Got past it:** `auto`, plus a one-time reminder from the TV's loop if the storyteller stops without
  telling or without remembering.
- **Would have helped:** this listed alongside the model in the Bedrock model card, not only in
  migration notes.

### 10. One agent turn can outlast Lambda's default timeout

- **Doing:** one turn of the storyteller, with Opus thinking at medium effort.
- **What happened:** a long turn can run past a minute. Our first SAM template allowed 60 seconds,
  and the TV waited 90.
- **Got past it:**
  - the function now allows 120 seconds and the TV waits 125, so the service's own error arrives
    first;
  - an `Effort` parameter in the template trades thinking for speed;
  - the storyteller is asked to call its tools together, so there are fewer turns.
- **Would have helped:** guidance on timeouts for agent loops behind Lambda function URLs.

### 11. Model and voice availability differ by region

- **Doing:** deploying near our users, in Mumbai (`ap-south-1`).
- **What happened:** Claude is served there through the global endpoint. Opus needs model access
  enabled per account (Haiku 4.5 is open to every account). Polly's neural voices differ by region.
- **Got past it:** the template takes the model IDs and the voice as parameters (Ruth by default,
  Kajal for Indian English). If Opus isn't enabled yet, the storyteller goes on with Haiku 4.5.
- **Would have helped:** one page listing, per region, which Claude models and which Polly neural
  voices are available.

### 12. Nova Reel gives a clip back only through S3, and only later

- **Doing:** letting a picture made real come alive for six seconds, from a TV app that holds no AWS
  keys.
- **What happened:** Nova Reel is called with `StartAsyncInvoke`, and all that comes back is the
  job's ARN; the clip is written to an S3 bucket a minute or more later. So one button on a TV
  needed a bucket, permission for `bedrock:StartAsyncInvoke` and `GetAsyncInvoke` and for S3 put,
  get and list, a poll, and a link the TV can fetch from. Where the clip lands is the folder we gave
  plus a folder named by the job, as we read AWS's examples; our first version listed the folder we
  gave, which in a bucket every TV shares could have found someone else's clip. We caught it in
  review.
- **Got past it:** the story server starts the job and the TV looks in every five seconds; the
  server lists only under the job's own folder, hands the TV a link good for ten minutes, and the
  bucket lets each clip go after a day. A test pins where it looks.
- **Would have helped:** short clips returned inline, or the exact key of each job's clip in
  `GetAsyncInvoke`'s answer.
- **Not yet verified:** built and tested against stand-ins; not yet run against Bedrock.

### 13. Nova Reel is in one region and takes one picture size

- **Doing:** setting a Nova Canvas picture moving.
- **What happened:** Nova Reel is offered in `us-east-1`, so wherever else the story server is
  deployed (we started in Mumbai, entry 11) its pictures can't come alive. And the picture it starts
  from must be exactly 1280 x 720; ours are other sizes.
- **Got past it:** the template turns clips on only in a stack in `us-east-1`, and anywhere else the
  picture simply stays still. The TV crops the picture to 1280 x 720 from its centre before sending
  it, and the server reads the size from the image's own bytes and turns away any other.
- **Would have helped:** Reel fitting any picture to its frame itself, and its regions listed with
  the other models'.
- **Not yet verified:** not yet run against Bedrock.

### 14. A spending stop has to name Nova Reel's call on its own

- **Doing:** a hard stop on spending: once the day's or the month's budget is reached, a deny policy
  goes on the function's role.
- **What happened:** denying `bedrock:InvokeModel` doesn't stop `bedrock:StartAsyncInvoke`, the
  separate action Nova Reel is called with, so a stop written before Reel came in would have let
  clips go on being made.
- **Got past it:** the stop denies `bedrock:StartAsyncInvoke` too, and a test pins the whole list, so
  a model called some new way can't slip past it unnoticed.
- **Would have helped:** one Bedrock action to deny everything that costs, or a line about it in
  Reel's documentation.

### 15. The image and video models we built on were retired, and Bedrock was closed to a new account

- **Doing:** turning the story server on for real in a new AWS account, two days before the deadline.
- **What happened:** Amazon Nova Canvas, which made every picture (a drawing made real, a place, each
  thing, a panorama, its cut-out), and Nova Reel, which set a picture moving, reached end of life on
  30 September 2026. We had built on them without checking Bedrock's model lifecycle page. The
  image model nearest in kind on Bedrock, Titan Image Generator v2, had reached its end on 30 June
  2026. Separately, Claude on Bedrock first needs Anthropic's one-time use-case form, and for our
  account it answered "not authorized"; then none of Bedrock's models could be reached from our
  new account at all. A support case is open.
- **Got past it:**
  - every picture is still asked for as one request body; a small adapter (`server/gemini.mjs`)
    reads that body and asks Google's Gemini image models for the same picture, so the TV didn't
    change, except to fit a 3:2 picture back to its 16:10 paper and to cut things out itself;
  - the privacy page says, when Gemini is on, that drawings go to Google;
  - clips are off by default, and the TV never offers them;
  - the storyteller calls Claude through Anthropic's own API when the template is given an
    `AnthropicKey`: the same Messages API, the same models, Bedrock's model IDs read without their
    `anthropic.` prefix, so nothing else changed; Bedrock stays the default for an account that
    has it.
- **Would have helped:** a retirement notice in the console next to a model we were calling, a
  named successor for each retired model, and the use-case form's answer, or Bedrock's refusal,
  saying why and what a new account needs.
- **Since verified:** Claude through Anthropic's API and Gemini's pictures ran live from the
  deployed story server on 22 and 23 October; Bedrock still hasn't.

## In the Vega Virtual Device (added after the run, 23 October)

Severity: **High** blocks the task, **Medium** costs hours, **Low** costs minutes.

### 16. Remote-desktop keys never reach the app; the device's own input tool does

- **Doing:** driving the app in the Vega Virtual Device on a rented Mac from another computer, to
  record the demo (the Mac was in a data centre; we reached it over VNC).
- **Expected:** keys typed into the simulator window over screen sharing arrive as remote buttons.
- **What happened:** they never reached the app. Mouse clicks over VNC didn't register in the
  simulator either. Typing at the Mac itself is the only documented way to press its buttons.
- **Got past it:** `vega device run-cmd -c "inputd-cli button_press KEY_ENTER"` presses a remote
  button on the device itself, and `--holdDuration <ms>` holds one, which our brush needs (a held
  ▼ makes the ink glow). Every frame of our video was driven this way, scripted.
- **Severity:** High for anyone working remotely, as Apple Silicon Macs are mostly rented.
- **Suggestion:** document `inputd-cli` (its key names, `KEY_RIGHT`, `KEY_PLAYPAUSE`, `KEY_BACK`,
  and the hold option) on the simulator page, as the supported way to script a test or a demo.

### 17. `vega device launch-app` asks macOS for Automation access the first time

- **Doing:** launching the app from a terminal on the Mac.
- **What happened:** the first launch opened two macOS prompts, letting Terminal control the
  simulator app and System Events, and waited. Over SSH or in a script nothing shows them, so the
  launch just hangs; on screen, they landed in the middle of our first recorded take.
- **Got past it:** clicked Allow once on the Mac's screen; `vega device run-cmd -c "vlcm launch-app
  pkg://<app id>"` launches without it.
- **Severity:** Medium.
- **Suggestion:** say so in the simulator's setup steps, or launch without needing Automation.

### 18. A Lambda function URL's CORS setting plus the function's own headers break every reply

- **Doing:** calling the story server from the TV's page in a browser, after the first full deploy.
- **What happened:** every call failed with "Failed to fetch". The SAM template gave the function
  URL a `Cors` block, and the function also answered `OPTIONS` and set its own CORS headers, so
  each reply carried two `Access-Control-Allow-Origin` values, which browsers refuse. Nothing in
  the deploy, the console or the logs said so; the request succeeded on the server.
- **Got past it:** removed the template's `Cors` block; the function answers CORS alone.
- **Severity:** High (nothing worked), quick once found.
- **Suggestion:** a warning in SAM or the Lambda console when a function URL with CORS configured
  returns its own `Access-Control-Allow-Origin`.

### 19. A 3D splat world drew black in the simulator's WebView

- **Doing:** *Walk inside*: a World Labs world (about 100,000 soft points, drawn with three.js and
  Spark) opened in the WebView.
- **What happened:** WebGL2 was there (the simulator reports ANGLE over the Mac's GPU), the file
  loaded, and the render loop ran (about 1,700 frames), but every frame was black. The same code
  and file draw in Brave on a laptop's GPU.
- **Got past it:** not yet; it is left out of the video and the submission.
- **Severity:** Medium (one feature).
- **Suggestion:** a note on which WebGL2 features the simulator's WebView supports, and how it
  differs from a Fire TV stick, so a web developer knows which to trust.

## What we would ask for first

1. A key-event table for the Vega WebView (entries 3, 4 and 5).
2. A way to run and see a Vega app without KVM, and a WebView app on any platform the SDK supports (entries 1 and 1a).
3. A Bedrock note for anyone proxying Claude's conversations (entry 8).
4. Short Nova Reel clips returned inline, or each job's exact key (entry 12).
5. A successor named for each retired Bedrock model, shown where it is called, and a reason when a
   new account can't reach Bedrock's models (entry 15).
6. `inputd-cli` documented as the way to script the simulator's remote (entry 16).
