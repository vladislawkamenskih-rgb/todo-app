'use strict';

// ---------- Константи ----------
const STORAGE_KEY = 'todo-app.todos';
const LEAVE_DURATION = 260; // мс — тривалість анімації todo-leave у style.css
const DAY_MS = 24 * 60 * 60 * 1000;

const PRIORITY_LABELS = {
  low: 'Низький',
  medium: 'Середній',
  high: 'Високий',
};
const DEFAULT_PRIORITY = 'medium';

const FILTER_TITLES = {
  all: 'Усі завдання',
  active: 'Активні завдання',
  completed: 'Виконані завдання',
};

const EMPTY_MESSAGES = {
  all: 'Список завдань порожній. Додайте перше завдання вище!',
  active: 'Немає активних завдань — усе виконано 🎉',
  completed: 'Поки немає виконаних завдань.',
};

const ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cancel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
};

const shortDateFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' });
const shortDateWithYearFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
const fullDateFormat = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
const todayFormat = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- DOM ----------
const form = document.getElementById('add-form');
const input = document.getElementById('new-todo');
const prioritySelect = document.getElementById('new-priority');
const dueInput = document.getElementById('new-due');
const list = document.getElementById('todo-list');
const listTitle = document.getElementById('list-title');
const counter = document.getElementById('counter');
const todayLabel = document.getElementById('today');
const emptyState = document.getElementById('empty-state');
const emptyText = document.getElementById('empty-text');
const filterButtons = document.querySelectorAll('.filters__button');
const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');
const statCompleted = document.getElementById('stat-completed');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const progressCaption = document.getElementById('progress-caption');
const clearCompletedButton = document.getElementById('clear-completed');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Стан ----------
let todos = loadTodos();
let currentFilter = 'all';
let editingId = null;
let toggledId = null;            // щойно змінений статус — анімація галочки
const enteringIds = new Set();   // щойно додані — анімація появи
const leavingIds = new Set();    // видаляються — анімація зникнення

// ---------- Перевірка даних ----------
function isValidPriority(value) {
  return typeof value === 'string' && Object.hasOwn(PRIORITY_LABELS, value);
}

function isValidDateString(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(parseDate(value).getTime());
}

// Старі завдання (без пріоритету й терміну) отримують значення за замовчуванням
function normalizeTodo(raw) {
  return {
    id: typeof raw?.id === 'string' ? raw.id : generateId(),
    text: typeof raw?.text === 'string' ? raw.text.trim() : '',
    completed: Boolean(raw?.completed),
    priority: isValidPriority(raw?.priority) ? raw.priority : DEFAULT_PRIORITY,
    due: isValidDateString(raw?.due) ? raw.due : '',
  };
}

// ---------- Сховище ----------
function loadTodos() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data.map(normalizeTodo).filter((t) => t.text) : [];
  } catch {
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // localStorage може бути недоступний (приватний режим) — застосунок працюватиме без збереження
  }
}

// ---------- Дії ----------
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addTodo({ text, priority, due }) {
  const todo = { id: generateId(), text, completed: false, priority, due };
  todos.push(todo);
  enteringIds.add(todo.id);
  commit();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    toggledId = id;
    commit();
  }
}

// Спершу програємо анімацію зникнення, потім видаляємо з даних
function removeTodos(ids) {
  const fresh = ids.filter((id) => !leavingIds.has(id));
  if (fresh.length === 0) return;

  fresh.forEach((id) => leavingIds.add(id));
  if (fresh.includes(editingId)) editingId = null;
  render();

  setTimeout(() => {
    todos = todos.filter((t) => !fresh.includes(t.id));
    fresh.forEach((id) => leavingIds.delete(id));
    commit();
  }, reducedMotion.matches ? 0 : LEAVE_DURATION);
}

function deleteTodo(id) {
  removeTodos([id]);
}

function clearCompleted() {
  removeTodos(todos.filter((t) => t.completed).map((t) => t.id));
}

function commit() {
  saveTodos();
  render();
}

