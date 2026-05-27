export type Locale = 'en' | 'es'

export const translations = {
  en: {
    // Nav
    home:        'Home',
    chores:      'Chores',
    calendar:    'Calendar',
    chat:        'Chat',
    history:     'History',
    rewards:     'Rewards',
    household:   'Household',
    settings:    'Settings',
    profile:     'Profile',

    // Actions
    markDone:    'Mark Done',
    complete:    'Complete',
    delete:      'Delete',
    edit:        'Edit',
    save:        'Save',
    cancel:      'Cancel',
    add:         'Add',
    create:      'Create',
    remove:      'Remove',
    close:       'Close',
    back:        'Back',

    // Chore states
    overdue:     'Overdue',
    dueToday:    'Due Today',
    upcoming:    'Upcoming',
    completed:   'Completed',
    noDueDate:   'No Due Date',

    // Priority
    urgent:      'Urgent',
    high:        'High',
    medium:      'Medium',
    low:         'Low',

    // Categories
    kitchen:     'Kitchen',
    bathroom:    'Bathroom',
    bedroom:     'Bedroom',
    outdoor:     'Outdoor',
    laundry:     'Laundry',
    general:     'General',

    // Common
    loading:     'Loading…',
    error:       'Error',
    success:     'Success',
    points:      'points',
    streak:      'streak',
    member:      'Member',
    householdLabel: 'Household',
    today:       'Today',
    yesterday:   'Yesterday',
    thisWeek:    'This Week',

    // Settings section
    appearance:     'Appearance',
    notifications:  'Notifications',
    language:       'Language',
    theme:          'Theme',
    lightMode:      'Light',
    darkMode:       'Dark',
    systemDefault:  'System',
    selectLanguage: 'Select Language',

    // Dialogs
    confirmDelete:      'Confirm Delete',
    areYouSure:         'Are you sure?',
    thisCannotBeUndone: 'This cannot be undone.',

    // Empty states
    noChores:       'No chores yet',
    noHistory:      'No history yet',
    nothingDueToday:'Nothing due today',

    // Greeting parts
    goodMorning:    'Good morning',
    goodAfternoon:  'Good afternoon',
    goodEvening:    'Good evening',
  },

  es: {
    // Nav
    home:        'Inicio',
    chores:      'Tareas',
    calendar:    'Calendario',
    chat:        'Chat',
    history:     'Historial',
    rewards:     'Premios',
    household:   'Hogar',
    settings:    'Ajustes',
    profile:     'Perfil',

    // Actions
    markDone:    'Marcar como hecho',
    complete:    'Completar',
    delete:      'Eliminar',
    edit:        'Editar',
    save:        'Guardar',
    cancel:      'Cancelar',
    add:         'Añadir',
    create:      'Crear',
    remove:      'Quitar',
    close:       'Cerrar',
    back:        'Volver',

    // Chore states
    overdue:     'Atrasada',
    dueToday:    'Vence hoy',
    upcoming:    'Próxima',
    completed:   'Completada',
    noDueDate:   'Sin fecha',

    // Priority
    urgent:      'Urgente',
    high:        'Alta',
    medium:      'Media',
    low:         'Baja',

    // Categories
    kitchen:     'Cocina',
    bathroom:    'Baño',
    bedroom:     'Dormitorio',
    outdoor:     'Exterior',
    laundry:     'Lavandería',
    general:     'General',

    // Common
    loading:     'Cargando…',
    error:       'Error',
    success:     'Éxito',
    points:      'puntos',
    streak:      'racha',
    member:      'Miembro',
    householdLabel: 'Hogar',
    today:       'Hoy',
    yesterday:   'Ayer',
    thisWeek:    'Esta semana',

    // Settings section
    appearance:     'Apariencia',
    notifications:  'Notificaciones',
    language:       'Idioma',
    theme:          'Tema',
    lightMode:      'Claro',
    darkMode:       'Oscuro',
    systemDefault:  'Sistema',
    selectLanguage: 'Seleccionar idioma',

    // Dialogs
    confirmDelete:      'Confirmar eliminación',
    areYouSure:         '¿Estás seguro?',
    thisCannotBeUndone: 'Esto no se puede deshacer.',

    // Empty states
    noChores:       'Sin tareas aún',
    noHistory:      'Sin historial aún',
    nothingDueToday:'Nada vence hoy',

    // Greeting parts
    goodMorning:    'Buenos días',
    goodAfternoon:  'Buenas tardes',
    goodEvening:    'Buenas noches',
  },
} satisfies Record<Locale, Record<string, string>>

export type TranslationKey = keyof typeof translations.en
