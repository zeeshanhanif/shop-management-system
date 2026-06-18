/**
 * fulfillment — order packing/dispatch/delivery state (§6.3). Staff drive the
 * transitions today. This is the reserved seam for a future third-party courier
 * integration (ADR-008): a CourierProvider interface will live here, mirroring the
 * PaymentProvider pattern, so adding a courier doesn't disturb order logic.
 */
export {};
