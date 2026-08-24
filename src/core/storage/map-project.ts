import { parseObjectId, type ObjectId } from '../domain/ids.js';
import type { Project, ProjectLink } from '../domain/project.js';
import { asOptionalUrlString } from './url-value.js';

export type ProjectStorageData = {
  id: string;
  slug: string;
  previousSlugs: string[];
  title: string;
  description: string;
  tags: string[];
  link?: string | URL;
  github?: string | URL;
  featured: boolean;
  date: Date;
  updated?: Date;
};

function linksFromStorage(data: ProjectStorageData): ProjectLink[] {
  const links: ProjectLink[] = [];
  const live = asOptionalUrlString(data.link);
  const github = asOptionalUrlString(data.github);
  if (live) links.push({ kind: 'live', url: live });
  if (github) links.push({ kind: 'github', url: github });
  return links;
}

/**
 * Map Astro project collection data → domain Project.
 * Preserves existing link/github fields as ProjectLink values.
 */
export function mapProject(data: ProjectStorageData): Project {
  const id: ObjectId = parseObjectId(data.id);

  return {
    id,
    slug: data.slug,
    previousSlugs: [...data.previousSlugs],
    title: data.title,
    description: data.description,
    topics: [...data.tags],
    featured: data.featured,
    links: linksFromStorage(data),
    createdAt: data.date,
    updatedAt: data.updated,
  };
}
