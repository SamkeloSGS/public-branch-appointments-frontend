import { Injectable, inject } from '@angular/core'
import type { BranchDetail, ServiceCategory } from '../model/branch'
import { BranchApi } from './branch-api'

/**
 * Public reference data kept for the session: the branch (name, time zone, hours, services) and the service catalog.
 * Other domains read it through this domain's entry file. A failed load is not kept, so the next call retries.
 */
@Injectable({ providedIn: 'root' })
export class BranchCatalog {
  private readonly api = inject(BranchApi)
  private detail: Promise<BranchDetail> | undefined
  private categories: Promise<ServiceCategory[]> | undefined

  branch(): Promise<BranchDetail> {
    if (!this.detail) {
      const detail = this.api.getBranch()
      detail.catch(() => (this.detail = undefined))
      this.detail = detail
    }
    return this.detail
  }

  /** Forgets the branch, so the next call loads its hours and services again (after an admin changed them). */
  refresh(): void {
    this.detail = undefined
  }

  serviceCatalog(): Promise<ServiceCategory[]> {
    if (!this.categories) {
      const categories = this.api.listServiceCategories()
      categories.catch(() => (this.categories = undefined))
      this.categories = categories
    }
    return this.categories
  }

  /** A service's name from the catalog, for screens that have only its ID. */
  async serviceName(serviceId: string): Promise<string | undefined> {
    const categories = await this.serviceCatalog()
    return categories.flatMap((category) => category.services).find((service) => service.id === serviceId)?.name
  }
}
