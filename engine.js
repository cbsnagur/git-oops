(function (root) {
'use strict';

/* Each situation: steps are [command, why]. Placeholders in {braces} are filled from the form.
   risk: safe = nothing is lost; rewrite = changes commit history; destroy = uncommitted work is gone for good. */
const S = [
  // ---------- Commits ----------
  { g: 'Commits', t: 'Fix the message of my last commit', k: 'typo reword amend message wrong',
    risk: 'rewrite',
    steps: [['git commit --amend -m "{msg}"', 'Replaces the last commit with a new one that has the corrected message.']],
    pushed: { steps: [['git commit --amend -m "{msg}"', 'Rewrites the commit locally.'], ['git push --force-with-lease {remote} {branch}', 'Overwrites the remote copy, but refuses if someone else pushed in the meantime.']], note: 'Only do this on a branch nobody else has pulled. On a shared branch, leave the typo.' } },
  { g: 'Commits', t: 'I forgot to include a file in my last commit', k: 'missing file add amend forgot',
    risk: 'rewrite',
    steps: [['git add {file}', 'Stages the file you forgot.'], ['git commit --amend --no-edit', 'Folds it into the last commit and keeps the message.']],
    pushed: { steps: [['git add {file}', 'Stages the file you forgot.'], ['git commit -m "Add {file}"', 'A normal follow-up commit is the safe choice once the original is shared.']], note: 'Amending a pushed commit forces everyone else to recover. A second commit costs nothing.' } },
  { g: 'Commits', t: 'Undo my last commit but keep the changes', k: 'uncommit undo soft reset keep work',
    risk: 'rewrite',
    steps: [['git reset --soft HEAD~{n}', 'Moves the branch back {n} commit(s). Your changes stay staged, ready to commit again.']],
    note: 'Use plain "git reset HEAD~{n}" instead if you want the changes unstaged.',
    pushed: { steps: [['git revert --no-commit HEAD~{n}..HEAD', 'Stages the inverse of the last {n} commit(s) without touching history.'], ['git commit -m "Revert last {n} commit(s)"', 'Records the undo as a new commit that is safe to push.']], note: 'Revert leaves the original commits in history, which is what you want on a shared branch.' } },
  { g: 'Commits', t: 'Undo my last commit and throw the changes away', k: 'delete commit hard reset discard remove',
    risk: 'destroy',
    steps: [['git reset --hard HEAD~{n}', 'Moves the branch back {n} commit(s) and makes your files match. Uncommitted changes are deleted too.']],
    note: 'The commits themselves stay recoverable through "git reflog" for at least 30 days. Uncommitted edits do not.',
    pushed: { steps: [['git revert HEAD', 'Creates a new commit that undoes the last one. Nothing is rewritten.'], ['git push {remote} {branch}', 'Shares the undo.']], note: 'Never hard-reset a branch other people have pulled.' } },
  { g: 'Commits', t: 'Undo an older commit without touching the ones after it', k: 'revert specific old commit middle history',
    risk: 'safe',
    steps: [['git revert {commit}', 'Adds a new commit that applies the exact opposite of {commit}.']],
    note: 'If {commit} is a merge commit, use "git revert -m 1 {commit}" to say which parent to keep.' },
  { g: 'Commits', t: 'I committed on the wrong branch (the right branch does not exist yet)', k: 'wrong branch main master move commits new branch',
    risk: 'rewrite',
    steps: [['git branch {branch}', 'Creates {branch} pointing at your current commit, so the work is safe there.'], ['git reset --hard HEAD~{n}', 'Removes the last {n} commit(s) from the branch you are on.'], ['git switch {branch}', 'Moves you onto the branch that now holds the work.']],
    note: 'Commit or stash any uncommitted changes first: the hard reset deletes them.',
    pushed: { steps: [['git branch {branch}', 'Keeps the work on a new branch.'], ['git revert --no-commit HEAD~{n}..HEAD', 'Stages an undo of those commits on the shared branch.'], ['git commit -m "Revert commits moved to {branch}"', 'Records the undo.'], ['git push {remote} HEAD', 'Shares it.']], note: 'When {branch} is merged later, git will think the changes are already reverted. Revert the revert first, then merge.' } },
  { g: 'Commits', t: 'I committed on the wrong branch (the right branch already exists)', k: 'wrong branch cherry-pick move commit other branch',
    risk: 'rewrite',
    steps: [['git switch {branch}', 'Go to the branch the commit belongs on.'], ['git cherry-pick {commit}', 'Copies the commit onto it.'], ['git switch -', 'Jumps back to the branch you came from.'], ['git reset --hard HEAD~1', 'Removes the misplaced commit there.']],
    note: 'Find {commit} with "git log --oneline -5" before you start.' },
  { g: 'Commits', t: 'Squash my last few commits into one', k: 'squash combine merge commits clean history fixup',
    risk: 'rewrite',
    steps: [['git reset --soft HEAD~{n}', 'Rewinds {n} commits and leaves all their changes staged together.'], ['git commit -m "{msg}"', 'Commits them as one.']],
    note: 'For finer control (reorder, drop, keep some), use "git rebase -i HEAD~{n}".',
    pushed: { steps: [['git reset --soft HEAD~{n}', 'Rewinds and keeps the changes staged.'], ['git commit -m "{msg}"', 'One commit.'], ['git push --force-with-lease {remote} {branch}', 'Replaces the remote branch, unless someone pushed since you last fetched.']], note: 'Fine on your own pull-request branch. Not on main.' } },
  { g: 'Commits', t: 'Remove a file from my last commit but keep it on disk', k: 'accidentally committed file remove untrack node_modules env',
    risk: 'rewrite',
    steps: [['git rm --cached {file}', 'Takes the file out of the index. The copy on disk is untouched.'], ['git commit --amend --no-edit', 'Rewrites the last commit without it.']],
    note: 'Add it to .gitignore so it does not come back.' },
  { g: 'Commits', t: 'I committed a password or API key', k: 'secret credential token key leak password env remove history',
    risk: 'rewrite',
    steps: [['git rm --cached {file}', 'Stops tracking the file (skip this if the secret is inside a file you need tracked; edit it out instead).'], ['git commit --amend --no-edit', 'Rewrites the last commit without the secret.']],
    note: 'Rotate the credential first. Removing it from git does not un-leak it.',
    pushed: { steps: [['git filter-repo --invert-paths --path {file}', 'Rewrites every commit to drop the file. Needs the git-filter-repo tool installed.'], ['git push --force --all {remote}', 'Replaces the remote history.']], note: 'Treat the secret as compromised the moment it was pushed and rotate it now. filter-repo removes the remote setting, so add it back with "git remote add" before pushing. Forks and existing clones may still hold the secret.' } },
  { g: 'Commits', t: 'Change the author of my last commit', k: 'author email name wrong identity work personal',
    risk: 'rewrite',
    steps: [['git commit --amend --author="Your Name <you@example.com>" --no-edit', 'Rewrites the last commit with the right author.']],
    note: 'Set it for future commits in this repo with "git config user.email you@example.com".' },

  // ---------- Staging and files ----------
  { g: 'Staging and files', t: 'Unstage a file I added by mistake', k: 'unstage git add undo remove from index',
    risk: 'safe',
    steps: [['git restore --staged {file}', 'Takes the file out of the staging area. Your edits stay in the working tree.']],
    note: 'To unstage everything: "git restore --staged ."' },
  { g: 'Staging and files', t: 'Throw away my changes to one file', k: 'discard revert file changes checkout undo edits',
    risk: 'destroy',
    steps: [['git restore {file}', 'Overwrites the file with the staged version, or the last commit if nothing is staged.']],
    note: 'There is no undo for this. Run "git diff {file}" first if you are not sure.' },
  { g: 'Staging and files', t: 'Throw away all uncommitted changes', k: 'discard everything clean reset start over nuke',
    risk: 'destroy',
    steps: [['git stash -u', 'Safer first step: parks everything, including new files, where you can still get it back.'], ['git stash drop', 'Run this only once you are sure you do not want any of it.']],
    note: 'The one-shot version is "git reset --hard && git clean -fd". Preview what clean would delete with "git clean -nd".' },
  { g: 'Staging and files', t: 'Get one file back from another commit or branch', k: 'restore file old version previous checkout from branch',
    risk: 'destroy',
    steps: [['git restore --source {commit} -- {file}', 'Replaces your copy of the file with the version from {commit}. A branch name works in place of the hash.']],
    note: 'This overwrites uncommitted edits to that file.' },
  { g: 'Staging and files', t: 'Bring back a file that was deleted in an earlier commit', k: 'deleted file recover restore removed find',
    risk: 'safe',
    steps: [['git log --diff-filter=D --oneline -- {file}', 'Finds the commit that deleted the file.'], ['git restore --source {commit}~1 -- {file}', 'Restores the file as it was just before that commit. Put the hash from step one in place of {commit}.']] },
  { g: 'Staging and files', t: 'Stop tracking a file but keep it on my machine', k: 'gitignore untrack ignore already tracked env config',
    risk: 'safe',
    steps: [['git rm --cached {file}', 'Removes it from the index only.'], ['echo "{file}" >> .gitignore', 'Tells git to ignore it from now on.'], ['git commit -m "Stop tracking {file}"', 'Records the change. Other people will see the file deleted on their next pull.']] },

  // ---------- Branches ----------
  { g: 'Branches', t: 'I deleted a branch and need it back', k: 'deleted branch recover restore reflog',
    risk: 'safe',
    steps: [['git reflog', 'Lists every position HEAD has had. Find the last commit you made on the deleted branch.'], ['git branch {branch} {commit}', 'Recreates the branch at that commit.']],
    note: 'If the branch was pushed, "git switch {branch}" alone will recreate it from {remote}.' },
  { g: 'Branches', t: 'Rename a branch', k: 'rename branch name typo',
    risk: 'safe',
    steps: [['git branch -m {branch}', 'Renames the branch you are on to {branch}.']],
    pushed: { steps: [['git branch -m {branch}', 'Renames it locally.'], ['git push {remote} -u {branch}', 'Publishes the new name and tracks it.'], ['git push {remote} --delete OLD_NAME', 'Removes the old name from the remote.']], note: 'Open pull requests pointing at the old name may need retargeting.' } },
  { g: 'Branches', t: 'My local branch is a mess, make it match the remote exactly', k: 'reset to origin match remote start over sync diverged',
    risk: 'destroy',
    steps: [['git fetch {remote}', 'Gets the latest state of the remote.'], ['git reset --hard {remote}/{branch}', 'Points your branch at the remote version and discards local commits and edits.']],
    note: 'Local commits are still in "git reflog" afterwards. Uncommitted edits are not.' },
  { g: 'Branches', t: 'I made commits in detached HEAD', k: 'detached head not on any branch lost commits',
    risk: 'safe',
    steps: [['git switch -c {branch}', 'Creates a branch right where you are, so the commits have a name and cannot be garbage-collected.']],
    note: 'If you already switched away, find the commit in "git reflog" and run "git branch {branch} {commit}".' },
  { g: 'Branches', t: 'I branched from the wrong base', k: 'wrong base branch rebase onto move branch',
    risk: 'rewrite',
    steps: [['git rebase --onto NEW_BASE OLD_BASE {branch}', 'Replays only the commits that are on {branch} but not on OLD_BASE, on top of NEW_BASE.']],
    note: 'Replace NEW_BASE and OLD_BASE with branch names, for example "git rebase --onto main develop {branch}".' },
  { g: 'Branches', t: 'Delete a branch on the remote', k: 'delete remote branch remove origin',
    risk: 'safe',
    steps: [['git push {remote} --delete {branch}', 'Removes the branch from {remote}. Local copies are untouched.'], ['git branch -d {branch}', 'Deletes your local copy, if it is fully merged.']] },

  // ---------- Merge and rebase ----------
  { g: 'Merge and rebase', t: 'Get me out of this merge', k: 'abort merge conflict cancel stop',
    risk: 'safe',
    steps: [['git merge --abort', 'Cancels the merge and puts everything back as it was before you started.']] },
  { g: 'Merge and rebase', t: 'Undo a merge I just finished', k: 'undo merge unmerge completed revert merge',
    risk: 'rewrite',
    steps: [['git reset --hard ORIG_HEAD', 'Git saves where you were before a merge in ORIG_HEAD. This goes back there.']],
    note: 'ORIG_HEAD is overwritten by the next merge, rebase or reset, so do this straight away. Otherwise use the hash from "git reflog".',
    pushed: { steps: [['git revert -m 1 {commit}', 'Adds a commit that undoes the merge commit {commit}, keeping the first parent (the branch you merged into).'], ['git push {remote} {branch}', 'Shares the undo.']], note: 'To merge that branch again later you must first revert this revert, or git will skip its changes.' } },
  { g: 'Merge and rebase', t: 'Get me out of this rebase', k: 'abort rebase conflict cancel stop stuck',
    risk: 'safe',
    steps: [['git rebase --abort', 'Stops the rebase and restores the branch to how it was.']] },
  { g: 'Merge and rebase', t: 'A rebase finished and wrecked my branch', k: 'undo rebase bad rebase restore before rebase',
    risk: 'rewrite',
    steps: [['git reflog', 'Find the entry just before "rebase (start)". Note its hash.'], ['git reset --hard {commit}', 'Puts the branch back at that commit.']],
    note: 'Right after the rebase, "git reset --hard ORIG_HEAD" does the same in one step.' },
  { g: 'Merge and rebase', t: 'In a conflict, just take their version (or mine) of a file', k: 'conflict theirs ours resolve accept incoming current',
    risk: 'destroy',
    steps: [['git checkout --theirs -- {file}', 'Takes the incoming version of the file. Use --ours for your side.'], ['git add {file}', 'Marks the conflict as resolved.']],
    note: 'During a rebase the meaning flips: --ours is the branch you are rebasing onto, --theirs is your own commit.' },

  // ---------- Remote ----------
  { g: 'Remote', t: 'My push was rejected', k: 'push rejected non-fast-forward fetch first behind remote',
    risk: 'safe',
    steps: [['git pull --rebase {remote} {branch}', 'Fetches the new remote commits and replays yours on top of them.'], ['git push {remote} {branch}', 'Now it fast-forwards.']],
    note: 'Do not reach for --force here. The rejection means the remote has work you do not.' },
  { g: 'Remote', t: 'I force-pushed and wiped out commits on the remote', k: 'force push overwrote lost remote commits undo',
    risk: 'rewrite',
    steps: [['git reflog show {remote}/{branch}', 'Shows what your machine thought the remote branch pointed at before your push. Note the old hash.'], ['git push --force-with-lease {remote} {commit}:{branch}', 'Puts the remote branch back at that commit.']],
    note: 'If the lost commits were never on your machine, ask the person who made them: their local branch still has them.' },
  { g: 'Remote', t: 'I pulled and it made a mess', k: 'undo pull bad pull merge after pull',
    risk: 'destroy',
    steps: [['git reset --hard ORIG_HEAD', 'Returns your branch to where it was before the pull.']],
    note: 'Uncommitted edits are discarded. If a merge is still in progress, "git merge --abort" is the gentler exit.' },
  { g: 'Remote', t: 'I pushed to the wrong remote branch', k: 'pushed wrong branch remote remove undo push',
    risk: 'rewrite',
    steps: [['git push {remote} {commit}:{branch} --force-with-lease', 'Moves the remote branch back to {commit}, the commit it should point at.']],
    note: 'Find the right {commit} with "git log {remote}/{branch} --oneline". On a protected branch, revert instead.' },

  // ---------- Lost work ----------
  { g: 'Lost work', t: 'I ran reset --hard and lost commits', k: 'lost commits reset hard recover reflog gone',
    risk: 'safe',
    steps: [['git reflog', 'Every commit you had checked out recently is listed here (kept for at least 30 days). Find the one you want.'], ['git branch rescue {commit}', 'Pins it to a new branch called rescue so you can inspect it calmly.']],
    note: 'Edits that were never committed are gone. Edits that were staged with "git add" can sometimes be found with "git fsck --lost-found".' },
  { g: 'Lost work', t: 'I dropped or cleared a stash I needed', k: 'stash drop clear lost recover stash',
    risk: 'safe',
    steps: [['git fsck --no-reflogs --unreachable | grep commit', 'Lists commits nothing points to any more. Dropped stashes are among them.'], ['git show {commit}', 'Inspect candidates until you find your stash.'], ['git stash apply {commit}', 'Applies it to your working tree.']] },
  { g: 'Lost work', t: 'I started work on the wrong branch (nothing committed yet)', k: 'move changes uncommitted other branch stash switch',
    risk: 'safe',
    steps: [['git stash -u', 'Parks your edits, including new files.'], ['git switch {branch}', 'Moves to the right branch. Add -c to create it.'], ['git stash pop', 'Puts the edits back.']],
    note: 'Often "git switch {branch}" alone carries the edits across. The stash is for when git refuses.' },
  { g: 'Lost work', t: 'Find which commit introduced a bug', k: 'bisect find bug regression which commit broke',
    risk: 'safe',
    steps: [['git bisect start', 'Begins a binary search through history.'], ['git bisect bad', 'Marks the current commit as broken.'], ['git bisect good {commit}', 'Marks a commit you know worked. Git checks out the midpoint.'], ['git bisect reset', 'When git names the culprit, this returns you to where you started.']],
    note: 'At each step test, then run "git bisect good" or "git bisect bad". With a test script: "git bisect run npm test".' }
];

const DEFAULTS = { branch: 'feature/login', remote: 'origin', file: 'src/app.js', commit: 'abc1234', n: '1', msg: 'Describe the change' };

function fill(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, k) => {
    let v = vars[k] !== undefined && String(vars[k]).trim() !== '' ? String(vars[k]).trim() : DEFAULTS[k];
    if (v === undefined) return m;
    if (k === 'msg') v = v.replace(/(["\\$`])/g, '\\$1');
    return v;
  });
}

function resolve(s, vars, pushed) {
  const src = pushed && s.pushed ? s.pushed : s;
  let risk = s.risk;
  if (pushed && s.pushed) {
    const cmds = s.pushed.steps.map(x => x[0]).join(' ');
    risk = /--force|filter-repo/.test(cmds) ? 'rewrite' : 'safe';
  }
  return {
    title: s.t, group: s.g, risk,
    steps: src.steps.map(([c, w]) => ({ cmd: fill(c, vars), why: fill(w, vars) })),
    note: (pushed && s.pushed ? s.pushed.note : s.note) ? fill(pushed && s.pushed ? s.pushed.note : s.note, vars) : null,
    hasPushed: !!s.pushed, usingPushed: !!(pushed && s.pushed)
  };
}

function search(q) {
  const words = q.toLowerCase().split(/[^a-z0-9-]+/).filter(w => w.length > 1 && !['the', 'my', 'to', 'and', 'git', 'how', 'do', 'an', 'it', 'of', 'in', 'on', 'is'].includes(w));
  if (!words.length) return S.map((s, i) => i);
  const scored = [];
  S.forEach((s, i) => {
    const title = s.t.toLowerCase(), hay = (s.k + ' ' + s.g).toLowerCase(), cmds = s.steps.map(x => x[0]).join(' ').toLowerCase();
    let score = 0;
    for (const w of words) {
      const stem = w.length > 4 ? w.replace(/(ed|ing|s)$/, '') : w;
      if (title.includes(stem)) score += 3;
      if (hay.includes(stem)) score += 2;
      if (cmds.includes(stem)) score += 1;
    }
    if (score) scored.push([score, i]);
  });
  return scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(x => x[1]);
}

const api = { scenarios: S, DEFAULTS, fill, resolve, search, groups: Array.from(new Set(S.map(s => s.g))) };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.GitOops = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
