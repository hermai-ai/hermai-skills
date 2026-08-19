#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(skillRoot, "assets/test-pack/v1");
const fixtureManifest = JSON.parse(await readFile(resolve(fixtureRoot, "manifest.json"), "utf8"));
const TEST_PACK = fixtureManifest.brands;

const QUICK_PACK_IDS = new Set([
  "hubspot-vivid-bright",
  "discord-dark-theme",
  "casper-near-white", "nytimes-long-name", "berkshirehathaway-no-logo",
]);

// Spelled out gallery counts for the pack sizes the bundled test pack
// actually ships, so the generated gallery heading names the real rendered
// count instead of a leftover number from an earlier pack size. Any other
// count, such as a partial developer selection, falls back to the numeral.
const COUNT_WORDS = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve" };

const projectRoot = resolve(process.cwd());
const parseArgs = (args) => {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) continue;
    result[value.slice(2)] = args[index + 1]?.startsWith("--") || args[index + 1] === undefined ? true : args[++index];
  }
  return result;
};
const safeProjectPath = (value, purpose) => {
  if (typeof value !== "string" || !value) throw new Error(`${purpose} is required`);
  const target = resolve(projectRoot, value);
  const path = relative(projectRoot, target);
  if (isAbsolute(value) || path === ".." || path.startsWith(`..${sep}`)) throw new Error(`${purpose} must stay in the current repository`);
  return target;
};
const safeHermaiPath = (value, purpose) => {
  if (typeof value !== "string" || !value.startsWith(".hermai/") || value.includes("..")) throw new Error(`${purpose} must stay under .hermai/`);
  return safeProjectPath(value, purpose);
};
const readOptional = async (path) => { try { return await readFile(path, "utf8"); } catch { return null; } };
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

// Selector name vocabulary shared by the CSS module classifier below and the
// semantic status guard in validateHarness. A selector that matches this
// pattern is treated as protected status meaning, such as a profit and loss
// or danger and success indicator, and is kept out of the brand token
// classification buckets even when its color would otherwise look bucketable.
const SEMANTIC_STATUS_NAME_PATTERN = /danger|negative|decline|loss|debit|error|critical|fail|block|overdue|destructive|alert|warning|success|positive|gain|profit|credit|healthy|complete|approved|ontrack|passed/i;
const DANGER_NAME_PATTERN = /danger|negative|decline|loss|debit|error|critical|fail|block|overdue|destructive|alert/i;
const SUCCESS_NAME_PATTERN = /success|positive|gain|profit|credit|healthy|complete|approved|ontrack|passed/i;

// Bounds for the CSS module glob so a large repository cannot make inspect
// slow or expensive. These caps are intentionally small; inspect only needs
// enough signal to prove real tokens exist, not a full catalog.
// Kept low enough that even a fully module styled app stays under the 20
// entry cap validateConfig enforces on config.source.files, alongside the
// route and global style candidates inspect already collects.
const MAX_MODULE_CSS_FILES = 10;
const MAX_MODULE_CSS_BYTES = 200_000;
const MAX_MODULE_CSS_DIRECTORIES = 400;
const SKIP_DIRECTORY_NAMES = new Set(["node_modules", ".git", ".next", ".turbo", ".hermai", ".vercel", "dist", "build", "coverage", "out"]);

// Word boundary match, not a bare substring test. A bare /app/i test used to
// match any directory whose name merely contains the three letters "app",
// such as a Next.js route group named "(use-page-wrapper)" or "(booking-page-wrapper)"
// (both real directory names in a production Next.js monorepo), which
// produced junk routes while the real dashboard route sat elsewhere. Word
// boundaries still match the real, common conventions: "(dashboard)",
// "(app)", "app.dub.co", and a plural "workspaces" segment.
const ROUTE_NAME_PATTERN = /\b(?:dashboard|workspace|workspaces|app|apps)\b/i;

// Render file names inspect looks for once a route directory is identified.
// Earlier versions only looked for page.tsx/page.jsx/index.tsx/index.jsx, so
// a directory whose only direct child was layout.tsx, the file that owns the
// sidebar, logo, and nav chrome the skill exists to brand, reported zero
// source candidates even though the real identity surfaces sat one file
// away. layout.tsx/jsx now count too.
const ROUTE_FILE_NAMES = ["page.tsx", "page.jsx", "layout.tsx", "layout.jsx", "index.tsx", "index.jsx"];

// Real production Next.js apps almost always nest the actual dashboard page
// (and its layout) below the matched directory, not directly inside it: a
// route group directory commonly wraps a dynamic segment or a nested
// sub-route, e.g. "(dashboard)/[slug]/layout.tsx" or "(dashboard)/overview/page.tsx".
// A single fixed-depth check therefore found nothing in every real app tested
// against this skill (dub, cal.com, formbricks, openstatus all matched a
// directory name but reported an empty file list). This does one bounded
// level of descent into a matched directory's own subdirectories, skipping
// the same noise directories the CSS module glob already skips, and stops as
// soon as it has enough files so a large route tree cannot make inspect slow.
const MAX_ROUTE_DESCENT_DIRECTORIES = 60;
const MAX_ROUTE_FILES_PER_MATCH = 4;

