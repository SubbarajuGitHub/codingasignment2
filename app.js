const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// Verifying JWT Token

const VerifyToken = (request, response, next) => {
  let JToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    JToken = authHeader.split(" ")[1];
  }

  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(JToken, "abcd", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API Register

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
  SELECT 
    * 
  FROM 
    user 
  WHERE 
    username = '${username}'`;
  const getUser = await db.get(selectUserQuery);

  if (getUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    const PasswordLength = password.length;
    if (PasswordLength < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const CreateUser = `
       INSERT INTO user
       (username, name, password, gender)
       VALUES
       ( "${username}",
        "${name}",
         "${hashedPassword}",
         "${gender}"
        )`;
      const UpdateUser = await db.run(CreateUser);
      const newUserId = UpdateUser.lastID;
      response.send("User Created Successfully");
    }
  }
});

//API 2 login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
  SELECT 
    * 
  FROM 
    user 
  WHERE 
    username = '${username}'`;
  const getUser = await db.get(selectUserQuery);

  if (getUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const ComparePassword = await bcrypt.compare(password, getUser.password);
    if (ComparePassword === true) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "abcd");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3

app.get("/user/tweets/feed/", VerifyToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;
  const tweetsQuery = `
  SELECT
    user.username, tweet.tweet, tweet.date_time AS dateTime
  FROM
    follower
  INNER JOIN tweet
    ON follower.following_user_id = tweet.user_id
  INNER JOIN user
    ON tweet.user_id = user.user_id
  WHERE
    follower.follower_user_id = ${userId}
  ORDER BY
    tweet.date_time DESC
  LIMIT 4;`;
  const last = await db.all(tweetsQuery);
  response.send(last);
});

// API 4 /user/following/

app.get("/user/following/", VerifyToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;
  const Query = `
  select name from user join follower on 
  user.user_id=follower.following_user_id
  where
  follower.follower_user_id=${userId}`;
  const last = await db.all(Query);
  response.send(last);
});

//API 5

app.get("/user/followers/", VerifyToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;
  const Query = `
  select name from user join follower on user.user_id = follower.following_user_id
  where
  follower.follower_user_id=${userId}`;
  const last = await db.all(Query);
  response.send(last);
  console.log(last);
});

//API 6

app.get("/tweets/:tweetId/", VerifyToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;

  const Query = `
  SELECT 
    tweet.tweet, 
    COUNT(like.like_id) AS likes,
    COUNT(reply.reply_id) AS replies, 
    tweet.date_time
FROM 
    tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    LEFT JOIN like ON like.tweet_id = tweet.tweet_id
    LEFT JOIN reply ON reply.tweet_id = tweet.tweet_id
WHERE 
    tweet.tweet_id = ${tweetId}
    AND follower.follower_user_id = ${userId}
GROUP BY 
    tweet.tweet_id`;
  const array = await db.all(Query);
  response.send(array);
});

//API 7

app.get("/tweets/:tweetId/likes/", VerifyToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;
  const Query = `
  SELECT 
    tweet.tweet, 
    COUNT(like.like_id) AS likes
FROM 
    tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    LEFT JOIN like ON like.tweet_id = tweet.tweet_id
    LEFT JOIN reply ON reply.tweet_id = tweet.tweet_id
WHERE 
    tweet.tweet_id = ${tweetId}
    AND follower.follower_user_id = ${userId}
GROUP BY 
    tweet.tweet_id`;
  const array = await db.all(Query);
  response.send(array);
});

//API 8
app.get("/tweets/:tweetId/replies/", VerifyToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;
  const Query = `
  SELECT 
    COUNT(reply.reply_id) AS replies
FROM 
    tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    LEFT JOIN like ON like.tweet_id = tweet.tweet_id
    LEFT JOIN reply ON reply.tweet_id = tweet.tweet_id
WHERE 
    tweet.tweet_id = ${tweetId}
    AND follower.follower_user_id = ${userId}
GROUP BY 
    tweet.tweet_id`;
  const array = await db.all(Query);
  response.send(array);
});

//API 9

app.get("/user/tweets/", VerifyToken, async (request, response) => {
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;
  const arrays = `
   select
   * 
   from
   tweet
   where 
   user_id=${userId}`;
  const array = await db.all(arrays);
  response.send(array);
});

//API 10

app.post("/user/tweets/", VerifyToken, async (request, response) => {
  const tweets = request.body;
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;
  const update = `
  insert into tweet
  (tweet)
  values
  ("${tweets}")`;
  await db.run(update);
  response.send("Created a Tweet");
});

//API 11

app.delete("/tweets/:tweetId/", VerifyToken, async (request, response) => {
  const tweetId = request.params;
  let { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  const userId = userDetails.user_id;

  const deleteQuery = `
  delete
  from
  tweet
  where 
  tweet_id=${tweetId} AND
  user_id=${userId}
`;

  const array = await db.run(deleteQuery);

  if (array === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send("Tweet Removed");
  }
});

module.exports = app;
