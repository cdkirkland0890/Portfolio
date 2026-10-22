//==============================
//File: js/calendar.js
//Dynamic Booking Calendar
//==============================
//-------DOM Elements -----
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const selectedDateLabel = document.getElementById("selectedDateText");
const timeSlots = document.getElementById("timeSlots");
const bookingForm = document.getElementById("bookingForm");
const customerName = document.getElementById("customerName");
const customerService = document.getElementById("customerService");
const selectedTimeInput = document.getElementById("selectedTimeInput");
const bookingMessage = document.getElementById("bookingMessage");
//----Calendar State ----
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let selectedDate = null;
let selectedTime = "";
//------Time Slot Data-----
const weekdaySlots = [
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
    
];
const saturdaySlots = [
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
]
// Example booked data for practice
const bookedAppointments = {
    "2026-10-13": ["10:00 AM", "2:00 PM"],
    "2026-10-14": [],
};
//-----Helpers----
const getMonthName = (monthIndex) => {
    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];
    return monthNames[monthIndex];
};
const formatDateKey = (year, month, day) => {
    const safeMonth = String(month +1).padStart(2, "0");
    const safeDay = String(day).padStart(2, "0");
    return `${year}-${safeMonth}-${safeDay}`;
};
const formatReadableDate = (year, month, day) => {
    const date = new Date(year, month, day);
    return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
};
const isPastDate = (year, month, day) => {
    const compareDate = new Date(year, month, day);
    compareDate.setHours(0, 0, 0, 0);
    const todayOnly = new Date();
    todayOnly.setHours(0, 0, 0, 0);
    return compareDate < todayOnly ;
};
const isClosedDay = (year, month, day) => {
    const date = new Date(year, month, day);
    const weekday = date.getDay();
    //sunday closed
    if (weekday === 0) {
        return true;
    }
    return false;
};
const getSlotsForDate = (year, month, day) => {
    const date = new Date(year, month, day);
    const weekday = date.getDay();
    if (weekday === 6) {
        return saturdaySlots;
    }
    if (weekday === 0) {
        return [];
    }
    return weekdaySlots;
};
//-----Render Calendar-----
const renderCalendar = () => {
    if (!calendarGrid || !calendarMonthLabel) return;
    //if the calendar is not (!) available, don't run!
    //if the monthLabel is not (!) available, don't run!
    calendarMonthLabel.textContent = `${getMonthName(currentMonth)} ${currentYear}`;
    calendarGrid.innerHTML = "";
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let i = 0; i < firstDayOfMonth; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-empty";
        calendarGrid.appendChild(emptyCell);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dayButton = document.createElement("button");
        dayButton.textContent = day;
        dayButton.className = "calendar-day";
        const dateKey = formatDateKey(currentYear, currentMonth, day);
        if (
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear()
        ) {
            dayButton.classList.add("today");
        }
        if (
            isPastDate(currentYear, currentMonth, day) ||
            isClosedDay(currentYear, currentMonth, day)
        ) {
            dayButton.classList.add("disabled");
        }
        if (
            selectedDate &&
            selectedDate.year === currentYear &&
            selectedDate.month === currentMonth &&
            selectedDate.day === day
        ) {
            dayButton.classList.add("selected");
        }
        dayButton.addEventListener("click", () => {
            if (isPastDate(currentYear, currentMonth, day)) return;
            if (isClosedDay(currentYear, currentMonth, day)) return;
            selectedDate = {
                year: currentYear,
                month: currentMonth,
                day: day,
                key: dateKey,
            };
            selectedTime = "";
            selectedTimeInput.value = "";
            selectedDate.textContent = formatReadableDate(
                currentYear,
                currentMonth,
                day,
            );
            renderCalendar();
            renderTimeSlots();
            bookingMessage.textContent = "";
            bookingMessage.className = "booking-message";
    });
    calendarGrid.appendChild(dayButton);
}
};
//-----Render Time Slots-----
const renderTimeSlots = () => {
    if (!timeSlots) return;
    timeSlots.innerHTML = "";
    if (!selectedDate) {
        timeSlots.innerHTML = `<p class="selected-date-text">Choose a date first.</p>`;
        return;
    }
    const slots = getSlotsForDate(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
    );
    const bookedForDay = bookedAppointments[selectedDate.key] || [];
    if (slots.length === 0) {
        timeSlots.innerHTML = `<p class="selected-date-text">No appointments available for this date.</p>`;
        return;
    }
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const slotBtn = document.createElement("button");
        slotBtn.type = "button";
        slotBtn.textContent = slot;
        slotBtn.className = "time-slot-btn";
        if (bookedForDay.includes(slot)) {
            slotBtn.classList.add("disabled");
            slotBtn.disabled = true;
            slotBtn.textContent = `${slot} = Booked`;
        }
        if (selectedTime === slot) {
            slotBtn.classList.add("selected");
        }
        slotBtn.addEventListener("click", () => {
            selectedTime = slot;
            selectedTimeInput.value = slot;
            renderTimeSlots();
    });
    timeSlots.appendChild(slotBtn);
    }
};
//-----Month Navigation-----
if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11 ;
            currentYear--;
        }
        renderCalendar();
});
}
if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11){
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
});
}
//-----Booking Submit-----
if (bookingForm) {
    bookingForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const nameValue = customerName.value.trim();
        const serviceValue = customerService.valu;
        const timeValue = selectedTimeInput.value;
        if (
            nameValue === "" ||
            serviceValue === "" ||
            !selectedDate ||
            timeValue === ""
        ) {
            bookingMessage.textContent =
            "please choose a date, time, name, and service.";
            bookingMessage.className = "booking-message error";
            return;
        }
        if (!bookedAppointments[selectedDate.key]) {
            bookedAppointments[selectedDate.key] = [];
        }
        if (bookedAPpointments[selectedDate.key].includes(timeValue)){
            bookingMessage.textContent = 
            "That time was just taken. Please choose another.";
            bookingMessage.className = "booking-message error";
            renderTimeSlots();
            return;
        }
        bookedAppointments[selectedDate.key].push(timeValue);
        bookingMessage.textContent = `${nameValue}, your ${serviceValue} appointment is booked for ${formatReadableDate}(
        selectedDate.year,
        selectedDate.month,
        selectedDate.day,
    )} at ${timeValue}.`;
     bookingMessage.className = "booking-message success";
     bookingForm.requestFullscreen();
     selectedTime = "";
     selectedTimeInput.value = "";
     renderTimeSlots();
});
}
//-----App Start-----
renderCalendar();
renderTimeSlots();