export type ReviewInput = {
  file: string;
  sources: { heading: string; text: string }[];
  changes: string;
  notTaken?: string;
  focus?: string;
};

export function buildReviewPrompt(input: ReviewInput): string {
  const sources = input.sources.map((source) => `=== Quelle: „${source.heading}“ ===\n${source.text}`).join("\n\n");
  return `Du prüfst eine Änderung an der Anker-Datei \`${input.file}\` gegen ihre Quelle. Du prüfst nur; du schreibst die Datei nicht neu und öffnest keine Dateien.

Die Anker-Dateien sind deutsch, einfach formuliert, mit englischen Fachbegriffen in Klammern. Quelle ist Kyle Stratis, „AI Agents with MCP“ (O'Reilly 2026), das die MCP-Spezifikation vom 28.07.2026 beschreibt. Verlass dich nur auf den mitgegebenen Quelltext; hältst du etwas aus eigenem Wissen für veraltet, nenn es getrennt unter „Hinweise außerhalb der Quelle“.

Prüf nur die Änderung:
1. Stimmt jede Aussage mit der Quelle überein?
2. Ist etwas verschärft, abgeschwächt, verallgemeinert oder erfunden? Fehlen Einschränkungen wie „often“, „can“, „some“?
3. Widerspricht die Änderung sich selbst oder dem genannten Umfeld?
4. Ist sie für Einsteiger verständlich?

Meld nichts als fehlend, was unter „Bewusst nicht übernommen“ steht.

Ausgabe je Fund:
- Stelle: kurzes Zitat aus der Änderung
- Quelle: passendes Zitat oder „nicht in der Quelle“
- Problem: ein Satz
- Vorschlag: geänderte Formulierung
- Gewicht: falsch / ungenau / klein

Ordne nach Gewicht. Findest du nichts, schreib nur „Keine Funde“. Antworte auf Deutsch.

${input.focus ? `=== Besonders prüfen ===\n${input.focus}\n\n` : ""}${input.notTaken ? `=== Bewusst nicht übernommen ===\n${input.notTaken}\n\n` : ""}=== Änderung ===
${input.changes}

${sources}`;
}
