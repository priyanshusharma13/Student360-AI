(() => {
  "use strict";

  const KEY = "student360_data_v1",
    $ = id => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const defaults = {
    name: "Student",
    budget: 5000,
    tasks: [],
    expenses: []
  };
  let data = read(),
    editing = null,
    toastTimer;

  function read() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return { ...defaults };
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
    render();
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function rupees(n) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(n) || 0);
  }

  function monthItems() {
    let m = today().slice(0, 7);
    return data.expenses.filter(x => x.date?.slice(0, 7) === m);
  }

  function spent() {
    return monthItems().reduce((s, x) => s + Number(x.amount), 0);
  }

  function remaining() {
    return Number(data.budget) - spent();
  }

  function hours() {
    return data.tasks.reduce((s, t) => s + Number(t.hours || 0), 0);
  }

  function dateLabel(d) {
    return d
      ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short"
        })
      : "No date";
  }

  function toast(msg) {
    $("toast").textContent = msg;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2300);
  }

  function modal(id, on = true) {
    $(id).classList.toggle("show", on);
  }

  function go(page) {
    document.querySelectorAll(".page").forEach(x => x.classList.toggle("active", x.id === page));
    document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.page === page));
    $("pageTitle").textContent = ({
      dashboard: "Overview",
      planner: "Study planner",
      expenses: "Expense tracker",
      insights: "AI insights"
    })[page];
    $("sidebar").classList.remove("open");
    if (page === "insights") renderInsights();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function stats() {
    return {
      done: data.tasks.filter(t => t.done).length,
      total: data.tasks.length,
      hours: hours()
    };
  }

  function breakdown(id, compact = false) {
    let grouped = {};
    monthItems().forEach(x => (grouped[x.category] = (grouped[x.category] || 0) + Number(x.amount)));
    let rows = Object.entries(grouped).sort((a, b) => b[1] - a[1]),
      max = Math.max(1, ...rows.map(x => x[1]));
    let box = $(id);
    if (!rows.length) {
      box.className = "empty";
      box.textContent = "Add expenses to see your spending categories.";
      return;
    }
    box.className = "";
    box.innerHTML = rows
      .map(
        ([k, v]) =>
          `<div class="bar-row"><span>${esc(k)}</span><b>${rupees(v)}</b><div class="track"><span style="width:${(v / max) * 100}%"></span></div></div>`
      )
      .join("");
  }

  function renderDashboard() {
    let s = stats(),
      sp = spent(),
      pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    $("helloName").textContent = data.name;
    $("profileName").textContent = data.name;
    $("doneStat").textContent = `${s.done} / ${s.total}`;
    $("hoursStat").textContent = `${s.hours.toFixed(1).replace(/\.0$/, "")}h`;
    $("spentStat").textContent = rupees(sp);
    $("remainStat").textContent = rupees(remaining());
    $("studyBar").style.width = pct + "%";
    $("studyHint").textContent = s.total ? `${pct}% of your tasks completed` : "Add your first study task";
    $("budgetHint").textContent = data.budget ? `${Math.round((sp / data.budget) * 100)}% of budget used` : "Set a monthly budget";
    $("heroText").textContent =
      s.total || data.expenses.length
        ? "Your progress is taking shape. Keep your study goals and spending choices intentional."
        : "Add a study task or expense to start building your student-life overview.";

    let upcoming = [...data.tasks]
      .filter(t => !t.done)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
    $("dashTasks").className = upcoming.length ? "" : "empty";
    $("dashTasks").innerHTML = upcoming.length
      ? upcoming
          .map(
            t =>
              `<div class="task-row"><input class="task-check" type="checkbox" data-check="${t.id}"><div class="task-main"><b>${esc(t.title)}</b><small>${esc(t.subject)} · ${t.hours}h</small></div><span class="task-date">${dateLabel(t.date)}</span></div>`
          )
          .join("")
      : "No study tasks yet. Add your first task in Study Planner.";
    breakdown("dashBreakdown", true);
  }

  function renderPlanner() {
    let s = stats();
    $("totalTasks").textContent = s.total;
    $("completedTasks").textContent = s.done;
    $("plannedHours").textContent = s.hours.toFixed(1).replace(/\.0$/, "") + "h";
    let subjects = [...new Set(data.tasks.map(t => t.subject))].sort(),
      sel = $("subjectFilter"),
      old = sel.value;
    sel.innerHTML =
      '<option value="all">All subjects</option>' +
      subjects.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
    if (subjects.includes(old)) sel.value = old;

    let filter = $("taskFilter").value,
      subject = sel.value,
      tasks = [...data.tasks]
        .filter(
          t =>
            (filter === "all" || (filter === "done" ? t.done : !t.done)) &&
            (subject === "all" || t.subject === subject)
        )
        .sort((a, b) => a.date.localeCompare(b.date));

    $("taskList").className = tasks.length ? "" : "empty";
    $("taskList").innerHTML = tasks.length
      ? tasks
          .map(
            t =>
              `<div class="task-row full"><input class="task-check" type="checkbox" data-check="${t.id}" ${t.done ? "checked" : ""}><div class="task-main"><b style="${t.done ? "text-decoration:line-through;opacity:.55" : ""}">${esc(t.title)}</b><small>${esc(t.subject)} · ${t.hours} study hours · Due ${dateLabel(t.date)} · <span class="priority ${esc(t.priority)}">${esc(t.priority)}</span></small></div><div class="task-actions"><button class="small-btn" data-edit="${t.id}">Edit</button><button class="small-btn delete" data-delete-task="${t.id}">Delete</button></div></div>`
          )
          .join("")
      : "No tasks match this view. Add a task or change the filters.";
  }

  function icon(cat) {
    return (
      {
        Food: "☕",
        Travel: "↗",
        Education: "▤",
        Entertainment: "♫",
        Shopping: "◇",
        Health: "＋",
        Other: "•"
      }[cat] || "•"
    );
  }

  function renderExpenses() {
    let sp = spent(),
      bal = remaining(),
      budget = Number(data.budget) || 0,
      pct = budget ? Math.round((sp / budget) * 100) : 0;
    $("budgetValue").textContent = rupees(budget);
    $("budgetMessage").textContent =
      bal >= 0 ? "A clear budget gives every rupee a purpose." : "You have gone over your monthly budget.";
    $("budgetPct").textContent = pct + "%";
    $("budgetBar").style.width = Math.min(100, pct) + "%";
    $("budgetBar").style.background = pct > 100 ? "var(--red)" : "";
    $("budgetLeft").textContent = rupees(Math.abs(bal)) + (bal >= 0 ? " remaining" : " over budget");
    $("monthSpent").textContent = rupees(sp);
    $("available").textContent = rupees(bal);
    $("transactionCount").textContent = monthItems().length;
    breakdown("categoryBreakdown");

    let list = [...monthItems()].sort((a, b) => b.date.localeCompare(a.date));
    $("transactions").className = list.length ? "" : "empty";
    $("transactions").innerHTML = list.length
      ? list
          .slice(0, 10)
          .map(
            x =>
              `<div class="transaction-row"><div class="category-icon">${icon(x.category)}</div><div class="transaction-main"><b>${esc(x.title)}</b><small>${esc(x.category)} · ${dateLabel(x.date)}</small></div><b class="amount">${rupees(x.amount)}</b><button class="small-btn delete" data-delete-expense="${x.id}">×</button></div>`
          )
          .join("")
      : "No expenses recorded this month.";
    updateSimulator();
  }

  function updateSimulator() {
    let n = Number($("dailySave").value);
    $("dailyValue").textContent = rupees(n);
    $("monthlySave").textContent = rupees(n * 30);
    $("yearlySave").textContent = rupees(n * 365);
  }

  function insights() {
    let s = stats(),
      pending = data.tasks.filter(t => !t.done),
      overdue = pending.filter(t => t.date < today()),
      group = {};
    monthItems().forEach(x => (group[x.category] = (group[x.category] || 0) + Number(x.amount)));
    let top = Object.entries(group).sort((a, b) => b[1] - a[1])[0],
      out = [];

    if (!data.tasks.length)
      out.push([
        "▦",
        "Start with one study goal",
        "Add a task with a subject and due date. A small, specific plan is easier to follow."
      ]);
    else if (overdue.length)
      out.push([
        "◷",
        "Review overdue tasks",
        `${overdue.length} pending task(s) have a past due date. Reschedule them into realistic sessions.`
      ]);
    else
      out.push([
        "✓",
        "Academic momentum",
        `${s.done} of ${s.total} tasks are complete. You have ${pending.length} pending task(s).`
      ]);

    if (!monthItems().length)
      out.push([
        "₹",
        "Track your spending",
        "Record everyday expenses for a clearer picture of your monthly money habits."
      ]);
    else if (data.budget && spent() > data.budget)
      out.push([
        "!",
        "Budget needs attention",
        `Your spending is ${rupees(spent() - data.budget)} above budget. Review optional purchases and adjust your plan.`
      ]);
    else
      out.push([
        "₹",
        "Money check-in",
        `${rupees(Math.max(0, remaining()))} remains from your monthly budget. ${top ? top[0] + " is your highest spending category." : "Keep recording expenses."}`
      ]);

    out.push([
      "✧",
      "Balance both priorities",
      `You have planned ${s.hours.toFixed(1)} study hours and recorded ${rupees(spent())} in monthly expenses. Review both before making new commitments.`
    ]);
    return { out, s, top, pending };
  }

  function renderInsights() {
    let x = insights();
    $("insightCards").innerHTML = x.out
      .map(([i, t, p]) => `<article class="insight"><span>${i}</span><b>${esc(t)}</b><p>${esc(p)}</p></article>`)
      .join("");
    $("snapshot").innerHTML =
      `<div><small>Study tasks completed</small><b>${x.s.done} / ${x.s.total}</b></div><div><small>Planned study hours</small><b>${x.s.hours.toFixed(1)}h</b></div><div><small>Monthly spending</small><b>${rupees(spent())}</b></div><div><small>Budget remaining</small><b>${rupees(remaining())}</b></div><div><small>Top spending category</small><b>${x.top ? esc(x.top[0]) : "Not available"}</b></div><div><small>Pending study tasks</small><b>${x.pending.length}</b></div>`;
  }

  function render() {
    renderDashboard();
    renderPlanner();
    renderExpenses();
    renderInsights();
  }

  function openTask(task = null) {
    editing = task?.id || null;
    $("taskForm").reset();
    $("taskDate").value = today();
    $("taskHours").value = 1;
    $("taskModalTitle").textContent = task ? "Edit study task" : "Add study task";
    if (task) {
      $("taskTitle").value = task.title;
      $("taskSubject").value = task.subject;
      $("taskDate").value = task.date;
      $("taskHours").value = task.hours;
      $("taskPriority").value = task.priority;
    }
    modal("taskModal");
  }
  
