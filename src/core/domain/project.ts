import type { ObjectId } from './ids.js';

export type ProjectLinkKind = 'live' | 'github' | 'other';

export interface ProjectLink {
  kind: ProjectLinkKind;
  url: string;
  label?: string;
}

export interface Project {
  id: ObjectId;
  slug: string;
  previousSlugs: string[];
  title: string;
  description: string;
  topics: string[];
  featured: boolean;
  links: ProjectLink[];
  createdAt: Date;
  updatedAt?: Date;
}
