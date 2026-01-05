"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPullRequest = fetchPullRequest;
exports.fetchReviews = fetchReviews;
exports.fetchReviewRequests = fetchReviewRequests;
async function fetchPullRequest(octokit, owner, repo, pullNumber) {
    return octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
    });
}
async function fetchReviews(octokit, owner, repo, pullNumber) {
    return octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100
    });
}
async function fetchReviewRequests(octokit, owner, repo, pullNumber) {
    return octokit.rest.pulls.listRequestedReviewers({
        owner,
        repo,
        pull_number: pullNumber
    });
}
