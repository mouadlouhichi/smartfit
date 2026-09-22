import { Console } from '@/components/tenant/console';

/**
 * Gym owner + staff console.
 *
 * Same tree for both, separated by capability. A member who lands here sees an
 * explanation and a way back to the storefront rather than an empty shell.
 */
export default function ConsolePage() {
  return <Console />;
}
