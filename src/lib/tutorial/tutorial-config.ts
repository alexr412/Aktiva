export const CURRENT_APP_TUTORIAL_VERSION = 1;

export interface TutorialStepConfig {
  id: number;
  route?: string;
  targetId: string;
  headerTargetId?: string;
  titleKey: string;
  descriptionKey: string;
}

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  {
    id: 1,
    route: '/',
    targetId: 'header-profile-identity',
    titleKey: 'tutorial.step1.title',
    descriptionKey: 'tutorial.step1.description',
  },
  {
    id: 2,
    route: '/',
    targetId: 'header-location',
    titleKey: 'tutorial.step2.title',
    descriptionKey: 'tutorial.step2.description',
  },
  {
    id: 3,
    route: '/',
    targetId: 'feed-main',
    headerTargetId: 'nav-feed',
    titleKey: 'tutorial.step3.title',
    descriptionKey: 'tutorial.step3.description',
  },
  {
    id: 4,
    route: '/',
    targetId: 'feed-tab-active',
    titleKey: 'tutorial.step4.title',
    descriptionKey: 'tutorial.step4.description',
  },
  {
    id: 5,
    route: '/',
    targetId: 'feed-tab-community',
    titleKey: 'tutorial.step5.title',
    descriptionKey: 'tutorial.step5.description',
  },
  {
    id: 6,
    route: '/',
    targetId: 'feed-tab-favorites',
    titleKey: 'tutorial.step6.title',
    descriptionKey: 'tutorial.step6.description',
  },
  {
    id: 7,
    route: '/',
    targetId: 'feed-filters',
    titleKey: 'tutorial.step7.title',
    descriptionKey: 'tutorial.step7.description',
  },
  {
    id: 8,
    route: '/',
    targetId: 'spot-card-create',
    titleKey: 'tutorial.step8.title',
    descriptionKey: 'tutorial.step8.description',
  },
  {
    id: 9,
    route: '/',
    targetId: 'nav-create',
    titleKey: 'tutorial.step9.title',
    descriptionKey: 'tutorial.step9.description',
  },
  {
    id: 10,
    route: '/explore',
    targetId: 'nav-explore',
    headerTargetId: 'header-explore',
    titleKey: 'tutorial.step10.title',
    descriptionKey: 'tutorial.step10.description',
  },
  {
    id: 11,
    route: '/map',
    targetId: 'nav-map',
    headerTargetId: 'header-map',
    titleKey: 'tutorial.step11.title',
    descriptionKey: 'tutorial.step11.description',
  },
  {
    id: 12,
    route: '/chat',
    targetId: 'nav-chat',
    headerTargetId: 'header-chat',
    titleKey: 'tutorial.step12.title',
    descriptionKey: 'tutorial.step12.description',
  },
  {
    id: 13,
    route: '/profile',
    targetId: 'nav-profile',
    headerTargetId: 'header-profile',
    titleKey: 'tutorial.step13.title',
    descriptionKey: 'tutorial.step13.description',
  },
];
