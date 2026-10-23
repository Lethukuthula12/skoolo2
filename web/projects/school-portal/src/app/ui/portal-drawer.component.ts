import { Component, ElementRef, afterRenderEffect, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-portal-drawer',
  template: `
    <dialog #dialog class="drawer" [class.navigation]="navigation()" [attr.aria-label]="title()"
      (cancel)="cancel($event)" (click)="backdrop($event)">
      <header><h2>{{ title() }}</h2><button type="button" class="close" aria-label="Close panel"
        [disabled]="!dismissible()" (click)="requestClose()">×</button></header>
      <div class="drawer-body"><ng-content /></div>
    </dialog>
  `,
  styleUrl: './portal-drawer.component.scss',
})
export class PortalDrawerComponent {
  readonly title = input.required<string>();
  readonly open = input(false);
  readonly navigation = input(false);
  readonly dismissible = input(true);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }
  protected requestClose(): void { if (this.dismissible()) this.closed.emit(); }
  protected cancel(event: Event): void { event.preventDefault(); this.requestClose(); }
  protected backdrop(event: MouseEvent): void {
    const dialog = this.dialog().nativeElement;
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom)) this.requestClose();
  }
}
