/**
 * auth — two identity realms (ADR-007): staff (provisioned, RBAC: owner/cashier)
 * and customers (self-service). Stateless sessions via signed cookies so the API
 * stays horizontally scalable. Use a vetted library, never hand-rolled crypto.
 * Owns the `staff` table; customer credentials live alongside the customers module.
 */
export {};
