import dayjs from "dayjs";
import { RawTimelineData } from "./github";

export interface ReviewerWindow {
  reviewer: string;
  start: string;
  end: string;
  startReason: "requested" | "assigned" | "first_review" | "fallback_requested";
  endReason: "approved" | "merged" | "today" | "approved+normalized" | "merged+normalized" | "today+normalized";
}

export function buildReviewerWindows(
  data: RawTimelineData
): ReviewerWindow[] {
  const windows: ReviewerWindow[] = [];

  for (const [reviewer, requestedAt] of data.reviewRequests.entries()) {
    const start = requestedAt ?? data.prCreatedAt;
    const startReason = data.startReasons.get(reviewer) ?? "requested";

    // End is earliest of APPROVED or merged; if neither, use today.
    const approvedAt = data.approvals.get(reviewer);
    let endCandidate: string | null = null;
    let endReasonBase: "approved" | "merged" | "today";
    if (approvedAt && data.prMergedAt) {
      const approvedIsEarlier = dayjs(approvedAt).isBefore(dayjs(data.prMergedAt));
      endCandidate = approvedIsEarlier ? approvedAt : data.prMergedAt;
      endReasonBase = approvedIsEarlier ? "approved" : "merged";
    } else if (approvedAt) {
      endCandidate = approvedAt;
      endReasonBase = "approved";
    } else if (data.prMergedAt) {
      endCandidate = data.prMergedAt;
      endReasonBase = "merged";
    } else {
      endCandidate = dayjs().format("YYYY-MM-DD");
      endReasonBase = "today";
    }

    // Normalize: ensure end > start by at least one day
    let end = endCandidate;
    let endReason: ReviewerWindow["endReason"] = endReasonBase as ReviewerWindow["endReason"];
    if (!dayjs(end).isAfter(dayjs(start))) {
      end = dayjs(start).add(1, "day").format("YYYY-MM-DD");
      endReason = (endReasonBase + "+normalized") as ReviewerWindow["endReason"];
    }

    windows.push({ reviewer, start, end, startReason, endReason });
  }

  return windows.sort((a, b) => a.start.localeCompare(b.start));
}
