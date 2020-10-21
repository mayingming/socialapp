const functions = require("firebase-functions");
const express = require("express");
const app = express();

const { db } = require("./util/admin");

const {
  getAllPosts,
  postOnePost,
  getPost,
  commentOnPost,
  likePost,
  unlikePost,
  deletePost,
} = require("./handlers/posts");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead,
} = require("./handlers/users");

const FBAuth = require("./util/fbAuth");

//Post routes
app.get("/posts", getAllPosts);
app.post("/post", FBAuth, postOnePost);
app.get("/post/:postId", getPost);
app.post("/post/:postId/comment", FBAuth, commentOnPost);
app.get("/post/:postId/like", FBAuth, likePost);
app.get("/post/:postId/unlike", FBAuth, unlikePost);
app.delete("/post/:postId", FBAuth, deletePost);

//Users routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

exports.api = functions.region("australia-southeast1").https.onRequest(app);

exports.createNotificationOnLike = functions
  .region("australia-southeast1")
  .firestore.document(`likes/{id}`)
  .onCreate((snapshot) => {
    return db
      .doc(`/posts/${snapshot.data().postId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userhandle !== snapshot.data().userhandle
        ) {
          return db.doc(`notifications/${snapshot.id}`).set({
            createAt: new Date().toISOString(),
            recipient: doc.data().userhandle,
            sender: snapshot.data().userhandle,
            postId: doc.id,
            type: "like",
            read: false,
          });
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });

exports.createNotificationOnComment = functions
  .region("australia-southeast1")
  .firestore.document(`comments/{id}`)
  .onCreate((snapshot) => {
    return db
      .doc(`/posts/${snapshot.data().postId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userhandle !== snapshot.data().userhandle
        ) {
          return db.doc(`notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userhandle,
            sender: snapshot.data().userhandle,
            postId: doc.id,
            type: "comment",
            read: false,
          });
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });

exports.deleteNotificationOnUnlike = functions
  .region("australia-southeast1")
  .firestore.document(`likes/{id}`)
  .onDelete((snapshot) => {
    return db
      .doc(`notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
      });
  });

exports.onUserImageChange = functions
  .region("australia-southeast1")
  .firestore.document(`/users/{userID}`)
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("Image has changed");
      let batch = db.batch();
      return db
        .collection("posts")
        .where("userhandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const post = db.doc(`/posts/${doc.id}`);
            batch.update(post, { userImage: change.after.data().imageUrl });
          });
          return batch.commit;
        });
    } else {
      return true;
    }
  });

exports.onPostDelete = functions
  .region("australia-southeast1")
  .firestore.document(`/posts/{postId}`)
  .onDelete((snapshot, context) => {
    const postId = context.params.postId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("postId", "==", postId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("postId", "==", postId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("postId", "==", postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => {
        console.error(err);
      });
  });
