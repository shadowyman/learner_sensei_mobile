
// Page Structure Inspection
console.log("===== PAGE STRUCTURE INSPECTION =====");

// Check if we're in an iframe
console.log("Is in iframe:", window !== window.top);
console.log("Window location:", window.location.href);

// Count iframes in the document
const iframes = document.querySelectorAll('iframe');
console.log("Number of iframes found:", iframes.length);

// Log details about each iframe
iframes.forEach((iframe, index) => {
    console.log(`\nIframe #${index}:`);
    console.log("  - src:", iframe.src || "no src");
    console.log("  - id:", iframe.id || "no id");
    console.log("  - visible:", iframe.offsetParent !== null);
    
    // Try to access iframe content
    try {
        const iframeDoc = iframe.contentDocument;
        const iframeWin = iframe.contentWindow;
        
        if (iframeDoc && iframeWin) {
            console.log("  - Accessible: YES");
            console.log("  - URL:", iframeWin.location.href);
            
            // Try to inject console log into iframe
            if (iframeWin.console) {
                iframeWin.console.log(`IFRAME_${index}_TEST: Console test from parent window`);
            }
        } else {
            console.log("  - Accessible: NO (null document/window)");
        }
    } catch (e) {
        console.log("  - Accessible: NO (" + e.message + ")");
    }
});

// Check for Shadow DOM
const shadowHosts = Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot);
console.log("\nShadow DOM hosts found:", shadowHosts.length);

// Check app components
console.log("\nApp components:");
console.log("  - Code editor:", !!document.querySelector('.monaco-editor, .cm-editor, [class*="editor"]'));
console.log("  - File tree:", !!document.querySelector('[class*="file-tree"], [class*="explorer"]'));
console.log("  - Output area:", !!document.querySelector('[class*="output"], [class*="console"]'));

// Test console from main context
console.log("\nMAIN_CONTEXT_TEST: Testing console.log from main window");
console.error("MAIN_CONTEXT_TEST: Testing console.error from main window");
console.warn("MAIN_CONTEXT_TEST: Testing console.warn from main window");

console.log("===== INSPECTION COMPLETE =====");
