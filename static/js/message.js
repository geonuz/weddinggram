/* 메시지 관리 메인 클래스 */
class MessageManager {
    constructor() {
        this.deleteManager = new DeleteManager();
        this.modal = new MessageModal(this.deleteManager);
        this.messageList = new MessageList();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.querySelectorAll('.new_message_btn').forEach(icon => {
            icon.addEventListener('click', () => this.modal.show());
        });
    }
}


/* 메시지 목록 관리 클래스 */
class MessageList {
    constructor() {
        this.container = document.querySelector('.message_container');
    }

    static createMessageElement(messageData) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.dataset.messageId = messageData.id;
        
        messageElement.innerHTML = `
            <div class="left">
                <div class="message_profile">
                    <img src="/static/media/profile_image/${messageData.profile_image}" alt="프로필 이미지">
                </div>
                <div class="message_info">
                    <p class="name">${messageData.name}</p>
                    <p class="p_message">${messageData.comment}</p>
                </div>
            </div>
            <button type="button" class="btn btn-link delete-message p-0" style="color: #dc3545;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"></path>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"></path>
                </svg>
            </button>
        `;

        return messageElement;
    }

    static addNewMessage(messageData, deleteManager) {
        const messageList = document.querySelector('.message_container');
        const newMessage = this.createMessageElement(messageData);
        
        newMessage.style.opacity = '0';
        newMessage.style.transform = 'translateY(20px)';
        messageList.appendChild(newMessage);
        
        setTimeout(() => {
            newMessage.style.transition = 'all 0.3s ease';
            newMessage.style.opacity = '1';
            newMessage.style.transform = 'translateY(0)';
        }, 10);
        
        newMessage.scrollIntoView({ behavior: 'smooth' });
        deleteManager.attachDeleteListeners();
    }
}

/**
 * 메시지 작성 모달 관리 클래스
 */
class MessageModal {
    constructor(deleteManager) {
        this.deleteManager = deleteManager;
        this.modalElement = document.getElementById('messageModal');
        this.modal = new bootstrap.Modal(this.modalElement);
        this.modalDialog = this.modalElement.querySelector('.modal-dialog');
        this.form = this.modalElement.querySelector('form');
        this.imageInput = document.getElementById('profile-image');
        this.previewImage = document.getElementById('preview');
        
        this.initializeEventListeners();
        this.updateModalClass();
    }

    show() {
        this.modal.show();
    }

    hide() {
        this.modal.hide();
    }

    updateModalClass() {
        if (window.innerWidth < 768) {
            this.modalDialog.classList.add('modal-fullscreen');
        } else {
            this.modalDialog.classList.remove('modal-fullscreen');
        }
    }

    validateImage(file) {
        if (file.size > config.UPLOAD_MAX_SIZE.PROFILE) {
            alert(`파일 크기는 ${config.UPLOAD_MAX_SIZE.PROFILE / 1024 / 1024}MB 이하여야 합니다.`);
            return false;
        }

        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!config.ALLOWED_EXTENSIONS.IMAGE.includes(fileExtension)) {
            alert(`허용되지 않는 파일 형식입니다. ${config.ALLOWED_EXTENSIONS.IMAGE.join(', ')} 파일만 업로드 가능합니다.`);
            e.target.value = '';
            return false;
        }

        return true;
    }

    initializeEventListeners() {
        window.addEventListener('resize', () => this.updateModalClass());

        this.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!this.validateImage(file)) {
                this.imageInput.value = '';
                this.previewImage.src = '/static/media/profile_image/default.jpg';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => this.previewImage.src = e.target.result;
            reader.readAsDataURL(file);
        });

        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(e);
        });
    }

    async handleSubmit(e) {
        try {
            const formData = new FormData(this.form);
            const response = await fetch('/api/messages', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                this.hide();
                MessageList.addNewMessage(result.message, this.deleteManager);
                this.resetForm();
            } else {
                alert(result.error || '메시지 저장 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('메시지 저장 중 오류가 발생했습니다.');
        }
    }

    resetForm() {
        this.form.reset();
        this.previewImage.src = '/static/media/profile_image/default.jpg';
    }
}

/**
 * 메시지 삭제 관리 클래스
 */
class DeleteManager {
    constructor() {
        this.modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        this.currentMessageId = null;
        this.initializeEventListeners();
        this.attachDeleteListeners();
    }

    attachDeleteListeners() {
        document.querySelectorAll('.delete-message').forEach(button => {
            button.addEventListener('click', () => {
                this.currentMessageId = button.closest('.message').dataset.messageId;
                this.modal.show();
            });
        });
    }

    initializeEventListeners() {
        document.getElementById('confirm-delete').addEventListener('click', () => this.handleDelete());
        document.getElementById('deleteModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('delete-password').value = '';
        });
    }

    async handleDelete() {
        const password = document.getElementById('delete-password').value;
        
        try {
            const response = await fetch(`/api/messages/${this.currentMessageId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (result.success) {
                this.modal.hide();
                this.removeMessageElement();
            } else {
                alert('비밀번호가 일치하지 않습니다.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('메시지 삭제 중 오류가 발생했습니다.');
        }
    }

    removeMessageElement() {
        const messageElement = document.querySelector(`.message[data-message-id="${this.currentMessageId}"]`);
        if (messageElement) {
            messageElement.style.transition = 'all 0.3s ease';
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateX(-20px)';
            
            setTimeout(() => messageElement.remove(), 300);
        }
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new MessageManager();
});