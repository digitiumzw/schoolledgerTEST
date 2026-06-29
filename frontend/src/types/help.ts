import { UserRole } from './auth';

export interface HelpStep {
  order: number;
  instruction: string;
  tip?: string;
}

export interface HelpTopic {
  id: string;
  title: string;
  roleVisibility: UserRole[];
  order: number;
  steps: HelpStep[];
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
