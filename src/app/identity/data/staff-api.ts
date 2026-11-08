import { HttpClient, HttpParams } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { fromVersion, ifMatch, versioned, type Versioned } from '../../shared/util/etag'
import { API_PATH, body, call } from '../../shared/util/http'
import type { StaffRole } from '../model/roles'
import type {
  ChangeLogEntry,
  Invitation,
  InviteStaffRequest,
  StaffMember,
  StaffStatus,
} from '../model/staff'

const STAFF = `${API_PATH}/admin/staff`
const one = (id: string) => `${STAFF}/${encodeURIComponent(id)}`

/** Staff management for the branch manager: invitations, roles, status and change log. */
@Injectable({ providedIn: 'root' })
export class StaffApi {
  private readonly http = inject(HttpClient)

  async list(filter: { role?: StaffRole; status?: StaffStatus } = {}): Promise<StaffMember[]> {
    let params = new HttpParams()
    for (const [key, value] of Object.entries(filter)) if (value) params = params.set(key, value)
    return body(await call(this.http.get<StaffMember[]>(STAFF, { params, observe: 'response' })))
  }

  /** Invites a staff member; the answer contains the sign-up address to pass on. */
  async invite(request: InviteStaffRequest): Promise<Invitation> {
    return body(await call(this.http.post<Invitation>(STAFF, request, { observe: 'response' })))
  }

  async changeRole(member: StaffMember, role: StaffRole): Promise<StaffMember> {
    return this.put(member, 'role', { role })
  }

  async transition(member: StaffMember, action: 'reinvite' | 'suspend' | 'reinstate'): Promise<StaffMember> {
    const current: Versioned<StaffMember> = fromVersion(member)
    return versioned(
      await call(
        this.http.post<StaffMember>(`${one(member.id)}/${action}`, null, { observe: 'response', headers: ifMatch(current) }),
      ),
    ).value
  }

  /** Removes the staff member; the Keycloak account is left alone. */
  async remove(member: StaffMember): Promise<StaffMember> {
    return body(
      await call(
        this.http.delete<StaffMember>(one(member.id), { observe: 'response', headers: ifMatch(fromVersion(member)) }),
      ),
    )
  }

  /** The member's change log, oldest first. */
  async changes(id: string): Promise<ChangeLogEntry[]> {
    return body(await call(this.http.get<ChangeLogEntry[]>(`${one(id)}/changes`, { observe: 'response' })))
  }

  private async put(member: StaffMember, part: string, payload: unknown): Promise<StaffMember> {
    return versioned(
      await call(
        this.http.put<StaffMember>(`${one(member.id)}/${part}`, payload, {
          observe: 'response',
          headers: ifMatch(fromVersion(member)),
        }),
      ),
    ).value
  }
}
