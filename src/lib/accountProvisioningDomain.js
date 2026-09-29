import { DEMO_POSKOS } from '../data/demoPoskos';

export function validDocumentId(value) {
  return typeof value === 'string' && value.length > 0 && value === value.trim() &&
    value !== '.' && value !== '..' && !value.includes('/') && !value.startsWith('__') &&
    ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) &&
    new TextEncoder().encode(value).length <= 1500;
}

function normalizeCommon(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.hasOwn(input, 'role')) {
    throw new Error('Data akun tidak valid.');
  }
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('Nama wajib diisi.');
  if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error('Email tidak valid.');
  if (typeof input.initialPassword !== 'string' || input.initialPassword.length < 6) throw new Error('Password minimal 6 karakter.');
  return { name: input.name.trim(), email: input.email.trim(), initialPassword: input.initialPassword };
}

export function validateRelawanInput(input) {
  const common = normalizeCommon(input);
  if (input.organizationId !== undefined) throw new Error('Relawan tidak memakai organisasi.');
  const posko = DEMO_POSKOS.find((item) => item.name === input.poskoName);
  if (!posko || !Number.isFinite(input.poskoLat) || !Number.isFinite(input.poskoLng) ||
      posko.lat !== input.poskoLat || posko.lng !== input.poskoLng) throw new Error('Penugasan Posko tidak valid.');
  return { ...common, poskoName: posko.name, poskoLat: posko.lat, poskoLng: posko.lng };
}

export function validateNakesInput(input) {
  const common = normalizeCommon(input);
  if (input.poskoName !== undefined || input.poskoLat !== undefined || input.poskoLng !== undefined) throw new Error('Nakes tidak memakai Posko.');
  if (input.organizationId === undefined) return common;
  if (!validDocumentId(input.organizationId)) throw new Error('ID rumah sakit tidak valid.');
  return { ...common, organizationId: input.organizationId };
}

function profileIdentity(input, uid, createdAt, email) {
  if (!validDocumentId(uid) || typeof createdAt !== 'string' || !createdAt) throw new Error('Identitas akun tidak valid.');
  return { uid, email: email || input.email, name: input.name, createdAt };
}

export function buildRelawanProfile(input, uid, createdAt, email) {
  const valid = validateRelawanInput(input);
  return { ...profileIdentity(valid, uid, createdAt, email), role: 'relawan',
    poskoName: valid.poskoName, poskoLat: valid.poskoLat, poskoLng: valid.poskoLng };
}

export function buildNakesProfile(input, uid, createdAt, email) {
  const valid = validateNakesInput(input);
  return { ...profileIdentity(valid, uid, createdAt, email), role: 'nakes',
    ...(valid.organizationId ? { organizationId: valid.organizationId } : {}) };
}
