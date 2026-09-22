/** Classification for display/counts only. This must never grant authorization. */
export function isGymCustomer(record: { role?: unknown }): boolean {
  return record.role !== 'owner' && record.role !== 'staff' && record.role !== 'trainer';
}
