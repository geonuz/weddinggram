class TouchHandler {
    constructor(options = {}) {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.isScrolling = null;
        
        this.options = {
            threshold: options.threshold || 0.15,
            minTouchDuration: options.minTouchDuration || 100,
            minTouchDistance: options.minTouchDistance || 10
        };
    }

    handleStart(e) {
        this.touchStartTime = Date.now();
        this.touchStartX = e.touches[0].pageX;
        this.touchStartY = e.touches[0].pageY;
        this.isScrolling = null;
        return { x: this.touchStartX, y: this.touchStartY };
    }

    handleMove(e) {
        const touchCurrentX = e.touches[0].pageX;
        const touchCurrentY = e.touches[0].pageY;
        const deltaX = Math.abs(touchCurrentX - this.touchStartX);
        const deltaY = Math.abs(touchCurrentY - this.touchStartY);

        if (this.isScrolling === null) {
            this.isScrolling = deltaY > deltaX;
        }

        return {
            isScrolling: this.isScrolling,
            deltaX,
            deltaY,
            currentX: touchCurrentX,
            currentY: touchCurrentY
        };
    }

    handleEnd(e) {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - this.touchStartTime;
        const touchEndX = e.changedTouches[0].pageX;
        const touchDiff = Math.abs(touchEndX - this.touchStartX);
        const direction = touchEndX < this.touchStartX ? 'left' : 'right';

        return {
            isValid: touchDuration >= this.options.minTouchDuration && 
                    touchDiff >= this.options.minTouchDistance && 
                    !this.isScrolling,
            direction,
            duration: touchDuration,
            distance: touchDiff
        };
    }
}

// 디바이스 체크 유틸리티
const UTILS = {
    isMobile: () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    
    // localStorage 관련 유틸리티
    storage: {
        get: (key, defaultValue = '{}') => JSON.parse(localStorage.getItem(key) || defaultValue),
        set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
        remove: (key) => localStorage.removeItem(key)
    },
    
    // TouchHandler 클래스를 UTILS의 일부로 추가
    TouchHandler
};

export { UTILS }; 