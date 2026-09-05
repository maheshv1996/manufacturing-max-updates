import { test } from "node:test";
import assert from "node:assert/strict";
import { transitionIdea, upvoteIdea, validateIdeaDraft, type IdeaInput } from "../src/lib/lean/ideas";

const NOW = new Date("2026-09-05T06:00:00Z");

const idea = (over: Partial<IdeaInput> = {}): IdeaInput => ({
  id: "i1",
  title: "Shadow board for tools",
  description: "Paint outlines so missing tools are obvious",
  status: "SUBMITTED",
  votes: 3,
  ...over,
});

test("draft: title + description mandatory", () => {
  assert.equal(validateIdeaDraft({ title: " ", description: "d" }).tag, "err");
  assert.equal(validateIdeaDraft({ title: "T", description: "" }).tag, "err");
  const r = validateIdeaDraft({ title: "T", description: "d" });
  assert.equal(r.tag, "ok");
  if (r.tag === "ok") {
    assert.equal(r.value.status, "SUBMITTED");
    assert.equal(r.value.votes, 0);
  }
});

test("pipeline SUBMITTED → IN_REVIEW → IMPLEMENTED, each step only from its source", () => {
  const wrongStart = transitionIdea(idea(), "START_REVIEW", "sup1", NOW);
  assert.equal(wrongStart.tag, "ok");
  const notYet = transitionIdea(idea(), "IMPLEMENT", "sup1", NOW);
  assert.equal(notYet.tag, "err");

  const review = transitionIdea(idea(), "START_REVIEW", "sup1", NOW);
  assert.equal(review.tag, "ok");
  if (review.tag === "ok") assert.equal(review.value.status, "IN_REVIEW");

  const again = transitionIdea(idea({ status: "IN_REVIEW" }), "START_REVIEW", "sup1", NOW);
  assert.equal(again.tag, "err");

  const done = transitionIdea(idea({ status: "IN_REVIEW" }), "IMPLEMENT", "sup1", NOW);
  assert.equal(done.tag, "ok");
  if (done.tag === "ok") assert.equal(done.value.status, "IMPLEMENTED");

  const afterEnd = transitionIdea(idea({ status: "IMPLEMENTED" }), "IMPLEMENT", "sup1", NOW);
  assert.equal(afterEnd.tag, "err");
});

test("upvote is additive and never mutates status", () => {
  const v = upvoteIdea(idea());
  assert.equal(v.votes, 4);
  assert.equal(upvoteIdea(idea({ votes: 0 })).votes, 1);
});
