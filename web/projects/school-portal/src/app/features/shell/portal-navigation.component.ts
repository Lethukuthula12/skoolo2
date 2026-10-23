import { Component, effect, input, output, signal } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface PortalNavigationGroup {
  label: string;
  items: { label: string; link: string; icon: SafeHtml }[];
}

@Component({
  selector: 'app-portal-navigation',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './portal-navigation.component.html',
  styleUrl: './portal-navigation.component.scss',
  host: { '[class.compact]': 'compact()' },
})
export class PortalNavigationComponent {
  readonly groups = input.required<PortalNavigationGroup[]>();
  readonly schoolName = input.required<string>();
  readonly activeGroup = input.required<string>();
  readonly compact = input(false);
  readonly navigated = output<void>();
  private readonly expanded = signal<Record<string, boolean>>({});

  constructor() {
    effect(() => { this.activeGroup(); this.expanded.set({}); });
  }
  protected groupOpen(label: string): boolean { return this.compact() || (this.expanded()[label] ?? label === this.activeGroup()); }
  protected toggleGroup(label: string): void { this.expanded.update(value => ({ ...value, [label]: !this.groupOpen(label) })); }
}
