export type SettingsSectionId = "profile" | "password" | "connections" | "appearance" | "delete";

/** Sections that read the viewer's sign-in methods (/list-accounts). */
export function sectionNeedsAccounts(section: SettingsSectionId): boolean {
  return section === "password" || section === "connections" || section === "delete";
}

export function settingsSection(value: string | string[] | undefined): SettingsSectionId {
  return value === "password" || value === "connections" || value === "appearance" || value === "delete" ? value : "profile";
}
