import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText } from "unpdf";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const getExtension = (filename: string) => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Limit is 15MB." },
        { status: 400 },
      );
    }

    const ext = getExtension(file.name) ?? "";
    const buffer = Buffer.from(await file.arrayBuffer());

    let text = "";

    if (ext === "pdf" || file.type === "application/pdf") {
      const result = await extractText(new Uint8Array(buffer));
      // unpdf returns { text: string, totalPages: number } or { text: string[] } depending on version
      text = Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text ?? "");
    } else if (
      ext === "docx" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const parsed = await mammoth.extractRawText({ buffer });
      text = parsed.value ?? "";
    } else if (ext === "txt" || file.type === "text/plain") {
      text = buffer.toString("utf8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, or TXT." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        filename: file.name,
        text: text.trim(),
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error.";
    console.error("Parse error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
