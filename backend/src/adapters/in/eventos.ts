// Piezas compartidas para eventos que no vienen de API Gateway.

export interface EventoProgramado {
  source?: string;
  "detail-type"?: string;
}

/** true si el evento lo generó una regla programada de EventBridge. */
export function esEventoProgramado(event: EventoProgramado | null | undefined): boolean {
  return event?.source === "aws.events" || event?.["detail-type"] === "Scheduled Event";
}
