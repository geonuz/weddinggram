import { Post } from './post.js';  // Post 클래스 import 추가

/**
 * ExploreGrid 클래스: 탐색 페이지의 게시물 그리드를 관리
 */
class ExploreGrid {
    /**
     * @param {HTMLElement} container - 탐색 컨테이너 요소
     * @param {Array} posts - 게시물 데이터 배열
     */
    constructor(container, posts) {
        this.container = container;
        this.posts = posts;
        this.modal = new ExploreModal();
        
        this.initialize();
    }

    initialize() {
        if (!this.container || !this.posts?.length) {
            return;
        }
        
        const fragment = document.createDocumentFragment();
        this.posts.forEach((post, index) => {
            const item = this.createExploreItem(post);
            fragment.appendChild(item);
        });
        
        this.container.appendChild(fragment);
    }

    /**
     * 탐색 아이템 요소 생성
     */
    createExploreItem(post) {
        const item = document.createElement('div');
        item.classList.add('grid_item');
        if (post.is_large) {
            item.classList.add('large');
        }
        
        const isVideo = config.VIDEO_EXTENSIONS.some(ext => 
            post.thumbnail.toLowerCase().endsWith(ext)
        );
        
        if (isVideo) {
            item.innerHTML = `
                <video class="img-fluid" 
                    src="${config.STATIC_PATHS.POST}${post.thumbnail}"
                    muted
                    loop
                    playsinline
                    autoplay>
                </video>
            `;

            // 비디오 요소 가져오기
            const video = item.querySelector('video');
            
            video.defaultMuted = true;
            video.muted = true;
            
            // Intersection Observer를 사용하여 뷰포트에 들어올 때 재생
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const video = entry.target;
                    if (entry.isIntersecting) {
                        if (video.readyState >= 2) {
                            Promise.resolve(video.play())
                                .catch(error => {
                                    console.log('비디오 재생 실패:', error);
                                    video.controls = false;
                                });
                        } else {
                            video.addEventListener('loadeddata', function onLoadedData() {
                                Promise.resolve(video.play())
                                    .catch(error => {
                                        console.log('비디오 재생 실패:', error);
                                        video.controls = false;
                                    });
                                video.removeEventListener('loadeddata', onLoadedData);
                            });
                        }
                    } else {
                        video.pause();
                    }
                });
            }, { 
                threshold: 0.5,
                rootMargin: '50px'
            });
            
            observer.observe(video);
            
        } else {
            item.innerHTML = `
                <img class="img-fluid" 
                     src="${config.STATIC_PATHS.POST}${post.thumbnail}" 
                     loading="lazy" 
                     alt="${post.name}'s post">
            `;
        }
        
        item.addEventListener('click', () => this.modal.show(post));
        return item;
    }
}

/**
 * ExploreModal 클래스: 탐색 페이지의 모달을 관리
 */
class ExploreModal {
    constructor() {
        this.initializeElements();
        this.initializeModal();
        this.initializeResponsive();
        this.currentPost = null; // 현재 활성화된 Post 인스턴스 추적
    }

    initializeElements() {
        this.element = document.getElementById('exploreModal');
        this.elements = {
            profileImg: $('#modalProfileImg'),
            profileName: $('#modalProfileName'),
            postMedia: $('#modalPostMedia'),
            likeCount: $('#modalLikeCount'),
            postDescName: $('#modalPostDescName'),
            postDesc: $('#modalPostDesc')
        };
    }

    /**
     * Bootstrap 모달 초기화 및 이벤트 바인딩
     */
    initializeModal() {
        // Bootstrap 모달 인스턴스 생성
        this.modalInstance = new bootstrap.Modal(this.element);

        // 모달이 열릴 때
        this.element.addEventListener('shown.bs.modal', () => {
            const postElement = this.element.querySelector('.post');
            if (postElement && postElement.dataset.postId) {
                // 새로운 Post 인스턴스 생성
                this.currentPost = new Post(postElement);
                postElement.dataset.postInitialized = true;
            }
        });

        // 모달이 닫힐 때
        this.element.addEventListener('hidden.bs.modal', () => {
            // 모든 비디오 요소를 찾아서 정지 및 초기화
            const videos = this.element.querySelectorAll('video');
            videos.forEach(video => {
                video.pause(); // 비디오 정지
                video.removeAttribute('src'); // src 속성 제거
                video.load(); // 비디오 리소스 해제
                video.remove(); // 비디오 요소 제거
            });

            if (this.currentPost) {
                this.currentPost.cleanup(); // Post 인스턴스 정리
            }
        });
    }

    /**
     * 반응형 모달 처리 초기화
     */
    initializeResponsive() {
        const modalDialog = this.element.querySelector('.modal-dialog');
        if (!modalDialog) return;
        
        const updateModalClass = () => {
            modalDialog.classList.toggle('modal-fullscreen', window.innerWidth < 768);
        };
        
        updateModalClass();
        window.addEventListener('resize', updateModalClass);
    }

