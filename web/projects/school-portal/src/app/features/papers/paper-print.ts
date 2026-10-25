import { escapePrintText as text, printImageUrl } from '../../ui/print-document';
import { Paper, paperQuestions, rasterImage } from './paper.model';

/** Learner output never includes answer fields, including in hidden HTML or metadata. */
export function paperPrintHtml(paper: Paper, memorandum: boolean): string {
  const context = paper.display_context as Record<string, string | number | null>;
  const logo = printImageUrl(String(context['badge_url'] ?? ''));
  let number = 0;
  const blocks = paperQuestions(paper).map(q => {
    if (q.type === 'page_break') return '<div class="page-break"></div>';
    if (q.type === 'section') return `<section><h2>${text(q.text)}</h2></section>`;
    number++;
    const heading = `<div class="question-title"><strong>${number}. ${text(q.text)}</strong><span>[${text(q.marks)}]</span></div>`;
    if (memorandum) return `<section>${heading}<p class="answer">${text(q.answer || 'No marking guidance provided.')}</p></section>`;
    const image = rasterImage(q.image);
    const options = q.type === 'choice' ? `<ol type="A">${q.options.split('\n').filter(s => s.trim()).map(s => `<li>${text(s)}</li>`).join('')}</ol>` : '';
    const table = q.type === 'table' ? `<table>${q.cells.split('\n').map(row => `<tr>${row.split('|').map(cell => `<td>${text(cell)}</td>`).join('')}</tr>`).join('')}</table>` : '';
    const lines = Array.from({ length: Math.min(30, Math.max(0, Math.floor(q.lines))) }, () => '<div class="answer-line"></div>').join('');
    return `<section>${heading}${image ? `<img class="question-image" src="${text(image)}" alt="${text(q.text)}">` : ''}${options}${table}${lines}</section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'"><title>${text(paper.title)}${memorandum ? ' — Memorandum' : ''}</title>
  <style>
    @page{size:A4;margin:16mm} *{box-sizing:border-box} body{font:12pt Arial,sans-serif;line-height:1.5;color:#111;background:#fff;margin:0;padding:16mm;overflow-wrap:anywhere}
    header{text-align:center;border-bottom:2px solid #111;padding-bottom:14px} .logo{max-height:70px;max-width:130px} h1{font-size:18pt;margin:8px 0} h2{font-size:14pt;white-space:pre-wrap} p{white-space:pre-wrap}
    .meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10pt}.banner{border:2px solid #555;padding:8px;text-align:center;font-weight:bold;margin-bottom:12px}
    section{margin:20px 0;break-inside:avoid} .question-title{display:flex;justify-content:space-between;gap:16px;white-space:pre-wrap}.question-title span{white-space:nowrap}
    .question-image{display:block;max-width:100%;max-height:210mm;margin:12px auto} .answer-line{height:9mm;border-bottom:1px solid #aaa} table{border-collapse:collapse;width:100%;margin:12px 0;table-layout:fixed} td{border:1px solid #555;padding:8px}
    li{white-space:pre-wrap} .page-break{break-before:page} footer{border-top:1px solid #aaa;margin-top:24px;padding-top:8px;font-size:10pt;white-space:pre-wrap}.answer{margin:8px 0 0} @media print{body{padding:0}}
  </style></head><body>
  ${paper.status !== 'approved' ? '<div class="banner">DRAFT — NOT APPROVED</div>' : ''}
  ${memorandum ? '<div class="banner">MEMORANDUM — STAFF ONLY</div>' : ''}
  <header>${logo ? `<img class="logo" src="${text(logo)}" alt="School badge">` : ''}<h1>${text(context['school_name'])}</h1><h2>${text(paper.title)}</h2>
    <div class="meta"><span>${text(context['subject_name'])} · ${text(context['class_name'])}</span><span>Term ${text(paper.term_number)} · ${text(context['academic_year'])}</span></div>
    <div class="meta"><span>Date: ${text(paper.assessed_on || '________________')}</span><span>${text(paper.duration_minutes)} minutes · ${text(paper.total_marks)} marks</span></div>
  </header>
  ${!memorandum ? '<p>Name: ____________________________________ &nbsp; Class: __________</p>' : ''}
  <p>${text(paper.instructions)}</p>${blocks}<p><strong>Total: ${text(paper.total_marks)} marks</strong></p><footer>${text(paper.footer)}</footer>
  </body></html>`;
}

/** Open synchronously to preserve the click gesture, then wait for images before printing. */
export async function printPaper(paper: Paper, memorandum: boolean): Promise<void> {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Allow pop-ups for Skoolo to open the print preview.');
  popup.opener = null;
  popup.document.write(paperPrintHtml(paper, memorandum));
  popup.document.close();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(Array.from(popup.document.images, img => img.decode())),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Image loading timed out.')), 15000); }),
    ]);
  } catch {
    popup.close();
    throw new Error('An image could not load. Check your connection and preview the paper again before printing.');
  } finally { clearTimeout(timer); }
  popup.focus();
  popup.print();
}
