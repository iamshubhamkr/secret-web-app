//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

// const bcrypt = require('bcrypt');
// const saltRounds = 10;
// const md5 = require('md5');
// const encrypt = require('mongoose-encryption');

const app = express();



app.use(express.static('public'));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://localhost:27017/userDB', {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secrets: { type : Array , "default" : [] }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// const secret = process.env.SECRET;
// // userSchema.plugin(encrypt, { secret: secret });//Encrypt all field in documents
// userSchema.plugin(encrypt,{secret: secret, encryptedFields: ['password'] });

const User = new mongoose.model('User', userSchema);

// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());
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
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
    // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get('/',(req,res)=>{
  res.render('home');
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] } )
);

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
});

app.get('/login',(req,res)=>{
  res.render('login');
});

app.get('/register',(req,res)=>{
  res.render('register');
});

app.get('/secrets', function(req,res){
  User.find({"secrets": {$ne: null}},(err,foundUsers)=>{
    if(err){
      console.log(err);
    }else {
      if(foundUsers){
        // console.log(foundUsers);
        res.render('secrets',{usersWithSecrets: foundUsers});
      }
    }
  });
});

app.get('/submit', function(req,res){
  if(req.isAuthenticated()){
    res.render('submit');
  }else {
    res.redirect('/login');
  }
});

app.post('/submit',(req,res)=>{
  const submittedSecret = req.body.secret;
  // console.log(req.user);
  User.findById(req.user.id, (err,foundUser)=>{
    if(err){
      console.log(err);
    }else {
      if(foundUser){
        foundUser.secrets.push(submittedSecret);
        foundUser.save(()=>{
          res.redirect('/secrets');
        })
      }
    }
  })
});

app.get('/logout',(req,res)=>{
  req.logout();
  res.redirect('/');
});

app.post('/register',(req,res)=>{
  User.register({username: req.body.username},req.body.password,function(err,user){
    if(err){
      console.log(err);
      res.redirect('/register');
    }else {
      passport.authenticate('local')(req,res,function(){
        res.redirect('/secrets');
      });
    }
  });


//   bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
//     const newUser = new User({
//       email: req.body.username,
//       password: hash
//       // password: md5(req.body.password)
//     });
//
//     newUser.save(err=>{
//       if(err){
//         res.send(err);
//       }else {
//         res.render('secrets');
//       }
//     });
// });
});

app.post('/login',(req,res)=>{

const user = new User({
  username: req.body.username,
  password: req.body.password
});

req.login(user, function(err){
  if(err){
    console.log(err);
  }else {
    passport.authenticate('local')(req,res,function(){
      res.redirect('/secrets');
  });
}
});
//   const username = req.body.username;
//   const password = req.body.password;
//   // const password = md5(req.body.password);
//   User.findOne({email: username},(err, foundUser)=>{
//     if(err){
//       res.send(err);
//     }else {
//       if(foundUser){
//         bcrypt.compare(password, foundUser.password, function(err, result) {
//             if(result === true){
//               res.render('secrets');
//             }
// });
//
//         // if(foundUser.password === password){
//         //   res.render('secrets');
//         // }
//       }
//     }
//   });
 });



app.listen(3000, function() {
  console.log("Server started on port 3000");
});
