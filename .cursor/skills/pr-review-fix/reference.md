# PR Review Fix — GitHub API reference

Use `gh` only. The workspace `user-github` MCP exposes local git, not PR review APIs.

## Resolve owner / repo / PR number

```bash
# From current branch
gh pr view --json number,headRepository,baseRepository,url

# Explicit PR
gh pr view 123 -R owner/repo --json number,headRefName,baseRefName,url,title
```

Parse URLs: `https://github.com/{owner}/{repo}/pull/{number}`.

## Fetch review threads (GraphQL)

Replace `OWNER`, `REPO`, `PR_NUMBER`.

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          path
          line
          comments(first: 50) {
            nodes {
              databaseId
              body
              url
              author { login }
              createdAt
            }
          }
        }
      }
    }
  }
}' -f owner=OWNER -f repo=REPO -F number=PR_NUMBER
```

Filter unresolved in `jq` (optional):

```bash
# ... same query piped:
| jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)]'
```

Pagination: if `pageInfo.hasNextPage`, increase `first` or paginate with `after` cursor (rare for agent workflows).

## Reply on a review thread

Prefer GraphQL (uses `PRRT_` thread id from the query above):

```bash
gh api graphql -f query='
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {
    pullRequestReviewThreadId: $threadId
    body: $body
  }) {
    comment { id url }
  }
}' -f threadId='PRRT_...' -f body='Your reply text'
```

REST alternative for a specific review comment `databaseId` (numeric):

```bash
gh api \
  repos/OWNER/REPO/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
  -f body='Your reply text'
```

Use thread reply when you already have `threadId`; use REST when only a comment id is available.

## Resolve a thread

```bash
gh api graphql -f query='
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}' -f threadId='PRRT_...'
```

Run **after** posting the reply. One mutation per thread (avoid batching many resolves in one mutation unless all replies succeeded).

## Unresolve (rollback only)

```bash
gh api graphql -f query='
mutation($threadId: ID!) {
  unresolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}' -f threadId='PRRT_...'
```

Use only if a thread was resolved by mistake.

## Commit and push

- After fixes: run **`/commit`** (`.cursor/commands/commit.md`); do not stop at a plan.
- **Never** run `git push`. Replies and `resolveReviewThread` do not require the remote branch to be updated.

## Diff for thermo-nuclear review

```bash
git fetch origin
git diff origin/BASE_BRANCH...HEAD
```

Replace `BASE_BRANCH` with the PR base branch name from `gh pr view`.

## Permissions errors

| Symptom               | Check                             |
| --------------------- | --------------------------------- |
| GraphQL `FORBIDDEN`   | Token scopes; repo write access   |
| Cannot resolve        | Same; resolving requires write    |
| Empty `reviewThreads` | Wrong PR number or fork repo name |

## Optional extension

`gh extension install agynio/gh-pr-review` adds `gh pr-review threads list|resolve`. Prefer raw GraphQL above unless the user standardizes on that extension.
