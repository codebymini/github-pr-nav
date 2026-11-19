# GitHub PR Commit Prev/Next

A small Chrome extension that adds a floating **‹ Prev · 3 / 8 · Next ›** bar to GitHub pull requests. Use it to step through a PR's commits one at a time.

- The bar sits in the bottom-right corner and stays there while you scroll.
- It shows which commit you're on and how many there are, e.g. **3 / 8**.
- Keyboard shortcuts: **⌥⇧← / ⌥⇧→** (macOS) or **Alt+Shift+← / →** (Windows/Linux).
- It works on private repos, using your normal GitHub login.
- It needs no special permissions and collects no data.

## Install

The extension isn't on the Chrome Web Store, so you load it yourself. It takes about a minute.

### 1. Get the files

**Option A: download a ZIP**

1. On this page, click the green **Code** button, then **Download ZIP**.
2. Unzip it into a folder you'll keep, e.g. `~/Extensions/github-pr-nav-main`. Chrome loads the extension from that folder, so don't delete it afterwards.

**Option B: clone with git**

```bash
git clone https://github.com/codebymini/github-pr-nav.git
```

### 2. Load it into Chrome

1. Open `chrome://extensions` in the address bar.
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the folder you unzipped or cloned: the one that contains `manifest.json`.
5. Reload any GitHub tabs you already had open.

You should now see **GitHub PR Commit Prev/Next** in your extensions list. Pin it from the puzzle-piece menu if you want its icon in the toolbar. Pinning is optional, since the extension works without its icon.

**Other browsers:** Edge (`edge://extensions`), Brave (`brave://extensions`), Arc and other Chromium browsers use the same steps. Firefox hasn't been tested.

### Updating

- **ZIP:** download the new ZIP and replace the folder's contents.
- **git:** run `git pull` in the folder.

Then click the **reload** icon (↻) on the extension's card in `chrome://extensions`, and reload your GitHub tabs.

### Uninstalling

Click **Remove** on the extension's card in `chrome://extensions`.

## Usage

Open any pull request on github.com.

| Where you are | The bar shows | Prev | Next |
| --- | --- | --- | --- |
| A single commit (`/pull/123/commits/<sha>`) | `3 / 8` | Previous commit | Next commit |
| Anywhere else in the PR (Conversation, Files changed, Checks…) | `– / 8` | Latest commit | First commit |

- Commits are in the same order as the PR's **Commits** tab: oldest first.
- On the first commit Prev is greyed out; on the last commit Next is greyed out.
- Click the counter in the middle to open the PR's Commits tab.
- Hover over Prev or Next to see the commit it leads to (short SHA and message).

### Keyboard shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Previous commit | ⌥ ⇧ ← | Alt + Shift + ← |
| Next commit | ⌥ ⇧ → | Alt + Shift + → |

Shortcuts are ignored while you're typing in a text field.

### Moving the bar

The bar is 24 px from the bottom-right corner. To put it somewhere else, edit `right` / `bottom` in `content.css` and reload the extension. For example, `top: 14px; left: 50%; transform: translateX(-50%);` puts it at the top centre.

## How it works

The extension's code runs only on `github.com` pages. On a pull request it fetches the PR's own Commits page, using your existing GitHub session, and reads the commit list from it. The list is cached for the browser tab. It's checked again after a minute, or right away if you open a commit it doesn't know about, e.g. after a force-push.

GitHub moves between pages without full reloads, so the extension watches for page changes and updates the bar as you navigate.

## Privacy

- No permissions requested beyond running on `github.com`.
- The only network requests are to the PR's own Commits page on github.com.
- Nothing is sent anywhere else, and the only thing stored is a per-tab cache of commit IDs and messages.

## Files

| File | What it does |
| --- | --- |
| `manifest.json` | Extension config (Manifest V3) |
| `content.js` | Fetches the commit list and draws the bar |
| `content.css` | Styling. Uses GitHub's own theme colours, so it follows light/dark mode |
| `icons/` | Extension icons |

## Troubleshooting

- **The bar doesn't appear:** make sure the extension is turned on in `chrome://extensions`, then reload the GitHub tab.
- **The bar shows `–` with greyed-out buttons:** the commit list couldn't be loaded. Reload the page. If it keeps happening, GitHub may have changed its page structure; please open an issue.
- **You changed the files but nothing happened:** click reload (↻) on the extension's card, then reload the GitHub tab.

## License

[MIT](LICENSE)