// ---------- Дати ----------
function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function describeDue(due, completed) {
  const date = parseDate(due);
  const diffDays = Math.round((date - startOfToday()) / DAY_MS);

  let text;
  if (diffDays === 0) text = 'Сьогодні';
  else if (diffDays === 1) text = 'Завтра';
  else if (diffDays === -1) text = 'Вчора';
  else if (date.getFullYear() === new Date().getFullYear()) text = shortDateFormat.format(date);
  else text = shortDateWithYearFormat.format(date);

  let state = '';
  if (!completed && diffDays < 0) {
    state = 'overdue';
    text = `Прострочено · ${text}`;
  } else if (!completed && diffDays === 0) {
    state = 'today';
  }

  return { text, state, title: `Термін: ${fullDateFormat.format(date)}` };
}

// ---------- Відображення ----------
function getVisibleTodos() {
  switch (currentFilter) {
    case 'active':
      return todos.filter((t) => !t.completed);
    case 'completed':
      return todos.filter((t) => t.completed);
    default:
      return todos;
  }
}

function pluralizeTasks(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  // 1, 2–4 → «завдання»; 0, 5–20 → «завдань»
  if (mod10 === 1 && mod100 !== 11) return 'завдання';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'завдання';
  return 'завдань';
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent захищає від XSS
  return node;
}

function createIconButton(action, label) {
  const button = createElement('button', `icon-button icon-button--${action}`);
  button.type = 'button';
  button.dataset.action = action;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = ICONS[action];
  return button;
}

function createPrioritySelect(value) {
  const select = createElement('select', 'field field--select field--sm todo-item__edit-priority');
  select.setAttribute('aria-label', 'Пріоритет');
  Object.entries(PRIORITY_LABELS).forEach(([key, label]) => {
    const option = createElement('option', '', label);
    option.value = key;
    option.selected = key === value;
    select.append(option);
  });
  return select;
}

function createViewBody(todo) {
  const body = createElement('div', 'todo-item__body');

  const text = createElement('span', 'todo-item__text', todo.text);
  text.title = 'Подвійний клік для редагування';

  const meta = createElement('div', 'todo-item__meta');
  const badge = createElement('span', `badge badge--${todo.priority}`, PRIORITY_LABELS[todo.priority]);
  badge.title = `Пріоритет: ${PRIORITY_LABELS[todo.priority].toLowerCase()}`;
  meta.append(badge);

  if (todo.due) {
    const due = describeDue(todo.due, todo.completed);
    const chip = createElement('span', due.state ? `due-chip due-chip--${due.state}` : 'due-chip');
    chip.title = due.title;
    chip.innerHTML = ICONS.calendar;
    chip.append(due.text);
    meta.append(chip);
  }

  body.append(text, meta);
  return body;
}

function createEditBody(todo) {
  const body = createElement('div', 'todo-item__body');

  const textInput = createElement('input', 'field todo-item__edit');
  textInput.type = 'text';
  textInput.value = todo.text;
  textInput.maxLength = 200;
  textInput.setAttribute('aria-label', 'Редагувати завдання');

  const dateInput = createElement('input', 'field field--date field--sm todo-item__edit-due');
  dateInput.type = 'date';
  dateInput.value = todo.due;
  dateInput.setAttribute('aria-label', 'Термін виконання');

  const row = createElement('div', 'todo-item__edit-row');
  row.append(
    createPrioritySelect(todo.priority),
    dateInput,
    createIconButton('save', 'Зберегти'),
    createIconButton('cancel', 'Скасувати'),
  );

  body.append(textInput, row);
  return body;
}

function createTodoElement(todo) {
  const isEditing = todo.id === editingId;

  const li = createElement('li', `todo-item priority-${todo.priority}`);
  li.dataset.id = todo.id;
  li.classList.toggle('is-completed', todo.completed);
  li.classList.toggle('is-editing', isEditing);
  li.classList.toggle('is-entering', enteringIds.has(todo.id));
  li.classList.toggle('is-toggled', toggledId === todo.id);
  li.classList.toggle('is-leaving', leavingIds.has(todo.id));

  const checkbox = createElement('input', 'todo-item__checkbox');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.completed;
  checkbox.dataset.action = 'toggle';
  checkbox.setAttribute('aria-label', 'Позначити як виконане');

  li.append(checkbox, isEditing ? createEditBody(todo) : createViewBody(todo));

  if (!isEditing) {
    const actions = createElement('div', 'todo-item__actions');
    actions.append(
      createIconButton('edit', 'Редагувати'),
      createIconButton('delete', 'Видалити'),
    );
    li.append(actions);
  }

  return li;
}

