// DOM이 완전히 로드된 후에 실행
$(document).ready(function() {
    const story_container = document.querySelector('.owl-carousel.items');
    
    if (story_container) {
        initializeCarousel(story_container); // 캐러셀 초기화
        // stories 데이터는 Jinja2 템플릿을 통해 전달됨
        if (typeof stories !== 'undefined') {
            addStoryItems(story_container, stories); // 스토리 아이템 추가
            setupStoryClickHandler(story_container, stories); // 스토리 클릭 핸들러 설정
        }
    }
});

// 캐러셀 초기화 함수
function initializeCarousel(container) {
    $(container).css('opacity', '0'); // 초기에는 캐러셀을 숨김
    setTimeout(() => {
        $(".owl-carousel").owlCarousel({
            loop: false,
            margin: 20,
            autoWidth: true,
            responsiveClass: true,
            responsive: {
                0: { items: 5, nav: false },
                500: { items: 7, nav: false }
            },
            onInitialized: function() {
                $(container).css('opacity', '1'); // 초기화 후 캐러셀 표시
                $(window).trigger('resize'); // 강제로 resize 이벤트 트리거
            }
        });
    }, 5);
}

// 스토리 아이템 추가 함수
function addStoryItems(container, stories) {
    const gradientSvg = `
        <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
            <circle r="31" cy="32" cx="32"></circle>
            <defs>
                <linearGradient y2="0" x2="1" y1="1" x1="0" id="--story-gradient">
                    <stop offset="0" stop-color="#f09433"></stop>
                    <stop offset="0.25" stop-color="#e6683c"></stop>
                    <stop offset="0.5" stop-color="#dc2743"></stop>
                    <stop offset="0.75" stop-color="#cc2366"></stop>
                    <stop offset="1" stop-color="#bc1888"></stop>
                </linearGradient>
            </defs>
        </svg>`;

    // 각 프로필에 대해 스토리 아이템 생성
    const storyItems = stories.map((story, index) => {
        const storyItem = document.createElement('button');
        storyItem.className = 'item_s';
        storyItem.dataset.index = index;
        storyItem.innerHTML = `
            <div class="story_avatar">
                <div class="story__border">${gradientSvg}</div> 
                <img class="story_picture" src="/static/media/profile_image/${story.profile_image}">
            </div>
            <span class="story_name">${story.name}</span>
        `;
        return storyItem;
    });

    container.append(...storyItems);
}

// 스토리 클릭 핸들러 설정 함수
function setupStoryClickHandler(container, stories) {
    let progressInterval;
    const STORY_DURATION = 5000; // 5초

    $(container).on('click', '.item_s', function() {
        const index = $(this).data('index');
        const story = stories[index];
        const mediaList = story.story_media;
        let currentMediaIndex = 0;

        const storyContent = $('#storyContent');
        const storyModal = new bootstrap.Modal(document.getElementById('storyModal'));

        // 진행 바 추가
        const storyAvatarContainer = document.getElementById('storyAvatarContainer');
        storyAvatarContainer.innerHTML = `
            <div class="progress-container">
                ${mediaList.map(() => `
                    <div class="progress-bar">
                        <div class="progress"></div>
                    </div>
                `).join('')}
            </div>
            <div class="story_avatar">
                <img class="story_picture" src="/static/media/profile_image/${story.profile_image}">
                <span class="story_name">${story.name}</span>
            </div>
        `;

        // 미디어 표시 함수
        function showMedia(index) {
            // 이전 타이머 초기화
            clearInterval(progressInterval);
            
            // 모든 프로그레스 바 초기화
            const progressBars = document.querySelectorAll('.progress');
            progressBars.forEach((bar, i) => {
                if (i < index) {
                    bar.style.width = '100%';
                } else if (i > index) {
                    bar.style.width = '0%';
                }
            });

            storyContent.empty();
            const media = mediaList[index];
            const currentProgress = progressBars[index];
            
            // 현재 미디어 표시
            if (media.endsWith('.mp4')) {
                storyContent.append(`<video playsinline class="img-fluid" style="pointer-events: none;">
                    <source src="/static/media/story/${media}" type="video/mp4">
                </video>`);
                
                const video = storyContent.find('video')[0];
                video.play().catch(e => console.log('재생 실패:', e));

                video.onloadedmetadata = function() {
                    // 비디오의 길이(밀리초 단위)로 진행 바 설정
                    startProgress(currentProgress, video.duration * 1000);
                };
            } else {
                storyContent.append(`<img src="/static/media/story/${media}" class="img-fluid">`);
                startProgress(currentProgress, STORY_DURATION);
            }
        }

        // 진행 바 애니메이션 시작
        function startProgress(progressBar, duration) {
            let startTime = Date.now();
            progressBar.style.width = '0%';

            progressInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = (elapsed / duration) * 100;
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    if (currentMediaIndex < mediaList.length - 1) {
                        currentMediaIndex++;
                        showMedia(currentMediaIndex);
                    } else {
                        storyModal.hide();
                    }
                } else {
                    progressBar.style.width = `${progress}%`;
                }
            }, 10);
        }

        showMedia(currentMediaIndex);
        storyModal.show();

        // 클릭 이벤트 핸들러
        $('#storyModal').off('click').on('click', function(e) {
            e.stopPropagation();
            const modalWidth = $(this).width();
            const clickX = e.pageX - $(this).offset().left;

            clearInterval(progressInterval); // 현재 진행 중인 타이머 중지

            if (clickX > modalWidth / 2) {
                if (currentMediaIndex < mediaList.length - 1) {
                    currentMediaIndex++;
                    showMedia(currentMediaIndex);
                } else {
                    storyModal.hide();
                }
            } else {
                if (currentMediaIndex > 0) {
                    currentMediaIndex--;
                    showMedia(currentMediaIndex);
                }
            }
        });

        // 모달 닫힐 때 정리
        $('#storyModal').on('hide.bs.modal', function() {
            clearInterval(progressInterval);
            const video = storyContent.find('video')[0];
            if (video) {
                video.pause();
            }
        });
    });
}