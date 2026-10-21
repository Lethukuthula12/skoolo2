import { Component, inject, input } from '@angular/core';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '@skoolo/shared';

/** Placeholder: the application form is built on day two. */
@Component({
  selector: 'app-apply-page',
  imports: [IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start"><ion-back-button defaultHref="/" text="" /></ion-buttons>
        <ion-title>Apply</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="form-card">
        <h2>Application form</h2>
        <p>Signed in as {{ auth.user()?.email }}. Applying to <strong>{{ slug() }}</strong>.</p>
        <p>The application form arrives next.</p>
      </div>
    </ion-content>
  `,
})
export class ApplyPage {
  protected readonly auth = inject(AuthService);
  readonly slug = input.required<string>();
}
