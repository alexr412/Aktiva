export const CURRENT_APP_TUTORIAL_VERSION = 1;

export interface TutorialStepConfig {
  id: number;
  targetId: string;
  titleKey: string;
  descriptionKey: string;
}

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  {
    id: 1,
    targetId: 'nav-feed',
    titleKey: 'tutorial.feed.title',
    descriptionKey: 'tutorial.feed.description',
  },
  {
    id: 2,
    targetId: 'nav-explore',
    titleKey: 'tutorial.explore.title',
    descriptionKey: 'tutorial.explore.description',
  },
  {
    id: 3,
    targetId: 'nav-map',
    titleKey: 'tutorial.map.title',
    descriptionKey: 'tutorial.map.description',
  },
  {
    id: 4,
    targetId: 'nav-chat',
    titleKey: 'tutorial.chat.title',
    descriptionKey: 'tutorial.chat.description',
  },
  {
    id: 5,
    targetId: 'nav-profile',
    titleKey: 'tutorial.profile.title',
    descriptionKey: 'tutorial.profile.description',
  },
  {
    id: 6,
    targetId: 'nav-create',
    titleKey: 'tutorial.create.title',
    descriptionKey: 'tutorial.create.description',
  },
];