    /**
     * 모달 표시 및 데이터 업데이트
     * @param {Object} data - 게시물 데이터
     */
    show(data) {
        if (!data.id) {
            console.error('Post data missing ID:', data);
            return;
        }

        // 컨텐츠 업데이트
        this.updateModalContent(data);
        
        // 모달 표시
        this.modalInstance.show();
    }

    /**
     * 모달 내용 업데이트
     * @param {Object} data - 게시물 데이터
     */
    updateModalContent(data) {
        // 기본 정보 업데이트
        this.elements.profileImg.attr('src', `${config.STATIC_PATHS.PROFILE}${data.profile_image}`);
        this.elements.profileName.text(data.name);
        this.elements.likeCount.text(data.like);
        this.elements.postDescName.text(data.name);

        // postDescName의 부모 p 태그에 HTML로 설정
        const postDescParent = this.elements.postDescName.parent();
        postDescParent.empty(); // 기존 내용을 초기화
        postDescParent.append(this.elements.postDescName); // postDescName 추가
        postDescParent.append(data.text.replace(/\\n/g, '<br>')); // 변환된 텍스트 추가

        $('.not_loved', this.element).removeClass('hide');
        $('.loved', this.element).removeClass('display');

        // post 요소에 data-post-id 설정
        const postElement = this.element.querySelector('.post');
        if (postElement) postElement.dataset.postId = data.id;
        this.updateMediaContent(data.post_image);
    }

    /**
     * 미디어 컨텐츠 업데이트
     * @param {Array} mediaFiles - 미디어 파일 배열
     */
    updateMediaContent(mediaFiles) {
        const sliderWrapper = this.element.querySelector('.slider_wrapper');
        const slider = sliderWrapper.querySelector('.slider');
        const mediaWrapper = slider.querySelector('.media_wrapper');
        
        mediaWrapper.innerHTML = '';

        // 미디어 추가
        mediaFiles.forEach(media => {
            const mediaDiv = document.createElement('div');
            mediaDiv.className = 'media';
            
            if (config.VIDEO_EXTENSIONS.some(ext => media.toLowerCase().endsWith(ext))) {
                mediaDiv.innerHTML = `
                    <video playsinline>
                        <source src="${config.STATIC_PATHS.POST}${media}" 
                                type="video/${media.split('.').pop()}">
                        브라우저가 비디오를 지원하지 않습니다.
                    </video>
                `;
            } else {
                mediaDiv.innerHTML = `
                    <img src="${config.STATIC_PATHS.POST}${media}" 
                         alt="${this.elements.profileName.text()}'s media">
                `;
            }
            mediaWrapper.appendChild(mediaDiv);
        });

        this.updateNavigationElements(mediaFiles.length, sliderWrapper, slider);
    }

    /**
     * 네비게이션 요소 업데이트
     * @param {number} mediaCount - 미디어 파일 개수
     * @param {HTMLElement} sliderWrapper - 슬라이더 래퍼 요소
     * @param {HTMLElement} slider - 슬라이더 요소
     */
    updateNavigationElements(mediaCount, sliderWrapper, slider) {
        // 기존 화살표와 네비게이션 제거
        slider.querySelectorAll('.slider-arrow').forEach(arrow => arrow.remove());
        const existingNav = sliderWrapper.querySelector('.slider-nav');
        if (existingNav) existingNav.remove();

        // 여러 미디어가 있는 경우에만 화살표와 네비게이션 추가
        if (mediaCount <= 1) return;

        // 화살표 추가
        slider.insertAdjacentHTML('beforeend', `
            <button class="slider-arrow prev">
                <svg aria-label="이전" fill="white" height="16" role="img" viewBox="0 0 24 24" width="16">
                    <polyline fill="none" points="16.502 3 7.498 12 16.502 21" stroke="currentColor" 
                             stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polyline>
                </svg>
            </button>
            <button class="slider-arrow next">
                <svg aria-label="다음" fill="white" height="16" role="img" viewBox="0 0 24 24" width="16">
                    <polyline fill="none" points="8 3 17.004 12 8 21" stroke="currentColor" 
                             stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polyline>
                </svg>
            </button>
        `);

        // 네비게이션 닷 추가
        const navDots = document.createElement('div');
        navDots.className = 'slider-nav';
        navDots.innerHTML = Array.from({ length: mediaCount }, (_, i) => 
            `<div class="nav-dot${i === 0 ? ' active' : ''}"></div>`
        ).join('');
        sliderWrapper.appendChild(navDots);
    }
}

// 페이지 초기화를 즉시 실행 함수로 경
(() => {
    // explores 변수가 전역 스코프에 정의되어 있는지 확인
    if (typeof explores !== 'undefined') {
        const container = document.querySelector('.explore_grid');
        if (container) {
            new ExploreGrid(container, explores);
        }
    }
}
)();

export { ExploreGrid, ExploreModal };