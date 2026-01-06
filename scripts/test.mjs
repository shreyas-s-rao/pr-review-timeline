import * as github from "@actions/github";
import githubPkg from "../lib/github.js";
import modelPkg from "../lib/model.js";
import ganttPkg from "../lib/gantt.js";
const { fetchReviewTimelineData } = githubPkg;
const { buildReviewerWindows } = modelPkg;
const { renderGantt } = ganttPkg;

// Env: GITHUB_TOKEN, OWNER, REPO, PR_NUMBER
const token = process.env.GITHUB_TOKEN;
const owner = process.env.OWNER;
const repo = process.env.REPO;
const prNumber = Number(process.env.PR_NUMBER);

if (!token || !owner || !repo || !prNumber) {
  console.error("Set GITHUB_TOKEN, OWNER, REPO, PR_NUMBER envs.");
  process.exit(1);
}

const octokit = github.getOctokit(token);

// Fetch PR
const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });

// Use the codebase: fetch data, build windows, render gantt
const raw = await fetchReviewTimelineData(octokit, { owner, repo }, pr);
const windows = buildReviewerWindows(raw);
const gantt = renderGantt(windows);

// Debug logging similar to the action's output
console.log(`Computed ${windows.length} reviewer windows`);
for (const w of windows) {
  console.log(`@${w.reviewer}: ${w.start} (${w.startReason}) -> ${w.end} (${w.endReason})`);
}

console.log(gantt);