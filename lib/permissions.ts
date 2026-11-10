// Permissions. A role is a list of permissions, and every screen, tool, connector or device asks for one.
//
// A permission is text with parts separated by ":". The core ones:
//   team:manage · connectors:manage · devices:manage · log:read · log:write
//   connector:<slug>:read · connector:<slug>:write · device:<slug>:use · tool:<slug>
// In a role, "*" stands for any part: "*" opens everything, "connector:*:read" allows reading every connector
// and "connector:crm:*" allows reading and writing on the "crm" connector.

export function can(granted: readonly string[], requested: string): boolean {
  const p = requested.split(":");
  return granted.some((c) => {
    if (c === "*") return true;
    const parts = c.split(":");
    if (parts.length > p.length) return false;
    for (let i = 0; i < parts.length; i++) {
      const last = i === parts.length - 1;
      if (parts[i] === "*") { if (last) return true; continue; }
      if (parts[i] !== p[i]) return false;
    }
    return parts.length === p.length;
  });
}

/** Is there any permission of this family? For example hasAny(permissions, "connector") to show the menu. */
export function hasAny(granted: readonly string[], family: string): boolean {
  return granted.some((c) => c === "*" || c === family || c.startsWith(`${family}:`));
}

export const CORE_PERMISSIONS = [
  { permission: "log:read", label: "Read the activity log" },
  { permission: "log:write", label: "Add decisions, changes and notes to the log" },
  { permission: "team:manage", label: "Add people and change roles" },
  { permission: "connectors:manage", label: "Create connectors and change their secrets" },
  { permission: "devices:manage", label: "Add devices and see their keys when they are created" },
] as const;

export const isPermission = (text: string) => /^(\*|[a-z0-9_-]+)(:(\*|[a-z0-9_-]+)){0,3}$/.test(text);
