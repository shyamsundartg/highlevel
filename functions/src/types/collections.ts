export const HL_TOKENS_DOC_ID = "hlTokens";

export const collections = {
  users: (uid: string) => `users/${uid}`,
  userSecrets: (uid: string) => `users/${uid}/secrets`,
  hlTokens: (uid: string) => `users/${uid}/secrets/${HL_TOKENS_DOC_ID}`,
  projects: () => "projects",
  project: (projectId: string) => `projects/${projectId}`,
  projectFiles: (projectId: string) => `projects/${projectId}/files`,
  projectFile: (projectId: string, fileId: string) =>
    `projects/${projectId}/files/${fileId}`,
  projectMessages: (projectId: string) => `projects/${projectId}/messages`,
  projectMessage: (projectId: string, messageId: string) =>
    `projects/${projectId}/messages/${messageId}`,
  projectSnapshots: (projectId: string) => `projects/${projectId}/snapshots`,
  projectSnapshot: (projectId: string, snapshotId: string) =>
    `projects/${projectId}/snapshots/${snapshotId}`,
  oauthStates: () => "oauthStates",
  oauthState: (stateId: string) => `oauthStates/${stateId}`,
  webhookEvents: (uid: string) => `users/${uid}/webhookEvents`,
  webhookEvent: (uid: string, eventId: string) =>
    `users/${uid}/webhookEvents/${eventId}`,
} as const;
