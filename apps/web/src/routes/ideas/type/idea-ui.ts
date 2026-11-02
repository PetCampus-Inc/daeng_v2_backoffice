export const IDEA_USER_TYPES = ['guardian', 'director'] as const;
export const IDEA_USER_TYPE_LABELS = { guardian: '보호자', director: '원장' } as const;
export const IDEA_SORTS = ['latest', 'oldest'] as const;

export type Idea = {
  id: number;
  content: string;
  user: { type: (typeof IDEA_USER_TYPES)[number]; name: string; email: string };
  submittedAt: string;
};

export type IdeaListParams = {
  keyword: string;
  userType: Idea['user']['type'] | 'all';
  sort: (typeof IDEA_SORTS)[number];
};
