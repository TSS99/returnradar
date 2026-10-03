import { readPdf } from "./pdf";
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-ReturnRadar-Request": "1",
      ...options?.headers,
    },
  });
  const data = (await response.json()) as {
    errors?: { field: string; message: string }[];
    detail?: string;
  };
  if (!response.ok) {
    const errors = data.errors
      ?.map(
        (e: { field: string; message: string }) => `${e.field}: ${e.message}`,
      )
      .join("; ");
    throw new Error(
      errors ||
        data.detail ||
        "Could not complete this action. Please try again.",
    );
  }
  return data as T;
}

export async function upload(
  file: File,
  progress: (value: number) => void,
): Promise<import("../types").Extraction> {
  const text = await readPdf(file, progress);
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/documents");
    request.setRequestHeader("X-ReturnRadar-Request", "1");
    request.upload.onprogress = (e) => {
      if (e.lengthComputable)
        progress(35 + Math.round((e.loaded / e.total) * 65));
    };
    request.onerror = () =>
      reject(new Error("Upload failed. Check your connection and try again."));
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText);
        if (request.status >= 200 && request.status < 300) resolve(result);
        else
          reject(
            new Error(result.detail || "Could not extract this document."),
          );
      } catch {
        reject(new Error("Could not process the upload response."));
      }
    };
    const form = new FormData();
    form.append("file", file);
    form.append("extracted_text", text);
    request.send(form);
  });
}

export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
