import dayjs from "dayjs";
export interface RawTimelineData {
  prCreatedAt: string;
  prMergedAt: string | null;
  reviewRequests: Map<string, string>; // reviewer -> earliest start (YYYY-MM-DD)
  approvals: Map<string, string>; // reviewer -> earliest APPROVED (YYYY-MM-DD)
  prAuthor: string;
  startReasons: Map<string, "requested" | "assigned" | "first_review" | "fallback_requested">;
}

export async function fetchReviewTimelineData(
  octokit: ReturnType<typeof import("@actions/github").getOctokit>,
  repo: { owner: string; repo: string },
  pr: any
): Promise<RawTimelineData> {
  const reviewRequests = new Map<string, string>();
  const firstReviewAt = new Map<string, string>();
  const startReasons = new Map<string, "requested" | "assigned" | "first_review" | "fallback_requested">();
  const authorLogin: string | undefined = (pr as any)?.user?.login || (pr as any)?.author_association ? (pr as any)?.user?.login : undefined;

  const events = await octokit.paginate(
    octokit.rest.issues.listEvents,
    {
      owner: repo.owner,
      repo: repo.repo,
      issue_number: pr.number,
      per_page: 100
    }
  );

  for (const e of events) {
    const requestedReviewer = (e as any).requested_reviewer?.login as string | undefined;
    const assignedUser = (e as any).assignee?.login as string | undefined;
    const ts = dayjs(e.created_at).format("YYYY-MM-DD");
    if (e.event === "review_requested" && requestedReviewer && requestedReviewer !== authorLogin) {
      const existing = reviewRequests.get(requestedReviewer);
      if (!existing || dayjs(ts).isBefore(dayjs(existing))) {
        reviewRequests.set(requestedReviewer, ts);
        startReasons.set(requestedReviewer, "requested");
      }
    }
    // Include assignment-based starts per invariant
    if (e.event === "assigned" && assignedUser && assignedUser !== authorLogin) {
      const existing = reviewRequests.get(assignedUser);
      if (!existing || dayjs(ts).isBefore(dayjs(existing))) {
        reviewRequests.set(assignedUser, ts);
        startReasons.set(assignedUser, "assigned");
      }
    }
  }

  // Fallback when events not available: use current requested reviewers with PR created time
  if (reviewRequests.size === 0 && Array.isArray(pr.requested_reviewers)) {
    for (const u of pr.requested_reviewers) {
      const login = (u as any)?.login as string | undefined;
      if (login && login !== authorLogin && !reviewRequests.has(login)) {
        reviewRequests.set(login, dayjs(pr.created_at).format("YYYY-MM-DD"));
        startReasons.set(login, "fallback_requested");
      }
    }
  }

  // Fetch all reviews to find earliest APPROVED per reviewer and first review timestamps
  const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
    owner: repo.owner,
    repo: repo.repo,
    pull_number: pr.number,
    per_page: 100,
  });

  const approvals = new Map<string, string>();
  for (const r of reviews) {
    const state = String((r as any).state || "").toUpperCase();
    const login = (r as any).user?.login as string | undefined;
    if (state === "APPROVED" && login) {
      const ts = dayjs((r as any).submitted_at || (r as any).created_at).format("YYYY-MM-DD");
      const existing = approvals.get(login);
      if (!existing || dayjs(ts).isBefore(dayjs(existing))) {
        approvals.set(login, ts);
      }
    }
    if (login && login !== authorLogin) {
      const ts = dayjs((r as any).submitted_at || (r as any).created_at).format("YYYY-MM-DD");
      const existingFirst = firstReviewAt.get(login);
      if (!existingFirst || dayjs(ts).isBefore(dayjs(existingFirst))) {
        firstReviewAt.set(login, ts);
      }
    }
  }

  // Seed drive-by reviewers: if a reviewer has any review but no start, use first review date
  for (const [login, firstAt] of firstReviewAt.entries()) {
    if (!reviewRequests.has(login)) {
      reviewRequests.set(login, firstAt);
      startReasons.set(login, "first_review");
    }
  }

  return {
    prCreatedAt: dayjs(pr.created_at).format("YYYY-MM-DD"),
    prMergedAt: pr.merged_at ? dayjs(pr.merged_at).format("YYYY-MM-DD") : null,
    reviewRequests,
    approvals,
    prAuthor: authorLogin || "",
    startReasons,
  };
}
