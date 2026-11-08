import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { ifMatch, versioned, type Versioned } from '../../shared/util/etag'
import { API_PATH, body, call } from '../../shared/util/http'
import type {
  AddExceptionRequest,
  AdminBranch,
  AdminCategory,
  AdminService,
  CalendarException,
  CapacityOverride,
  ChangeOfferingRequest,
  DefineCategoryRequest,
  DefineServiceRequest,
  Offering,
  OfferServiceRequest,
  Pool,
  SetOverrideRequest,
  TimeRangeValue,
} from '../model/branch-admin'

const ADMIN = `${API_PATH}/admin`
const segment = (value: string) => encodeURIComponent(value)

/** Branch management for the branch manager (spec 6). Single resources carry their ETag. */
@Injectable({ providedIn: 'root' })
export class BranchAdminApi {
  private readonly http = inject(HttpClient)

  private async get<T>(url: string, params?: HttpParams): Promise<T> {
    return body(await call(this.http.get<T>(url, { params, observe: 'response' })))
  }

  private async getVersioned<T>(url: string): Promise<Versioned<T>> {
    return versioned(await call(this.http.get<T>(url, { observe: 'response' })))
  }

  private async post<T>(url: string, payload: unknown, current?: Versioned<unknown>): Promise<Versioned<T>> {
    return versioned(
      await call(
        this.http.post<T>(url, payload, { observe: 'response', headers: current ? ifMatch(current) : undefined }),
      ),
    )
  }

  private async put<T>(url: string, payload: unknown, current: Versioned<unknown>): Promise<Versioned<T>> {
    return versioned(await call(this.http.put<T>(url, payload, { observe: 'response', headers: ifMatch(current) })))
  }

  // The branch

  /** The branch with its weekly hours; the ETag is the version of the hours. */
  branch(): Promise<Versioned<AdminBranch>> {
    return this.getVersioned(`${ADMIN}/branch`)
  }

  updateWeeklyHours(
    current: Versioned<AdminBranch>,
    days: Record<string, TimeRangeValue[]>,
  ): Promise<Versioned<AdminBranch>> {
    return this.put(`${ADMIN}/branch/weekly-hours`, { days }, current)
  }

  // Capacity pools and service offerings

  pools(): Promise<Pool[]> {
    return this.get(`${ADMIN}/capacity-pools`)
  }

  definePool(name: string, baseCapacity: number): Promise<Versioned<Pool>> {
    return this.post(`${ADMIN}/capacity-pools`, { name, baseCapacity })
  }

  async changePool(current: Versioned<Pool>, baseCapacity: number): Promise<Versioned<Pool>> {
    return versioned(
      await call(
        this.http.patch<Pool>(
          `${ADMIN}/capacity-pools/${segment(current.value.id)}`,
          { baseCapacity },
          { observe: 'response', headers: ifMatch(current) },
        ),
      ),
    )
  }

  /** The offerings, including withdrawn ones. */
  offerings(): Promise<Offering[]> {
    return this.get(`${ADMIN}/offerings`)
  }

  offer(request: OfferServiceRequest): Promise<Versioned<Offering>> {
    return this.post(`${ADMIN}/offerings`, request)
  }

  async changeOffering(current: Versioned<Offering>, request: ChangeOfferingRequest): Promise<Versioned<Offering>> {
    return versioned(
      await call(
        this.http.patch<Offering>(
          `${ADMIN}/offerings/${segment(current.value.id)}`,
          request,
          { observe: 'response', headers: ifMatch(current) },
        ),
      ),
    )
  }

  /** Withdraws an offering; it is kept as inactive. */
  async withdraw(current: Versioned<Offering>): Promise<Versioned<Offering>> {
    return versioned(
      await call(
        this.http.delete<Offering>(`${ADMIN}/offerings/${segment(current.value.id)}`, {
          observe: 'response',
          headers: ifMatch(current),
        }),
      ),
    )
  }

  // Calendar exceptions and capacity overrides

  /** Calendar exceptions from today onwards. */
  exceptions(): Promise<CalendarException[]> {
    return this.get(`${ADMIN}/calendar-exceptions`)
  }

  async addException(request: AddExceptionRequest): Promise<CalendarException> {
    return (await this.post<CalendarException>(`${ADMIN}/calendar-exceptions`, request)).value
  }

  async removeException(exceptionId: string): Promise<void> {
    await call(
      this.http.delete<void>(`${ADMIN}/calendar-exceptions/${segment(exceptionId)}`, { observe: 'response' }),
    )
  }

  /** Capacity overrides from today onwards. */
  overrides(): Promise<CapacityOverride[]> {
    return this.get(`${ADMIN}/capacity-overrides`)
  }

  async setOverride(request: SetOverrideRequest): Promise<CapacityOverride> {
    return (await this.post<CapacityOverride>(`${ADMIN}/capacity-overrides`, request)).value
  }

  async removeOverride(overrideId: string): Promise<void> {
    await call(
      this.http.delete<void>(`${ADMIN}/capacity-overrides/${segment(overrideId)}`, { observe: 'response' }),
    )
  }

  // Service catalog

  services(): Promise<AdminService[]> {
    return this.get(`${ADMIN}/services`)
  }

  categories(): Promise<AdminCategory[]> {
    return this.get(`${ADMIN}/service-categories`)
  }

  defineService(request: DefineServiceRequest): Promise<Versioned<AdminService>> {
    return this.post(`${ADMIN}/services`, request)
  }

  defineCategory(request: DefineCategoryRequest): Promise<Versioned<AdminCategory>> {
    return this.post(`${ADMIN}/service-categories`, request)
  }

  updateCategory(
    current: Versioned<AdminCategory>,
    request: { name: string; description?: string },
  ): Promise<Versioned<AdminCategory>> {
    return this.put(`${ADMIN}/service-categories/${segment(current.value.id)}`, request, current)
  }

  /** Replaces the description and the prerequisites. */
  updateServiceDetails(
    current: Versioned<AdminService>,
    request: { description?: string; prerequisites: string[] },
  ): Promise<Versioned<AdminService>> {
    return this.put(`${ADMIN}/services/${segment(current.value.id)}`, request, current)
  }

  moveService(current: Versioned<AdminService>, categoryId: string): Promise<Versioned<AdminService>> {
    return this.put(`${ADMIN}/services/${segment(current.value.id)}/category`, { categoryId }, current)
  }

  retireService(current: Versioned<AdminService>): Promise<Versioned<AdminService>> {
    return this.post(`${ADMIN}/services/${segment(current.value.id)}/retire`, null, current)
  }

  retireCategory(current: Versioned<AdminCategory>): Promise<Versioned<AdminCategory>> {
    return this.post(`${ADMIN}/service-categories/${segment(current.value.id)}/retire`, null, current)
  }
}
