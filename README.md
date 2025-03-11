# Weddinggram (Instagram Clone Concept Wedding Invitation Web App)

## 💍 Introduction
This project is a **Web-based wedding invitation** inspired by Instagram. It incorporates Instagram-like **'Post'**, **'Story'**, and **'Explore'** features to display posts, galleries, and more. Additionally, it includes a **photo booth function** that allows users to combine their uploaded images with wedding-themed photo frames.

## 🔍 Features
- **Post**: **Instagram-style** 'Post' feature
  - Users can 'like' posts.
- **Gallery**: Posting images or videos using the 'Story' feature
- **Guestbook**: Posting using the 'Direct Message' UI
- **Photo booth**: Users can merge uploaded images with wedding-themed photo frames.

---

## 🛠 Getting Started
This application is implemented using **Firebase**. Before running the project, follow these steps:

### 1. Configure Firebase
- Obtain a **JSON key file** via the **Firebase Admin SDK**.
- Set the correct path for `FIREBASE_KEY_PATH` in `config.toml`.

### 2. Set Up Firestore Collections
The **Cloud Firestore** database must include the following three collections:
- `wedding_guestbook`
- `wedding_post`
- `wedding_story`

### 3. Firestore Document Structures
#### 📝 'Post' Document Example
To upload a **Post**, a document must be created in the **`wedding_post`** collection with the following structure:
```json
{
  "order": 9,
  "name": "john",
  "profile_image": "john.png",
  "post_image": ["sample1.jpg", "sample2.jpg", "sample3.mp4"],
  "text": "This is a sample message.",
  "like": 5,
  "explore": true,  // (Optional) Set true to post in 'Explore' instead of 'Home'
  "is_large": false, // (Optional) Set true to make the post appear larger (1x2 size in 'Explore')
  "thumbnail": "sample1.jpg" // (Optional) Thumbnail for 'Explore' posts
}
```

#### 🌍 'Story' Document Example
To upload **Story media**, create a document in the **`wedding_story`** collection with this structure:
```json
{
  "name": "john",
  "profile_image": "john.png",
  "story_media": ["sample1.jpg", "sample2.jpg", "sample3.mp4"]
}
```

After creating the document, you must insert static files into the following directories:
- `static/media/post/` (for post images and videos)
- `static/media/story/` (for story images and videos)
- `static/media/profile_image/` (for profile pictures)

---

## 🌐 Requirement Libraries
Make sure the following libraries are installed:
```sh
pip install firebase-admin Flask Werkzeug
```
- `firebase-admin`
- `Flask`
- `Werkzeug`

## 🛠 Tech Stack Used
- **Backend:** Python, Flask, Firebase
- **Frontend:** JavaScript, Sass, Bootstrap


## 📜 License
This project is licensed under the MIT License.

**Note:**  
This is an Instagram clone concept. All rights to the original design and branding belong to Instagram.  
However, the source code in this repository is freely available under the MIT License, **as long as proper credit is given**.