async function findRouteFiles(directory) {
  const found = [];
  for (const filename of ROUTE_FILE_NAMES) {
    if (found.length >= MAX_ROUTE_FILES_PER_MATCH) return found;
    const path = resolve(directory, filename);
    if (await readOptional(path)) found.push(path);
  }
  if (found.length) return found;
  // Nothing directly inside the matched directory. Descend one bounded level
  // to catch the common "(dashboard)/overview/page.tsx" and
  // "(dashboard)/[slug]/layout.tsx" shapes real apps use.
  const queue = [directory];
  let visited = 0;
  while (queue.length && visited < MAX_ROUTE_DESCENT_DIRECTORIES && found.length < MAX_ROUTE_FILES_PER_MATCH) {
    const current = queue.shift();
    visited += 1;
    const entries = await readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRECTORY_NAMES.has(entry.name)) {
        queue.push(resolve(current, entry.name));
        continue;
      }
      if (entry.isFile() && ROUTE_FILE_NAMES.includes(entry.name)) {
        found.push(resolve(current, entry.name));
        if (found.length >= MAX_ROUTE_FILES_PER_MATCH) break;
      }
    }
  }
  return found;
}

// Fallback for frameworks that route by file name rather than by directory
// name, such as React Router v7 / Remix flat routes (a real dashboard route
// there is a flat file like "app/routes/_authenticated+/dashboard.tsx", with
// no directory anywhere named "dashboard"). Only runs when the directory
// based pass above found nothing, and is bounded the same way the CSS module
// glob is bounded so a large route tree cannot make inspect slow.
const MAX_FLAT_ROUTE_DIRECTORIES = 400;
const MAX_FLAT_ROUTE_FILES = 6;
const FLAT_ROUTE_NAME_PATTERN = /(?:^|[._+/-])(?:dashboard|workspace)(?:[._+/-]|$)/i;

async function findFlatRouteFiles(rootDirectory) {
  const found = [];
  const queue = [rootDirectory];
  let visited = 0;
  while (queue.length && found.length < MAX_FLAT_ROUTE_FILES && visited < MAX_FLAT_ROUTE_DIRECTORIES) {
    const directory = queue.shift();
    visited += 1;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORY_NAMES.has(entry.name)) queue.push(resolve(directory, entry.name));
        continue;
      }
      if (entry.isFile() && /\.(?:tsx|jsx)$/.test(entry.name) && FLAT_ROUTE_NAME_PATTERN.test(entry.name)) {
        found.push(resolve(directory, entry.name));
        if (found.length >= MAX_FLAT_ROUTE_FILES) break;
      }
    }
  }
  return found;
}

async function findModuleCssFiles(rootDirectory) {
  const found = [];
  const queue = [rootDirectory];
  let visitedDirectories = 0;
  while (queue.length && found.length < MAX_MODULE_CSS_FILES && visitedDirectories < MAX_MODULE_CSS_DIRECTORIES) {
    const directory = queue.shift();
    visitedDirectories += 1;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORY_NAMES.has(entry.name)) queue.push(resolve(directory, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".module.css")) found.push(resolve(directory, entry.name));
      if (found.length >= MAX_MODULE_CSS_FILES) break;
    }
  }
  return found;
}

// CSS modules rarely name a custom property, so there is no "--primary"
// style identifier to pattern match the way the four fixed style paths
// allow. Instead this classifies each rule by its own selector name and
// keeps the same four token buckets, storing a selector plus value
// description in place of a variable name. Selectors that look like a
// protected status color are skipped so a real profit and loss color never
// gets offered up as a brand token candidate.
const MODULE_COLOR_PROPERTIES = new Set(["color", "background-color", "background", "border-color", "fill", "stroke", "outline-color"]);
const MODULE_HEX_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
// Strip block comments before any rule regex runs. A selector otherwise
// picks up the free text of a preceding comment, such as a note that a rule
// carries fixed profit and loss meaning, and that free text can accidentally
// satisfy or defeat the name pattern checks below.
const stripCssComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, " ");

function classifyModuleCssColors(contents, tokens) {
  for (const [, selectorRaw, body] of stripCssComments(contents).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = selectorRaw.trim();
    if (!selector || SEMANTIC_STATUS_NAME_PATTERN.test(selector)) continue;
    let backgroundHex = null;
    let textHex = null;
    for (const [, property, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)) {
      const propertyName = property.trim().toLowerCase();
      if (!MODULE_COLOR_PROPERTIES.has(propertyName)) continue;
      const match = value.match(MODULE_HEX_COLOR_PATTERN);
      if (!match) continue;
      if (propertyName === "background-color" || propertyName === "background") backgroundHex = match[0];
      if (propertyName === "color") textHex = match[0];
    }
    if (!backgroundHex && !textHex) continue;
    const normalized = selector.toLowerCase();
    if (!tokens.primary && backgroundHex && /button|btn|cta|submit|primary|brand/.test(normalized)) tokens.primary = `${selector} (background-color: ${backgroundHex})`;
    if (!tokens.onPrimary && textHex && /button|btn|cta|submit|primary|brand/.test(normalized)) tokens.onPrimary = `${selector} (color: ${textHex})`;
    if (!tokens.accent && (backgroundHex || textHex) && /link|anchor|accent|focus/.test(normalized)) tokens.accent = `${selector} (${backgroundHex ? "background-color" : "color"}: ${backgroundHex ?? textHex})`;
    if (!tokens.subtle && backgroundHex && /muted|tint|subtle|badge|chip|pill/.test(normalized)) tokens.subtle = `${selector} (background-color: ${backgroundHex})`;
  }
}

