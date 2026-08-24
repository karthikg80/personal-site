import { parseObjectId, type ObjectId } from '../domain/ids.js';
import type { Project, ProjectLink, ProjectLinkKind } from '../domain/project.js';
import { asUrlString } from './url-value.js';

export type ProjectLinkStorage = {
  kind: ProjectLinkKind;
  url: string | URL;
  label?: string;
};

export type ProjectStorageData = {
  id: string;
  slug: string;
  previousSlugs: string[];
  title: string;
  description: string;
  tags: string[];
  links?: ProjectLinkStorage[];
  featured: boolean;
  date: Date;
  updated?: Date;
};

function linksFromStorage(data: ProjectStorageData): ProjectLink[] {
  return (data.links ?? []).map((link) => ({
    kind: link.kind,
    url: asUrlString(link.url),
    label: link.label,
  }));
}

/**
 * Map Astro project collection data → domain Project.
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

export function projectLinkOfKind(
  project: Pick<Project, 'links'>,
  kind: ProjectLinkKind
): ProjectLink | undefined {
  return project.links.find((link) => link.kind === kind);
}
