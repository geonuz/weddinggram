from datetime import datetime
import firebase_admin
from firebase_admin import firestore, credentials
from logger import logger
import os


class CacheUtils:
    def __init__(self, config):
        self.cache_expiration = config['EXPIRATION']
        self.cache_data = {"WEDDING_POST": {"data": None, "timestamp": None},
                      "WEDDING_STORY": {"data": None, "timestamp": None},
                      "WEDDING_GUESTBOOK": {"data": None, "timestamp": None}}

    def is_cache_valid(self, collection_name):
        """캐시가 유효한지 확인하는 메서드"""
        if collection_name not in self.cache_data:
            return False  # 없는 컬렉션이면 False
    
        cache = self.cache_data[collection_name]
        if cache['data'] is None or cache['timestamp'] is None:
            return False
        
        now = datetime.now()
        if (now - cache['timestamp']).seconds > self.cache_expiration:
            return False
        return True
    
    def get_cache(self, collection_name):
        """캐시된 데이터를 가져오는 메서드"""
        return self.cache_data[collection_name]['data']
    
    def set_cache(self, collection_name, data):
        """캐시를 설정하는 메서드"""
        self.cache_data[collection_name] = {
            'data': data,
            'timestamp': datetime.now()
        }
    
    def invalidate_cache(self, collection_name):
        """캐시를 무효화하는 메서드"""
        self.cache_data[collection_name] = {
            'data': None,
            'timestamp': None
        }
    
    def update_like_in_cache(self, collection_name, post_id, new_like_count):
        """특정 문서의 좋아요 수를 캐시에 업데이트하는 메서드"""
        if collection_name in self.cache_data:
            data_list = self.cache_data[collection_name]['data']
            if data_list:
                # 해당 post_id를 가진 게시물 찾기
                post = next((post for post in data_list if post['id'] == post_id), None)
                if post:
                    post['like'] = new_like_count

class FirebaseUtils:
    def __init__(self, cachestore, key_path):
        try:
            firebase_admin.get_app()
        except ValueError:
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
            firebase_admin.get_app()
        self.cachestore = cachestore
        self.db = firestore.client()

    def get_document_ref(self, collection_name, doc_id=None):
        """
        Firebase 문서 참조를 반환하는 유틸리티
        
        Args:
            collection_name (str): 컬렉션 이름
            doc_id (str, optional): 문서 ID. None이면 새 문서 참조 생성
            
        Returns:
            tuple: (DocumentReference, 에러 메시지 또는 None)
        """
        try:
            collection_ref = self.db.collection(collection_name)
            
            if doc_id:
                return collection_ref.document(doc_id), None
            else:
                return collection_ref.document(), None
                
        except Exception as e:
            logger.error(f"Error getting document reference: {e}")
            return None, f"문서 참조 생성 중 오류 발생: {str(e)}"
    
    def get_collection_count(self, collection_name):
        """컬렉션의 문서 개수를 반환"""
        try:
            # count() 메서드를 사용하여 문서 개수만 조회
            count = self.db.collection(collection_name).count().get()[0][0].value
            return count
        except Exception as e:
            logger.error(f"Error getting collection count: {e}")
            return None

    def get_collection_data(self, collection_name, sort_by=None, ascending=True, ignore_cache=False):
        try:
            # 1. 캐시가 유효한지 확인
            if not ignore_cache and self.cachestore.is_cache_valid(collection_name):
                cached_data = self.cachestore.get_cache(collection_name)
                # 2. Firebase의 현재 문서 개수 확인
                current_count = self.get_collection_count(collection_name)
                cached_count = len(cached_data) if cached_data else 0
                
                # 3. 개수가 같으면 캐시 데이터 사용
                if current_count is not None and current_count == cached_count:
                    logger.info(f"✅ Cache HIT for {collection_name} - Count match ({current_count})")
                    
                    # 캐시된 데이터 정렬
                    if sort_by and cached_data:
                        cached_data.sort(key=lambda x: x.get(sort_by), reverse=not ascending)
                    return cached_data
                else:
                    logger.info(f"⚠️ Cache INVALIDATED for {collection_name} - Count mismatch (cache: {cached_count}, current: {current_count})")
            
            # 4. 캐시가 유효하지 않거나 개수가 다른 경우 전체 데이터 조회
            query = self.db.collection(collection_name)
            
            docs = query.stream()
            doc_list = []
            
            for doc in docs:
                doc_data = doc.to_dict()
                doc_data['id'] = doc.id
                doc_list.append(doc_data)
            
            # 정렬이 요청된 경우
            if sort_by and doc_list:
                doc_list.sort(key=lambda x: x.get(sort_by), reverse=not ascending)
            
            # 캐시 업데이트
            if not ignore_cache:
                self.cachestore.set_cache(collection_name, doc_list)
                logger.info(f"💾 Cached {len(doc_list)} items for {collection_name}")
            
            return doc_list
            
        except Exception as e:
            logger.error(f"❌ Error in get_collection_data: {e}")
            # 에러 발생 시 캐시된 데이터라도 반환
            if self.cachestore.is_cache_valid(collection_name):
                cached_data = self.cachestore.get_cache(collection_name)
                logger.warning(f"⚠️ Returning cached data due to error")
                return cached_data
            return []
        

