// Public entry of the customer domain: the only file other domains and the app may import.
export { customerRoutes } from './customer.routes'
export { customerAdminRoutes } from './customer.admin.routes'
export { profileGuard, CustomerProfiles, PROFILE_SETUP_PATH } from './data/profile.guard'
export { CustomerAdminApi } from './data/customer-admin-api'
export {
  contactDetailsValues,
  customerAdminErrorMessages,
  customerRequest,
  displayName,
  existingCustomerId,
  isSearchable,
  MIN_SEARCH_LENGTH,
  type ContactDetailsValues,
  type Customer,
  type CustomerSummary,
} from './model/customer'
export { ContactDetailsForm } from './ui/contact-details-form'
export { CustomerResults } from './ui/customer-results'
