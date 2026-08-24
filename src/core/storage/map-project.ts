import { parseObjectId, type ObjectId } from '../domain/ids.js';
import type { Project, ProjectLink, ProjectLinkKind } from '../domain/project.js';
import { asOptionalUrlString, asUrlString } from './url-value.js';

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
  /** Canonical storage shape after M6. */
  links?: ProjectLinkStorage[];
  /** Legacy single-field storage retained only as mapper fallback. */
  link?: string | URL;
  github?: string | URL;
  featured: boolean;
  date: Date;
  updated?: Date;
};

function linksFromStorage(data: ProjectStorageData): ProjectLink[] {
  if (data.links && data.links.length > 0) {
    return data.links.map((link) => ({
      kind: link.kind,
      url: asUrlString(link.url),
      label: link.label,
    }));
  }

  const links: ProjectLink[] = [];
  const live = asOptionalUrlString(data.link);
  const github = asOptionalUrlString(data.github);
  if (live) links.push({ kind: 'live', url: live });
  if (github) links.push({ kind: 'github', url: github });
  return links;
}

/**
 * Map Astro project collection data → domain Project.
 * Prefer `links[]`; fall back to legacy `link` / `github` fields.
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
