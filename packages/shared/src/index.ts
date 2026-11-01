// This package is marked `sideEffects: false`, so every module here must be
// free of top-level side effects (no global mutation or registration at import).
//
// Re-exports are extensionless on purpose: the web app's bundler (Turbopack)
// compiles this package from source and doesn't map `./x.js` to `./x.ts`, so
// a `.js` specifier breaks the first runtime (non-type) import from the web.
// Bun and tsc (`moduleResolution: "bundler"`) resolve either form.
export {
  type SubscribeMessage,
  type UnsubscribeMessage,
  type ClientDataMessage,
  type ClientMessage,
  type SubscribedMessage,
  type UnsubscribedMessage,
  type EventMessage,
  type ErrorMessage,
  type PresenceUser,
  type PresenceMessage,
  type ServerMessage,
  type RealtimeEventMessage,
  type RealtimeDisconnectUserMessage,
  type RealtimeRevalidateTopicMessage,
  type RealtimePresenceSyncMessage,
  type RealtimeMessage,
  parseClientMessage,
  isRealtimeMessage,
} from "./protocol";
export {
  AVATAR_SHAPES,
  AVATAR_COLORS,
  AVATAR_BACKGROUNDS,
  AVATAR_EYES,
  AVATAR_MOUTHS,
  AVATAR_TOPS,
  AVATAR_EXTRAS,
  AVATAR_FILL_HEX,
  type AvatarShape,
  type AvatarColor,
  type AvatarBackground,
  type AvatarEyes,
  type AvatarMouth,
  type AvatarTop,
  type AvatarExtra,
  type AvatarOptions,
  parseAvatarOptions,
  renderAvatarSvg,
  randomAvatarOptions,
} from "./avatar";
