import { useRef, useState } from "react";
import { FileText, PenLine, UploadCloud, X } from "lucide-react";
import { PurchaseForm } from "../components/PurchaseForm";
import { api, upload } from "../services/api";
import type { Extraction, Purchase } from "../types";

export function AddPurchase({
  timezone,
  saved,
}: {
  timezone: string;
  saved: (p: Purchase) => void;
}) {
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [extraction, setExtraction] = useState<Extraction>();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function process(file?: File) {
    if (!file || progress !== null) return;
    setError("");
    if (file.size > 10 * 1024 * 1024) {
      setError("The maximum file size is 10 MB.");
      return;
    }
    setProgress(0);
    try {
      setExtraction(await upload(file, setProgress));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }
  async function discard() {
    if (!extraction) return;
    try {
      await api(`/documents/${extraction.document.id}`, { method: "DELETE" });
      setExtraction(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A place for every purchase</span>
          <h1>Add a purchase</h1>
          <p>Keep your receipt. Know your options.</p>
        </div>
      </div>
      {!extraction && (
        <div className="tabs" role="group" aria-label="Add purchase method">
          <button
            className={mode === "upload" ? "selected" : ""}
            onClick={() => setMode("upload")}
          >
            <UploadCloud size={17} />
            Upload receipt
          </button>
          <button
            className={mode === "manual" ? "selected" : ""}
            onClick={() => setMode("manual")}
          >
            <PenLine size={17} />
            Enter manually
          </button>
        </div>
      )}
      {mode === "upload" && !extraction && (
        <section
          className={`upload-zone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void process(e.dataTransfer.files[0]);
          }}
        >
          <span className="upload-icon">
            <UploadCloud size={36} strokeWidth={1.5} />
          </span>
          <h2>
            {progress === null
              ? "Drop your receipt here"
              : progress < 100
                ? `Uploading… ${progress}%`
                : "Reading your receipt…"}
          </h2>
          <p>Text-based PDF invoices, up to 10 MB.</p>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Upload PDF receipt"
            onChange={(e) => void process(e.target.files?.[0])}
          />
          <button
            className="button"
            disabled={progress !== null}
            onClick={() => input.current?.click()}
          >
            <FileText size={17} />
            Choose a PDF
          </button>
          {progress !== null && (
            <progress value={progress} max={100} aria-label="Upload progress" />
          )}
          <p className="privacy-caption">
            Processed on your computer. No external AI or upload service.
          </p>
          <p className="muted small">
            Image and scanned receipts need OCR, which is not included yet.
          </p>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {extraction && (
        <div className="attachment-strip">
          <FileText size={17} />
          {extraction.document.original_filename}
          <button
            className="icon-button"
            aria-label="Discard uploaded receipt"
            onClick={() => void discard()}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {(mode === "manual" || extraction) && (
        <PurchaseForm
          key={extraction?.document.id || "manual"}
          timezone={timezone}
          extraction={extraction}
          saved={saved}
        />
      )}
    </>
  );
}
