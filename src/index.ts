import * as core from "@actions/core";
import * as github from "@actions/github";
import { fetchReviewTimelineData } from "./github.js";
import { buildReviewerWindows } from "./model.js";
import { renderGantt, renderMermaidDiagram } from "./gantt.js";
import { updatePrBody } from "./pr-body.js";

// Node env typing is not included by default; declare for local runs
declare const process: any;

async function run() {
  try {
    // Read optional input; fall back to environment for local runs/tests
    const tokenInput = core.getInput("github-token", { required: false });
    const token = (tokenInput || "").trim() || process.env.GITHUB_TOKEN || "";
    const ctx = github.context;

    if (!ctx.payload.pull_request) {
      core.info("Not a pull request event, skipping");
      return;
    }

    if (!token) {
      core.setFailed(
        "GitHub token missing. Provide input 'github-token' or set environment GITHUB_TOKEN."
      );
      return;
    }

    const octokit = github.getOctokit(token);
    const pr = ctx.payload.pull_request;
    const action = (ctx.payload as any).action as string | undefined;
    const isClosedAction = action === "closed";
    const publishToPr = core.getBooleanInput("publish-to-pr", { required: false });

    // Configurable skip: draft PRs
    const skipDraft = core.getBooleanInput("skip-draft", { required: false });
    if (skipDraft && pr.draft && !isClosedAction) {
      core.info("Skipping draft PR per configuration");
      return;
    }

    // Skip closed/merged on non-finalization events; run once on the closed action to finalize
    if ((pr.state === "closed" || pr.merged) && !isClosedAction) {
      core.info("Skipping closed/merged PR on non-finalization event");
      return;
    }
    if (isClosedAction) {
      core.info(`Finalizing timeline on closed event (merged=${!!(pr as any).merged})`);
    }

    const rawData = await fetchReviewTimelineData(octokit, ctx.repo, pr);
    const reviewerWindows = buildReviewerWindows(rawData);
    const gantt = renderGantt(reviewerWindows);
    const mermaidBlock = renderMermaidDiagram(reviewerWindows);

    // Set outputs for downstream steps (JSON + Mermaid)
    core.setOutput("timeline-json", JSON.stringify(reviewerWindows));
    core.setOutput("timeline-mermaid", mermaidBlock);

    // Logs for visibility in job output
    core.info(`Computed ${reviewerWindows.length} reviewer windows`);
    for (const w of reviewerWindows) {
      core.info(`@${w.reviewer}: ${w.start} (${w.startReason}) -> ${w.end} (${w.endReason})`);
    }
    core.info("Gantt (summary body):\n" + gantt);

    // Add a concise job summary with the windows and the Mermaid diagram
    await core.summary
      .addHeading("PR Review Timeline")
      .addHeading("Reviewer Windows", 2)
      .addList(reviewerWindows.map(w => `@${w.reviewer}: ${w.start} (${w.startReason}) -> ${w.end} (${w.endReason})`))
      .addHeading("Mermaid Diagram", 2)
      .addCodeBlock(gantt, "mermaid")
      .write();

    if (publishToPr) {
      await updatePrBody(octokit, ctx.repo, pr, mermaidBlock);
    } else {
      core.info("PR body update disabled (publish-to-pr=false)");
    }
  } catch (err: any) {
    core.setFailed(err.message);
  }
}

run();
