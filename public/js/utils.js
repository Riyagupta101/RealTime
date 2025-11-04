// Utility Functions

// Format time to HH:MM
function formatTime(date) {
    return date.getHours() + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
}

// Get current time in HH:MM format
function getCurrentTime() {
    return formatTime(new Date());
}

// Check if element is in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Generate random response for simulation
function getRandomResponse() {
    const responses = [
        "That sounds good!",
        "I'll check and get back to you.",
        "Thanks for letting me know.",
        "Can we discuss this in more detail?",
        "I agree with your point.",
        "Let me think about it and revert.",
        "That's great news!",
        "I'll take care of it.",
        "Looking forward to it!",
        "Thanks for the update."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Generate unique ID
function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export utilities for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatTime,
        getCurrentTime,
        isElementInViewport,
        getRandomResponse,
        generateId,
        debounce
    };
}