import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { ChildSummary, MyChild } from '@skoolo/shared';

@Component({
  selector: 'app-child-card',
  imports: [RouterLink, IonIcon],
  templateUrl: './child-card.component.html',
  styleUrl: './child-card.component.scss',
})
export class ChildCardComponent {
  readonly child = input.required<MyChild>();
  readonly summary = input<ChildSummary>();
  readonly index = input(0);
  protected readonly initials = computed(() => {
    const child = this.child();
    return `${child.first_name[0] ?? ''}${child.last_name[0] ?? ''}`.toUpperCase();
  });
  private readonly currency = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
  protected money(amount: number): string { return this.currency.format(amount); }
}
