# Evidence Attribution

The report attributes only public events that expose the required actor, timestamp, and stable source URL. Username comparison is case-insensitive. The reporting window includes both boundary timestamps.

## Rules

- **Release:** include a published, nondraft release when `author.login` matches the maintainer and `published_at` is inside the window. A release tag is metadata for that release, not independent maintainer evidence.
- **Authored pull request:** include a pull request when `user.login` matches the maintainer and `created_at` is inside the window.
- **Merged pull request:** include a pull request when `merged_by.login` matches the maintainer and `merged_at` is inside the window. Authorship alone does not prove who merged it.
- **Pull request review:** include a submitted review when `user.login` matches the maintainer and `submitted_at` is inside the window. Review candidates are confirmed from the pull request review list.
- **Opened issue:** include a non-pull-request issue when `user.login` matches the maintainer and `created_at` is inside the window.
- **Closed issue:** include a non-pull-request issue when `closed_by.login` matches the maintainer and `closed_at` is inside the window.
- **Issue comment:** include a repository issue comment when its parent is not a pull request, `user.login` matches the maintainer, and `created_at` is inside the window.

Null actors or timestamps are excluded. Missing detail required to establish attribution fails closed rather than creating inferred evidence. Titles, labels, commit messages, email addresses, organization membership, and repository permissions are never used to guess an actor.

Repository facts, community files, stars, forks, watchers, and visible contributors describe repository state. They are not credited as actions by the maintainer.
