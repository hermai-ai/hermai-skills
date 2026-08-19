#!/usr/bin/env node
// Workspace tool, not a customer facing part of the skill. A single real
// app only ever has one gallery to check, and preview.mjs status already
// answers that on its own. This script exists for the fleet case: when we
// hold several galleries in this workspace at once (the bundled testbeds,
// the hermai-web dogfood app), rerender every one of them against the
// renderer sitting in this checkout right now, then assert none of them
// quietly kept an older version's defects. See runner.md for the one line
// usage note aimed at this workspace.

import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { RENDERER_VERSION, TEST_PACK } from "./preview.mjs";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const previewScriptPath = resolve(scriptsDirectory, "preview.mjs");

const PLACEHOLDER_TOKENS = ["{{HERMAI_COMPANY_NAME}}", "{{HERMAI_LOGO_STANDARD}}", "{{HERMAI_LOGO_COMPACT}}", "{{HERMAI_LOGO_ON_DARK}}", "{{HERMAI_DESCRIPTION}}"];
const WARNING_FIELDS = ["semanticColorWarnings", "identityDuplicationWarnings", "logoSizeWarnings", "descriptionBindingWarnings"];
const SVG_XMLNS_PATTERN = /xmlns\s*=\s*"http:\/\/www\.w3\.org\/2000\/svg"/;
const CHIP_MARKUP_CLASS = "hermai-logo-chip";

function parseCliArgs(argv) {
  const roots = [];
  let rootsFile = null;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--roots-file") { rootsFile = argv[++index]; continue; }
    if (value.startsWith("--")) continue;
    roots.push(value);
  }
  return { roots, rootsFile };
}

async function readRootsFile(path) {
  const contents = await readFile(resolve(path), "utf8");
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// The manifest already loaded inside preview.mjs is the one and only source
// of which brand has which identity slots, so a brand counted here as a
// single variant brand always matches what render actually did with it.
// Nothing about brand ids is hardcoded in this file.
function singleVariantBrandIds() {
  const ids = new Set();
  for (const brand of TEST_PACK) {
    const identity = brand.application_theme.identity;
    const variantCount = ["standard", "compact", "on_dark"].filter((slot) => identity[slot]?.asset).length;
    if (variantCount === 1) ids.add(brand.id);
  }
  return ids;
}

function runRenderInRoot(root) {
  return new Promise((settle) => {
    const child = spawn(process.execPath, [previewScriptPath, "render"], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => settle({ code, stdout, stderr }));
    child.on("error", (error) => settle({ code: 1, stdout, stderr: `${stderr}${error.message}\n` }));
  });
}

async function auditRoot(root, singleVariantIds) {
  const label = basename(root);
  const failures = [];
  const checks = {};

  const rendered = await runRenderInRoot(root);
  checks.render = rendered.code === 0;
  if (!checks.render) {
    failures.push(`render exited ${rendered.code}: ${rendered.stderr.trim().split("\n").slice(-2).join(" | ") || "no stderr output"}`);
    return { root, label, checks, failures, pass: false };
  }

  const configPath = resolve(root, ".hermai/brand-preview.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const outputDirectory = resolve(root, config.output);
  const report = JSON.parse(await readFile(resolve(outputDirectory, "report.json"), "utf8"));
  const entries = report.entries ?? [];

  checks.versionStamp = report.rendererVersion === RENDERER_VERSION;
  if (!checks.versionStamp) failures.push(`report.json rendererVersion is ${report.rendererVersion ?? "missing"}, current renderer is v${RENDERER_VERSION}`);

  checks.guardWarningsEmpty = true;
  for (const field of WARNING_FIELDS) {
    const list = report[field] ?? [];
    if (list.length) {
      checks.guardWarningsEmpty = false;
      failures.push(`${field} has ${list.length} entry or entries: ${list[0]}`);
    }
  }

  checks.placeholdersResolved = true;
  for (const entry of entries) {
    const html = await readFile(resolve(outputDirectory, entry.preview), "utf8");
    for (const token of PLACEHOLDER_TOKENS) {
      if (html.includes(token)) {
        checks.placeholdersResolved = false;
        failures.push(`${entry.id} still has an unresolved ${token} placeholder`);
      }
    }
  }

  const assetsDirectory = resolve(outputDirectory, "assets");
  const assetFileNames = await readdir(assetsDirectory).catch(() => []);
  checks.svgAssetsHaveXmlns = true;
  for (const fileName of assetFileNames) {
    if (!fileName.endsWith(".svg")) continue;
    const svgContents = await readFile(resolve(assetsDirectory, fileName), "utf8");
    if (!SVG_XMLNS_PATTERN.test(svgContents)) {
      checks.svgAssetsHaveXmlns = false;
      failures.push(`${fileName} is missing an xmlns attribute`);
    }
  }

  checks.singleVariantChipsPresent = true;
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  for (const brandId of singleVariantIds) {
    const entry = entryById.get(brandId);
    if (!entry) continue;
    const html = await readFile(resolve(outputDirectory, entry.preview), "utf8");
    if (!html.includes(CHIP_MARKUP_CLASS)) {
      checks.singleVariantChipsPresent = false;
      failures.push(`${brandId} is a single variant brand but its rendered preview has no ${CHIP_MARKUP_CLASS} markup`);
    }
  }

  const pass = Object.values(checks).every(Boolean);
  return { root, label, checks, failures, pass };
}

function markCell(value) { return value ? "ok" : "FAIL"; }

async function main() {
  const { roots: argRoots, rootsFile } = parseCliArgs(process.argv.slice(2));
  const fileRoots = rootsFile ? await readRootsFile(rootsFile) : [];
  const roots = [...new Set([...argRoots, ...fileRoots])].map((root) => resolve(root));
  if (!roots.length) {
    console.error("Usage: regen-audit.mjs <app root> [<app root> ...] | --roots-file <path with one app root per line>");
    process.exitCode = 2;
    return;
  }

  const singleVariantIds = singleVariantBrandIds();
  const results = [];
  for (const root of roots) {
    console.log(`Rendering ${root}`);
    results.push(await auditRoot(root, singleVariantIds));
  }

  console.table(results.map((result) => ({
    gallery: result.label,
    render: markCell(result.checks.render),
    version: markCell(result.checks.versionStamp),
    warnings: markCell(result.checks.guardWarningsEmpty),
    placeholders: markCell(result.checks.placeholdersResolved),
    svgXmlns: markCell(result.checks.svgAssetsHaveXmlns),
    chipMarkup: markCell(result.checks.singleVariantChipsPresent),
    overall: result.pass ? "PASS" : "FAIL",
  })));

  const failedResults = results.filter((result) => !result.pass);
  for (const result of failedResults) {
    console.log(`\n${result.label} failures:`);
    for (const failure of result.failures) console.log(`  * ${failure}`);
  }

  process.exitCode = failedResults.length ? 1 : 0;
}

await main();
