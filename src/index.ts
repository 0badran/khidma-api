import { app } from "./app.js";
import { env } from "./config/env.js";
import { schedulePurge } from "./jobs/purge-hidden-accounts.js";

app.listen(env.PORT, () => {
  console.log(`khidma-api listening on ${env.PORT}`);
});
schedulePurge();
