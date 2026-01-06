import dayjs from "dayjs";
import { ReviewerWindow } from "./model.js";

// Render only the Mermaid Gantt body (no code fences)
export function renderGantt(windows: ReviewerWindow[]): string {
  const lines: string[] = [];

  lines.push("gantt");
  lines.push("  title PR Review Timeline");
  lines.push("  dateFormat  YYYY-MM-DD");
  lines.push("  axisFormat  %d %b");
  lines.push("");

  for (const w of windows) {
    const end = w.end ?? dayjs().format("YYYY-MM-DD");
    lines.push(`  @${w.reviewer} : ${w.start}, ${end}`);
  }

  return lines.join("\n");
}

// Wrap the Gantt body in a fenced Mermaid code block for markdown contexts (PR body, README, etc.)
export function renderMermaidDiagram(windows: ReviewerWindow[]): string {
  const body = renderGantt(windows);
  return ["```mermaid", body, "```"] .join("\n");
}
