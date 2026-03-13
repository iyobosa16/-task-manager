// ====== Models (OOP) ======

const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));

class Task {
  constructor({ id, title, description = "", priority = "low", category = "Personal", completed = false, order = 0 }) {
    this.id = id ?? genId();
    this.title = (title || '').trim();
    this.description = (description || '').trim();
    this.priority = priority;  // 'high' | 'medium' | 'low'
    this.category = category;  // e.g., 'Personal', 'Work'
    this.completed = completed;
    this.order = order;        // manual ordering for drag & drop
  }

  toggleComplete() { this.completed = !this.completed; }

  update({ title, description, priority, category }) {
    if (title !== undefined) this.title = (title || '').trim();
    if (description !== undefined) this.description = (description || '').trim();
    if (priority !== undefined) this.priority = priority;
    if (category !== undefined) this.category = category;
  }
}

class TaskManager {
  constructor(storageKey = "tm_tasks", themeKey = "tm_theme", catsKey = "tm_categories") {
    this.storageKey = storageKey;
    this.themeKey = themeKey;
    this.catsKey = catsKey;
    this.tasks = [];
    this.categories = ["Personal", "Work", "Urgent"];
    this.load();
  }

  // CRUD
  add(task) {
    const maxOrder = this.tasks.reduce((m, t) => Math.max(m, t.order ?? 0), 0);
    task.order = maxOrder + 1;
    this.tasks.push(task);
    this.persist();
    return task;
  }

  update(id, updates) {
    const t = this.tasks.find(x => x.id === id);
    if (!t) return null;
    t.update(updates);
    this.persist();
    return t;
  }

  remove(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.persist();
  }

  toggle(id) {
    const t = this.tasks.find(x => x.id === id);
    if (!t) return null;
    t.toggleComplete();
    this.persist();
    return t;
  }

  // Reorder by drag-and-drop
  move(sourceId, targetId) {
    if (sourceId === targetId) return;
    const src = this.tasks.find(t => t.id === sourceId);
    const tgt = this.tasks.find(t => t.id === targetId);
    if (!src || !tgt) return;

    const srcOrder = src.order, tgtOrder = tgt.order;
    const movingDown = srcOrder < tgtOrder;

    this.tasks.forEach(t => {
      if (movingDown) {
        if (t.order > srcOrder && t.order <= tgtOrder) t.order -= 1;
      } else {
        if (t.order < srcOrder && t.order >= tgtOrder) t.order += 1;
      }
    });
    src.order = tgtOrder;
    this.tasks.sort((a, b) => a.order - b.order);
    this.persist();
  }

  // Categories
  addCategory(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    if (!this.categories.includes(trimmed)) {
      this.categories.push(trimmed);
      this.persistCategories();
    }
  }

  // Queries
  search(query, list = this.tasks) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [...list];
    return list.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }

  filterByCategory(category, list = this.tasks) {
    if (!category || category === "all") return [...list];
    return list.filter(t => t.category === category);
  }

  filterByStatus(status, list = this.tasks) {
    if (status === "active") return list.filter(t => !t.completed);
    if (status === "completed") return list.filter(t => t.completed);
    return [...list];
  }

  sortByPriority(order, list = this.tasks) {
    if (order === "none") return [...list].sort((a, b) => a.order - b.order);
    const weight = { high: 3, medium: 2, low: 1 };
    return [...list].sort((a, b) => {
      const diff = weight[b.priority] - weight[a.priority];
      return order === "desc" ? diff : -diff;
    });
  }

  baseList() { return [...this.tasks].sort((a, b) => a.order - b.order); }

  // Persistence
  persist() { localStorage.setItem(this.storageKey, JSON.stringify(this.tasks)); }
  persistCategories() { localStorage.setItem(this.catsKey, JSON.stringify(this.categories)); }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) { this.tasks = JSON.parse(raw).map(obj => new Task(obj)); }
    } catch { this.tasks = []; }

    try {
      const rawCats = localStorage.getItem(this.catsKey);
      if (rawCats) { const arr = JSON.parse(rawCats); if (Array.isArray(arr) && arr.length) this.categories = arr; }
    } catch {}

    const savedTheme = localStorage.getItem(this.themeKey);
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
      const btn = document.getElementById("themeToggle");
      if (btn) btn.textContent = savedTheme === "dark" ? "☀️ Light" : "🌙 Dark";
    }
  }

  setTheme(theme) { localStorage.setItem(this.themeKey, theme); }
}

// ====== App State ======
const tm = new TaskManager();

