import type { ApplicationStatus, PaymentStatus } from '@skoolo/shared';

export function statusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case 'accepted': return 'badge-success';
    case 'declined': return 'badge-danger';
    case 'withdrawn': return 'badge-muted';
    case 'more_info_needed': return 'badge-warning';
    case 'waitlisted': return 'badge-warning';
    default: return '';
  }
}

export function paymentBadgeClass(status: PaymentStatus): string {
  switch (status) {
    case 'confirmed': return 'badge-success';
    case 'marked_paid': return 'badge-warning';
    default: return 'badge-muted';
  }
}

/** Mirrors public.is_allowed_status_transition in the database. */
export function allowedNextStatuses(from: ApplicationStatus): ApplicationStatus[] {
  switch (from) {
    case 'submitted': return ['under_review', 'more_info_needed', 'accepted', 'waitlisted', 'declined'];
    case 'under_review': return ['more_info_needed', 'accepted', 'waitlisted', 'declined'];
    case 'more_info_needed': return ['under_review', 'accepted', 'waitlisted', 'declined'];
    case 'waitlisted': return ['under_review', 'accepted', 'declined'];
    case 'accepted': return ['declined'];
    default: return [];
  }
}
