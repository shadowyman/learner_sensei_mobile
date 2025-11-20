export class ChatWindowController {
    private static instance: ChatWindowController;
    
    // Configuration
    private readonly AUTO_RESIZE_CONFIG = {
        enabled: true,
        debounceDelay: 250,
        maxScaleFactor: 1.5,
        expansionThreshold: 100,
        preferenceKey: 'chatWindowAutoResize'
    };
    
    // State management
    private isResizingWindow = false;
    private autoResizeEnabled = true;
    private previousViewportWidth = window.innerWidth;
    private previousViewportHeight = window.innerHeight;
    private resizeDebounceTimer: number | null = null;
    private isAutoResizing = false;
    
    // Dragging state
    private isDragging = false;
    private currentX = 0;
    private currentY = 0;
    private initialX = 0;
    private initialY = 0;
    
    // DOM elements
    private chatContainer: HTMLElement | null = null;
    private header: HTMLElement | null = null;
    private resizeHandle: HTMLElement | null = null;
    
    // Event handlers (stored for cleanup)
    private dragStartHandler: ((e: MouseEvent) => void) | null = null;
    private dragHandler: ((e: MouseEvent) => void) | null = null;
    private dragEndHandler: (() => void) | null = null;
    private viewportChangeHandler: (() => void) | null = null;
    
    private constructor() {
        // Private constructor for singleton
    }
    
    public static getInstance(): ChatWindowController {
        if (!ChatWindowController.instance) {
            ChatWindowController.instance = new ChatWindowController();
        }
        return ChatWindowController.instance;
    }
    
    public initialize(): void {
        this.chatContainer = document.getElementById('chat-container');
        this.header = document.querySelector('.chat-window-header') as HTMLElement;
        
        if (!this.chatContainer) {
            console.warn('ChatWindowController: chat-container element not found');
            return;
        }
        
        if (!this.header) {
            console.warn('ChatWindowController: chat-window-header element not found');
            return;
        }
        
        this.makeWindowDraggable();
        this.initializeAutoResizeSystem();
    }
    
    private makeWindowDraggable(): void {
        if (!this.chatContainer || !this.header) {
            console.warn('ChatWindowController: Cannot make window draggable - elements not found');
            return;
        }
        
        // Set initial styles once
        if (!this.chatContainer.style.position || this.chatContainer.style.position === 'relative') {
            const rect = this.chatContainer.getBoundingClientRect();
            this.chatContainer.style.position = 'fixed';
            this.chatContainer.style.width = rect.width + 'px';
            this.chatContainer.style.height = rect.height + 'px';
            this.chatContainer.style.top = '50%';
            this.chatContainer.style.left = '50%';
            this.chatContainer.style.transform = 'translate(-50%, -50%)';
            this.chatContainer.style.margin = '0';
        }
        this.header.style.cursor = 'move';
        
        // Create bound handlers
        this.dragStartHandler = this.dragStart.bind(this);
        this.dragHandler = this.drag.bind(this);
        this.dragEndHandler = this.dragEnd.bind(this);
        
        // Add event listeners with null check
        if (this.header) {
            this.header.addEventListener('mousedown', this.dragStartHandler);
        }
        if (this.dragHandler && this.dragEndHandler) {
            document.addEventListener('mousemove', this.dragHandler);
            document.addEventListener('mouseup', this.dragEndHandler);
        }
    }
    
    private dragStart(e: MouseEvent): void {
        if (!this.chatContainer || !this.header) return;
        
        // Ignore if clicking on controls or resize handle
        if ((e.target as HTMLElement).closest('.chat-window-controls')) return;
        if ((e.target as HTMLElement).closest('.resize-handle')) return;
        
        // Don't start dragging if resizing is in progress
        if (this.isResizingWindow) return;
        
        const targetElement = e.target as HTMLElement;
        if (targetElement === this.header || targetElement.closest('.chat-window-header')) {
            e.preventDefault();
            e.stopPropagation();
            
            const rect = this.chatContainer.getBoundingClientRect();
            
            // If still centered, convert to absolute positioning
            if (this.chatContainer.style.transform.includes('translate')) {
                this.chatContainer.style.transform = 'none';
                this.chatContainer.style.left = rect.left + 'px';
                this.chatContainer.style.top = rect.top + 'px';
            }
            
            this.isDragging = true;
            this.currentX = parseInt(this.chatContainer.style.left);
            this.currentY = parseInt(this.chatContainer.style.top);
            this.initialX = e.clientX;
            this.initialY = e.clientY;
            
            document.body.style.userSelect = 'none';
        }
    }
    
    private dragEnd(): void {
        if (this.isDragging) {
            this.isDragging = false;
            document.body.style.userSelect = '';
        }
    }
    
    private drag(e: MouseEvent): void {
        if (!this.isDragging || this.isResizingWindow || !this.chatContainer) return;
        
        e.preventDefault();
        
        this.currentX = this.currentX + (e.clientX - this.initialX);
        this.currentY = this.currentY + (e.clientY - this.initialY);
        this.initialX = e.clientX;
        this.initialY = e.clientY;
        
        this.chatContainer.style.left = this.currentX + 'px';
        this.chatContainer.style.top = this.currentY + 'px';
    }
    
    private initializeAutoResizeSystem(): void {
        // Load user preferences
        const savedPreference = localStorage.getItem(this.AUTO_RESIZE_CONFIG.preferenceKey);
        if (savedPreference !== null) {
            this.autoResizeEnabled = savedPreference === 'true';
        }
        
        // Set up viewport monitoring
        this.viewportChangeHandler = this.handleViewportChange.bind(this);
        window.addEventListener('resize', this.viewportChangeHandler);
    }
    
    private handleViewportChange(): void {
        // Clear existing timer
        if (this.resizeDebounceTimer) {
            clearTimeout(this.resizeDebounceTimer);
        }
        
        // Debounce the resize handling
        this.resizeDebounceTimer = window.setTimeout(() => {
            this.processViewportChange();
        }, this.AUTO_RESIZE_CONFIG.debounceDelay);
    }
    
    private processViewportChange(): void {
        if (!this.autoResizeEnabled || this.isAutoResizing || this.isResizingWindow) {
            return;
        }
        
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        
        const widthIncrease = currentWidth - this.previousViewportWidth;
        const heightIncrease = currentHeight - this.previousViewportHeight;
        
        // Check if expansion threshold is met
        if (widthIncrease >= this.AUTO_RESIZE_CONFIG.expansionThreshold || 
            heightIncrease >= this.AUTO_RESIZE_CONFIG.expansionThreshold) {
            this.applyAutoResize(widthIncrease, heightIncrease);
        }
        
        // Update previous dimensions
        this.previousViewportWidth = currentWidth;
        this.previousViewportHeight = currentHeight;
    }
    
    private applyAutoResize(widthIncrease: number, heightIncrease: number): void {
        this.isAutoResizing = true;
        
        if (!this.chatContainer) {
            this.isAutoResizing = false;
            return;
        }
        
        const currentRect = this.chatContainer.getBoundingClientRect();
        const currentWidth = currentRect.width;
        const currentHeight = currentRect.height;
        
        // Calculate new dimensions with scaling factor limits
        const availableWidth = window.innerWidth * 0.9;
        const availableHeight = window.innerHeight * 0.9;
        
        let newWidth = Math.min(
            currentWidth + (widthIncrease * 0.7),
            availableWidth,
            currentWidth * this.AUTO_RESIZE_CONFIG.maxScaleFactor
        );
        
        let newHeight = Math.min(
            currentHeight + (heightIncrease * 0.7),
            availableHeight,
            currentHeight * this.AUTO_RESIZE_CONFIG.maxScaleFactor
        );
        
        // Ensure minimum constraints
        newWidth = Math.max(newWidth, 400);
        newHeight = Math.max(newHeight, 300);
        
        // Apply resize with smooth transition
        requestAnimationFrame(() => {
            if (this.chatContainer) {
                this.chatContainer.style.width = `${newWidth}px`;
                this.chatContainer.style.height = `${newHeight}px`;
            }
            
            // Reset auto-resize flag after animation
            setTimeout(() => {
                this.isAutoResizing = false;
            }, 200);
        });
    }
    
    public setAutoResizePreference(enabled: boolean): void {
        this.autoResizeEnabled = enabled;
        localStorage.setItem(this.AUTO_RESIZE_CONFIG.preferenceKey, enabled.toString());
    }
    
    public getAutoResizePreference(): boolean {
        return this.autoResizeEnabled;
    }
    
    // Public method to check if window is being resized
    public isResizing(): boolean {
        return this.isResizingWindow;
    }
    
    // Cleanup method
    public destroy(): void {
        // Remove event listeners
        if (this.header && this.dragStartHandler) {
            this.header.removeEventListener('mousedown', this.dragStartHandler);
        }
        if (this.dragHandler) {
            document.removeEventListener('mousemove', this.dragHandler);
        }
        if (this.dragEndHandler) {
            document.removeEventListener('mouseup', this.dragEndHandler);
        }
        if (this.viewportChangeHandler) {
            window.removeEventListener('resize', this.viewportChangeHandler);
        }
        
        // Clear timers
        if (this.resizeDebounceTimer) {
            clearTimeout(this.resizeDebounceTimer);
        }
        
        // Remove resize handle
        if (this.resizeHandle && this.resizeHandle.parentNode) {
            this.resizeHandle.parentNode.removeChild(this.resizeHandle);
        }
    }
}
