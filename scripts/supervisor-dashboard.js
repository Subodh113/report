// supervisor-dashboard.js

document.addEventListener("DOMContentLoaded", async () => {
  // Replace this with your actual supervisor login/session
  const supervisorName = "John Doe"; 
  document.getElementById("supervisorName").textContent = supervisorName;

  const today = new Date();
  const todayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const todayStr = today.toISOString().split("T")[0];
  document.getElementById("todayLabel").textContent = todayName + ", " + todayStr;

  loadTodayActivities(todayName, today);
});

async function loadTodayActivities(dayName, today) {
  const list = document.getElementById("activityList");
  list.innerHTML = "<p class='text-center text-muted'>Loading activities...</p>";

  const snapshot = await db.collection("schedules").where("isActive", "==", true).get();

  if (snapshot.empty) {
    list.innerHTML = "<p class='text-center text-danger'>No schedules found.</p>";
    return;
  }

  let todaysActivities = [];
  snapshot.forEach(doc => {
    const data = doc.data();

    if (data.recurrence === "weekly" && data.days.includes(dayName)) {
      todaysActivities.push({ id: doc.id, ...data });
    } else if (data.recurrence === "monthly") {
      // e.g., first day of the month
      const actDate = new Date(data.startDate);
      if (today.getDate() === actDate.getDate()) todaysActivities.push({ id: doc.id, ...data });
    } else if (data.recurrence === "quarterly") {
      // every 3 months from start date
      const start = new Date(data.startDate);
      const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
      if (diffMonths % 3 === 0 && today.getDate() === start.getDate()) {
        todaysActivities.push({ id: doc.id, ...data });
      }
    }
  });

  if (!todaysActivities.length) {
    list.innerHTML = "<p class='text-center text-success'>No activities scheduled for today 🎉</p>";
    return;
  }

  list.innerHTML = "";
  todaysActivities.forEach((activity) => {
    const div = document.createElement("div");
    div.className = "card p-3 mb-3 activity-card";

    div.innerHTML = `
      <h6 class="mb-1 text-primary">${activity.activityName}</h6>
      <p class="small mb-2 text-muted">${activity.department} — ${activity.recurrence}</p>
      <div class="mb-2">
        <label class="form-label small">Upload Photos:</label>
        <input type="file" id="file-${activity.id}" multiple accept="image/*" class="form-control form-control-sm">
      </div>
      <div class="d-grid gap-2 d-md-flex justify-content-md-end">
        <button class="btn btn-sm btn-success" onclick="submitActivity('${activity.id}', '${activity.activityName}', '${activity.department}')">Submit</button>
      </div>
    `;
    list.appendChild(div);
  });
}

async function submitActivity(id, activityName, department) {
  const input = document.getElementById(`file-${id}`);
  const files = input.files;
  if (!files.length) return alert("Please select at least one photo");

  const supervisorName = document.getElementById("supervisorName").textContent;
  const dateStr = new Date().toISOString().split("T")[0];

  // Use your existing upload.js logic
  await uploadFilesAndSave(files, activityName, dateStr, supervisorName);

  alert(`${activityName} marked as completed!`);
}