const PRINT_TEXT_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Escape data for HTML text and quoted attributes. Never use this for JavaScript or CSS. */
export function escapePrintText(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => PRINT_TEXT_ENTITIES[character]!);
}

/** Print images may use absolute HTTPS URLs, without embedded credentials. */
export function printImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

// Printed documents contain no scripts, forms or embedded objects. Keep this before any data.
export const PRINT_DOCUMENT_POLICY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https:; base-uri 'none'; form-action 'none'">`;

/** The caller must escape every stored value before composing the document. */
export function openPrintDocument(html: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.opener = null;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
