# seattle-emergency-hubs-website

## Blog authoring workflow for non-technical contributors

This site reads the home page blog feed from `content/posts.json` and automatically sorts posts with the newest date first.

### Where to edit blog posts

- Contributors go to `/admin/` and use a form UI to add/edit posts.
- The CMS writes to `content/posts.json` in the repo.
- The home page (`index.html`) automatically renders those posts.

## GitHub Pages CMS setup (no Netlify required)

You mentioned you host on GitHub Pages, so this repo is now configured for Decap's **GitHub backend** (not Netlify `git-gateway`).

See `admin/config.yml`:

```yml
backend:
  name: github
  repo: YOUR_GITHUB_ORG_OR_USER/seattle-emergency-hubs-website
  branch: main
  base_url: https://YOUR-OAUTH-BROKER.example.com
  auth_endpoint: auth
```

### How authentication works on GitHub Pages

Decap CMS needs a small OAuth broker service to complete GitHub login securely.

- `/admin/` redirects users to GitHub sign-in.
- The OAuth broker exchanges the code for a token.
- Decap uses that token to commit changes to your repo.

GitHub Pages alone cannot host this token-exchange backend, so you must run the OAuth broker separately (for example on a tiny serverless function/service).

### Who is authorized to post?

Anyone who can:

1. Log in via your GitHub OAuth app, and
2. Push to the configured repository/branch.

In practice, for this simple setup, authors should be GitHub collaborators (or org members) with write access to this repo.

### How to add an author

1. Add them as a collaborator on the repository (or give write access via your GitHub org/team).
2. Share `/admin/` URL.
3. They sign in with GitHub and can edit posts.

### How to remove an author

1. Remove their write access from the repository (or org/team).
2. Optionally revoke/rotate OAuth app credentials if needed.

After access is removed, they can no longer publish through the CMS.

## Required one-time edits before this works

1. In `admin/config.yml`, replace `repo` with your real `owner/repo`.
2. Set `base_url` to your real OAuth broker URL.
3. Keep `auth_endpoint` aligned with that broker's route (commonly `auth`).

If you want, I can also add a concrete, step-by-step OAuth broker deployment guide next (Cloudflare Workers, Netlify Function, or Render), so you can copy/paste it.
