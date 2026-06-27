import fs from "fs";
import path from "path";
import Papa from "papaparse";

interface TsvRow {
  Shot: string;
  "Place / Setting": string;
  "Shot Type": string;
  "Camera Movement": string;
  Duration: string;
  "Color & Mood": string;
  "Subject & Action": string;
  "VO/Lines": string;
  "SFX / Audio": string;
  "Shot image": string;
  Notes: string;
}

export function parseAssetType(notes: string): string {
  const lower = notes.toLowerCase();
  if (lower.includes("kling-reuse")) return "kling-reuse";
  if (lower.includes("kling")) return "kling";
  if (lower.includes("google flow") || lower.includes("googleflow")) return "googleflow";
  return "still";
}

export function parseRisk(notes: string): string {
  const lower = notes.toLowerCase();
  if (lower.includes("high risk") || lower.includes("high")) return "high";
  if (lower.includes("medium risk") || lower.includes("medium")) return "medium";
  return "low";
}

export function shotTypeAbbrev(shotType: string): string {
  const map: Record<string, string> = {
    "Wide": "WS", "Wide Shot": "WS",
    "Medium": "MS", "Medium Shot": "MS",
    "Close-up": "CU", "Close up": "CU", "Closeup": "CU",
    "Extreme Close-up": "ECU", "Extreme Close up": "ECU",
    "Medium Close-up": "MCU",
    "Medium Long Shot": "MLS",
    "Medium Wide Shot": "MWS",
    "Full Shot": "FS",
    "Long Shot": "LS",
    "Extreme Wide Shot": "EWS",
    "POV": "POV",
    "Over the Shoulder": "OTS",
    "Profile": "Profile",
  };
  return map[shotType] ?? shotType;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: tsx scripts/import-storyboard.ts <tsv-file> <project-dir> [--name 'Project Name'] [--slug project-slug]");
    process.exit(1);
  }

  const tsvPath = path.resolve(args[0]);
  const projectDir = path.resolve(args[1]);

  let projectName = path.basename(projectDir);
  let projectSlug = projectName.toLowerCase().replace(/\s+/g, "-");

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) { projectName = args[++i]; }
    if (args[i] === "--slug" && args[i + 1]) { projectSlug = args[++i]; }
  }

  const raw = fs.readFileSync(tsvPath, "utf-8");
  const { data } = Papa.parse<TsvRow>(raw, { header: true, delimiter: "\t", skipEmptyLines: true });

  if (data.length === 0) {
    console.error("No rows found in TSV");
    process.exit(1);
  }

  // Create directories
  const shotsDir = path.join(projectDir, "storyboard", "shots");
  const videoDir = path.join(projectDir, "storyboard", "video-prompts");
  const charsDir = path.join(projectDir, "storyboard", "characters");
  const stylesDir = path.join(projectDir, "storyboard", "styles");

  for (const dir of [shotsDir, videoDir, charsDir, stylesDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write project.yaml
  const yamlContent = `name: "${projectName}"
slug: ${projectSlug}
created: ${new Date().toISOString().slice(0, 10)}
status: in-progress

drive_folder_id: null
default_style: base-cinematic
shot_prefix: ""
`;
  fs.writeFileSync(path.join(projectDir, "project.yaml"), yamlContent);
  console.log(`Created project.yaml`);

  // Process each row
  for (const row of data) {
    const code = row.Shot?.trim();
    if (!code) continue;

    const assetType = parseAssetType(row.Notes ?? "");
    const risk = parseRisk(row.Notes ?? "");
    const shotType = shotTypeAbbrev(row["Shot Type"] ?? "");

    // Create shot directory + shot.md
    const shotDir = path.join(shotsDir, code);
    fs.mkdirSync(shotDir, { recursive: true });

    const shotMd = `---
shot: "${code}"
setting: "${(row["Place / Setting"] ?? "").replace(/"/g, '\\"')}"
shot_type: "${shotType}"
camera: "${(row["Camera Movement"] ?? "Static").replace(/"/g, '\\"')}"
duration: "${row.Duration ?? ""}"
color_mood: "${(row["Color & Mood"] ?? "").replace(/"/g, '\\"')}"
status: draft
asset_type: "${assetType}"
reuses: null
palette_group: null
risk: "${risk}"
multi_shot_group: null
elements: []
---

## Subject & Action
${row["Subject & Action"] ?? ""}

## VO / Lines
${row["VO/Lines"] ?? "(silence)"}

## SFX / Audio
${row["SFX / Audio"] ?? ""}

## Notes
${row.Notes ?? ""}
`;
    fs.writeFileSync(path.join(shotDir, "shot.md"), shotMd);

    // Create empty mj-prompt.md
    const platform = assetType === "googleflow" ? "googleflow" : "mj";
    const mjMd = `---
shot: "${code}"
model: "v7"
style: raw
ar: "16:9"
platform: "${platform}"
---

`;
    fs.writeFileSync(path.join(shotDir, "mj-prompt.md"), mjMd);

    // Create video-prompts dir for Kling shots
    if (assetType === "kling") {
      const vpDir = path.join(videoDir, code);
      fs.mkdirSync(vpDir, { recursive: true });

      const klingMd = `---
shot: "${code}"
motion_scale: 5
aspect_ratio: "16:9"
mode: standard
multi_shot_group: null
---

`;
      fs.writeFileSync(path.join(vpDir, "kling-prompt.md"), klingMd);

      const nbMd = `---
shot: "${code}"
source: generate-new
---

`;
      fs.writeFileSync(path.join(vpDir, "nanobanana.md"), nbMd);
    }

    console.log(`  ${code} (${assetType}, ${risk} risk)`);
  }

  console.log(`\nImported ${data.length} shots into ${projectDir}`);
}

const isDirectRun = process.argv[1]?.endsWith("import-storyboard.ts");
if (isDirectRun) {
  main();
}
