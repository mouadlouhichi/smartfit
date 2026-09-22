import type { TrainingContent, ContentDraft, SupportTicket } from '@smartfit/core';
export const EMPTY_CONTENT: ContentDraft = {
  kind: 'workout',
  title: '',
  description: '',
  status: 'draft',
  difficulty: 'beginner',
  equipment: ['bodyweight'],
  muscles: ['full body'],
  instructions: [],
  safetyNotes: 'Stop if you feel pain. Seek qualified advice for persistent symptoms.',
  videoUrl: '',
  durationMin: 20,
  exercises: [],
  access: 'free',
};
export const DEMO_CONTENT: { role: string; items: TrainingContent[] } = {
  role: 'content-manager',
  items: [
    {
      ...EMPTY_CONTENT,
      id: 'foundation-full-body',
      title: 'Foundation full body',
      description:
        'A short, equipment-free introduction. Work at a comfortable pace and rest between sets.',
      status: 'published',
      instructions: [
        'Start with a gentle warm-up.',
        'Keep every repetition controlled.',
        'Rest 60–90 seconds between exercises.',
      ],
      exercises: [
        { name: 'Bodyweight Squat', sets: [{ reps: 8 }, { reps: 8 }] },
        { name: 'Knee Pushups', sets: [{ reps: 6 }, { reps: 6 }] },
      ],
      version: 1,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: 'demo-editor',
    },
  ],
};
export const DEMO_SUPPORT: { role: string; uid: string; items: SupportTicket[] } = {
  role: 'member',
  uid: 'demo-member',
  items: [],
};
