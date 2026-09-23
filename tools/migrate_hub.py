#!/usr/bin/env python3
"""
Migrate one hub's page off the old WordPress multisite onto this static site.

Each hub currently runs as its own subsite (seattleemergencyhubs.org/<hub>/),
so one run of this script handles one hub. It:

  1. reads the hub's page from a WordPress export, a local HTML dump, or a URL
  2. strips the WordPress theme chrome down to the actual content
  3. downloads every image, resizes and re-encodes it, and drops it in
     images/hubs/<slug>/
  4. writes hubs/<slug>.html using this site's markup
  5. registers the hub in content/hubs.json, which is what builds the hub
     cards and the Hubs nav dropdown

Then it prints a checklist of the things a script cannot decide: images with no
alt text, links still pointing at the old site, and so on. Expect to hand-edit
the generated page afterwards; the point is to skip the mechanical part.

Examples
--------
  # From a WordPress export (most reliable — no theme markup to strip)
  tools/migrate_hub.py --slug fremont --wxr exports/fremont.xml \\
      --uploads /srv/wp/wp-content/uploads

  # See what pages an export contains before picking one
  tools/migrate_hub.py --slug fremont --wxr exports/fremont.xml --list-posts

  # From a local dump of the rendered site
  tools/migrate_hub.py --slug crownhill --html dump/crownhill/index.html \\
      --uploads dump/wp-content/uploads

  # Straight off the live site
  tools/migrate_hub.py --slug crownhill \\
      --url https://seattleemergencyhubs.org/crownhill/

Requires: beautifulsoup4, lxml, pillow
  python3 -m pip install beautifulsoup4 lxml pillow
"""

import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY = os.path.join(REPO_ROOT, "content", "hubs.json")
USER_AGENT = "seattle-emergency-hubs-migrator/1.0"

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("Missing dependency. Run: python3 -m pip install beautifulsoup4 lxml pillow")

try:
    from PIL import Image
except ImportError:
    sys.exit("Missing dependency. Run: python3 -m pip install beautifulsoup4 lxml pillow")


# --------------------------------------------------------------------------
# Source loading
# --------------------------------------------------------------------------

