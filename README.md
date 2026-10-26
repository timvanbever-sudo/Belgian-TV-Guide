# Belgian TV guide

One guide for the Flemish channels (VRT 1, Canvas, Ketnet, VTM 1 to 4, VTM Gold, VTM Xmas, Play, Play Fictie, Actie, Reality, Crime). The interface is in Dutch. Tap a channel to open its official live player.

A scheduled job (`.github/workflows/guide.yml`) collects the programme guide every six hours and saves it as `guide.js`. The app (`index.html`) reads that file.

## Set up (about 10 minutes)

1. Create a new **public** repository on GitHub, for example `belgian-tv-guide`.
2. Upload every file from this folder, including the `.github` folder. If `.github` does not upload, choose *Add file, Create new file*, type `.github/workflows/guide.yml` as the name and paste in the contents of that file.
3. Open the **Actions** tab, choose **update-guide**, then **Run workflow**. After a few minutes `guide.js` is updated. If the run fails, copy the text of the failed step and send it to Claude.
4. Open **Settings, Pages**, set the source to *Deploy from a branch*, branch `main`, folder `/ (root)`, and save.
5. Open `https://<your-username>.github.io/<repository>/`. Install it from the browser menu (Chrome or Edge: *Install app*; Android: *Add to Home screen*; iPhone: Safari *Share, Add to Home Screen*).

## VRT MAX with your own login (optional)

By default VRT 1, Canvas and Ketnet use the same public guide data as VTM. The collector in `collectors/vrtmax.mjs` can read VRT MAX's own guide instead, which gives VRT's own images, descriptions and links to episodes. It signs in with your free VRT account, reads programme information only, and never touches video streams.

1. In your repository open **Settings, Secrets and variables, Actions** and add two repository secrets: `VRT_EMAIL` and `VRT_PASSWORD`. Use an account whose password you do not use anywhere else. The collector can only sign in with an email address and password.
2. Run the **update-guide** workflow. Open the step **Collect VRT MAX** and look for `VRT sign-in: ok` followed by a line per channel and day with the number of programmes.
3. If the step fails, the guide still updates from the public data. Copy the log of that step and send it to Claude. The log only contains counts, programme titles and error messages, never your credentials. In a public repository anyone can read these logs, so do not add extra logging.

Things to know: this is an automated sign-in, so VRT's terms may not allow it, VRT can block cloud servers or change their site without notice, and the collector has so far only been tested against a stand-in for VRT's sign-in, not against VRT itself. To stop using it, delete the two secrets.

## Files

- `index.html`, `manifest.webmanifest`, `sw.js`, icons: the installable app.
- `channels.xml`: which guide source each channel uses. Play comes from play.tv, VRT and VTM from pickx.be. VTM Xmas has no source, so it shows no guide data.
- `collectors/vrtmax.mjs`: optional VRT MAX collector (see above).
- `build-guide.mjs`: turns the collector's output into the small `guide.js`.
- `logos/`: channel logos, named after the channel id (`vrt1.png`, `playcrime.png` and so on). To add or replace one, drop a PNG with the same name into this folder. VTM Xmas has no logo yet, so it shows its name.

## Notes

- Programme thumbnails and descriptions come from the guide sources (Pickx posters for VRT and VTM, play.tv for Play) and are loaded straight from their servers. If a thumbnail is missing, the channel logo is shown instead.
- Logos come from the open tv-logos collection (github.com/tv-logo/tv-logos). They remain trademarks of the broadcasters and are used here for personal use.
- The page also opens straight from disk (double-click `index.html`), showing sample data until you have a current `guide.js` next to it.
- Live links are saved per browser. Use *Change link* on a channel to edit one.
- If the guide stops updating after a few months, open Actions and run the workflow again.
- The guide comes from the Pickx and Play guide pages through the open-source iptv-org/epg collector. These sites can change without notice, which is the most likely cause of a failed run.
