import { UTILS } from './utils.js';

/**
 * Post 클래스: 게시물의 전체적인 기능을 관리
 */
class Post {
    /**
     * @param {HTMLElement} element - 게시물 DOM 요소
     */
    constructor(element) {
        this.element = element;
        this.postId = element.dataset.postId;
        if (this.postId) this.initializeComponents();
    }

    initializeComponents() {
        this.like = new LikeComponent(this.element, this.postId),
        this.slider = new SliderComponent(this.element),
        this.save = new SaveComponent(this.element)
    }

    cleanup() {
        // 각 컴포넌트의 이벤트 리스너 제거
        if (this.like) this.like.cleanup();
        if (this.slider) this.slider.cleanup();
        if (this.save) this.save.cleanup();

        // 컴포넌트 참조 제거
        this.like = null;
        this.slider = null;
        this.save = null;

        // element 참조 제거
        this.element = null;
        this.postId = null;
    }
}

/**
 * 좋아요 기능을 관리하는 컴포넌트
 */
class LikeComponent {
    constructor(postElement, postId) {
        this.button = postElement.querySelector('.like');
        if (!this.button) return;

        this.postId = postId;
        this.lovedIcon = this.button.querySelector('.loved');
        this.notLovedIcon = this.button.querySelector('.not_loved');
        this.countSpan = this.button.querySelector('.like-count');

        this.handleLikeClick = this.handleLikeClick.bind(this); // 바인딩된 함수 저장
        this.initializeState();
        this.bindEvents();
    }

    bindEvents() {
        this.button.addEventListener('click', this.handleLikeClick);
    }

    cleanup() {
        if (this.button) {
            this.button.removeEventListener('click', this.handleLikeClick);
        }
    }

    initializeState() {
        const likedPosts = UTILS.storage.get('likedPosts');
        if (likedPosts[this.postId]) {
            this.setLikedState(true);
        }
    }

    async handleLikeClick() {
        try {
            const isLiked = this.lovedIcon.classList.contains("display");
            const response = await this.updateLikeStatus(isLiked);
            
            if (response.success) {
                this.updateUI(isLiked, response.likes);
                this.updateLocalStorage(isLiked);
            }
        } catch (error) {
            console.error('Error updating like:', error);
        }
    }

