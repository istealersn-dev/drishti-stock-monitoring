/**
 * Local-time greeting matching Drishti.dc.html's `greeting` state.
 * @returns "Good morning.", "Good afternoon." or "Good evening."
 */
export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}
