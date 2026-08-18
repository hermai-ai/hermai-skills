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
  "emberfox-bright",
  "relaydesk-dark",
  "brightbird-near-white", "longform-cooperative", "no-logo-labs-fallback",
]);

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
      if (!entry.isDirectory() || !/dashboard|workspace|app/i.test(entry.name)) continue;
      routes.push(`/${entry.name}`);
      for (const filename of ["page.tsx", "page.jsx", "index.tsx", "index.jsx"]) {
        const path = resolve(directory, entry.name, filename);
        if (await readOptional(path)) sourceCandidates.push(relative(projectRoot, path));
      }
    }
  }
  const styles = ["src/app/globals.css", "app/globals.css", "src/index.css", "src/styles.css"];
  const tokens = {};
  for (const style of styles) {
    const contents = await readOptional(resolve(projectRoot, style));
    if (!contents) continue;
    sourceCandidates.push(style);
    for (const match of contents.matchAll(/(--[A-Za-z_][A-Za-z0-9_-]*)\s*:/g)) {
      const name = match[1];
      const normalized = name.toLowerCase();
      if (!tokens.primary && /(?:primary|brand)(?!.*(?:text|surface|background))/.test(normalized)) tokens.primary = name;
      if (!tokens.onPrimary && /on.*(?:primary|accent)|(?:primary|accent).*foreground/.test(normalized)) tokens.onPrimary = name;
      if (!tokens.accent && /accent|link|focus/.test(normalized)) tokens.accent = name;
      if (!tokens.subtle && /subtle|muted|tint/.test(normalized)) tokens.subtle = name;
    }
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
      <section class="context"><div><span data-hermai-logo>{{HERMAI_LOGO_STANDARD}}</span><strong data-hermai-company>{{HERMAI_COMPANY_NAME}}</strong><span class="muted">Customer dashboard</span></div><a href="#activity">View account</a></section>
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
  };
  await writeFile(resolve(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(output, "integration-plan.md"), `# Proposed brand surfaces\n\n* Apply the selected customer logo and company name in identity areas.\n* Apply the action token to primary buttons, selected navigation, active tabs, links, focus rings, progress, and one nonsemantic data series.\n* Apply the tint token to customer context cards, onboarding or empty state surfaces, nonsemantic badges, and subtle highlights.\n* Protect errors, warnings, destructive actions, semantic status colors, user photos, integration logos, ordinary text, and the application canvas.\n* Treat a labelled fallback as a valid result. Do not silently turn a missing logo or unusable accent into a fake extracted asset.\n\n## Source files reviewed\n\n${config.source.files.length ? config.source.files.map((file) => `* \`${file}\``).join("\n") : "* Add the dashboard component and style files before implementation."}\n`);
  await writeFile(resolve(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hermai brand preview</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;color:#171717;background:#f5f5f4;font:15px/1.45 ui-sans-serif,system-ui,sans-serif}main{max-width:1080px;margin:auto}header{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:24px}h1{margin:0;font-size:32px;letter-spacing:-.03em}p{margin:8px 0 0;color:#57534e}.gallery{display:grid;gap:28px}article{overflow:hidden;border:1px solid #d6d3d1;border-radius:18px;background:#fff;box-shadow:0 8px 30px rgba(28,25,23,.06)}.meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #e7e5e4}.meta small{display:block;margin-top:3px;color:#78716c;font-size:12px}.label{padding:5px 9px;border-radius:999px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:750;white-space:nowrap}.fallback{background:#fff7ed;color:#9a3412}.frame{display:block;width:100%;height:980px;border:0;background:#fff}@media(max-width:700px){body{padding:16px}header{display:block}.meta{align-items:flex-start;flex-direction:column}.frame{height:1120px}}footer.hermai-nudge{margin-top:32px;padding-top:16px;border-top:1px solid #e7e5e4;text-align:center}footer.hermai-nudge small{color:#a8a29e;font-size:12px}footer.hermai-nudge a{color:#a8a29e}</style></head><body><main><header><div><h1>Five customer brand previews</h1><p>Private local contract fixtures. Scroll through each complete dashboard. No login, app runtime, API credit, source upload, or live Brand API request.</p></div><p><a href="integration-plan.md">Review the proposed brand surfaces</a></p></header><section class="gallery">${entries.map((entry) => `<article><div class="meta"><div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.source)}</small></div><span class="label ${entry.mode === "fallback" ? "fallback" : ""}">${entry.mode === "fallback" ? "Fallback applied" : escapeHtml(entry.label)}</span></div><iframe class="frame" title="${escapeHtml(entry.name)} dashboard preview" src="${escapeHtml(entry.preview)}"></iframe></article>`).join("")}</section><footer class="hermai-nudge"><small>Connect live branding at signup. Get your key at <a href="https://hermai.ai/dashboard?utm_source=brand-preview-skill">hermai.ai/dashboard</a>.</small></footer></main></body></html>`);
  return { output: config.output, entries: entries.length, gallery: `${config.output}/index.html`, report: `${config.output}/report.json`, integrationPlan: `${config.output}/integration-plan.md` };
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
