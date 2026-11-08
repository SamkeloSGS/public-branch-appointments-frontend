import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { API_PATH, body, call } from '../../shared/util/http'
import type { BranchDetail, ServiceCategory } from '../model/branch'

/** Branch-management public API: the branch and the service catalog. */
@Injectable({ providedIn: 'root' })
export class BranchApi {
  private readonly http = inject(HttpClient)

  async getBranch(): Promise<BranchDetail> {
    return body(await call(this.http.get<BranchDetail>(`${API_PATH}/branch`, { observe: 'response' })))
  }

  async listServiceCategories(): Promise<ServiceCategory[]> {
    return body(await call(this.http.get<ServiceCategory[]>(`${API_PATH}/service-categories`, { observe: 'response' })))
  }
}
