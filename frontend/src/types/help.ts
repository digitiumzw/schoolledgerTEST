import { UserRole } from './auth';

export interface HelpStep {
  order: number;
  instruction: string;
  tip?: string;
}

/** A frequently asked question and its answer, shown at the end of a topic. */
export interface HelpFaq {
  question: string;
  answer: string;
}

/** A cross-link to another help topic on the same page. */
export interface HelpCrossLink {
  /** The id of the target HelpTopic to link to. */
  topicId: string;
  /** The label shown for the link. */
  label: string;
}

export interface HelpTopic {
  id: string;
  title: string;
  roleVisibility: UserRole[];
  order: number;
  /** Short plain-language description of what the topic covers. */
  summary?: string;
  /** Conditions that must be met before following the steps. */
  prerequisites?: string[];
  steps: HelpStep[];
  /** Critical cautions the user must be aware of (destructive/irreversible actions, etc.). */
  warnings?: string[];
  /** Helpful notes, limitations, and best practices. */
  notes?: string[];
  /** Frequently asked questions specific to this topic. */
  faqs?: HelpFaq[];
  /** Links to related topics elsewhere in the Help Center. */
  related?: HelpCrossLink[];
  screenshotCaption?: string;
  relatedModuleRoute?: string;
  tags?: string[];
}

export interface HelpSection {
  id: string;
  heading: string;
  description?: string;
  roleVisibility: UserRole[];
  order: number;
  topics: HelpTopic[];
  icon?: string;
}

export interface ContextualHelpMapping {
  moduleRoute: string;
  targetSectionId: string;
  label: string;
  roleVisibility: UserRole[];
}

export interface HelpContentBundle {
  sections: HelpSection[];
  contextualMappings: ContextualHelpMapping[];
}
