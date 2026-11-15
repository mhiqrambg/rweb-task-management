/**
 * Every user-visible string, verbatim from design/06-copy-deck.md.
 *
 * Rules (R-F1, R-F2, design/06 §1): sentence case, no emoji, no exclamation marks, no trailing
 * arrows, an action keeps its name through the flow. A component that needs a new string adds it
 * here first — never inline in a template.
 *
 * Only these interpolation tokens exist: {target} {filename} {title} {percent} {count} {n} {date}
 * {relative}. Use `fill()`.
 */

export const copy = {
  brand: {
    name: 'Task & Notes',
    valueLine: 'Plan tasks, keep notes, and keep the images that belong with them.',
  },

  landing: {
    intro:
      'Every task and note lives in one place, with the images attached to the record they belong to.',
    previewAlt:
      'A task list with status and priority labels and a row of image thumbnails.',
    footerBlurb: 'A personal task and note workspace with image attachments.',
    featureTasksTitle: 'Tasks',
    featureNotesTitle: 'Notes',
    featureImagesTitle: 'Images',
  },

  cta: {
    getStarted: 'Get started',
    logIn: 'Log in',
    goToDashboard: 'Go to dashboard',
  },

  auth: {
    login: { title: 'Log in', submit: 'Log in', crossLink: 'New here? Create an account' },
    register: {
      title: 'Create your account',
      submit: 'Create account',
      crossLink: 'Already have an account? Log in',
    },
    field: { email: 'Email', password: 'Password' },
    hint: { password: '12 characters or more' },
    error: {
      invalidCredentials: 'Invalid email or password.',
      emailTaken: 'That email is already registered.',
      sessionExpired: 'Your session ended. Log in to continue.',
      rateLimited: 'Too many attempts. Try again in a few minutes.',
    },
    logout: 'Log out',
    signedInAs: 'Signed in as',
  },

  nav: {
    dashboard: 'Dashboard',
    tasks: 'Tasks',
    notes: 'Notes',
    account: 'Account',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    current: 'Current page',
    skipToContent: 'Skip to content',
  },

  valid: {
    email: { required: 'Enter your email.', format: 'Enter a valid email address.' },
    password: { required: 'Enter your password.', length: 'Use at least 12 characters.' },
    title: { required: 'Enter a title.', length: 'Keep the title to 200 characters or fewer.' },
    description: {
      length: 'Keep the description to 5 000 characters or fewer.',
    },
    body: {
      required: 'Enter a note body.',
      length: 'Keep the note to 20 000 characters or fewer.',
    },
    dueDate: { invalid: 'Enter a real date or clear the field.' },
    priority: { invalid: 'Choose low, medium, or high.' },
    status: { invalid: 'Choose to do, in progress, or completed.' },
    unknownField: 'This field cannot be changed here.',
  },

  task: {
    title: 'Tasks',
    new: 'New task',
    field: {
      title: 'Title',
      description: 'Description',
      status: 'Status',
      priority: 'Priority',
      dueDate: 'Due date',
      dueDateEmpty: 'No due date',
      images: 'Images',
    },
    status: { todo: 'To do', in_progress: 'In progress', completed: 'Completed' },
    priority: { low: 'Low', medium: 'Medium', high: 'High' },
    overdue: 'Overdue',
    updatedAt: 'Updated {relative}',
    createdAt: 'Created {date}',
    search: { label: 'Search tasks' },
    list: { loading: 'Loading tasks' },
    empty: {
      title: 'No tasks yet',
      body: 'Create your first task to track a status, a priority, and a due date.',
    },
    noResults: {
      title: 'No tasks match these filters',
      body: 'Change the search or clear the filters to see your tasks again.',
      clear: 'Clear filters',
    },
    attachments: {
      none: 'No images yet',
      noneShort: 'No images',
      noneHint: 'Add up to 10 JPEG, PNG, or WebP images, 5 MB each.',
      overflow: '{n} more',
      add: 'Add images',
      remove: 'Remove image',
      open: 'Open image {index} of {count}',
      loading: 'Loading image',
      broken: 'This image could not be loaded',
    },
  },

  note: {
    title: 'Notes',
    new: 'New note',
    field: { title: 'Title', body: 'Body' },
    pinned: 'Pinned',
    pin: 'Pin note',
    unpin: 'Unpin note',
    search: { label: 'Search notes' },
    list: { loading: 'Loading notes' },
    empty: {
      title: 'No notes yet',
      body: 'Write your first note to keep a thought with the images that go with it.',
    },
    noResults: {
      title: 'No notes match this search',
      body: 'Clear the search to see your notes again.',
    },
    updatedAt: 'Updated {relative}',
  },

  dash: {
    title: 'Dashboard',
    stat: {
      total: 'Total tasks',
      active: 'Active',
      completed: 'Completed',
      totalHint: 'To do, in progress, and completed',
      activeHint: 'To do and in progress',
      completedHint: 'Completed tasks',
    },
    breakdown: {
      status: 'By status',
      priority: 'By priority',
      overdue: 'Overdue',
      overdueHint: 'Past due, not completed',
    },
    recentTasks: 'Recently updated tasks',
    recentNotes: 'Recently updated notes',
    search: { label: 'Search tasks' },
    viewAll: 'View all',
    empty: {
      tasks: 'No tasks yet',
      notes: 'No notes yet',
      tasksHint: 'Tasks you update appear here.',
    },
    loading: 'Loading your dashboard',
  },

  filter: {
    status: 'Status',
    priority: 'Priority',
    due: 'Due',
    hasImages: 'Has images',
    all: 'All',
    applied: 'Filters applied',
    clear: 'Clear',
    dueValue: {
      any: 'Any date',
      overdue: 'Overdue',
      today: 'Today',
      next7: 'Next 7 days',
      none: 'No due date',
    },
  },

  sort: {
    label: 'Sort by',
    updated: 'Last updated',
    created: 'Created',
    due: 'Due date',
    priority: 'Priority',
    ascending: 'Ascending',
    descending: 'Descending',
  },

  pagination: {
    loadMore: 'Load more',
    end: 'End of list',
  },

  action: {
    save: 'Save changes',
    cancel: 'Cancel',
    delete: 'Delete',
    retry: 'Try again',
    close: 'Close',
    edit: 'Edit',
    back: 'Back',
  },

  confirm: {
    deleteTask: {
      title: 'Delete this task?',
      body: '“{title}” and its images will be deleted. This cannot be undone.',
    },
    deleteNote: {
      title: 'Delete this note?',
      body: '“{title}” and its images will be deleted. This cannot be undone.',
    },
    deleteImage: {
      title: 'Remove this image?',
      body: '“{filename}” will be removed from this {target}.',
    },
    confirmDelete: 'Delete',
  },

  toast: {
    taskCreated: 'Task created',
    taskSaved: 'Changes saved',
    taskDeleted: 'Task deleted',
    noteCreated: 'Note created',
    noteSaved: 'Changes saved',
    noteDeleted: 'Note deleted',
    notePinned: 'Note pinned',
    noteUnpinned: 'Note unpinned',
    imageAdded: 'Image added',
    imageRemoved: 'Image removed',
    signedOut: 'Signed out',
    errorSave: 'Could not save changes.',
  },

  state: {
    loading: 'Loading',
    error: {
      title: 'That did not load',
      body: 'Check your connection and try again.',
      retry: 'Try again',
      tasks: 'Could not load tasks',
      notes: 'Could not load notes',
      detail: 'That did not load',
    },
    notFound: {
      title: 'Page not found',
      body: 'This page does not exist, or you no longer have access to it.',
      action: 'Back to dashboard',
    },
  },

  upload: {
    reject: {
      type: '“{filename}” is not a JPEG, PNG, or WebP image.',
      size: '“{filename}” is larger than 5 MB.',
      sizeShort: 'File is larger than 5 MB',
      count: 'A {target} can hold 10 images. Remove one before adding “{filename}”.',
    },
    progress: 'Uploading {filename}, {percent}%',
    done: 'Images added',
    partial: '{added} images added. {rejected} were rejected.',
    dropTitle: 'Drop files to upload',
    chooseAnother: 'Choose a different file.',
    complete: 'Upload complete',
    addedSummary: '{n} files added',
  },

  dropzone: {
    idle: 'Drag images here, or choose files',
    hint: 'JPEG, PNG, or WebP. Up to 5 MB each, 10 per {target}.',
  },

  account: {
    title: 'Account',
    email: 'Email',
    displayName: 'Name',
    createdAt: 'Member since',
    readOnly: 'Email and password changes are not available in this build.',
  },

  error: {
    form: 'Check the highlighted fields and try again.',
  },
} as const;

