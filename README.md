# Git Oops

Say what went wrong in git. Get the exact commands to undo it, filled in with your branch and file names, and a plain warning about what each one costs.

Open `index.html` in a browser. It is one self-contained file: no server, no build step to use it, and nothing you paste leaves the tab.

## What it does

- 36 situations across commits, staging, branches, merges and rebases, remotes and lost work
- Search in your own words, for example "committed on the wrong branch" or "lost stash"
- Commands are filled in with your branch, remote, file, commit and message
- An "I already pushed it" switch swaps in commands that are safe for shared history
- Every fix is labelled Safe, Rewrites history or Destroys work

The commands are standard git, but check each one against your own repository before running it, especially those labelled Destroys work.

## Development

- `engine.js`: the logic, with no DOM access, so it runs in Node and the browser
- `template.html`: page markup, page-specific styles and UI code
- `base.css`, `common.js`: shared styles and helpers
- `node build.js`: inlines everything into `index.html`
- `node test.js`: prints engine output for sample inputs

## Hosting

Any static host works. On GitHub Pages: Settings, Pages, deploy from the `main` branch root.
