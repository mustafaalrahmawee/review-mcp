import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readSection } from "./book.ts";
import { askCodex } from "./codex.ts";
import { buildReviewPrompt } from "./prompt.ts";

const BOOK_PATH = process.env.BOOK_PATH ?? "/mnt/c/Users/musta/Documents/books/AI Agents with MCP.md";
const REVIEW_ANCHOR_MODEL = "gpt-6-astra";

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
      const review = await askCodex(buildReviewPrompt({ file, sources, changes, notTaken, focus }), { model: REVIEW_ANCHOR_MODEL });
      return { content: [{ type: "text", text: review }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
    }
  },
);

await server.connect(new StdioServerTransport());
