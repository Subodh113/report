EHS Cleaning App — Firebase-ready (project folder: ehs-cleaning-ifm)

Steps:
1. Create a Firebase project and enable Authentication (Email/Password), Firestore and Storage.
2. In Firebase Console -> Authentication -> create a user with email: admin@ifm.com (password of your choice).
3. Create a web app in Firebase Project Settings and copy the config.
4. Open scripts/firebase-config.js and replace placeholders with your Firebase config.
5. Deploy these files to GitHub Pages (main branch, root).
6. Supervisors can Sign Up or you can create them under Authentication.

Notes:
- Images are compressed client-side to target <300 KB using browser-image-compression.
- Activities collection in Firestore controls the dropdown list (Admin can add/delete).
- Submissions are stored in Firestore collection 'submissions' and photos in Storage under submissions/<date>/<id>/img_#.jpg

Generated on 2025-10-16T17:18:38.968410.
