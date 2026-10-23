import { Component, input } from '@angular/core';
import { TablePagination } from './table-pagination';

@Component({
  selector: 'app-table-pagination',
  template: `
    @let p = pagination();
    <div class="pagination">
      <span class="range" role="status">Showing {{ p.total() ? p.start() + 1 : 0 }}–{{ p.end() }} of {{ p.total() }}</span>
      <label>Rows per page <select [value]="p.pageSize()" (change)="p.resize(+$any($event.target).value)">
        <option value="10">10</option><option value="25">25</option><option value="50">50</option>
      </select></label>
      <nav aria-label="Table pages">
        <button class="btn btn-outline" type="button" [disabled]="p.page() === 1" (click)="p.goTo(p.page() - 1)" aria-label="Previous page">‹</button>
        <span>{{ p.page() }} / {{ p.pageCount() }}</span>
        <button class="btn btn-outline" type="button" [disabled]="p.page() === p.pageCount()" (click)="p.goTo(p.page() + 1)" aria-label="Next page">›</button>
      </nav>
    </div>
  `,
  styles: `
    .pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; border-top: 1px solid var(--line); padding-top: 18px; color: var(--muted); font-size: 13px; }
    .range { margin-right: auto; }
    label, nav { display: flex; align-items: center; gap: 10px; }
    select { width: 76px; min-height: 44px; }
    nav button { padding: 0; width: 44px; font-size: 22px; }
    nav span { min-width: 44px; text-align: center; }
    @media (max-width: 560px) { .range { width: 100%; } label { margin-right: auto; } }
  `,
})
export class TablePaginationComponent {
  readonly pagination = input.required<TablePagination<unknown>>();
}
