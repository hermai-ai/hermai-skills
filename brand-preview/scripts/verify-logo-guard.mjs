#!/usr/bin/env node
// Small assertion script for the render time logo size guard in preview.mjs
// (detectUnboundedLogoImageRisks). The repo has no formal test runner, so
// this script fills that gap for one guard: it reads the fixture harnesses
// under fixtures/logo-guard-cases, runs the guard against each, and checks
// the result against what a correct universal selector match should be.
//
// Run with: node brand-preview/scripts/verify-logo-guard.mjs

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectUnboundedLogoImageRisks } from "./preview.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(scriptDir, "fixtures/logo-guard-cases");

async function loadFixture(name) {
  return readFile(resolve(fixtureDir, name), "utf8");
}

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`PASS: ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL: ${label}${detail ? ` (${detail})` : ""}`);
}

// Case a: scoped rules are present (.id-strip .hermai-logo-image is sized)
// but the on_dark slot has no rule bounding it at all. The guard must not
// mistake the descendant scoped rule for a universal one, and must warn
// about the one slot that is genuinely unbounded.
{
  const harness = await loadFixture("case-a-descendant-scoped-decoy.html");
  const warnings = detectUnboundedLogoImageRisks(harness);
  check(
    "case a: descendant scoped decoy still fires a warning for the unbounded on_dark slot",
    warnings.length === 1 && warnings[0].includes("on_dark"),
    `got ${JSON.stringify(warnings)}`,
  );
}

// Case b: a truly universal .hermai-logo-image rule (bare, unscoped) must
// still suppress every per slot warning. This is the regression guard: the
// fix must not turn a real universal rule into a false positive.
{
  const harness = await loadFixture("case-b-true-universal-rule.html");
  const warnings = detectUnboundedLogoImageRisks(harness);
  check(
    "case b: a genuinely universal rule suppresses all per slot warnings",
    warnings.length === 0,
    `got ${JSON.stringify(warnings)}`,
  );
}

// Case c: a comma separated selector list where one branch is the bare
// universal selector ("a, .hermai-logo-image") must still count as
// universal, because that one branch alone bounds every instance of the
// class.
{
  const harness = await loadFixture("case-c-comma-list-with-bare-selector.html");
  const warnings = detectUnboundedLogoImageRisks(harness);
  check(
    "case c: a comma list containing the bare selector counts as universal",
    warnings.length === 0,
    `got ${JSON.stringify(warnings)}`,
  );
}

// Case d: a sibling combinator scoped rule (".icon-mark + .hermai-logo-image")
// must not count as universal either, mirroring case a with a different
// combinator. The unbounded on_dark slot must still be reported.
{
  const harness = await loadFixture("case-d-sibling-scoped-decoy.html");
  const warnings = detectUnboundedLogoImageRisks(harness);
  check(
    "case d: sibling combinator scoped decoy still fires a warning for the unbounded on_dark slot",
    warnings.length === 1 && warnings[0].includes("on_dark"),
    `got ${JSON.stringify(warnings)}`,
  );
}

// Case e: three descendant scoped rules, one per placement container, each
// genuinely bounding the slot placed inside it (the legacy-mess testbed's
// real pattern). None of these rules is universal, so the guard has to
// attribute each rule back to the one slot its container actually wraps
// instead of either suppressing everything or warning on all three.
{
  const harness = await loadFixture("case-e-descendant-scoped-all-slots-bound.html");
  const warnings = detectUnboundedLogoImageRisks(harness);
  check(
    "case e: three container scoped rules, each attributed to its own slot, leave nothing unbounded",
    warnings.length === 0,
    `got ${JSON.stringify(warnings)}`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} logo guard assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll logo guard assertions passed.");
