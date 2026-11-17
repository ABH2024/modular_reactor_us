# Modular Reactor User Study

A short online study (about 6 minutes) in which participants compare pairs of animated faces reacting to a person speaking.
Everything here is plain HTML, CSS and JavaScript: no server, no framework, no tracking.

Study page: **https://abh2024.github.io/modular_reactor_us/**

## What a participant sees

1. A front page with a short description and one line of information; one checkbox to take part.
2. A sound check.
3. Six comparisons: the recorded partner is shown once on the left with both voices ("Speaker"); two versions of a grey face mask,
   always facing forward, are stacked on the right ("Reactor", top and bottom). For each pair the participant answers which face
   reacts better to the partner and which face moves more naturally: top, bottom, or "no clear difference". The buttons unlock once
   each face has been played to the end.
4. A thank-you page.

An earlier three-part study (bodies and faces) ran on this address until 16 November 2026; its files remain in the repository
(`config_all.json`, `stimuli/`, `stimuli_partBC/`) but are no longer served as the study page.

## Files

| File or folder | What it is |
|---|---|
| `index.html` | the study page (entry point): the face study |
| `config_face.json`, `stimuli_index_face.json`, `manifest_face.json`, `stimuli_face/` | texts, screens, checksums and videos of the face study |
| `app.js`, `style.css` | the page logic and look (shared by both studies) |
| `index_face.html` | the same page under its former name |
| `config_all.json`, `stimuli_index_all.json`, `manifest_all.json`, `stimuli/`, `stimuli_partBC/` | the earlier three-part study, kept for the record |
| `.nojekyll` | tells GitHub Pages to serve the files as they are |

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
