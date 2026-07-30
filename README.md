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

## Brand assets

The Brand Assets page (`branding.html`) is fully data-driven, the same way the blog feed is. Nothing on that page is hardcoded — contributors manage it from `/admin/` and the page updates itself.

### Where the content lives

| What | File | CMS entry |
| --- | --- | --- |
| Logos, colors, fonts, usage rules | `content/brand.json` | Brand Assets → Brand Guide |
| Member-contributed photos | `content/photos.json` | Brand Assets → Member Photo Library |

Rendering is handled by `js/brand.js`. Uploaded logo files land in `images/brand-guide/`, member photos in `images/photos/`.

### Adding a logo

1. Go to `/admin/` → **Brand Assets** → **Brand Guide** → **Logos** → *Add*.
2. Fill in the name and description, upload a preview image, and set **Preview background** to `dark` for reversed/white logos so they display against a dark tile.
3. Under **Download files**, add one row per format (SVG, PNG, EPS). The first button renders as the primary button, the rest as secondary.

The existing logo set is in `images/brand-guide/seh-logos/` — five variants (full color, inverse, circle mark, one-color black, one-color white), each as SVG plus small/medium/large PNG, with EPS for the two one-color versions.

### Adding a member photo

1. Go to `/admin/` → **Brand Assets** → **Member Photo Library** → **Photos** → *Add*.
2. Upload the photo, then fill in **Photo credit** exactly as the contributor wants to be named.
3. **Caption** doubles as the image alt text, so write it as a description of what is in the photo.
4. **Tags** drive the filter buttons above the gallery. Reuse existing tags where possible so the filter list stays short.
5. **Usage permission** records what the contributor approved. Fill this in before publishing a contributed photo.

Please resize photos to roughly 1600px wide before uploading — the CMS commits them straight into the repo, so oversized files bloat the site.

### How photos are contributed

There is no public upload form; this is a static site with no backend to receive one. Members email photos to the address on the page, and someone with CMS access adds them. That also keeps the "select" curation step and the usage-permission record in the hands of a coordinator.

## Calendar embed troubleshooting

If the calendar iframe loads but shows no events:

1. In Google Calendar settings for that calendar, make sure it is shared so events are visible to the public (or at least to the intended audience for embeds).
2. Confirm the calendar ID in `calendar.html` is URL-encoded (`@` must be `%40`).
3. Check that the events are in the future if you are looking at the "Upcoming Events" agenda embed.

## Hub Finder API key on Netlify

The Hub Finder page (`hub-finder.html`) reads the Google Maps key from `window.GOOGLE_MAPS_API_KEY`.

For Netlify deploys, this is generated automatically from the environment variable `GOOGLE_MAPS_API_KEY`:

1. In Netlify site settings, add environment variable `GOOGLE_MAPS_API_KEY`.
2. Keep `netlify.toml` in the repo so Netlify writes `js/runtime-config.js` at build time.
3. The generated `js/runtime-config.js` sets `window.GOOGLE_MAPS_API_KEY` before `js/hub-finder.js` loads.
4. The build also accepts legacy `GOOGLE_API_KEY`, but `GOOGLE_MAPS_API_KEY` is preferred.

For local/manual testing, you can also set the `seh-google-maps-api-key` meta tag directly in `hub-finder.html`.
