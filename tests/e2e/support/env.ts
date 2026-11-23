import { join } from 'node:path';

export type Role = 'officer' | 'admin';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. See tests/.env.example.`);
  return v;
};

/** Credentials come from the environment (local .env or CI secrets), never from the repo. */
export const credentials = (role: Role): { username: string; password: string } => {
  const prefix = role.toUpperCase();
  return { username: required(`${prefix}_USERNAME`), password: required(`${prefix}_PASSWORD`) };
};

export const storageStatePath = (role: Role): string => join(__dirname, '..', '.auth', `${role}.json`);

export const ROLES: Role[] = ['officer', 'admin'];