    async updateLikeStatus(isLiked) {
        const response = await fetch(`/like/${this.postId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: isLiked ? 'remove' : 'add' })
        });
        return await response.json();
    }

    updateUI(isLiked, newLikeCount) {
        this.setLikedState(!isLiked);
        this.button.classList.add(isLiked ? "unliked" : "liked");
        setTimeout(() => {
            this.button.classList.remove(isLiked ? "unliked" : "liked");
        }, 300);
        this.countSpan.textContent = newLikeCount;
    }

    setLikedState(isLiked) {
        this.lovedIcon.classList.toggle("display", isLiked);
        this.notLovedIcon.classList.toggle("hide", isLiked);
    }

    updateLocalStorage(isLiked) {
        const likedPosts = UTILS.storage.get('likedPosts');
        if (isLiked) {
            delete likedPosts[this.postId];
        } else {
            likedPosts[this.postId] = true;
        }
        UTILS.storage.set('likedPosts', likedPosts);
    }
}

/**
 * 슬라이더 기능을 관리하는 컴포넌트
 */
class SliderComponent {
    constructor(postElement) {
        this.slider = postElement.querySelector('.slider');
        if (!this.slider) return;
        
        this.initializeElements();
        this.initializeState();

        // 이벤트 핸들러를 인스턴스 프로퍼티로 바인딩
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);

        this.bindEvents();
        this.updateNavigationUI();
        this.touchStartY = 0;  // Y축 터치 시작 위치 추가
        this.isScrolling = null;  // 스크롤 여부 판단

        this.touchHandler = new UTILS.TouchHandler({
            threshold: 0.1,
            minTouchDuration: 100,
            minTouchDistance: 10
        });

        // Intersection Observer 설정
        this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
            threshold: 0.5 // 50% 이상 보일 때 콜백 실행
        });

        // 모든 비디오 요소에 대해 Observer 설정
        this.mediaWrappers.forEach(wrapper => {
            const video = wrapper.querySelector('video');
            if (video) {
                this.observer.observe(video);
            }
        });
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting) {
                video.play().catch(e => console.log('자동재생 실패:', e));
            } else {
                video.pause();
            }
        });
    }

    initializeElements() {
        this.container = this.slider.querySelector('.media_wrapper');
        this.mediaWrappers = this.slider.querySelectorAll('.media');
        this.mediaCount = this.mediaWrappers.length;

        this.dots = this.slider.closest('.slider_wrapper').querySelectorAll('.nav-dot');
        this.prevBtn = this.slider.querySelector('.slider-arrow.prev');
        this.nextBtn = this.slider.querySelector('.slider-arrow.next');
    }

    initializeState() {
        this.currentIndex = 0;
        this.isDragging = false;
        this.isTransitioning = false;
        this.isMobile = UTILS.isMobile();
        
        // 컨테이너 초기화
        this.container.style.transform = 'translateX(0)';
        this.container.style.transition = 'none';

        // 화살표 버튼 초기 상태 설정
        if (!this.isMobile) {
            if (this.prevBtn) {
                this.prevBtn.style.display = 'none';  // 초기에는 이전 버튼 숨김
            }
            if (this.nextBtn) {
                this.nextBtn.style.display = this.mediaCount > 1 ? 'flex' : 'none';
            }
        } else {
            if (this.prevBtn) this.prevBtn.style.display = 'none';
            if (this.nextBtn) this.nextBtn.style.display = 'none';
        }
        // 첫 번째 미디어가 비디오인 경우 자동 재생
        const firstVideo = this.mediaWrappers[0]?.querySelector('video');
        if (firstVideo) {
            firstVideo.loop = true;
            firstVideo.play();
        }
    }

    bindEvents() {
        if (this.isMobile) {
            document.body.addEventListener('touchstart', (e) => {
                // 이벤트가 슬라이더 컨테이너 내부에서 발생한 경우에만 처리
                if (this.container.contains(e.target)) {
                    this.handleStart(e);
                }
            }, { passive: false });

            document.body.addEventListener('touchmove', (e) => {
                if (this.container.contains(e.target)) {
                    this.handleMove(e);
                }
            }, { passive: false });

            document.body.addEventListener('touchend', (e) => {
                if (this.container.contains(e.target)) {
                    this.handleEnd(e);
                }
            });

        } else {
            this.bindArrowButtons();
        }

        // 마우스 진입/이탈 시 화살표 표시/숨김 (PC only)
        if (!this.isMobile && this.mediaCount > 1) {
            this.slider.addEventListener('mouseenter', () => {
                if (this.currentIndex > 0 && this.prevBtn) {
                    this.prevBtn.style.display = 'flex';
                    this.prevBtn.style.opacity = '1';
                }
                if (this.currentIndex < this.mediaCount - 1 && this.nextBtn) {
                    this.nextBtn.style.display = 'flex';
                    this.nextBtn.style.opacity = '1';
                }
            });

            this.slider.addEventListener('mouseleave', () => {
                if (this.prevBtn) {
                    this.prevBtn.style.opacity = '0';
                }
                if (this.nextBtn) {
                    this.nextBtn.style.opacity = '0';
                }
            });
        }
    }

    bindArrowButtons() {
        if (!this.prevBtn || !this.nextBtn) return;

        this.container.style.transition = 'transform 0.3s ease-in-out';

        this.prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.arrowNavigate('prev');
        });

        this.nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.arrowNavigate('next');
        });
    }

    arrowNavigate(direction) {
        if (this.isTransitioning) return;
        
        this.isTransitioning = true;
        this.currentIndex += direction === 'prev' ? -1 : 1;
        this.updateSlider();
        
        setTimeout(() => {
            this.isTransitioning = false;
        }, 300);
    }

    handleStart(e) {
        const touchInfo = this.touchHandler.handleStart(e);
        this.startX = touchInfo.x;
        this.currentX = this.startX;
        this.isDragging = true;
        this.container.style.transition = 'none';
    }

    handleMove(e) {
        if (!this.isDragging) return;

        const touchInfo = this.touchHandler.handleMove(e);
        
        if (touchInfo.isScrolling) {
            this.isDragging = false;
            return;
        }

        e.preventDefault();
        this.currentX = touchInfo.currentX;
        const diff = this.currentX - this.startX;
        
        if ((this.currentIndex === 0 && diff > 0) || 
            (this.currentIndex === this.mediaCount - 1 && diff < 0)) {
            return;
        }

        const translateX = -this.currentIndex * 100 + (diff / this.container.offsetWidth) * 100;
        
        
        this.container.style.transform = `translateX(${translateX}%)`;
    }

    handleEnd(e) {
        if (!this.isDragging) return;
        
        const result = this.touchHandler.handleEnd(e);
        
        if (!result.isValid) {
            this.container.style.transform = `translateX(${-this.currentIndex * 100}%)`;
            this.container.style.transition = 'transform 0.3s ease-in-out';
            this.isDragging = false;
            return;
        }
        
        this.container.style.transition = 'transform 0.3s ease-in-out';
                
        const diff = this.currentX - this.startX;
        const threshold = this.container.offsetWidth * 0.15;

        if (Math.abs(diff) > threshold) {
            if (result.direction === 'right' && this.currentIndex > 0) {
                this.currentIndex--;
            } else if (result.direction === 'left' && this.currentIndex < this.mediaCount - 1) {
                this.currentIndex++;
            }
        }
        this.isDragging = false;
        this.updateSlider();
    }

    updateSlider() {
        this.container.style.transform = `translateX(${-this.currentIndex * 100}%)`;
        this.handleMediaTransition();
        this.updateNavigationUI();
    }

    handleMediaTransition() {
        const previousIndex = this._previousIndex || 0;
        
        // 인덱스가 변경되지 않았다면 (미디어 전환이 없었다면) 아무 것도 하지 않음
        if (previousIndex === this.currentIndex) {
            return;
        }

        // 모든 비디오 정지
        this.mediaWrappers.forEach(wrapper => {
            const video = wrapper?.querySelector('video');
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        });
        
        // 현재 미디어가 비디오인 경우 재생
        const currentVideo = this.mediaWrappers[this.currentIndex]?.querySelector('video');
        if (currentVideo) {
            currentVideo.loop = true;
            currentVideo.play();
        };

        // 현재 인덱스 저장
        this._previousIndex = this.currentIndex;
    }

    updateNavigationUI() {
        // PC의 경우, 화살표 버튼 상태 업데이트
        if (!this.isMobile) {
            if (this.prevBtn) {
                this.prevBtn.style.opacity = this.currentIndex === 0 ? '0' : '1';
                this.prevBtn.style.display = this.currentIndex === 0 ? 'none' : 'flex';
            }
            if (this.nextBtn) {
                this.nextBtn.style.opacity = this.currentIndex === this.mediaCount - 1 ? '0' : '1';
                this.nextBtn.style.display = this.currentIndex === this.mediaCount - 1 ? 'none' : 'flex';
            }
        }
        
        // 네비게이션 닷 업데이트
        if (this.dots) {
            this.dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === this.currentIndex);
            });
        }
    }

    cleanup() {
        // document.body의 이벤트 리스너 제거
        document.body.removeEventListener('touchstart', this.handleStart);
        document.body.removeEventListener('touchmove', this.handleMove);
        document.body.removeEventListener('touchend', this.handleEnd);
        // Intersection Observer 해제
        this.observer.disconnect();
    }
}

/**
 * 저장 기능을 관리하는 컴포넌트
 */

class SaveComponent {
    constructor(postElement) {
        this.button = postElement.querySelector('.save');
        if (!this.button) return;

        this.handleSaveClick = this.handleSaveClick.bind(this);
        this.bindEvents();
    }

    bindEvents() {
        this.button.addEventListener('click', this.handleSaveClick);
    }

    handleSaveClick() {
        const [saved, notSaved] = this.button.children;
        saved.classList.toggle("hide");
        notSaved.classList.toggle("hide");
    }

    cleanup() {
        if (this.button) {
            this.button.removeEventListener('click', this.handleSaveClick);
        }
    }
}

// 전역 초기화
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.post').forEach(element => {
        new Post(element);
    });
});

// 좋아요 상태 초기화 함수
window.resetLikedPosts = () => {
    UTILS.storage.remove('likedPosts');
    location.reload();
};

export { Post };