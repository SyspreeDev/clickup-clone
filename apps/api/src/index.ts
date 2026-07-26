import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { initSocketServer } from "./sockets";

const httpServer = createServer(app);
initSocketServer(httpServer);

httpServer.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
