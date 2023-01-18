const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const databasePath = path.join(__dirname, "twitterClone.db");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//Security

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "hsdhjsfksfsl", async (error, payload) => {
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

//API 1 Register New User

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const CheckQuery = `
    SELECT
    *
    FROM
    user
    WHERE username="${username}"`;
  const dbUser = await database.get(CheckQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
            INSERT INTO 
            user (username, name, password, gender, location) 
            VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
      const dbResponse = await database.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2 LOGIN

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const FindUser = `
    SELECT
    *
    FROM
    user
    WHERE
    username="${username}"`;
  const SearchedQuery = await database.get(FindUser);

  if (SearchedQuery !== undefined) {
    const PasswordChecking = await bcrypt.compare(
      password,
      SearchedQuery.password
    );

    if (PasswordChecking === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "hsdhjsfksfsl");
      response.send({ jwtToken });
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//API 3

app.get("/user/tweets/feed/", async (request, response) => {
  const { username } = request;

  const user_id = `
  SELECT user_id
  FROM
  user
  WHERE
  username="${username}"
  `;
  const userId = await database.get(user_id);

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
});

module.exports = app;
