import { inject, signal } from '@angular/core'
import { BranchCatalog, type BranchDetail } from '../../branch-management'

/**
 * The branch's details (name, time zone, service names) for appointments, which carry only service IDs. Loaded once
 * through the branch-management domain, which keeps them for the session; until then the values are undefined.
 */
export function useBranch() {
  const detail = signal<BranchDetail | undefined>(undefined)

  inject(BranchCatalog)
    .branch()
    .then((branch) => detail.set(branch))
    .catch(() => undefined)

  const service = (serviceId: string) => detail()?.services.find((offered) => offered.serviceId === serviceId)
  const serviceName = (serviceId: string): string | undefined => service(serviceId)?.name
  /** What to bring for the service; empty while loading or for a service the branch no longer offers */
  const prerequisites = (serviceId: string): readonly string[] => service(serviceId)?.prerequisites ?? []

  return { detail, serviceName, prerequisites }
}