async function askStudent360() {
    const question = $("aiQuestion").value.trim();
    const answerBox = $("aiAnswer");
    const button = $("askAI");

    if (!question) {
        toast("Please enter a question first.");
        return;
    }

    button.disabled = true;
    button.textContent = "Thinking...";

    answerBox.textContent = "Student360 AI is thinking...";

    try {
        const response = await fetch("/api/assistant", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: question,
                studentContext: {
                    name: data.name,
                    budget: data.budget,
                    tasks: data.tasks,
                    expenses: data.expenses
                }
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "AI request failed."
            );
        }

        answerBox.textContent = result.reply;

    } catch (error) {
        console.error("Student360 AI:", error);

        answerBox.textContent =
            "Error: " + error.message;

    } finally {
        button.disabled = false;
        button.textContent = "✧ Ask Student360 AI";
    }
}

  function bind() {
    document.querySelectorAll("[data-page]").forEach(b => (b.onclick = () => go(b.dataset.page)));
    document.querySelectorAll("[data-goto]").forEach(b => (b.onclick = () => go(b.dataset.goto)));
    document.querySelectorAll("[data-close]").forEach(b => (b.onclick = () => modal(b.dataset.close, false)));
    document.querySelectorAll(".backdrop").forEach(
      b =>
        (b.onclick = e => {
          if (e.target === b) modal(b.id, false);
        })
    );

    $("menu").onclick = () => $("sidebar").classList.toggle("open");
    $("theme").onclick = () => document.body.classList.toggle("light");
    $("editName").onclick = () => {
      let n = prompt("What should we call you?", data.name);
      if (n?.trim()) {
        data.name = n.trim().slice(0, 30);
        save();
        toast("Profile name updated.");
      }
    };

    $("newTask").onclick = () => openTask();
    $("newExpense").onclick = () => {
      $("expenseForm").reset();
      $("expenseDate").value = today();
      modal("expenseModal");
    };
    $("editBudget").onclick = () => {
      $("budgetInput").value = data.budget;
      modal("budgetModal");
    };

    $("taskFilter").onchange = renderPlanner;
    $("subjectFilter").onchange = renderPlanner;
    $("dailySave").oninput = updateSimulator;
    $("askAI").addEventListener("click", askStudent360);

    $("taskForm").onsubmit = e => {
      e.preventDefault();
      let t = {
        id: editing || crypto.randomUUID(),
        title: $("taskTitle").value.trim(),
        subject: $("taskSubject").value.trim(),
        date: $("taskDate").value,
        hours: Number($("taskHours").value),
        priority: $("taskPriority").value,
        done: false
      };
      if (editing) {
        let old = data.tasks.find(x => x.id === editing);
        t.done = old?.done || false;
        data.tasks = data.tasks.map(x => (x.id === editing ? t : x));
      } else data.tasks.push(t);
      save();
      modal("taskModal", false);
      toast(editing ? "Study task updated." : "Study task added.");
      editing = null;
    };

    $("expenseForm").onsubmit = e => {
      e.preventDefault();
      let x = {
        id: crypto.randomUUID(),
        title: $("expenseTitle").value.trim(),
        amount: Number($("expenseAmount").value),
        category: $("expenseCategory").value,
        date: $("expenseDate").value
      };
      if (x.title && x.amount > 0) {
        data.expenses.push(x);
        save();
        modal("expenseModal", false);
        toast("Expense saved successfully.");
      }
    };

    $("budgetForm").onsubmit = e => {
      e.preventDefault();
      let n = Number($("budgetInput").value);
      if (n >= 0) {
        data.budget = n;
        save();
        modal("budgetModal", false);
        toast("Monthly budget updated.");
      }
    };

    document.addEventListener("change", e => {
      if (e.target.matches("[data-check]")) {
        let t = data.tasks.find(x => x.id === e.target.dataset.check);
        if (t) {
          t.done = e.target.checked;
          save();
          toast(t.done ? "Nice work — task completed!" : "Task moved to pending.");
        }
      }
    });

    document.addEventListener("click", e => {
      let edit = e.target.closest("[data-edit]"),
        dt = e.target.closest("[data-delete-task]"),
        de = e.target.closest("[data-delete-expense]");
      if (edit) {
        let t = data.tasks.find(x => x.id === edit.dataset.edit);
        if (t) openTask(t);
      }
      if (dt && confirm("Delete this study task?")) {
        data.tasks = data.tasks.filter(x => x.id !== dt.dataset.deleteTask);
        save();
        toast("Task deleted.");
      }
      if (de && confirm("Delete this expense?")) {
        data.expenses = data.expenses.filter(x => x.id !== de.dataset.deleteExpense);
        save();
        toast("Expense deleted.");
      }
    });
  }

  function init() {
    $("today").textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
    $("taskDate").value = today();
    $("expenseDate").value = today();
    bind();
    render();
  }

  init();
})();