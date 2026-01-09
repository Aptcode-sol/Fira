// Shared date/time formatting utilities

function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

function monthName(date: Date): string {
    return date.toLocaleString("en-US", { month: "long" });
}

function monthShort(date: Date): string {
    return date.toLocaleString("en-US", { month: "short" });
}

function parseDate(dateStr: string): Date {
    return new Date(dateStr);
}

function formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
}

// Format DateTime as "30th Dec 14:00" for event cards
export function formatEventDateTime(dateTimeStr: string): string {
    const date = parseDate(dateTimeStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const day = date.getDate();
    return `${day}${getOrdinal(day)} ${monthShort(date)} ${formatTime(date)}`;
}

// Format DateTime range: "from 30th December 14:00 to 31st December 18:00"
export function formatDateTimeRange(startDateTimeStr: string, endDateTimeStr: string): string {
    const startDate = parseDate(startDateTimeStr);
    const endDate = parseDate(endDateTimeStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 'Invalid Date Range';
    }

    const startDay = startDate.getDate();
    const endDay = endDate.getDate();

    const startPart = `${startDay}${getOrdinal(startDay)} ${monthName(startDate)} ${formatTime(startDate)}`;
    const endPart = `${endDay}${getOrdinal(endDay)} ${monthName(endDate)} ${formatTime(endDate)}`;

    return `from ${startPart} to ${endPart}`;
}

// Format single DateTime: "30th December 14:00"
export function formatSingleDateTime(dateTimeStr: string): string {
    const date = parseDate(dateTimeStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const day = date.getDate();
    return `${day}${getOrdinal(day)} ${monthName(date)} ${formatTime(date)}`;
}

// Legacy support - kept for backward compatibility with old data
export function formatEventCardDateTime(dateStr: string, time?: string): string {
    const date = parseDate(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    const day = date.getDate();
    const timeStr = time || formatTime(date);
    return `${day}${getOrdinal(day)} ${monthShort(date)} ${timeStr}`;
}

export function formatHumanDate(dateStr: string): string {
    const d = parseDate(dateStr);
    if (isNaN(d.getTime())) return 'Invalid Date';
    const day = d.getDate();
    return `${day}${getOrdinal(day)} ${monthName(d)}`;
}

