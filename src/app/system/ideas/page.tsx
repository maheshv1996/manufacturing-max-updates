"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Lightbulb,
  ThumbsUp,
  Award,
  CheckCircle2,
  Plus,
  RefreshCw,
  Sliders,
  X,
} from "lucide-react";

interface IdeaItem {
  id: string;
  title: string;
  description: string;
  category: "SAFETY" | "FIVES" | "CYCLE_TIME" | "ERGONOMICS";
  submittedBy: string;
  upvotes: number;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "IMPLEMENTED";
  createdAt: string;
}

interface Contributor {
  name: string;
  total: number;
  implemented: number;
  totalUpvotes: number;
}

export default function IdeasDashboardPage() {
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterStatus] = useState<string>("ALL");

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("CYCLE_TIME");
  const [submitterInput, setSubmitterInput] = useState("Operator");
  const [submitting, setSubmitting] = useState(false);

  const fetchIdeasData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/ideas");
      const data = await res.json();
      setIdeas(data.ideas || []);
      setLeaderboard(data.leaderboard || []);
    } catch (e) {
      logClientError(e, "page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeasData();
  }, []);

  const handleUpvote = async (id: string) => {
    // Optimistic update
    setIdeas((prev) =>
      prev.map((i) => (i.id === id ? { ...i, upvotes: i.upvotes + 1 } : i)),
    );

    try {
      await fetch("/api/ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "UPVOTE" }),
      });
    } catch (e) {
      logClientError("Upvote error:", e, "page");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        fetchIdeasData();
      }
    } catch (e) {
      logClientError("Status change error:", e, "page");
    }
  };

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleInput.trim(),
          description: descInput.trim(),
          category: categoryInput,
          submittedBy: submitterInput.trim() || "Operator",
        }),
      });

      if (res.ok) {
        alert("Idea submitted successfully!");
        setShowAddModal(false);
        setTitleInput("");
        setDescInput("");
        fetchIdeasData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit idea");
      }
    } catch (e) {
      alert("Error submitting idea");
    } finally {
      setSubmitting(false);
    }
  };

  const totalUpvotes = ideas.reduce((sum, i) => sum + i.upvotes, 0);
  const implementedCount = ideas.filter(
    (i) => i.status === "IMPLEMENTED",
  ).length;
  const topContributor = leaderboard.length > 0 ? leaderboard[0].name : "—";

  const filteredIdeas = ideas.filter((i) => {
    const catMatch = filterCategory === "ALL" || i.category === filterCategory;
    const statMatch = filterStatus === "ALL" || i.status === filterStatus;
    return catMatch && statMatch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-amber-400" />
              Employee Idea Box & Continuous Improvement
            </h1>
            <p className="text-xs text-slate-400">
              Shopfloor Kaizen upvoting board, status pipeline, and Lean
              Contributor Leaderboard.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchIdeasData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Submit Shopfloor Idea
            </button>
          </div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Total Ideas Submitted
              </span>
              <Lightbulb className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-black font-mono text-amber-400">
              {ideas.length}
            </div>
            <p className="text-[11px] text-slate-400">
              Continuous improvement proposals
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Peer Upvotes Logged
              </span>
              <ThumbsUp className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-black font-mono text-blue-400">
              {totalUpvotes}
            </div>
            <p className="text-[11px] text-slate-400">Community votes cast</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Implemented Kaizens
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-black font-mono text-emerald-400">
              {implementedCount}
            </div>
            <p className="text-[11px] text-slate-400">
              Deployed on shopfloor lines
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs uppercase font-extrabold">
                Top Lean Contributor
              </span>
              <Award className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-300 truncate">
              {topContributor}
            </div>
            <p className="text-[11px] text-slate-400">
              Leading shopfloor innovator
            </p>
          </div>
        </div>

        {/* MAIN CONTENT GRID: UPVOTING BOARD (2/3) + LEADERBOARD (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* UPVOTING BOARD */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  Continuous Improvement Board ({filteredIdeas.length})
                </h2>

                {/* FILTERS */}
                <div className="flex flex-wrap gap-2">
                  {["ALL", "SAFETY", "FIVES", "CYCLE_TIME", "ERGONOMICS"].map(
                    (cat) => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-all cursor-pointer ${
                          filterCategory === cat
                            ? "bg-amber-500 text-slate-950 shadow-md"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {cat.replace("_", " ")}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs animate-pulse">
                  Loading Idea Board...
                </div>
              ) : filteredIdeas.length === 0 ? (
                <div className="py-12 text-center text-slate-500 italic text-xs">
                  No ideas match the current filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredIdeas.map((idea) => {
                    const isSafety = idea.category === "SAFETY";
                    const isFives = idea.category === "FIVES";
                    const isCycle = idea.category === "CYCLE_TIME";

                    const categoryBadge = isSafety
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : isFives
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : isCycle
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          : "bg-purple-500/20 text-purple-300 border-purple-500/40";

                    const isImplemented = idea.status === "IMPLEMENTED";
                    const isApproved = idea.status === "APPROVED";
                    const isReview = idea.status === "UNDER_REVIEW";

                    const statusBadge = isImplemented
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : isApproved
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : isReview
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700";

                    return (
                      <div
                        key={idea.id}
                        className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 shadow-md hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start justify-between gap-4"
                      >
                        {/* UPVOTE BUTTON */}
                        <button
                          onClick={() => handleUpvote(idea.id)}
                          className="p-3 bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-2xl flex flex-col items-center justify-center text-amber-400 hover:text-amber-300 transition-all cursor-pointer shrink-0 min-w-[64px]"
                        >
                          <ThumbsUp className="w-5 h-5 mb-1" />
                          <span className="text-lg font-black font-mono">
                            {idea.upvotes}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">
                            Votes
                          </span>
                        </button>

                        {/* CONTENT */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded border ${categoryBadge}`}
                            >
                              {idea.category.replace("_", " ")}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded border ${statusBadge}`}
                            >
                              {idea.status.replace("_", " ")}
                            </span>
                          </div>

                          <h3 className="text-base font-extrabold text-white">
                            {idea.title}
                          </h3>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">
                            {idea.description}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-900">
                            <span>
                              Submitted by:{" "}
                              <strong className="text-white font-sans">
                                {idea.submittedBy}
                              </strong>
                            </span>
                            <span>
                              {new Date(idea.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* SUPERVISOR PIPELINE DROPDOWN */}
                        <div className="sm:self-center shrink-0">
                          <select
                            value={idea.status}
                            onChange={(e) =>
                              handleStatusChange(idea.id, e.target.value)
                            }
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                          >
                            <option value="SUBMITTED">Submitted</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="APPROVED">Approved</option>
                            <option value="IMPLEMENTED">Implemented</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* SHOPFLOOR LEAN CONTRIBUTOR LEADERBOARD (1/3) */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-extrabold uppercase text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-400" />
                  Shopfloor Lean Contributors
                </h2>
                <span className="text-[10px] text-purple-400 font-mono font-bold">
                  Top Innovators
                </span>
              </div>

              {leaderboard.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-4 text-center">
                  No contributor data yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((c, idx) => {
                    const medal =
                      idx === 0
                        ? "🥇"
                        : idx === 1
                          ? "🥈"
                          : idx === 2
                            ? "🥉"
                            : `#${idx + 1}`;
                    return (
                      <div
                        key={c.name}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-xs shadow-sm ${
                          idx === 0
                            ? "bg-purple-950/40 border-purple-500/40 text-purple-100"
                            : "bg-slate-950 border-slate-800 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base font-black font-mono">
                            {medal}
                          </span>
                          <div>
                            <strong className="text-white text-xs block">
                              {c.name}
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              {c.total} submitted • {c.totalUpvotes} upvotes
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-emerald-400 font-extrabold text-sm block">
                            {c.implemented}
                          </span>
                          <span className="text-[9px] uppercase text-slate-400 block">
                            Implemented
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUBMIT IDEA MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <form
            onSubmit={handleCreateIdea}
            className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                Submit Shopfloor Idea
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ravi Kumar"
                  value={submitterInput}
                  onChange={(e) => setSubmitterInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Category *
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="SAFETY">Safety Improvement</option>
                  <option value="FIVES">5S & Organization</option>
                  <option value="CYCLE_TIME">Cycle Time Reduction</option>
                  <option value="ERGONOMICS">Ergonomics & Workstation</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Idea Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shadow board for hex keys on CNC Machine 01"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain the problem and your proposed Kaizen solution..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer"
              >
                {submitting ? "Submitting..." : "Submit Idea"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
