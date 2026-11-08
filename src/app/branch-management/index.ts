// Public entry of the branch-management domain: the only file other domains and the app may import.
export { branchManagementRoutes } from './branch-management.routes'
export { branchManagementAdminRoutes } from './branch-management.admin.routes'
export { BranchCatalog } from './data/branch-catalog'
export { BranchApi } from './data/branch-api'
export { BranchAdminApi } from './data/branch-admin-api'
export {
  formatAddress,
  serviceName,
  type BranchDetail,
  type OfferedService,
  type ServiceCategory,
} from './model/branch'
export type { AdminBranch, Pool } from './model/branch-admin'
export { PrerequisitesList } from './ui/prerequisites-list'
