import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonIcon, IonInput, IonRefresher, IonRefresherContent,
  IonSpinner, IonToolbar, RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { ActionFeedbackComponent, ApplicationService, AuthService, ChildSummary, MyChild, ParentNotice, SchoolEvent } from '@skoolo/shared';
import { ChildCardComponent } from './child-card.component';
import { SchoolThemeService } from '../../school-theme.service';

@Component({
  selector: 'app-children-page',
  imports: [ActionFeedbackComponent, DatePipe, ReactiveFormsModule, RouterLink, IonButton, IonContent, IonHeader, IonIcon,
    IonInput, IonRefresher, IonRefresherContent, IonSpinner, IonToolbar, ChildCardComponent],
  templateUrl: './children.page.html',
  styleUrl: './children.page.scss',
})
export class ChildrenPage {
  private readonly applications = inject(ApplicationService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(SchoolThemeService);
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private loadVersion = 0;

  protected readonly today = new Date();
  protected readonly firstName = computed(() => {
    const name = String(this.auth.user()?.user_metadata?.['full_name'] ?? '').trim();
    return name ? name.split(/\s+/)[0] : '';
  });
  protected readonly greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  protected readonly children = signal<MyChild[]>([]);
  protected readonly summaries = signal<Record<string, ChildSummary>>({});
  protected readonly notices = signal<ParentNotice[]>([]);
  protected readonly events = signal<SchoolEvent[]>([]);
  protected readonly updatesError = signal(false);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly showConnect = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly linkError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    code: ['', [Validators.required, Validators.minLength(6)]], relationship: [''],
  });

  // Ionic retains pages between visits; refresh on entry so school updates stay current.
  ionViewWillEnter(): void { void this.load(); }
  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    try { await Promise.all([this.load(), this.theme.refreshForParent()]); } finally { await event.target.complete(); }
  }
  protected async link(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true); this.linkError.set(null); this.notice.set(null);
    const { code, relationship } = this.form.getRawValue();
    try {
      const child = await this.applications.redeemFamilyCode(code, relationship);
      this.notice.set(`You're connected to ${child.first_name} ${child.last_name}.`);
      this.form.reset({ code: '', relationship: '' });
      this.showConnect.set(false);
      void this.theme.refreshForParent();
      await this.load();
    } catch (err) {
      this.linkError.set(err instanceof Error ? err.message : 'Could not connect your child. Please try again.');
    } finally { this.busy.set(false); }
  }

  protected async load(): Promise<void> {
    const version = ++this.loadVersion;
    this.loading.set(true); this.loadError.set(null); this.updatesError.set(false);
    this.summaries.set({}); this.notices.set([]); this.events.set([]);
    try {
      const kids = await this.applications.myChildren();
      if (version !== this.loadVersion) return;
      this.children.set(kids);
      const [summaries, notices, events] = await Promise.all([
        Promise.allSettled(kids.map((child) => this.applications.childSummary(child.id))),
        this.applications.parentNotices().then((value) => ({ value, failed: false }), () => ({ value: [] as ParentNotice[], failed: true })),
        this.applications.schoolEvents().then((value) => ({ value, failed: false }), () => ({ value: [] as SchoolEvent[], failed: true })),
      ]);
      if (version !== this.loadVersion) return;
      const next: Record<string, ChildSummary> = {};
      summaries.forEach((result, index) => {
        if (result.status === 'fulfilled') next[kids[index].id] = result.value;
      });
      this.summaries.set(next);
      this.notices.set(notices.value.slice(0, 1)); this.events.set(events.value.slice(0, 3));
      this.updatesError.set(notices.failed || events.failed);
    } catch {
      if (version === this.loadVersion) {
        this.children.set([]);
        this.loadError.set('We couldn’t load your family. Check your connection and try again.');
      }
    } finally { if (version === this.loadVersion) this.loading.set(false); }
  }
}
