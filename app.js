//jshint esversion:6
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-findorcreate');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true, useUnifiedTopology: true});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  secrets: [String]
})

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET ,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({googleId: profile.id}, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/auth/google', passport.authenticate('google', {scope: ['profile']}));

app.get('/auth/google/secrets',
  passport.authenticate('google', {failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/secrets');
  });

app.get("/", (req, res) => {
    res.render("home");
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
})

app.get("/register", (req, res) => {
    res.render("register");
})

app.get("/secrets", (req, res) => {
    if (req.isAuthenticated()) {
      User.find({"secrets": {$ne: []}}, (err, users) => {
        res.render("secrets", {usersWithSecrets: users});
      });
    } else {
      res.redirect("/login");
    }
})

app.post("/register", (req, res) => {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
      if (!err) {
        passport.authenticate("local")(req, res, function() {
            res.redirect("/secrets");
        })
      } else {
          console.log(err);
          res.redirect("/register");
      }
    })
})

app.post("/login", (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, (err) => {
        if (!err) {
          passport.authenticate("local")(req, res, function() {
              res.redirect("/secrets");
          })
        } else {
            console.log(err);
            res.redirect("/login");
        }
    })
})

app.get("/submit", (req, res) => {
    res.render("submit");
})

app.post("/submit", (req, res) => {
    const secret = req.body.secret;
    const user = req.user;

    User.findOne({_id: user._id}, (err, foundUser) => {
      foundUser.secrets.push(secret);
      foundUser.save().then(res.redirect("/secrets"));
    })

})


app.listen(3000, function() {
  console.log("Listening on port 3000");
})
