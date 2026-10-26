export const defaultProfile = '20000000-0000-0000-0000-000000000001';
const storageKey = 'roomwise.profile.v1';
let currentProfile = defaultProfile;

export function readProfile(): string {
  try {
    const value = sessionStorage.getItem(storageKey);
    return value === 'admin' ||
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value ?? '')
      ? value!
      : defaultProfile;
  } catch {
    return currentProfile;
  }
}

export function storeProfile(value: string) {
  currentProfile = value;
  try {
    sessionStorage.setItem(storageKey, value);
  } catch {
    // The current selection still works when browser storage is unavailable.
  }
}

export function canManage(profile: string, organizerId: string) {
  return profile === 'admin' || profile === organizerId;
}
