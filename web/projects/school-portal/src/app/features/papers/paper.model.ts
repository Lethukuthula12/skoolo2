import type { Tables } from '@skoolo/shared';

export type Paper = Tables<'assessment_papers'>;
export type PaperTemplate = Tables<'paper_templates'>;
export type PaperEvent = Tables<'paper_events'>;
export type BlockType = 'section' | 'short' | 'long' | 'choice' | 'image' | 'table' | 'page_break';
export interface PaperQuestion {
  type: BlockType;
  text: string;
  marks: number;
  lines: number;
  options: string;
  cells: string;
  image: string;
  answer: string;
}
export interface PaperContent {
  title: string; class_id: string; subject_id: string; reviewer_id: string;
  term_number: number; kind: string; assessed_on: string; duration_minutes: number;
  instructions: string; footer: string; questions: PaperQuestion[];
}
export const BLOCK_LABELS: Record<BlockType, string> = {
  section: 'Heading / instructions', short: 'Short answer', long: 'Long answer',
  choice: 'Multiple choice', image: 'Image question', table: 'Table question', page_break: 'Page break',
};
export function blankQuestion(type: BlockType = 'short'): PaperQuestion {
  return { type, text: '', marks: ['section', 'page_break'].includes(type) ? 0 : 1,
    lines: type === 'long' ? 8 : type === 'short' ? 2 : 0, options: '', cells: '', image: '', answer: '' };
}
export function paperQuestions(paper: Paper): PaperQuestion[] { return paper.questions as unknown as PaperQuestion[]; }
export function questionTotal(questions: PaperQuestion[]): number {
  return Math.round(questions.reduce((total, q) => total + Number(q.marks || 0), 0) * 100) / 100;
}
export function rasterImage(value: string): string | null {
  return value.length <= 1400000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}
