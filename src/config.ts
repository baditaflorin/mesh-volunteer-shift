import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-volunteer-shift",
  description: "Volunteer shift signup board with capacity warnings, no account, mesh-synced",
  accentHex: "#8b5cf6",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
