/**
 * Email port (ADR-004, ADR-008). Notifications are sent via this interface so the
 * concrete provider (Resend / SendGrid / SES) stays swappable and out of the domain.
 * Sending runs as a Cloud Tasks job with retries — a down provider becomes a delay,
 * never a lost order.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
