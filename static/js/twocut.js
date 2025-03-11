let currentFrame = null;
let cropper = null;

// 파일 입력 처리
document.querySelectorAll('.upload-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        currentFrame = btn.closest('.photo-frame');
        document.getElementById('fileInput').click();
    });
});

// 파일 선택 시 처리
document.getElementById('fileInput').addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];

        // 파일 크기 검증
        if (file.size > config.UPLOAD_MAX_SIZE.TWOCUT) {
            alert(`파일 크기가 너무 큽니다. ${config.UPLOAD_MAX_SIZE.TWOCUT/1024/1024}MB 이하의 파일을 선택해주세요.`);
            e.target.value = '';
            return;
        }

        // 파일 확장자 검증
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!config.ALLOWED_EXTENSIONS.IMAGE.includes(fileExtension)) {
            alert(`허용되지 않는 파일 형식입니다. ${config.ALLOWED_EXTENSIONS.IMAGE.join(', ')} 파일만 업로드 가능합니다.`);
            e.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/twocut', {
                method: 'POST',
                body: formData
            });

        } catch (error) {
            console.error('Error uploading image:', error);
            alert('이미지 처리 중 오류가 발생했습니다.');
        }

        // 이후 크롭 작업 진행
        const reader = new FileReader();
        reader.onload = (e) => {
            const cropImage = document.getElementById('cropImage');
            cropImage.src = e.target.result;

            const cropModal = document.getElementById('cropModal');
            const bsModal = new bootstrap.Modal(cropModal);
            bsModal.show();

            cropModal.addEventListener('shown.bs.modal', function onModalShown() {
                cropper = new Cropper(cropImage, {
                    aspectRatio: 4/3,
                    viewMode: 1,
                    autoCropArea: 1,
                    dragMode: 'move',
                    minContainerWidth: 320,
                    minContainerHeight: 240,
                });

                cropModal.removeEventListener('shown.bs.modal', onModalShown);
            });
        };
        reader.readAsDataURL(file);
    }
});

// 크롭 완료
document.getElementById('cropDone').addEventListener('click', async () => {
    const croppedCanvas = cropper.getCroppedCanvas();
    const photoImg = currentFrame.querySelector('.photo');
    photoImg.crossOrigin = "anonymous";
    photoImg.src = croppedCanvas.toDataURL();

    // upload-btn 숨기기
    const uploadBtn = currentFrame.querySelector('.upload-btn');
    if (uploadBtn) {
        uploadBtn.style.display = 'none';
    }

    closeCropModal();
});

// 추가: 이미지가 로드되지 않았을 때 upload-btn 다시 표시
document.querySelectorAll('.photo').forEach(photo => {
    photo.addEventListener('error', function() {
        const frame = this.closest('.photo-frame');
        const uploadBtn = frame.querySelector('.upload-btn');
        if (uploadBtn) {
            uploadBtn.style.display = 'block';
        }
    });
});

// 크롭 취소
document.getElementById('cropCancel').addEventListener('click', closeCropModal);

function closeCropModal() {
    const cropModal = bootstrap.Modal.getInstance(document.getElementById('cropModal'));
    cropModal.hide();
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('fileInput').value = '';
}

// 이미지 저장 기능
document.getElementById('saveImage').addEventListener('click', async () => {
    const photoBooth = document.querySelector('.photo-booth');
    const shutterButton = document.getElementById('saveImage');
    
    // 원래 스타일 저장
    const originalStyle = photoBooth.style.cssText;
    
    shutterButton.style.display = 'none';

    try {
        const canvas = await html2canvas(photoBooth, {
            useCORS: true,
            scale: 2, // 해상도 조정
        });

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        const date = new Date().toISOString().slice(0,10);
        link.download = `웨딩두컷_${date}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        // console.error('Error generating image:', error);
    } finally {
        // 원래 스타일 복원
        photoBooth.style.cssText = originalStyle;
        
        const loadingElement = document.querySelector('.loading-spinner');
        if (loadingElement) {
            photoBooth.removeChild(loadingElement);
        }
        shutterButton.style.display = 'flex';
    }
}); 