class FileUtils:
    def __init__(self, config):
        self.upload_paths = config['PATHS']
        self.upload_max_size = config['MAX_SIZE']
        self.allowed_extension = config['ALLOWED_EXTENSIONS']
        self.allowed_type = config['ALLOWED_TYPES']

    def validate_file(self, file, file_type, category):
        """파일 검증"""
        try:
            # 파일 객체 유효성 검사
            if not file or not hasattr(file, 'filename'):
                logger.error("❌ Invalid file object")
                return False, '유효하지 않은 파일입니다.'

            # 파일 스트림 검사
            if not hasattr(file, 'stream') or not file.stream:
                logger.error("❌ File has no valid stream")
                return False, '파일 스트림이 유효하지 않습니다.'
            
            # 파일 크기 검사
            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)
            if size > self.upload_max_size[category]:
                logger.error(f"❌ File size exceeds {self.upload_max_size[category] / 1024}KB: {size} bytes")
                return False, f"파일 크기는 {self.upload_max_size[category] / 1024}KB 이하여야 합니다."
            
            # 파일 형식 검사
            if not '.' in file.filename and \
                file.filename.rsplit('.', 1)[1].lower() in self.allowed_extension[file_type]:
                allowed_extensions = ', '.join(self.allowed_extension[file_type]).upper()
                logger.error(f"❌ File type is not allowed: {file.filename}")
                return False, f'{allowed_extensions} 형식의 파일만 업로드 가능합니다.'
            
            # MIME 타입 검사
            if file.content_type not in self.allowed_type[file_type]:
                logger.error(f"❌ Invalid MIME type: {file.content_type}")
                return False, '지원하지 않는 파일 형식입니다.'

            return True, file
            
        except Exception as e:
            logger.error(f"❌ Error validating file: {e}")
            return False, '파일 검증 중 오류가 발생했습니다.'

    def upload_file(self, file, upload_category):
        """파일 업로드"""
        try:
            # 안전한 파일명 생성
            original_filename = file.filename
            # 파일 확장자 추출
            file_ext = os.path.splitext(original_filename)[1]
            # 현재 시간과 원본 파일명에서 확장자를 제외한 부분으로 새 파일명 생성
            filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.path.splitext(original_filename)[0]}{file_ext}"
            
            # 업로드 폴더 생성
            if not os.path.exists(self.upload_paths[upload_category]):
                os.makedirs(self.upload_paths[upload_category])
            
            # 파일 저장
            file_path = os.path.join(self.upload_paths[upload_category], filename)
            file.save(file_path)
            logger.info(f"✅ Saved file: {filename}\nto: {file_path}")
            
            return True, filename
        
        except Exception as e:
            logger.error(f"❌ Error processing file: {e}")
            return False, '파일 업로드 중 오류가 발생했습니다.'


class MessageUtils:
    def __init__(self, firebase):
        self.firebase = firebase

    def save_message(self, name, comment, password, profile_image='default.jpg'):
        """
        메시지 데이터를 Firebase에 저장
        
        Returns:
            tuple: (성공 여부, 성공 시 메시지 데이터 / 실패 시 에러 메시지)
        """
        try:
            doc_ref, error = self.firebase.get_document_ref('wedding_guestbook')
            if error:
                return False, error
            
            message_data = {
                'id': doc_ref.id,
                'profile_image': profile_image,
                'name': name,
                'comment': comment,
                'password': password,
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            
            doc_ref.set(message_data)
            
            # timestamp는 클라이언트에서 표시할 필요가 없으므로 제거
            message_data.pop('timestamp', None)
            logger.info(f"✅ Saved message to Firebase\nid: {message_data['id']}\nname: {message_data['name']} \ncomment: {message_data['comment']}")
            return True, message_data
            
        except Exception as e:
            logger.error(f"❌ Error saving message to Firebase: {e}")
            return False, '메시지 저장 중 오류가 발생했습니다.'
    
    def delete_message(self, message_id, password):
        """
        메시지 삭제
        
        Args:
            message_id (str): 삭제할 메시지 ID
            password (str): 메시지 비밀번호
            
        Returns:
            tuple: (성공 여부, 에러 메시지 또는 None)
        """
        try:
            doc_ref, error = self.firebase.get_document_ref('wedding_guestbook', message_id)
            if error:
                return False, error
                
            doc = doc_ref.get()
            if not doc.exists:
                return False, '메시지를 찾을 수 없습니다.'
                
            message_data = doc.to_dict()
            
            # 비밀번호 확인
            if message_data.get('password') != password:
                return False, '비밀번호가 일치하지 않습니다.'
                
            # 메시지 삭제
            doc_ref.delete()
            logger.info(f"🗑️ Deleted message from Firebase\nid: {message_data['id']}\nname: {message_data['name']} \ncomment: {message_data['comment']}")
            return True, None
            
        except Exception as e:
            logger.error(f"❌ Error deleting message: {e}")
            return False, f'메시지 삭제 중 오류가 발생했습니다: {str(e)}'


class PostUtils:
    def __init__(self, firebase):
        self.firebase = firebase

    def update_like_count(self, post_id, is_adding):
        """
        게시물 좋아요 수 업데이트
        
        Args:
            post_id (str): 게시물 ID
            is_adding (bool): True면 증가, False면 감소
            
        Returns:
            tuple: (성공 여부, 좋아요 수 또는 에러 메시지)
        """
        try:
            doc_ref, error = self.firebase.get_document_ref('wedding_post', post_id)
            if error:
                return False, error
                
            doc = doc_ref.get()
            if not doc.exists:
                return False, '게시물을 찾을 수 없습니다.'
            
            current_likes = doc.to_dict().get('like', 0)
            new_likes = max(0, current_likes + (1 if is_adding else -1))
            
            doc_ref.update({
                'like': new_likes
            })
            
            logger.info(f"✅ Updated like count for post {post_id}: {new_likes}")
            return True, new_likes
            
        except Exception as e:
            logger.error(f"❌ Error updating like count: {e}")
            return False, str(e)