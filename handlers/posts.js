const { request, response } = require("express");
const { db } = require("../util/admin");

exports.getAllPosts = (request, response) => {
  db.collection("posts")
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let posts = [];
      data.forEach((doc) => {
        posts.push({
          postId: doc.id,
          ...doc.data(),
          // body: doc.data().body,
          // userhandle: doc.data().userhandle,
          // createAt: doc.data().createAt,
        });
      });
      return response.json(posts);
    })
    .catch((err) => {
      console.error(err);
    });
};

exports.postOnePost = (request, response) => {
  if (request.body.body.trim() === "") {
    return response.status(400).json({ body: "Body must not be empty." });
  }
  const newPost = {
    body: request.body.body,
    userhandle: request.user.handle,
    createdAt: new Date().toISOString(),
    userImage: request.user.imageUrl,
    likeCount: 0,
    commentCount: 0,
  };
  db.collection("posts")
    .add(newPost)
    .then((doc) => {
      const resPost = newPost;
      resPost.postId = doc.id;
      response.json(resPost);
    })
    .catch((err) => {
      response.status(500).json({ error: "Something Wrong!" });
      console.error(err);
    });
};

exports.getPost = (request, response) => {
  let postData = {};
  db.doc(`/posts/${request.params.postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return response.status(404).json({ error: "Post not found" });
      }
      postData = doc.data();
      postData.postId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("postId", "==", request.params.postId)
        .get();
    })
    .then((data) => {
      postData.comments = [];
      data.forEach((doc) => {
        postData.comments.push(doc.data());
      });
      return response.json(postData);
    })
    .catch((err) => {
      console.error(err);
      return response.status(500).json({ error: err.code });
    });
};

//Comment on a Post
exports.commentOnPost = (request, response) => {
  if (request.body.body.trim() === "") {
    return response.status(400).json({ comment: "Must not be empty." });
  }
  const newComment = {
    body: request.body.body,
    userhandle: request.user.handle,
    createdAt: new Date().toISOString(),
    postId: request.params.postId,
    userImage: request.user.imageUrl,
  };

  db.doc(`/posts/${request.params.postId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return response.status(404).json({ error: "Post not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then((doc) => {
      response.json(newComment);
    })
    .catch((err) => {
      response.status(500).json({ error: "Something Wrong!" });
      console.error(err);
    });
};

//Like a post
exports.likePost = (request, response) => {
  const likeDoc = db
    .collection("likes")
    .where("postId", "==", request.params.postId)
    .where("userhandle", "==", request.user.handle)
    .limit(1);

  const postDoc = db.doc(`/posts/${request.params.postId}`);

  let postdata = {};
  postDoc
    .get()
    .then((doc) => {
      if (doc.exists) {
        postdata = doc.data();
        postdata.postId = doc.id;
        return likeDoc.get();
      } else {
        return response.status(404).json({ error: "Post not found" });
      }
    })
    .then((data) => {
      console.log(data);
      if (data.empty) {
        return db
          .collection("likes")
          .add({
            postId: request.params.postId,
            userhandle: request.user.handle,
          })
          .then(() => {
            postdata.likeCount++;
            return postDoc.update({ likeCount: postdata.likeCount });
          })
          .then(() => {
            return response.json(postdata);
          });
      } else {
        return response.status(400).json({ error: "Post already liked" });
      }
    })
    .catch((err) => {
      response.status(500).json({ error: err.code });
      console.error(err);
    });
};

//Unlike a post
exports.unlikePost = (request, response) => {
  const likeDoc = db
    .collection("likes")
    .where("postId", "==", request.params.postId)
    .where("userhandle", "==", request.user.handle)
    .limit(1);
  const postDoc = db.doc(`/posts/${request.params.postId}`);

  let postdata = {};
  postDoc
    .get()
    .then((doc) => {
      if (doc.exists) {
        postdata = doc.data();
        postdata.postId = doc.id;
        return likeDoc.get();
      } else {
        return response.status(404).json({ error: "Post not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return response.status(400).json({ error: "Post not liked yet" });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            postdata.likeCount--;
            return postDoc.update({ likeCount: postdata.likeCount });
          })
          .then(() => {
            response.json(postdata);
          });
      }
    })
    .catch((err) => {
      response.status(500).json({ error: err.code });
      console.error(err);
    });
};

//Delete a Post
exports.deletePost = (request, response) => {
  const document = db.doc(`/posts/${request.params.postId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return response.status(404).json({ error: "Post not found" });
      }
      if (doc.data().userhandle !== request.user.handle) {
        return response.status(403).json({ error: "Unauthorized " });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      return response.json({
        message: "Post has been deleted successfully",
      });
    })
    .catch((err) => {
      response.status(500).json({ error: err.code });
      console.error(err);
    });
};
