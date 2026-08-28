"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Eye,
  Archive,
  UploadCloud,
  AlertTriangle,
  FileCheck,
  Search,
  Filter,
  X,
  Loader2,
  Clock,
  User,
  Info,
} from "lucide-react";
import DrawingLightboxModal from "@/app/components/modals/DrawingLightboxModal";

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface Operation {
  id: string;
  code: string;
  name: string;
}

interface DocumentItem {
  id: string;
  title: string;
  productId: string;
  operationId?: string | null;
  version: number;
  mimeType: string;
  sizeKb: number;
  status: "CURRENT" | "ARCHIVED";
  uploadedBy: string;
  uploadedAt: string;
  notes?: string | null;
  product?: Product;
  operation?: Operation;
}

export default function DocumentsTab() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);

  // Filters
  const [productFilter, setProductFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [uploadProductId, setUploadProductId] = useState<string>("");
  const [uploadOperationId, setUploadOperationId] = useState<string>("");
  const [uploadNotes, setUploadNotes] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Lightbox Preview State
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const fetchDocumentsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [docsRes, adminDataRes] = await Promise.all([
        fetch("/api/admin/documents"),
        fetch("/api/admin/data"),
      ]);

      const docsData = await docsRes.json();
      const adminData = await adminDataRes.json();

      if (docsRes.ok && docsData.documents) {
        setDocuments(docsData.documents);
      }
      if (adminDataRes.ok && adminData.products) {
        setProducts(adminData.products);
        setOperations(adminData.operations || []);
      }
    } catch (err) {
      console.error("Failed to load documents data:", err);
      setError("Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentsData();
  }, []);

  // Check if a CURRENT doc exists for chosen Product + Operation
  const existingCurrentDoc = documents.find((doc) => {
    if (doc.status !== "CURRENT") return false;
    if (doc.productId !== uploadProductId) return false;
    const targetOpId =
      uploadOperationId && uploadOperationId !== "null"
        ? uploadOperationId
        : null;
    return (doc.operationId || null) === targetOpId;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const MAX_BYTES = 4 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        setUploadError(
          `File exceeds 4MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please select a smaller file.`,
        );
        setSelectedFile(null);
        return;
      }
      setUploadError(null);
      setSelectedFile(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !uploadProductId || !selectedFile) {
      setUploadError(
        "Please provide a Title, select a Product, and attach a file.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", uploadTitle);
      formData.append("productId", uploadProductId);
      formData.append("operationId", uploadOperationId || "");
      formData.append("notes", uploadNotes);

      const res = await fetch("/api/admin/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Failed to upload document.");
      } else {
        setShowUploadModal(false);
        setUploadTitle("");
        setUploadProductId("");
        setUploadOperationId("");
        setUploadNotes("");
        setSelectedFile(null);
        fetchDocumentsData();
      }
    } catch (err) {
      setUploadError("Failed to upload document to server.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (
    docId: string,
    docTitle: string,
    version: number,
  ) => {
    if (
      !confirm(
        `Are you sure you want to archive REV ${version} of '${docTitle}'?`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ARCHIVE", documentId: docId }),
      });

      if (res.ok) {
        fetchDocumentsData();
      } else {
        alert("Failed to archive document.");
      }
    } catch (err) {
      alert("Error archiving document.");
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (productFilter !== "ALL" && doc.productId !== productFilter)
      return false;
    if (statusFilter !== "ALL" && doc.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchProd =
        doc.product?.name.toLowerCase().includes(q) ||
        doc.product?.sku.toLowerCase().includes(q);
      const matchOp =
        doc.operation?.name.toLowerCase().includes(q) ||
        doc.operation?.code.toLowerCase().includes(q);
      return matchTitle || matchProd || matchOp;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* HEADER & ACTION BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Revision-Controlled Drawings &amp; SOPs
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Upload station drawings and SOPs. Uploading a document for an
                existing product/operation auto-archives the previous version
                and increments the revision number.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Upload New Drawing / SOP
          </button>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search drawings or SOPs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Product:
            </div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 font-medium focus:outline-none"
            >
              <option value="ALL">All Products ({products.length})</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 text-xs text-slate-400 font-medium ml-2">
              Status:
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 font-medium focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="CURRENT">CURRENT Only</option>
              <option value="ARCHIVED">ARCHIVED Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* DOCUMENTS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            <p className="text-sm font-medium">
              Loading documents repository...
            </p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p className="text-base font-bold text-slate-300">
              No Documents Found
            </p>
            <p className="text-xs text-slate-500">
              No revision-controlled drawings or SOPs match your search/filter
              criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-950 text-slate-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 rounded-l-lg font-semibold">
                    Document Title / Spec
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Product</th>
                  <th className="py-3.5 px-4 font-semibold">
                    Operation Sequence
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    Revision
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    Status
                  </th>
                  <th className="py-3.5 px-4 font-semibold">
                    Uploaded By / Date
                  </th>
                  <th className="py-3.5 px-4 rounded-r-lg font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-sans">
                {filteredDocs.map((doc) => {
                  const isCurrent = doc.status === "CURRENT";

                  return (
                    <tr
                      key={doc.id}
                      className={`transition-colors ${
                        isCurrent
                          ? "hover:bg-slate-800/40"
                          : "opacity-60 bg-slate-950/40 hover:opacity-80"
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <FileText
                            className={`w-4 h-4 ${isCurrent ? "text-blue-400" : "text-slate-500"}`}
                          />
                          {doc.title}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{doc.mimeType}</span>
                          <span>•</span>
                          <span>{doc.sizeKb} KB</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">
                          {doc.product?.name || "N/A"}
                        </div>
                        <div className="text-xs font-mono text-slate-500">
                          {doc.product?.sku}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {doc.operation ? (
                          <span className="px-2.5 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium">
                            {doc.operation.code} — {doc.operation.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            Product-Level (All Ops)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-3 py-1 bg-blue-950 text-blue-300 border border-blue-800 rounded-full font-mono font-black text-xs">
                          REV {doc.version}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isCurrent ? (
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold text-xs">
                            CURRENT
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-xs font-medium">
                            ARCHIVED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-300 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {doc.uploadedBy}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(doc.uploadedAt).toLocaleDateString()}{" "}
                          {new Date(doc.uploadedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="View drawing/SOP lightbox"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            View
                          </button>

                          {isCurrent && (
                            <button
                              onClick={() =>
                                handleArchive(doc.id, doc.title, doc.version)
                              }
                              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-bold rounded-xl border border-slate-700 hover:border-rose-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Archive this version"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* UPLOAD DOCUMENT MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Upload Drawing / SOP
                  </h3>
                  <p className="text-xs text-slate-400">
                    Max size: 4MB (SVG, PNG, JPG, PDF)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Document Title / Specification Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gear Housing Milling & Drill Blueprint"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Target Finished Product *
                  </label>
                  <select
                    required
                    value={uploadProductId}
                    onChange={(e) => setUploadProductId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Target Operation Sequence (Optional)
                  </label>
                  <select
                    value={uploadOperationId}
                    onChange={(e) => setUploadOperationId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Product-Level (All Operations)</option>
                    {operations.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.code} — {op.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DYNAMIC REVISION VERSION HINT BANNER */}
              {uploadProductId && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                    existingCurrentDoc
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 shrink-0" />
                    {existingCurrentDoc
                      ? `Auto-Archive Sequence Triggered (Will create REV ${existingCurrentDoc.version + 1})`
                      : "New Document Sequence (Will create REV 1)"}
                  </div>
                  <p className="text-[11px] opacity-90">
                    {existingCurrentDoc
                      ? `A CURRENT document '${existingCurrentDoc.title}' (REV ${existingCurrentDoc.version}) exists for this combination. Uploading will automatically mark REV ${existingCurrentDoc.version} as ARCHIVED and publish your new file as REV ${existingCurrentDoc.version + 1}.`
                      : "No existing CURRENT document found for this product/operation. This file will be tagged as REV 1."}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Attach File (Image or PDF, Max 4MB) *
                </label>
                <input
                  type="file"
                  required
                  accept="image/*,application/pdf,.svg"
                  onChange={handleFileChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                />
                {selectedFile && (
                  <p className="text-xs text-emerald-400 font-mono mt-1">
                    Selected: {selectedFile.name} (
                    {(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Engineering / Quality Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Critical dimensions, tolerance specs, or safety precautions..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX PREVIEW MODAL */}
      {previewDoc && (
        <DrawingLightboxModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
