// Test file to verify console logging in Sensei
console.log("Sensei Console Test: Starting tests...");

// Test different console methods
console.log("LOG: This is a log message");
console.info("INFO: This is an info message");
console.warn("WARN: This is a warning message");
console.error("ERROR: This is an error message");

// Test with multiple arguments
console.log("Multiple args:", "string", 123, true, { key: "value" });

// Test with objects
const testObject = {
    name: "SenseiTest",
    version: "1.0.0",
    features: ["console", "logging", "sync"]
};
console.log("Object test:", testObject);

// Test with arrays
const numbers = [1, 2, 3, 4, 5];
console.log("Array test:", numbers);

// Test with timestamp
console.log(`Test completed at: ${new Date().toISOString()}`);

// Final message
console.log("Sensei Console Test: All tests completed successfully!");