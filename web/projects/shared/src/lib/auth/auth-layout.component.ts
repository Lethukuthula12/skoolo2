import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A shared welcome frame; each app owns its form and sign-in behaviour. */
@Component({
  selector: 'skoolo-auth-layout',
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  readonly audience = input<'school' | 'parent'>('school');
}
