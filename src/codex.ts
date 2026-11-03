import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

const TIMEOUT_MS = 15 * 60 * 1000;
const REASONING_EFFORT = "high";

export type CodexOptions = { model: string; cwd?: string };

export async function askCodex(prompt: string, { model, cwd }: CodexOptions): Promise<string> {
  if (cwd !== undefined) {
    let isDirectory = false;
    try {
      isDirectory = isAbsolute(cwd) && (await stat(cwd)).isDirectory();
    } catch {
      isDirectory = false;
    }
    if (!isDirectory) {
      throw new Error(`Kein vorhandener Ordner mit absolutem Pfad: ${cwd}. Gib das Wurzelverzeichnis des Projekts an, etwa /home/musta/projects/job-match.`);
    }
  }
  const workdir = await mkdtemp(join(tmpdir(), "review-mcp-"));
  const outFile = join(workdir, "answer.txt");
  try {
    const log = await new Promise<string>((resolve, reject) => {
      const child = spawn(
        "codex",
        [
          "exec",
          "--sandbox", "read-only",
          "--skip-git-repo-check",
          "--ephemeral",
          "-m", model,
          "-c", `model_reasoning_effort="${REASONING_EFFORT}"`,
          "-o", outFile,
          "-",
        ],
        { cwd: cwd ?? workdir, timeout: TIMEOUT_MS },
      );
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve(output) : reject(new Error(`Codex endete mit Code ${code}:\n${output.slice(-2000)}`))));
      child.stdin.end(prompt);
    });
    const usedModel = log.match(/^model: (.+)$/m)?.[1] ?? "unbekannt";
    const answer = (await readFile(outFile, "utf8")).trim();
    return `Prüfung durch ChatGPT (Codex, Modell ${usedModel}, Aufwand ${REASONING_EFFORT}):\n\n${answer}`;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
