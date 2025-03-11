from flask import Flask, render_template, request, jsonify, has_request_context
from firebase_admin import firestore
from utils import FirebaseUtils, MessageUtils, PostUtils, CacheUtils, FileUtils
from dotenv import load_dotenv
from pathlib import Path
from logger import logger
import os, toml, shutil

load_dotenv()  # .env 파일에서 환경 변수 로드

# 설정 파일 로드
config_file = 'config.toml'
config_path = Path(Path.cwd()) / config_file

with open(config_path, 'r') as f:
    config = toml.load(f)

# Flask 앱 초기화
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24))

# 각 모듈 초기화
CacheStore = CacheUtils(config['CACHE'])
Firebase = FirebaseUtils(CacheStore, config['GLOBAL']['FIREBASE_KEY_PATH'])
FileHandler = FileUtils(config['UPLOAD'])
GuestBook = MessageUtils(Firebase)
PostManger = PostUtils(Firebase)

@app.route('/')
def wedding_home():
    try:
        home_data = [post for post in Firebase.get_collection_data('wedding_post') if not post.get('explore')]
        story_data = Firebase.get_collection_data('wedding_story')

        return render_template('home.html', posts=home_data, stories=story_data)
    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return f"Error: {str(e)}", 500

@app.route('/explore')
def wedding_explore():
    try:
        explore_data = Firebase.get_collection_data('wedding_post')
        explore_data = sorted(
            (post for post in explore_data if post.get('explore')),
            key=lambda post: post.get('order', float('inf'))
        )
        client_config = {
            'STATIC_PATHS': config['STATIC']['PATHS'],
            'VIDEO_EXTENSIONS': config['STATIC']['ALLOWED_EXTENSIONS']['VIDEO'],
        }
        return render_template('explore.html', explores=explore_data, config=client_config)
    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return f"Error: {str(e)}", 500

@app.route('/twocut')
def wedding_twocut():
    try:
        client_config = {
            'ALLOWED_EXTENSIONS': config['STATIC']['ALLOWED_EXTENSIONS'],
            'UPLOAD_MAX_SIZE': config['UPLOAD']['MAX_SIZE'],
        }
        return render_template('twocut.html', config=client_config)
    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return f"Error: {str(e)}", 500

@app.route('/messages')
def wedding_messages():
    try:
        # timestamp 필드를 기준으로 오름차순 정렬 (오래된 순)
        messages_list = Firebase.get_collection_data(
            'wedding_guestbook', 
            sort_by='timestamp', 
            ascending=True
        )

        client_config = {
            'ALLOWED_EXTENSIONS': config['STATIC']['ALLOWED_EXTENSIONS'],
            'UPLOAD_MAX_SIZE': config['UPLOAD']['MAX_SIZE'],
        }
        return render_template('messages.html', messages=messages_list, config=client_config)
    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return f"Error: {str(e)}", 500


@app.route('/like/<post_id>', methods=['POST'])
def update_like(post_id):
    try:
        # action 파라미터로 증가/감소 결정
        data = request.get_json()
        is_adding = data.get('action') == 'add'
        
        success, result = PostManger.update_like_count(post_id, is_adding)

        if success:
            # 특정 문서의 캐시 업데이트
            CacheStore.update_like_in_cache('wedding_post', post_id, result)
            return jsonify({
                'success': True,
                'likes': result
            })
        else:
            return jsonify({
                'success': False,
                'error': result
            }), 404 if result == '게시물을 찾을 수 없습니다.' else 500
        
    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/messages', methods=['POST'])
def save_message():
    try:
        # 프로필 사진 유효성 검사 
        profile_image = request.files.get('profile_image')
        if not profile_image or not profile_image.filename:
            filename = 'default.jpg'
        else:
            success, result = FileHandler.validate_file(profile_image, 'IMAGE', 'PROFILE')

            if success:
                # 프로필 사진을 uploads 폴더에 저장
                success, result = FileHandler.upload_file(profile_image, 'PROFILE')
                
                if success:
                    filename = result
                    # static 폴더에 파일 복사
                    source_path = os.path.join(config['UPLOAD']['PATHS']['PROFILE'], filename)
                    dest_path = os.path.join(config['STATIC']['PATHS']['PROFILE'], filename)
                    
                    # 목적지 디렉토리가 없으면 생성
                    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                    
                    # 파일 복사
                    shutil.copy2(source_path, dest_path)
            else:
                return jsonify({
                    'success': False,
                    'error': result
                })
        
        # 메시지 저장
        success, message_data = GuestBook.save_message(
            name=request.form['name'],
            comment=request.form['comment'],
            password=request.form['password'],
            profile_image=filename
        )
        
        return jsonify({
            'success': True,
            'message': message_data
        })
        
    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return jsonify({
            'success': False,
            'error': '처리 중 오류가 발생했습니다.'
        })


@app.route('/api/messages/<message_id>', methods=['DELETE'])
def delete_message(message_id):
    try:
        password = request.json.get('password')
        success, error = GuestBook.delete_message(message_id, password)
        
        if success:
            return jsonify({'success': True})
        else:
            status_code = {
                '메시지를 찾을 수 없습니다.': 404,
                '비밀번호가 일치하지 않습니다.': 403
            }.get(error, 500)
            
            return jsonify({
                'success': False,
                'error': error
            }), status_code
            
    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/twocut', methods=['POST'])
def upload_twocut_source():
    try:
        # 웨딩두컷 업로드 사진 유효성 검사
        twocut_image = request.files.get('file')

        success, result = FileHandler.validate_file(
            twocut_image, 
            'IMAGE',
            'TWOCUT'
        )

        if success: 
            # 웨딩두컷 업로드 사진 업로드
            success, result = FileHandler.upload_file(twocut_image, 'TWOCUT')

        else:
            return jsonify({
                'success': False,
                'error': result
            })

        return jsonify({
            'success': True,
        }), 200

    except Exception as e:
        logger.error(f"❌ Error fetching request: {e}")
        return jsonify({
            'success': False,
            'error': '처리 중 오류가 발생했습니다.'
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=config['GLOBAL']['DEBUG'])
