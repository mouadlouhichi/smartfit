import type { WorkoutExercise } from './types';

export const CONTENT_KINDS = ['exercise', 'workout', 'plan', 'challenge'] as const;
export const PUBLICATION_STATES = ['draft', 'review', 'published', 'archived'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export type PublicationState = (typeof PUBLICATION_STATES)[number];
export interface TrainingContent {
  id: string;
  kind: ContentKind;
  title: string;
  description: string;
  status: PublicationState;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  muscles: string[];
  instructions: string[];
  safetyNotes: string;
  videoUrl: string;
  /** Optional licensed HTTPS card cover; omitted entries use decorative artwork. */
  coverUrl?: string;
  durationMin: number;
  exercises: WorkoutExercise[];
  /** Free content only until verified personal subscription gating is available. */
  access: 'free';
  version: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}
export type ContentDraft = Omit<
  TrainingContent,
  'id' | 'version' | 'createdAt' | 'updatedAt' | 'updatedBy'
>;
export class FeatureError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new FeatureError('Expected an object.');
  return value as Record<string, unknown>;
}
export function textValue(value: unknown, name: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw new FeatureError(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
function strings(value: unknown, label: string, max: number): string[] {
  if (!Array.isArray(value) || value.length > max)
    throw new FeatureError(`${label}: use at most ${max} entries.`);
  return [...new Set(value.map((v) => textValue(v, label, 1, 300)))];
}
export function validateContent(value: unknown): ContentDraft {
  const v = objectValue(value);
  if (!CONTENT_KINDS.includes(v.kind as ContentKind))
    throw new FeatureError('Choose a content type.');
  if (!PUBLICATION_STATES.includes(v.status as PublicationState))
    throw new FeatureError('Choose a publication state.');
  if (!['beginner', 'intermediate', 'advanced'].includes(String(v.difficulty)))
    throw new FeatureError('Choose a difficulty.');
  const durationMin = v.durationMin as number;
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 180)
    throw new FeatureError('Duration must be 5–180 minutes.');
  const coverUrl = textValue(v.coverUrl ?? '', 'Cover URL', 0, 2048);
  if (coverUrl) {
    try {
      const url = new URL(coverUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch {
      throw new FeatureError('Cover URL must be HTTPS without embedded credentials.');
    }
  }
  const videoUrl = textValue(v.videoUrl ?? '', 'Video URL', 0, 2000);
  if (videoUrl) {
    try {
      const url = new URL(videoUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    } catch {
      throw new FeatureError('Video URL must be HTTPS without embedded credentials.');
    }
  }
  if (!Array.isArray(v.exercises) || v.exercises.length > 30)
    throw new FeatureError('Use at most 30 exercises.');
  const exercises: WorkoutExercise[] = v.exercises.map((raw) => {
    const e = objectValue(raw);
    if (!Array.isArray(e.sets) || e.sets.length < 1 || e.sets.length > 10)
      throw new FeatureError('Each exercise needs 1–10 sets.');
    return {
      name: textValue(e.name, 'Exercise name', 2, 100),
      sets: e.sets.map((rawSet) => {
        const set = objectValue(rawSet);
        const reps = set.reps as number;
        if (!Number.isInteger(reps) || reps < 1 || reps > 100)
          throw new FeatureError('Repetitions must be 1–100.');
        return { reps };
      }),
    };
  });
  const instructions = strings(v.instructions, 'Instructions', 20);
  if (v.status === 'published') {
    if (v.kind === 'exercise' && !instructions.length)
      throw new FeatureError('Add instructions before publishing an exercise.');
    if ((v.kind === 'workout' || v.kind === 'plan') && !exercises.length)
      throw new FeatureError('Add exercises before publishing a workout or plan.');
    // Challenge drafts can be authored now; participation rules are a separate release gate.
    if (v.kind === 'challenge')
      throw new FeatureError(
        'Challenge publishing requires participation rules; save as draft or review for now.',
      );
  }
  if (v.access && v.access !== 'free')
    throw new FeatureError(
      'Premium publishing is unavailable until verified entitlements are configured.',
    );
  return {
    kind: v.kind as ContentKind,
    status: v.status as PublicationState,
    title: textValue(v.title, 'Title', 2, 100),
    description: textValue(v.description, 'Description', 0, 2000),
    difficulty: v.difficulty as ContentDraft['difficulty'],
    equipment: strings(v.equipment, 'Equipment', 15),
    muscles: strings(v.muscles, 'Muscles', 15),
    instructions,
    safetyNotes: textValue(v.safetyNotes ?? '', 'Safety notes', 0, 1000),
    videoUrl,
    ...(coverUrl ? { coverUrl } : {}),
    durationMin,
    exercises,
    access: 'free',
  };
}

export const SUPPORT_CATEGORIES = [
  'account',
  'subscription',
  'workout',
  'technical',
  'content',
  'other',
] as const;
export const TICKET_STATES = [
  'open',
  'in-progress',
  'waiting-for-user',
  'resolved',
  'closed',
] as const;
export type TicketState = (typeof TICKET_STATES)[number];
export interface TicketMessage {
  id: string;
  authorUid: string;
  staff: boolean;
  body: string;
  at: number;
}
export interface SupportTicket {
  id: string;
  ownerUid: string;
  category: (typeof SUPPORT_CATEGORIES)[number];
  subject: string;
  status: TicketState;
  messages: TicketMessage[];
  version: number;
  createdAt: number;
  updatedAt: number;
}
export function validateTicket(value: unknown) {
  const v = objectValue(value);
  if (!SUPPORT_CATEGORIES.includes(v.category as SupportTicket['category']))
    throw new FeatureError('Choose a support category.');
  return {
    category: v.category as SupportTicket['category'],
    subject: textValue(v.subject, 'Subject', 3, 120),
    message: textValue(v.message, 'Message', 10, 2000),
  };
}
export function canAccessTicket(uid: string, ownerUid: string, role: string): boolean {
  return uid === ownerUid || role === 'platform-admin' || role === 'support-agent';
}
export function ticketTransition(from: TicketState, to: TicketState, staff: boolean): boolean {
  const transitions: Record<TicketState, TicketState[]> = {
    open: ['in-progress', 'waiting-for-user', 'resolved', 'closed'],
    'in-progress': ['waiting-for-user', 'resolved', 'closed'],
    'waiting-for-user': ['in-progress', 'resolved', 'closed'],
    resolved: ['open', 'closed'],
    closed: ['open'],
  };
  return staff
    ? transitions[from]?.includes(to) === true
    : (to === 'closed' && from !== 'closed') ||
        (to === 'open' && (from === 'resolved' || from === 'closed'));
}
/** Global roles have dedicated homes; gym roles remain membership-scoped. */
export function platformHome(role: unknown): string | null {
  return role === 'platform-admin'
    ? '/admin'
    : role === 'content-manager'
      ? '/studio'
      : role === 'support-agent'
        ? '/support'
        : null;
}
