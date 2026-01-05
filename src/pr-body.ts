const START = "<!-- pr-review-timeline:start -->";
const END = "<!-- pr-review-timeline:end -->";

export async function updatePrBody(
  octokit: ReturnType<typeof import("@actions/github").getOctokit>,
  repo: { owner: string; repo: string },
  pr: any,
  gantt: string
) {
  const block = `${START}\n${gantt}\n${END}`;
  let body = pr.body ?? "";

  const regex = new RegExp(`${START}[\\s\\S]*?${END}`, "m");

  if (regex.test(body)) {
    body = body.replace(regex, block);
  } else {
    body = `${body}\n\n${block}`;
  }

  await octokit.rest.pulls.update({
    owner: repo.owner,
    repo: repo.repo,
    pull_number: pr.number,
    body
  });
}