async function inspect() {
  const manifest = JSON.parse((await readOptional(resolve(projectRoot, "package.json"))) ?? "{}");
  const dependencies = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
  const framework = dependencies.next ? "next" : dependencies.vite && dependencies.react ? "vite-react" : dependencies.react ? "react" : "unknown";
  const candidates = framework === "next" ? ["src/app", "app", "src/pages", "pages"] : ["src", "app"];
  const routes = [];
  const sourceCandidates = [];
  for (const candidate of candidates) {
    const directory = resolve(projectRoot, candidate);
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || !ROUTE_NAME_PATTERN.test(entry.name)) continue;
      routes.push(`/${entry.name}`);
      const routeFiles = await findRouteFiles(resolve(directory, entry.name));
      for (const path of routeFiles) sourceCandidates.push(relative(projectRoot, path));
    }
  }
  // Directory naming conventions miss file-based routers entirely, such as
  // React Router v7 / Remix flat routes, where a real dashboard route is a
  // flat file (app/routes/_authenticated+/dashboard.tsx) and no directory is
  // ever named "dashboard". Only run this bounded fallback scan when the
  // pass above found nothing, so a normal Next.js app never pays for it.
  if (!sourceCandidates.length) {
    for (const candidate of candidates) {
      const found = await findFlatRouteFiles(resolve(projectRoot, candidate)).catch(() => []);
      for (const path of found) {
        sourceCandidates.push(relative(projectRoot, path));
        routes.push(`/${basename(path).replace(/\.(?:tsx|jsx)$/, "")}`);
      }
      if (sourceCandidates.length) break;
    }
  }
  const styles = [
    "src/app/globals.css", "app/globals.css", "src/index.css", "src/styles.css",
    "styles/globals.css", "src/styles/globals.css", "app/styles/globals.css",
    "src/app/global.css", "src/global.css",
  ];
  const tokens = {};
  const unclassifiedColorTokens = [];
  for (const style of styles) {
    const contents = await readOptional(resolve(projectRoot, style));
    if (!contents) continue;
    sourceCandidates.push(style);
    for (const match of contents.matchAll(/(--[A-Za-z_][A-Za-z0-9_-]*)\s*:\s*([^;]+);/g)) {
      const name = match[1];
      const value = match[2].trim();
      const normalized = name.toLowerCase();
      let classified = false;
      if (!tokens.primary && /(?:primary|brand)(?!.*(?:text|surface|background))/.test(normalized)) { tokens.primary = name; classified = true; }
      if (!tokens.onPrimary && /on.*(?:primary|accent)|(?:primary|accent).*foreground/.test(normalized)) { tokens.onPrimary = name; classified = true; }
      if (!tokens.accent && /accent|link|focus/.test(normalized)) { tokens.accent = name; classified = true; }
      if (!tokens.subtle && /subtle|muted|tint/.test(normalized)) { tokens.subtle = name; classified = true; }
      // The four buckets above only recognize a handful of naming
      // conventions (primary, brand, accent, focus, subtle, muted, tint).
      // A real app is free to name its action color anything, such as a
      // "--cta" token. Rather than guess more names into the hard regexes,
      // surface any other custom property that carries a literal color
      // value as an unclassified candidate so a human or agent reviewing
      // the inspect output can still find it and decide by hand. Bounded to
      // a handful of entries so a large design token file stays readable.
      if (!classified && unclassifiedColorTokens.length < 8 && /^#[0-9a-fA-F]{3,8}\b|^rgba?\(|^hsla?\(/.test(value)) {
        unclassifiedColorTokens.push(name);
      }
    }
  }
  if (unclassifiedColorTokens.length) tokens.unclassified = [...new Set(unclassifiedColorTokens)];
  // The four paths above are blind to CSS modules, so an app styled entirely
  // with *.module.css files reported an empty tokens object even though it
  // has real colors. Glob module files under the same candidate roots,
  // bounded by file count and bytes read, and classify by selector name
  // since CSS modules have no custom property name to pattern match.
  let moduleCssBytesRead = 0;
  const moduleCssFiles = [];
  for (const candidate of candidates) {
    const found = await findModuleCssFiles(resolve(projectRoot, candidate)).catch(() => []);
    moduleCssFiles.push(...found);
  }
  for (const file of [...new Set(moduleCssFiles)].slice(0, MAX_MODULE_CSS_FILES)) {
    if (moduleCssBytesRead >= MAX_MODULE_CSS_BYTES) break;
    const contents = await readOptional(file);
    if (!contents) continue;
    moduleCssBytesRead += Buffer.byteLength(contents, "utf8");
    sourceCandidates.push(relative(projectRoot, file));
    classifyModuleCssColors(contents, tokens);
  }
  return {
    version: 2,
    root: projectRoot,
    framework,
    routes: [...new Set(routes.length ? routes : ["/dashboard"])],
    sourceCandidates: [...new Set(sourceCandidates)],
    tokens,
    excluded: [".env", ".git", "node_modules", "browser profiles"],
    runtimeRequired: false,
  };
}

