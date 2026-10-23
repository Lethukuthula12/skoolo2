import { Signal, computed, linkedSignal, signal } from '@angular/core';

/** Client-side paging of already authorised rows; filtering never changes a database query. */
export class TablePagination<T> {
  readonly pageSize = signal(25);
  private readonly requestedPage = linkedSignal({
    source: () => ({ filter: this.filterKey(), size: this.pageSize() }),
    computation: () => 1,
  });
  readonly total = computed(() => this.rows().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly page = computed(() => Math.min(this.requestedPage(), this.pageCount()));
  readonly start = computed(() => (this.page() - 1) * this.pageSize());
  readonly end = computed(() => Math.min(this.total(), this.start() + this.pageSize()));
  readonly visible = computed(() => this.rows().slice(this.start(), this.end()));

  constructor(private readonly rows: Signal<readonly T[]>, private readonly filterKey: Signal<unknown>) {}

  goTo(page: number): void {
    if (Number.isFinite(page)) this.requestedPage.set(Math.max(1, Math.min(Math.trunc(page), this.pageCount())));
  }
  resize(value: number): void {
    if ([10, 25, 50].includes(value)) this.pageSize.set(value);
  }
}
