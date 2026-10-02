import path from "node:path";

import { Font, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { ReportDocument } from "@/lib/report/ReportDocument";
import type { ResultBundle } from "@/types/feedback";

let previousRender = Promise.resolve();

export async function renderReport(data: ResultBundle): Promise<Buffer> {
  const previous = previousRender;
  let release: () => void = () => undefined;
  previousRender = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    Font.clear();
    Font.register({ family: "Helvetica", src: "Helvetica" });
    Font.register({ family: "DejaVu", src: path.join(process.cwd(), "public/fonts/DejaVuSans.ttf") });
    return await renderToBuffer(React.createElement(ReportDocument, { data }) as never);
  } finally {
    release();
  }
}
