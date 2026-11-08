import { describeError, fieldProblems, isApiError, type ErrorMessages, type FieldProblem } from './problem'

/** What a screen shows for a failed request: the "not allowed" state for a 403, otherwise a message. */
export interface ErrorView {
  forbidden: boolean
  /** Translation key of the message */
  messageKey: string
  /** The server's own explanation, shown instead of the translated message when asked for */
  serverMessage?: string
  /** The invalid fields the server names, shown with the server's detail */
  fields?: FieldProblem[]
  retryable: boolean
}

export interface ErrorViewOptions {
  /**
   * Show the server's detail for a rejected request (400, 409) that has no code of its own, e.g. the missing
   * preconditions of a branch activation (FE-13), with each invalid field of a 400. For staff screens only: the
   * detail is not translated.
   */
  serverDetail?: boolean
}

export function errorView(error: unknown, messages?: ErrorMessages, options: ErrorViewOptions = {}): ErrorView {
  const description = describeError(error, messages)
  const view: ErrorView = {
    forbidden: isApiError(error) && error.isForbidden,
    messageKey: description.key,
    retryable: description.retryable,
  }
  if (
    options.serverDetail &&
    isApiError(error) &&
    (error.status === 400 || error.status === 409) &&
    !(error.code && messages?.[error.code]) &&
    typeof error.problem.detail === 'string'
  ) {
    view.serverMessage = error.problem.detail
    const fields = fieldProblems(error)
    if (fields.length > 0) view.fields = fields
  }
  return view
}
