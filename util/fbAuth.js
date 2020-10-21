const { admin, db } = require("./admin");

module.exports = (request, response, next) => {
  let IdToken;
  if (
    request.headers.authorization &&
    request.headers.authorization.startsWith("Bearer ")
  ) {
    IdToken = request.headers.authorization.split("Bearer ")[1];
  } else {
    console.error("No token found");
    return response.status(403).json({ error: "Unauthorised" });
  }

  admin
    .auth()
    .verifyIdToken(IdToken)
    .then((decodedtoken) => {
      request.user = decodedtoken;
      return db
        .collection("users")
        .where("userID", "==", request.user.uid)
        .limit(1)
        .get();
    })
    .then((data) => {
      request.user.handle = data.docs[0].data().handle;
      request.user.imageUrl = data.docs[0].data().imageUrl;
      return next();
    })
    .catch((err) => {
      console.error("Error while verifying token ", err);
      return response.status(403).json({ error: err });
    });
};