def fetch_url(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


WXR_NS = {
    "content": "http://purl.org/rss/1.0/modules/content/",
    "wp": "http://wordpress.org/export/1.2/",
}


def wxr_items(path):
    """Yields published pages/posts from a WordPress export (WXR) file."""
    root = ET.parse(path).getroot()
    for item in root.iter("item"):
        status = item.findtext("wp:status", default="", namespaces=WXR_NS)
        post_type = item.findtext("wp:post_type", default="", namespaces=WXR_NS)
        if status != "publish" or post_type not in ("page", "post"):
            continue
        yield {
            "id": item.findtext("wp:post_id", default="", namespaces=WXR_NS),
            "slug": item.findtext("wp:post_name", default="", namespaces=WXR_NS),
            "title": (item.findtext("title") or "").strip(),
            "type": post_type,
            "date": item.findtext("wp:post_date", default="", namespaces=WXR_NS),
            "link": (item.findtext("link") or "").strip(),
            "html": item.findtext("content:encoded", default="", namespaces=WXR_NS) or "",
            "menu_order": item.findtext("wp:menu_order", default="0", namespaces=WXR_NS),
        }


def pick_wxr_item(items, wanted):
    """Picks the landing page: an explicit --wxr-post, else the front page."""
    if wanted:
        for it in items:
            if wanted in (it["slug"], it["id"]):
                return it
        raise SystemExit(
            "No published page in the export matches %r.\n"
            "Run again with --list-posts to see what is available." % wanted
        )

    pages = [it for it in items if it["type"] == "page"]
    if not pages:
        raise SystemExit("The export contains no published pages. Use --list-posts to inspect it.")

    # A multisite hub's landing page sits at the subsite root, so its link has
    # no path segment beyond the subsite itself.
    for it in pages:
        path = urllib.parse.urlparse(it["link"]).path.strip("/")
        if "/" not in path:
            return it
    return pages[0]


# Content wrappers used by WordPress themes, most specific first.
CONTENT_SELECTORS = [
    ".entry-content",
    ".post-content",
    "article .content",
    ".content-area",
    "main",
    "#content",
    ".site-content",
]


def extract_content(html, selector=None):
    """Returns (content_soup, page_title) with theme chrome removed."""
    soup = BeautifulSoup(html, "lxml")

    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.split("|")[0].split("–")[0].strip()

    for sel in ([selector] if selector else CONTENT_SELECTORS):
        node = soup.select_one(sel)
        if node and node.get_text(strip=True):
            return node, title

    raise SystemExit(
        "Could not find the content area. Pass --selector with a CSS selector "
        "for the wrapper that holds the page body."
    )


# --------------------------------------------------------------------------
# Cleaning
# --------------------------------------------------------------------------

DROP_TAGS = ["script", "style", "noscript", "form", "nav", "header", "footer", "aside", "svg"]

# Theme furniture that survives the content-area match.
DROP_CLASS_RE = re.compile(
    r"comment|sidebar|widget|breadcrumb|post-navigation|nav-links|related|"
    r"sharedaddy|share|screen-reader-text|skip-link|social|jp-relatedposts|"
    r"entry-meta|entry-footer|posted-on|byline|author-box|pagination|"
    r"more-link|read-more|edit-link",
    re.I,
)

# WordPress block/layout wrappers that carry no meaning of their own.
UNWRAP_TAGS = ["div", "span", "section", "article", "center", "font", "b", "i", "u", "small"]

KEEP_ATTRS = {
    "a": ["href"],
    "img": ["src", "alt", "width", "height"],
}

SEPARATOR_RE = re.compile(r"^[\s \-–—_=*.·•]+$")


def clean_content(node):
    """Reduces WordPress markup to the small tag vocabulary this site uses."""
    for tag in node.find_all(DROP_TAGS):
        tag.decompose()

    for tag in node.find_all(attrs={"class": DROP_CLASS_RE}):
        tag.decompose()
    for tag in node.find_all(attrs={"id": DROP_CLASS_RE}):
        tag.decompose()

    # Preserve <em>/<strong>, normalise their legacy equivalents first.
    for tag in node.find_all(["b", "strong"]):
        tag.name = "strong"
    for tag in node.find_all(["i", "em"]):
        tag.name = "em"

    for tag in node.find_all(UNWRAP_TAGS):
        tag.unwrap()

    # <figure> survives, but only as this site's figure class.
    for fig in node.find_all("figure"):
        fig.attrs = {"class": "post-figure"}
    for cap in node.find_all("figcaption"):
        cap.attrs = {}

    for tag in node.find_all(True):
        if tag.name in ("figure", "figcaption"):
            continue
        tag.attrs = {k: v for k, v in tag.attrs.items() if k in KEEP_ATTRS.get(tag.name, [])}

    # Headings: the first h1 becomes the page title, the rest become sections.
    for h1 in node.find_all("h1"):
        h1.name = "h2"
    for h in node.find_all(["h4", "h5", "h6"]):
        h.name = "h3"

    # Drop empties and rules made of dashes.
    for tag in node.find_all(["p", "li", "h2", "h3"]):
        text = tag.get_text().replace(" ", " ").strip()
        if not text and not tag.find("img"):
            tag.decompose()
        elif SEPARATOR_RE.match(text) and not tag.find("img"):
            tag.decompose()
    for hr in node.find_all("hr"):
        hr.decompose()

    return node


# Some hub themes render their editor's scaffolding notes as real text,
# e.g. "start posts" / "end this loop" / "start second loop show latest 3 posts".
TEMPLATE_NOTE_RE = re.compile(
    r"^(start|end)\b.{0,60}?\b(post|posts|loop)\b.{0,40}$", re.I | re.S
)


def strip_template_artifacts(node, extra_patterns):
    """Drops leftover theme scaffolding. Returns what was removed, for the report."""
    patterns = [TEMPLATE_NOTE_RE] + [re.compile(p, re.I) for p in extra_patterns]
    dropped = []
    for tag in node.find_all(["p", "h2", "h3", "li"]):
        text = tag.get_text(strip=True)
        if not text or tag.find("img"):
            continue
        if any(p.match(text) for p in patterns):
            dropped.append(text)
            tag.decompose()
    return dropped


def normalize_text(node):
    """Straightens the smart punctuation WordPress inserts, in text nodes only."""
    from bs4 import NavigableString

    replacements = {"‘": "'", "’": "'", "“": '"', "”": '"', " ": " "}
    for text in list(node.find_all(string=True)):
        new = str(text)
        for old, repl in replacements.items():
            new = new.replace(old, repl)
        new = re.sub(r"[ \t]{2,}", " ", new)
        if new != str(text):
            text.replace_with(NavigableString(new))


# --------------------------------------------------------------------------
# Images
# --------------------------------------------------------------------------

# WordPress writes resized copies as name-800x600.ext; we want the original.
RESIZE_SUFFIX_RE = re.compile(r"-\d+x\d+(?=\.[A-Za-z0-9]+$)")

PASSTHROUGH_EXT = {".svg", ".gif", ".webp"}


def slugify_filename(name):
    stem, ext = os.path.splitext(name)
    stem = re.sub(r"[^A-Za-z0-9]+", "-", stem).strip("-").lower()
    return (stem or "image") + ext.lower()


def resolve_local(url, uploads_dir):
    """Maps an uploads URL onto a local uploads directory, tolerating odd names."""
    if not uploads_dir:
        return None

    path = urllib.parse.unquote(urllib.parse.urlparse(url).path)
    marker = "/uploads/"
    if marker not in path:
        return None
    rel = path.split(marker, 1)[1]

    candidates = [rel, RESIZE_SUFFIX_RE.sub("", rel)]
    for cand in candidates:
        full = os.path.join(uploads_dir, cand)
        if os.path.isfile(full):
            return full

    # Filenames containing spaces or unusual characters: match on the directory.
    for cand in candidates:
        directory = os.path.join(uploads_dir, os.path.dirname(cand))
        target = os.path.basename(cand)
        if not os.path.isdir(directory):
            continue
        for entry in os.listdir(directory):
            if entry == target or slugify_filename(entry) == slugify_filename(target):
                return os.path.join(directory, entry)
    return None


def load_image_bytes(url, uploads_dir):
    """Returns (bytes, note). Prefers the local uploads dir over the network."""
    local = resolve_local(url, uploads_dir)
    if local:
        with open(local, "rb") as fh:
            return fh.read(), "local:" + os.path.relpath(local, uploads_dir)

    # Try the original before the theme's resized copy.
    for candidate in (RESIZE_SUFFIX_RE.sub("", url), url):
        quoted = urllib.parse.quote(candidate, safe=":/?#[]@!$&'()*+,;=%")
        try:
            return fetch_url(quoted), "downloaded"
        except Exception:
            continue
    return None, "FAILED"


def encode_image(raw, dest_path, max_width, quality):
    """Resizes and re-encodes; photos become JPEG, flat graphics stay PNG."""
    ext = os.path.splitext(dest_path)[1].lower()
    if ext in PASSTHROUGH_EXT:
        with open(dest_path, "wb") as fh:
            fh.write(raw)
        return os.path.basename(dest_path), None

    try:
        im = Image.open(io.BytesIO(raw))
        im.load()
    except Exception as exc:
        return None, "could not decode (%s)" % exc

    if im.width > max_width:
        height = round(im.height * max_width / im.width)
        im = im.resize((max_width, height), Image.LANCZOS)

    has_alpha = im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 255

    if has_alpha:
        out_ext = ".png"
    else:
        rgb = im.convert("RGB")
        # getcolors returns None once an image exceeds the cap: that means photo.
        out_ext = ".jpg" if rgb.getcolors(maxcolors=8192) is None else ".png"
        im = rgb

    dest = os.path.splitext(dest_path)[0] + out_ext
    if out_ext == ".jpg":
        im.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    else:
        im.save(dest, "PNG", optimize=True)
        if shutil.which("pngquant"):
            subprocess.run(
                ["pngquant", "--force", "--skip-if-larger", "--quality", "65-90",
                 "--output", dest, dest],
                check=False, capture_output=True,
            )

    return os.path.basename(dest), None


def process_images(node, slug, base_url, uploads_dir, max_width, quality, dry_run):
    """Rewrites every <img> to a local, optimized copy. Returns a report list."""
    dest_dir = os.path.join(REPO_ROOT, "images", "hubs", slug)
    if not dry_run:
        os.makedirs(dest_dir, exist_ok=True)

    report, used = [], set()
    soup = BeautifulSoup("", "lxml")
    kept = 0

    for img in node.find_all("img"):
        src = img.get("src", "")
        if not src:
            img.decompose()
            continue

        url = urllib.parse.urljoin(base_url, src) if base_url else src
        name = slugify_filename(
            RESIZE_SUFFIX_RE.sub("", os.path.basename(urllib.parse.urlparse(url).path))
        )
        stem, ext = os.path.splitext(name)
        n = 2
        while name in used:
            name = "%s-%d%s" % (stem, n, ext)
            n += 1
        used.add(name)

        if dry_run:
            report.append(("would fetch", url, name))
            img["src"] = "../images/hubs/%s/%s" % (slug, name)
            continue

        raw, note = load_image_bytes(url, uploads_dir)
        if raw is None:
            report.append(("UNAVAILABLE", url, "image dropped from the page"))
            (img.find_parent("figure") or img).decompose()
            continue

        final_name, err = encode_image(raw, os.path.join(dest_dir, name), max_width, quality)
        if final_name is None:
            report.append(("UNREADABLE", url, err))
            (img.find_parent("figure") or img).decompose()
            continue

        img["src"] = "../images/hubs/%s/%s" % (slug, final_name)
        with Image.open(os.path.join(dest_dir, final_name)) as out:
            img["width"], img["height"] = str(out.width), str(out.height)
        report.append((note, url, final_name))

        if not img.get("alt"):
            img["alt"] = ""

        # Everything below the fold gets lazy-loaded; the first image does not.
        if kept:
            img["loading"] = "lazy"
        kept += 1

        # Bare images get the site's figure treatment.
        if not img.find_parent("figure"):
            fig = soup.new_tag("figure")
            fig["class"] = "post-figure"
            img.wrap(fig)

    return report


# --------------------------------------------------------------------------
# Links
# --------------------------------------------------------------------------

def process_links(node, base_url, registry_slugs):
    """Repoints old-site links at the new site where possible; reports the rest."""
    report = []
    for a in node.find_all("a"):
        href = (a.get("href") or "").strip()
        if not href:
            a.unwrap()
            continue

        # WordPress wraps images in a lightbox link to the full-size upload.
        # process_images() localizes the image itself, so the link to the old
        # server is dead weight; drop it and keep the image.
        if a.find("img") and re.search(r"\.(png|jpe?g|gif|webp|svg)$", href, re.I):
            a.unwrap()
            continue

        url = urllib.parse.urljoin(base_url, href) if base_url else href
        parsed = urllib.parse.urlparse(url)

        if parsed.scheme == "mailto":
            a["href"] = url
            continue

        if "seattleemergencyhubs.org" in parsed.netloc:
            first = parsed.path.strip("/").split("/")[0]
            # A link to another hub's subsite becomes a link to its new page.
            if first in registry_slugs and parsed.path.strip("/") == first:
                a["href"] = first + ".html"
                continue
            report.append(("old-site link", url, a.get_text(strip=True)))
            a["href"] = url
            continue

        if parsed.scheme in ("http", "https"):
            a["href"] = url
            a["target"] = "_blank"
            a["rel"] = "noopener noreferrer"

    return report


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="{description}" />
  <title>{name} – Seattle Emergency Hubs</title>
  <script>try{{if(localStorage.getItem("seh-theme")==="dark")document.documentElement.setAttribute("data-theme","dark")}}catch(e){{}}</script>
  <link rel="stylesheet" href="../css/style.css" />
</head>
<body>

  <a class="skip-link" href="#main-content">Skip to main content</a>

  <div id="site-header-placeholder"></div>

  <main id="main-content">

    <a href="index.html" class="back-link">← All Hubs</a>

    <div class="hub-detail">
      <h1>{name}</h1>
{tagline}
{info_grid}
{body}

      <h2 class="mt-3">Get Involved</h2>
      <p>Questions? Want to get involved? Reach out at <a href="mailto:{email}">{email}</a>.</p>
      <p>
        <a href="../calendar.html" class="btn btn-secondary" style="margin-right:0.75rem;">See Upcoming Events</a>
        <a href="mailto:{email}" class="btn btn-outline">Email {name}</a>
      </p>
    </div>

  </main>

  <div id="site-footer-placeholder"></div>

  <script src="../js/hubs.js"></script>
  <script src="../js/components.js"></script>
  <script src="../js/main.js"></script>
</body>
</html>
"""

STATUS_LABELS = {"active": "✅ Active", "forming": "🟠 Forming", "inactive": "⚪ Not yet staffed"}


def build_info_grid(args):
    items = [("Status", STATUS_LABELS[args.status])]
    if args.metric_value:
        items.append((args.metric_label, args.metric_value))
    items.append(("Contact", '<a href="mailto:%s">%s</a>' % (args.email, args.email)))

    rows = "\n".join(
        '        <div class="hub-info-item">\n'
        '          <div class="label">%s</div>\n'
        '          <div class="value">%s</div>\n'
        '        </div>' % (label, value)
        for label, value in items
    )
    return '      <div class="hub-info-grid">\n%s\n      </div>\n' % rows


def render_body(node):
    """Serializes the cleaned content at the template's indentation."""
    out = []
    first_h2 = True
    for child in node.children:
        if getattr(child, "name", None) is None:
            if str(child).strip():
                out.append("      <p>%s</p>" % str(child).strip())
            continue
        if child.name == "h2":
            if first_h2:
                first_h2 = False
            elif "mt-3" not in (child.get("class") or []):
                child["class"] = "mt-3"
        out.append("      " + str(child))
    return "\n\n".join(out)


# --------------------------------------------------------------------------
# Registry
# --------------------------------------------------------------------------

def load_registry():
    with open(REGISTRY, encoding="utf-8") as fh:
        return json.load(fh)


def upsert_registry(args, dry_run):
    data = load_registry()
    hubs = data.get("hubs", [])

    entry = {
        "slug": args.slug,
        "name": args.name,
        "blurb": args.blurb,
        "status": args.status,
    }
    if args.metric_value:
        entry["metricLabel"] = args.metric_label
        entry["metricValue"] = args.metric_value

    existing = next((h for h in hubs if h.get("slug") == args.slug), None)
    if existing:
        existing.update(entry)
        action = "updated"
    else:
        hubs.append(entry)
        action = "added"

    hubs.sort(key=lambda h: h.get("name", "").lower())
    data["hubs"] = hubs

    if not dry_run:
        with open(REGISTRY, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
    return action


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--slug", required=True, help="URL slug, e.g. 'fremont'")
    p.add_argument("--name", help="Display name (default: derived from the page title)")

    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--wxr", help="WordPress export XML for this subsite")
    src.add_argument("--html", help="Local HTML file of the rendered page")
    src.add_argument("--url", help="Live URL of the hub page")

    p.add_argument("--wxr-post", help="Which page in the export to use (slug or post ID)")
    p.add_argument("--list-posts", action="store_true", help="List pages in the export and exit")
    p.add_argument("--uploads", help="Local wp-content/uploads dir (avoids downloading)")
    p.add_argument("--selector", help="CSS selector for the content area")
    p.add_argument("--drop-text", action="append", default=[], metavar="REGEX",
                   help="Drop any paragraph/heading whose text matches this regex. Repeatable.")

    p.add_argument("--blurb", help="One-line description for the hub card")
    p.add_argument("--tagline", help="Line shown under the page title")
    p.add_argument("--status", choices=list(STATUS_LABELS), default="active")
    p.add_argument("--metric-label", default="Volunteers")
    p.add_argument("--metric-value", help="e.g. '18', or the hub count")
    p.add_argument("--email", default="info@seattleemergencyhubs.org")

    p.add_argument("--max-image-width", type=int, default=1200)
    p.add_argument("--jpeg-quality", type=int, default=82)
    p.add_argument("--force", action="store_true", help="Overwrite an existing page")
    p.add_argument("--dry-run", action="store_true", help="Report without writing")
    args = p.parse_args()

    # ---- source ----
    base_url = args.url or ""
    if args.wxr:
        items = list(wxr_items(args.wxr))
        if args.list_posts:
            for it in items:
                print("%-6s %-10s %-28s %s" % (it["id"], it["type"], it["slug"], it["title"]))
            return
        item = pick_wxr_item(items, args.wxr_post)
        print("Using export page: %s (slug=%s, id=%s)" % (item["title"], item["slug"], item["id"]))
        # WXR stores raw post content, not a full document; wrap it so the
        # content-area lookup below has something to match.
        html = "<html><body><div class='entry-content'>%s</div></body></html>" % item["html"]
        page_title = item["title"]
        base_url = item["link"]
    elif args.html:
        with open(args.html, "rb") as fh:
            html = fh.read()
        page_title = ""
    else:
        html = fetch_url(args.url)
        page_title = ""

    node, doc_title = extract_content(html, args.selector)
    page_title = page_title or doc_title

    args.name = args.name or page_title or args.slug.replace("-", " ").title() + " Hub"
    args.blurb = args.blurb or "Seattle Emergency Hub serving the %s area." % args.name

    dest = os.path.join(REPO_ROOT, "hubs", "%s.html" % args.slug)
    if os.path.exists(dest) and not args.force and not args.dry_run:
        sys.exit("hubs/%s.html already exists. Pass --force to overwrite it." % args.slug)

    # ---- transform ----
    clean_content(node)
    dropped = strip_template_artifacts(node, args.drop_text)
    normalize_text(node)
    registry_slugs = {h.get("slug") for h in load_registry().get("hubs", [])}
    link_report = process_links(node, base_url, registry_slugs)
    image_report = process_images(
        node, args.slug, base_url, args.uploads,
        args.max_image_width, args.jpeg_quality, args.dry_run,
    )

    body = render_body(node)
    tagline = ('      <p class="post-meta" style="margin-bottom:1.5rem;">%s</p>\n' % args.tagline
               if args.tagline else "")

    page = PAGE_TEMPLATE.format(
        name=args.name,
        description="%s – %s" % (args.name, args.blurb),
        tagline=tagline,
        info_grid=build_info_grid(args),
        body=body,
        email=args.email,
    )

    if args.dry_run:
        print("\n--- hubs/%s.html (dry run) ---\n" % args.slug)
        print(page)
    else:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(page)

    action = upsert_registry(args, args.dry_run)

    # ---- report ----
    print("\n" + "=" * 68)
    print("Hub:      %s (%s)" % (args.name, args.slug))
    print("Page:     hubs/%s.html" % args.slug)
    print("Registry: %s content/hubs.json" % action)
    print("=" * 68)

    if image_report:
        print("\nImages (%d):" % len(image_report))
        for note, url, name in image_report:
            print("  [%s] %s" % (note, name))
            if note in ("UNAVAILABLE", "UNREADABLE"):
                print("        source: %s" % url)

    if dropped:
        print("\nDropped as theme scaffolding (%d):" % len(dropped))
        for text in dropped:
            print("  %r" % (text[:80],))

    missing_alt = [i for i in node.find_all("img") if not i.get("alt")]
    print("\nTO DO before publishing:")
    if missing_alt:
        print("  - Write alt text for %d image(s): %s"
              % (len(missing_alt), ", ".join(os.path.basename(i["src"]) for i in missing_alt)))
    if link_report:
        print("  - %d link(s) still point at the old site:" % len(link_report))
        for _, url, text in link_report:
            print("      %s  (%r)" % (url, text))
    print("  - Read the page top to bottom: heading order and section flow are")
    print("    a judgement call the script does not make.")
    print("  - Check content/hubs.json: status, blurb, and the metric tile.")
    print("  - Cross-check hub locations and captains against data/hubs.kml.")


if __name__ == "__main__":
    main()
