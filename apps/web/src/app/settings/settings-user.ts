export type SettingsSectionId = "profile" | "password" | "connections" | "appearance" | "delete";

export function settingsSection(value: string | string[] | undefined): SettingsSectionId {
  return value === "password" || value === "connections" || value === "appearance" || value === "delete" ? value : "profile";
}