// UI elements
const els = {
  form: document.getElementById("taskForm"),
  taskId: document.getElementById("taskId"),
  title: document.getElementById("title"),
  description: document.getElementById("description"),
  priority: document.getElementById("priority"),
  category: document.getElementById("category"),
  customCategory: document.getElementById("customCategory"),
  titleError: document.getElementById("titleError"),
  priorityError: document.getElementById("priorityError"),
  categoryError: document.getElementById("categoryError"),
  formTitle: document.getElementById("formTitle"),
  saveBtn: document.getElementById("saveBtn"),
  resetBtn: document.getElementById("resetBtn"),
  search: document.getElementById("search"),
  filterCategory: document.getElementById("filterCategory"),
  sortPriority: document.getElementById("sortPriority"),
  statusRadios: document.querySelectorAll('input[name="status"]'),
  taskList: document.getElementById("taskList"),
  toastContainer: document.getElementById("toastContainer"),
  themeToggle: document.getElementById("themeToggle"),
  countTotal: document.getElementById("countTotal"),
  countActive: document.getElementById("countActive"),
  countCompleted: document.getElementById("countCompleted"),
  emptyState: document.getElementById("emptyState"),
  dragHint: document.getElementById("dragHint"),
};

// ====== Helpers ======
function showToast(message, type = "info", timeout = 3500) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = document.createElement("span");
  icon.textContent = type === "high" ? "⚠️" : "ℹ️";
  toast.append(icon, document.createTextNode(message));
  els.toastContainer.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateY(-4px)"; setTimeout(() => toast.remove(), 250); }, timeout);
}

function validateForm() {
  let ok = true;
  els.titleError.textContent = "";
  els.priorityError.textContent = "";
  els.categoryError.textContent = "";

  if (!els.title.value.trim()) { els.titleError.textContent = "Title is required."; ok = false; }
  if (!els.priority.value) { els.priorityError.textContent = "Pick a priority."; ok = false; }
  if (!getCategoryValue()) { els.categoryError.textContent = "Choose or type a category."; ok = false; }
  return ok;
}

function clearForm() {
  els.taskId.value = "";
  els.title.value = "";
  els.description.value = "";
  els.priority.value = "";
  els.category.value = "";
  els.customCategory.classList.add("hidden");
  els.customCategory.value = "";
  els.formTitle.textContent = "Add Task";
  els.saveBtn.textContent = "Add Task";
  els.titleError.textContent = "";
  els.priorityError.textContent = "";
  els.categoryError.textContent = "";
}

function populateForm(task) {
  els.taskId.value = task.id;
  els.title.value = task.title;
  els.description.value = task.description;
  els.priority.value = task.priority;
  ensureCategoryOption(task.category);
  els.category.value = task.category;
  els.customCategory.classList.add("hidden");
  els.customCategory.value = "";
  els.formTitle.textContent = "Update Task";
  els.saveBtn.textContent = "Update Task";
}

function getCategoryValue() {
  const sel = els.category.value;
  if (sel === "__custom") { return els.customCategory.value.trim(); }
  return sel;
}

function ensureCategoryOption(cat) {
  if (!cat || ["Personal","Work","Urgent","__custom","", "all"].includes(cat)) return;
  const existsMain = [...els.category.options].some(o => o.value == cat);
  const existsFilter = [...els.filterCategory.options].some(o => o.value == cat);
  if (!existsMain) { const opt = new Option(cat, cat); els.category.add(opt, els.category.options.length - 1); }
  if (!existsFilter) { els.filterCategory.add(new Option(cat, cat)); }
}

function getViewTasks() {
  const q = els.search.value || "";
  const cat = els.filterCategory.value;
  const sort = els.sortPriority.value;
  const status = [...els.statusRadios].find(r => r.checked)?.value ?? "all";

  let list = tm.baseList();
  list = tm.search(q, list);
  list = tm.filterByCategory(cat, list);
  list = tm.filterByStatus(status, list);
  list = tm.sortByPriority(sort, list);
  return list;
}

function priorityLabel(p) { return p[0].toUpperCase() + p.slice(1); }

function updateCounters() {
  const total = tm.tasks.length;
  const completed = tm.tasks.filter(t => t.completed).length;
  const active = total - completed;
  els.countTotal.textContent = `Total: ${total}`;
  els.countActive.textContent = `Active: ${active}`;
  els.countCompleted.textContent = `Completed: ${completed}`;
  const showEmpty = total === 0;
  els.emptyState.classList.toggle("hidden", !showEmpty);
  els.emptyState.setAttribute("aria-hidden", String(!showEmpty));
}

function canDragNow() {
  const q = (els.search.value || "").trim();
  const cat = els.filterCategory.value;
  const sort = els.sortPriority.value;
  const status = [...els.statusRadios].find(r => r.checked)?.value ?? "all";
  return !q && cat === "all" && sort === "none" && status === "all";
}

