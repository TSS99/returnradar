export async function readPdf(file: File, progress: (n: number) => void) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("The maximum file size is 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error(
      "Choose a PDF file. Images need OCR, which is not supported yet.",
    );
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const loading = pdf.getDocument({
    data: bytes,
    stopAtErrors: true,
    useSystemFonts: false,
    disableFontFace: true,
  });
  const timeout = setTimeout(() => void loading.destroy(), 20000);
  try {
    const doc = await loading.promise;
    if (doc.numPages > 50) throw new Error("Use a PDF with at most 50 pages.");
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item)
          text += item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ");
      }
      text += "\n";
      if (text.length > 200000)
        throw new Error(
          "This PDF contains too much text. Upload a smaller receipt.",
        );
      progress(Math.round((35 * i) / doc.numPages));
    }
    if (text.trim().length < 10)
      throw new Error(
        "No readable text found. Scanned receipts need OCR; please enter the details manually.",
      );
    return text;
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException")
      throw new Error(
        "Password-protected PDFs are not supported. Upload an unlocked copy.",
      );
    throw e;
  } finally {
    clearTimeout(timeout);
    await loading.destroy();
  }
}
