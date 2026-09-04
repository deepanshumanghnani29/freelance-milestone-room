import { createNamoIDClient } from "@namoidhq/js";
import { NAMOID_CLIENT_ID } from "./auth-middleware.js";

export const namoid = createNamoIDClient({ clientId: NAMOID_CLIENT_ID });
