const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * 10분마다 실행되어 삭제 시간이 지난 파일을 파기합니다.
 */
exports.scheduledFileCleanup = functions.pubsub
  .schedule('every 10 minutes')
  .onRun(async (context) => {
    const db = admin.firestore();
    const storage = admin.storage().bucket();
    const now = admin.firestore.Timestamp.now();

    // 1. 시간이 지났고 아직 삭제 안 된 문서 찾기
    const snapshot = await db.collection('knowledge_library')
      .where('fileDeletedAt', '<=', now)
      .where('isSourceDeleted', '==', false)
      .get();

    if (snapshot.empty) return null;

    const promises = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const filePath = `raw_files/${data.userId}/${data.fileName}`;

      try {
        // 2. Storage에서 실제 파일 삭제
        await storage.file(filePath).delete();
        
        // 3. Firestore 상태 업데이트 (결과 텍스트는 보존)
        await doc.ref.update({ isSourceDeleted: true });
        console.log(`파기 완료: ${data.title}`);
      } catch (err) {
        console.error(`파기 실패 (${data.title}):`, err);
      }
    });

    return Promise.all(promises);
  });