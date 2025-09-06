// Canvas Calendar Reader
class CanvasCalendarReader {
    constructor() {
        this.calendarUrl = 'https://canvas.illinois.edu/feeds/calendars/user_XPkQO3PypASsI5uWjRFvFpdRhTncK0airtJ6Hvuu.ics';
        this.tasks = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('loadCalendar').addEventListener('click', () => {
            this.loadCalendar();
        });
    }

    async loadCalendar() {
        const loadingElement = document.getElementById('loading');
        const errorElement = document.getElementById('error');
        const tasksContainer = document.getElementById('tasksContainer');
        const noTasksElement = document.getElementById('noTasks');
        const calendarInfo = document.getElementById('calendarInfo');
        const dateRange = document.getElementById('dateRange');

        // Show loading state
        loadingElement.style.display = 'flex';
        errorElement.style.display = 'none';
        tasksContainer.innerHTML = '';

        try {
            // Fetch the calendar data
            const response = await fetch(this.calendarUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const icsData = await response.text();
            
            // Parse the ICS data
            this.tasks = this.parseICSData(icsData);
            
            // Filter tasks for next two weeks
            const upcomingTasks = this.filterUpcomingTasks(this.tasks);
            
            // Hide loading state
            loadingElement.style.display = 'none';
            
            if (upcomingTasks.length === 0) {
                noTasksElement.innerHTML = '<p>No upcoming tasks in the next two weeks</p>';
                noTasksElement.style.display = 'block';
                calendarInfo.style.display = 'none';
            } else {
                noTasksElement.style.display = 'none';
                calendarInfo.style.display = 'block';
                
                // Update date range display
                const today = new Date();
                const twoWeeksFromNow = new Date(today.getTime() + (14 * 24 * 60 * 60 * 1000));
                dateRange.textContent = `${this.formatDate(today)} - ${this.formatDate(twoWeeksFromNow)}`;
                
                // Display tasks
                this.displayTasks(upcomingTasks);
            }
            
        } catch (error) {
            console.error('Error loading calendar:', error);
            loadingElement.style.display = 'none';
            errorElement.style.display = 'block';
            document.getElementById('errorMessage').textContent = 
                `Failed to load calendar: ${error.message}. This might be due to CORS restrictions. Please try using a CORS proxy or hosting this on a server.`;
        }
    }

    parseICSData(icsData) {
        const tasks = [];
        const lines = icsData.split('\n');
        let currentEvent = {};
        let inEvent = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line === 'BEGIN:VEVENT') {
                currentEvent = {};
                inEvent = true;
            } else if (line === 'END:VEVENT' && inEvent) {
                if (currentEvent.summary && currentEvent.dtstart) {
                    tasks.push(this.processEvent(currentEvent));
                }
                inEvent = false;
            } else if (inEvent) {
                this.parseEventLine(line, currentEvent);
            }
        }

        return tasks;
    }

    parseEventLine(line, event) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;

        const key = line.substring(0, colonIndex).toLowerCase();
        const value = line.substring(colonIndex + 1);

        switch (key) {
            case 'summary':
                event.summary = this.decodeICSValue(value);
                break;
            case 'dtstart':
                event.dtstart = this.parseICSDate(value);
                break;
            case 'description':
                event.description = this.decodeICSValue(value);
                break;
            case 'url':
                event.url = value;
                break;
        }
    }

    processEvent(event) {
        const task = {
            title: event.summary || 'Untitled Task',
            date: event.dtstart,
            description: event.description || '',
            url: event.url || '',
            course: this.extractCourseFromTitle(event.summary),
            type: this.determineTaskType(event.summary)
        };

        return task;
    }

    extractCourseFromTitle(title) {
        if (!title) return 'Unknown Course';
        
        // Look for course codes in brackets like [eng_100_120258_252389]
        const courseMatch = title.match(/\[([^\]]+)\]/);
        if (courseMatch) {
            return courseMatch[1];
        }
        
        // Look for common course patterns
        const coursePatterns = [
            /(eng_\d+)/i,
            /(ece_\d+)/i,
            /(rhet_\d+)/i,
            /(cs_\d+)/i,
            /(math_\d+)/i
        ];
        
        for (const pattern of coursePatterns) {
            const match = title.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return 'Unknown Course';
    }

    determineTaskType(title) {
        if (!title) return 'task';
        
        const lowerTitle = title.toLowerCase();
        
        if (lowerTitle.includes('exam') || lowerTitle.includes('final')) {
            return 'exam';
        } else if (lowerTitle.includes('lecture') || lowerTitle.includes('class')) {
            return 'lecture';
        } else if (lowerTitle.includes('assignment') || lowerTitle.includes('homework')) {
            return 'assignment';
        } else if (lowerTitle.includes('quiz') || lowerTitle.includes('test')) {
            return 'quiz';
        }
        
        return 'task';
    }

    parseICSDate(dateString) {
        // Handle different date formats
        if (dateString.includes('T')) {
            // Full datetime format
            return new Date(dateString.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z'));
        } else if (dateString.length === 8) {
            // Date only format (YYYYMMDD)
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            return new Date(year, month - 1, day);
        }
        
        return new Date(dateString);
    }

    decodeICSValue(value) {
        // Decode ICS escaped characters
        return value
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\')
            .replace(/\\r/g, '\r');
    }

    filterUpcomingTasks(tasks) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const twoWeeksFromNow = new Date(today);
        twoWeeksFromNow.setDate(today.getDate() + 14);
        
        return tasks.filter(task => {
            const taskDate = new Date(task.date);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate >= today && taskDate <= twoWeeksFromNow;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    displayTasks(tasks) {
        const tasksContainer = document.getElementById('tasksContainer');
        
        tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            tasksContainer.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item ${task.type}`;
        
        const courseSpan = document.createElement('span');
        courseSpan.className = 'task-course';
        courseSpan.textContent = task.course;
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'task-title';
        titleDiv.textContent = task.title;
        
        const dateDiv = document.createElement('div');
        dateDiv.className = 'task-date';
        dateDiv.textContent = this.formatDate(new Date(task.date));
        
        const descriptionDiv = document.createElement('div');
        descriptionDiv.className = 'task-description';
        descriptionDiv.textContent = this.cleanDescription(task.description);
        
        taskDiv.appendChild(courseSpan);
        taskDiv.appendChild(titleDiv);
        taskDiv.appendChild(dateDiv);
        taskDiv.appendChild(descriptionDiv);
        
        // Add click handler for URL if available
        if (task.url) {
            taskDiv.style.cursor = 'pointer';
            taskDiv.addEventListener('click', () => {
                window.open(task.url, '_blank');
            });
        }
        
        return taskDiv;
    }

    cleanDescription(description) {
        if (!description) return '';
        
        // Remove HTML tags and clean up the description
        return description
            .replace(/<[^>]*>/g, '')
            .replace(/\\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200) + (description.length > 200 ? '...' : '');
    }

    formatDate(date) {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('en-US', options);
    }
}

// Initialize the calendar reader when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CanvasCalendarReader();
});