function render() {
  const tasks = getViewTasks();
  els.taskList.innerHTML = "";
  updateCounters();
  els.dragHint.style.display = canDragNow() ? "block" : "none";
  if (!tasks.length) return;

  tasks.forEach(task => {
    const row = document.createElement("div");
    row.className = `task enter ${task.completed ? "completed" : ""}`;
    row.dataset.id = task.id;

    if (canDragNow()) {
      row.setAttribute("draggable", "true");
      row.addEventListener("dragstart", onDragStart);
      row.addEventListener("dragover", onDragOver);
      row.addEventListener("drop", onDrop);
    }

    const left = document.createElement("div");
    left.className = "task-left";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "checkbox";
    cb.checked = task.completed;
    cb.title = "Mark completed";
    cb.addEventListener("change", () => {
      const updated = tm.toggle(task.id);
      if (updated && updated.priority === "high" && updated.completed) { showToast("High priority task completed.", "high"); }
      render();
    });
    left.appendChild(cb);

    const mid = document.createElement("div");
    const h = document.createElement("h3");
    h.className = "task-title";
    h.textContent = task.title;
    enableInlineEdit(h, task, "title");

    const d = document.createElement("p");
    d.className = "task-desc";
    d.textContent = task.description || "—";
    enableInlineEdit(d, task, "description");

    const badges = document.createElement("div");
    badges.className = "badges";
    const b1 = document.createElement("span");
    b1.className = `badge ${task.priority}`;
    b1.textContent = `Priority: ${priorityLabel(task.priority)}`;
    const b2 = document.createElement("span");
    b2.className = "badge";
    b2.textContent = `Category: ${task.category}`;
    badges.append(b1, b2);

    mid.append(h, d, badges);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => populateForm(task));

    const delBtn = document.createElement("button");
    delBtn.className = "btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => { if (confirm("Delete this task?")) { tm.remove(task.id); render(); } });

    actions.append(editBtn, delBtn);

    row.append(left, mid, actions);
    els.taskList.appendChild(row);
  });
}

// ----- Drag & Drop handlers -----
let dragSourceId = null;
function onDragStart(e) { dragSourceId = e.currentTarget.dataset.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragSourceId); }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
function onDrop(e) { e.preventDefault(); const targetId = e.currentTarget.dataset.id; const sourceId = dragSourceId || e.dataTransfer.getData("text/plain"); if (!sourceId || !targetId) return; tm.move(sourceId, targetId); render(); }

// ----- Inline edit -----
function enableInlineEdit(el, task, field) {
  el.title = "Double‑click to edit";
  el.addEventListener("dblclick", () => {
    const isTitle = field === "title";
    const input = isTitle ? document.createElement("input") : document.createElement("textarea");
    input.className = isTitle ? "inline-input" : "inline-textarea";
    input.value = task[field] || "";
    if (!isTitle) input.rows = 3;

    const original = el.textContent;
    el.replaceWith(input);
    input.focus();
    if (typeof input.setSelectionRange === 'function') {
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch {}
    }

    const commit = () => {
      const val = (input.value || '').trim();
      if (isTitle && !val) { showToast("Title cannot be empty.", "info"); cancel(); return; }
      tm.update(task.id, { [field]: val });
      render();
    };
    const cancel = () => { input.replaceWith(el); el.textContent = original; };

    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && isTitle) { ev.preventDefault(); commit(); } if (ev.key === "Escape") { ev.preventDefault(); cancel(); } });
    input.addEventListener("blur", commit);
  });
}

// ====== Event wiring ======
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const categoryValue = getCategoryValue();
  if (els.category.value === "__custom") { tm.addCategory(categoryValue); ensureCategoryOption(categoryValue); els.category.value = categoryValue; }

  const data = { title: els.title.value, description: els.description.value, priority: els.priority.value, category: categoryValue };
  const existingId = els.taskId.value;

  if (existingId) {
    const updated = tm.update(existingId, data);
    if (updated && updated.priority === "high") { showToast("High priority task updated.", "high"); } else { showToast("Task updated.", "info"); }
  } else {
    const t = new Task(data);
    tm.add(t);
    if (t.priority === "high") { showToast("High priority task added.", "high"); } else { showToast("Task added.", "info"); }
  }
  clearForm();
  render();
});

els.resetBtn.addEventListener("click", clearForm);
els.search.addEventListener("input", render);
els.filterCategory.addEventListener("change", render);
els.sortPriority.addEventListener("change", render);
els.statusRadios.forEach(r => r.addEventListener("change", render));

els.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  tm.setTheme(next);
  els.themeToggle.textContent = next === "dark" ? "☀️ Light" : "🌙 Dark";
});

els.category.addEventListener("change", () => { const custom = els.category.value === "__custom"; els.customCategory.classList.toggle("hidden", !custom); if (custom) els.customCategory.focus(); });

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  const typing = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");
  if (e.key === "/" && !typing) { e.preventDefault(); els.search.focus(); }
  else if (e.key.toLowerCase() === "n" && !typing) { e.preventDefault(); els.title.focus(); }
  else if (e.key.toLowerCase() === "t" && !typing) { e.preventDefault(); els.themeToggle.click(); }
  else if (e.key === "Escape") { clearForm(); els.search.value = ""; render(); }
});

(function initCategories() { tm.categories.forEach(cat => ensureCategoryOption(cat)); })();

render();