function renderStats() {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const active = total - completed;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  statTotal.textContent = total;
  statActive.textContent = active;
  statCompleted.textContent = completed;

  progressFill.style.width = `${percent}%`;
  progress.setAttribute('aria-valuenow', String(percent));
  progressPercent.textContent = `${percent}%`;
  progressCaption.textContent = total
    ? `Виконано ${completed} з ${total}`
    : 'Додайте завдання, щоб бачити прогрес';

  counter.textContent = `Залишилось: ${active} ${pluralizeTasks(active)}`;
  clearCompletedButton.disabled = completed === 0;
}

function render() {
  const visible = getVisibleTodos();

  list.replaceChildren(...visible.map(createTodoElement));
  enteringIds.clear();
  toggledId = null;

  emptyState.hidden = visible.length > 0;
  emptyText.textContent = EMPTY_MESSAGES[currentFilter];
  listTitle.textContent = FILTER_TITLES[currentFilter];

  renderStats();

  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  const editInput = list.querySelector('.todo-item__edit');
  if (editInput) {
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  }
}

// ---------- Редагування ----------
function startEditing(id) {
  editingId = id;
  render();
}

function readEditValues(li) {
  const priority = li.querySelector('.todo-item__edit-priority').value;
  const due = li.querySelector('.todo-item__edit-due').value;
  return {
    text: li.querySelector('.todo-item__edit').value.trim(),
    priority: isValidPriority(priority) ? priority : DEFAULT_PRIORITY,
    due: isValidDateString(due) ? due : '',
  };
}

// shouldRender = false, коли наступний click сам перемалює список
function finishEditing(li, save, shouldRender = true) {
  const id = li.dataset.id;
  editingId = null;

  if (save) {
    const values = readEditValues(li);
    if (!values.text) {
      // Порожній текст після редагування = видалення завдання
      removeTodos([id]);
      return;
    }
    const todo = todos.find((t) => t.id === id);
    if (todo) Object.assign(todo, values);
    saveTodos();
  }

  if (shouldRender) render();
}

// ---------- Обробники подій ----------
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  addTodo({
    text,
    priority: isValidPriority(prioritySelect.value) ? prioritySelect.value : DEFAULT_PRIORITY,
    due: isValidDateString(dueInput.value) ? dueInput.value : '',
  });

  form.reset();
  input.focus();
});

list.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const li = target.closest('.todo-item');
  const id = li.dataset.id;

  switch (target.dataset.action) {
    case 'toggle': toggleTodo(id); break;
    case 'edit': startEditing(id); break;
    case 'delete': deleteTodo(id); break;
    case 'save': finishEditing(li, true); break;
    case 'cancel': finishEditing(li, false); break;
  }
});

// Не забираємо фокус у поля при натисканні «Зберегти»/«Скасувати» (важливо для Safari)
list.addEventListener('mousedown', (event) => {
  if (event.target.closest('[data-action="save"], [data-action="cancel"]')) {
    event.preventDefault();
  }
});

list.addEventListener('dblclick', (event) => {
  const text = event.target.closest('.todo-item__text');
  if (text) {
    startEditing(text.closest('.todo-item').dataset.id);
  }
});

list.addEventListener('keydown', (event) => {
  const li = event.target.closest('.todo-item.is-editing');
  if (!li) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    finishEditing(li, false);
  } else if (event.key === 'Enter' && event.target.matches('input')) {
    event.preventDefault();
    finishEditing(li, true);
  }
});

// Збереження, коли фокус залишає завдання, що редагується (наприклад, клік поза ним)
list.addEventListener('focusout', (event) => {
  const li = event.target.closest('.todo-item.is-editing');
  // li.dataset.id !== editingId: редагування вже завершене (Enter/Escape)
  if (!li || li.dataset.id !== editingId || li.contains(event.relatedTarget)) return;

  // Якщо фокус перейшов на кнопку іншого завдання — її click сам перемалює список,
  // інакше перемальовування «з'їло» б цей клік
  finishEditing(li, true, !list.contains(event.relatedTarget));
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    editingId = null;
    render();
  });
});

clearCompletedButton.addEventListener('click', clearCompleted);

// ---------- Запуск ----------
const todayText = todayFormat.format(new Date());
todayLabel.textContent = todayText.charAt(0).toUpperCase() + todayText.slice(1);
render();