const TOKEN = /\{(\w+)\}/g;

/** Replace {token} placeholders. Unknown tokens are left alone so a typo is visible in review. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(TOKEN, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

/** Badge and control labels for a status enum value. */
export function taskStatusLabel(status: string): string {
  if (status === 'todo') return copy.task.status.todo;
  if (status === 'in_progress') return copy.task.status.in_progress;
  if (status === 'completed') return copy.task.status.completed;
  return status;
}

/** Badge and control labels for a priority enum value. */
export function taskPriorityLabel(priority: string): string {
  if (priority === 'low') return copy.task.priority.low;
  if (priority === 'medium') return copy.task.priority.medium;
  if (priority === 'high') return copy.task.priority.high;
  return priority;
}

/** Copy key for a toast advertised in the redirect query string. Whitelisted, never free text. */
export const toastMessages = {
  taskCreated: copy.toast.taskCreated,
  taskSaved: copy.toast.taskSaved,
  taskDeleted: copy.toast.taskDeleted,
  noteCreated: copy.toast.noteCreated,
  noteSaved: copy.toast.noteSaved,
  noteDeleted: copy.toast.noteDeleted,
  notePinned: copy.toast.notePinned,
  noteUnpinned: copy.toast.noteUnpinned,
  imageAdded: copy.toast.imageAdded,
  imageRemoved: copy.toast.imageRemoved,
  signedOut: copy.toast.signedOut,
  errorSave: copy.toast.errorSave,
} as const;

export type ToastKey = keyof typeof toastMessages;
