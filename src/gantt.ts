import dayjs from "dayjs";
import { ReviewerWindow } from "./model.js";

export function renderGantt(windows: ReviewerWindow[]): string {
  const lines: string[] = [];

  lines.push("```mermaid");
  lines.push("gantt");
  lines.push("  title PR Review Timeline");
  lines.push("  dateFormat  YYYY-MM-DD");
  lines.push("  axisFormat  %d %b");
  lines.push("");

  for (const w of windows) {
    const end = w.end ?? dayjs().format("YYYY-MM-DD");
    lines.push(`  @${w.reviewer} : ${w.start}, ${end}`);
  }

  lines.push("```");

  return lines.join("\n");
}
