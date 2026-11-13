# Modular Reactor User Study

A short online study (about 20 minutes) in which participants compare pairs of short animations of people reacting to each other.
Everything here is plain HTML, CSS and JavaScript: no server, no framework, no tracking.

Study page: **https://abh2024.github.io/modular_reactor_us/**

## What a participant sees

1. A front page with a short description and one line of information; one checkbox to take part.
2. **Part A** (no sound): pairs of animations of two 3D characters. The blue character is the same in both videos; the yellow one reacts to it.
   One practice screen, then 12 screens.
3. A sound check.
4. **Part B** (sound on): short conversation clips. The recorded partner is shown once on the left ("Speaker"); two versions of the grey
   reacting character are stacked on the right ("Reactor", top and bottom). 6 screens.
5. **Part C** (sound on): the same clips with the faces in close-up. 6 screens.
6. A thank-you page.

On every screen the participant answers two questions, each with three buttons: which version reacts more appropriately, and which one
moves more naturally (left / right, or top / bottom, or "no clear difference"). The buttons unlock once each video has been played to the end.

## Files

| File or folder | What it is |
|---|---|
| `index.html` | the study page (entry point) |
| `app.js` | the page logic: screens, playback, answers, saving |
| `style.css` | the look of the page |
| `config_all.json` | every text shown on the page and the design settings (order of the parts, questions, answers) |
| `stimuli_index_all.json` | the list of screens: which video files are shown together |
| `manifest_all.json` | the list of all files with their checksums (the page records the version it ran) |
| `stimuli/` | the Part A videos |
| `stimuli_partBC/` | the Part B and C videos and the sound check |
| `.nojekyll` | tells GitHub Pages to serve the files as they are |

Video file names are neutral on purpose (`v01_a.mp4`, `r03_b.mp4`, `k05.mp4`): the page does not reveal which version is which.

## How the comparisons are assigned

Each participant sees every clip once. Which comparison is shown for a clip, the order of the screens and the position of each version
(left/right or top/bottom) depend on a slot number drawn when the page opens, so that over many participants every comparison and every
position come up equally often.

## What is recorded

Only the answers, the playback actions (play, pause, back to the start), the time taken, the screen size, the browser name and a random
participant code. No name, no e-mail, no address. When the page cannot reach a collection address, the answers are downloaded as a small
file on the participant's computer.

## Credits

The recorded conversation videos of Parts B and C come from the **Seamless Interaction** dataset (Meta), licence
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/); they are cropped and placed next to a rendered animation, for research only.
The 3D characters are rendered with a standard body model.

## Running it elsewhere

Copy the folder to any static web host, or serve it locally with a server that supports HTTP range requests (needed to replay a video),
then open `index.html`. Opening the file directly in a browser does not work.
