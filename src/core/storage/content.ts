import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getCollection, type CollectionEntry } from 'astro:content';
import { parse as parseYaml } from 'yaml';

import type { ObjectId } from '../domain/ids.js';
import type { Note } from '../domain/note.js';
import { isPublicNote } from '../domain/note.js';
import type { Person } from '../domain/person.js';
import type { Project } from '../domain/project.js';
import { mapNote } from './map-note.js';
import { mapPerson, type PersonStorageData } from './map-person.js';
import { mapProject } from './map-project.js';

/**
 * Astro collection entry is retained for render().
 * Domain Note carries canonical metadata only — no Markdown body.
 */
export type NoteRecord = {
  note: Note;
  entry: CollectionEntry<'notes'>;
};

export type ProjectRecord = {
  project: Project;
  entry: CollectionEntry<'projects'>;
};

const PERSON_PATH = join(process.cwd(), 'src/content/person.yaml');

export async function getPerson(): Promise<Person> {
  const raw = readFileSync(PERSON_PATH, 'utf8');
  const data = parseYaml(raw) as PersonStorageData;
  return mapPerson(data);
}

export async function getNoteRecords(): Promise<NoteRecord[]> {
  const entries = await getCollection('notes');
  return entries.map((entry) => ({
    note: mapNote(entry.data),
    entry,
  }));
}

export async function getNotes(): Promise<Note[]> {
  const records = await getNoteRecords();
  return records.map((record) => record.note);
}

export async function getPublishedNoteRecords(): Promise<NoteRecord[]> {
  const records = await getNoteRecords();
  return records
    .filter((record) => isPublicNote(record.note))
    .sort((a, b) => b.note.createdAt.getTime() - a.note.createdAt.getTime());
}

export async function getPublishedNotes(): Promise<Note[]> {
  const records = await getPublishedNoteRecords();
  return records.map((record) => record.note);
}

export async function getProjectRecords(): Promise<ProjectRecord[]> {
  const entries = await getCollection('projects');
  return entries.map((entry) => ({
    project: mapProject(entry.data),
    entry,
  }));
}

export async function getProjects(): Promise<Project[]> {
  const records = await getProjectRecords();
  return records
    .map((record) => record.project)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getNoteById(id: ObjectId): Promise<NoteRecord | undefined> {
  const records = await getNoteRecords();
  return records.find((record) => record.note.id === id);
}

export async function getNoteBySlug(slug: string): Promise<NoteRecord | undefined> {
  const records = await getNoteRecords();
  return records.find((record) => record.note.slug === slug);
}

export async function getProjectById(id: ObjectId): Promise<ProjectRecord | undefined> {
  const records = await getProjectRecords();
  return records.find((record) => record.project.id === id);
}

export async function getProjectBySlug(slug: string): Promise<ProjectRecord | undefined> {
  const records = await getProjectRecords();
  return records.find((record) => record.project.slug === slug);
}
