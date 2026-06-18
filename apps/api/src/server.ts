/**
 * API entrypoint — the single deployable modular monolith (ADR-002), on Cloud Run.
 *
 * Stateless: no in-memory session state, so Cloud Run can scale instances freely;
 * the only shared resource is Postgres (behind the pooler — ADR-003).
 *
 * Scaffold: wires up health + module routes. Route handlers live in each module
 * and are registered here as the monolith's HTTP surface.
 */

import Fastify from "fastify";
import { config } from "./config.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

// TODO: register module routes, e.g.
//   app.register(catalogRoutes,   { prefix: "/catalog" });
//   app.register(ordersRoutes,    { prefix: "/orders" });
//   app.register(paymentsRoutes,  { prefix: "/payments" }); // includes /payments/stripe/webhook
//   app.register(posRoutes,       { prefix: "/pos" });
//   app.register(inventoryRoutes, { prefix: "/inventory" });
//   app.register(authRoutes,      { prefix: "/auth" });

const start = async () => {
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
