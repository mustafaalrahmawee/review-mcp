import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readSection } from "./book.ts";
import { askModel } from "./model.ts";
import { buildReviewPrompt } from "./prompt.ts";

const BOOK_PATH = process.env.BOOK_PATH ?? "/mnt/c/Users/musta/Documents/books/AI Agents with MCP.md";
const REVIEW_ANCHOR_MODEL = "gpt-6.1-sol";
const REVIEW_PROMPT_MODEL = "gpt-6.1-sol";
const PROMPT_REVIEWER = new URL("../reviewers/prompt.md", import.meta.url);

const server = new McpServer({ name: "review", version: "0.2.0" });

server.registerTool(
  "review_anchor",
  {
    title: "Änderung an einer Anker-Datei prüfen lassen",
    description:
      "Schickt eine Änderung an einer Anker-Datei zusammen mit den Buchabschnitten, aus denen sie stammt, an ChatGPT (über Codex, nur lesend) und gibt dessen Prüfung wörtlich zurück. Den Buchtext liest der Server selbst über die Überschriften; gib die Überschriften genau so an, wie sie im Buch stehen. Dauert etwa 30 Sekunden bis wenige Minuten.",
    inputSchema: {
      file: z.string().describe("Name der geänderten Anker-Datei, etwa 00-grundlagen.md"),
      bookSections: z.array(z.string()).min(1).describe("Überschriften der Buchabschnitte, genau wie im Buch, etwa [\"The MCP Server\"]"),
      changes: z.string().describe("Die Änderung als Vorher/Nachher-Blöcke mit Abschnitt als Ort"),
      notTaken: z.string().optional().describe("Was bewusst nicht übernommen wurde und nicht als fehlend gemeldet werden soll"),
      focus: z.string().optional().describe("Stellen, die der Prüfer besonders ansehen soll"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ file, bookSections, changes, notTaken, focus }) => {
    try {
      const sources = [];
      for (const heading of bookSections) {
        sources.push({ heading, text: await readSection(BOOK_PATH, heading) });
      }
      const review = await askModel(buildReviewPrompt({ file, sources, changes, notTaken, focus }), { model: REVIEW_ANCHOR_MODEL });
      return { content: [{ type: "text", text: review }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
    }
  },
);

server.registerTool(
  "review_prompt",
  {
    title: "Prompt-Unit gegen den Prompting-Anker prüfen lassen",
    description:
      "Lässt eine Prompt-Unit von ChatGPT (über Codex, nur lesend) gegen den Prompting-Anker des Projekts prüfen: das Blatt (job sheet), die zusammengesetzte Unit-Datei (job code) oder die Antwort des Schreibers auf frühere Funde (job re-review). Codex läuft im Projektordner und öffnet Anker, Blatt und Code selbst; gib deshalb im Auftrag die Pfade an, nicht deren Inhalt. Gibt Funde P1, P2, … oder „Keine Funde.“ wörtlich zurück, beim re-review je Fund ok oder nicht ok. Dauert mehrere Minuten, höchstens 15.",
    inputSchema: {
      projectDir: z.string().describe("Absoluter Pfad zum Wurzelverzeichnis des Projekts, etwa /home/musta/projects/job-match"),
      job: z.enum(["sheet", "code", "re-review"]).describe("sheet: das Blatt prüfen; code: die Unit-Datei gegen das Blatt; re-review: frühere Funde gegen die Antwort des Schreibers"),
      unit: z.string().regex(/^[a-z][a-z0-9_]*$/).describe("Name der Prompt-Unit, etwa cv_analysis"),
      task: z.string().min(1).describe("Der Auftrag wörtlich: Pfade von Blatt und Unit-Datei, Zeile des Use Case, Modell und Effort aus der Unit-Datei, Laufzeitform und Werkzeuge; beim re-review die früheren Funde und die Antwort des Schreibers"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ projectDir, job, unit, task }) => {
    try {
      const reviewer = await readFile(PROMPT_REVIEWER, "utf8");
      const prompt = `${reviewer}\n\n## Task\n\nJob: ${job}\nUnit: ${unit}\n\n${task}`;
      const review = await askModel(prompt, { model: REVIEW_PROMPT_MODEL, cwd: projectDir });
      return { content: [{ type: "text", text: review }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
    }
  },
);

await server.connect(new StdioServerTransport());