const defaultHarness = (appName) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(appName)} dashboard preview</title>
  <style>
    :root { --hermai-brand:#202020; --hermai-on-brand:#fff; --hermai-text-accent:#202020; --hermai-tint:#f3f3f3; --hermai-accent:#e5e5e5; --hermai-border:#dedbd6; --hermai-focus:#202020; --hermai-data-primary:#202020; }
    * { box-sizing:border-box; }
    body { margin:0; color:#171717; background:#f7f7f5; font:15px/1.45 ui-sans-serif,system-ui,sans-serif; }
    .shell { display:grid; grid-template-columns:210px 1fr; min-height:720px; background:#fff; }
    aside { padding:24px 18px; border-right:1px solid #e7e5e4; background:#fafaf9; }
    .identity { display:flex; align-items:center; gap:10px; min-width:0; font-weight:700; }
    [data-hermai-logo] { display:flex; min-width:0; height:36px; align-items:center; flex:none; }
    .hermai-logo-image { display:block; max-width:156px; max-height:36px; object-fit:contain; object-position:left center; }
    .hermai-logo-compact { width:30px; height:30px; }
    [data-hermai-company] { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    nav { display:grid; gap:4px; margin-top:30px; }
    nav span { padding:9px 10px; border-radius:8px; color:#57534e; }
    nav .active { color:#171717; background:var(--hermai-tint); box-shadow:inset 3px 0 var(--hermai-brand); }
    main { padding:30px; }
    header { display:flex; align-items:center; justify-content:space-between; gap:24px; }
    h1 { margin:0; font-size:28px; letter-spacing:-.03em; }
    .muted { color:#78716c; }
    button { min-height:42px; border:0; border-radius:10px; padding:0 18px; color:var(--hermai-on-brand); background:var(--hermai-brand); font:inherit; font-weight:700; }
    .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:28px; }
    .card { border:1px solid var(--hermai-border); border-radius:14px; padding:18px; background:#fff; }
    .value { margin-top:10px; font-size:26px; font-weight:750; }
    .bar { width:62%; height:7px; margin-top:13px; border-radius:999px; background:var(--hermai-data-primary); }
    .context { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:20px; border:1px solid var(--hermai-border); border-radius:14px; padding:13px 16px; background:var(--hermai-tint); }
    .context strong { display:block; }
    .tabs { display:flex; gap:18px; margin-top:24px; border-bottom:1px solid #e7e5e4; }
    .tabs span { padding:0 2px 10px; color:#78716c; }
    .tabs .active { color:#171717; border-bottom:3px solid var(--hermai-brand); font-weight:700; }
    .table { margin-top:14px; }
    .row { display:grid; grid-template-columns:1.3fr .8fr .7fr; gap:12px; padding:13px 0; border-top:1px solid #eee; }
    .badge { width:max-content; border-radius:999px; padding:4px 9px; color:#292524; background:var(--hermai-tint); }
    a { color:var(--hermai-text-accent); font-weight:700; }
    button:focus-visible, a:focus-visible { outline:3px solid var(--hermai-focus); outline-offset:3px; }
    .dark-identity { display:flex; align-items:center; gap:12px; margin-top:18px; padding:14px 16px; border-radius:12px; background:#171717; color:#fff; }
    @media (max-width:700px) { .shell { grid-template-columns:1fr; } aside { display:none; } main { padding:20px; } .stats { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="identity"><span data-hermai-logo>{{HERMAI_LOGO_COMPACT}}</span><span data-hermai-company>{{HERMAI_COMPANY_NAME}}</span></div>
      <nav aria-label="Dashboard navigation"><span class="active">Overview</span><span>Customers</span><span>Usage</span><span>Settings</span></nav>
    </aside>
    <main>
      <header><div><h1>Good morning, Alex</h1><div class="muted">Here is what is happening today.</div></div><button>Invite teammate</button></header>
      <section class="context"><div><span data-hermai-logo>{{HERMAI_LOGO_STANDARD}}</span><span class="muted">Customer dashboard</span></div><a href="#activity">View account</a></section>
      <div class="tabs" aria-label="Dashboard sections"><span class="active">Overview</span><span>Activity</span><span>Reports</span></div>
      <section class="stats"><div class="card"><div class="muted">Active users</div><div class="value">1,284</div><div class="bar"></div></div><div class="card"><div class="muted">Usage</div><div class="value">74%</div><div class="bar"></div></div><div class="card"><div class="muted">Open tasks</div><div class="value">18</div><div class="bar"></div></div></section>
      <section class="card table"><h2>Recent activity</h2><div class="row muted"><span>Customer</span><span>Status</span><span>Updated</span></div><div class="row"><span>Product launch</span><span class="badge">On track</span><span>Today</span></div><div class="row"><span>Quarterly review</span><span class="badge">Ready</span><span>Yesterday</span></div></section>
      <section class="dark-identity"><span data-hermai-logo>{{HERMAI_LOGO_ON_DARK}}</span><span>Dark identity placement</span></section>
    </main>
  </div>
</body>
</html>`;

async function init(args) {
  const inspection = await inspect();
  const brands = args.pack === "full" ? TEST_PACK : TEST_PACK.filter(({ id }) => QUICK_PACK_IDS.has(id));
  const configPath = safeHermaiPath(typeof args.config === "string" ? args.config : ".hermai/brand-preview.json", "Preview configuration");
  const harnessPath = safeHermaiPath(typeof args.harness === "string" ? args.harness : ".hermai/brand-preview-harness.html", "Preview harness");
  const manifest = JSON.parse((await readOptional(resolve(projectRoot, "package.json"))) ?? "{}");
  const config = {
    version: 2,
    source: { framework: inspection.framework, route: inspection.routes[0], files: inspection.sourceCandidates },
    harness: relative(projectRoot, harnessPath),
    output: ".hermai/brand-preview",
    brands: brands.map(({ id, label }) => ({ id, label })),
  };
  await mkdir(resolve(configPath, ".."), { recursive: true });
  await writeFile(resolve(projectRoot, ".hermai/.gitignore"), "*\n", { flag: "wx" }).catch((error) => {
    if (error?.code !== "EEXIST") throw error;
  });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
  await writeFile(harnessPath, defaultHarness(manifest.displayName ?? manifest.name ?? "Your app"), { flag: "wx" });
  return { config: relative(projectRoot, configPath), harness: relative(projectRoot, harnessPath), preview: config };
}

function validateConfig(config) {
  if (config?.version !== 2 || !config.source || typeof config.output !== "string" || typeof config.harness !== "string") throw new Error("Preview configuration is invalid");
  safeHermaiPath(config.output, "Preview output");
  safeHermaiPath(config.harness, "Preview harness");
  if (typeof config.source.route !== "string" || !config.source.route.startsWith("/")) throw new Error("Source route must begin with /");
  if (!Array.isArray(config.source.files) || config.source.files.length > 20) throw new Error("Source files must be a short project relative list");
  for (const file of config.source.files) {
    const path = relative(projectRoot, safeProjectPath(file, "Source file"));
    if (/(^|\/)(?:\.env|\.git|node_modules)(?:\/|$)/.test(path)) throw new Error("Source files include a protected path");
  }
  const validBrandIds = new Set(TEST_PACK.map(({ id }) => id));
  if (!Array.isArray(config.brands) || config.brands.length === 0 || config.brands.some(({ id }) => !validBrandIds.has(id))) throw new Error("Preview brands must use the bundled test pack");
  return config;
}

function validateHarness(contents) {
  if (Buffer.byteLength(contents, "utf8") > 750_000) throw new Error("Preview harness must be smaller than 750 KB");
  if (/<\s*(?:script|iframe|object|embed|form|base)\b/i.test(contents)) throw new Error("Preview harness cannot contain scripts, frames, forms, or embedded objects");
  if (/(?:https?:)?\/\//i.test(contents)) throw new Error("Preview harness cannot load remote resources");
  if (!/data-hermai-company/i.test(contents) || !contents.includes("{{HERMAI_COMPANY_NAME}}")) throw new Error("Preview harness must mark the company name placeholder");
  for (const slot of ["{{HERMAI_LOGO_STANDARD}}", "{{HERMAI_LOGO_COMPACT}}", "{{HERMAI_LOGO_ON_DARK}}"]){
    if (!contents.includes(slot)) throw new Error(`Preview harness must include ${slot}`);
  }
  for (const token of ["--hermai-brand", "--hermai-on-brand", "--hermai-text-accent", "--hermai-tint", "--hermai-border", "--hermai-focus", "--hermai-data-primary"]) {
    if (!contents.includes(token)) throw new Error(`Preview harness must use ${token}`);
  }
  if (/code\s*\{[^}]*var\(--hermai-/is.test(contents)) throw new Error("Preview code and keys must keep neutral readable colors");
  return contents;
}

function logoMarkup(brand, slot) {
  const identity = brand.application_theme.identity[slot];
  if (identity?.asset) {
    return `<img class="hermai-logo-image hermai-logo-${slot}" src="assets/${escapeHtml(basename(identity.asset))}" alt="${escapeHtml(brand.name)} logo">`;
  }
  if (identity?.fallback === "company_name") return `<span class="hermai-logo-company">${escapeHtml(brand.name)}</span>`;
  return `<span class="hermai-logo-monogram" aria-label="${escapeHtml(brand.name)} logo unavailable">${escapeHtml(brand.name.slice(0, 1))}</span>`;
}

function themeCss(brand) {
  const theme = brand.application_theme;
  if (theme.mode === "fallback") {
    return `<style id="hermai-brand-theme">body::before{content:"Fallback applied · host theme preserved";position:fixed;z-index:9999;right:16px;top:16px;padding:7px 11px;border:1px solid rgba(0,0,0,.12);border-radius:999px;color:#7c2d12;background:#fff7ed;font:700 12px/1.2 system-ui;box-shadow:0 4px 16px rgba(0,0,0,.08)}</style>`;
  }
  const c = theme.colors;
  return `<style id="hermai-brand-theme">:root{--hermai-brand:${c.action};--hermai-on-brand:${c.on_action};--hermai-text-accent:${c.text_accent};--hermai-tint:${c.tint};--hermai-on-tint:${c.on_tint};--hermai-border:${c.border};--hermai-focus:${c.focus};--hermai-data-primary:${c.data_primary}}body::before{content:"${escapeHtml(brand.scenario)}";position:fixed;z-index:9999;right:16px;top:16px;padding:7px 11px;border:1px solid rgba(0,0,0,.12);border-radius:999px;color:#171717;background:rgba(255,255,255,.94);font:700 12px/1.2 system-ui;box-shadow:0 4px 16px rgba(0,0,0,.08)}</style>`;
}

function applyBrand(harness, brand) {
  let result = harness.replace(/<\/head>/i, `${themeCss(brand)}</head>`);
  result = result.replaceAll("{{HERMAI_COMPANY_NAME}}", escapeHtml(brand.name));
  result = result.replaceAll("{{HERMAI_LOGO_STANDARD}}", logoMarkup(brand, "standard"));
  result = result.replaceAll("{{HERMAI_LOGO_COMPACT}}", logoMarkup(brand, "compact"));
  result = result.replaceAll("{{HERMAI_LOGO_ON_DARK}}", logoMarkup(brand, "on_dark"));
  return result;
}

function rgb(hex) {
  const value = String(hex ?? "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`Invalid color token ${hex}`);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * r + .7152 * g + .0722 * b;
}

function contrast(first, second) {
  const [a, b] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (a + .05) / (b + .05);
}

function hueAndSaturation(hex) {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0 };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return { hue, saturation };
}

// A general check is impossible without understanding the app, so this is a
// tractable heuristic, not a guarantee. It cannot recover the literal color a
// binding replaced, since a token reference such as var(--hermai-brand)
// carries no color of its own by the time the harness reaches validation.
// Instead it treats the selector name as the signal (amountPositive,
// changeNegative, and similar read as status meaning) and reports a
// representative reference color for that status family, reusing the exact
// green and red the corrected fintech ledger harness keeps hardcoded, so the
// warning names a real, plausible original rather than an invented one.
const DANGER_REFERENCE_HEX = "#c0281c";
const SUCCESS_REFERENCE_HEX = "#1a7f37";
const HUE_BAND_SATURATION_FLOOR = 0.35;
const isDangerHue = ({ hue, saturation }) => saturation >= HUE_BAND_SATURATION_FLOOR && (hue <= 15 || hue >= 345);
const isSuccessHue = ({ hue, saturation }) => saturation >= HUE_BAND_SATURATION_FLOOR && hue >= 90 && hue <= 150;
const BINDING_COLOR_PROPERTIES = new Set(["color", "background-color", "background", "border-color", "fill", "stroke", "outline-color"]);

function detectSemanticColorRisks(harnessContents) {
  const styleMatch = harnessContents.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return [];
  const warnings = [];
  for (const [, selectorRaw, body] of stripCssComments(styleMatch[1]).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = selectorRaw.trim();
    if (!selector) continue;
    for (const [, property, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)) {
      const propertyName = property.trim().toLowerCase();
      if (!BINDING_COLOR_PROPERTIES.has(propertyName)) continue;
      const tokenMatch = value.trim().match(/^var\(\s*(--hermai-[a-z-]+)\s*\)$/i);
      if (!tokenMatch) continue;
      const isDangerName = DANGER_NAME_PATTERN.test(selector);
      const isSuccessName = SUCCESS_NAME_PATTERN.test(selector);
      if (!isDangerName && !isSuccessName) continue;
      const referenceHex = isDangerName ? DANGER_REFERENCE_HEX : SUCCESS_REFERENCE_HEX;
      const family = isDangerName ? "danger red" : "success green";
      const bands = isDangerName ? isDangerHue(hueAndSaturation(referenceHex)) : isSuccessHue(hueAndSaturation(referenceHex));
      if (!bands) continue;
      warnings.push(`WARNING: the binding "${selector} { ${propertyName}: var(${tokenMatch[1]}) }" rebrands a selector whose name reads as a ${family} status color, close to reference color ${referenceHex}. Semantic status colors such as profit, loss, danger, and success must not be rebranded. Confirm this binding is not a status color before shipping this harness.`);
    }
  }
  return warnings;
}

// Same parent container identity duplication guard. The fintech ledger testbed once
// stacked a compact logo, a standard logo, and a company name span inside one
// identity div, so the header rendered the mark and the customer name twice
// side by side. This is a heuristic warning, not a hard error, because a
// lightweight tag walk cannot fully understand arbitrary markup the way a
// real DOM would. Treat it as a prompt to check the placement by hand.
const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const LOGO_SLOT_TOKENS = [
  ["{{HERMAI_LOGO_STANDARD}}", "standard"],
  ["{{HERMAI_LOGO_COMPACT}}", "compact"],
  ["{{HERMAI_LOGO_ON_DARK}}", "on dark"],
];

// A data-hermai-logo span carries no variant name of its own; the slot it
// renders only shows up as a placeholder token somewhere inside it. Look
// ahead a bounded window from the attribute match for the nearest of the
// three tokens and use that as the variant label.
function nextLogoSlotVariant(scanText, fromIndex) {
  const window = scanText.slice(fromIndex, fromIndex + 400);
  let nearest = null;
  for (const [token, label] of LOGO_SLOT_TOKENS) {
    const at = window.indexOf(token);
    if (at !== -1 && (nearest === null || at < nearest.at)) nearest = { at, label };
  }
  return nearest?.label ?? "unspecified variant";
}

function detectIdentityContainerRisks(harnessContents) {
  // Blank out style blocks so a CSS attribute selector such as
  // [data-hermai-logo] can never be misread as an HTML tag, while keeping
  // every other character position unchanged.
  const scan = harnessContents.replace(/<style[\s\S]*?<\/style>/gi, (block) => " ".repeat(block.length));
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  const warnings = [];
  const reportContainer = (container) => {
    const bindings = container.bindings;
    if (bindings.length < 2) return;
    // A compact, icon only mark next to a plain company name is the ordinary
    // sidebar pattern (logo mark, then the name as text) and is not a
    // duplication risk, so that specific pair is allowed through.
    const isCompactPlusCompanyOnly = bindings.length === 2
      && bindings.some((binding) => binding.type === "logo" && binding.variant === "compact")
      && bindings.some((binding) => binding.type === "company");
    if (isCompactPlusCompanyOnly) return;
    const named = bindings.map((binding) => binding.label).join(", ");
    warnings.push(`WARNING: ${named} are bound inside the same parent container in the harness markup. Use one logo variant per placement, and put company name text only where no wordmark renders.`);
  };
  const stack = [{ name: "#document", bindings: [] }];
  let match;
  while ((match = tagPattern.exec(scan))) {
    const raw = match[0];
    const name = match[1].toLowerCase();
    const attrs = match[2] ?? "";
    if (raw.startsWith("</")) {
      for (let index = stack.length - 1; index >= 1; index -= 1) {
        if (stack[index].name === name) {
          const closed = stack.splice(index);
          reportContainer(closed[0]);
          break;
        }
      }
      continue;
    }
    const hasLogo = /data-hermai-logo\b/i.test(attrs);
    const hasCompany = /data-hermai-company\b/i.test(attrs);
    if (hasLogo || hasCompany) {
      const parent = stack[stack.length - 1];
      if (hasLogo) {
        const variant = nextLogoSlotVariant(scan, match.index + raw.length);
        parent.bindings.push({ type: "logo", variant, label: `data-hermai-logo (${variant})` });
      } else {
        parent.bindings.push({ type: "company", variant: null, label: "data-hermai-company" });
      }
    }
    const isSelfClosing = /\/\s*>$/.test(raw) || VOID_ELEMENTS.has(name);
    if (!isSelfClosing) stack.push({ name, bindings: [] });
  }
  while (stack.length > 1) reportContainer(stack.pop());
  reportContainer(stack[0]);
  return warnings;
}

// Logo assets in the bundled test pack are not uniformly pre-sized. A
// standard wordmark SVG usually ships with a small intrinsic width and
// height (HubSpot's is 106x30), but an on-dark icon mark can ship at a much
// larger native canvas (HubSpot's on-dark SVG is 800x800, meant to be scaled
// down by the harness). A harness that constrains the parent
// [data-hermai-logo] container's height but never gives the <img> itself an
// explicit max-width/max-height, an easy mistake once a harness stops using
// the shipped default template's single shared sizing rule, lets that image
// render at its native size and blow out the layout. This is a heuristic
// static check of the harness's own <style> block, not a real layout
// engine, so it can only confirm a sizing rule exists somewhere for a slot
// that is actually used; it cannot confirm the rule is tight enough. Treat
// it the same way as the other render-time guards: a prompt to check the
// rendered preview at the narrowest width by hand, not a guarantee.
const LOGO_SIZE_PROPERTIES = ["width", "height", "max-width", "max-height"];
const LOGO_SLOT_CLASS_SUFFIX = { standard: "hermai-logo-standard", compact: "hermai-logo-compact", on_dark: "hermai-logo-on_dark" };

function detectUnboundedLogoImageRisks(harnessContents) {
  const styleMatch = harnessContents.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return [];
  let hasUniversalSizing = false;
  const slotHasSizing = { standard: false, compact: false, on_dark: false };
  for (const [, selectorRaw, body] of stripCssComments(styleMatch[1]).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = selectorRaw.trim();
    if (!selector) continue;
    const declaresSize = LOGO_SIZE_PROPERTIES.some((property) => new RegExp(`(?:^|[;{\\s])${property}\\s*:`, "i").test(body));
    if (!declaresSize) continue;
    if (/\.hermai-logo-image\b/.test(selector)) hasUniversalSizing = true;
    for (const [slot, className] of Object.entries(LOGO_SLOT_CLASS_SUFFIX)) {
      if (new RegExp(`\\.${className}\\b`).test(selector)) slotHasSizing[slot] = true;
    }
  }
  if (hasUniversalSizing) return [];
  const usedSlots = [
    ["{{HERMAI_LOGO_STANDARD}}", "standard"],
    ["{{HERMAI_LOGO_COMPACT}}", "compact"],
    ["{{HERMAI_LOGO_ON_DARK}}", "on_dark"],
  ].filter(([token]) => harnessContents.includes(token));
  const warnings = [];
  for (const [, slot] of usedSlots) {
    if (slotHasSizing[slot]) continue;
    warnings.push(`WARNING: no CSS rule bounds the ${slot} logo image's width or height (no max-width/max-height or width/height on .hermai-logo-image or .${LOGO_SLOT_CLASS_SUFFIX[slot]}). A bundled logo asset can ship without a small intrinsic size and render at its native size, which can be hundreds of pixels and break the layout. Give every logo variant an explicit bound.`);
  }
  return warnings;
}

function validateTheme(brand) {
  const theme = brand.application_theme;
  if (brand.source_kind === "synthetic" && !String(brand.domain ?? "").endsWith(".test")) throw new Error(`${brand.id} synthetic fixtures must use a reserved .test domain and a fictional identity`);
  if (!["synthetic", "hermai_api_capture"].includes(brand.source_kind)) throw new Error(`${brand.id} must declare synthetic or hermai_api_capture provenance`);
  if (!theme || theme.version !== "v1") throw new Error(`${brand.id} must include application_theme v1`);
  for (const slot of ["standard", "compact", "on_dark"]) {
    if (!theme.identity?.[slot] || typeof theme.identity[slot].fallback !== "string") throw new Error(`${brand.id} is missing identity.${slot}`);
  }
  if (theme.mode === "fallback") {
    if (theme.colors !== null || theme.fallback?.strategy !== "preserve_host_theme") throw new Error(`${brand.id} fallback must preserve the host theme`);
    return { mode: "fallback", checks: ["host theme preserved", "missing logo labelled"] };
  }
  const colors = theme.colors;
  if (theme.mode !== "observed" || !colors) throw new Error(`${brand.id} must be observed or a labelled fallback`);
  if (contrast(colors.action, colors.on_action) < 4.5) throw new Error(`${brand.id} action text contrast is below 4.5:1`);
  if (contrast(colors.text_accent, "#FFFFFF") < 4.5) throw new Error(`${brand.id} text accent contrast is below 4.5:1`);
  if (contrast(colors.focus, "#FFFFFF") < 3) throw new Error(`${brand.id} focus contrast is below 3:1`);
  return { mode: "observed", checks: ["action text contrast", "text accent contrast", "focus contrast", "identity slots present"] };
}

async function render(config) {
  const harness = validateHarness(await readFile(safeHermaiPath(config.harness, "Preview harness"), "utf8"));
  const semanticColorWarnings = detectSemanticColorRisks(harness);
  for (const warning of semanticColorWarnings) console.warn(warning);
  const identityDuplicationWarnings = detectIdentityContainerRisks(harness);
  for (const warning of identityDuplicationWarnings) console.warn(warning);
  const logoSizeWarnings = detectUnboundedLogoImageRisks(harness);
  for (const warning of logoSizeWarnings) console.warn(warning);
  const output = safeHermaiPath(config.output, "Preview output");
  await mkdir(output, { recursive: true });
  const selectedBrandIds = new Set(config.brands.map(({ id }) => id));
  const selectedBrands = TEST_PACK.filter(({ id }) => selectedBrandIds.has(id));
  const entries = [];
  const assetsOutput = resolve(output, "assets");
  await mkdir(assetsOutput, { recursive: true });
  for (const brand of selectedBrands) {
    const quality = validateTheme(brand);
    for (const slot of Object.values(brand.application_theme.identity)) {
      if (slot.asset) await copyFile(resolve(fixtureRoot, slot.asset), resolve(assetsOutput, basename(slot.asset)));
    }
    const previewFile = `${brand.id}.html`;
    await writeFile(resolve(output, previewFile), applyBrand(harness, brand));
    entries.push({ id: brand.id, label: brand.scenario, name: brand.name, preview: previewFile, mode: quality.mode, source: fixtureManifest.source, quality: quality.checks, appliedSurfaces: quality.mode === "observed" ? 8 : 0 });
  }
  const report = {
    version: 2,
    offline: true,
    runtimeRequired: false,
    generatedAt: new Date().toISOString(),
    source: config.source,
    entries,
    qualityGate: { protectedSurfaces: ["API keys", "code", "semantic status", "user photos", "integration logos", "application canvas"], minimumAppliedSurfaces: 7 },
    semanticColorWarnings,
    identityDuplicationWarnings,
    logoSizeWarnings,
  };
  await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(output, "integration-plan.md"), `# Proposed brand surfaces\n\n* Apply the selected customer logo and company name in identity areas.\n* Apply the action token to primary buttons, selected navigation, active tabs, links, focus rings, progress, and one nonsemantic data series.\n* Apply the tint token to customer context cards, onboarding or empty state surfaces, nonsemantic badges, and subtle highlights.\n* Protect errors, warnings, destructive actions, semantic status colors, user photos, integration logos, ordinary text, and the application canvas.\n* Treat a labelled fallback as a valid result. Do not silently turn a missing logo or unusable accent into a fake extracted asset.\n\n## Source files reviewed\n\n${config.source.files.length ? config.source.files.map((file) => `* \`${file}\``).join("\n") : "* Add the dashboard component and style files before implementation."}\n`);
  const galleryCountWord = COUNT_WORDS[entries.length] ?? String(entries.length);
  await writeFile(resolve(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hermai brand preview</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;color:#171717;background:#f5f5f4;font:15px/1.45 ui-sans-serif,system-ui,sans-serif}main{max-width:1080px;margin:auto}header{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:24px}h1{margin:0;font-size:32px;letter-spacing:-.03em}p{margin:8px 0 0;color:#57534e}.gallery{display:grid;gap:28px}article{overflow:hidden;border:1px solid #d6d3d1;border-radius:18px;background:#fff;box-shadow:0 8px 30px rgba(28,25,23,.06)}.meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #e7e5e4}.meta small{display:block;margin-top:3px;color:#78716c;font-size:12px}.label{padding:5px 9px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:750;white-space:nowrap}.fallback{background:#fff7ed;color:#9a3412}.frame{display:block;width:100%;height:980px;border:0;background:#fff}@media(max-width:700px){body{padding:16px}header{display:block}.meta{align-items:flex-start;flex-direction:column}.frame{height:1120px}}footer.hermai-nudge{margin-top:32px;padding-top:16px;border-top:1px solid #e7e5e4;text-align:center}footer.hermai-nudge small{color:#a8a29e;font-size:12px}footer.hermai-nudge a{color:#a8a29e}</style></head><body><main><header><div><h1>${escapeHtml(galleryCountWord)} customer brand previews</h1><p>Private local contract fixtures. Scroll through each complete dashboard. No login, app runtime, API credit, source upload, or live Brand API request.</p></div><p><a href="integration-plan.md">Review the proposed brand surfaces</a></p></header><section class="gallery">${entries.map((entry) => `<article><div class="meta"><div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.source)}</small></div><span class="label ${entry.mode === "fallback" ? "fallback" : ""}">${entry.mode === "fallback" ? "Fallback applied" : escapeHtml(entry.label)}</span></div><iframe class="frame" title="${escapeHtml(entry.name)} dashboard preview" src="${escapeHtml(entry.preview)}"></iframe></article>`).join("")}</section><footer class="hermai-nudge"><small>Connect live branding at signup. Get your key at <a href="https://hermai.ai/dashboard?utm_source=brand-preview-skill">hermai.ai/dashboard</a>.</small></footer></main></body></html>`);
  return { output: config.output, entries: entries.length, gallery: `${config.output}/index.html`, report: `${config.output}/report.json`, integrationPlan: `${config.output}/integration-plan.md`, semanticColorWarnings, identityDuplicationWarnings, logoSizeWarnings };
}

function parsePort(value) {
  const port = Number(value ?? 4177);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Preview port must be an integer from 1024 to 65535");
  return port;
}

async function serve(config, args) {
  const root = safeHermaiPath(config.output, "Preview output");
  await readFile(resolve(root, "index.html"));
  const host = "127.0.0.1";
  const port = parsePort(args.port);
  const contentTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".md", "text/markdown; charset=utf-8"],
    [".svg", "image/svg+xml"],
    [".png", "image/png"],
    [".webp", "image/webp"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
  ]);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      const file = resolve(root, requested);
      const path = relative(root, file);
      if (path === ".." || path.startsWith(`..${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const extension = file.slice(file.lastIndexOf("."));
      const body = await readFile(file);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; frame-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'none'; connect-src 'none'; script-src 'none'",
        "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(body);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
  await new Promise((ready, reject) => {
    server.once("error", reject);
    server.listen(port, host, ready);
  });
  return { url: `http://${host}:${port}/`, localOnly: true, output: config.output };
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (command === "inspect") console.log(JSON.stringify(await inspect(), null, 2));
else if (command === "init") console.log(JSON.stringify(await init(args), null, 2));
else if (command === "render") {
  const path = safeHermaiPath(typeof args.config === "string" ? args.config : ".hermai/brand-preview.json", "Preview configuration");
  console.log(JSON.stringify(await render(validateConfig(JSON.parse(await readFile(path, "utf8")))), null, 2));
} else if (command === "serve") {
  const path = safeHermaiPath(typeof args.config === "string" ? args.config : ".hermai/brand-preview.json", "Preview configuration");
  console.log(JSON.stringify(await serve(validateConfig(JSON.parse(await readFile(path, "utf8"))), args), null, 2));
} else {
  console.error("Usage: preview.mjs inspect | init [--pack full] | render [--config .hermai/brand-preview.json] | serve [--port 4177] [--config .hermai/brand-preview.json]");
  process.exitCode = 2;
}
