#!/usr/bin/env tsx
/**
 * install-drive-hook — install the auto-push git hook into a target repo.
 *
 *   npm run install-drive-hook -- <target-repo-dir>   # e.g. ~/src (where creative markdown is committed)
 *   npm run install-drive-hook -- <dir> --uninstall
 *
 * Safe: refuses to clobber a pre-existing post-commit hook that isn't ours (prints how to
 * merge). Our hook is marked with PROMPTSYNC-DRIVE-PUSH so re-installs are idempotent.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const MARKER = "PROMPTSYNC-DRIVE-PUSH";

function hooksDir(repo: string): string {
  // Respect a custom core.hooksPath; else default .git/hooks.
  let configured = "";
  try {
    configured = execSync("git config --get core.hooksPath", { cwd: repo }).toString().trim();
  } catch {
    /* none */
  }
  const gitDir = execSync("git rev-parse --git-dir", { cwd: repo }).toString().trim();
  const base = configured || path.join(gitDir, "hooks");
  return path.isAbsolute(base) ? base : path.resolve(repo, base);
}

function main(): number {
  const args = process.argv.slice(2);
  const uninstall = args.includes("--uninstall");
  const target = args.find((a) => !a.startsWith("--"));
  if (!target) {
    console.error("Usage: install-drive-hook <target-repo-dir> [--uninstall]");
    return 2;
  }
  const repo = path.resolve(process.cwd(), target);
  if (!fs.existsSync(path.join(repo, ".git")) && !fs.existsSync(path.join(repo, "HEAD"))) {
    try {
      execSync("git rev-parse --git-dir", { cwd: repo, stdio: "ignore" });
    } catch {
      console.error(`Not a git repo: ${repo}`);
      return 2;
    }
  }

  const dir = hooksDir(repo);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, "post-commit");

  if (uninstall) {
    if (fs.existsSync(dest) && fs.readFileSync(dest, "utf-8").includes(MARKER)) {
      fs.rmSync(dest);
      console.log(`Removed PromptSync post-commit hook from ${dest}`);
    } else {
      console.log("No PromptSync post-commit hook to remove.");
    }
    return 0;
  }

  const templatePath = path.resolve(import.meta.dirname, "../../hooks/post-commit-drive-push.sh");
  const template = fs.readFileSync(templatePath, "utf-8");

  if (fs.existsSync(dest)) {
    const existing = fs.readFileSync(dest, "utf-8");
    if (!existing.includes(MARKER)) {
      console.error(
        `A non-PromptSync post-commit hook already exists at:\n  ${dest}\n` +
          `Refusing to overwrite. Merge manually by appending the body of:\n  ${templatePath}`
      );
      return 1;
    }
  }

  fs.writeFileSync(dest, template, { mode: 0o755 });
  fs.chmodSync(dest, 0o755);
  console.log(`✓ Installed auto-push hook → ${dest}`);
  console.log(`  Commits in ${repo} now mirror changed project markdown to Drive (non-blocking).`);
  console.log(`  Log: ~/.promptsync-drive-push.log   Uninstall: npm run install-drive-hook -- ${target} --uninstall`);
  return 0;
}

process.exit(main());
